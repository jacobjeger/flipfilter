/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * ADB Service — wraps @yume-chan/adb for browser-based WebUSB ADB communication.
 * All ADB operations go through this service.
 * Uses dynamic imports and `any` types to handle API differences across @yume-chan/adb versions.
 */

export interface PhoneInfo {
  model: string;
  androidVersion: string;
  storage: string;
  battery: string;
  serialNumber: string;
  imei: string;
}

export interface AdbCommandResult {
  success: boolean;
  output: string;
  error?: string;
}

export interface HealthCheckResult {
  browserPresent: boolean;
  playStorePresent: boolean;
  storageAvailable: string;
  androidVersion: string;
  deviceOwnerActive: boolean;
  accountsPresent: boolean;
  accountsList: string[];
  usbDebugging: boolean;
  lockdownLevel: number | null;
  score: number;
}

class AdbService {
  private device: any = null;
  private transport: any = null;
  private adb: any = null;
  private _connected = false;

  get connected(): boolean {
    return this._connected;
  }

  isSupported(): boolean {
    return typeof window !== 'undefined' && 'usb' in navigator;
  }

  async connect(): Promise<PhoneInfo> {
    if (!this.isSupported()) {
      throw new Error('WebUSB not supported. Please use Chrome or Edge.');
    }

    const webUsbModule: any = await import('@yume-chan/adb-daemon-webusb');
    const adbModule: any = await import('@yume-chan/adb');

    const AdbDaemonWebUsbDeviceManager = webUsbModule.AdbDaemonWebUsbDeviceManager;
    const manager = new AdbDaemonWebUsbDeviceManager(navigator.usb);
    this.device = await manager.requestDevice();

    if (!this.device) {
      throw new Error('No device selected');
    }

    const connection = await this.device.connect();
    const AdbDaemonTransport = adbModule.AdbDaemonTransport;
    const Adb = adbModule.Adb;

    // Use the official @yume-chan/adb-credential-web store
    // It generates PKCS#8 RSA keys via Web Crypto and stores them in IndexedDB
    const AdbWebCredentialStore = (await import('@yume-chan/adb-credential-web')).default;
    const credentialStore = new AdbWebCredentialStore('KosherFlip');

    this.transport = await AdbDaemonTransport.authenticate({
      serial: this.device.serial,
      connection,
      credentialStore,
    });

    this.adb = new Adb(this.transport);
    this._connected = true;

    return this.getPhoneInfo();
  }

  async disconnect(): Promise<void> {
    if (this.transport) {
      await this.transport.close();
    }
    this.device = null;
    this.transport = null;
    this.adb = null;
    this._connected = false;
  }

  async shell(command: string): Promise<string> {
    if (!this.adb) throw new Error('Not connected');

    const process = await this.adb.subprocess.spawn(command);
    let output = '';
    const reader = process.stdout.getReader();

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (value) {
          output += typeof value === 'string' ? value : new TextDecoder().decode(value);
        }
      }
    } finally {
      reader.releaseLock();
    }

    return output.trim();
  }

  async runCommand(command: string): Promise<AdbCommandResult> {
    try {
      const output = await this.shell(command);
      return { success: true, output };
    } catch (error: any) {
      return { success: false, output: '', error: error.message || String(error) };
    }
  }

  async getPhoneInfo(): Promise<PhoneInfo> {
    const [model, androidVersion, storage, battery, serialNumber, imei] = await Promise.all([
      this.shell('getprop ro.product.model').catch(() => 'Unknown'),
      this.shell('getprop ro.build.version.release').catch(() => 'Unknown'),
      this.shell('df /data | tail -1').catch(() => 'Unknown'),
      this.shell('dumpsys battery | grep level').catch(() => 'Unknown'),
      this.shell('getprop ro.serialno').catch(() => 'Unknown'),
      this.shell('service call iphonesubinfo 1 | grep -o "[0-9]" | tr -d "\\n"').catch(() => 'Unknown'),
    ]);

    return {
      model: model || 'Unknown',
      androidVersion: androidVersion || 'Unknown',
      storage: storage || 'Unknown',
      battery: battery.replace(/.*level:\s*/, '').trim() + '%' || 'Unknown',
      serialNumber: serialNumber || 'Unknown',
      imei: imei || 'Unknown',
    };
  }

  async getInstalledPackages(): Promise<string[]> {
    const output = await this.shell('pm list packages');
    return output
      .split('\n')
      .map(line => line.replace('package:', '').trim())
      .filter(Boolean);
  }

  async getThirdPartyPackages(): Promise<string[]> {
    const output = await this.shell('pm list packages -3');
    return output
      .split('\n')
      .map(line => line.replace('package:', '').trim())
      .filter(Boolean);
  }

  async uninstallPackage(packageName: string): Promise<AdbCommandResult> {
    return this.runCommand(`pm uninstall --user 0 ${packageName}`);
  }

  async restorePackage(packageName: string): Promise<AdbCommandResult> {
    return this.runCommand(`cmd package install-existing ${packageName}`);
  }

  async disablePackage(packageName: string): Promise<AdbCommandResult> {
    return this.runCommand(`pm disable-user --user 0 ${packageName}`);
  }

  async getAccounts(): Promise<string[]> {
    const output = await this.shell('dumpsys account | grep "Account {"');
    return output.split('\n').filter(Boolean).map(l => l.trim());
  }

  async factoryReset(): Promise<AdbCommandResult> {
    return this.runCommand('am broadcast -a android.intent.action.MASTER_CLEAR');
  }

  async setDeviceOwner(component: string): Promise<AdbCommandResult> {
    return this.runCommand(`dpm set-device-owner ${component}`);
  }

  async installApk(apkData: ArrayBuffer): Promise<AdbCommandResult> {
    try {
      if (!this.adb) throw new Error('Not connected');
      const sync = await this.adb.sync();
      const remotePath = '/data/local/tmp/install.apk';

      await sync.write({
        filename: remotePath,
        file: new ReadableStream({
          start(controller: ReadableStreamDefaultController) {
            controller.enqueue(new Uint8Array(apkData));
            controller.close();
          }
        }),
      });
      if (sync.dispose) await sync.dispose();

      const result = await this.runCommand(`pm install ${remotePath}`);
      await this.runCommand(`rm ${remotePath}`);
      return result;
    } catch (error: any) {
      return { success: false, output: '', error: error.message || String(error) };
    }
  }

  async sideloadApkFromUrl(url: string): Promise<AdbCommandResult> {
    try {
      const response = await fetch(url);
      const apkData = await response.arrayBuffer();
      return this.installApk(apkData);
    } catch (error: any) {
      return { success: false, output: '', error: error.message || String(error) };
    }
  }

  // Lockdown commands
  async applyLockdownLevel1(): Promise<AdbCommandResult[]> {
    const commands = [
      'pm disable-user --user 0 com.android.packageinstaller',
      'pm disable-user --user 0 com.google.android.packageinstaller',
      'pm disable-user --user 0 com.android.browser',
      'pm disable-user --user 0 com.google.android.chrome',
    ];
    const results: AdbCommandResult[] = [];
    for (const cmd of commands) {
      results.push(await this.runCommand(cmd));
    }
    return results;
  }

  async applyLockdownLevel2(): Promise<AdbCommandResult[]> {
    const level1 = await this.applyLockdownLevel1();
    const level2Commands = [
      'settings put global adb_enabled 0',
    ];
    const level2: AdbCommandResult[] = [];
    for (const cmd of level2Commands) {
      level2.push(await this.runCommand(cmd));
    }
    return [...level1, ...level2];
  }

  // Kyocera Device Control
  async kyoceraSimulateHashSequence(): Promise<AdbCommandResult[]> {
    const results: AdbCommandResult[] = [];
    for (let i = 0; i < 3; i++) {
      results.push(await this.runCommand('input keyevent KEYCODE_STAR'));
      results.push(await this.runCommand('input keyevent KEYCODE_POUND'));
    }
    return results;
  }

  async kyoceraLaunchDeviceControl(): Promise<AdbCommandResult> {
    return this.runCommand('am start -n com.kyocera.devicecontrol/.MainActivity');
  }

  // Health check
  async runHealthCheck(): Promise<HealthCheckResult> {
    const [
      browserCheck,
      playStoreCheck,
      storageCheck,
      androidVersion,
      deviceOwnerCheck,
      accountsCheck,
      adbCheck,
    ] = await Promise.all([
      this.runCommand('pm list packages com.android.browser'),
      this.runCommand('pm list packages com.android.vending'),
      this.shell('df /data | tail -1').catch(() => 'Unknown'),
      this.shell('getprop ro.build.version.release').catch(() => 'Unknown'),
      this.runCommand('dpm get-device-owner'),
      this.getAccounts().catch(() => [] as string[]),
      this.shell('settings get global adb_enabled').catch(() => '1'),
    ]);

    const browserPresent = browserCheck.output.includes('com.android.browser') ||
      (await this.runCommand('pm list packages com.google.android.chrome')).output.includes('chrome');
    const playStorePresent = playStoreCheck.output.includes('com.android.vending');
    const deviceOwnerActive = deviceOwnerCheck.success && deviceOwnerCheck.output.includes('kosherflip');
    const accountsPresent = Array.isArray(accountsCheck) && accountsCheck.length > 0;

    let score = 100;
    if (browserPresent) score -= 20;
    if (!deviceOwnerActive) score -= 15;
    if (accountsPresent) score -= 10;
    if (playStorePresent) score -= 10;

    return {
      browserPresent,
      playStorePresent,
      storageAvailable: storageCheck,
      androidVersion,
      deviceOwnerActive,
      accountsPresent,
      accountsList: Array.isArray(accountsCheck) ? accountsCheck : [],
      usbDebugging: adbCheck === '1',
      lockdownLevel: null,
      score: Math.max(0, score),
    };
  }

  // Push contacts
  async pushContacts(vcfContent: string): Promise<AdbCommandResult> {
    try {
      if (!this.adb) throw new Error('Not connected');
      const sync = await this.adb.sync();
      const remotePath = '/sdcard/contacts.vcf';
      const encoder = new TextEncoder();

      await sync.write({
        filename: remotePath,
        file: new ReadableStream({
          start(controller: ReadableStreamDefaultController) {
            controller.enqueue(encoder.encode(vcfContent));
            controller.close();
          }
        }),
      });
      if (sync.dispose) await sync.dispose();

      return this.runCommand(`am start -a android.intent.action.VIEW -d file://${remotePath} -t text/x-vcard`);
    } catch (error: any) {
      return { success: false, output: '', error: error.message || String(error) };
    }
  }
}

export const adbService = new AdbService();

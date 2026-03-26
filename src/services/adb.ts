/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * ADB Service — wraps @yume-chan/adb v0.0.24 for browser-based WebUSB ADB communication.
 * All ADB operations go through this service.
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
  private usbDevice: USBDevice | null = null;
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

    // Clean up any previous connection first
    await this.disconnect();

    // Step 1: Import modules
    const webUsbModule: any = await import('@yume-chan/adb-daemon-webusb');
    const adbModule: any = await import('@yume-chan/adb');
    const credModule: any = await import('@yume-chan/adb-credential-web');

    const AdbDaemonWebUsbDeviceManager = webUsbModule.AdbDaemonWebUsbDeviceManager;
    const AdbDaemonTransport = adbModule.AdbDaemonTransport;
    const Adb = adbModule.Adb;
    const AdbWebCredentialStore = credModule.default;

    // Step 2: Request USB device
    const manager = AdbDaemonWebUsbDeviceManager.BROWSER;
    if (!manager) {
      throw new Error('WebUSB not available. Use Chrome or Edge.');
    }

    this.device = await manager.requestDevice();
    if (!this.device) {
      throw new Error('No device selected');
    }

    // Keep reference to raw USB device for cleanup
    this.usbDevice = this.device.raw;

    // Step 3: Connect to USB device (claim interface)
    let connection: any;
    try {
      connection = await this.device.connect();
    } catch (err: any) {
      // If device is busy, try to release it first
      if (err.message?.includes('claimed') || err.message?.includes('use') || err.name === 'NetworkError') {
        try {
          if (this.usbDevice?.opened) {
            await this.usbDevice.close();
          }
          await this.usbDevice?.open();
          // Retry
          connection = await this.device.connect();
        } catch {
          throw new Error(
            'Device is in use by another program. Please:\n' +
            '1. Close any other browser tabs using WebUSB\n' +
            '2. Run "adb kill-server" in your terminal\n' +
            '3. Unplug and replug the phone\n' +
            '4. Try again'
          );
        }
      } else {
        throw err;
      }
    }

    // Step 4: Authenticate with ADB daemon
    const credentialStore = new AdbWebCredentialStore('KosherFlip');

    try {
      this.transport = await AdbDaemonTransport.authenticate({
        serial: this.device.serial,
        connection,
        credentialStore,
      });
    } catch (err: any) {
      // Provide helpful error message
      const msg = err.message || String(err);
      if (msg.includes('No authenticator')) {
        throw new Error(
          'ADB authentication failed. Please check:\n' +
          '1. USB Debugging is enabled on the phone\n' +
          '2. Accept the "Allow USB debugging" prompt on the phone\n' +
          '3. Try disconnecting and reconnecting'
        );
      }
      throw new Error(`ADB authentication error: ${msg}`);
    }

    // Step 5: Create ADB instance
    this.adb = new Adb(this.transport);
    this._connected = true;

    return this.getPhoneInfo();
  }

  async disconnect(): Promise<void> {
    try {
      if (this.transport) {
        await this.transport.close().catch(() => {});
      }
    } catch {
      // ignore
    }
    try {
      if (this.usbDevice?.opened) {
        await this.usbDevice.close().catch(() => {});
      }
    } catch {
      // ignore
    }
    this.device = null;
    this.usbDevice = null;
    this.transport = null;
    this.adb = null;
    this._connected = false;
  }

  private withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
    return Promise.race([
      promise,
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error(`Command timed out after ${ms / 1000}s`)), ms),
      ),
    ]);
  }

  async shell(command: string): Promise<string> {
    if (!this.adb) throw new Error('Not connected');

    const timeout = 15000; // 15s per command

    // Use exec: protocol — runs the command and closes the socket when done.
    // Unlike shell: which keeps the socket open (causing hangs with pm uninstall etc.),
    // exec: behaves like a proper subprocess.
    try {
      const output: string = await this.withTimeout(
        this.adb.createSocketAndWait(`exec:${command}`),
        timeout,
      );
      return output.trim();
    } catch {
      // Fallback: try shell: protocol (works for simpler commands like getprop)
      try {
        const output: string = await this.withTimeout(
          this.adb.createSocketAndWait(`shell:${command}`),
          timeout,
        )
        return output.trim();
      } catch (err: any) {
        throw new Error(`Shell command failed: ${err.message || err}`);
      }
    }
  }

  async runCommand(command: string): Promise<AdbCommandResult> {
    try {
      const output = await this.shell(command);
      // Check for common failure patterns in pm/dpm/settings output
      const lower = output.toLowerCase();
      const isFailure =
        lower.startsWith('failure') ||
        lower.startsWith('exception') ||
        lower.includes('failure [') ||
        lower.includes('exception occurred') ||
        lower.includes('unknown command') ||
        lower.includes('inaccessible or not found');
      if (isFailure) {
        return { success: false, output, error: output };
      }
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

  async enterMaintenanceMode(): Promise<AdbCommandResult> {
    return this.runCommand(
      'am broadcast -a com.kosherflip.MAINTENANCE_MODE --ez unlock true -n com.kosherflip/.MaintenanceReceiver'
    );
  }

  async exitMaintenanceMode(): Promise<AdbCommandResult> {
    return this.runCommand(
      'am broadcast -a com.kosherflip.MAINTENANCE_MODE --ez unlock false -n com.kosherflip/.MaintenanceReceiver'
    );
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
      if (apkData.byteLength === 0) {
        return { success: false, output: '', error: 'APK file is empty' };
      }

      const remotePath = '/data/local/tmp/install.apk';

      // Use ADB sync protocol to push file — much faster than shell-based transfer
      // We call adbSyncPushV1 directly to bypass the mkdir workaround
      // (which uses subprocess private methods broken by Next.js bundler)
      const { ReadableStream: AdbReadableStream } = await import('@yume-chan/stream-extra');
      const { adbSyncPushV1 } = await import('@yume-chan/adb/esm/commands/sync/push.js');
      const sync = await this.adb.sync();

      try {
        const fileStream = new AdbReadableStream<Uint8Array>({
          start(controller) {
            controller.enqueue(new Uint8Array(apkData));
            controller.close();
          },
        });

        await adbSyncPushV1({
          socket: sync._socket,
          filename: remotePath,
          file: fileStream,
          permission: 0o644,
          mtime: (Date.now() / 1000) | 0,
        });
      } finally {
        await sync.dispose();
      }

      // Install the APK
      const result = await this.runCommand(`pm install ${remotePath}`);
      // Clean up
      await this.runCommand(`rm -f ${remotePath}`);
      return result;
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
      'settings put secure install_non_market_apps 0',
      'settings put global install_non_market_apps 0',
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
      const remotePath = '/sdcard/contacts.vcf';

      const { ReadableStream: AdbReadableStream } = await import('@yume-chan/stream-extra');
      const { adbSyncPushV1 } = await import('@yume-chan/adb/esm/commands/sync/push.js');
      const sync = await this.adb.sync();
      const encoder = new TextEncoder();

      try {
        const fileStream = new AdbReadableStream<Uint8Array>({
          start(controller) {
            controller.enqueue(encoder.encode(vcfContent));
            controller.close();
          },
        });

        await adbSyncPushV1({
          socket: sync._socket,
          filename: remotePath,
          file: fileStream,
          permission: 0o644,
          mtime: (Date.now() / 1000) | 0,
        });
      } finally {
        await sync.dispose();
      }

      return this.runCommand(`am start -a android.intent.action.VIEW -d file://${remotePath} -t text/x-vcard`);
    } catch (error: any) {
      return { success: false, output: '', error: error.message || String(error) };
    }
  }
}

export const adbService = new AdbService();

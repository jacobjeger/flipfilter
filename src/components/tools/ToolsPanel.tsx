'use client';

import React, { useState, useRef } from 'react';
import { useApp } from '@/context/AppContext';
import { adbService } from '@/services/adb';
import { generatePdfReport, downloadPdfBlob } from '@/utils/pdf';
import { generateQrDataUrl } from '@/utils/qr';
import { csvToVcf } from '@/utils/csv';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ToolCardState {
  loading: boolean;
  success: string | null;
  error: string | null;
}

function useToolState(): [ToolCardState, {
  start: () => void;
  ok: (msg: string) => void;
  fail: (msg: string) => void;
  reset: () => void;
}] {
  const [state, setState] = useState<ToolCardState>({ loading: false, success: null, error: null });
  return [
    state,
    {
      start: () => setState({ loading: true, success: null, error: null }),
      ok: (msg: string) => setState({ loading: false, success: msg, error: null }),
      fail: (msg: string) => setState({ loading: false, success: null, error: msg }),
      reset: () => setState({ loading: false, success: null, error: null }),
    },
  ];
}

// ---------------------------------------------------------------------------
// ToolCard wrapper
// ---------------------------------------------------------------------------

function ToolCard({
  title,
  description,
  disabled,
  children,
}: {
  title: string;
  description: string;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div
      className={`bg-white rounded-xl border shadow-sm p-5 flex flex-col gap-3 ${
        disabled ? 'opacity-50 pointer-events-none' : 'border-blue-100'
      }`}
    >
      <h3 className="text-sm font-semibold text-blue-900">{title}</h3>
      <p className="text-xs text-gray-500 leading-relaxed">{description}</p>
      <div className="mt-auto flex flex-col gap-2">{children}</div>
    </div>
  );
}

function Feedback({ state }: { state: ToolCardState }) {
  if (state.loading) {
    return (
      <div className="flex items-center gap-2 text-xs text-blue-600">
        <span className="inline-block w-3 h-3 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
        Working...
      </div>
    );
  }
  if (state.success) {
    return <p className="text-xs text-green-600 font-medium">{state.success}</p>;
  }
  if (state.error) {
    return <p className="text-xs text-red-600 font-medium">{state.error}</p>;
  }
  return null;
}

function ActionButton({
  onClick,
  disabled,
  children,
}: {
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="px-3 py-2 bg-blue-600 text-white text-xs font-medium rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
    >
      {children}
    </button>
  );
}

// Shared utilities imported from @/utils/pdf, @/utils/qr, @/utils/csv

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export default function ToolsPanel() {
  const {
    connected,
    selectedDevice,
    deviceCompat,
    phoneInfo,
    addLog,
    setupLog,
    lockdownLevel,
    preHealthCheck,
    postHealthCheck,
  } = useApp();

  // Per-tool states
  const [wazeState, wazeCtl] = useToolState();
  const [matvtState, matvtCtl] = useToolState();
  const [contactState, contactCtl] = useToolState();
  const [backupState, backupCtl] = useToolState();
  const [restoreState, restoreCtl] = useToolState();
  const [kyoceraSeqState, kyoceraSeqCtl] = useToolState();
  const [kyoceraLaunchState, kyoceraLaunchCtl] = useToolState();
  const [healthState, healthCtl] = useToolState();
  const [verifyState, verifyCtl] = useToolState();
  const [pdfState, pdfCtl] = useToolState();
  const [qrState, qrCtl] = useToolState();

  const [healthResult, setHealthResult] = useState<{
    score: number;
    checks: { label: string; pass: boolean }[];
  } | null>(null);

  const [verifyResult, setVerifyResult] = useState<{
    passed: boolean;
    total: number;
    passCount: number;
    checks: { label: string; pass: boolean; detail: string }[];
  } | null>(null);

  const [kyoceraPassword, setKyoceraPassword] = useState('000000');
  const [restoreDiff, setRestoreDiff] = useState<{ missing: string[]; extra: string[] } | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);

  const contactInputRef = useRef<HTMLInputElement>(null);
  const restoreInputRef = useRef<HTMLInputElement>(null);
  const wazeInputRef = useRef<HTMLInputElement>(null);
  const matvtInputRef = useRef<HTMLInputElement>(null);

  // ------- Actions -------

  const handleInstallApk = async (
    file: File,
    name: string,
    ctl: ReturnType<typeof useToolState>[1],
  ) => {
    ctl.start();
    addLog(`Installing ${name}...`);
    try {
      const apkData = await file.arrayBuffer();
      if (apkData.byteLength === 0) {
        throw new Error('APK file is empty');
      }
      const result = await adbService.installApk(apkData);
      if (result.success) {
        ctl.ok(`${name} installed successfully`);
        addLog(`${name} installed`);
      } else {
        throw new Error(result.error || 'Install failed');
      }
    } catch (err: any) {
      ctl.fail(err.message || `Failed to install ${name}`);
      addLog(`${name} install failed: ${err.message}`);
    }
  };

  const handleWazeFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    wazeCtl.start();
    addLog('Installing Waze...');
    try {
      const apkData = await file.arrayBuffer();
      if (apkData.byteLength === 0) throw new Error('APK file is empty');
      const result = await adbService.installApk(apkData);
      if (!result.success) throw new Error(result.error || 'Install failed');

      addLog('Waze installed, granting location permissions...');
      await adbService.runCommand('pm grant com.waze android.permission.ACCESS_FINE_LOCATION');
      await adbService.runCommand('pm grant com.waze android.permission.ACCESS_COARSE_LOCATION');
      addLog('Waze location permissions granted');

      wazeCtl.ok('Waze installed with location permissions');
    } catch (err: any) {
      wazeCtl.fail(err.message || 'Failed to install Waze');
      addLog(`Waze install failed: ${err.message}`);
    }
    if (wazeInputRef.current) wazeInputRef.current.value = '';
  };

  const handleMatvtFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    matvtCtl.start();
    addLog('Installing MATVT Cursor...');
    try {
      const apkData = await file.arrayBuffer();
      if (apkData.byteLength === 0) throw new Error('APK file is empty');
      const result = await adbService.installApk(apkData);
      if (!result.success) throw new Error(result.error || 'Install failed');

      addLog('MATVT installed, enabling accessibility service...');
      // Enable MATVT mouse accessibility service
      await adbService.runCommand(
        'settings put secure enabled_accessibility_services com.matvt.app/com.matvt.app.MouseService'
      );
      await adbService.runCommand('settings put secure accessibility_enabled 1');
      addLog('MATVT accessibility service enabled');

      matvtCtl.ok('MATVT installed and accessibility service enabled');
    } catch (err: any) {
      matvtCtl.fail(err.message || 'Failed to install MATVT');
      addLog(`MATVT install failed: ${err.message}`);
    }
    if (matvtInputRef.current) matvtInputRef.current.value = '';
  };

  const handleImportContacts = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    contactCtl.start();
    addLog('Importing contacts...');
    try {
      const csvText = await file.text();
      const vcf = csvToVcf(csvText);
      if (!vcf) throw new Error('No valid contacts found in CSV');
      const result = await adbService.pushContacts(vcf);
      if (result.success) {
        contactCtl.ok('Contacts imported successfully');
        addLog('Contacts imported');
      } else {
        throw new Error(result.error || 'Push failed');
      }
    } catch (err: any) {
      contactCtl.fail(err.message || 'Failed to import contacts');
      addLog(`Contact import failed: ${err.message}`);
    } finally {
      if (contactInputRef.current) contactInputRef.current.value = '';
    }
  };

  const handleBackupAppList = async () => {
    backupCtl.start();
    addLog('Backing up app list...');
    try {
      const packages = await adbService.getInstalledPackages();
      const backup = {
        model: phoneInfo?.model || 'unknown',
        date: new Date().toISOString(),
        packages,
      };
      const dateStr = new Date().toISOString().split('T')[0];
      const modelStr = (phoneInfo?.model || 'unknown').replace(/\s+/g, '_');
      const filename = `kosherflip_backup_${modelStr}_${dateStr}.json`;
      const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
      backupCtl.ok(`Backed up ${packages.length} packages`);
      addLog(`App list backed up: ${packages.length} packages`);
    } catch (err: any) {
      backupCtl.fail(err.message || 'Backup failed');
      addLog(`Backup failed: ${err.message}`);
    }
  };

  const handleRestoreFromBackup = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    restoreCtl.start();
    setRestoreDiff(null);
    try {
      const text = await file.text();
      const backup = JSON.parse(text);
      const backupPackages: string[] = backup.packages || [];
      const currentPackages = await adbService.getInstalledPackages();

      const currentSet = new Set(currentPackages);
      const backupSet = new Set(backupPackages);

      const missing = backupPackages.filter((p: string) => !currentSet.has(p));
      const extra = currentPackages.filter(p => !backupSet.has(p));

      setRestoreDiff({ missing, extra });

      if (missing.length === 0) {
        restoreCtl.ok('All packages from backup are already present');
        addLog('Restore check: no missing packages');
        return;
      }

      addLog(`Restoring ${missing.length} missing packages...`);
      let restored = 0;
      let failed = 0;
      for (const pkg of missing) {
        const result = await adbService.shell(`cmd package install-existing ${pkg}`).catch(() => '');
        if (result && !result.toLowerCase().includes('error')) {
          restored++;
        } else {
          failed++;
        }
      }
      restoreCtl.ok(`Restored ${restored} of ${missing.length} packages${failed > 0 ? ` (${failed} failed)` : ''}`);
      addLog(`Restore complete: ${restored} restored, ${failed} failed`);
    } catch (err: any) {
      restoreCtl.fail(err.message || 'Restore failed');
      addLog(`Restore failed: ${err.message}`);
    } finally {
      if (restoreInputRef.current) restoreInputRef.current.value = '';
    }
  };

  const handleKyoceraSequence = async () => {
    kyoceraSeqCtl.start();
    addLog('Simulating *#*#*# sequence...');
    try {
      const results = await adbService.kyoceraSimulateHashSequence();
      const allOk = results.every(r => r.success);
      if (allOk) {
        kyoceraSeqCtl.ok('Sequence simulated successfully');
        addLog('Kyocera hash sequence simulated');
      } else {
        throw new Error('Some key events failed');
      }
    } catch (err: any) {
      kyoceraSeqCtl.fail(err.message || 'Failed');
      addLog(`Kyocera sequence failed: ${err.message}`);
    }
  };

  const handleKyoceraLaunch = async () => {
    kyoceraLaunchCtl.start();
    addLog('Launching Device Control...');
    try {
      const result = await adbService.kyoceraLaunchDeviceControl();
      if (result.success) {
        kyoceraLaunchCtl.ok('Device Control launched');
        addLog('Kyocera Device Control launched');
      } else {
        throw new Error(result.error || 'Launch failed');
      }
    } catch (err: any) {
      kyoceraLaunchCtl.fail(err.message || 'Failed');
      addLog(`Kyocera Device Control failed: ${err.message}`);
    }
  };

  const handleHealthCheck = async () => {
    healthCtl.start();
    setHealthResult(null);
    addLog('Running health check...');
    try {
      const result = await adbService.runHealthCheck();
      const checks = [
        { label: 'Browser removed', pass: !result.browserPresent },
        { label: 'Play Store removed', pass: !result.playStorePresent },
        { label: 'Device Owner active', pass: result.deviceOwnerActive },
        { label: 'No accounts present', pass: !result.accountsPresent },
        { label: 'USB debugging enabled', pass: result.usbDebugging },
      ];
      setHealthResult({ score: result.score, checks });
      healthCtl.ok(`Health score: ${result.score}/100`);
      addLog(`Health check complete: ${result.score}/100`);
    } catch (err: any) {
      healthCtl.fail(err.message || 'Health check failed');
      addLog(`Health check failed: ${err.message}`);
    }
  };

  const handleVerifySetup = async () => {
    verifyCtl.start();
    setVerifyResult(null);
    addLog('Running full filter verification...');
    try {
      const checks: { label: string; pass: boolean; detail: string }[] = [];

      // 1. Check browsers removed
      const browserPkgs = [
        'com.android.browser',
        'com.google.android.chrome',
        'com.opera.browser',
        'com.UCMobile.intl',
        'org.mozilla.firefox',
      ];
      for (const pkg of browserPkgs) {
        const r = await adbService.runCommand(`pm list packages ${pkg}`);
        const found = r.output.includes(pkg);
        checks.push({
          label: `Browser: ${pkg.split('.').pop()}`,
          pass: !found,
          detail: found ? 'Still installed' : 'Removed',
        });
      }

      // 2. Check social media removed
      const socialPkgs = [
        'com.facebook.katana',
        'com.instagram.android',
        'com.twitter.android',
        'com.tiktok.android',
        'com.snapchat.android',
        'com.whatsapp',
        'com.discord',
      ];
      for (const pkg of socialPkgs) {
        const r = await adbService.runCommand(`pm list packages ${pkg}`);
        const found = r.output.includes(pkg);
        checks.push({
          label: `Social: ${pkg.split('.').pop()}`,
          pass: !found,
          detail: found ? 'Still installed' : 'Removed',
        });
      }

      // 3. Check entertainment removed
      const entertainmentPkgs = [
        'com.google.android.youtube',
        'com.spotify.music',
        'com.netflix.mediaclient',
        'com.google.android.apps.youtube.music',
      ];
      for (const pkg of entertainmentPkgs) {
        const r = await adbService.runCommand(`pm list packages ${pkg}`);
        const found = r.output.includes(pkg);
        checks.push({
          label: `Media: ${pkg.split('.').pop()}`,
          pass: !found,
          detail: found ? 'Still installed' : 'Removed',
        });
      }

      // 4. Check Play Store removed
      const playStore = await adbService.runCommand('pm list packages com.android.vending');
      checks.push({
        label: 'Google Play Store',
        pass: !playStore.output.includes('com.android.vending'),
        detail: playStore.output.includes('com.android.vending') ? 'Still installed' : 'Removed',
      });

      // 5. Check package installer disabled
      const pkgInstaller = await adbService.runCommand('pm list packages -e com.android.packageinstaller');
      const gPkgInstaller = await adbService.runCommand('pm list packages -e com.google.android.packageinstaller');
      checks.push({
        label: 'Package Installer blocked',
        pass: !pkgInstaller.output.includes('packageinstaller') && !gPkgInstaller.output.includes('packageinstaller'),
        detail: (pkgInstaller.output.includes('packageinstaller') || gPkgInstaller.output.includes('packageinstaller'))
          ? 'Still enabled' : 'Disabled',
      });

      // 6. Check Google accounts
      const accounts = await adbService.runCommand('dumpsys account | grep "Account {"');
      const hasAccounts = accounts.output.includes('Account {');
      checks.push({
        label: 'No Google accounts',
        pass: !hasAccounts,
        detail: hasAccounts ? 'Accounts found' : 'Clean',
      });

      // 7. Check unknown sources
      const unknownSources = await adbService.runCommand('settings get secure install_non_market_apps');
      checks.push({
        label: 'Unknown sources blocked',
        pass: unknownSources.output.trim() === '0',
        detail: unknownSources.output.trim() === '0' ? 'Blocked' : 'Allowed',
      });

      // 8. Check USB debugging status
      const adbEnabled = await adbService.runCommand('settings get global adb_enabled');
      checks.push({
        label: 'USB Debugging status',
        pass: true, // informational
        detail: adbEnabled.output.trim() === '1' ? 'Enabled (Standard lockdown)' : 'Disabled (Maximum lockdown)',
      });

      // 9. Check Device Owner
      const deviceOwner = await adbService.runCommand('dpm get-device-owner');
      checks.push({
        label: 'Device Owner active',
        pass: deviceOwner.output.includes('ComponentInfo') || deviceOwner.output.includes('kosherflip'),
        detail: deviceOwner.output.includes('ComponentInfo') ? 'Active' : 'Not set',
      });

      // 10. Check Waze is installed (if it should be)
      const waze = await adbService.runCommand('pm list packages com.waze');
      checks.push({
        label: 'Waze installed',
        pass: waze.output.includes('com.waze'),
        detail: waze.output.includes('com.waze') ? 'Installed' : 'Not installed',
      });

      const passCount = checks.filter(c => c.pass).length;
      const total = checks.length;
      const passed = passCount >= total - 2; // Allow up to 2 non-critical failures

      setVerifyResult({ passed, total, passCount, checks });
      verifyCtl.ok(`${passCount}/${total} checks passed`);
      addLog(`Filter verification: ${passCount}/${total} passed — ${passed ? 'SETUP COMPLETE' : 'NEEDS ATTENTION'}`);
    } catch (err: any) {
      verifyCtl.fail(err.message || 'Verification failed');
      addLog(`Verification failed: ${err.message}`);
    }
  };

  const handlePdfReport = async () => {
    pdfCtl.start();
    addLog('Generating PDF report...');
    try {
      const blob = await generatePdfReport({
        model: phoneInfo?.model || 'Unknown',
        androidVersion: phoneInfo?.androidVersion || 'Unknown',
        imei: phoneInfo?.imei || 'Unknown',
        lockdownLevel,
        setupLog,
      });
      downloadPdfBlob(blob);
      pdfCtl.ok('PDF report downloaded');
      addLog('PDF report generated');
    } catch (err: any) {
      pdfCtl.fail(err.message || 'PDF generation failed');
      addLog(`PDF report failed: ${err.message}`);
    }
  };

  const handleQrCode = async () => {
    qrCtl.start();
    setQrDataUrl(null);
    try {
      const config = {
        model: phoneInfo?.model || selectedDevice?.displayName || 'Unknown',
        androidVersion: phoneInfo?.androidVersion || 'Unknown',
        lockdownLevel,
        preHealthScore: preHealthCheck?.score ?? null,
        postHealthScore: postHealthCheck?.score ?? null,
        timestamp: new Date().toISOString(),
      };
      const dataUrl = await generateQrDataUrl(JSON.stringify(config));
      setQrDataUrl(dataUrl);
      qrCtl.ok('QR code generated');
      addLog('QR code generated');
    } catch (err: any) {
      qrCtl.fail(err.message || 'QR generation failed');
      addLog(`QR code failed: ${err.message}`);
    }
  };

  // ------- Render -------

  return (
    <div className="max-w-6xl mx-auto px-4 py-6">
      <h2 className="text-lg font-bold text-blue-900 mb-1">Tools</h2>
      <p className="text-sm text-gray-500 mb-6">One-click utilities for device setup and management</p>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* 1. Install Waze */}
        <ToolCard
          title="Install Waze"
          description="Sideload Waze and auto-grant location permissions."
          disabled={!connected}
        >
          <input
            ref={wazeInputRef}
            type="file"
            accept=".apk"
            onChange={handleWazeFile}
            className="hidden"
            id="waze-apk-input"
          />
          <ActionButton
            onClick={() => wazeInputRef.current?.click()}
            disabled={wazeState.loading}
          >
            {wazeState.loading ? 'Installing...' : 'Select Waze APK'}
          </ActionButton>
          <Feedback state={wazeState} />
        </ToolCard>

        {/* 2. Install MATVT Cursor */}
        <ToolCard
          title="Install MATVT Cursor"
          description="Sideload MATVT mouse cursor and auto-enable accessibility service."
          disabled={!connected}
        >
          <input
            ref={matvtInputRef}
            type="file"
            accept=".apk"
            onChange={handleMatvtFile}
            className="hidden"
            id="matvt-apk-input"
          />
          <ActionButton
            onClick={() => matvtInputRef.current?.click()}
            disabled={matvtState.loading}
          >
            {matvtState.loading ? 'Installing...' : 'Select MATVT APK'}
          </ActionButton>
          <Feedback state={matvtState} />
        </ToolCard>

        {/* 3. Import Contacts */}
        <ToolCard
          title="Import Contacts"
          description="Upload a CSV file to import contacts onto the device in VCF format."
          disabled={!connected}
        >
          <input
            ref={contactInputRef}
            type="file"
            accept=".csv"
            onChange={handleImportContacts}
            className="hidden"
            id="contact-csv-input"
          />
          <ActionButton
            onClick={() => contactInputRef.current?.click()}
            disabled={contactState.loading}
          >
            {contactState.loading ? 'Importing...' : 'Choose CSV File'}
          </ActionButton>
          <Feedback state={contactState} />
        </ToolCard>

        {/* 4. Backup App List */}
        <ToolCard
          title="Backup App List"
          description="Export all installed packages as a JSON file for later comparison or restore."
          disabled={!connected}
        >
          <ActionButton onClick={handleBackupAppList} disabled={backupState.loading}>
            {backupState.loading ? 'Exporting...' : 'Backup App List'}
          </ActionButton>
          <Feedback state={backupState} />
        </ToolCard>

        {/* 5. Restore from Backup */}
        <ToolCard
          title="Restore from Backup"
          description="Upload a previously saved JSON backup to restore missing packages."
          disabled={!connected}
        >
          <input
            ref={restoreInputRef}
            type="file"
            accept=".json"
            onChange={handleRestoreFromBackup}
            className="hidden"
            id="restore-json-input"
          />
          <ActionButton
            onClick={() => restoreInputRef.current?.click()}
            disabled={restoreState.loading}
          >
            {restoreState.loading ? 'Restoring...' : 'Choose Backup File'}
          </ActionButton>
          <Feedback state={restoreState} />
          {restoreDiff && (
            <div className="text-xs space-y-1 mt-1">
              {restoreDiff.missing.length > 0 && (
                <div>
                  <span className="font-medium text-orange-600">Missing ({restoreDiff.missing.length}):</span>
                  <ul className="ml-3 text-gray-600 max-h-24 overflow-y-auto">
                    {restoreDiff.missing.map(p => (
                      <li key={p} className="truncate">{p}</li>
                    ))}
                  </ul>
                </div>
              )}
              {restoreDiff.extra.length > 0 && (
                <div>
                  <span className="font-medium text-blue-600">New since backup ({restoreDiff.extra.length}):</span>
                  <ul className="ml-3 text-gray-600 max-h-24 overflow-y-auto">
                    {restoreDiff.extra.map(p => (
                      <li key={p} className="truncate">{p}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </ToolCard>

        {/* 6. Kyocera Device Control */}
        {deviceCompat?.supportsKyoceraDeviceControl && (
          <ToolCard
            title="Kyocera Device Control"
            description="Access Kyocera-specific device management features."
            disabled={!connected}
          >
            <ActionButton onClick={handleKyoceraSequence} disabled={kyoceraSeqState.loading}>
              {kyoceraSeqState.loading ? 'Simulating...' : 'Simulate *#*#*# Sequence'}
            </ActionButton>
            <Feedback state={kyoceraSeqState} />

            <ActionButton onClick={handleKyoceraLaunch} disabled={kyoceraLaunchState.loading}>
              {kyoceraLaunchState.loading ? 'Launching...' : 'Launch Device Control'}
            </ActionButton>
            <Feedback state={kyoceraLaunchState} />

            <div className="flex items-center gap-2 mt-1">
              <label className="text-xs text-gray-500 whitespace-nowrap">Password:</label>
              <input
                type="text"
                value={kyoceraPassword}
                onChange={(e) => setKyoceraPassword(e.target.value)}
                className="flex-1 text-xs border border-gray-200 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-400"
                placeholder="000000"
              />
            </div>
          </ToolCard>
        )}

        {/* 7. LG Service Menu */}
        {deviceCompat?.supportsLGServiceMenu && (
          <ToolCard
            title="LG Service Menu"
            description="Access the hidden LG service menu for advanced device settings."
          >
            <div className="bg-blue-50 rounded-lg p-3 text-xs text-blue-800 space-y-2">
              <p className="font-medium">Dial the following code on the phone keypad:</p>
              <p className="font-mono text-base text-center font-bold tracking-wider text-blue-700">
                {deviceCompat.adbDebugCode || '##228378'}
              </p>
              <p className="text-gray-500">
                This will open the hidden service/debug menu. Use it to toggle ADB debugging or access
                advanced settings.
              </p>
            </div>
          </ToolCard>
        )}

        {/* 8. Phone Health Check */}
        <ToolCard
          title="Phone Health Check"
          description="Run a comprehensive health check and get a kosher compliance score (0-100)."
          disabled={!connected}
        >
          <ActionButton onClick={handleHealthCheck} disabled={healthState.loading}>
            {healthState.loading ? 'Checking...' : 'Run Health Check'}
          </ActionButton>
          <Feedback state={healthState} />
          {healthResult && (
            <div className="mt-1 space-y-2">
              <div className="flex items-center gap-3">
                <div
                  className={`text-2xl font-bold ${
                    healthResult.score >= 80
                      ? 'text-green-600'
                      : healthResult.score >= 50
                      ? 'text-yellow-600'
                      : 'text-red-600'
                  }`}
                >
                  {healthResult.score}
                </div>
                <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${
                      healthResult.score >= 80
                        ? 'bg-green-500'
                        : healthResult.score >= 50
                        ? 'bg-yellow-500'
                        : 'bg-red-500'
                    }`}
                    style={{ width: `${healthResult.score}%` }}
                  />
                </div>
                <span className="text-xs text-gray-400">/100</span>
              </div>
              <ul className="text-xs space-y-1">
                {healthResult.checks.map((c) => (
                  <li key={c.label} className="flex items-center gap-1.5">
                    <span className={`w-1.5 h-1.5 rounded-full ${c.pass ? 'bg-green-500' : 'bg-red-400'}`} />
                    <span className={c.pass ? 'text-green-700' : 'text-red-600'}>{c.label}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </ToolCard>

        {/* 8b. Verify Filter Setup */}
        <ToolCard
          title="Verify Filter Setup"
          description="Comprehensive test to verify the phone is fully filtered — checks all browsers, social media, entertainment, Play Store, accounts, and lockdown."
          disabled={!connected}
        >
          <ActionButton onClick={handleVerifySetup} disabled={verifyState.loading}>
            {verifyState.loading ? 'Verifying...' : 'Run Full Verification'}
          </ActionButton>
          <Feedback state={verifyState} />
          {verifyResult && (
            <div className="mt-2 space-y-2">
              {/* Overall status banner */}
              <div className={`p-3 rounded-lg text-center font-bold text-lg ${
                verifyResult.passed
                  ? 'bg-green-50 text-green-700 border border-green-200'
                  : 'bg-red-50 text-red-700 border border-red-200'
              }`}>
                {verifyResult.passed ? 'FILTER SETUP COMPLETE' : 'SETUP NEEDS ATTENTION'}
              </div>
              <div className="text-center text-sm text-gray-500">
                {verifyResult.passCount} / {verifyResult.total} checks passed
              </div>
              {/* Progress bar */}
              <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${
                    verifyResult.passCount === verifyResult.total
                      ? 'bg-green-500'
                      : verifyResult.passCount >= verifyResult.total - 2
                      ? 'bg-yellow-500'
                      : 'bg-red-500'
                  }`}
                  style={{ width: `${(verifyResult.passCount / verifyResult.total) * 100}%` }}
                />
              </div>
              {/* Individual checks */}
              <ul className="text-xs space-y-1 max-h-60 overflow-y-auto">
                {verifyResult.checks.map((c) => (
                  <li key={c.label} className={`flex items-center justify-between gap-2 py-0.5 px-1 rounded ${
                    c.pass ? '' : 'bg-red-50'
                  }`}>
                    <span className="flex items-center gap-1.5">
                      <span className={`text-sm ${c.pass ? 'text-green-600' : 'text-red-500'}`}>
                        {c.pass ? '✓' : '✗'}
                      </span>
                      <span className={c.pass ? 'text-gray-700' : 'text-red-700 font-medium'}>{c.label}</span>
                    </span>
                    <span className={`text-[10px] ${c.pass ? 'text-gray-400' : 'text-red-500 font-medium'}`}>
                      {c.detail}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </ToolCard>

        {/* 9. PDF Report */}
        <ToolCard
          title="PDF Report"
          description="Generate and download a PDF summary of the current setup including device info, apps removed, and lockdown level."
        >
          <ActionButton onClick={handlePdfReport} disabled={pdfState.loading}>
            {pdfState.loading ? 'Generating...' : 'Download PDF Report'}
          </ActionButton>
          <Feedback state={pdfState} />
        </ToolCard>

        {/* 10. QR Code */}
        <ToolCard
          title="QR Code"
          description="Generate a QR code encoding the current setup configuration for quick reference or scanning."
        >
          <ActionButton onClick={handleQrCode} disabled={qrState.loading}>
            {qrState.loading ? 'Generating...' : 'Generate QR Code'}
          </ActionButton>
          <Feedback state={qrState} />
          {qrDataUrl && (
            <div className="flex justify-center mt-2">
              <img
                src={qrDataUrl}
                alt="Setup QR Code"
                className="w-48 h-48 border border-gray-200 rounded-lg"
              />
            </div>
          )}
        </ToolCard>
      </div>
    </div>
  );
}

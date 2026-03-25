'use client';

import React, { useState, useRef } from 'react';
import { useApp } from '@/context/AppContext';
import { adbService } from '@/services/adb';

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

// ---------------------------------------------------------------------------
// CSV -> VCF helper
// ---------------------------------------------------------------------------

function csvToVcf(csvText: string): string {
  const lines = csvText.trim().split('\n');
  if (lines.length < 2) return '';

  const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
  const nameIdx = headers.findIndex(h => h === 'name' || h === 'full name' || h === 'fullname');
  const firstIdx = headers.findIndex(h => h === 'first name' || h === 'firstname' || h === 'first');
  const lastIdx = headers.findIndex(h => h === 'last name' || h === 'lastname' || h === 'last');
  const phoneIdx = headers.findIndex(h => h === 'phone' || h === 'phone number' || h === 'phonenumber' || h === 'mobile' || h === 'telephone');
  const emailIdx = headers.findIndex(h => h === 'email' || h === 'e-mail');

  const vcfEntries: string[] = [];

  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(',').map(c => c.trim());
    if (!cols.length) continue;

    let fullName = '';
    let firstName = '';
    let lastName = '';

    if (nameIdx >= 0) {
      fullName = cols[nameIdx] || '';
      const parts = fullName.split(' ');
      firstName = parts[0] || '';
      lastName = parts.slice(1).join(' ');
    } else {
      firstName = firstIdx >= 0 ? cols[firstIdx] || '' : '';
      lastName = lastIdx >= 0 ? cols[lastIdx] || '' : '';
      fullName = `${firstName} ${lastName}`.trim();
    }

    if (!fullName && phoneIdx < 0) continue;

    const phone = phoneIdx >= 0 ? cols[phoneIdx] || '' : '';
    const email = emailIdx >= 0 ? cols[emailIdx] || '' : '';

    let entry = 'BEGIN:VCARD\nVERSION:3.0\n';
    entry += `FN:${fullName}\n`;
    entry += `N:${lastName};${firstName};;;\n`;
    if (phone) entry += `TEL;TYPE=CELL:${phone}\n`;
    if (email) entry += `EMAIL:${email}\n`;
    entry += 'END:VCARD';
    vcfEntries.push(entry);
  }

  return vcfEntries.join('\n');
}

// ---------------------------------------------------------------------------
// Simple PDF generator (plain text PDF, no external deps beyond jspdf)
// ---------------------------------------------------------------------------

async function generatePdfReport(data: {
  model: string;
  androidVersion: string;
  imei: string;
  lockdownLevel: number;
  setupLog: string[];
}): Promise<Blob> {
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF();
  const now = new Date();

  doc.setFontSize(18);
  doc.setTextColor(30, 58, 138); // blue-900
  doc.text('KosherFlip Setup Report', 20, 25);

  doc.setFontSize(10);
  doc.setTextColor(100, 100, 100);
  doc.text(`Generated: ${now.toLocaleString()}`, 20, 33);

  doc.setDrawColor(59, 130, 246);
  doc.line(20, 37, 190, 37);

  doc.setFontSize(12);
  doc.setTextColor(30, 58, 138);
  doc.text('Device Information', 20, 47);

  doc.setFontSize(10);
  doc.setTextColor(50, 50, 50);
  const info = [
    `Phone Model: ${data.model}`,
    `Android Version: ${data.androidVersion}`,
    `IMEI: ${data.imei}`,
    `Lockdown Level: ${data.lockdownLevel}`,
  ];
  info.forEach((line, idx) => {
    doc.text(line, 25, 55 + idx * 7);
  });

  let y = 55 + info.length * 7 + 10;

  doc.setFontSize(12);
  doc.setTextColor(30, 58, 138);
  doc.text('Setup Log', 20, y);
  y += 8;

  doc.setFontSize(8);
  doc.setTextColor(50, 50, 50);
  for (const entry of data.setupLog) {
    if (y > 275) {
      doc.addPage();
      y = 20;
    }
    doc.text(entry, 25, y);
    y += 5;
  }

  return doc.output('blob');
}

// ---------------------------------------------------------------------------
// QR Code helper
// ---------------------------------------------------------------------------

async function generateQrDataUrl(text: string): Promise<string> {
  const QRCode = (await import('qrcode')).default;
  return QRCode.toDataURL(text, { width: 256, margin: 2 });
}

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
  const [pdfState, pdfCtl] = useToolState();
  const [qrState, qrCtl] = useToolState();

  const [healthResult, setHealthResult] = useState<{
    score: number;
    checks: { label: string; pass: boolean }[];
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

  const handleWazeFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleInstallApk(file, 'Waze', wazeCtl);
    if (wazeInputRef.current) wazeInputRef.current.value = '';
  };

  const handleMatvtFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleInstallApk(file, 'MATVT Cursor', matvtCtl);
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
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `kosherflip_report_${new Date().toISOString().split('T')[0]}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
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
          description="Select a Waze APK file from your computer to sideload onto the device."
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
          description="Select a MATVT APK file from your computer to sideload onto the device."
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

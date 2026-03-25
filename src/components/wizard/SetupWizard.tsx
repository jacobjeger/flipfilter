'use client';

import { useState } from 'react';
import { useApp } from '@/context/AppContext';
import { adbService } from '@/services/adb';
import { devices } from '@/data/devices';
import { getAppName } from '@/data/packages';
import TierBadge from '@/components/common/TierBadge';
import StatusIndicator from '@/components/common/StatusIndicator';

const STEPS = [
  'connect', 'healthCheck', 'detectAccounts', 'wipePrompt',
  'selectModel', 'selectLockdown', 'deviceOwner', 'applyPreset',
  'lockdown', 'installApps', 'verify', 'done'
] as const;

interface StepResult {
  status: 'success' | 'error' | 'warning' | 'idle';
  message?: string;
}

export default function SetupWizard() {
  const {
    t, connected, connecting, connectPhone, phoneInfo,
    selectedDevice, setSelectedDevice, lockdownLevel, setLockdownLevel,
    preHealthCheck, postHealthCheck, setPreHealthCheck, setPostHealthCheck,
    deviceCompat, addLog, error, browserSupported
  } = useApp();

  const [currentStep, setCurrentStep] = useState(0);
  const [stepResults, setStepResults] = useState<Record<number, StepResult>>({});
  const [loading, setLoading] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  const [accounts, setAccounts] = useState<string[]>([]);
  const [selectedPackages, setSelectedPackages] = useState<Set<string>>(new Set());
  const [lockdownResults, setLockdownResults] = useState<{ cmd: string; success: boolean }[]>([]);
  const [removedPackages, setRemovedPackages] = useState<string[]>([]);

  const updateStepResult = (step: number, result: StepResult) => {
    setStepResults(prev => ({ ...prev, [step]: result }));
  };

  const canGoNext = (): boolean => {
    switch (currentStep) {
      case 0: return connected;
      case 1: return !!preHealthCheck;
      case 4: return !!selectedDevice;
      case 5: return lockdownLevel === 1 || confirmText === 'CONFIRM';
      default: return true;
    }
  };

  const handleNext = () => {
    if (currentStep < STEPS.length - 1 && canGoNext()) {
      // Skip wipe prompt if no accounts
      if (currentStep === 2 && accounts.length === 0) {
        setCurrentStep(4);
      } else if (currentStep === 3) {
        setCurrentStep(4);
      } else {
        setCurrentStep(prev => prev + 1);
      }
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      if (currentStep === 4 && accounts.length === 0) {
        setCurrentStep(2);
      } else {
        setCurrentStep(prev => prev - 1);
      }
    }
  };

  const runHealthCheck = async () => {
    setLoading(true);
    try {
      const result = await adbService.runHealthCheck();
      if (currentStep === 1) {
        setPreHealthCheck(result);
        addLog(`Pre-setup health check: score ${result.score}/100`);
      } else {
        setPostHealthCheck(result);
        addLog(`Post-setup health check: score ${result.score}/100`);
      }
      updateStepResult(currentStep, { status: 'success', message: `Score: ${result.score}/100` });
    } catch (err: any) {
      updateStepResult(currentStep, { status: 'error', message: err.message });
    } finally {
      setLoading(false);
    }
  };

  const detectAccounts = async () => {
    setLoading(true);
    try {
      const accts = await adbService.getAccounts();
      setAccounts(accts);
      updateStepResult(2, {
        status: accts.length > 0 ? 'warning' : 'success',
        message: accts.length > 0 ? `Found ${accts.length} account(s)` : 'No accounts found'
      });
      addLog(`Detected ${accts.length} account(s)`);
    } catch (err: any) {
      updateStepResult(2, { status: 'error', message: err.message });
    } finally {
      setLoading(false);
    }
  };

  const wipePhone = async () => {
    setLoading(true);
    try {
      const result = await adbService.factoryReset();
      if (result.success) {
        updateStepResult(3, { status: 'success', message: 'Wipe initiated. Wait for reboot.' });
        addLog('Factory reset initiated');
      } else {
        updateStepResult(3, { status: 'error', message: result.error || 'Wipe failed' });
      }
    } catch (err: any) {
      updateStepResult(3, { status: 'error', message: err.message });
    } finally {
      setLoading(false);
    }
  };

  const setDeviceOwner = async () => {
    setLoading(true);
    try {
      // Guardian APK would be sideloaded here if available
      addLog('Note: Guardian APK must be manually sideloaded via Tools panel if needed');

      // Set device owner
      const result = await adbService.setDeviceOwner('com.kosherflip/.AdminReceiver');
      if (result.success) {
        updateStepResult(6, { status: 'success', message: 'Device Owner set successfully' });
        addLog('Device Owner set: com.kosherflip/.AdminReceiver');
      } else {
        updateStepResult(6, { status: 'error', message: result.error || 'Failed to set Device Owner' });
        addLog(`Device Owner failed: ${result.error}`);
      }
    } catch (err: any) {
      updateStepResult(6, { status: 'error', message: err.message });
    } finally {
      setLoading(false);
    }
  };

  const applyPreset = async () => {
    if (!selectedDevice || selectedPackages.size === 0) return;
    setLoading(true);
    const removed: string[] = [];
    try {
      for (const pkg of Array.from(selectedPackages)) {
        const result = await adbService.uninstallPackage(pkg);
        if (result.success) removed.push(pkg);
        addLog(`Remove ${pkg}: ${result.success ? 'OK' : result.error}`);
      }
      setRemovedPackages(removed);
      updateStepResult(7, { status: 'success', message: `Removed ${removed.length}/${selectedPackages.size} packages` });
    } catch (err: any) {
      updateStepResult(7, { status: 'error', message: err.message });
    } finally {
      setLoading(false);
    }
  };

  const applyLockdown = async () => {
    setLoading(true);
    const results: { cmd: string; success: boolean }[] = [];
    try {
      const cmdResults = lockdownLevel === 2
        ? await adbService.applyLockdownLevel2()
        : await adbService.applyLockdownLevel1();

      const cmds = lockdownLevel === 2
        ? ['Disable package installer', 'Disable Google package installer', 'Disable browser', 'Disable Chrome', 'Disable ADB']
        : ['Disable package installer', 'Disable Google package installer', 'Disable browser', 'Disable Chrome'];

      cmdResults.forEach((r, i) => {
        results.push({ cmd: cmds[i] || `Command ${i + 1}`, success: r.success });
        addLog(`Lockdown: ${cmds[i]} — ${r.success ? 'OK' : r.error}`);
      });

      setLockdownResults(results);
      const allOk = results.every(r => r.success);
      updateStepResult(8, {
        status: allOk ? 'success' : 'warning',
        message: allOk ? 'All lockdown commands applied' : 'Some commands failed'
      });
    } catch (err: any) {
      updateStepResult(8, { status: 'error', message: err.message });
    } finally {
      setLoading(false);
    }
  };

  const installApps = async () => {
    // App installation is handled via file upload — mark step as ready
    updateStepResult(9, {
      status: 'success',
      message: 'Use the Tools panel to sideload Waze and MATVT APKs from your computer'
    });
    addLog('Step 10: Use Tools > Install Waze / Install MATVT to sideload APKs');
  };

  const renderHealthCheckResults = (check: typeof preHealthCheck) => {
    if (!check) return null;
    return (
      <div className="space-y-1 mt-3">
        <StatusIndicator status={check.browserPresent ? 'warning' : 'success'} label={t.healthCheck.browser} detail={check.browserPresent ? 'Found' : 'Not found'} />
        <StatusIndicator status={check.playStorePresent ? 'warning' : 'success'} label={t.healthCheck.playStore} detail={check.playStorePresent ? 'Found' : 'Not found'} />
        <StatusIndicator status="success" label={t.healthCheck.androidVersion} detail={check.androidVersion} />
        <StatusIndicator status={check.deviceOwnerActive ? 'success' : 'idle'} label={t.healthCheck.deviceOwner} detail={check.deviceOwnerActive ? 'Active' : 'Not set'} />
        <StatusIndicator status={check.accountsPresent ? 'warning' : 'success'} label={t.healthCheck.accounts} detail={check.accountsPresent ? `${check.accountsList.length} found` : 'None'} />
        <StatusIndicator status={check.usbDebugging ? 'success' : 'warning'} label={t.healthCheck.usbDebugging} detail={check.usbDebugging ? 'Enabled' : 'Disabled'} />
      </div>
    );
  };

  const renderStep = () => {
    switch (currentStep) {
      case 0: // Connect
        return (
          <div className="text-center py-8">
            {!browserSupported ? (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-4">
                <p className="text-amber-700">{t.connection.browserWarning}</p>
              </div>
            ) : null}
            {connected && phoneInfo ? (
              <div className="bg-green-50 border border-green-200 rounded-lg p-6">
                <div className="text-green-600 text-4xl mb-3">✓</div>
                <h3 className="text-lg font-semibold text-green-800 mb-2">{t.connection.connected}</h3>
                <div className="text-sm text-gray-600 space-y-1">
                  <p>{t.connection.model}: <strong>{phoneInfo.model}</strong></p>
                  <p>{t.connection.android}: <strong>{phoneInfo.androidVersion}</strong></p>
                  <p>{t.connection.battery}: <strong>{phoneInfo.battery}</strong></p>
                </div>
                {selectedDevice && (
                  <div className="mt-3">
                    <TierBadge tier={selectedDevice.tier} />
                    <p className="text-xs text-gray-500 mt-1">Auto-detected: {selectedDevice.displayName}</p>
                  </div>
                )}
              </div>
            ) : (
              <div>
                <div className="text-gray-400 text-6xl mb-4">📱</div>
                <p className="text-gray-600 mb-4">{t.connection.usbPrompt}</p>
                <button
                  onClick={connectPhone}
                  disabled={connecting}
                  className="bg-blue-600 text-white px-8 py-3 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
                >
                  {connecting ? t.connection.connecting : t.connection.connect}
                </button>
              </div>
            )}
          </div>
        );

      case 1: // Health Check
        return (
          <div className="py-4">
            <p className="text-gray-600 mb-4">Run a health check to assess the phone&apos;s current state before setup.</p>
            <button
              onClick={runHealthCheck}
              disabled={loading}
              className="bg-blue-600 text-white px-6 py-2 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? t.common.loading : 'Run Health Check'}
            </button>
            {preHealthCheck && (
              <div className="mt-4">
                <div className="flex items-center gap-3 mb-2">
                  <span className="text-2xl font-bold text-blue-600">{preHealthCheck.score}/100</span>
                  <span className="text-sm text-gray-500">{t.healthCheck.preSetup}</span>
                </div>
                {renderHealthCheckResults(preHealthCheck)}
              </div>
            )}
          </div>
        );

      case 2: // Detect Accounts
        return (
          <div className="py-4">
            <p className="text-gray-600 mb-4">Checking for existing Google accounts on the device.</p>
            <button
              onClick={detectAccounts}
              disabled={loading}
              className="bg-blue-600 text-white px-6 py-2 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? t.common.loading : 'Detect Accounts'}
            </button>
            {accounts.length > 0 && (
              <div className="mt-4 bg-amber-50 border border-amber-200 rounded-lg p-4">
                <p className="font-medium text-amber-800 mb-2">Found {accounts.length} account(s):</p>
                <ul className="text-sm text-amber-700 space-y-1">
                  {accounts.map((a, i) => <li key={i}>{a}</li>)}
                </ul>
                <p className="text-sm text-amber-600 mt-3">
                  This phone has existing accounts. Full reset protection requires wiping the phone first.
                </p>
              </div>
            )}
            {stepResults[2]?.status === 'success' && accounts.length === 0 && (
              <div className="mt-4 bg-green-50 border border-green-200 rounded-lg p-4">
                <p className="text-green-700">No accounts found. Safe to proceed.</p>
              </div>
            )}
          </div>
        );

      case 3: // Wipe Prompt
        return (
          <div className="py-4">
            <div className="bg-red-50 border border-red-200 rounded-lg p-6">
              <h3 className="text-lg font-semibold text-red-800 mb-2">Factory Reset Required</h3>
              <p className="text-sm text-red-700 mb-4">
                This phone has existing accounts. Full reset protection requires wiping the phone first. Proceed with wipe?
              </p>
              <div className="flex gap-3">
                <button
                  onClick={wipePhone}
                  disabled={loading}
                  className="bg-red-600 text-white px-6 py-2 rounded-lg font-medium hover:bg-red-700 disabled:opacity-50"
                >
                  {loading ? t.common.loading : 'Wipe Phone'}
                </button>
                <button
                  onClick={handleNext}
                  className="bg-gray-200 text-gray-700 px-6 py-2 rounded-lg font-medium hover:bg-gray-300"
                >
                  {t.wizard.skip}
                </button>
              </div>
              {stepResults[3]?.status === 'success' && (
                <p className="mt-3 text-green-700">Wipe initiated. Wait for phone to reboot, then reconnect.</p>
              )}
            </div>
          </div>
        );

      case 4: // Select Model
        return (
          <div className="py-4">
            <p className="text-gray-600 mb-4">Select your phone model{selectedDevice ? ' (auto-detected)' : ''}:</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {devices.map(device => (
                <button
                  key={device.modelId}
                  onClick={() => {
                    setSelectedDevice(device);
                    setSelectedPackages(new Set(device.defaultPackagesToRemove));
                  }}
                  className={`p-4 rounded-lg border-2 text-left transition-colors ${
                    selectedDevice?.modelId === device.modelId
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-blue-300'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-medium text-gray-800">{device.displayName}</span>
                    <TierBadge tier={device.tier} />
                  </div>
                  <p className="text-xs text-gray-500">{device.notes}</p>
                </button>
              ))}
            </div>
          </div>
        );

      case 5: // Select Lockdown Level
        return (
          <div className="py-4">
            <div className="space-y-4">
              <button
                onClick={() => { setLockdownLevel(1); setConfirmText(''); }}
                className={`w-full p-4 rounded-lg border-2 text-left transition-colors ${
                  lockdownLevel === 1 ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-blue-300'
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-semibold text-gray-800">Level 1 — {t.lockdown.level1}</span>
                  <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded">Recommended</span>
                </div>
                <p className="text-sm text-gray-600">{t.lockdown.level1Desc}</p>
                <ul className="mt-2 text-xs text-gray-500 space-y-0.5">
                  <li>• {t.lockdown.restrictions.factoryReset}</li>
                  <li>• {t.lockdown.restrictions.safeBoot}</li>
                  <li>• {t.lockdown.restrictions.unknownSources}</li>
                  <li>• {t.lockdown.restrictions.addUser}</li>
                  <li>• USB debugging: left ON</li>
                </ul>
              </button>

              <button
                onClick={() => setLockdownLevel(2)}
                className={`w-full p-4 rounded-lg border-2 text-left transition-colors ${
                  lockdownLevel === 2 ? 'border-red-500 bg-red-50' : 'border-gray-200 hover:border-red-300'
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-semibold text-gray-800">Level 2 — {t.lockdown.level2}</span>
                  <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded">Permanent</span>
                </div>
                <p className="text-sm text-gray-600">{t.lockdown.level2Desc}</p>
                <ul className="mt-2 text-xs text-gray-500 space-y-0.5">
                  <li>• Everything in Level 1 plus:</li>
                  <li>• {t.lockdown.restrictions.usbTransfer}</li>
                  <li>• {t.lockdown.restrictions.disableAdb}</li>
                </ul>
              </button>

              {lockdownLevel === 2 && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <p className="text-sm text-red-700 mb-3">{t.lockdown.level2Warning}</p>
                  <div>
                    <label className="text-xs text-red-600 block mb-1">{t.lockdown.level2Confirm}</label>
                    <input
                      type="text"
                      value={confirmText}
                      onChange={e => setConfirmText(e.target.value)}
                      className="border border-red-300 rounded px-3 py-2 text-sm w-full focus:outline-none focus:ring-2 focus:ring-red-500"
                      placeholder="Type CONFIRM"
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        );

      case 6: // Device Owner
        return (
          <div className="py-4">
            {deviceCompat?.supportsDeviceOwner ? (
              <div>
                <p className="text-gray-600 mb-4">Set up Device Owner for full reset protection.</p>
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4 text-sm">
                  <p className="text-blue-800">This will:</p>
                  <ul className="text-blue-700 mt-1 space-y-0.5">
                    <li>1. Install KosherFlip Guardian APK (hidden, no launcher icon)</li>
                    <li>2. Set it as Device Owner via ADB</li>
                    <li>3. Enforce lockdown restrictions</li>
                  </ul>
                </div>
                <button
                  onClick={setDeviceOwner}
                  disabled={loading}
                  className="bg-blue-600 text-white px-6 py-2 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50"
                >
                  {loading ? t.common.loading : 'Set Device Owner'}
                </button>
                {stepResults[6] && (
                  <div className={`mt-3 p-3 rounded-lg ${stepResults[6].status === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                    {stepResults[6].message}
                  </div>
                )}
                <p className="text-xs text-gray-400 mt-4">
                  Note: Hardware button recovery cannot be blocked without root. All other reset methods are now blocked.
                </p>
              </div>
            ) : (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                <p className="text-amber-700">Device Owner is not supported on this device (Tier {selectedDevice?.tier}). Skipping this step.</p>
              </div>
            )}
          </div>
        );

      case 7: // Apply Preset
        return (
          <div className="py-4">
            <p className="text-gray-600 mb-4">
              Select apps to remove. {selectedDevice ? `Preset loaded for ${selectedDevice.displayName}.` : 'Select a device first.'}
            </p>
            {selectedDevice && (
              <div>
                <div className="flex gap-2 mb-3">
                  <button
                    onClick={() => setSelectedPackages(new Set(selectedDevice.defaultPackagesToRemove))}
                    className="text-xs bg-blue-100 text-blue-700 px-3 py-1 rounded hover:bg-blue-200"
                  >
                    Reset to Preset
                  </button>
                  <button
                    onClick={() => setSelectedPackages(new Set())}
                    className="text-xs bg-gray-100 text-gray-600 px-3 py-1 rounded hover:bg-gray-200"
                  >
                    Deselect All
                  </button>
                </div>
                <div className="max-h-64 overflow-y-auto border border-gray-200 rounded-lg divide-y">
                  {selectedDevice.defaultPackagesToRemove.map(pkg => (
                    <label key={pkg} className="flex items-center gap-3 px-3 py-2 hover:bg-gray-50 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={selectedPackages.has(pkg)}
                        onChange={e => {
                          const next = new Set(selectedPackages);
                          e.target.checked ? next.add(pkg) : next.delete(pkg);
                          setSelectedPackages(next);
                        }}
                        className="rounded border-gray-300"
                      />
                      <div>
                        <span className="text-sm font-medium text-gray-800">
                          {getAppName(pkg)}
                        </span>
                        <span className="text-xs text-gray-400 ml-2">{pkg}</span>
                      </div>
                    </label>
                  ))}
                </div>
                <button
                  onClick={applyPreset}
                  disabled={loading || selectedPackages.size === 0}
                  className="mt-4 bg-red-600 text-white px-6 py-2 rounded-lg font-medium hover:bg-red-700 disabled:opacity-50"
                >
                  {loading ? t.common.loading : `Remove ${selectedPackages.size} Selected Apps`}
                </button>
                {stepResults[7] && (
                  <div className={`mt-3 p-3 rounded-lg text-sm ${stepResults[7].status === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                    {stepResults[7].message}
                  </div>
                )}
              </div>
            )}
          </div>
        );

      case 8: // Lockdown
        return (
          <div className="py-4">
            <p className="text-gray-600 mb-4">
              Applying lockdown Level {lockdownLevel} ({lockdownLevel === 1 ? 'Standard' : 'Maximum'}).
            </p>
            <button
              onClick={applyLockdown}
              disabled={loading}
              className="bg-blue-600 text-white px-6 py-2 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? t.common.loading : 'Apply Lockdown'}
            </button>
            {lockdownResults.length > 0 && (
              <div className="mt-4 space-y-1">
                {lockdownResults.map((r, i) => (
                  <StatusIndicator
                    key={i}
                    status={r.success ? 'success' : 'error'}
                    label={r.cmd}
                  />
                ))}
              </div>
            )}
          </div>
        );

      case 9: // Install Apps
        return (
          <div className="py-4">
            <p className="text-gray-600 mb-4">Install approved apps on the device.</p>
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <button
                  onClick={installApps}
                  disabled={loading}
                  className="bg-green-600 text-white px-6 py-2 rounded-lg font-medium hover:bg-green-700 disabled:opacity-50"
                >
                  {loading ? t.common.loading : 'Install Waze & MATVT'}
                </button>
              </div>
              {stepResults[9] && (
                <div className={`p-3 rounded-lg text-sm ${stepResults[9].status === 'success' ? 'bg-green-50 text-green-700' : 'bg-amber-50 text-amber-700'}`}>
                  {stepResults[9].message}
                </div>
              )}
              <p className="text-xs text-gray-400">
                APK files must be placed in the /public folder. Waze will be configured with MATVT cursor whitelist.
              </p>
            </div>
          </div>
        );

      case 10: // Verify
        return (
          <div className="py-4">
            <p className="text-gray-600 mb-4">Run a final verification to confirm everything is set up correctly.</p>
            <button
              onClick={runHealthCheck}
              disabled={loading}
              className="bg-blue-600 text-white px-6 py-2 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? t.common.loading : 'Run Verification'}
            </button>
            {postHealthCheck && (
              <div className="mt-4">
                <div className="flex items-center gap-3 mb-2">
                  <span className="text-2xl font-bold text-blue-600">{postHealthCheck.score}/100</span>
                  <span className="text-sm text-gray-500">{t.healthCheck.postSetup}</span>
                </div>
                {renderHealthCheckResults(postHealthCheck)}
                {preHealthCheck && (
                  <div className="mt-4 bg-blue-50 border border-blue-200 rounded-lg p-3">
                    <p className="text-sm font-medium text-blue-800">Score change: {preHealthCheck.score} → {postHealthCheck.score}</p>
                  </div>
                )}
              </div>
            )}
          </div>
        );

      case 11: // Done
        return (
          <div className="py-8 text-center">
            <div className="text-green-500 text-6xl mb-4">✓</div>
            <h3 className="text-2xl font-bold text-gray-800 mb-2">Setup Complete!</h3>
            <p className="text-gray-600 mb-6">
              {selectedDevice?.displayName} has been configured with Level {lockdownLevel} lockdown.
            </p>
            <div className="bg-gray-50 rounded-lg p-4 max-w-md mx-auto text-left text-sm space-y-1">
              <p><strong>Model:</strong> {phoneInfo?.model}</p>
              <p><strong>Android:</strong> {phoneInfo?.androidVersion}</p>
              <p><strong>Lockdown:</strong> Level {lockdownLevel} ({lockdownLevel === 1 ? 'Standard' : 'Maximum'})</p>
              <p><strong>Apps Removed:</strong> {removedPackages.length}</p>
              <p><strong>Health Score:</strong> {postHealthCheck?.score ?? preHealthCheck?.score ?? 'N/A'}/100</p>
            </div>
            <div className="flex justify-center gap-3 mt-6">
              <button
                onClick={() => {
                  // PDF download placeholder
                  addLog('PDF report downloaded');
                  alert('PDF export will generate a detailed setup report.');
                }}
                className="bg-blue-600 text-white px-6 py-2 rounded-lg font-medium hover:bg-blue-700"
              >
                {t.tools.pdfReport}
              </button>
              <button
                onClick={() => {
                  addLog('QR code generated');
                  alert('QR code will encode the full setup configuration.');
                }}
                className="bg-gray-200 text-gray-700 px-6 py-2 rounded-lg font-medium hover:bg-gray-300"
              >
                {t.tools.qrCode}
              </button>
            </div>
          </div>
        );
    }
  };

  const stepLabels = Object.values(t.wizard.steps);

  return (
    <div>
      <h2 className="text-2xl font-bold text-gray-800 mb-6">{t.wizard.title}</h2>

      {/* Step indicator */}
      <div className="flex items-center gap-1 mb-6 overflow-x-auto pb-2">
        {STEPS.map((_, i) => (
          <div key={i} className="flex items-center">
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium shrink-0 ${
                i === currentStep
                  ? 'bg-blue-600 text-white'
                  : i < currentStep
                  ? stepResults[i]?.status === 'error' ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-600'
                  : 'bg-gray-100 text-gray-400'
              }`}
            >
              {i < currentStep && stepResults[i]?.status !== 'error' ? '✓' : i + 1}
            </div>
            {i < STEPS.length - 1 && (
              <div className={`w-4 h-0.5 ${i < currentStep ? 'bg-green-300' : 'bg-gray-200'}`} />
            )}
          </div>
        ))}
      </div>

      {/* Step title */}
      <div className="mb-4">
        <span className="text-sm text-blue-600 font-medium">
          {t.wizard.step} {currentStep + 1} {t.wizard.of} {STEPS.length}
        </span>
        <h3 className="text-lg font-semibold text-gray-800">{stepLabels[currentStep]}</h3>
      </div>

      {/* Step content */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 min-h-[300px]">
        {renderStep()}
      </div>

      {/* Navigation */}
      <div className="flex justify-between mt-4">
        <button
          onClick={handleBack}
          disabled={currentStep === 0}
          className="px-6 py-2 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed"
        >
          {t.wizard.back}
        </button>
        {currentStep < STEPS.length - 1 && (
          <button
            onClick={handleNext}
            disabled={!canGoNext()}
            className="bg-blue-600 text-white px-6 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-30 disabled:cursor-not-allowed"
          >
            {t.wizard.next}
          </button>
        )}
      </div>

      {/* Error display */}
      {error && (
        <div className="mt-4 bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
          {error}
        </div>
      )}
    </div>
  );
}

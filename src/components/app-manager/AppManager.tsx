'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useApp } from '@/context/AppContext';
import { adbService } from '@/services/adb';
import { getAppName, getAppCategory, packageNames } from '@/data/packages';
import { DeviceProfile, devices } from '@/data/devices';
import TierBadge from '@/components/common/TierBadge';

type FilterTab = 'all' | 'thirdparty' | 'system' | 'recommended';

export default function AppManager() {
  const { t, connected, selectedDevice, addLog } = useApp();

  const [packages, setPackages] = useState<string[]>([]);
  const [thirdPartyPackages, setThirdPartyPackages] = useState<string[]>([]);
  const [removedPackages, setRemovedPackages] = useState<Set<string>>(new Set());
  const [selectedPackages, setSelectedPackages] = useState<Set<string>>(new Set());
  const [filterTab, setFilterTab] = useState<FilterTab>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [operating, setOperating] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0, packageName: '' });
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Fetch installed packages on mount when connected
  const fetchPackages = useCallback(async () => {
    if (!connected) return;
    setLoading(true);
    try {
      const [installed, thirdParty] = await Promise.all([
        adbService.getInstalledPackages(),
        adbService.getThirdPartyPackages(),
      ]);
      setPackages(installed.sort());
      setThirdPartyPackages(thirdParty);
      addLog(`Fetched ${installed.length} packages (${thirdParty.length} third-party)`);
    } catch (err: any) {
      addLog(`Error fetching packages: ${err.message}`);
      setFeedback({ type: 'error', message: 'Failed to fetch packages.' });
    } finally {
      setLoading(false);
    }
  }, [connected, addLog]);

  useEffect(() => {
    fetchPackages();
  }, [fetchPackages]);

  // Clear feedback after 4 seconds
  useEffect(() => {
    if (!feedback) return;
    const timer = setTimeout(() => setFeedback(null), 4000);
    return () => clearTimeout(timer);
  }, [feedback]);

  // Filtered packages
  const filteredPackages = useMemo(() => {
    const thirdPartySet = new Set(thirdPartyPackages);
    const recommendedSet = new Set(selectedDevice?.defaultPackagesToRemove ?? []);

    let filtered = packages;

    switch (filterTab) {
      case 'thirdparty':
        filtered = packages.filter(p => thirdPartySet.has(p));
        break;
      case 'system':
        filtered = packages.filter(p => !thirdPartySet.has(p));
        break;
      case 'recommended':
        filtered = packages.filter(p => recommendedSet.has(p));
        break;
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(
        p => p.toLowerCase().includes(q) || getAppName(p).toLowerCase().includes(q)
      );
    }

    return filtered;
  }, [packages, thirdPartyPackages, filterTab, searchQuery, selectedDevice]);

  // Selection handlers
  const togglePackage = (pkg: string) => {
    setSelectedPackages(prev => {
      const next = new Set(prev);
      if (next.has(pkg)) {
        next.delete(pkg);
      } else {
        next.add(pkg);
      }
      return next;
    });
  };

  const selectAll = () => {
    setSelectedPackages(new Set(filteredPackages));
  };

  const deselectAll = () => {
    setSelectedPackages(new Set());
  };

  // Apply device preset
  const applyPreset = (device: DeviceProfile) => {
    const toSelect = new Set<string>();
    for (const pkg of device.defaultPackagesToRemove) {
      if (packages.includes(pkg) && !removedPackages.has(pkg)) {
        toSelect.add(pkg);
      }
    }
    setSelectedPackages(toSelect);
    addLog(`Applied preset for ${device.displayName} (${toSelect.size} packages selected)`);
  };

  // Remove selected packages
  const removeSelected = async () => {
    const toRemove = Array.from(selectedPackages).filter(p => !removedPackages.has(p));
    if (toRemove.length === 0) return;

    setOperating(true);
    setProgress({ current: 0, total: toRemove.length, packageName: '' });

    let successCount = 0;
    let errorCount = 0;

    for (let i = 0; i < toRemove.length; i++) {
      const pkg = toRemove[i];
      setProgress({ current: i + 1, total: toRemove.length, packageName: pkg });
      try {
        const result = await adbService.uninstallPackage(pkg);
        if (result.success) {
          setRemovedPackages(prev => new Set(prev).add(pkg));
          successCount++;
          addLog(`Removed: ${getAppName(pkg)} (${pkg})`);
        } else {
          errorCount++;
          addLog(`Failed to remove ${pkg}: ${result.error || 'Unknown error'}`);
        }
      } catch (err: any) {
        errorCount++;
        addLog(`Error removing ${pkg}: ${err.message}`);
      }
    }

    setSelectedPackages(new Set());
    setOperating(false);
    setProgress({ current: 0, total: 0, packageName: '' });

    if (errorCount === 0) {
      setFeedback({ type: 'success', message: `Successfully removed ${successCount} package(s).` });
    } else {
      setFeedback({
        type: 'error',
        message: `Removed ${successCount}, failed ${errorCount} package(s).`,
      });
    }
  };

  // Restore selected packages
  const restoreSelected = async () => {
    const toRestore = Array.from(selectedPackages).filter(p => removedPackages.has(p));
    if (toRestore.length === 0) return;

    setOperating(true);
    setProgress({ current: 0, total: toRestore.length, packageName: '' });

    let successCount = 0;
    let errorCount = 0;

    for (let i = 0; i < toRestore.length; i++) {
      const pkg = toRestore[i];
      setProgress({ current: i + 1, total: toRestore.length, packageName: pkg });
      try {
        const result = await adbService.restorePackage(pkg);
        if (result.success) {
          setRemovedPackages(prev => {
            const next = new Set(prev);
            next.delete(pkg);
            return next;
          });
          successCount++;
          addLog(`Restored: ${getAppName(pkg)} (${pkg})`);
        } else {
          errorCount++;
          addLog(`Failed to restore ${pkg}: ${result.error || 'Unknown error'}`);
        }
      } catch (err: any) {
        errorCount++;
        addLog(`Error restoring ${pkg}: ${err.message}`);
      }
    }

    setSelectedPackages(new Set());
    setOperating(false);
    setProgress({ current: 0, total: 0, packageName: '' });

    if (errorCount === 0) {
      setFeedback({ type: 'success', message: `Successfully restored ${successCount} package(s).` });
    } else {
      setFeedback({
        type: 'error',
        message: `Restored ${successCount}, failed ${errorCount} package(s).`,
      });
    }
  };

  const selectedInstalledCount = Array.from(selectedPackages).filter(p => !removedPackages.has(p)).length;
  const selectedRemovedCount = Array.from(selectedPackages).filter(p => removedPackages.has(p)).length;

  if (!connected) {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-center">
        <div className="text-blue-400 mb-4">
          <svg className="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
          </svg>
        </div>
        <h2 className="text-xl font-semibold text-white mb-2">No Device Connected</h2>
        <p className="text-blue-200">Connect a phone via USB to manage apps.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-slate-900 text-white">
      {/* Header */}
      <div className="px-4 py-3 border-b border-slate-700 bg-slate-800">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold">App Manager</h2>
          <button
            onClick={fetchPackages}
            disabled={loading || operating}
            className="px-3 py-1.5 text-sm bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-md transition-colors"
          >
            Refresh
          </button>
        </div>

        {/* Search */}
        <div className="relative mb-3">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            placeholder="Search by name or package..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-slate-700 border border-slate-600 rounded-md text-sm text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        {/* Filter Tabs */}
        <div className="flex gap-1 mb-3">
          {([
            { key: 'all', label: 'All' },
            { key: 'thirdparty', label: 'Third Party' },
            { key: 'system', label: 'System' },
            { key: 'recommended', label: 'Recommended' },
          ] as { key: FilterTab; label: string }[]).map(tab => (
            <button
              key={tab.key}
              onClick={() => setFilterTab(tab.key)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                filterTab === tab.key
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Actions row */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={selectAll}
            disabled={operating}
            className="px-3 py-1.5 text-xs bg-slate-700 hover:bg-slate-600 disabled:opacity-50 rounded-md transition-colors"
          >
            Select All
          </button>
          <button
            onClick={deselectAll}
            disabled={operating}
            className="px-3 py-1.5 text-xs bg-slate-700 hover:bg-slate-600 disabled:opacity-50 rounded-md transition-colors"
          >
            Deselect All
          </button>

          {/* Apply Preset Dropdown */}
          <div className="relative">
            <select
              onChange={e => {
                const device = devices.find(d => d.modelId === e.target.value);
                if (device) applyPreset(device);
                e.target.value = '';
              }}
              disabled={operating}
              defaultValue=""
              className="px-3 py-1.5 text-xs bg-slate-700 hover:bg-slate-600 disabled:opacity-50 rounded-md transition-colors text-white appearance-none pr-7 cursor-pointer"
            >
              <option value="" disabled>
                Apply Preset...
              </option>
              {devices.map(device => (
                <option key={device.modelId} value={device.modelId}>
                  {device.displayName}
                </option>
              ))}
            </select>
            <svg className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-400 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </div>

          <div className="flex-1" />

          {/* Selection count */}
          {selectedPackages.size > 0 && (
            <span className="text-xs text-blue-300">
              {selectedPackages.size} selected
            </span>
          )}

          {/* Remove button */}
          <button
            onClick={removeSelected}
            disabled={operating || selectedInstalledCount === 0}
            className="px-3 py-1.5 text-xs bg-red-600 hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-md transition-colors font-medium"
          >
            Remove Selected ({selectedInstalledCount})
          </button>

          {/* Restore button */}
          <button
            onClick={restoreSelected}
            disabled={operating || selectedRemovedCount === 0}
            className="px-3 py-1.5 text-xs bg-green-600 hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-md transition-colors font-medium"
          >
            Restore Selected ({selectedRemovedCount})
          </button>
        </div>
      </div>

      {/* Feedback banner */}
      {feedback && (
        <div
          className={`px-4 py-2 text-sm font-medium ${
            feedback.type === 'success'
              ? 'bg-green-800 text-green-100'
              : 'bg-red-800 text-red-100'
          }`}
        >
          {feedback.message}
        </div>
      )}

      {/* Progress bar */}
      {operating && (
        <div className="px-4 py-2 bg-slate-800 border-b border-slate-700">
          <div className="flex items-center justify-between text-xs text-blue-300 mb-1">
            <span>
              Processing {progress.current}/{progress.total}: {getAppName(progress.packageName)}
            </span>
            <span>{Math.round((progress.current / progress.total) * 100)}%</span>
          </div>
          <div className="w-full bg-slate-700 rounded-full h-1.5">
            <div
              className="bg-blue-500 h-1.5 rounded-full transition-all duration-300"
              style={{ width: `${(progress.current / progress.total) * 100}%` }}
            />
          </div>
        </div>
      )}

      {/* Package list */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-16">
            <svg
              className="w-10 h-10 text-blue-500 animate-spin mb-3"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
            <p className="text-sm text-slate-400">Loading packages...</p>
          </div>
        ) : filteredPackages.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16">
            <p className="text-sm text-slate-400">No packages found.</p>
          </div>
        ) : (
          <ul className="divide-y divide-slate-800">
            {filteredPackages.map(pkg => {
              const isRemoved = removedPackages.has(pkg);
              const isSelected = selectedPackages.has(pkg);
              const friendlyName = getAppName(pkg);
              const category = getAppCategory(pkg);

              return (
                <li
                  key={pkg}
                  onClick={() => !operating && togglePackage(pkg)}
                  className={`flex items-center gap-3 px-4 py-3 cursor-pointer transition-colors ${
                    isSelected
                      ? 'bg-blue-900/30'
                      : 'hover:bg-slate-800/60'
                  } ${operating ? 'pointer-events-none opacity-70' : ''}`}
                >
                  {/* Checkbox */}
                  <div
                    className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                      isSelected
                        ? 'bg-blue-600 border-blue-600'
                        : 'border-slate-500'
                    }`}
                  >
                    {isSelected && (
                      <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </div>

                  {/* Name and package */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={`text-sm font-medium truncate ${isRemoved ? 'text-slate-400 line-through' : 'text-white'}`}>
                        {friendlyName}
                      </span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-700 text-slate-400 capitalize flex-shrink-0">
                        {category}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 truncate">{pkg}</p>
                  </div>

                  {/* Status badge */}
                  <span
                    className={`text-xs font-medium px-2 py-0.5 rounded-full flex-shrink-0 ${
                      isRemoved
                        ? 'bg-red-900/50 text-red-400 border border-red-800'
                        : 'bg-green-900/50 text-green-400 border border-green-800'
                    }`}
                  >
                    {isRemoved ? 'Removed' : 'Installed'}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* Footer stats */}
      <div className="px-4 py-2 border-t border-slate-700 bg-slate-800 text-xs text-slate-400 flex items-center justify-between">
        <span>
          {filteredPackages.length} package(s) shown &middot; {packages.length} total &middot; {removedPackages.size} removed
        </span>
        {selectedDevice && (
          <div className="flex items-center gap-2">
            <span>{selectedDevice.displayName}</span>
            <TierBadge tier={selectedDevice.tier} />
          </div>
        )}
      </div>
    </div>
  );
}

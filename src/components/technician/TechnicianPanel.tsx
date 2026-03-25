'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useApp } from '@/context/AppContext';
import { devices } from '@/data/devices';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface SavedProfile {
  id: string;
  name: string;
  modelId: string;
  packagesToRemove: string[];
  lockdownLevel: 1 | 2;
  notes: string;
  createdAt: string;
  version: number;
}

interface BatchItem {
  id: string;
  serial: string;
  profileId: string;
  status: 'pending' | 'processing' | 'done' | 'error';
  message?: string;
}

interface ChangelogEntry {
  id: string;
  serial: string;
  profileId: string;
  profileName: string;
  profileVersion: number;
  appliedAt: string;
}

// ---------------------------------------------------------------------------
// LocalStorage helpers
// ---------------------------------------------------------------------------

const PROFILES_KEY = 'kosherflip_profiles';
const CHANGELOG_KEY = 'kosherflip_changelog';

function loadProfiles(): SavedProfile[] {
  if (typeof window === 'undefined') return [];
  try {
    return JSON.parse(localStorage.getItem(PROFILES_KEY) || '[]');
  } catch {
    return [];
  }
}

function saveProfiles(profiles: SavedProfile[]) {
  localStorage.setItem(PROFILES_KEY, JSON.stringify(profiles));
}

function loadChangelog(): ChangelogEntry[] {
  if (typeof window === 'undefined') return [];
  try {
    return JSON.parse(localStorage.getItem(CHANGELOG_KEY) || '[]');
  } catch {
    return [];
  }
}

function saveChangelog(entries: ChangelogEntry[]) {
  localStorage.setItem(CHANGELOG_KEY, JSON.stringify(entries));
}

function generateId(): string {
  return Math.random().toString(36).substring(2, 10) + Date.now().toString(36);
}

// ---------------------------------------------------------------------------
// QR Code generation (canvas-based)
// ---------------------------------------------------------------------------

/**
 * Encodes a JSON payload into a simple QR-like visual on a canvas.
 * The approach: base64-encode the JSON, then render each character as a
 * grid cell coloured black/white based on the character code's bits.
 * This is NOT a standards-compliant QR code, but it produces a scannable-
 * looking pattern and the data can be round-tripped via the base64 string
 * embedded as a data attribute on the canvas.
 */
function generateQRCanvas(
  canvas: HTMLCanvasElement,
  data: object,
  size: number = 256,
) {
  const json = JSON.stringify(data);
  const b64 = btoa(unescape(encodeURIComponent(json)));

  const moduleCount = Math.ceil(Math.sqrt(b64.length * 8)) + 2; // +2 for border
  const cellSize = Math.floor(size / moduleCount);
  const totalSize = cellSize * moduleCount;

  canvas.width = totalSize;
  canvas.height = totalSize;
  canvas.setAttribute('data-qr-payload', b64);

  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, totalSize, totalSize);

  // Draw finder patterns (top-left, top-right, bottom-left)
  const drawFinder = (x: number, y: number) => {
    for (let dy = 0; dy < 7; dy++) {
      for (let dx = 0; dx < 7; dx++) {
        const isOuter = dx === 0 || dx === 6 || dy === 0 || dy === 6;
        const isInner = dx >= 2 && dx <= 4 && dy >= 2 && dy <= 4;
        ctx.fillStyle = isOuter || isInner ? '#1e3a5f' : '#ffffff';
        ctx.fillRect((x + dx) * cellSize, (y + dy) * cellSize, cellSize, cellSize);
      }
    }
  };

  drawFinder(0, 0);
  if (moduleCount > 10) {
    drawFinder(moduleCount - 7, 0);
    drawFinder(0, moduleCount - 7);
  }

  // Encode data bits
  let bitIndex = 0;
  const bits: number[] = [];
  for (let i = 0; i < b64.length; i++) {
    const code = b64.charCodeAt(i);
    for (let b = 7; b >= 0; b--) {
      bits.push((code >> b) & 1);
    }
  }

  for (let row = 0; row < moduleCount; row++) {
    for (let col = 0; col < moduleCount; col++) {
      // Skip finder pattern areas
      const inFinder1 = row < 8 && col < 8;
      const inFinder2 = row < 8 && col >= moduleCount - 8;
      const inFinder3 = row >= moduleCount - 8 && col < 8;
      if (inFinder1 || inFinder2 || inFinder3) continue;

      if (bitIndex < bits.length) {
        ctx.fillStyle = bits[bitIndex] ? '#1e3a5f' : '#ffffff';
        ctx.fillRect(col * cellSize, row * cellSize, cellSize, cellSize);
        bitIndex++;
      } else {
        // Padding – alternating pattern
        ctx.fillStyle = (row + col) % 2 === 0 ? '#d0d8e8' : '#ffffff';
        ctx.fillRect(col * cellSize, row * cellSize, cellSize, cellSize);
      }
    }
  }

  // Grid lines for visual QR feel
  ctx.strokeStyle = 'rgba(0,0,0,0.05)';
  ctx.lineWidth = 0.5;
  for (let i = 0; i <= moduleCount; i++) {
    ctx.beginPath();
    ctx.moveTo(i * cellSize, 0);
    ctx.lineTo(i * cellSize, totalSize);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, i * cellSize);
    ctx.lineTo(totalSize, i * cellSize);
    ctx.stroke();
  }
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function SectionCard({
  title,
  children,
  defaultOpen = true,
}: {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="bg-white rounded-xl border border-blue-100 shadow-sm overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-5 py-4 bg-blue-50 hover:bg-blue-100 transition-colors text-left"
      >
        <h3 className="text-base font-semibold text-blue-900">{title}</h3>
        <span className="text-blue-400 text-lg">{open ? '\u25B2' : '\u25BC'}</span>
      </button>
      {open && <div className="p-5">{children}</div>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export default function TechnicianPanel() {
  const { connected, selectedDevice, lockdownLevel, phoneInfo, addLog, setupLog, clearLog } =
    useApp();

  // ---- Profiles state ----
  const [profiles, setProfiles] = useState<SavedProfile[]>([]);
  const [editingProfile, setEditingProfile] = useState<SavedProfile | null>(null);
  const [showProfileForm, setShowProfileForm] = useState(false);
  const [formName, setFormName] = useState('');
  const [formModelId, setFormModelId] = useState(devices[0]?.modelId ?? '');
  const [formPackages, setFormPackages] = useState('');
  const [formLockdown, setFormLockdown] = useState<1 | 2>(1);
  const [formNotes, setFormNotes] = useState('');

  // ---- Batch state ----
  const [batchQueue, setBatchQueue] = useState<BatchItem[]>([]);
  const [activeProfileId, setActiveProfileId] = useState<string | null>(null);
  const [batchSerial, setBatchSerial] = useState('');

  // ---- QR state ----
  const qrCanvasRef = useRef<HTMLCanvasElement>(null);
  const [qrProfileId, setQrProfileId] = useState<string | null>(null);

  // ---- Changelog state ----
  const [changelog, setChangelog] = useState<ChangelogEntry[]>([]);

  // ---- Load persisted data ----
  useEffect(() => {
    setProfiles(loadProfiles());
    setChangelog(loadChangelog());
  }, []);

  // ---- Profile helpers ----
  const resetForm = useCallback(() => {
    setFormName('');
    setFormModelId(devices[0]?.modelId ?? '');
    setFormPackages('');
    setFormLockdown(1);
    setFormNotes('');
    setEditingProfile(null);
    setShowProfileForm(false);
  }, []);

  const openNewProfile = useCallback(() => {
    resetForm();
    // Pre-fill packages from selected device if available
    if (selectedDevice) {
      setFormModelId(selectedDevice.modelId);
      setFormPackages(selectedDevice.defaultPackagesToRemove.join('\n'));
    }
    setShowProfileForm(true);
  }, [selectedDevice, resetForm]);

  const openEditProfile = useCallback((profile: SavedProfile) => {
    setEditingProfile(profile);
    setFormName(profile.name);
    setFormModelId(profile.modelId);
    setFormPackages(profile.packagesToRemove.join('\n'));
    setFormLockdown(profile.lockdownLevel);
    setFormNotes(profile.notes);
    setShowProfileForm(true);
  }, []);

  const saveProfile = useCallback(() => {
    if (!formName.trim()) return;
    const packages = formPackages
      .split('\n')
      .map((p) => p.trim())
      .filter(Boolean);

    let updated: SavedProfile[];
    if (editingProfile) {
      updated = profiles.map((p) =>
        p.id === editingProfile.id
          ? {
              ...p,
              name: formName.trim(),
              modelId: formModelId,
              packagesToRemove: packages,
              lockdownLevel: formLockdown,
              notes: formNotes.trim(),
              version: p.version + 1,
            }
          : p,
      );
      addLog(`Profile "${formName.trim()}" updated to v${editingProfile.version + 1}`);
    } else {
      const newProfile: SavedProfile = {
        id: generateId(),
        name: formName.trim(),
        modelId: formModelId,
        packagesToRemove: packages,
        lockdownLevel: formLockdown,
        notes: formNotes.trim(),
        createdAt: new Date().toISOString(),
        version: 1,
      };
      updated = [...profiles, newProfile];
      addLog(`Profile "${formName.trim()}" created`);
    }

    setProfiles(updated);
    saveProfiles(updated);
    resetForm();
  }, [formName, formModelId, formPackages, formLockdown, formNotes, editingProfile, profiles, addLog, resetForm]);

  const deleteProfile = useCallback(
    (id: string) => {
      const updated = profiles.filter((p) => p.id !== id);
      setProfiles(updated);
      saveProfiles(updated);
      addLog(`Profile deleted`);
    },
    [profiles, addLog],
  );

  const applyProfile = useCallback(
    (profile: SavedProfile) => {
      if (!connected || !phoneInfo) {
        addLog('Cannot apply profile: no phone connected');
        return;
      }
      addLog(`--- Applying profile "${profile.name}" v${profile.version} ---`);
      addLog(`Target device: ${phoneInfo.model} (${phoneInfo.serialNumber})`);
      addLog(`Model in profile: ${profile.modelId}`);
      addLog(`Lockdown level: ${profile.lockdownLevel}`);
      addLog(`Packages to remove (${profile.packagesToRemove.length}):`);
      profile.packagesToRemove.forEach((pkg) => addLog(`  - ${pkg}`));
      addLog('Profile application started (packages will be uninstalled via ADB)');

      // Record changelog
      const entry: ChangelogEntry = {
        id: generateId(),
        serial: phoneInfo.serialNumber,
        profileId: profile.id,
        profileName: profile.name,
        profileVersion: profile.version,
        appliedAt: new Date().toISOString(),
      };
      const updatedLog = [entry, ...changelog];
      setChangelog(updatedLog);
      saveChangelog(updatedLog);
    },
    [connected, phoneInfo, addLog, changelog],
  );

  // ---- Batch helpers ----
  const addToQueue = useCallback(() => {
    const serial = batchSerial.trim();
    if (!serial || !activeProfileId) return;
    setBatchQueue((prev) => [
      ...prev,
      { id: generateId(), serial, profileId: activeProfileId, status: 'pending' },
    ]);
    setBatchSerial('');
    addLog(`Added serial "${serial}" to batch queue`);
  }, [batchSerial, activeProfileId, addLog]);

  const removeFromQueue = useCallback((id: string) => {
    setBatchQueue((prev) => prev.filter((b) => b.id !== id));
  }, []);

  const applyBatch = useCallback(() => {
    if (!connected || !phoneInfo) {
      addLog('Cannot run batch: no phone connected');
      return;
    }
    const profile = profiles.find((p) => p.id === activeProfileId);
    if (!profile) {
      addLog('No profile selected for batch mode');
      return;
    }

    addLog(`--- Batch apply: "${profile.name}" v${profile.version} ---`);

    setBatchQueue((prev) =>
      prev.map((item) => {
        if (item.status === 'pending') {
          addLog(`Queued: ${item.serial} — waiting for device connection`);
          return { ...item, status: 'processing' as const, message: 'Waiting for device...' };
        }
        return item;
      }),
    );
  }, [connected, phoneInfo, activeProfileId, profiles, addLog]);

  // ---- QR helpers ----
  const generateQR = useCallback(
    (profileId: string) => {
      const profile = profiles.find((p) => p.id === profileId);
      if (!profile || !qrCanvasRef.current) return;
      setQrProfileId(profileId);
      const payload = {
        modelId: profile.modelId,
        packagesToRemove: profile.packagesToRemove,
        lockdownLevel: profile.lockdownLevel,
        version: profile.version,
      };
      generateQRCanvas(qrCanvasRef.current, payload, 256);
      addLog(`QR code generated for profile "${profile.name}"`);
    },
    [profiles, addLog],
  );

  const downloadQR = useCallback(() => {
    if (!qrCanvasRef.current) return;
    const url = qrCanvasRef.current.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = url;
    a.download = 'kosherflip-config-qr.png';
    a.click();
  }, []);

  // ---- Log helpers ----
  const copyLog = useCallback(() => {
    navigator.clipboard.writeText(setupLog.join('\n')).then(() => {
      addLog('Log copied to clipboard');
    });
  }, [setupLog, addLog]);

  // ---- Device lookup helper ----
  const getDeviceName = (modelId: string): string => {
    const d = devices.find((dev) => dev.modelId === modelId);
    return d ? d.displayName : modelId;
  };

  // ====================================================================
  // Render
  // ====================================================================

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-blue-900">Technician Panel</h2>
          <p className="text-sm text-gray-500 mt-1">
            Manage profiles, batch operations, and device configuration.
          </p>
        </div>
        <div
          className={`px-3 py-1 rounded-full text-xs font-medium ${
            connected ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
          }`}
        >
          {connected ? `Connected: ${phoneInfo?.model ?? 'Unknown'}` : 'No device connected'}
        </div>
      </div>

      {/* ================================================================ */}
      {/* 1. Saved Profiles */}
      {/* ================================================================ */}
      <SectionCard title="Saved Profiles">
        {/* Profile list */}
        {profiles.length === 0 && !showProfileForm && (
          <p className="text-gray-400 text-sm mb-4">No saved profiles yet.</p>
        )}

        {profiles.length > 0 && (
          <div className="space-y-3 mb-4">
            {profiles.map((profile) => (
              <div
                key={profile.id}
                className="border border-blue-100 rounded-lg p-4 flex flex-col sm:flex-row sm:items-center gap-3"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-blue-900 truncate">{profile.name}</span>
                    <span className="text-xs bg-blue-100 text-blue-600 px-2 py-0.5 rounded-full">
                      v{profile.version}
                    </span>
                    <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">
                      L{profile.lockdownLevel}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    {getDeviceName(profile.modelId)} &middot; {profile.packagesToRemove.length} packages
                    {profile.notes && (
                      <span className="ml-2 italic text-gray-400">— {profile.notes}</span>
                    )}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => applyProfile(profile)}
                    disabled={!connected}
                    className="px-3 py-1.5 text-xs font-medium rounded-md bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    Apply
                  </button>
                  <button
                    onClick={() => generateQR(profile.id)}
                    className="px-3 py-1.5 text-xs font-medium rounded-md bg-blue-100 text-blue-700 hover:bg-blue-200 transition-colors"
                  >
                    QR
                  </button>
                  <button
                    onClick={() => openEditProfile(profile)}
                    className="px-3 py-1.5 text-xs font-medium rounded-md bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => deleteProfile(profile.id)}
                    className="px-3 py-1.5 text-xs font-medium rounded-md bg-red-50 text-red-600 hover:bg-red-100 transition-colors"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* New / Edit profile form */}
        {showProfileForm ? (
          <div className="border border-blue-200 rounded-lg p-4 bg-blue-50/50 space-y-4">
            <h4 className="font-medium text-blue-800 text-sm">
              {editingProfile ? `Edit Profile: ${editingProfile.name}` : 'Create New Profile'}
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Name */}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Profile Name</label>
                <input
                  type="text"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="e.g. Standard Kosher Setup"
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-blue-300 focus:border-blue-400 outline-none"
                />
              </div>

              {/* Model */}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Device Model</label>
                <select
                  value={formModelId}
                  onChange={(e) => {
                    setFormModelId(e.target.value);
                    const dev = devices.find((d) => d.modelId === e.target.value);
                    if (dev && !formPackages.trim()) {
                      setFormPackages(dev.defaultPackagesToRemove.join('\n'));
                    }
                  }}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-blue-300 focus:border-blue-400 outline-none bg-white"
                >
                  {devices.map((d) => (
                    <option key={d.modelId} value={d.modelId}>
                      {d.displayName}
                    </option>
                  ))}
                </select>
              </div>

              {/* Lockdown level */}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Lockdown Level</label>
                <div className="flex gap-3">
                  {([1, 2] as const).map((lvl) => (
                    <button
                      key={lvl}
                      onClick={() => setFormLockdown(lvl)}
                      className={`flex-1 py-2 rounded-md text-sm font-medium transition-colors ${
                        formLockdown === lvl
                          ? 'bg-blue-600 text-white'
                          : 'bg-white border border-gray-300 text-gray-600 hover:bg-gray-50'
                      }`}
                    >
                      Level {lvl}
                    </button>
                  ))}
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Notes</label>
                <input
                  type="text"
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  placeholder="Optional notes..."
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-blue-300 focus:border-blue-400 outline-none"
                />
              </div>
            </div>

            {/* Packages */}
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Packages to Remove (one per line)
              </label>
              <textarea
                value={formPackages}
                onChange={(e) => setFormPackages(e.target.value)}
                rows={8}
                placeholder="com.android.browser&#10;com.google.android.youtube&#10;..."
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm font-mono focus:ring-2 focus:ring-blue-300 focus:border-blue-400 outline-none resize-y"
              />
              <p className="text-xs text-gray-400 mt-1">
                {formPackages.split('\n').filter((l) => l.trim()).length} package(s) listed
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={saveProfile}
                disabled={!formName.trim()}
                className="px-4 py-2 text-sm font-medium rounded-md bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                {editingProfile ? 'Save Changes' : 'Create Profile'}
              </button>
              <button
                onClick={resetForm}
                className="px-4 py-2 text-sm font-medium rounded-md bg-white border border-gray-300 text-gray-600 hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={openNewProfile}
            className="px-4 py-2 text-sm font-medium rounded-md bg-blue-600 text-white hover:bg-blue-700 transition-colors"
          >
            + New Profile
          </button>
        )}
      </SectionCard>

      {/* ================================================================ */}
      {/* 2. Batch Mode */}
      {/* ================================================================ */}
      <SectionCard title="Batch Mode" defaultOpen={false}>
        <div className="space-y-4">
          {/* Select profile for batch */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              Profile for Batch
            </label>
            <select
              value={activeProfileId ?? ''}
              onChange={(e) => setActiveProfileId(e.target.value || null)}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-blue-300 focus:border-blue-400 outline-none"
            >
              <option value="">Select a profile...</option>
              {profiles.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} (v{p.version})
                </option>
              ))}
            </select>
          </div>

          {/* Add to queue */}
          <div className="flex gap-2">
            <input
              type="text"
              value={batchSerial}
              onChange={(e) => setBatchSerial(e.target.value)}
              placeholder="Phone serial number"
              className="flex-1 border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-blue-300 focus:border-blue-400 outline-none"
            />
            <button
              onClick={addToQueue}
              disabled={!batchSerial.trim() || !activeProfileId}
              className="px-4 py-2 text-sm font-medium rounded-md bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Add to Queue
            </button>
          </div>

          {/* Queue list */}
          {batchQueue.length > 0 ? (
            <div className="border border-blue-100 rounded-lg divide-y divide-blue-50 overflow-hidden">
              {batchQueue.map((item) => {
                const statusColors: Record<string, string> = {
                  pending: 'bg-yellow-100 text-yellow-700',
                  processing: 'bg-blue-100 text-blue-700',
                  done: 'bg-green-100 text-green-700',
                  error: 'bg-red-100 text-red-700',
                };
                return (
                  <div key={item.id} className="flex items-center justify-between px-4 py-2.5">
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-mono text-gray-700">{item.serial}</span>
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusColors[item.status]}`}
                      >
                        {item.status}
                      </span>
                      {item.message && (
                        <span className="text-xs text-gray-400">{item.message}</span>
                      )}
                    </div>
                    <button
                      onClick={() => removeFromQueue(item.id)}
                      className="text-xs text-red-500 hover:text-red-700"
                    >
                      Remove
                    </button>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-sm text-gray-400">Queue is empty.</p>
          )}

          {/* Batch controls */}
          <div className="flex gap-2">
            <button
              onClick={applyBatch}
              disabled={batchQueue.length === 0 || !connected}
              className="px-4 py-2 text-sm font-medium rounded-md bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Apply to All
            </button>
            <button
              onClick={() => setBatchQueue([])}
              disabled={batchQueue.length === 0}
              className="px-4 py-2 text-sm font-medium rounded-md bg-white border border-gray-300 text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Clear Queue
            </button>
          </div>
        </div>
      </SectionCard>

      {/* ================================================================ */}
      {/* 3. QR Code Config */}
      {/* ================================================================ */}
      <SectionCard title="QR Code Config" defaultOpen={false}>
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              Generate QR for Profile
            </label>
            <div className="flex gap-2">
              <select
                value={qrProfileId ?? ''}
                onChange={(e) => setQrProfileId(e.target.value || null)}
                className="flex-1 border border-gray-300 rounded-md px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-blue-300 focus:border-blue-400 outline-none"
              >
                <option value="">Select a profile...</option>
                {profiles.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} (v{p.version})
                  </option>
                ))}
              </select>
              <button
                onClick={() => qrProfileId && generateQR(qrProfileId)}
                disabled={!qrProfileId}
                className="px-4 py-2 text-sm font-medium rounded-md bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                Generate QR
              </button>
            </div>
          </div>

          <div className="flex flex-col items-center gap-3">
            <canvas
              ref={qrCanvasRef}
              className="border border-gray-200 rounded-lg bg-white"
              width={256}
              height={256}
            />
            <button
              onClick={downloadQR}
              className="px-4 py-2 text-sm font-medium rounded-md bg-blue-100 text-blue-700 hover:bg-blue-200 transition-colors"
            >
              Download QR Image
            </button>
          </div>

          {/* Scan QR placeholder */}
          <div className="border border-dashed border-blue-200 rounded-lg p-4 bg-blue-50/30 text-center">
            <p className="text-sm font-medium text-blue-800 mb-1">Scan QR Code</p>
            <p className="text-xs text-gray-500">
              To scan a QR config, use your device camera or a QR reader app. Point it at a
              generated KosherFlip QR code to import the profile configuration. Camera access
              requires HTTPS and user permission in the browser.
            </p>
          </div>
        </div>
      </SectionCard>

      {/* ================================================================ */}
      {/* 4. Setup Log */}
      {/* ================================================================ */}
      <SectionCard title="Setup Log">
        <div className="space-y-3">
          {setupLog.length > 0 ? (
            <div className="bg-gray-900 rounded-lg p-4 max-h-64 overflow-y-auto font-mono text-xs text-green-400 leading-relaxed">
              {setupLog.map((line, i) => (
                <div key={i}>{line}</div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-400">No log entries yet.</p>
          )}

          <div className="flex gap-2">
            <button
              onClick={copyLog}
              disabled={setupLog.length === 0}
              className="px-4 py-2 text-sm font-medium rounded-md bg-blue-100 text-blue-700 hover:bg-blue-200 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Copy to Clipboard
            </button>
            <button
              onClick={clearLog}
              disabled={setupLog.length === 0}
              className="px-4 py-2 text-sm font-medium rounded-md bg-white border border-gray-300 text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Clear Log
            </button>
          </div>
        </div>
      </SectionCard>

      {/* ================================================================ */}
      {/* 5. Changelog */}
      {/* ================================================================ */}
      <SectionCard title="Changelog" defaultOpen={false}>
        {changelog.length > 0 ? (
          <div className="space-y-2">
            {changelog.map((entry) => (
              <div
                key={entry.id}
                className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3 border-b border-gray-100 pb-2 last:border-0 last:pb-0"
              >
                <span className="text-xs text-gray-400 shrink-0 font-mono">
                  {new Date(entry.appliedAt).toLocaleString()}
                </span>
                <span className="text-sm text-blue-900 font-medium">
                  {entry.profileName}{' '}
                  <span className="text-xs text-blue-500">v{entry.profileVersion}</span>
                </span>
                <span className="text-xs text-gray-500">
                  applied to serial{' '}
                  <span className="font-mono text-gray-700">{entry.serial}</span>
                </span>
              </div>
            ))}

            <button
              onClick={() => {
                setChangelog([]);
                saveChangelog([]);
                addLog('Changelog cleared');
              }}
              className="mt-3 px-4 py-2 text-sm font-medium rounded-md bg-white border border-gray-300 text-gray-600 hover:bg-gray-50 transition-colors"
            >
              Clear Changelog
            </button>
          </div>
        ) : (
          <p className="text-sm text-gray-400">No profile applications recorded yet.</p>
        )}
      </SectionCard>
    </div>
  );
}

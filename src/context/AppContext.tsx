'use client';

import React, { createContext, useContext, useState, useCallback, useEffect, ReactNode } from 'react';
import { Language, getTranslation, TranslationKeys, languages } from '@/i18n';
import { adbService, PhoneInfo, HealthCheckResult } from '@/services/adb';
import { getDeviceByDetectedModel, DeviceProfile } from '@/data/devices';
import { getCompatibility, DeviceCompatibility } from '@/data/device_compatibility';

export type LockdownLevel = 1 | 2;
export type AppView = 'wizard' | 'app-manager' | 'tools' | 'technician';

interface AppState {
  // Language
  language: Language;
  t: TranslationKeys;
  dir: 'ltr' | 'rtl';
  setLanguage: (lang: Language) => void;

  // Connection
  connected: boolean;
  connecting: boolean;
  phoneInfo: PhoneInfo | null;
  connectPhone: () => Promise<void>;
  disconnectPhone: () => Promise<void>;

  // Device
  selectedDevice: DeviceProfile | null;
  deviceCompat: DeviceCompatibility | null;
  setSelectedDevice: (device: DeviceProfile | null) => void;

  // Lockdown
  lockdownLevel: LockdownLevel;
  setLockdownLevel: (level: LockdownLevel) => void;

  // Health
  preHealthCheck: HealthCheckResult | null;
  postHealthCheck: HealthCheckResult | null;
  setPreHealthCheck: (h: HealthCheckResult | null) => void;
  setPostHealthCheck: (h: HealthCheckResult | null) => void;

  // View
  currentView: AppView;
  setCurrentView: (view: AppView) => void;

  // Technician
  technicianMode: boolean;
  setTechnicianMode: (on: boolean) => void;

  // PIN
  pinSet: boolean;
  pinVerified: boolean;
  setPin: (pin: string) => void;
  verifyPin: (pin: string) => boolean;

  // Error
  error: string | null;
  setError: (e: string | null) => void;

  // Browser support
  browserSupported: boolean;

  // Setup log
  setupLog: string[];
  addLog: (msg: string) => void;
  clearLog: () => void;
}

const AppContext = createContext<AppState | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>('en');
  const [connected, setConnected] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [phoneInfo, setPhoneInfo] = useState<PhoneInfo | null>(null);
  const [selectedDevice, setSelectedDeviceState] = useState<DeviceProfile | null>(null);
  const [lockdownLevel, setLockdownLevel] = useState<LockdownLevel>(1);
  const [preHealthCheck, setPreHealthCheck] = useState<HealthCheckResult | null>(null);
  const [postHealthCheck, setPostHealthCheck] = useState<HealthCheckResult | null>(null);
  const [currentView, setCurrentView] = useState<AppView>('wizard');
  const [technicianMode, setTechnicianMode] = useState(false);
  const [pinVerified, setPinVerified] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [setupLog, setSetupLog] = useState<string[]>([]);
  const [deviceCompat, setDeviceCompat] = useState<DeviceCompatibility | null>(null);

  const t = getTranslation(language);
  const dir = languages[language].dir;
  const browserSupported = typeof window !== 'undefined' && 'usb' in navigator;

  const pinSet = typeof window !== 'undefined' && !!localStorage.getItem('kosherflip_pin');

  const setLanguage = useCallback((lang: Language) => {
    setLanguageState(lang);
    if (typeof document !== 'undefined') {
      document.documentElement.dir = languages[lang].dir;
      document.documentElement.lang = lang;
    }
  }, []);

  const connectPhone = useCallback(async () => {
    setConnecting(true);
    setError(null);
    try {
      const info = await adbService.connect();
      setPhoneInfo(info);
      setConnected(true);
      // Auto-detect device
      const detected = getDeviceByDetectedModel(info.model);
      if (detected) {
        setSelectedDeviceState(detected);
        const compat = getCompatibility(detected.modelId);
        if (compat) setDeviceCompat(compat);
      }
      addLog(`Connected to ${info.model} (Android ${info.androidVersion})`);
    } catch (err: any) {
      setError(err.message || 'Failed to connect');
    } finally {
      setConnecting(false);
    }
  }, []);

  const disconnectPhone = useCallback(async () => {
    try {
      await adbService.disconnect();
    } catch {
      // ignore
    }
    setConnected(false);
    setPhoneInfo(null);
    addLog('Disconnected');
  }, []);

  const setSelectedDevice = useCallback((device: DeviceProfile | null) => {
    setSelectedDeviceState(device);
    if (device) {
      const compat = getCompatibility(device.modelId);
      if (compat) setDeviceCompat(compat);
    } else {
      setDeviceCompat(null);
    }
  }, []);

  const setPin = useCallback((pin: string) => {
    localStorage.setItem('kosherflip_pin', pin);
    setPinVerified(true);
  }, []);

  const verifyPin = useCallback((pin: string): boolean => {
    const stored = localStorage.getItem('kosherflip_pin');
    const ok = stored === pin;
    if (ok) setPinVerified(true);
    return ok;
  }, []);

  const addLog = useCallback((msg: string) => {
    setSetupLog(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${msg}`]);
  }, []);

  const clearLog = useCallback(() => setSetupLog([]), []);

  // Check for stored pin on mount
  useEffect(() => {
    const stored = localStorage.getItem('kosherflip_pin');
    if (!stored) setPinVerified(true); // No pin set = no gate
  }, []);

  return (
    <AppContext.Provider value={{
      language, t, dir, setLanguage,
      connected, connecting, phoneInfo, connectPhone, disconnectPhone,
      selectedDevice, deviceCompat, setSelectedDevice,
      lockdownLevel, setLockdownLevel,
      preHealthCheck, postHealthCheck, setPreHealthCheck, setPostHealthCheck,
      currentView, setCurrentView,
      technicianMode, setTechnicianMode,
      pinSet, pinVerified, setPin, verifyPin,
      error, setError,
      browserSupported,
      setupLog, addLog, clearLog,
    }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp(): AppState {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}

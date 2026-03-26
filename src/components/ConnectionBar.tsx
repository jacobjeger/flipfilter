'use client';

import { useApp } from '@/context/AppContext';
import TierBadge from '@/components/common/TierBadge';

export default function ConnectionBar() {
  const { t, connected, connecting, phoneInfo, connectPhone, disconnectPhone, selectedDevice, browserSupported, error, setError } = useApp();

  if (!browserSupported) {
    return (
      <div className="bg-amber-50 border-b border-amber-200 px-4 py-3">
        <div className="max-w-7xl mx-auto flex items-center gap-2">
          <span className="text-amber-600 font-medium text-sm">⚠️ {t.connection.browserWarning}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-blue-50 border-b border-blue-100 px-4 py-3">
      <div className="max-w-7xl mx-auto flex flex-wrap items-center gap-4">
        {/* Connect/Disconnect button */}
        <button
          onClick={connected ? disconnectPhone : connectPhone}
          disabled={connecting}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            connected
              ? 'bg-red-100 text-red-700 hover:bg-red-200'
              : 'bg-blue-600 text-white hover:bg-blue-700'
          } disabled:opacity-50 disabled:cursor-not-allowed`}
        >
          {connecting ? t.connection.connecting : connected ? t.connection.disconnect : t.connection.connect}
        </button>

        {/* Phone info */}
        {connected && phoneInfo && (
          <div className="flex flex-wrap items-center gap-4 text-sm">
            <div>
              <span className="text-gray-500">{t.connection.model}: </span>
              <span className="font-medium text-gray-800">{phoneInfo.model}</span>
            </div>
            <div>
              <span className="text-gray-500">{t.connection.android}: </span>
              <span className="font-medium text-gray-800">{phoneInfo.androidVersion}</span>
            </div>
            <div>
              <span className="text-gray-500">{t.connection.battery}: </span>
              <span className="font-medium text-gray-800">{phoneInfo.battery}</span>
            </div>
            {selectedDevice && <TierBadge tier={selectedDevice.tier} />}
          </div>
        )}

        {!connected && !connecting && (
          <div className="flex flex-col gap-1">
            <span className="text-sm text-gray-500">{t.connection.usbPrompt}</span>
            <span className="text-xs text-amber-600">
              Before connecting: run <code className="bg-amber-100 px-1 rounded font-mono">adb kill-server</code> in your terminal to release the USB device
            </span>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="flex items-center gap-2 ml-auto">
            <span className="text-sm text-red-600">{error}</span>
            <button onClick={() => setError(null)} className="text-red-400 hover:text-red-600 text-xs">✕</button>
          </div>
        )}
      </div>
    </div>
  );
}

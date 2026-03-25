'use client';

import { useState } from 'react';
import { useApp } from '@/context/AppContext';

export default function PinGate({ children }: { children: React.ReactNode }) {
  const { t, pinSet, pinVerified, setPin, verifyPin } = useApp();
  const [input, setInput] = useState('');
  const [error, setError] = useState(false);
  const [isSettingPin, setIsSettingPin] = useState(false);

  if (pinVerified) return <>{children}</>;

  if (!pinSet || isSettingPin) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl shadow-lg p-8 max-w-sm w-full">
          <div className="text-center mb-6">
            <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <span className="text-white font-bold text-2xl">K</span>
            </div>
            <h2 className="text-xl font-bold text-gray-900">{t.password.title}</h2>
            <p className="text-sm text-gray-500 mt-1">{t.password.set}</p>
          </div>
          <form onSubmit={(e) => {
            e.preventDefault();
            if (input.length >= 4) {
              setPin(input);
            }
          }}>
            <input
              type="password"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={t.password.placeholder}
              className="w-full px-4 py-3 border border-gray-200 rounded-lg text-center text-lg tracking-widest focus:outline-none focus:ring-2 focus:ring-blue-500"
              minLength={4}
              autoFocus
            />
            <button
              type="submit"
              disabled={input.length < 4}
              className="w-full mt-4 bg-blue-600 text-white py-3 rounded-lg font-medium hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
            >
              {t.password.submit}
            </button>
          </form>
          {!pinSet && (
            <button
              onClick={() => { /* Skip PIN */ setPin(''); localStorage.removeItem('kosherflip_pin'); window.location.reload(); }}
              className="w-full mt-2 text-sm text-gray-400 hover:text-gray-600"
            >
              Skip (no PIN)
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-lg p-8 max-w-sm w-full">
        <div className="text-center mb-6">
          <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <span className="text-white font-bold text-2xl">K</span>
          </div>
          <h2 className="text-xl font-bold text-gray-900">{t.password.title}</h2>
          <p className="text-sm text-gray-500 mt-1">{t.password.enter}</p>
        </div>
        <form onSubmit={(e) => {
          e.preventDefault();
          if (!verifyPin(input)) {
            setError(true);
            setInput('');
          }
        }}>
          <input
            type="password"
            value={input}
            onChange={(e) => { setInput(e.target.value); setError(false); }}
            placeholder={t.password.placeholder}
            className={`w-full px-4 py-3 border rounded-lg text-center text-lg tracking-widest focus:outline-none focus:ring-2 focus:ring-blue-500 ${
              error ? 'border-red-400 bg-red-50' : 'border-gray-200'
            }`}
            autoFocus
          />
          {error && <p className="text-red-500 text-sm text-center mt-2">{t.password.incorrect}</p>}
          <button
            type="submit"
            className="w-full mt-4 bg-blue-600 text-white py-3 rounded-lg font-medium hover:bg-blue-700 transition-colors"
          >
            {t.password.submit}
          </button>
        </form>
        <button
          onClick={() => setIsSettingPin(true)}
          className="w-full mt-2 text-sm text-gray-400 hover:text-gray-600"
        >
          Reset PIN
        </button>
      </div>
    </div>
  );
}

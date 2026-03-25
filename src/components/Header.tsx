'use client';

import { useApp } from '@/context/AppContext';
import { languages, Language } from '@/i18n';

export default function Header() {
  const { t, language, setLanguage, connected, phoneInfo, currentView, setCurrentView, technicianMode, setTechnicianMode } = useApp();

  const navItems: { key: 'wizard' | 'app-manager' | 'tools' | 'technician'; label: string }[] = [
    { key: 'wizard', label: t.nav.wizard },
    { key: 'app-manager', label: t.nav.appManager },
    { key: 'tools', label: t.nav.tools },
    { key: 'technician', label: t.nav.technician },
  ];

  return (
    <header className="bg-white border-b border-blue-100 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 py-3">
        <div className="flex items-center justify-between">
          {/* Logo */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-lg">K</span>
            </div>
            <div>
              <h1 className="text-xl font-bold text-blue-900">{t.app.title}</h1>
              <p className="text-xs text-gray-500">{t.app.subtitle}</p>
            </div>
          </div>

          {/* Nav */}
          <nav className="hidden md:flex items-center gap-1">
            {navItems.map(item => (
              <button
                key={item.key}
                onClick={() => setCurrentView(item.key)}
                className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                  currentView === item.key
                    ? 'bg-blue-100 text-blue-700'
                    : 'text-gray-600 hover:text-blue-600 hover:bg-gray-50'
                }`}
              >
                {item.label}
              </button>
            ))}
          </nav>

          {/* Right side */}
          <div className="flex items-center gap-3">
            {/* Connection status */}
            <div className={`flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium ${
              connected ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
            }`}>
              <span className={`w-2 h-2 rounded-full ${connected ? 'bg-green-500' : 'bg-gray-400'}`} />
              {connected ? (phoneInfo?.model || t.connection.connected) : t.connection.disconnected}
            </div>

            {/* Technician toggle */}
            <button
              onClick={() => setTechnicianMode(!technicianMode)}
              className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
                technicianMode ? 'bg-purple-100 text-purple-700' : 'text-gray-400 hover:text-gray-600'
              }`}
              title="Technician Mode"
            >
              Tech
            </button>

            {/* Language switcher */}
            <select
              value={language}
              onChange={(e) => setLanguage(e.target.value as Language)}
              className="text-sm border border-gray-200 rounded px-2 py-1 bg-white"
            >
              {Object.entries(languages).map(([key, val]) => (
                <option key={key} value={key}>{val.nativeName}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Mobile nav */}
        <nav className="flex md:hidden mt-2 gap-1 overflow-x-auto">
          {navItems.map(item => (
            <button
              key={item.key}
              onClick={() => setCurrentView(item.key)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium whitespace-nowrap ${
                currentView === item.key
                  ? 'bg-blue-100 text-blue-700'
                  : 'text-gray-600'
              }`}
            >
              {item.label}
            </button>
          ))}
        </nav>
      </div>
    </header>
  );
}

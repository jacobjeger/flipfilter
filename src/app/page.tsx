'use client';

import dynamic from 'next/dynamic';
import { AppProvider, useApp } from '@/context/AppContext';
import Header from '@/components/Header';
import ConnectionBar from '@/components/ConnectionBar';
import PinGate from '@/components/PinGate';

// Dynamic imports to avoid SSR issues with WebUSB
const SetupWizard = dynamic(() => import('@/components/wizard/SetupWizard'), { ssr: false });
const AppManager = dynamic(() => import('@/components/app-manager/AppManager'), { ssr: false });
const ToolsPanel = dynamic(() => import('@/components/tools/ToolsPanel'), { ssr: false });
const TechnicianPanel = dynamic(() => import('@/components/technician/TechnicianPanel'), { ssr: false });

function MainContent() {
  const { currentView } = useApp();

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <ConnectionBar />
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 py-6">
        {currentView === 'wizard' && <SetupWizard />}
        {currentView === 'app-manager' && <AppManager />}
        {currentView === 'tools' && <ToolsPanel />}
        {currentView === 'technician' && <TechnicianPanel />}
      </main>
      <footer className="bg-white border-t border-gray-100 py-4 text-center text-xs text-gray-400">
        KosherFlip v1.0 — Free &amp; open source. No data sent anywhere. Everything runs in your browser.
      </footer>
    </div>
  );
}

export default function Home() {
  return (
    <AppProvider>
      <PinGate>
        <MainContent />
      </PinGate>
    </AppProvider>
  );
}

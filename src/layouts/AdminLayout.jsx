import React, { useState } from 'react';
import { Sidebar } from './Sidebar';
import { Bell, Menu, X, LogOut, ShieldCheck, ShieldAlert } from 'lucide-react';
import { useAuthStore } from '../store/useAuthStore';
import { useAdminStore } from '../store/useAdminStore';

export const AdminLayout = ({ children, activeTab, setActiveTab }) => {
  const { isShiftActive, startShift, endShift } = useAdminStore();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const { signOut, user } = useAuthStore();

  const handleStartShift = () => {
    try {
      // The Global Audio Unlocker for POS Alerts
      const alertSound = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3');
      alertSound.volume = 0; 
      alertSound.play().then(() => {
        alertSound.pause();
        alertSound.volume = 1; 
        window.bbsAudioEngine = alertSound; 
      }).catch(e => console.warn("Browser blocked silent audio unlock:", e));
    } catch (e) {
      console.warn("Audio Context failed", e);
    }
    startShift();
  };

  return (
    <div className="flex h-screen bg-[#fafafa] overflow-hidden font-sans">
      
      {/* Desktop Sidebar */}
      <div className="hidden md:block w-64 shrink-0 z-20 relative">
        <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} />
      </div>

      {/* Mobile Menu Overlay */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 z-50 md:hidden flex">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setIsMobileMenuOpen(false)}></div>
          <div className="w-64 h-full bg-[#0a0a0a] relative animate-in slide-in-from-left duration-200">
            <Sidebar activeTab={activeTab} setActiveTab={(tab) => { setActiveTab(tab); setIsMobileMenuOpen(false); }} />
          </div>
        </div>
      )}

      {/* Main Content Workspace */}
      <div className="flex-1 flex flex-col min-w-0 relative">
        
        <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-4 md:px-8 shrink-0 z-10">
          <div className="flex items-center gap-4">
            <button onClick={() => setIsMobileMenuOpen(true)} className="md:hidden p-2 -ml-2 text-gray-600 hover:text-black">
              <Menu className="w-5 h-5" />
            </button>
            <h2 className="font-semibold text-gray-900 text-sm capitalize">{activeTab.replace('-', ' ')}</h2>
          </div>
          
          <div className="flex items-center gap-4 md:gap-6">
            <div className="hidden md:flex items-center gap-3 pr-6 border-r border-gray-200">
              {isShiftActive ? (
                <div className="flex items-center gap-2">
                  <span className="flex h-2 w-2 relative">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                  </span>
                  <span className="text-xs font-semibold text-emerald-600 tracking-wide uppercase">System Live</span>
                  <button onClick={endShift} className="ml-3 text-xs font-semibold text-gray-500 hover:text-red-500 transition-colors">End Shift</button>
                </div>
              ) : (
                <button onClick={handleStartShift} className="flex items-center gap-2 px-3 py-1.5 bg-gray-900 text-white rounded text-xs font-semibold hover:bg-black transition-colors shadow-sm">
                  <ShieldCheck className="w-3.5 h-3.5" /> Initialize POS
                </button>
              )}
            </div>

            <div className="relative">
              <button className="relative p-1.5 text-gray-500 hover:text-gray-900 transition-colors rounded-md hover:bg-gray-100">
                <Bell className="w-4 h-4" />
                <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 border-2 border-white rounded-full"></span>
              </button>
            </div>
            
            <div className="flex items-center gap-3">
              <div className="w-7 h-7 bg-gray-900 text-white rounded flex items-center justify-center font-bold text-[10px] shrink-0 uppercase shadow-sm">
                {user?.email?.charAt(0) || 'AD'}
              </div>
              <button onClick={signOut} className="hidden md:flex p-1.5 text-gray-500 hover:text-red-500 hover:bg-red-50 rounded-md transition-colors" title="Secure Logout">
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto bg-[#fafafa]">
          <div className="max-w-7xl mx-auto h-full">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
};
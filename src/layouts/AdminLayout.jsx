import React, { useState } from 'react';
import { Sidebar } from './Sidebar';
import { Bell, LockKeyhole, Menu, X, LogOut } from 'lucide-react';
import { useAuthStore } from '../store/useAuthStore';

export const AdminLayout = ({ children, activeTab, setActiveTab }) => {
  const [isShiftActive, setIsShiftActive] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const { signOut, user } = useAuthStore();

  const handleStartShift = () => {
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      const ctx = new AudioContext();
      ctx.resume();
    } catch (e) {
      console.warn("Audio unlock failed", e);
    }
    setIsShiftActive(true);
  };

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    setIsMobileMenuOpen(false);
  };

  return (
    <div className="min-h-screen bg-[#f5f3ef] flex relative overflow-hidden">
      
      {/* 1. THE AUDIO UNLOCKER OVERLAY */}
      {!isShiftActive && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[#1c1c1c]/80 backdrop-blur-sm p-4">
          <div className="bg-white p-8 rounded-3xl max-w-sm w-full text-center shadow-2xl animate-in zoom-in-95 duration-300">
            <div className="w-16 h-16 bg-[#e25f38]/10 text-[#e25f38] rounded-full flex items-center justify-center mx-auto mb-6">
              <LockKeyhole className="w-8 h-8" />
            </div>
            <h2 className="text-2xl font-black text-[#1c1c1c] mb-2">System Locked</h2>
            <p className="text-sm font-bold text-[#8c8a86] mb-8 leading-relaxed">
              Click below to start your shift. This unlocks real-time audio notifications for incoming orders.
            </p>
            <button
              onClick={handleStartShift}
              className="w-full py-4 bg-[#e25f38] text-white rounded-xl font-bold text-base shadow-xl hover:bg-[#d1502b] active:scale-95 transition-all"
            >
              Start Shift
            </button>
          </div>
        </div>
      )}

      {/* 2. DESKTOP SIDEBAR */}
      <div className="hidden md:flex fixed inset-y-0 left-0 z-40 w-64 shadow-2xl">
        <Sidebar activeTab={activeTab} setActiveTab={handleTabChange} />
      </div>

      {/* 3. MOBILE SIDEBAR DRAWER */}
      {isMobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-[#1c1c1c]/60 backdrop-blur-sm z-40 md:hidden animate-in fade-in duration-200"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}
      <div 
        className={`fixed inset-y-0 left-0 z-50 w-64 transform transition-transform duration-300 ease-in-out md:hidden flex ${
          isMobileMenuOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full'
        }`}
      >
        <Sidebar activeTab={activeTab} setActiveTab={handleTabChange} />
        <button 
          onClick={() => setIsMobileMenuOpen(false)}
          className={`absolute top-4 -right-12 p-2 bg-white rounded-full text-[#1c1c1c] shadow-xl transition-opacity duration-300 ${isMobileMenuOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* 4. MAIN CONTENT AREA */}
      <div className={`flex-1 md:ml-64 flex flex-col w-full min-w-0 transition-all duration-500 ${!isShiftActive ? 'blur-md pointer-events-none select-none' : ''}`}>
        
        {/* Top Header */}
        <header className="h-16 bg-white border-b border-[#e5e0d8] flex items-center justify-between px-4 md:px-8 sticky top-0 z-30 shrink-0">
          <div className="flex items-center gap-3">
            <button 
              className="p-2 -ml-2 text-[#8c8a86] hover:text-[#1c1c1c] md:hidden transition-colors"
              onClick={() => setIsMobileMenuOpen(true)}
            >
              <Menu className="w-6 h-6" />
            </button>
            <h2 className="font-black text-[#1c1c1c] text-lg capitalize">{activeTab.replace('-', ' ')}</h2>
          </div>
          
          <div className="flex items-center gap-4 md:gap-6">
            
            {/* Notification Center */}
            <div className="relative">
              <button 
                onClick={() => setIsNotifOpen(!isNotifOpen)}
                className="relative p-2 text-[#8c8a86] hover:text-[#1c1c1c] transition-colors"
              >
                <Bell className="w-5 h-5" />
                <span className="absolute top-1.5 right-1.5 w-2.5 h-2.5 bg-red-500 border-2 border-white rounded-full"></span>
              </button>
              
              {isNotifOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setIsNotifOpen(false)} />
                  <div className="absolute right-0 top-full mt-2 w-72 bg-white border border-[#e5e0d8] rounded-xl shadow-2xl z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                    <div className="px-4 py-3 border-b border-[#e5e0d8] bg-[#f5f3ef]">
                      <h4 className="font-black text-sm text-[#1c1c1c]">Recent Alerts</h4>
                    </div>
                    <div className="divide-y divide-[#e5e0d8] max-h-64 overflow-y-auto">
                      <div className="p-4 hover:bg-[#f5f3ef]/50 cursor-pointer">
                        <p className="text-xs font-bold text-[#e25f38] mb-1">New Order Received</p>
                        <p className="text-xs text-[#8c8a86] font-medium">Check the Live Orders queue.</p>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>
            
            {/* Profile & Quick Logout */}
            <div className="flex items-center gap-3 pl-4 md:pl-6 border-l border-[#e5e0d8]">
              <div className="w-8 h-8 bg-[#1c1c1c] text-white rounded-full flex items-center justify-center font-black text-xs shrink-0 uppercase">
                {user?.email?.charAt(0) || 'AD'}
              </div>
              <button 
                onClick={signOut}
                className="hidden md:flex items-center gap-2 text-sm font-bold text-[#8c8a86] hover:text-red-500 transition-colors"
              >
                <LogOut className="w-4 h-4" /> Logout
              </button>
            </div>
          </div>
        </header>

        {/* Dynamic Page Component */}
        <main className="flex-1 p-4 md:p-8 overflow-x-hidden w-full min-w-0">
          {children}
        </main>
      </div>
    </div>
  );
};
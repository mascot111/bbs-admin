import React, { useState } from 'react';
import { Navigation, MapPin, User, Bike, CheckCircle2, Clock, AlertCircle, Search, Filter, Phone } from 'lucide-react';
import { useAdminStore } from '../store/useAdminStore';

export const FleetControlScreen = () => {
  const { activeRiders } = useAdminStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  // Derived Metrics from the WebSocket Store
  const totalOnline = activeRiders.length;
  const availableRiders = activeRiders.filter(r => r.status === 'available');
  const busyRiders = activeRiders.filter(r => r.status === 'busy');

  // Filter Logic
  const filteredRiders = activeRiders.filter(rider => {
    const matchesSearch = rider.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          rider.vehicle_type?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || rider.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-6 animate-in fade-in duration-500 h-[calc(100vh-8rem)] flex flex-col">
      
      {/* 1. Radar Header & Global Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 shrink-0">
        <div className="bg-[#1c1c1c] rounded-2xl p-5 text-white shadow-xl relative overflow-hidden flex flex-col justify-between h-32 border border-[#333]">
          <div className="absolute -right-4 -top-4 w-24 h-24 bg-[#e25f38]/20 rounded-full blur-2xl"></div>
          <div className="flex justify-between items-start relative z-10">
            <div className="p-2 bg-white/10 rounded-lg">
              <Navigation className="w-5 h-5 text-[#e25f38]" />
            </div>
            <div className="flex items-center gap-1.5 text-[10px] font-bold text-[#e25f38] uppercase tracking-wider bg-[#e25f38]/10 px-2 py-1 rounded-md">
              <span className="w-1.5 h-1.5 rounded-full bg-[#e25f38] animate-pulse"></span> Live Sync
            </div>
          </div>
          <div className="relative z-10">
            <p className="text-3xl font-black">{totalOnline}</p>
            <p className="text-xs font-bold text-[#8c8a86] uppercase tracking-widest mt-1">Total Online</p>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-5 shadow-sm border border-[#e5e0d8] flex flex-col justify-between h-32">
          <div className="flex justify-between items-start">
            <div className="p-2 bg-emerald-50 rounded-lg border border-emerald-100">
              <CheckCircle2 className="w-5 h-5 text-emerald-600" />
            </div>
          </div>
          <div>
            <p className="text-3xl font-black text-[#1c1c1c]">{availableRiders.length}</p>
            <p className="text-xs font-bold text-[#8c8a86] uppercase tracking-widest mt-1">Available to Dispatch</p>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-5 shadow-sm border border-[#e5e0d8] flex flex-col justify-between h-32">
          <div className="flex justify-between items-start">
            <div className="p-2 bg-amber-50 rounded-lg border border-amber-100">
              <Clock className="w-5 h-5 text-amber-600" />
            </div>
          </div>
          <div>
            <p className="text-3xl font-black text-[#1c1c1c]">{busyRiders.length}</p>
            <p className="text-xs font-bold text-[#8c8a86] uppercase tracking-widest mt-1">Currently En-Route</p>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-5 shadow-sm border border-[#e5e0d8] flex flex-col justify-between h-32">
          <div className="flex justify-between items-start">
            <div className="p-2 bg-red-50 rounded-lg border border-red-100">
              <AlertCircle className="w-5 h-5 text-red-600" />
            </div>
          </div>
          <div>
            <p className="text-3xl font-black text-[#1c1c1c]">0</p>
            <p className="text-xs font-bold text-[#8c8a86] uppercase tracking-widest mt-1">Anomalies / Delays</p>
          </div>
        </div>
      </div>

      {/* 2. Split Workspace (List & Map) */}
      <div className="flex flex-col lg:flex-row gap-6 flex-1 min-h-0">
        
        {/* Left Column: Active Operatives List */}
        <div className="w-full lg:w-1/3 bg-white rounded-2xl border border-[#e5e0d8] shadow-sm flex flex-col overflow-hidden">
          <div className="p-4 border-b border-[#e5e0d8] bg-[#fdfbf7] shrink-0 space-y-3">
            <h3 className="font-black text-[#1c1c1c] flex items-center gap-2">
              <Users className="w-4 h-4 text-[#e25f38]" /> Active Squad
            </h3>
            
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8c8a86]" />
              <input 
                type="text" 
                placeholder="Search operative..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-white border border-[#e5e0d8] focus:border-[#e25f38] rounded-xl outline-none font-bold text-xs transition-colors"
              />
            </div>

            <div className="flex gap-2 bg-[#f5f3ef] p-1 rounded-xl border border-[#e5e0d8]">
              {['all', 'available', 'busy'].map(s => (
                <button 
                  key={s}
                  onClick={() => setStatusFilter(s)}
                  className={`flex-1 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all ${
                    statusFilter === s ? 'bg-white text-[#1c1c1c] shadow-sm' : 'text-[#8c8a86] hover:text-[#1c1c1c]'
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-3 hide-scrollbar">
            {filteredRiders.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center px-4">
                <Bike className="w-8 h-8 text-[#e5e0d8] mb-2" />
                <p className="text-sm font-bold text-[#8c8a86]">No operatives found.</p>
              </div>
            ) : (
              filteredRiders.map(rider => (
                <div key={rider.id} className="p-3 border border-[#e5e0d8] rounded-xl hover:border-[#e25f38] transition-colors cursor-pointer group bg-white">
                  <div className="flex items-center gap-3">
                    <div className="relative">
                      <div className="w-10 h-10 rounded-full bg-[#f5f3ef] flex items-center justify-center overflow-hidden border border-[#e5e0d8]">
                        {rider.rider_photo_url ? (
                          <img src={rider.rider_photo_url} alt="rider" className="w-full h-full object-cover" />
                        ) : (
                          <User className="w-5 h-5 text-[#8c8a86]" />
                        )}
                      </div>
                      <span className={`absolute -bottom-1 -right-1 w-3.5 h-3.5 border-2 border-white rounded-full ${rider.status === 'available' ? 'bg-emerald-500' : 'bg-amber-500'}`}></span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-sm text-[#1c1c1c] truncate">{rider.name}</p>
                      <p className="text-[10px] font-bold text-[#8c8a86] uppercase tracking-wider truncate flex items-center gap-1 mt-0.5">
                        {rider.vehicle_type} • {rider.license_plate}
                      </p>
                    </div>
                    <button className="p-2 bg-[#f5f3ef] text-[#8c8a86] rounded-lg group-hover:bg-[#e25f38] group-hover:text-white transition-colors">
                      <Phone className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Right Column: Geographic Radar Shell */}
        <div className="flex-1 bg-[#f5f3ef] rounded-2xl border border-[#e5e0d8] shadow-inner overflow-hidden relative flex items-center justify-center">
          
          <div className="absolute inset-0 opacity-20 pointer-events-none" style={{
            backgroundImage: `radial-gradient(#1c1c1c 1px, transparent 1px)`,
            backgroundSize: '24px 24px'
          }}></div>

          <div className="text-center relative z-10 p-8 max-w-sm">
            <div className="w-16 h-16 bg-white border border-[#e5e0d8] rounded-2xl shadow-xl flex items-center justify-center mx-auto mb-4 relative">
              <MapPin className="w-8 h-8 text-[#8c8a86]" />
              <div className="absolute inset-0 rounded-2xl border-2 border-[#e25f38] animate-ping opacity-20"></div>
            </div>
            <h3 className="text-xl font-black text-[#1c1c1c] mb-2">Geographic Radar Offline</h3>
            <p className="text-xs font-bold text-[#8c8a86] leading-relaxed mb-6">
              Live GPS coordinate tracking requires Mapbox GL telemetry. This module will be activated in Phase 2 during the primary deployment.
            </p>
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-[#e5e0d8] rounded-xl text-xs font-bold text-[#1c1c1c] shadow-sm">
              <AlertCircle className="w-4 h-4 text-amber-500" /> Telemetry Locked
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};

// Helper component for the Users icon used in the header
const Users = ({ className }) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
  </svg>
);
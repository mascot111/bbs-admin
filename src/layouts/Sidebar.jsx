import React from 'react';
import { LayoutDashboard, ShoppingBag, UtensilsCrossed, Users, FileText, BarChart3, Settings, LogOut, Megaphone } from 'lucide-react';
import { useAuthStore } from '../store/useAuthStore';

export const Sidebar = ({ activeTab, setActiveTab }) => {
  const { signOut } = useAuthStore();

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'orders', label: 'Live Orders', icon: ShoppingBag },
    { id: 'menu', label: 'Menu Manager', icon: UtensilsCrossed },
    { id: 'customers', label: 'Customers CRM', icon: Users },
    { id: 'quotes', label: 'Catering Quotes', icon: FileText },
    { id: 'marketing', label: 'Marketing Hub', icon: Megaphone },
    { id: 'analytics', label: 'Financial Intel', icon: BarChart3 },
  ];

  return (
    <div className="h-full bg-[#1c1c1c] text-[#cfccc6] flex flex-col w-full">
      <div className="p-6 shrink-0">
        <div className="flex items-center gap-3 mb-1">
          <div className="w-8 h-8 bg-[#e25f38] rounded-lg flex items-center justify-center shadow-lg shadow-[#e25f38]/20">
            <UtensilsCrossed className="w-5 h-5 text-white" />
          </div>
          <h1 className="text-xl font-black text-white tracking-tight">B.B.S <span className="text-[#e25f38]">Admin</span></h1>
        </div>
        <p className="text-[10px] font-bold text-[#8c8a86] uppercase tracking-widest ml-11">Command Center</p>
      </div>

      <nav className="flex-1 px-4 py-2 space-y-1.5 overflow-y-auto no-scrollbar">
        {navItems.map((item) => (
          <button
            key={item.id}
            onClick={() => setActiveTab(item.id)}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-bold text-sm transition-all duration-200 ${
              activeTab === item.id 
                ? 'bg-[#e25f38] text-white shadow-lg shadow-[#e25f38]/20' 
                : 'hover:bg-white/5 hover:text-white'
            }`}
          >
            <item.icon className={`w-5 h-5 ${activeTab === item.id ? 'text-white' : 'text-[#8c8a86]'}`} />
            {item.label}
          </button>
        ))}
      </nav>

      <div className="p-4 shrink-0 border-t border-white/10 space-y-1.5 bg-[#1c1c1c]">
        <button
          onClick={() => setActiveTab('settings')}
          className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-bold text-sm transition-colors ${
            activeTab === 'settings' ? 'bg-white/10 text-white' : 'hover:bg-white/5 hover:text-white'
          }`}
        >
          <Settings className="w-5 h-5 text-[#8c8a86]" /> Settings
        </button>
        <button
          onClick={signOut}
          className="w-full flex items-center gap-3 px-4 py-3 rounded-xl font-bold text-sm hover:bg-red-500/10 text-red-400 transition-colors"
        >
          <LogOut className="w-5 h-5" /> Logout
        </button>
      </div>
    </div>
  );
};
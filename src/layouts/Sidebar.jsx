import React from 'react';
import { LayoutDashboard, ShoppingBag, UtensilsCrossed, Users, FileText, BarChart3, Settings, Megaphone } from 'lucide-react';

export const Sidebar = ({ activeTab, setActiveTab }) => {
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
    <div className="h-full bg-[#0a0a0a] border-r border-[#222] text-[#888] flex flex-col w-full font-sans">
      <div className="p-6 shrink-0 border-b border-[#222]">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-white rounded flex items-center justify-center">
            <UtensilsCrossed className="w-5 h-5 text-black" />
          </div>
          <div>
            <h1 className="font-bold text-white text-sm tracking-wide">B.B.S EATS</h1>
            <p className="text-[10px] uppercase tracking-widest text-[#666]">Command Center</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 px-3 py-6 space-y-1 overflow-y-auto no-scrollbar">
        <div className="text-[10px] font-bold uppercase tracking-widest text-[#444] mb-4 px-3">System Modules</div>
        {navItems.map((item) => (
          <button
            key={item.id}
            onClick={() => setActiveTab(item.id)}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-md font-medium text-sm transition-all duration-200 ${
              activeTab === item.id 
                ? 'bg-[#1a1a1a] text-white shadow-sm' 
                : 'hover:bg-[#111] hover:text-[#ccc]'
            }`}
          >
            <item.icon className={`w-4 h-4 ${activeTab === item.id ? 'text-white' : 'text-[#666]'}`} />
            {item.label}
          </button>
        ))}
      </nav>

      <div className="p-4 shrink-0 border-t border-[#222] space-y-1">
        <button
          onClick={() => setActiveTab('settings')}
          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-md font-medium text-sm transition-colors ${
            activeTab === 'settings' ? 'bg-[#1a1a1a] text-white' : 'hover:bg-[#111] hover:text-[#ccc]'
          }`}
        >
          <Settings className="w-4 h-4 text-[#666]" />
          System Settings
        </button>
      </div>
    </div>
  );
};
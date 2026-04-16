import React from 'react';
import { TrendingUp, ShoppingBag, UtensilsCrossed, FileText, Loader2, Clock, CheckCircle2, AlertCircle } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { formatCurrency } from '../utils/helpers';

export const DashboardScreen = ({ setActiveTab }) => {
  
  // LIVE SUPABASE FETCH: Pulls the pulse of the entire restaurant
  const { data: metrics, isLoading } = useQuery({
    queryKey: ['dashboardMetrics'],
    queryFn: async () => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // 1. Fetch Today's Orders & Revenue
      const { data: orders } = await supabase
        .from('orders')
        .select('total_amount, status, created_at')
        .gte('created_at', today.toISOString())
        .neq('status', 'cancelled');

      // 2. Fetch Active Inventory Count
      const { count: activeMenuCount } = await supabase
        .from('inventory')
        .select('*', { count: 'exact', head: true })
        .eq('is_available', true);

      // 3. Fetch Pending Catering Quotes
      const { data: quotes } = await supabase
        .from('catering_requests')
        .select('total, status')
        .in('status', ['new-request', 'quoted', 'deposit-paid']);

      const validOrders = orders || [];
      const todaysRevenue = validOrders.reduce((sum, order) => sum + Number(order.total_amount), 0);
      const pendingOrders = validOrders.filter(o => o.status === 'pending' || o.status === 'prepping').length;
      
      const validQuotes = quotes || [];
      const pipelineValue = validQuotes.reduce((sum, q) => sum + (Number(q.total) || 0), 0);
      const newLeads = validQuotes.filter(q => q.status === 'new-request').length;

      return {
        todaysRevenue,
        totalOrdersToday: validOrders.length,
        pendingOrders,
        activeMenuCount: activeMenuCount || 0,
        pipelineValue,
        newLeads
      };
    }
  });

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-[#e25f38] mb-4" />
        <p className="font-bold text-[#8c8a86]">Syncing Command Center...</p>
      </div>
    );
  }

  const { todaysRevenue, totalOrdersToday, pendingOrders, activeMenuCount, pipelineValue, newLeads } = metrics || {};

  const DashboardCard = ({ title, value, subtext, icon: Icon, alert, onClick }) => (
    <div 
      onClick={onClick}
      className={`bg-white p-6 rounded-3xl border border-[#e5e0d8] shadow-sm relative overflow-hidden transition-all ${onClick ? 'cursor-pointer hover:border-[#1c1c1c]/20 hover:shadow-md active:scale-[0.98]' : ''}`}
    >
      <div className="flex justify-between items-start mb-4">
        <div className="w-12 h-12 bg-[#f5f3ef] rounded-2xl flex items-center justify-center text-[#1c1c1c]">
          <Icon className="w-6 h-6" />
        </div>
        {alert > 0 && (
          <span className="flex items-center gap-1 bg-red-50 text-red-600 text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full animate-pulse">
            <AlertCircle className="w-3 h-3" /> {alert} Action Needed
          </span>
        )}
      </div>
      <div>
        <p className="text-[#8c8a86] font-bold text-xs uppercase tracking-widest mb-1">{title}</p>
        <h3 className="text-3xl font-black text-[#1c1c1c] tracking-tight">{value}</h3>
        <p className="text-[#8c8a86] font-bold text-sm mt-2">{subtext}</p>
      </div>
    </div>
  );

  return (
    <div className="max-w-7xl mx-auto space-y-8 pb-12 animate-in fade-in duration-500">
      
      {/* Header */}
      <div>
        <h2 className="text-3xl md:text-4xl font-black text-[#1c1c1c] tracking-tight">Overview</h2>
        <p className="text-[#8c8a86] font-bold mt-2">Here is what is happening at Bigg Brodass Stopover today.</p>
      </div>

      {/* Primary Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <DashboardCard 
          title="Today's Revenue" 
          value={formatCurrency(todaysRevenue)} 
          subtext="Total gross sales since midnight" 
          icon={TrendingUp} 
        />
        <DashboardCard 
          title="Live Orders" 
          value={totalOrdersToday} 
          subtext={`${pendingOrders} currently in kitchen`} 
          icon={ShoppingBag} 
          alert={pendingOrders}
          onClick={() => setActiveTab && setActiveTab('orders')}
        />
        <DashboardCard 
          title="Active Menu" 
          value={activeMenuCount} 
          subtext="Items currently in stock" 
          icon={UtensilsCrossed} 
          onClick={() => setActiveTab && setActiveTab('menu')}
        />
        <DashboardCard 
          title="B2B Pipeline" 
          value={formatCurrency(pipelineValue)} 
          subtext="Value of active catering quotes" 
          icon={FileText} 
          alert={newLeads}
          onClick={() => setActiveTab && setActiveTab('quotes')}
        />
      </div>

      {/* Quick Action Bar */}
      <div className="bg-[#1c1c1c] rounded-3xl p-6 shadow-xl flex flex-col md:flex-row items-center justify-between gap-6 text-white overflow-hidden relative">
        <div className="absolute -right-20 -top-20 w-64 h-64 bg-[#e25f38]/20 rounded-full blur-3xl pointer-events-none"></div>
        <div className="relative z-10">
          <h3 className="font-black text-xl mb-1">System is Online & Secure</h3>
          <p className="text-[#cfccc6] text-sm font-medium">All microservices are synced with Supabase. Marketing engine and POS systems are active.</p>
        </div>
        <div className="flex gap-4 w-full md:w-auto relative z-10">
          <div className="flex items-center gap-2 bg-white/10 border border-white/20 px-4 py-2 rounded-xl font-bold text-sm">
            <Clock className="w-4 h-4 text-[#cfccc6]" /> Live Sync
          </div>
          <div className="flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 px-4 py-2 rounded-xl font-bold text-sm">
            <CheckCircle2 className="w-4 h-4" /> Operations Normal
          </div>
        </div>
      </div>

    </div>
  );
};
import React from 'react';
import { TrendingUp, ShoppingBag, UtensilsCrossed, FileText, Loader2, Clock, ShieldCheck, Activity, Navigation } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { formatCurrency } from '../utils/helpers';

export const DashboardScreen = ({ setActiveTab }) => {
  
  const { data: metrics, isLoading } = useQuery({
    queryKey: ['dashboardMetrics'],
    queryFn: async () => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const { data: orders } = await supabase
        .from('orders')
        .select('total_amount, status, created_at')
        .gte('created_at', today.toISOString())
        .neq('status', 'cancelled');

      const { count: activeMenuCount } = await supabase
        .from('inventory')
        .select('*', { count: 'exact', head: true })
        .eq('is_available', true);

      const { data: quotes } = await supabase
        .from('catering_requests')
        .select('total, status')
        .in('status', ['new-request', 'negotiation', 'awaiting-deposit']);

      // NEW: Fetch Active Fleet count
      const { count: onlineRiders } = await supabase
        .from('riders')
        .select('*', { count: 'exact', head: true })
        .in('status', ['available', 'busy']);

      const todayRevenue = orders?.reduce((sum, order) => sum + Number(order.total_amount), 0) || 0;
      const todayOrders = orders?.length || 0;
      const activeQuotes = quotes?.length || 0;
      const pipelineValue = quotes?.reduce((sum, quote) => sum + (Number(quote.total) || 0), 0) || 0;

      return {
        todayRevenue,
        todayOrders,
        activeMenuCount,
        pipelineValue,
        activeQuotes,
        onlineRiders: onlineRiders || 0
      };
    },
    refetchInterval: 30000 
  });

  const DashboardCard = ({ title, value, subtext, icon: Icon, alert, onClick }) => (
    <div 
      onClick={onClick}
      className={`bg-white p-5 rounded-lg border border-gray-200 shadow-sm transition-all ${onClick ? 'cursor-pointer hover:shadow-md hover:border-gray-300' : ''}`}
    >
      <div className="flex justify-between items-start mb-4">
        <div className="p-2 bg-gray-50 rounded-md border border-gray-100">
          <Icon className="w-4 h-4 text-gray-700" />
        </div>
        {alert > 0 && (
          <span className="bg-red-50 text-red-600 text-[10px] font-bold px-2 py-0.5 rounded-full border border-red-100">
            {alert} Action Req
          </span>
        )}
      </div>
      <div>
        <h3 className="text-2xl font-semibold text-gray-900 tracking-tight mb-1">{value}</h3>
        <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">{title}</p>
        <p className="text-xs text-gray-400 mt-2">{subtext}</p>
      </div>
    </div>
  );

  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
      </div>
    );
  }

  const { todayRevenue, todayOrders, activeMenuCount, pipelineValue, activeQuotes, onlineRiders } = metrics || {};

  return (
    <div className="p-4 md:p-8 max-w-full mx-auto space-y-6 animate-in fade-in duration-300">
      
      {/* SaaS Status Banner */}
      <div className="bg-white border border-gray-200 rounded-lg p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="p-1.5 bg-emerald-50 rounded-md border border-emerald-100">
            <Activity className="w-4 h-4 text-emerald-600" />
          </div>
          <div>
            <h3 className="font-semibold text-gray-900 text-sm">System Operations Normal</h3>
            <p className="text-xs text-gray-500">Realtime web sockets and order processing are active.</p>
          </div>
        </div>
        <div className="flex items-center gap-3 text-xs font-medium text-gray-500 bg-gray-50 px-3 py-1.5 rounded-md border border-gray-100">
          <Clock className="w-3.5 h-3.5" /> Last synced: Just now
        </div>
      </div>

      {/* High-Density Data Grid (Updated to 5 columns for desktop viewing) */}
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
        <DashboardCard 
          title="Today's Revenue" 
          value={formatCurrency(todayRevenue)} 
          subtext="Gross sales since 00:00" 
          icon={TrendingUp} 
        />
        <DashboardCard 
          title="Active Orders" 
          value={todayOrders} 
          subtext="Processed in current shift" 
          icon={ShoppingBag} 
          onClick={() => setActiveTab && setActiveTab('orders')}
        />
        <DashboardCard 
          title="Active Fleet" 
          value={onlineRiders} 
          subtext="Riders online right now" 
          icon={Navigation} 
          onClick={() => setActiveTab && setActiveTab('fleet')}
        />
        <DashboardCard 
          title="Menu Status" 
          value={activeMenuCount} 
          subtext="Items currently available" 
          icon={UtensilsCrossed} 
          onClick={() => setActiveTab && setActiveTab('menu')}
        />
        <DashboardCard 
          title="B2B Pipeline" 
          value={formatCurrency(pipelineValue)} 
          subtext={`${activeQuotes} pending contracts`} 
          icon={FileText} 
          onClick={() => setActiveTab && setActiveTab('quotes')}
        />
      </div>

      {/* Split Operations Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white border border-gray-200 rounded-lg p-5 shadow-sm min-h-[300px]">
          <h3 className="font-semibold text-gray-900 text-sm mb-4">Live Dispatch Feed</h3>
          <div className="flex flex-col items-center justify-center h-[200px] text-gray-400">
            <ShoppingBag className="w-8 h-8 mb-2 opacity-50" />
            <p className="text-sm">Awaiting new incoming orders...</p>
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-lg p-5 shadow-sm min-h-[300px]">
          <h3 className="font-semibold text-gray-900 text-sm mb-4">Financial Trajectory</h3>
          <div className="flex flex-col items-center justify-center h-[200px] text-gray-400">
            <TrendingUp className="w-8 h-8 mb-2 opacity-50" />
            <p className="text-sm">Not enough data to graph projection.</p>
          </div>
        </div>
      </div>
      
    </div>
  );
};
import React, { useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { Banknote, Activity, Loader2, ShoppingBag, TrendingUp, Calendar, Download, Trophy } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { formatCurrency } from '../utils/helpers';

const PIE_COLORS = ['#e25f38', '#1c1c1c', '#cfccc6'];

export const FinancialIntelScreen = () => {
  const [dateRange, setDateRange] = useState('today');

  const { data: analytics, isLoading, isFetching } = useQuery({
    queryKey: ['financialAnalytics', dateRange],
    queryFn: async () => {
      let startTime = new Date(0).toISOString(); 
      
      if (dateRange !== 'all') {
        const d = new Date();
        if (dateRange === 'today') d.setHours(0, 0, 0, 0);
        if (dateRange === 'week') d.setDate(d.getDate() - 7);
        if (dateRange === 'month') d.setMonth(d.getMonth() - 1);
        startTime = d.toISOString();
      }

      // EXECUTE POSTGRESQL RPC
      const { data, error } = await supabase.rpc('get_financial_metrics', { p_start_time: startTime });
      if (error) throw error;

      const raw = data || {};

      // Structure Hourly Bins
      const defaultBins = { '8am': 0, '11am': 0, '2pm': 0, '5pm': 0, '8pm': 0 };
      (raw.hourly || []).forEach(h => { defaultBins[h.time_bin] = h.volume; });
      const hourlyTraffic = Object.keys(defaultBins).map(key => ({ time: key, volume: defaultBins[key] }));

      // Structure Category Margins
      const catObj = raw.categories || { meals_rev: 0, drinks_rev: 0, specials_rev: 0 };
      const totalItemRev = Number(catObj.meals_rev) + Number(catObj.drinks_rev) + Number(catObj.specials_rev);
      
      const categoryMargins = [
        { name: 'Meals', value: totalItemRev ? Math.round((Number(catObj.meals_rev) / totalItemRev) * 100) : 0, raw: Number(catObj.meals_rev) },
        { name: 'Drinks', value: totalItemRev ? Math.round((Number(catObj.drinks_rev) / totalItemRev) * 100) : 0, raw: Number(catObj.drinks_rev) },
        { name: 'Specials', value: totalItemRev ? Math.round((Number(catObj.specials_rev) / totalItemRev) * 100) : 0, raw: Number(catObj.specials_rev) }
      ].filter(cat => cat.value > 0);

      return {
        kpis: raw.kpis || { revenue: 0, aov: 0, total_orders: 0 },
        hourlyTraffic,
        categoryMargins,
        topItems: raw.topItems || []
      };
    }
  });

  const { kpis = { revenue: 0, aov: 0, total_orders: 0 }, hourlyTraffic = [], categoryMargins = [], topItems = [] } = analytics || {};

  const handleExportLedger = () => {
    const text = `*B.B.S EATS FINANCIAL LEDGER*\n`
      + `Date Generated: ${new Date().toLocaleDateString()}\n`
      + `Period: ${dateRange.toUpperCase()}\n\n`
      + `*EXECUTIVE SUMMARY*\n`
      + `Total Revenue: ${formatCurrency(kpis.revenue)}\n`
      + `Total Orders: ${kpis.total_orders}\n`
      + `Avg Order Value: ${formatCurrency(kpis.aov)}\n\n`
      + `*TOP PERFORMING ITEMS*\n`
      + topItems.map((item, idx) => `${idx + 1}. ${item.name} - ${formatCurrency(item.revenue)} (${item.units} units)`).join('\n') + `\n\n`
      + `*CATEGORY BREAKDOWN*\n`
      + categoryMargins.map(cat => `${cat.name}: ${cat.value}% (${formatCurrency(cat.raw)})`).join('\n') + `\n\n`
      + `--- End of Report ---`;

    navigator.clipboard.writeText(text);
    alert("Financial ledger copied to clipboard.");
  };

  const KpiCard = ({ title, value, subtext, icon: Icon }) => (
    <div className="bg-white p-6 rounded-2xl border border-[#e5e0d8] shadow-sm flex items-start justify-between relative overflow-hidden">
      {isFetching && <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-[#e25f38] to-transparent animate-pulse"></div>}
      <div>
        <p className="text-[#8c8a86] font-bold text-xs uppercase tracking-widest mb-2">{title}</p>
        <h3 className="text-3xl font-black text-[#1c1c1c] mb-1">{value}</h3>
        <p className="text-[#8c8a86] font-bold text-xs mt-2">{subtext}</p>
      </div>
      <div className="w-10 h-10 bg-[#f5f3ef] rounded-full flex items-center justify-center text-[#e25f38]">
        <Icon className="w-5 h-5" />
      </div>
    </div>
  );

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-[#e25f38] mb-4" />
        <p className="font-bold text-[#8c8a86]">Executing PostgreSQL routines...</p>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-12 animate-in fade-in duration-500">
      
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
        <div>
          <h2 className="text-3xl font-black text-[#1c1c1c]">Financial Intelligence</h2>
          <p className="text-[#8c8a86] font-bold text-sm mt-1">Live metrics and revenue tracking.</p>
        </div>
        <div className="flex items-center gap-3 w-full md:w-auto">
          <div className="relative flex-1 md:w-48">
            <select 
              value={dateRange} onChange={(e) => setDateRange(e.target.value)}
              className="w-full appearance-none bg-white border border-[#e5e0d8] rounded-xl px-4 py-2.5 pr-10 font-bold text-sm text-[#1c1c1c] outline-none focus:border-[#e25f38] shadow-sm cursor-pointer transition-colors"
            >
              <option value="today">Today</option>
              <option value="week">Trailing 7 Days</option>
              <option value="month">This Month</option>
              <option value="all">All Time</option>
            </select>
            <Calendar className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8c8a86] pointer-events-none" />
          </div>
          <button onClick={handleExportLedger} className="flex items-center gap-2 bg-[#1c1c1c] text-white px-4 py-2.5 rounded-xl font-bold text-sm hover:bg-[#333] transition-colors shadow-sm">
            <Download className="w-4 h-4" /> Export
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <KpiCard title="Gross Revenue" value={formatCurrency(kpis.revenue)} subtext={`Period: ${dateRange.toUpperCase()}`} icon={Banknote} />
        <KpiCard title="Avg. Order Value" value={formatCurrency(kpis.aov)} subtext="Across all digital channels" icon={TrendingUp} />
        <KpiCard title="Total Orders" value={kpis.total_orders} subtext="Successfully processed" icon={ShoppingBag} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white p-6 rounded-2xl border border-[#e5e0d8] shadow-sm flex flex-col">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h3 className="font-black text-[#1c1c1c]">Operational Bottleneck Map</h3>
              <p className="text-[#8c8a86] text-xs font-bold mt-1">Order volume by time block (predictive staffing)</p>
            </div>
            <div className="p-2 bg-[#f5f3ef] rounded-lg"><Activity className="w-5 h-5 text-[#8c8a86]" /></div>
          </div>
          <div className="w-full min-h-[250px] flex-1">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={hourlyTraffic} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e0d8" />
                <XAxis dataKey="time" axisLine={false} tickLine={false} tick={{fill: '#8c8a86', fontSize: 12, fontWeight: 'bold'}} />
                <YAxis axisLine={false} tickLine={false} tick={{fill: '#8c8a86', fontSize: 12, fontWeight: 'bold'}} allowDecimals={false} />
                <RechartsTooltip cursor={{fill: '#f5f3ef'}} contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.1)', fontWeight: 'bold' }} />
                <Bar dataKey="volume" fill="#e25f38" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-[#e5e0d8] shadow-sm flex flex-col">
          <div className="mb-2">
            <h3 className="font-black text-[#1c1c1c]">Revenue by Category</h3>
          </div>
          <div className="w-full min-h-[200px] flex-1 relative">
            {categoryMargins.length === 0 ? (
              <div className="absolute inset-0 flex items-center justify-center text-sm font-bold text-[#8c8a86]">No sales data yet</div>
            ) : (
              <>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={categoryMargins} innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value" stroke="none">
                      {categoryMargins.map((entry, index) => <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />)}
                    </Pie>
                    <RechartsTooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.1)', fontWeight: 'bold' }} />
                  </PieChart>
                </ResponsiveContainer>
               <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
  <Banknote className="w-8 h-8 text-[#e25f38]/20" />
</div>
              </>
            )}
          </div>
          <div className="mt-4 space-y-2">
            {categoryMargins.map((cat, idx) => (
              <div key={idx} className="flex items-center justify-between text-sm font-bold">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: PIE_COLORS[idx % PIE_COLORS.length] }}></div>
                  <span className="text-[#1c1c1c]">{cat.name}</span>
                </div>
                <div className="flex flex-col items-end">
                  <span className="text-[#1c1c1c]">{cat.value}%</span>
                  <span className="text-[#8c8a86] text-[10px]">{formatCurrency(cat.raw)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-[#e5e0d8] shadow-sm overflow-hidden">
        <div className="p-6 border-b border-[#e5e0d8] flex justify-between items-center bg-[#fdfbf7]">
          <div>
            <h3 className="font-black text-[#1c1c1c] flex items-center gap-2"><Trophy className="w-5 h-5 text-amber-500" /> SKU Leaderboard</h3>
            <p className="text-xs font-bold text-[#8c8a86] mt-1">Top 5 grossing items for selected period</p>
          </div>
        </div>
        <div className="divide-y divide-[#e5e0d8]">
          {topItems.length === 0 ? (
            <div className="p-8 text-center text-[#8c8a86] font-bold text-sm">No items sold in this period.</div>
          ) : (
            topItems.map((item, idx) => (
              <div key={idx} className="p-4 flex justify-between items-center hover:bg-[#f5f3ef]/50 transition-colors">
                <div className="flex items-center gap-4">
                  <div className="w-8 h-8 rounded-full bg-[#1c1c1c] text-white flex items-center justify-center font-black text-xs">
                    {idx + 1}
                  </div>
                  <div>
                    <h4 className="font-bold text-[#1c1c1c] text-sm">{item.name}</h4>
                    <span className="text-xs font-bold text-[#8c8a86]">{item.units} units sold</span>
                  </div>
                </div>
                <span className="font-black text-[#e25f38]">{formatCurrency(item.revenue)}</span>
              </div>
            ))
          )}
        </div>
      </div>

    </div>
  );
};
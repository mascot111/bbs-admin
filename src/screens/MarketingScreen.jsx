import React, { useState } from 'react';
import { Ticket, Users, Plus, Loader2 } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';

export const MarketingScreen = () => {
  const [activeTab, setActiveTab] = useState('vouchers');
  const [newVoucher, setNewVoucher] = useState({ code: '', discount: '', type: 'percentage' });

  // --- LIVE SUPABASE INTEGRATION: REFERRAL LEADERBOARD ---
  const { data: referrals = [], isLoading: isLoadingRefs } = useQuery({
    queryKey: ['referrals'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('id, first_name, referral_code, total_referrals_earned')
        .order('total_referrals_earned', { ascending: false });

      if (error) throw error;

      // Map the raw database row to our UI structure
      return (data || []).map(profile => ({
        id: profile.id,
        user: profile.first_name,
        code: profile.referral_code,
        count: profile.total_referrals_earned || 0,
        rewardsEarned: Math.floor((profile.total_referrals_earned || 0) / 5)
      }));
    }
  });

  const handleCreateVoucher = async (e) => {
    e.preventDefault();
    // Vouchers logic can be wired to your `vouchers` table here
    alert(`Voucher ${newVoucher.code} configuration locked. Backend mutation ready to be connected.`);
    setNewVoucher({ code: '', discount: '', type: 'percentage' });
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-12 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
        <div>
          <h2 className="text-3xl font-black text-[#1c1c1c]">Marketing & Growth</h2>
          <p className="text-[#8c8a86] font-bold text-sm mt-1">Manage vouchers and track referral milestones.</p>
        </div>
        <div className="flex bg-[#f5f3ef] p-1.5 rounded-2xl w-full md:w-auto">
          <button onClick={() => setActiveTab('vouchers')} className={`flex-1 md:w-32 py-2.5 rounded-xl font-bold text-sm transition-all ${activeTab === 'vouchers' ? 'bg-white text-[#1c1c1c] shadow-sm' : 'text-[#8c8a86]'}`}>Vouchers</button>
          <button onClick={() => setActiveTab('referrals')} className={`flex-1 md:w-32 py-2.5 rounded-xl font-bold text-sm transition-all ${activeTab === 'referrals' ? 'bg-white text-[#1c1c1c] shadow-sm' : 'text-[#8c8a86]'}`}>Referrals</button>
        </div>
      </div>

      {activeTab === 'vouchers' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="bg-white p-6 rounded-2xl border border-[#e5e0d8] shadow-sm lg:col-span-1 h-fit">
            <h3 className="font-black text-[#1c1c1c] mb-4 flex items-center gap-2"><Ticket className="w-5 h-5 text-[#e25f38]" /> Create Voucher</h3>
            <form onSubmit={handleCreateVoucher} className="space-y-4">
              <div>
                <label className="text-xs font-bold text-[#8c8a86] uppercase tracking-widest mb-1 block">Promo Code</label>
                <input type="text" required value={newVoucher.code} onChange={e => setNewVoucher({...newVoucher, code: e.target.value.toUpperCase()})} className="w-full bg-[#f5f3ef] border border-transparent focus:border-[#e25f38] rounded-xl p-3 font-bold outline-none uppercase" placeholder="e.g. WELCOME20" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-[#8c8a86] uppercase tracking-widest mb-1 block">Type</label>
                  <select value={newVoucher.type} onChange={e => setNewVoucher({...newVoucher, type: e.target.value})} className="w-full bg-[#f5f3ef] border border-transparent focus:border-[#e25f38] rounded-xl p-3 font-bold outline-none cursor-pointer">
                    <option value="percentage">% Off</option>
                    <option value="fixed">Flat Rate</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-bold text-[#8c8a86] uppercase tracking-widest mb-1 block">Value</label>
                  <input type="number" required value={newVoucher.discount} onChange={e => setNewVoucher({...newVoucher, discount: e.target.value})} className="w-full bg-[#f5f3ef] border border-transparent focus:border-[#e25f38] rounded-xl p-3 font-bold outline-none" placeholder="e.g. 15" />
                </div>
              </div>
              <button type="submit" className="w-full py-3 mt-2 bg-[#1c1c1c] text-white rounded-xl font-bold shadow-md hover:bg-[#333] transition-all flex items-center justify-center gap-2">
                <Plus className="w-4 h-4" /> Generate Code
              </button>
            </form>
          </div>
          <div className="bg-white rounded-2xl border border-[#e5e0d8] shadow-sm lg:col-span-2 p-6 flex items-center justify-center min-h-[300px] text-[#8c8a86] font-bold">
            Active Vouchers Table (Awaiting Configuration)
          </div>
        </div>
      )}

      {activeTab === 'referrals' && (
        <div className="bg-white rounded-2xl border border-[#e5e0d8] shadow-sm overflow-hidden">
          <div className="p-6 border-b border-[#e5e0d8] flex justify-between items-center bg-[#fdfbf7]">
            <div>
              <h3 className="font-black text-[#1c1c1c] flex items-center gap-2"><Users className="w-5 h-5 text-[#e25f38]" /> Referral Leaderboard</h3>
              <p className="text-xs font-bold text-[#8c8a86] mt-1">Threshold: 5 successful conversions = 5% next order discount</p>
            </div>
          </div>
          
          {isLoadingRefs ? (
            <div className="p-12 flex flex-col items-center justify-center">
              <Loader2 className="w-8 h-8 animate-spin text-[#e25f38] mb-4" />
              <p className="font-bold text-[#8c8a86]">Syncing active referrers...</p>
            </div>
          ) : (
            <div className="divide-y divide-[#e5e0d8]">
              {referrals.length === 0 ? (
                <div className="p-12 text-center text-[#8c8a86] font-bold">No active referrers found in the database.</div>
              ) : (
                referrals.map((ref, idx) => (
                  <div key={ref.id} className="p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 hover:bg-[#f5f3ef]/50 transition-colors">
                    <div className="flex items-center gap-4">
                      <div className={`w-10 h-10 rounded-full text-white flex items-center justify-center font-black text-sm shrink-0 ${idx === 0 ? 'bg-amber-500 shadow-md shadow-amber-500/20' : idx === 1 ? 'bg-gray-400' : idx === 2 ? 'bg-orange-400' : 'bg-[#1c1c1c]'}`}>
                        {idx + 1}
                      </div>
                      <div>
                        <h4 className="font-bold text-[#1c1c1c] text-base">{ref.user}</h4>
                        <span className="text-xs font-bold text-[#e25f38] bg-[#e25f38]/10 px-2 py-0.5 rounded tracking-wide">CODE: {ref.code}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-8 w-full sm:w-auto justify-between sm:justify-end border-t sm:border-0 border-[#e5e0d8] pt-3 sm:pt-0">
                      <div className="text-center">
                        <p className="text-[10px] font-bold text-[#8c8a86] uppercase tracking-widest mb-1">Conversions</p>
                        <p className="font-black text-[#1c1c1c] text-xl leading-none">{ref.count} <span className="text-xs text-[#8c8a86] font-medium">/ 5</span></p>
                      </div>
                      <div className="text-center">
                        <p className="text-[10px] font-bold text-[#8c8a86] uppercase tracking-widest mb-1">Rewards Unlocked</p>
                        <p className="font-black text-emerald-500 text-xl leading-none">{ref.rewardsEarned}</p>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
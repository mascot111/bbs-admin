import React, { useState, useMemo } from 'react';
import { Search, Filter, Mail, Phone, MoreHorizontal, Star, Edit, Trash2, Eye, ChevronDown, Users, Loader2 } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';

export const CustomersCRM = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [activeFilter, setActiveFilter] = useState('All'); 
  const [isFilterMenuOpen, setIsFilterMenuOpen] = useState(false);
  const [openActionMenuId, setOpenActionMenuId] = useState(null);

  // TANSTACK FETCH: Fetching from the new PostgreSQL View instead of raw orders
  const { data: customers = [], isLoading } = useQuery({
    queryKey: ['customersCRM'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('v_customer_crm')
        .select('*')
        .order('lifetime_spend', { ascending: false });

      if (error) throw error;

      // The server did the heavy lifting. We just map the display rules.
      return (data || []).map(c => {
        let status = 'Regular';
        if (c.total_orders === 1) status = 'New';
        if (c.lifetime_spend >= 1000 || c.total_orders >= 5) status = 'VIP';

        return {
          ...c,
          status,
          lastOrder: new Date(c.last_order_date).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })
        };
      });
    }
  });

  const formatCurrency = (amount) => `GHS ${Number(amount).toLocaleString('en-US', { minimumFractionDigits: 2 })}`;

  const stats = useMemo(() => {
    const vips = customers.filter(c => c.status === 'VIP').length;
    const totalSpend = customers.reduce((sum, c) => sum + Number(c.lifetime_spend), 0);
    const totalOrders = customers.reduce((sum, c) => sum + Number(c.total_orders), 0);
    const avgOrderValue = totalOrders > 0 ? (totalSpend / totalOrders) : 0;

    return { total: customers.length, vips, avgOrderValue };
  }, [customers]);

  const filteredCustomers = customers.filter(customer => {
    const matchesSearch = customer.name.toLowerCase().includes(searchTerm.toLowerCase()) || customer.phone.includes(searchTerm);
    const matchesFilter = activeFilter === 'All' || customer.status === activeFilter;
    return matchesSearch && matchesFilter;
  });

  const handleDeleteCustomer = () => {
    alert("Customers are securely bound to their order history. To remove a customer, you must delete their respective orders from the database.");
    setOpenActionMenuId(null);
  };

  const toggleActionMenu = (id) => setOpenActionMenuId(openActionMenuId === id ? null : id);

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-[#e25f38] mb-4" />
        <p className="font-bold text-[#8c8a86]">Querying PostgreSQL Views...</p>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-12 animate-in fade-in duration-500">
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white p-6 rounded-2xl border border-[#e5e0d8] shadow-sm">
          <p className="text-[#8c8a86] font-bold text-sm uppercase tracking-wider mb-2">Total Database</p>
          <h3 className="text-3xl font-black text-[#1c1c1c]">{stats.total}</h3>
          <p className="text-sm text-green-600 font-bold mt-2">Live Count</p>
        </div>
        <div className="bg-[#1c1c1c] p-6 rounded-2xl shadow-lg shadow-[#1c1c1c]/10">
          <p className="text-[#8c8a86] font-bold text-sm uppercase tracking-wider mb-2">Active VIPs</p>
          <div className="flex items-center gap-3">
            <h3 className="text-3xl font-black text-white">{stats.vips}</h3>
            <Star className="w-6 h-6 text-[#e25f38] fill-[#e25f38]" />
          </div>
          <p className="text-sm text-[#cfccc6] font-medium mt-2">Highest value clients</p>
        </div>
        <div className="bg-white p-6 rounded-2xl border border-[#e5e0d8] shadow-sm">
          <p className="text-[#8c8a86] font-bold text-sm uppercase tracking-wider mb-2">Avg. Order Value</p>
          <h3 className="text-3xl font-black text-[#1c1c1c]">{formatCurrency(stats.avgOrderValue)}</h3>
          <p className="text-sm text-[#8c8a86] font-medium mt-2">Across all segments</p>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-[#e5e0d8] shadow-sm min-h-125">
        <div className="p-6 border-b border-[#e5e0d8] flex flex-col md:flex-row justify-between items-center gap-4 relative">
          <div className="relative w-full md:w-96">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[#8c8a86]" />
            <input 
              type="text" placeholder="Search by name or phone..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-[#f5f3ef] border-none rounded-xl focus:ring-2 focus:ring-[#e25f38]/20 outline-none font-medium text-[#1c1c1c]"
            />
          </div>

          <div className="relative w-full md:w-auto">
            <button 
              onClick={() => setIsFilterMenuOpen(!isFilterMenuOpen)}
              className={`flex items-center gap-2 px-4 py-2.5 font-bold rounded-xl transition-colors w-full md:w-auto justify-center ${activeFilter !== 'All' ? 'bg-[#e25f38] text-white' : 'bg-[#f5f3ef] text-[#1c1c1c] hover:bg-[#e25f38]/10 hover:text-[#e25f38]'}`}
            >
              <Filter className="w-4 h-4" />
              {activeFilter === 'All' ? 'Filter Segments' : `Segment: ${activeFilter}`}
              <ChevronDown className="w-4 h-4 ml-1" />
            </button>

            {isFilterMenuOpen && (
              <div className="absolute right-0 top-full mt-2 w-48 bg-white border border-[#e5e0d8] rounded-xl shadow-xl z-20 overflow-hidden">
                {['All', 'VIP', 'Regular', 'New'].map(segment => (
                  <button key={segment} onClick={() => { setActiveFilter(segment); setIsFilterMenuOpen(false); }} className={`w-full text-left px-4 py-3 text-sm font-bold transition-colors ${activeFilter === segment ? 'bg-[#f5f3ef] text-[#e25f38]' : 'text-[#1c1c1c] hover:bg-[#f5f3ef]'}`}>
                    {segment === 'All' ? 'View All Customers' : `Only ${segment}`}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="overflow-visible overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-200">
            <thead>
              <tr className="bg-[#f5f3ef]/50 text-[#8c8a86] text-sm uppercase tracking-wider">
                <th className="p-4 font-bold border-b border-[#e5e0d8]">Customer</th>
                <th className="p-4 font-bold border-b border-[#e5e0d8]">Contact</th>
                <th className="p-4 font-bold border-b border-[#e5e0d8]">Orders</th>
                <th className="p-4 font-bold border-b border-[#e5e0d8]">Lifetime Spend</th>
                <th className="p-4 font-bold border-b border-[#e5e0d8]">Last Active</th>
                <th className="p-4 font-bold border-b border-[#e5e0d8] text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#e5e0d8]">
              {filteredCustomers.map((customer) => (
                <tr key={customer.phone} className="hover:bg-[#f5f3ef]/30 transition-colors">
                  <td className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-[#1c1c1c] text-white flex items-center justify-center font-black text-sm shrink-0">
                        {customer.name?.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p className="font-bold text-[#1c1c1c]">{customer.name}</p>
                        <span className={`inline-block px-2 py-0.5 rounded text-xs font-bold mt-1 ${customer.status === 'VIP' ? 'bg-[#e25f38]/10 text-[#e25f38]' : customer.status === 'New' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'}`}>
                          {customer.status}
                        </span>
                      </div>
                    </div>
                  </td>
                  <td className="p-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 text-sm font-medium text-[#1c1c1c]">
                        <Phone className="w-3.5 h-3.5 text-[#8c8a86]" /> {customer.phone}
                      </div>
                      <div className="flex items-center gap-2 text-sm text-[#8c8a86]">
                        <Mail className="w-3.5 h-3.5" /> N/A
                      </div>
                    </div>
                  </td>
                  <td className="p-4"><span className="font-bold text-[#1c1c1c]">{customer.total_orders}</span></td>
                  <td className="p-4"><span className="font-black text-[#1c1c1c]">{formatCurrency(customer.lifetime_spend)}</span></td>
                  <td className="p-4 text-sm font-medium text-[#8c8a86]">{customer.lastOrder}</td>
                  <td className="p-4 text-right relative">
                    <button onClick={() => toggleActionMenu(customer.phone)} className={`p-2 rounded-lg transition-colors ${openActionMenuId === customer.phone ? 'bg-[#e25f38] text-white' : 'text-[#8c8a86] hover:text-[#e25f38] hover:bg-[#e25f38]/10'}`}>
                      <MoreHorizontal className="w-5 h-5" />
                    </button>
                    {openActionMenuId === customer.phone && (
                      <div className="absolute right-8 top-10 w-40 bg-white border border-[#e5e0d8] rounded-xl shadow-xl z-50 overflow-hidden">
                        <button className="w-full flex items-center gap-3 px-4 py-2.5 text-sm font-bold text-[#1c1c1c] hover:bg-[#f5f3ef] transition-colors"><Eye className="w-4 h-4 text-[#8c8a86]" /> View Profile</button>
                        <button className="w-full flex items-center gap-3 px-4 py-2.5 text-sm font-bold text-[#1c1c1c] hover:bg-[#f5f3ef] transition-colors"><Edit className="w-4 h-4 text-[#8c8a86]" /> Edit Details</button>
                        <div className="h-px bg-[#e5e0d8] my-1"></div>
                        <button onClick={handleDeleteCustomer} className="w-full flex items-center gap-3 px-4 py-2.5 text-sm font-bold text-red-600 hover:bg-red-50 transition-colors"><Trash2 className="w-4 h-4" /> Delete</button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filteredCustomers.length === 0 && (
            <div className="p-16 flex flex-col items-center justify-center text-center text-[#8c8a86]">
              <Users className="w-12 h-12 mb-4 opacity-20" />
              <p className="font-bold text-lg text-[#1c1c1c]">No customers found</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
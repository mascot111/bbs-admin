import React, { useState } from 'react';
import { Search, ChefHat, CheckCircle2, Clock, Loader2, Bike, MapPin, FileImage, XCircle, AlertCircle } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { formatCurrency } from '../utils/helpers';
import Swal from 'sweetalert2';
import { DateTime } from 'luxon';

export const OrdersListScreen = () => {
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedReceipt, setSelectedReceipt] = useState(null);
  
  const filters = ['All', 'pending', 'prepping', 'delivering', 'delivered'];

  const { data: orders = [], isLoading } = useQuery({
    queryKey: ['liveOrders'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('orders')
        .select('*, order_items(*)')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    }
  });

  const statusMutation = useMutation({
    mutationFn: async ({ id, status }) => {
      const { error } = await supabase.from('orders').update({ status }).eq('id', id);
      if (error) throw error;
    },
    onMutate: async ({ id, status }) => {
      await queryClient.cancelQueries({ queryKey: ['liveOrders'] });
      const previous = queryClient.getQueryData(['liveOrders']);
      queryClient.setQueryData(['liveOrders'], old => 
        old.map(o => o.id === id ? { ...o, status } : o)
      );
      return { previous };
    },
    onError: (err, variables, context) => queryClient.setQueryData(['liveOrders'], context.previous),
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['liveOrders'] })
  });

  // SWEETALERT2 CONFIRMATION ENGINE
  const handleUpdateStatus = (id, nextStatus, label) => {
    Swal.fire({
      title: 'Confirm Action',
      text: `Are you sure you want to ${label.toLowerCase()}?`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#e25f38',
      cancelButtonColor: '#1c1c1c',
      confirmButtonText: `Yes, ${label}`,
      background: '#fdfbf7',
      color: '#1c1c1c'
    }).then((result) => {
      if (result.isConfirmed) {
        statusMutation.mutate({ id, status: nextStatus });
        Swal.fire({
          title: 'Status Updated',
          text: `Order has been moved to ${nextStatus}.`,
          icon: 'success',
          confirmButtonColor: '#e25f38',
          background: '#fdfbf7',
          timer: 1500
        });
      }
    });
  };

  const getShortId = (uuid) => `#BBS-${uuid?.split('-')[0].toUpperCase()}`;
  
  // LUXON INTEGRATION FOR FLAWLESS TIME PARSING
  const formatTime = (dateString) => DateTime.fromISO(dateString).toFormat('h:mm a');
  
  const getItemsString = (orderItems) => {
    if (!orderItems || orderItems.length === 0) return 'No items found';
    return orderItems.map(item => {
      let text = `${item.item_name} (x${item.quantity})`;
      if (item.modifiers?.length > 0) text += ` [${item.modifiers.map(m => m.name).join(', ')}]`;
      return text;
    }).join(' • ');
  };

  const filteredOrders = orders.filter(order => {
    const matchesFilter = filter === 'All' || order.status?.toLowerCase() === filter;
    const searchLower = searchQuery.toLowerCase();
    const shortId = getShortId(order.id).toLowerCase();
    const customerName = (order.customer_name || '').toLowerCase();
    const matchesSearch = searchQuery === '' || shortId.includes(searchLower) || customerName.includes(searchLower);
    return matchesFilter && matchesSearch;
  });

  const getNextAction = (currentStatus) => {
    switch(currentStatus?.toLowerCase()) {
      case 'pending': return { label: 'Accept & Prep', next: 'prepping', color: 'bg-amber-500 hover:bg-amber-600 text-white', icon: ChefHat };
      case 'prepping': return { label: 'Out for Delivery', next: 'delivering', color: 'bg-purple-500 hover:bg-purple-600 text-white', icon: Bike };
      case 'delivering': return { label: 'Mark Delivered', next: 'delivered', color: 'bg-emerald-500 hover:bg-emerald-600 text-white', icon: CheckCircle2 };
      default: return null; 
    }
  };

  const getStatusBadge = (status) => {
    switch(status?.toLowerCase()) {
      case 'pending': return 'bg-blue-100 text-blue-700 border-blue-200';
      case 'prepping': return 'bg-amber-100 text-amber-700 border-amber-200';
      case 'delivering': return 'bg-purple-100 text-purple-700 border-purple-200';
      case 'delivered': return 'bg-emerald-100 text-emerald-700 border-emerald-200';
      case 'cancelled': return 'bg-red-100 text-red-700 border-red-200';
      default: return 'bg-gray-100 text-gray-700 border-gray-200';
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-[#e25f38] mb-4" />
        <p className="font-bold text-[#8c8a86]">Loading live orders...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-4 rounded-2xl border border-[#e5e0d8] shadow-sm">
        <div className="relative w-full md:w-96">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8c8a86]" />
          <input 
            type="text" placeholder="Search order ID or customer..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-[#f5f3ef] border-transparent focus:bg-white focus:border-[#e25f38] border-2 rounded-xl outline-none font-bold text-sm transition-all"
          />
        </div>
        <div className="flex gap-2 overflow-x-auto w-full md:w-auto pb-1 md:pb-0 hide-scrollbar">
          {filters.map(f => (
            <button 
              key={f} onClick={() => setFilter(f)}
              className={`px-4 py-2 rounded-lg font-bold text-sm whitespace-nowrap transition-all capitalize ${filter === f ? 'bg-[#1c1c1c] text-white shadow-md' : 'bg-[#f5f3ef] text-[#8c8a86] hover:bg-[#e5e0d8]'}`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-[#e5e0d8] shadow-sm overflow-hidden">
        <div className="divide-y divide-[#e5e0d8]">
          {filteredOrders.length === 0 ? (
            <div className="p-12 text-center text-[#8c8a86] font-bold">No orders found for this filter.</div>
          ) : (
            filteredOrders.map(order => {
              const action = getNextAction(order.status);
              return (
                <div key={order.id} className="p-6 flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6 hover:bg-[#fdfbf7] transition-colors">
                  <div className="flex-1 space-y-3 w-full">
                    <div className="flex items-center gap-4">
                      <h3 className="font-black text-xl text-[#1c1c1c]">{getShortId(order.id)}</h3>
                      <span className={`text-[10px] font-black uppercase tracking-wider px-3 py-1 rounded-md border ${getStatusBadge(order.status)}`}>{order.status}</span>
                      <span className="text-sm font-bold text-[#8c8a86] flex items-center gap-1.5 ml-auto lg:ml-0"><Clock className="w-4 h-4" /> {formatTime(order.created_at)}</span>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                     <div>
                        <p className="text-xs font-bold text-[#8c8a86] uppercase tracking-widest mb-1">Customer</p>
                        <p className="font-bold text-[#1c1c1c]">{order.customer_name} <span className="text-[#8c8a86] font-medium ml-2">{order.customer_phone}</span></p>
                        <p className="text-xs font-bold text-[#e25f38] mt-1 mb-2">{order.delivery_zone}</p>
                        {order.location_link && order.location_link !== 'Not Provided' && (
                          <a href={order.location_link} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors text-xs font-bold">
                            <MapPin className="w-3.5 h-3.5" /> Open in Maps
                          </a>
                        )}
                      </div>
                      <div>
                        <p className="text-xs font-bold text-[#8c8a86] uppercase tracking-widest mb-1">Order Items</p>
                        <p className="font-bold text-[#1c1c1c] line-clamp-2 leading-snug">{getItemsString(order.order_items)}</p>
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-row lg:flex-col items-center lg:items-end justify-between w-full lg:w-auto gap-4 border-t lg:border-t-0 border-[#e5e0d8] pt-4 lg:pt-0">
                    <div className="text-left lg:text-right w-full lg:w-auto">
                      <p className="text-xs font-bold text-[#8c8a86] uppercase tracking-widest mb-1">Total</p>
                      <p className="font-black text-2xl text-[#e25f38]">{formatCurrency(order.total_amount)}</p>
                      {order.payment_method === 'momo' && order.momo_receipt_url && (
                        <button onClick={() => setSelectedReceipt(order.momo_receipt_url)} className="mt-2 flex items-center justify-center lg:justify-end gap-1.5 text-xs font-bold text-blue-600 bg-blue-50 px-3 py-1.5 rounded-lg hover:bg-blue-100 transition-colors w-full lg:w-auto">
                          <FileImage className="w-3.5 h-3.5" /> View Receipt
                        </button>
                      )}
                    </div>
                    {action && (
                      <button onClick={() => handleUpdateStatus(order.id, action.next, action.label)} className={`flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-bold shadow-md transition-all active:scale-95 w-full lg:w-auto ${action.color}`}>
                        <action.icon className="w-5 h-5" /> {action.label}
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {selectedReceipt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#1c1c1c]/80 backdrop-blur-sm p-4" onClick={() => setSelectedReceipt(null)}>
          <div className="bg-white p-2 rounded-2xl max-w-lg w-full relative" onClick={e => e.stopPropagation()}>
            <button onClick={() => setSelectedReceipt(null)} className="absolute -top-4 -right-4 bg-white text-[#1c1c1c] p-2 rounded-full shadow-xl hover:scale-105 transition-transform">
              <XCircle className="w-6 h-6" />
            </button>
            <div className="w-full h-auto max-h-[80vh] overflow-hidden rounded-xl border border-[#e5e0d8] bg-[#f5f3ef]">
              {selectedReceipt.includes('Pending') ? (
                 <div className="p-12 text-center text-amber-600 bg-amber-50 h-full flex flex-col justify-center items-center">
                    <AlertCircle className="w-12 h-12 mb-4" />
                    <p className="font-bold text-lg">Receipt Pending</p>
                    <p className="text-sm mt-1">Waiting for customer to complete upload.</p>
                 </div>
              ) : (
                <img src={selectedReceipt} alt="MoMo Receipt" className="w-full h-full object-contain" />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
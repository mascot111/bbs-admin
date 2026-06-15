import React, { useState } from 'react';
import { Search, ChefHat, CheckCircle2, Clock, Loader2, Bike, MapPin, FileImage, XCircle, AlertCircle, Navigation, User, X } from 'lucide-react';
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
  
  // NEW: Dispatch Modal State
  const [dispatchModalOrder, setDispatchModalOrder] = useState(null);
  
  // Expanded filters to track rider progress
  const filters = ['All', 'pending', 'prepping', 'assigned', 'picked_up', 'delivered'];

  const { data: orders = [], isLoading } = useQuery({
    queryKey: ['liveOrders'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('orders')
        .select('*, order_items(*)')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    refetchInterval: 5000 // Keep the radar fresh
  });

  // NEW: Query to fetch only available riders for dispatch
  const { data: availableRiders = [], isLoading: isLoadingRiders } = useQuery({
    queryKey: ['availableRiders'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('riders')
        .select('*')
        .eq('status', 'available');
      if (error) throw error;
      return data || [];
    },
    enabled: !!dispatchModalOrder, // Only fetch when the modal is open
    refetchInterval: 3000
  });

  const statusMutation = useMutation({
    mutationFn: async ({ id, status }) => {
      const { error } = await supabase.from('orders').update({ status }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['liveOrders'] });
      queryClient.invalidateQueries({ queryKey: ['dashboardMetrics'] });
    }
  });

  // NEW: Dedicated Dispatch Mutation
  const dispatchMutation = useMutation({
    mutationFn: async ({ orderId, riderId }) => {
      const { error } = await supabase
        .from('orders')
        .update({ status: 'assigned', assigned_rider_id: riderId })
        .eq('id', orderId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['liveOrders'] });
      queryClient.invalidateQueries({ queryKey: ['availableRiders'] });
      setDispatchModalOrder(null);
      Swal.fire({
        title: 'Rider Assigned',
        text: 'The payload has been transmitted to the operative.',
        icon: 'success',
        confirmButtonColor: '#e25f38',
        background: '#fdfbf7',
        timer: 2000
      });
    }
  });

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
      }
    });
  };

  const executeDispatch = (riderId) => {
    if (!dispatchModalOrder) return;
    dispatchMutation.mutate({ orderId: dispatchModalOrder.id, riderId });
  };

  const getShortId = (uuid) => `#BBS-${uuid?.split('-')[0].toUpperCase()}`;
  const formatTime = (dateString) => DateTime.fromISO(dateString).toFormat('h:mm a');
  
  const getItemsString = (orderItems) => {
    if (!orderItems || orderItems.length === 0) return 'No items found';
    return orderItems.map(item => {
      let text = `${item.item_name} (x${item.quantity})`;
      if (item.modifiers?.length > 0) text += ` [${item.modifiers.map(m => m.name).join(', ')}]`;
      return text;
    }).join(' • ');
  };

  const getCleanMapUrl = (locationString) => {
    if (!locationString || locationString === 'Store Pickup' || locationString === 'Not Provided') return null;
    const parts = locationString.split('|');
    const possibleUrl = parts[parts.length - 1].trim();
    return possibleUrl.startsWith('http') ? possibleUrl : null;
  };

  const filteredOrders = orders.filter(order => {
    const matchesFilter = filter === 'All' || order.status?.toLowerCase() === filter;
    const searchLower = searchQuery.toLowerCase();
    const shortId = getShortId(order.id).toLowerCase();
    const customerName = (order.customer_name || '').toLowerCase();
    const matchesSearch = searchQuery === '' || shortId.includes(searchLower) || customerName.includes(searchLower);
    return matchesFilter && matchesSearch;
  });

  // RESTRICTED STATE MACHINE: Admin only controls Pending -> Prepping -> Assigned
  const getNextAction = (currentStatus) => {
    switch(currentStatus?.toLowerCase()) {
      case 'pending': return { label: 'Accept & Prep', next: 'prepping', color: 'bg-amber-500 hover:bg-amber-600 text-white', icon: ChefHat, isDispatch: false };
      case 'prepping': return { label: 'Assign Rider', next: null, color: 'bg-indigo-600 hover:bg-indigo-700 text-white', icon: Navigation, isDispatch: true };
      default: return null; 
    }
  };

  const getStatusBadge = (status) => {
    switch(status?.toLowerCase()) {
      case 'pending': return 'bg-blue-100 text-blue-700 border-blue-200';
      case 'prepping': return 'bg-amber-100 text-amber-700 border-amber-200';
      case 'assigned': return 'bg-indigo-100 text-indigo-700 border-indigo-200';
      case 'picked_up': return 'bg-purple-100 text-purple-700 border-purple-200';
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
              {f.replace('_', ' ')}
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
                      <span className={`text-[10px] font-black uppercase tracking-wider px-3 py-1 rounded-md border ${getStatusBadge(order.status)}`}>
                        {order.status.replace('_', ' ')}
                      </span>
                      <span className="text-sm font-bold text-[#8c8a86] flex items-center gap-1.5 ml-auto lg:ml-0"><Clock className="w-4 h-4" /> {formatTime(order.created_at)}</span>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                     <div>
                        <p className="text-xs font-bold text-[#8c8a86] uppercase tracking-widest mb-1">Customer</p>
                        <p className="font-bold text-[#1c1c1c]">{order.customer_name} <span className="text-[#8c8a86] font-medium ml-2">{order.customer_phone}</span></p>
                        <p className="text-xs font-bold text-[#e25f38] mt-1 mb-2">{order.delivery_zone}</p>
                        
                        {(() => {
                          const mapUrl = getCleanMapUrl(order.location_link);
                          return mapUrl ? (
                            <a href={mapUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors text-xs font-bold mt-2">
                              <MapPin className="w-3.5 h-3.5" /> Open in Maps
                            </a>
                          ) : null;
                        })()}
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
                      
                      {/* Waiting on Rider UI indicator */}
                      {['assigned', 'picked_up'].includes(order.status) && (
                        <div className="mt-2 flex items-center justify-start lg:justify-end gap-1.5 text-xs font-bold text-indigo-600">
                          <Loader2 className="w-3.5 h-3.5 animate-spin" /> Awaiting Rider
                        </div>
                      )}

                      {order.payment_method === 'momo' && order.momo_receipt_url && (
                        <button onClick={() => setSelectedReceipt(order.momo_receipt_url)} className="mt-2 flex items-center justify-center lg:justify-end gap-1.5 text-xs font-bold text-blue-600 bg-blue-50 px-3 py-1.5 rounded-lg hover:bg-blue-100 transition-colors w-full lg:w-auto">
                          <FileImage className="w-3.5 h-3.5" /> View Receipt
                        </button>
                      )}
                    </div>
                    
                    {/* The Action Button Engine */}
                    {action && (
                      <button 
                        onClick={() => {
                          if (action.isDispatch) {
                            setDispatchModalOrder(order);
                          } else {
                            handleUpdateStatus(order.id, action.next, action.label);
                          }
                        }} 
                        className={`flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-bold shadow-md transition-all active:scale-95 w-full lg:w-auto ${action.color}`}
                      >
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

      {/* --- MODAL 1: Dispatch Radar Overlay --- */}
      {dispatchModalOrder && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-[#1c1c1c]/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[80vh]">
            
            <div className="p-6 border-b border-[#e5e0d8] flex items-center justify-between bg-[#fdfbf7] shrink-0">
              <div>
                <h3 className="text-xl font-black text-[#1c1c1c]">Assign Delivery</h3>
                <p className="text-sm font-bold text-[#8c8a86] mt-1">{getShortId(dispatchModalOrder.id)} • {dispatchModalOrder.delivery_zone}</p>
              </div>
              <button onClick={() => setDispatchModalOrder(null)} className="p-2 text-[#8c8a86] hover:bg-gray-100 rounded-full transition-colors">
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto bg-white flex-1">
              <p className="text-xs font-bold text-[#8c8a86] uppercase tracking-widest mb-4">Available Operatives</p>
              
              {isLoadingRiders ? (
                <div className="flex items-center justify-center py-10 text-[#e25f38]">
                  <Loader2 className="w-8 h-8 animate-spin" />
                </div>
              ) : availableRiders.length === 0 ? (
                <div className="text-center py-10 bg-[#f5f3ef] rounded-xl border border-dashed border-[#e5e0d8]">
                  <AlertCircle className="w-8 h-8 text-red-500 mx-auto mb-2" />
                  <p className="font-bold text-[#1c1c1c]">No Riders Available</p>
                  <p className="text-xs text-[#8c8a86] mt-1">All operatives are currently busy or offline.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {availableRiders.map(rider => (
                    <div key={rider.id} className="flex items-center justify-between p-4 border border-[#e5e0d8] rounded-2xl hover:border-[#e25f38] transition-colors group">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-[#f5f3ef] rounded-full overflow-hidden flex items-center justify-center shrink-0 border border-[#e5e0d8]">
                          {rider.rider_photo_url ? (
                            <img src={rider.rider_photo_url} alt="rider" className="w-full h-full object-cover" />
                          ) : (
                            <User className="w-6 h-6 text-[#8c8a86]" />
                          )}
                        </div>
                        <div>
                          <p className="font-bold text-[#1c1c1c]">{rider.name}</p>
                          <p className="text-xs font-bold text-[#8c8a86] uppercase tracking-wider">{rider.vehicle_type}</p>
                        </div>
                      </div>
                      <button 
                        onClick={() => executeDispatch(rider.id)}
                        disabled={dispatchMutation.isPending}
                        className="px-4 py-2 bg-[#1c1c1c] text-white text-sm font-bold rounded-xl hover:bg-[#e25f38] transition-colors disabled:opacity-50"
                      >
                        Dispatch
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* --- MODAL 2: Receipt Viewer Overlay --- */}
      {selectedReceipt && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-[#1c1c1c]/80 backdrop-blur-sm p-4" onClick={() => setSelectedReceipt(null)}>
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
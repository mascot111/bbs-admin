import React, { useState } from 'react';
import { Banknote, CheckCircle, Clock, X, GripVertical, Trash2, Loader2, Copy, FileText, Eye } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { formatCurrency } from '../utils/helpers'; 

export default function CateringQuotes() {
  const queryClient = useQueryClient();

  // Modal States
  const [isQuoteModalOpen, setIsQuoteModalOpen] = useState(false);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [activeTicket, setActiveTicket] = useState(null);
  
  // Itemized Quote State
  const [quoteDetails, setQuoteDetails] = useState({
    foodCost: '',
    logistics: '',
    discount: '',
  });

  const columns = [
    { id: 'new-request', title: 'New Requests', color: 'border-blue-500', bg: 'bg-blue-500' },
    { id: 'quoted', title: 'Awaiting Decision', color: 'border-amber-500', bg: 'bg-amber-500' },
    { id: 'deposit-paid', title: 'Deposit Secured', color: 'border-purple-500', bg: 'bg-purple-500' },
    { id: 'completed', title: 'Fulfilled', color: 'border-emerald-500', bg: 'bg-emerald-500' }
  ];

  const { data: tickets = [], isLoading } = useQuery({
    queryKey: ['cateringRequests'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('catering_requests')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    }
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, updates }) => {
      const { error } = await supabase.from('catering_requests').update(updates).eq('id', id);
      if (error) throw error;
    },
    onMutate: async ({ id, updates }) => {
      await queryClient.cancelQueries({ queryKey: ['cateringRequests'] });
      const previous = queryClient.getQueryData(['cateringRequests']);
      queryClient.setQueryData(['cateringRequests'], old => 
        old.map(t => t.id === id ? { ...t, ...updates } : t)
      );
      return { previous };
    },
    onError: (err, variables, context) => queryClient.setQueryData(['cateringRequests'], context.previous),
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['cateringRequests'] })
  });

  const deleteMutation = useMutation({
    mutationFn: async (id) => {
      const { error } = await supabase.from('catering_requests').delete().eq('id', id);
      if (error) throw error;
    },
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: ['cateringRequests'] });
      const previous = queryClient.getQueryData(['cateringRequests']);
      queryClient.setQueryData(['cateringRequests'], old => old.filter(t => t.id !== id));
      return { previous };
    },
    onError: (err, id, context) => queryClient.setQueryData(['cateringRequests'], context.previous),
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['cateringRequests'] })
  });

  // --- HANDLERS & CALCULATIONS ---
  const handleDragStart = (e, ticketId) => e.dataTransfer.setData('ticketId', ticketId);
  const handleDragOver = (e) => e.preventDefault();
  const handleDrop = (e, newStatus) => {
    e.preventDefault();
    const ticketId = e.dataTransfer.getData('ticketId');
    if (ticketId) updateMutation.mutate({ id: ticketId, updates: { status: newStatus } });
  };

  const calculateGrandTotal = () => {
    const food = Number(quoteDetails.foodCost) || 0;
    const logistics = Number(quoteDetails.logistics) || 0;
    const discount = Number(quoteDetails.discount) || 0;
    return (food + logistics) - discount;
  };

  const openQuoteModal = (ticket) => {
    setActiveTicket(ticket);
    setQuoteDetails({
      foodCost: ticket.total ? String(ticket.total * 0.9) : '', 
      logistics: ticket.total ? String(ticket.total * 0.1) : '',
      discount: '0'
    });
    setIsQuoteModalOpen(true);
  };

  const openDetailsModal = (ticket) => {
    setActiveTicket(ticket);
    setIsDetailsModalOpen(true);
  };

  const submitQuote = (e) => {
    e.preventDefault();
    const total = calculateGrandTotal();
    if (total <= 0) return;
    updateMutation.mutate({ id: activeTicket.id, updates: { total: total, status: 'quoted' } });
    setIsQuoteModalOpen(false);
  };

  const generateProposalText = (ticket) => {
    const total = calculateGrandTotal() || ticket.total;
    const text = `*OFFICIAL PROPOSAL: BIGG BRODASS STOPOVER* 🍽️\n\n`
      + `*Client:* ${ticket.customer}\n`
      + `*Event:* ${ticket.event}\n\n`
      + `*Menu Selection:*\n`
      + `${Array.isArray(ticket.dishes) ? ticket.dishes.map(d => `• ${d}`).join('\n') : ticket.dishes}\n\n`
      + `*Financial Breakdown:*\n`
      + `Food & Beverage: GHS ${quoteDetails.foodCost || 'TBD'}\n`
      + `Logistics & Setup (10%): GHS ${quoteDetails.logistics || 'TBD'}\n`
      + (Number(quoteDetails.discount) > 0 ? `Applied Discount: -GHS ${quoteDetails.discount}\n` : '')
      + `--------------------------\n`
      + `*Grand Total: ${formatCurrency(total)}*\n\n`
      + `*Terms:* A 50% deposit is required to secure your booking date. Please review and let us know if you have any modifications.\n\n`
      + `Thank you for choosing B.B.S Eats!`;
      
    navigator.clipboard.writeText(text);
    alert("Professional proposal copied to clipboard. Ready to paste in WhatsApp/Email.");
  };

  const getColumnTotal = (statusId) => {
    return tickets
      .filter(t => t.status === statusId)
      .reduce((sum, t) => sum + (Number(t.total) || 0), 0);
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-[#e25f38] mb-4" />
        <p className="font-bold text-[#8c8a86]">Loading B2B pipeline...</p>
      </div>
    );
  }

  return (
    <div className="max-w-full mx-auto space-y-6 overflow-hidden h-[calc(100vh-8rem)] flex flex-col">
      
      {/* MOBILE OPTIMIZED HEADER */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 mb-4 shrink-0 w-full">
        <div>
          <p className="text-[#8c8a86] font-bold text-xs uppercase tracking-wider mb-1">Corporate & Events CRM</p>
          <h2 className="text-3xl font-black text-[#1c1c1c] leading-none">Catering Pipeline</h2>
        </div>
        <div className="bg-[#1c1c1c] w-full md:w-auto px-5 py-3 rounded-xl shadow-lg flex justify-between md:justify-start gap-4 md:gap-6 text-sm font-bold text-white">
          <div className="flex flex-col">
            <span className="text-[#8c8a86] text-[10px] md:text-xs uppercase tracking-widest">Active Pipeline</span>
            <span className="text-lg">{formatCurrency(getColumnTotal('quoted') + getColumnTotal('deposit-paid'))}</span>
          </div>
          <div className="w-px bg-white/20"></div>
          <div className="flex flex-col items-end md:items-start">
            <span className="text-[#8c8a86] text-[10px] md:text-xs uppercase tracking-widest">Closed Won</span>
            <span className="text-emerald-400 text-lg">{formatCurrency(getColumnTotal('completed'))}</span>
          </div>
        </div>
      </div>

      {/* MOBILE OPTIMIZED KANBAN COLUMNS (Snapping enabled) */}
      <div className="flex gap-4 md:gap-6 overflow-x-auto pb-4 flex-1 items-start snap-x snap-mandatory">
        {columns.map((column) => (
          <div 
            key={column.id} 
            className="bg-[#e5e0d8]/30 rounded-2xl min-w-[300px] md:min-w-[340px] max-w-[300px] md:max-w-[340px] flex flex-col h-full max-h-full border border-[#e5e0d8]/50 overflow-hidden snap-center"
            onDragOver={handleDragOver}
            onDrop={(e) => handleDrop(e, column.id)}
          >
            <div className="p-4 border-b border-[#e5e0d8] flex justify-between items-center bg-[#f5f3ef] shrink-0">
              <div className="flex items-center gap-2">
                <div className={`w-3 h-3 rounded-full ${column.bg}`}></div>
                <h3 className="text-md font-bold text-[#1c1c1c] tracking-wide">{column.title}</h3>
              </div>
              <div className="flex flex-col items-end">
                <span className="text-[#1c1c1c] font-black">{formatCurrency(getColumnTotal(column.id))}</span>
                <span className="text-[#8c8a86] text-xs font-bold">{tickets.filter(t => t.status === column.id).length} Leads</span>
              </div>
            </div>

            <div className="p-4 flex flex-col gap-4 overflow-y-auto flex-1">
              {tickets
                .filter((ticket) => ticket.status === column.id)
                .map((ticket) => {
                  const dishesList = Array.isArray(ticket.dishes) ? ticket.dishes : [];

                  return (
                    <div 
                      key={ticket.id} 
                      draggable
                      onDragStart={(e) => handleDragStart(e, ticket.id)}
                      className={`bg-white rounded-xl p-5 shadow-sm border-l-4 ${column.color} hover:shadow-md transition-all cursor-grab active:cursor-grabbing group relative`}
                    >
                      <div className="absolute right-3 top-4 text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity">
                        <GripVertical className="w-5 h-5" />
                      </div>

                      <h4 className="font-black text-[#1c1c1c] mb-1 pr-6">{ticket.customer}</h4>
                      <p className="text-xs font-bold text-[#e25f38] mb-4 uppercase tracking-wider">{ticket.event}</p>
                      
                      <div className="text-sm text-[#8c8a86] mb-4 space-y-3">
                        <ul className="space-y-1 font-medium">
                          {dishesList.slice(0, 2).map((dish, index) => (
                            <li key={index} className="truncate before:content-['•'] before:mr-2 before:text-[#e25f38]">
                              {dish}
                            </li>
                          ))}
                          {dishesList.length > 2 && <li className="text-xs italic pl-4">+ {dishesList.length - 2} more packages</li>}
                        </ul>
                      </div>
                      
                      <div className="flex justify-between items-center mt-5 pt-4 border-t border-[#e5e0d8]">
                        <div className="font-black text-[#1c1c1c]">
                          {ticket.total ? formatCurrency(ticket.total) : <span className="text-[#8c8a86] text-sm">Under Review</span>}
                        </div>
                        <div className="flex items-center gap-1.5">
                          <button onClick={() => openDetailsModal(ticket)} className="p-2 text-[#8c8a86] hover:bg-[#1c1c1c] hover:text-white rounded-lg transition-colors" title="View Full Details">
                            <Eye className="w-4 h-4" />
                          </button>
                          <button onClick={() => openQuoteModal(ticket)} className="p-2 text-[#8c8a86] hover:bg-blue-50 hover:text-blue-600 rounded-lg transition-colors" title="Manage Proposal">
                            <FileText className="w-4 h-4" />
                          </button>
                          <button onClick={() => deleteMutation.mutate(ticket.id)} className="p-2 text-[#8c8a86] hover:bg-red-50 hover:text-red-500 rounded-lg transition-colors" title="Delete Lead">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>
        ))}
      </div>

      {/* DRAFT QUOTE MODAL OVERLAY */}
      {isQuoteModalOpen && (
        <div className="fixed inset-0 bg-[#1c1c1c]/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="px-6 py-5 border-b border-[#e5e0d8] flex justify-between items-center bg-[#fdfbf7]">
              <div>
                <h3 className="font-black text-xl text-[#1c1c1c]">Financial Proposal</h3>
                <p className="text-sm font-bold text-[#8c8a86]">{activeTicket?.customer}</p>
              </div>
              <button onClick={() => setIsQuoteModalOpen(false)} className="text-[#8c8a86] hover:text-[#1c1c1c] transition-colors p-2 bg-white rounded-full shadow-sm border border-[#e5e0d8]">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <form onSubmit={submitQuote} className="p-6">
              
              <div className="space-y-4 mb-8">
                <div>
                  <label className="block text-xs font-bold text-[#8c8a86] mb-1 uppercase tracking-widest">Base Food & Beverage</label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 pl-4 flex items-center text-[#8c8a86] font-bold">GHS</span>
                    <input type="number" required value={quoteDetails.foodCost} onChange={(e) => setQuoteDetails({...quoteDetails, foodCost: e.target.value})} className="w-full pl-14 pr-4 py-3 bg-[#f5f3ef] border border-[#e5e0d8] rounded-xl font-black text-[#1c1c1c] outline-none focus:border-[#e25f38] transition-colors" placeholder="0.00" />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-[#8c8a86] mb-1 uppercase tracking-widest">Logistics (10%)</label>
                    <div className="relative">
                      <span className="absolute inset-y-0 left-0 pl-4 flex items-center text-[#8c8a86] font-bold">GHS</span>
                      <input type="number" required value={quoteDetails.logistics} onChange={(e) => setQuoteDetails({...quoteDetails, logistics: e.target.value})} className="w-full pl-14 pr-4 py-3 bg-[#f5f3ef] border border-[#e5e0d8] rounded-xl font-black text-[#1c1c1c] outline-none focus:border-[#e25f38] transition-colors" placeholder="0.00" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-[#8c8a86] mb-1 uppercase tracking-widest">Discount</label>
                    <div className="relative">
                      <span className="absolute inset-y-0 left-0 pl-4 flex items-center text-[#8c8a86] font-bold">GHS</span>
                      <input type="number" value={quoteDetails.discount} onChange={(e) => setQuoteDetails({...quoteDetails, discount: e.target.value})} className="w-full pl-14 pr-4 py-3 bg-[#f5f3ef] border border-[#e5e0d8] rounded-xl font-black text-[#1c1c1c] outline-none focus:border-[#e25f38] transition-colors" placeholder="0.00" />
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-[#1c1c1c] p-5 rounded-2xl mb-6 shadow-xl text-white flex justify-between items-center">
                <div>
                  <p className="text-xs font-bold text-[#cfccc6] uppercase tracking-widest">Grand Total</p>
                  <p className="text-sm font-medium text-[#8c8a86]">Final payable amount</p>
                </div>
                <h3 className="text-3xl font-black text-[#e25f38]">{formatCurrency(calculateGrandTotal())}</h3>
              </div>

              <div className="flex gap-3">
                <button type="button" onClick={() => generateProposalText(activeTicket)} className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-blue-50 text-blue-600 font-bold rounded-xl hover:bg-blue-100 transition-colors">
                  <Copy className="w-4 h-4" /> Copy Invoice
                </button>
                <button type="submit" className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-[#e25f38] text-white font-bold rounded-xl shadow-lg hover:bg-[#c9512e] transition-colors">
                  <CheckCircle className="w-4 h-4" /> Save & Update Pipeline
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* LEAD DETAILS MODAL OVERLAY */}
      {isDetailsModalOpen && (
        <div className="fixed inset-0 bg-[#1c1c1c]/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
            
            <div className="px-6 py-5 border-b border-[#e5e0d8] flex justify-between items-center bg-[#fdfbf7] shrink-0">
              <div>
                <h3 className="font-black text-xl text-[#1c1c1c]">Lead Details</h3>
                <p className="text-sm font-bold text-[#8c8a86]">{activeTicket?.customer}</p>
              </div>
              <button onClick={() => setIsDetailsModalOpen(false)} className="text-[#8c8a86] hover:text-[#1c1c1c] transition-colors p-2 bg-white rounded-full shadow-sm border border-[#e5e0d8]">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-8 flex-1">
              
              <div>
                <h4 className="text-xs font-bold text-[#8c8a86] uppercase tracking-widest mb-2">Event Information</h4>
                <p className="font-black text-[#1c1c1c] text-xl">{activeTicket?.event}</p>
              </div>
              
              <div>
                <h4 className="text-xs font-bold text-[#8c8a86] uppercase tracking-widest mb-3">Menu Selection</h4>
                <ul className="space-y-3">
                  {Array.isArray(activeTicket?.dishes) ? activeTicket.dishes.map((dish, i) => (
                    <li key={i} className="flex items-start gap-3 bg-[#f5f3ef] p-4 rounded-xl font-bold text-[#1c1c1c] border border-[#e5e0d8]">
                      <CheckCircle className="w-5 h-5 text-[#e25f38] shrink-0" />
                      {dish}
                    </li>
                  )) : (
                    <li className="bg-[#f5f3ef] p-4 rounded-xl font-bold text-[#1c1c1c] border border-[#e5e0d8]">
                      {activeTicket?.dishes}
                    </li>
                  )}
                </ul>
              </div>

              <div>
                <h4 className="text-xs font-bold text-[#8c8a86] uppercase tracking-widest mb-3">CRM Notes & Contacts</h4>
                <div className="bg-[#f5f3ef] p-5 rounded-xl border border-[#e5e0d8]">
                  <pre className="whitespace-pre-wrap font-bold text-[#1c1c1c] font-sans text-sm leading-relaxed">
                    {activeTicket?.notes || 'No additional notes provided.'}
                  </pre>
                </div>
              </div>

            </div>
          </div>
        </div>
      )}

    </div>
  );
}
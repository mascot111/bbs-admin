import React, { useState } from 'react';
import { Banknote, CheckCircle, X, GripVertical, Trash2, Loader2, Copy, FileText, Printer, Download, Briefcase, Calendar as CalendarIcon, Save } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { formatCurrency } from '../utils/helpers'; 

export default function CateringQuotes() {
  const queryClient = useQueryClient();

  // Modal & CRM States
  const [isQuoteModalOpen, setIsQuoteModalOpen] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isInvoiceModalOpen, setIsInvoiceModalOpen] = useState(false);
  const [activeTicket, setActiveTicket] = useState(null);
  
  // CRM Note State
  const [crmData, setCrmData] = useState({ admin_notes: '', follow_up_date: '' });

  // Itemized Quote State
  const [quoteDetails, setQuoteDetails] = useState({
    foodCost: '',
    logistics: '',
    discount: '',
  });

  // UPGRADED SALES PIPELINE COLUMNS
  const columns = [
    { id: 'new-request', title: 'New Lead', color: 'border-blue-500', bg: 'bg-blue-500' },
    { id: 'negotiation', title: 'In Negotiation', color: 'border-amber-500', bg: 'bg-amber-500' },
    { id: 'awaiting-deposit', title: 'Awaiting Deposit', color: 'border-purple-500', bg: 'bg-purple-500' },
    { id: 'secured', title: 'Secured', color: 'border-emerald-500', bg: 'bg-emerald-500' }
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
      foodCost: ticket.total ? String(Math.round(ticket.total / 1.1)) : '', 
      logistics: ticket.total ? String(Math.round((ticket.total / 1.1) * 0.1)) : '',
      discount: '0'
    });
    setIsQuoteModalOpen(true);
  };

  const openCRMSidebar = (ticket) => {
    setActiveTicket(ticket);
    setCrmData({
      admin_notes: ticket.admin_notes || '',
      follow_up_date: ticket.follow_up_date || ''
    });
    setIsSidebarOpen(true);
  };

  const handleSaveCRM = () => {
    updateMutation.mutate({ 
      id: activeTicket.id, 
      updates: { 
        admin_notes: crmData.admin_notes, 
        follow_up_date: crmData.follow_up_date 
      } 
    });
    setIsSidebarOpen(false);
  };

  const openInvoiceModal = (ticket) => {
    if (!ticket.total) {
      alert("You must assign a price in 'Manage Proposal' before generating an invoice.");
      return;
    }
    setActiveTicket(ticket);
    setIsInvoiceModalOpen(true);
  };

  const triggerBrowserPrint = () => {
    window.print();
  };

  const submitQuote = (e) => {
    e.preventDefault();
    const total = calculateGrandTotal();
    if (total <= 0) return;
    // Moves to Awaiting Deposit pipeline automatically
    updateMutation.mutate({ id: activeTicket.id, updates: { total: total, status: 'awaiting-deposit' } });
    setIsQuoteModalOpen(false);
  };

  // PARSER: Safely splits the complex dish string into Title and Details
  const parseDishString = (dishString) => {
    if (!dishString) return { title: 'Unknown', details: null };
    const parts = dishString.split(' — ');
    return {
      title: parts[0],
      details: parts[1] || null
    };
  };

  const generateProposalText = (ticket) => {
    const total = calculateGrandTotal() || ticket.total;
    const formattedDishesList = Array.isArray(ticket.dishes) 
      ? ticket.dishes.map(d => {
          const parsed = parseDishString(d);
          return `• *${parsed.title}*\n  _${parsed.details || ''}_`;
        }).join('\n\n') 
      : ticket.dishes;

    const text = `*OFFICIAL PROPOSAL: BIGG BRODASS STOPOVER* 🍽️\n\n`
      + `*Client:* ${ticket.customer}\n`
      + `*Event:* ${ticket.event}\n\n`
      + `*Menu Selection:*\n`
      + `${formattedDishesList}\n\n`
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
      <div className="flex flex-col items-center justify-center min-h-[60vh] print:hidden">
        <Loader2 className="w-8 h-8 animate-spin text-[#e25f38] mb-4" />
        <p className="font-bold text-[#8c8a86]">Loading B2B pipeline...</p>
      </div>
    );
  }

  return (
    <>
      <div className="max-w-full mx-auto space-y-6 overflow-hidden h-[calc(100vh-8rem)] flex flex-col print:hidden">
        
        {/* PIPELINE METRICS */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 mb-4 shrink-0 w-full">
          <div>
            <p className="text-[#8c8a86] font-bold text-xs uppercase tracking-wider mb-1">Corporate & Events CRM</p>
            <h2 className="text-3xl font-black text-[#1c1c1c] leading-none">Catering Pipeline</h2>
          </div>
          <div className="bg-[#1c1c1c] w-full md:w-auto px-5 py-3 rounded-xl shadow-lg flex justify-between md:justify-start gap-4 md:gap-6 text-sm font-bold text-white">
            <div className="flex flex-col">
              <span className="text-[#8c8a86] text-[10px] md:text-xs uppercase tracking-widest">Active Pipeline</span>
              <span className="text-lg">{formatCurrency(getColumnTotal('negotiation') + getColumnTotal('awaiting-deposit'))}</span>
            </div>
            <div className="w-px bg-white/20"></div>
            <div className="flex flex-col items-end md:items-start">
              <span className="text-[#8c8a86] text-[10px] md:text-xs uppercase tracking-widest">Closed Won</span>
              <span className="text-emerald-400 text-lg">{formatCurrency(getColumnTotal('secured'))}</span>
            </div>
          </div>
        </div>

        {/* KANBAN BOARD */}
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
                        <p className="text-xs font-bold text-[#e25f38] mb-3 uppercase tracking-wider">{ticket.event}</p>
                        
                        {/* CRM Badge Flag */}
                        {ticket.follow_up_date && (
                          <div className="inline-flex items-center gap-1 bg-amber-50 text-amber-600 px-2 py-1 rounded text-[10px] font-black uppercase tracking-wider mb-3 border border-amber-200">
                            <CalendarIcon className="w-3 h-3" /> Follow up: {new Date(ticket.follow_up_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                          </div>
                        )}
                        
                        <div className="text-sm text-[#8c8a86] mb-4 space-y-3">
                          <ul className="space-y-1 font-medium">
                            {dishesList.slice(0, 2).map((dish, index) => {
                              const parsed = parseDishString(dish);
                              return (
                                <li key={index} className="truncate before:content-['•'] before:mr-2 before:text-[#e25f38]">
                                  {parsed.title}
                                </li>
                              );
                            })}
                            {dishesList.length > 2 && <li className="text-xs italic pl-4">+ {dishesList.length - 2} more packages</li>}
                          </ul>
                        </div>
                        
                        <div className="flex justify-between items-center mt-5 pt-4 border-t border-[#e5e0d8]">
                          <div className="font-black text-[#1c1c1c]">
                            {ticket.total ? formatCurrency(ticket.total) : <span className="text-[#8c8a86] text-sm">Under Review</span>}
                          </div>
                          <div className="flex items-center gap-1.5">
                            <button onClick={() => openInvoiceModal(ticket)} className="p-2 text-[#8c8a86] hover:bg-emerald-50 hover:text-emerald-600 rounded-lg transition-colors" title="Download PDF Invoice">
                              <Download className="w-4 h-4" />
                            </button>
                            <button onClick={() => openQuoteModal(ticket)} className="p-2 text-[#8c8a86] hover:bg-blue-50 hover:text-blue-600 rounded-lg transition-colors" title="Manage Proposal Price">
                              <Banknote className="w-4 h-4" />
                            </button>
                            <button onClick={() => openCRMSidebar(ticket)} className="p-2 text-[#8c8a86] hover:bg-[#1c1c1c] hover:text-white rounded-lg transition-colors" title="Open CRM Workspace">
                              <Briefcase className="w-4 h-4" />
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
      </div>

      {/* ------------------------------------------------------------- */}
      {/* 1. GLASSMORPHIC CRM SIDEBAR                                   */}
      {/* ------------------------------------------------------------- */}
      {isSidebarOpen && (
        <div className="fixed inset-0 z-50 flex justify-end bg-[#1c1c1c]/50 backdrop-blur-sm print:hidden">
          <div className="absolute inset-0" onClick={() => setIsSidebarOpen(false)}></div>
          
          <div className="w-full max-w-md bg-[#fdfbf7] h-full shadow-2xl relative flex flex-col animate-in slide-in-from-right duration-300">
            <div className="px-6 py-5 border-b border-[#e5e0d8] flex justify-between items-center bg-white shrink-0">
              <div>
                <h3 className="font-black text-xl text-[#1c1c1c]">Lead CRM</h3>
                <p className="text-sm font-bold text-[#8c8a86]">{activeTicket?.customer}</p>
              </div>
              <button onClick={() => setIsSidebarOpen(false)} className="text-[#8c8a86] hover:text-[#1c1c1c] transition-colors p-2 bg-[#f5f3ef] rounded-full shadow-sm border border-[#e5e0d8]">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto flex-1 space-y-6">
              
              {/* Internal Action Fields */}
              <div className="space-y-4 bg-white p-5 rounded-2xl border border-[#e5e0d8] shadow-sm">
                <div>
                  <label className="text-[10px] font-black text-[#1c1c1c] uppercase tracking-widest mb-2 flex items-center gap-1.5">
                    <CalendarIcon className="w-3.5 h-3.5 text-[#e25f38]" /> Next Follow-Up Date
                  </label>
                  <input 
                    type="date" 
                    value={crmData.follow_up_date} 
                    onChange={(e) => setCrmData({...crmData, follow_up_date: e.target.value})}
                    className="w-full bg-[#f5f3ef] border border-[#e5e0d8] focus:border-[#e25f38] rounded-xl p-3 font-bold text-[#1c1c1c] outline-none transition-colors"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-black text-[#1c1c1c] uppercase tracking-widest mb-2 block">Internal Admin Notes</label>
                  <textarea 
                    value={crmData.admin_notes} 
                    onChange={(e) => setCrmData({...crmData, admin_notes: e.target.value})}
                    placeholder="Record negotiation details, budget constraints, or competitor quotes here..."
                    className="w-full bg-[#f5f3ef] border border-[#e5e0d8] focus:border-[#e25f38] rounded-xl p-3 font-bold text-[#1c1c1c] outline-none transition-colors min-h-[120px] resize-none"
                  />
                </div>
                <button 
                  onClick={handleSaveCRM}
                  className="w-full py-3.5 bg-[#1c1c1c] text-white font-bold rounded-xl flex items-center justify-center gap-2 hover:bg-black transition-colors shadow-lg active:scale-95 mt-2"
                >
                  <Save className="w-4 h-4" /> Save CRM Data
                </button>
              </div>

              {/* Read-Only Lead Data */}
              <div>
                <h4 className="text-[10px] font-black text-[#8c8a86] uppercase tracking-widest mb-3 ml-1">Client Request Data</h4>
                <div className="bg-white border border-[#e5e0d8] rounded-2xl p-5 space-y-5 shadow-sm">
                  <div>
                    <p className="text-[10px] font-bold text-[#8c8a86] uppercase">Event Type</p>
                    <p className="font-black text-[#1c1c1c] text-lg">{activeTicket?.event}</p>
                  </div>
                  
                  <div>
                    <p className="text-[10px] font-bold text-[#8c8a86] uppercase mb-2">Requested Menu</p>
                    <ul className="space-y-3">
                      {Array.isArray(activeTicket?.dishes) ? activeTicket.dishes.map((dish, i) => {
                        const parsed = parseDishString(dish);
                        return (
                          <li key={i} className="text-sm bg-[#f5f3ef] p-3 rounded-xl border border-[#e5e0d8]">
                            <span className="font-black text-[#1c1c1c] block mb-1">{parsed.title}</span>
                            {parsed.details && <span className="text-xs font-bold text-[#8c8a86] leading-relaxed block">{parsed.details}</span>}
                          </li>
                        );
                      }) : (
                        <li className="text-sm font-bold text-[#1c1c1c] bg-[#f5f3ef] p-3 rounded-xl border border-[#e5e0d8]">{activeTicket?.dishes}</li>
                      )}
                    </ul>
                  </div>

                  <div>
                    <p className="text-[10px] font-bold text-[#8c8a86] uppercase mb-2">Customer Notes & Logistics</p>
                    <pre className="whitespace-pre-wrap font-medium text-[#1c1c1c] font-sans text-xs leading-relaxed bg-[#f5f3ef] p-4 rounded-xl border border-[#e5e0d8]">
                      {activeTicket?.notes || 'No additional notes provided.'}
                    </pre>
                  </div>
                </div>
              </div>

            </div>
          </div>
        </div>
      )}

      {/* 2. DRAFT QUOTE MODAL */}
      {isQuoteModalOpen && (
        <div className="fixed inset-0 bg-[#1c1c1c]/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 print:hidden">
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
                  <label className="block text-[10px] font-black text-[#8c8a86] mb-1 uppercase tracking-widest">Base Food & Beverage</label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 pl-4 flex items-center text-[#8c8a86] font-bold">GHS</span>
                    <input type="number" required value={quoteDetails.foodCost} onChange={(e) => setQuoteDetails({...quoteDetails, foodCost: e.target.value})} className="w-full pl-14 pr-4 py-3 bg-[#f5f3ef] border border-[#e5e0d8] rounded-xl font-black text-[#1c1c1c] outline-none focus:border-[#e25f38] transition-colors" placeholder="0.00" />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-black text-[#8c8a86] mb-1 uppercase tracking-widest">Logistics (10%)</label>
                    <div className="relative">
                      <span className="absolute inset-y-0 left-0 pl-4 flex items-center text-[#8c8a86] font-bold">GHS</span>
                      <input type="number" required value={quoteDetails.logistics} onChange={(e) => setQuoteDetails({...quoteDetails, logistics: e.target.value})} className="w-full pl-14 pr-4 py-3 bg-[#f5f3ef] border border-[#e5e0d8] rounded-xl font-black text-[#1c1c1c] outline-none focus:border-[#e25f38] transition-colors" placeholder="0.00" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-[10px] font-black text-[#8c8a86] mb-1 uppercase tracking-widest">Discount</label>
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
                <button type="submit" className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-[#e25f38] text-white font-bold rounded-xl shadow-lg hover:bg-[#c9512e] transition-colors">
                  <CheckCircle className="w-4 h-4" /> Save & Update Pipeline
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 3. PDF GENERATOR MODAL UI */}
      {isInvoiceModalOpen && (
        <div className="fixed inset-0 bg-[#1c1c1c]/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 print:hidden">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden animate-in fade-in zoom-in-95 duration-200 p-8 text-center">
            <div className="w-20 h-20 bg-emerald-50 rounded-full flex items-center justify-center mx-auto mb-6 border-4 border-emerald-100">
               <FileText className="w-8 h-8 text-emerald-500" />
            </div>
            <h3 className="font-black text-2xl text-[#1c1c1c] mb-2">Invoice Ready</h3>
            <p className="text-sm font-bold text-[#8c8a86] mb-8 px-4 leading-relaxed">
              A professional Pro-Forma Invoice for {activeTicket?.customer} has been generated. Click below to print or save as PDF.
            </p>
            
            <div className="space-y-3">
              <button 
                onClick={triggerBrowserPrint} 
                className="w-full py-4 bg-[#1c1c1c] text-white font-bold rounded-xl shadow-xl flex items-center justify-center gap-2 active:scale-95 transition-transform"
              >
                <Printer className="w-5 h-5" /> Download / Print PDF
              </button>
              <button 
                onClick={() => setIsInvoiceModalOpen(false)} 
                className="w-full py-4 bg-white border border-[#e5e0d8] text-[#1c1c1c] font-bold rounded-xl hover:bg-[#f5f3ef] transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* THE HIDDEN PRINTABLE INVOICE (ONLY VISIBLE DURING PRINT)      */}
      {/* ------------------------------------------------------------- */}
      {activeTicket && (
        <div className="hidden print:block absolute inset-0 bg-white z-[99999] min-h-screen text-black">
          <div className="flex justify-between items-start border-b-2 border-gray-200 pb-8 mb-8">
             <div>
               <h1 className="text-4xl font-black text-[#e25f38] mb-1 tracking-tighter">B.B.S Eats.</h1>
               <p className="text-sm font-bold text-gray-500 tracking-widest uppercase">Corporate & Event Catering</p>
             </div>
             <div className="text-right">
               <h2 className="text-3xl font-black text-gray-800 mb-1">PRO-FORMA INVOICE</h2>
               <p className="text-sm font-bold text-gray-500">
                 Date: {new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
               </p>
               <p className="text-sm font-bold text-gray-500">
                 Invoice #: INV-{activeTicket.id.split('-')[0].toUpperCase()}
               </p>
             </div>
          </div>

          <div className="grid grid-cols-2 gap-12 mb-12">
            <div>
              <p className="text-xs font-black text-gray-400 uppercase tracking-widest mb-2">Billed To</p>
              <p className="text-xl font-black text-gray-800">{activeTicket.customer}</p>
              <p className="text-sm font-semibold text-gray-600 mt-2 whitespace-pre-wrap">
                {activeTicket.notes.split('---')[1]?.trim() || 'Details on file'}
              </p>
            </div>
            <div>
              <p className="text-xs font-black text-gray-400 uppercase tracking-widest mb-2">Event Details</p>
              <p className="text-xl font-black text-gray-800">{activeTicket.event}</p>
              <div className="mt-2 space-y-1">
                <p className="text-sm font-semibold text-gray-600">
                  <span className="font-bold text-gray-800">Venue:</span> {activeTicket.notes.split('\n')[0].replace('Venue: ', '')}
                </p>
                <p className="text-sm font-semibold text-gray-600">
                  <span className="font-bold text-gray-800">Date:</span> {activeTicket.notes.split('\n')[1].replace('Date: ', '')}
                </p>
              </div>
            </div>
          </div>

          <table className="w-full mb-8 text-left border-collapse">
            <thead>
              <tr className="border-b-2 border-gray-800">
                <th className="py-3 text-xs font-black text-gray-500 uppercase tracking-widest">Description & Services</th>
                <th className="py-3 text-xs font-black text-gray-500 uppercase tracking-widest text-right">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {Array.isArray(activeTicket.dishes) ? activeTicket.dishes.map((dish, i) => {
                const parsed = parseDishString(dish);
                return (
                  <tr key={i}>
                    <td className="py-6 pr-8">
                      <p className="font-black text-gray-800 text-lg mb-1">{parsed.title}</p>
                      <p className="text-sm font-semibold text-gray-500 leading-relaxed">{parsed.details}</p>
                    </td>
                    <td className="py-6 text-right font-black text-gray-800 text-lg align-top pt-7"> — </td>
                  </tr>
                );
              }) : (
                <tr>
                  <td className="py-6 pr-8"><p className="font-black text-gray-800 text-lg">{activeTicket.dishes}</p></td>
                  <td className="py-6 text-right font-black text-gray-800 text-lg align-top"> — </td>
                </tr>
              )}
            </tbody>
          </table>

          <div className="flex justify-end mb-16">
            <div className="w-1/2">
              <div className="flex justify-between py-3 border-b border-gray-200 text-sm font-semibold text-gray-600">
                <span>Base Food & Beverage</span>
                <span>{formatCurrency(Math.round(activeTicket.total / 1.1))}</span>
              </div>
              <div className="flex justify-between py-3 border-b border-gray-200 text-sm font-semibold text-gray-600">
                <span>Logistics & Setup (10%)</span>
                <span>{formatCurrency(Math.round((activeTicket.total / 1.1) * 0.1))}</span>
              </div>
              <div className="flex justify-between py-5 mt-2 bg-gray-50 rounded-xl px-4">
                <span className="font-black text-gray-800 text-xl">Grand Total</span>
                <span className="font-black text-[#e25f38] text-2xl">{formatCurrency(activeTicket.total)}</span>
              </div>
            </div>
          </div>

          <div className="border-t border-gray-200 pt-8 flex justify-between">
            <div className="w-1/2 pr-8">
              <p className="text-xs font-black text-gray-400 uppercase tracking-widest mb-3">Payment Instructions</p>
              <p className="text-sm font-semibold text-gray-600 mb-1">MTN Mobile Money: <span className="font-black text-gray-800">024 228 6269</span></p>
              <p className="text-sm font-semibold text-gray-600">Name: <span className="font-black text-gray-800">MAXWEL YAW AHENKORAH</span></p>
              <p className="text-xs font-medium text-gray-500 italic mt-4">* A 50% non-refundable deposit is required to secure the event date.</p>
            </div>
            <div className="w-1/2 flex flex-col items-end justify-end">
              <div className="w-48 border-b-2 border-gray-800 mb-2"></div>
              <p className="text-xs font-black text-gray-400 uppercase tracking-widest">Authorized Signature</p>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
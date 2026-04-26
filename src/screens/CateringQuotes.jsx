import React, { useState } from 'react';
import { Banknote, CheckCircle, X, GripVertical, Trash2, Loader2, Copy, FileText, Printer, Download, Briefcase, Calendar as CalendarIcon, Save, Circle, AlertCircle } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { formatCurrency } from '../utils/helpers'; // CRITICAL FIX: Consistency

export default function CateringQuotes() {
  const queryClient = useQueryClient();

  const [isQuoteModalOpen, setIsQuoteModalOpen] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isInvoiceModalOpen, setIsInvoiceModalOpen] = useState(false);
  const [activeTicket, setActiveTicket] = useState(null);
  
  const [crmData, setCrmData] = useState({ admin_notes: '', follow_up_date: '' });
  const [quoteDetails, setQuoteDetails] = useState({ foodCost: '', logistics: '', discount: '' });

  const columns = [
    { id: 'new-request', title: 'New Leads', dot: 'text-blue-500' },
    { id: 'negotiation', title: 'In Negotiation', dot: 'text-amber-500' },
    { id: 'awaiting-deposit', title: 'Awaiting Deposit', dot: 'text-purple-500' },
    { id: 'secured', title: 'Secured Contracts', dot: 'text-emerald-500' }
  ];

  const { data: tickets = [], isLoading } = useQuery({
    queryKey: ['cateringRequests'],
    queryFn: async () => {
      const { data, error } = await supabase.from('catering_requests').select('*').order('created_at', { ascending: false });
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
      queryClient.setQueryData(['cateringRequests'], old => old.map(t => t.id === id ? { ...t, ...updates } : t));
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
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['cateringRequests'] })
  });

  const handleDragStart = (e, ticketId) => e.dataTransfer.setData('ticketId', ticketId);
  const handleDragOver = (e) => e.preventDefault();
  const handleDrop = (e, newStatus) => {
    e.preventDefault();
    const ticketId = e.dataTransfer.getData('ticketId');
    if (ticketId) updateMutation.mutate({ id: ticketId, updates: { status: newStatus } });
  };

  const calculateGrandTotal = () => (Number(quoteDetails.foodCost) || 0) + (Number(quoteDetails.logistics) || 0) - (Number(quoteDetails.discount) || 0);

  const openQuoteModal = (ticket) => {
    setActiveTicket(ticket);
    const baseTotal = ticket.total || 0;
    setQuoteDetails({
      foodCost: baseTotal ? String(Math.round(baseTotal / 1.1)) : '', 
      logistics: baseTotal ? String(Math.round((baseTotal / 1.1) * 0.1)) : '',
      discount: '0'
    });
    setIsQuoteModalOpen(true);
  };

  const openCRMSidebar = (ticket) => {
    setActiveTicket(ticket);
    setCrmData({ admin_notes: ticket.admin_notes || '', follow_up_date: ticket.follow_up_date || '' });
    setIsSidebarOpen(true);
  };

  const openInvoiceModal = (ticket) => {
    if (!ticket.total) return alert("You must assign a price in 'Manage Proposal' before generating an invoice.");
    setActiveTicket(ticket);
    setIsInvoiceModalOpen(true);
  };

  const parseDishString = (dishString) => {
    if (!dishString) return { title: 'Unknown', details: null };
    const parts = dishString.split(' — ');
    return { title: parts[0], details: parts[1] || null };
  };

  const getColumnTotal = (statusId) => tickets.filter(t => t.status === statusId).reduce((sum, t) => sum + (Number(t.total) || 0), 0);

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] print:hidden">
        <Loader2 className="w-6 h-6 animate-spin text-gray-400 mb-4" />
        <p className="text-sm font-medium text-gray-500">Loading Enterprise Pipeline...</p>
      </div>
    );
  }

  return (
    <>
      <div className="max-w-full mx-auto flex flex-col h-[calc(100vh-8rem)] print:hidden bg-gray-50 -m-4 md:-m-8 p-4 md:p-8">
        
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 mb-6 shrink-0 w-full border-b border-gray-200 pb-6">
          <div>
            <h2 className="text-2xl font-semibold text-gray-900 tracking-tight">Catering Pipeline</h2>
            <p className="text-sm text-gray-500 mt-1">Manage B2B leads, negotiations, and event contracts.</p>
          </div>
          <div className="flex gap-8 text-sm">
            <div>
              <p className="text-gray-500 font-medium mb-1">Active Pipeline</p>
              <p className="text-xl font-semibold text-gray-900">{formatCurrency(getColumnTotal('negotiation') + getColumnTotal('awaiting-deposit'))}</p>
            </div>
            <div className="w-px bg-gray-200"></div>
            <div>
              <p className="text-gray-500 font-medium mb-1">Closed Won</p>
              <p className="text-xl font-semibold text-emerald-600">{formatCurrency(getColumnTotal('secured'))}</p>
            </div>
          </div>
        </div>

        <div className="flex gap-4 overflow-x-auto pb-4 flex-1 items-start no-scrollbar">
          {columns.map((column) => (
            <div 
              key={column.id} 
              className="bg-gray-100/50 rounded-lg min-w-[320px] max-w-[320px] flex flex-col h-full border border-gray-200 overflow-hidden shrink-0"
              onDragOver={handleDragOver}
              onDrop={(e) => handleDrop(e, column.id)}
            >
              <div className="px-4 py-3 border-b border-gray-200 flex justify-between items-center bg-gray-50/80">
                <div className="flex items-center gap-2">
                  <Circle className={`w-2.5 h-2.5 fill-current ${column.dot}`} />
                  <h3 className="text-sm font-semibold text-gray-700">{column.title}</h3>
                  <span className="bg-gray-200 text-gray-600 text-xs font-medium px-2 py-0.5 rounded-full ml-1">{tickets.filter(t => t.status === column.id).length}</span>
                </div>
                <span className="text-xs font-semibold text-gray-500">{formatCurrency(getColumnTotal(column.id))}</span>
              </div>

              <div className="p-3 flex flex-col gap-3 overflow-y-auto flex-1">
                {tickets.filter((ticket) => ticket.status === column.id).map((ticket) => {
                  const dishesList = Array.isArray(ticket.dishes) ? ticket.dishes : [];

                  return (
                    <div 
                      key={ticket.id} 
                      draggable
                      onDragStart={(e) => handleDragStart(e, ticket.id)}
                      className="bg-white rounded-md p-4 shadow-sm border border-gray-200 hover:shadow transition-shadow cursor-grab active:cursor-grabbing group relative"
                    >
                      <div className="flex justify-between items-start mb-2">
                        <h4 className="font-semibold text-gray-900 text-sm leading-tight pr-6 truncate">{ticket.customer}</h4>
                        <GripVertical className="w-4 h-4 text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity absolute right-3 top-4" />
                      </div>
                      
                      <p className="text-xs font-medium text-gray-500 mb-3">{ticket.event}</p>
                      
                      {ticket.follow_up_date && (
                        <div className="inline-flex items-center gap-1 bg-gray-100 text-gray-600 px-2 py-1 rounded text-[10px] font-semibold uppercase tracking-wider mb-3">
                          <CalendarIcon className="w-3 h-3" /> Follow up: {new Date(ticket.follow_up_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                        </div>
                      )}
                      
                      <div className="text-xs text-gray-600 mb-4 space-y-1 border-l-2 border-gray-200 pl-2">
                        {dishesList.slice(0, 2).map((dish, index) => (
                          <p key={index} className="truncate">{parseDishString(dish).title}</p>
                        ))}
                        {dishesList.length > 2 && <p className="text-gray-400 italic">+{dishesList.length - 2} more items</p>}
                      </div>
                      
                      <div className="flex justify-between items-center pt-3 border-t border-gray-100">
                        <div className="font-semibold text-gray-900 text-sm">
                          {ticket.total ? formatCurrency(ticket.total) : <span className="text-gray-400 text-xs font-medium italic flex items-center gap-1"><AlertCircle className="w-3 h-3"/> Pricing Pending</span>}
                        </div>
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button onClick={() => openInvoiceModal(ticket)} className="p-1.5 text-gray-400 hover:bg-gray-100 hover:text-emerald-600 rounded transition-colors" title="Download PDF Invoice"><Download className="w-4 h-4" /></button>
                          <button onClick={() => openQuoteModal(ticket)} className="p-1.5 text-gray-400 hover:bg-gray-100 hover:text-blue-600 rounded transition-colors" title="Manage Price"><Banknote className="w-4 h-4" /></button>
                          <button onClick={() => openCRMSidebar(ticket)} className="p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-900 rounded transition-colors" title="Open CRM"><Briefcase className="w-4 h-4" /></button>
                          <button onClick={() => deleteMutation.mutate(ticket.id)} className="p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600 rounded transition-colors" title="Delete"><Trash2 className="w-4 h-4" /></button>
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

      {isSidebarOpen && (
        <div className="fixed inset-0 z-50 flex justify-end bg-gray-900/20 backdrop-blur-sm print:hidden">
          <div className="absolute inset-0" onClick={() => setIsSidebarOpen(false)}></div>
          
          <div className="w-full max-w-md bg-white h-full shadow-2xl relative flex flex-col animate-in slide-in-from-right duration-200 border-l border-gray-200">
            <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center bg-gray-50/50 shrink-0">
              <div>
                <h3 className="font-semibold text-lg text-gray-900">Lead CRM</h3>
                <p className="text-sm text-gray-500">{activeTicket?.customer}</p>
              </div>
              <button onClick={() => setIsSidebarOpen(false)} className="text-gray-400 hover:text-gray-600 transition-colors p-1.5 hover:bg-gray-100 rounded-md">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto flex-1 space-y-8">
              
              <div>
                <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Admin Actions</h4>
                <div className="space-y-4">
                  <div>
                    <label className="text-sm font-medium text-gray-700 mb-1.5 block">Next Follow-Up Date</label>
                    <input 
                      type="date" 
                      value={crmData.follow_up_date} 
                      onChange={(e) => setCrmData({...crmData, follow_up_date: e.target.value})}
                      className="w-full bg-white border border-gray-300 focus:border-gray-500 focus:ring-1 focus:ring-gray-500 rounded-md p-2.5 text-sm text-gray-900 outline-none transition-all shadow-sm"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-700 mb-1.5 block">Internal Negotiation Notes</label>
                    <textarea 
                      value={crmData.admin_notes} 
                      onChange={(e) => setCrmData({...crmData, admin_notes: e.target.value})}
                      placeholder="Record budget constraints, contact attempts, or custom requests here..."
                      className="w-full bg-white border border-gray-300 focus:border-gray-500 focus:ring-1 focus:ring-gray-500 rounded-md p-3 text-sm text-gray-900 outline-none transition-all min-h-[120px] resize-none shadow-sm"
                    />
                  </div>
                  <button 
                    onClick={() => {
                      updateMutation.mutate({ id: activeTicket.id, updates: { admin_notes: crmData.admin_notes, follow_up_date: crmData.follow_up_date } });
                      setIsSidebarOpen(false);
                    }}
                    className="w-full py-2.5 bg-gray-900 text-white text-sm font-semibold rounded-md hover:bg-black transition-colors shadow-sm"
                  >
                    Save CRM Data
                  </button>
                </div>
              </div>

              <div className="border-t border-gray-200 pt-6">
                <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4">Original Request Data</h4>
                <div className="space-y-6">
                  <div>
                    <p className="text-xs font-medium text-gray-500 mb-1">Event Type</p>
                    <p className="text-sm font-medium text-gray-900">{activeTicket?.event}</p>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-gray-500 mb-2">Requested Menu</p>
                    <ul className="space-y-2">
                      {Array.isArray(activeTicket?.dishes) ? activeTicket.dishes.map((dish, i) => {
                        const parsed = parseDishString(dish);
                        return (
                          <li key={i} className="text-sm bg-gray-50 p-3 rounded-md border border-gray-100">
                            <span className="font-semibold text-gray-900 block mb-1">{parsed.title}</span>
                            {parsed.details && <span className="text-xs text-gray-500 block">{parsed.details}</span>}
                          </li>
                        );
                      }) : (
                        <li className="text-sm text-gray-900 bg-gray-50 p-3 rounded-md border border-gray-100">{activeTicket?.dishes}</li>
                      )}
                    </ul>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-gray-500 mb-2">Customer Logistics & Contacts</p>
                    <pre className="whitespace-pre-wrap font-sans text-sm text-gray-700 bg-gray-50 p-4 rounded-md border border-gray-100 leading-relaxed">
                      {activeTicket?.notes || 'No additional notes provided.'}
                    </pre>
                  </div>
                </div>
              </div>

            </div>
          </div>
        </div>
      )}

      {isQuoteModalOpen && (
        <div className="fixed inset-0 bg-gray-900/20 backdrop-blur-sm z-50 flex items-center justify-center p-4 print:hidden">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200 border border-gray-200">
            <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center bg-gray-50/50">
              <h3 className="font-semibold text-gray-900">Set Proposal Price</h3>
              <button onClick={() => setIsQuoteModalOpen(false)} className="text-gray-400 hover:text-gray-600 transition-colors"><X className="w-5 h-5" /></button>
            </div>
            
            <form onSubmit={(e) => { e.preventDefault(); const total = calculateGrandTotal(); if (total > 0) { updateMutation.mutate({ id: activeTicket.id, updates: { total: total, status: 'awaiting-deposit' } }); setIsQuoteModalOpen(false); } }} className="p-6">
              <div className="space-y-4 mb-6">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Base Food & Beverage</label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-gray-500 text-sm">GHS</span>
                    <input type="number" required value={quoteDetails.foodCost} onChange={(e) => setQuoteDetails({...quoteDetails, foodCost: e.target.value})} className="w-full pl-12 pr-3 py-2 bg-white border border-gray-300 rounded-md text-sm text-gray-900 focus:ring-1 focus:ring-gray-500 focus:border-gray-500 outline-none" placeholder="0.00" />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Logistics (10%)</label>
                    <div className="relative">
                      <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-gray-500 text-sm">GHS</span>
                      <input type="number" required value={quoteDetails.logistics} onChange={(e) => setQuoteDetails({...quoteDetails, logistics: e.target.value})} className="w-full pl-12 pr-3 py-2 bg-white border border-gray-300 rounded-md text-sm text-gray-900 focus:ring-1 focus:ring-gray-500 focus:border-gray-500 outline-none" placeholder="0.00" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Discount</label>
                    <div className="relative">
                      <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-gray-500 text-sm">GHS</span>
                      <input type="number" value={quoteDetails.discount} onChange={(e) => setQuoteDetails({...quoteDetails, discount: e.target.value})} className="w-full pl-12 pr-3 py-2 bg-white border border-gray-300 rounded-md text-sm text-gray-900 focus:ring-1 focus:ring-gray-500 focus:border-gray-500 outline-none" placeholder="0.00" />
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-gray-50 p-4 rounded-md mb-6 border border-gray-200 flex justify-between items-center">
                <p className="text-sm font-medium text-gray-600">Grand Total</p>
                <h3 className="text-xl font-semibold text-gray-900">{formatCurrency(calculateGrandTotal())}</h3>
              </div>

              <button type="submit" className="w-full flex items-center justify-center gap-2 py-2.5 bg-gray-900 text-white text-sm font-semibold rounded-md hover:bg-black transition-colors shadow-sm">
                Save & Request Deposit
              </button>
            </form>
          </div>
        </div>
      )}

      {isInvoiceModalOpen && (
        <div className="fixed inset-0 bg-gray-900/20 backdrop-blur-sm z-50 flex items-center justify-center p-4 print:hidden">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-sm overflow-hidden animate-in fade-in zoom-in-95 duration-200 p-8 text-center border border-gray-200">
            <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4 border border-gray-100">
               <FileText className="w-6 h-6 text-gray-600" />
            </div>
            <h3 className="font-semibold text-lg text-gray-900 mb-2">Invoice Ready</h3>
            <p className="text-sm text-gray-500 mb-6">Pro-Forma Invoice for {activeTicket?.customer} generated successfully.</p>
            
            <div className="space-y-2.5">
              <button onClick={() => window.print()} className="w-full py-2.5 bg-gray-900 text-white text-sm font-semibold rounded-md shadow-sm flex items-center justify-center gap-2 hover:bg-black transition-colors">
                <Printer className="w-4 h-4" /> Download PDF
              </button>
              <button onClick={() => setIsInvoiceModalOpen(false)} className="w-full py-2.5 bg-white border border-gray-300 text-gray-700 text-sm font-semibold rounded-md hover:bg-gray-50 transition-colors">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {activeTicket && (
        <div className="hidden print:block absolute inset-0 bg-white z-[99999] min-h-screen text-black">
          <div className="flex justify-between items-start border-b-2 border-gray-200 pb-8 mb-8">
             <div>
               <h1 className="text-4xl font-black text-[#e25f38] mb-1 tracking-tighter">B.B.S Eats.</h1>
               <p className="text-sm font-bold text-gray-500 tracking-widest uppercase">Corporate & Event Catering</p>
             </div>
             <div className="text-right">
               <h2 className="text-3xl font-black text-gray-800 mb-1">PRO-FORMA INVOICE</h2>
               <p className="text-sm font-bold text-gray-500">Date: {new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
               <p className="text-sm font-bold text-gray-500">Invoice #: INV-{activeTicket.id.split('-')[0].toUpperCase()}</p>
             </div>
          </div>

          <div className="grid grid-cols-2 gap-12 mb-12">
            <div>
              <p className="text-xs font-black text-gray-400 uppercase tracking-widest mb-2">Billed To</p>
              <p className="text-xl font-black text-gray-800">{activeTicket.customer}</p>
              <p className="text-sm font-semibold text-gray-600 mt-2 whitespace-pre-wrap">{activeTicket.notes.split('---')[1]?.trim() || 'Details on file'}</p>
            </div>
            <div>
              <p className="text-xs font-black text-gray-400 uppercase tracking-widest mb-2">Event Details</p>
              <p className="text-xl font-black text-gray-800">{activeTicket.event}</p>
              <div className="mt-2 space-y-1">
                <p className="text-sm font-semibold text-gray-600"><span className="font-bold text-gray-800">Venue:</span> {activeTicket.notes.split('\n')[0].replace('Venue: ', '')}</p>
                <p className="text-sm font-semibold text-gray-600"><span className="font-bold text-gray-800">Date:</span> {activeTicket.notes.split('\n')[1].replace('Date: ', '')}</p>
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
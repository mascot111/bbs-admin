import React, { useMemo, useState } from 'react';
import {
  AlertCircle,
  Banknote,
  Briefcase,
  Calendar as CalendarIcon,
  Check,
  CheckCircle,
  Download,
  Eye,
  FileText,
  Loader2,
  Printer,
  Save,
  Trash2,
  X,
  ChevronDown,
  Clock
} from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { formatCurrency } from '../utils/helpers';

const PIPELINE_STAGES = [
  { id: 'All', label: 'All Leads' },
  { id: 'new-request', label: 'New Leads', dot: 'bg-blue-500' },
  { id: 'negotiation', label: 'In Negotiation', dot: 'bg-amber-500' },
  { id: 'awaiting-deposit', label: 'Awaiting Deposit', dot: 'bg-purple-500' },
  { id: 'secured', label: 'Secured Contracts', dot: 'bg-emerald-500' }
];

// UPGRADED PARSER: Extracts the new Price payload
function parseDishString(dishString) {
  if (!dishString || typeof dishString !== 'string') return { title: 'Unknown Item', price: null, details: null };
  
  // New Format Handler (Name || Price || Details)
  if (dishString.includes(' || ')) {
    const parts = dishString.split(' || ');
    return { 
      title: parts[0]?.trim(), 
      price: Number(parts[1]) || null, 
      details: parts[2]?.trim() 
    };
  }

  // Legacy Format Handler (Fallback for older quotes)
  const normalized = dishString.replace(/â€”/g, '—').replace(/â€¢/g, '•');
  const parts = normalized.split(/\s[—-]\s/);
  return { title: (parts[0] || 'Unknown Item').trim(), price: null, details: parts[1] ? parts[1].trim() : null };
}

function getNotesLines(notes) {
  if (!notes || typeof notes !== 'string') return [];
  return notes.split('\n').map((line) => line.trim()).filter(Boolean);
}

function getInvoiceMeta(notes) {
  const safeNotes = typeof notes === 'string' ? notes : '';
  const lines = getNotesLines(safeNotes);
  const venueLine = lines.find((line) => /^venue:/i.test(line));
  const dateLine = lines.find((line) => /^date:/i.test(line));
  const venue = venueLine ? venueLine.replace(/^venue:\s*/i, '') : 'Details on file';
  const date = dateLine ? dateLine.replace(/^date:\s*/i, '') : 'Details on file';
  const billingExtra = safeNotes.includes('---') ? safeNotes.split('---')[1]?.trim() : safeNotes;
  return { venue, date, billingExtra: billingExtra || 'Details on file' };
}

function getFollowUpBadge(ticket) {
  if (!ticket?.follow_up_date) return null;
  const now = new Date();
  const dueDate = new Date(ticket.follow_up_date);
  if (Number.isNaN(dueDate.getTime())) return null;
  now.setHours(0, 0, 0, 0);
  dueDate.setHours(0, 0, 0, 0);
  if (dueDate.getTime() < now.getTime()) return { label: 'Overdue', tone: 'text-red-600 bg-red-50 border-red-200' };
  if (dueDate.getTime() === now.getTime()) return { label: 'Due Today', tone: 'text-amber-700 bg-amber-50 border-amber-200' };
  return { label: 'Scheduled', tone: 'text-amber-600 bg-amber-50 border-amber-200' };
}

export default function CateringQuotes() {
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState('All');
  const [isQuoteModalOpen, setIsQuoteModalOpen] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isInvoiceModalOpen, setIsInvoiceModalOpen] = useState(false);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [activeTicket, setActiveTicket] = useState(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [crmData, setCrmData] = useState({ admin_notes: '', follow_up_date: '' });
  const [quoteDetails, setQuoteDetails] = useState({ foodCost: '', logistics: '', discount: '' });

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
      setErrorMessage('');
      await queryClient.cancelQueries({ queryKey: ['cateringRequests'] });
      const previous = queryClient.getQueryData(['cateringRequests']) || [];
      queryClient.setQueryData(['cateringRequests'], (old = []) => old.map((t) => (t.id === id ? { ...t, ...updates } : t)));
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) queryClient.setQueryData(['cateringRequests'], context.previous);
      setErrorMessage('Could not save changes. Please try again.');
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['cateringRequests'] })
  });

  const deleteMutation = useMutation({
    mutationFn: async (id) => {
      const { error } = await supabase.from('catering_requests').delete().eq('id', id);
      if (error) throw error;
    },
    onMutate: () => setErrorMessage(''),
    onError: () => setErrorMessage('Could not delete this lead. Please try again.'),
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['cateringRequests'] })
  });

  const totalsByColumn = useMemo(() => {
    return PIPELINE_STAGES.reduce((acc, stage) => {
      if (stage.id === 'All') return acc;
      const scoped = tickets.filter((ticket) => ticket.status === stage.id);
      acc[stage.id] = {
        count: scoped.length,
        total: scoped.reduce((sum, ticket) => sum + (Number(ticket.total) || 0), 0)
      };
      return acc;
    }, {});
  }, [tickets]);

  const activePipelineTotal = (totalsByColumn.negotiation?.total || 0) + (totalsByColumn['awaiting-deposit']?.total || 0);
  const closedWonTotal = totalsByColumn.secured?.total || 0;

  const handleStatusChange = (ticket, newStatus) => {
    if (newStatus === 'awaiting-deposit' && !(Number(ticket.total) > 0)) {
      setErrorMessage(`Assign a final price to ${ticket.customer} before requesting a deposit.`);
      return;
    }
    updateMutation.mutate({ id: ticket.id, updates: { status: newStatus } });
  };

  const openQuoteModal = (ticket) => {
    setErrorMessage('');
    setActiveTicket(ticket);
    const currentTotal = Number(ticket.total) || 0;
    const baseline = currentTotal ? currentTotal / 1.1 : 0;
    setQuoteDetails({
      foodCost: baseline ? String(Math.round(baseline)) : '',
      logistics: baseline ? String(Math.round(baseline * 0.1)) : '',
      discount: '0'
    });
    setIsQuoteModalOpen(true);
  };

  const openCRMSidebar = (ticket) => {
    setErrorMessage('');
    setActiveTicket(ticket);
    setCrmData({
      admin_notes: ticket.admin_notes || '',
      follow_up_date: ticket.follow_up_date || ''
    });
    setIsSidebarOpen(true);
  };

  const openDetailsModal = (ticket) => {
    setErrorMessage('');
    setActiveTicket(ticket);
    setIsDetailsModalOpen(true);
  };

  const openInvoiceModal = (ticket) => {
    if (!(Number(ticket.total) > 0)) {
      setErrorMessage("Assign a final price in 'Manage Price' before generating an invoice.");
      return;
    }
    setErrorMessage('');
    setActiveTicket(ticket);
    setIsInvoiceModalOpen(true);
  };

  const calculateGrandTotal = () => {
    const food = Number(quoteDetails.foodCost) || 0;
    const logistics = Number(quoteDetails.logistics) || 0;
    const discount = Number(quoteDetails.discount) || 0;
    return food + logistics - discount;
  };

  const handleDelete = (ticket) => {
    const confirmed = window.confirm(`Delete lead for ${ticket.customer}? This cannot be undone.`);
    if (!confirmed) return;
    deleteMutation.mutate(ticket.id);
  };

  const filteredTickets = useMemo(() => {
    if (activeTab === 'All') return tickets;
    return tickets.filter(t => t.status === activeTab);
  }, [tickets, activeTab]);

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] print:hidden">
        <Loader2 className="w-8 h-8 animate-spin text-[#e25f38] mb-4" />
        <p className="font-bold text-[#8c8a86]">Loading B2B pipeline...</p>
      </div>
    );
  }

  const invoiceMeta = getInvoiceMeta(activeTicket?.notes);
  const invoiceTotal = Number(activeTicket?.total) || 0;
  const invoiceBase = invoiceTotal ? Math.round(invoiceTotal / 1.1) : 0;
  const invoiceLogistics = invoiceTotal ? Math.round(invoiceBase * 0.1) : 0;

  return (
    <>
      <div className="max-w-6xl mx-auto space-y-6 pb-24 print:hidden animate-in fade-in duration-300">
        
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 mb-2 shrink-0 w-full">
          <div>
            <h2 className="text-3xl font-black text-[#1c1c1c] tracking-tight">Catering CRM</h2>
            <p className="text-[#8c8a86] font-bold text-sm mt-1">Manage corporate leads, proposals, and deposits.</p>
          </div>
          <div className="bg-white px-6 py-4 rounded-2xl border border-[#e5e0d8] shadow-sm flex justify-between md:justify-start gap-6 md:gap-8 text-sm font-bold text-[#1c1c1c] w-full md:w-auto">
            <div className="flex flex-col">
              <span className="text-[#8c8a86] text-[10px] uppercase tracking-widest mb-1">Active Pipeline</span>
              <span className="text-xl font-black text-[#1c1c1c] leading-none">{formatCurrency(activePipelineTotal)}</span>
            </div>
            <div className="w-px bg-[#e5e0d8]"></div>
            <div className="flex flex-col items-end md:items-start">
              <span className="text-[#8c8a86] text-[10px] uppercase tracking-widest mb-1">Closed Won</span>
              <span className="text-emerald-500 text-xl font-black leading-none">{formatCurrency(closedWonTotal)}</span>
            </div>
          </div>
        </div>

        {errorMessage && (
          <div className="flex items-center gap-3 p-4 rounded-2xl border border-red-200 bg-red-50 text-red-600 text-sm font-bold shadow-sm animate-in slide-in-from-top-2">
            <AlertCircle className="w-5 h-5 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        <div className="flex gap-2 overflow-x-auto no-scrollbar pb-2">
          {PIPELINE_STAGES.map((stage) => {
            const isActive = activeTab === stage.id;
            const count = stage.id === 'All' ? tickets.length : (totalsByColumn[stage.id]?.count || 0);
            return (
              <button 
                key={stage.id} 
                onClick={() => setActiveTab(stage.id)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-sm whitespace-nowrap transition-all ${
                  isActive ? 'bg-[#1c1c1c] text-white shadow-md' : 'bg-white border border-[#e5e0d8] text-[#8c8a86] hover:bg-[#f5f3ef]'
                }`}
              >
                {stage.dot && <span className={`w-2 h-2 rounded-full ${stage.dot}`}></span>}
                {stage.label}
                <span className={`px-2 py-0.5 rounded-md text-[10px] ml-1 ${isActive ? 'bg-white/20 text-white' : 'bg-[#f5f3ef] text-[#1c1c1c]'}`}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        <div className="space-y-4">
          {filteredTickets.length === 0 ? (
            <div className="p-16 flex flex-col items-center justify-center text-center bg-white border border-[#e5e0d8] border-dashed rounded-3xl">
              <Briefcase className="w-12 h-12 text-[#cfccc6] mb-4" />
              <h3 className="text-lg font-black text-[#1c1c1c] mb-1">No leads found</h3>
              <p className="text-sm font-bold text-[#8c8a86]">Your pipeline for this stage is currently empty.</p>
            </div>
          ) : (
            filteredTickets.map((ticket) => {
              const followUpState = getFollowUpBadge(ticket);
              const isPending = !ticket.total;

              return (
                <div key={ticket.id} className="bg-white rounded-3xl border border-[#e5e0d8] p-5 shadow-sm hover:shadow-md hover:border-[#1c1c1c]/20 transition-all flex flex-col lg:flex-row justify-between lg:items-center gap-6">
                  
                  <div className="flex-1 w-full min-w-0">
                    <div className="flex items-center gap-3 mb-3 flex-wrap">
                      <div className="relative">
                        <select
                          value={ticket.status}
                          onChange={(e) => handleStatusChange(ticket, e.target.value)}
                          className={`appearance-none font-black text-[10px] uppercase tracking-wider px-3 py-1.5 pr-8 rounded-lg border outline-none cursor-pointer transition-colors ${
                            ticket.status === 'new-request' ? 'bg-blue-50 text-blue-600 border-blue-200' :
                            ticket.status === 'negotiation' ? 'bg-amber-50 text-amber-600 border-amber-200' :
                            ticket.status === 'awaiting-deposit' ? 'bg-purple-50 text-purple-600 border-purple-200' :
                            'bg-emerald-50 text-emerald-600 border-emerald-200'
                          }`}
                        >
                          <option value="new-request">New Request</option>
                          <option value="negotiation">In Negotiation</option>
                          <option value="awaiting-deposit">Awaiting Deposit</option>
                          <option value="secured">Secured</option>
                        </select>
                        <ChevronDown className="w-3.5 h-3.5 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none opacity-50" />
                      </div>

                      {followUpState && (
                        <span className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider border ${followUpState.tone}`}>
                          <CalendarIcon className="w-3 h-3" />
                          {followUpState.label}: {new Date(ticket.follow_up_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                        </span>
                      )}
                    </div>

                    <h3 className="text-xl font-black text-[#1c1c1c] leading-tight truncate mb-1">{ticket.customer}</h3>
                    <p className="text-sm font-bold text-[#e25f38] mb-3">{ticket.event}</p>
                    
                    <p className="text-xs font-medium text-[#8c8a86] line-clamp-1 border-l-2 border-[#e5e0d8] pl-3">
                      {Array.isArray(ticket.dishes) ? parseDishString(ticket.dishes[0]).title : ticket.dishes}
                      {Array.isArray(ticket.dishes) && ticket.dishes.length > 1 && <span className="italic ml-2">(+{ticket.dishes.length - 1} items)</span>}
                    </p>
                  </div>

                  <div className="flex flex-row lg:flex-col justify-between lg:justify-center items-center lg:items-end w-full lg:w-auto gap-4 lg:gap-3 border-t lg:border-t-0 border-[#e5e0d8] pt-4 lg:pt-0">
                    
                    <div className="text-left lg:text-right">
                      <p className="text-[10px] font-black uppercase text-[#8c8a86] tracking-widest mb-0.5">Quote Value</p>
                      <p className={`font-black text-2xl tracking-tight ${isPending ? 'text-[#8c8a86]' : 'text-[#1c1c1c]'}`}>
                        {isPending ? 'Pending' : formatCurrency(ticket.total)}
                      </p>
                    </div>

                    {/* OVERFLOW FIX: Added flex-wrap and responsive padding */}
                    <div className="flex items-center gap-1.5 flex-wrap justify-end opacity-100 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity">
                      <button onClick={() => openDetailsModal(ticket)} className="p-2 md:p-2.5 bg-[#f5f3ef] text-[#8c8a86] hover:bg-[#1c1c1c] hover:text-white rounded-xl transition-colors" title="View Full Details">
                        <Eye className="w-4 h-4" />
                      </button>
                      <button onClick={() => openCRMSidebar(ticket)} className="p-2 md:p-2.5 bg-[#f5f3ef] text-[#8c8a86] hover:bg-[#1c1c1c] hover:text-white rounded-xl transition-colors" title="Open CRM">
                        <Briefcase className="w-4 h-4" />
                      </button>
                      <button onClick={() => openQuoteModal(ticket)} className="p-2 md:p-2.5 bg-[#f5f3ef] text-[#8c8a86] hover:bg-amber-100 hover:text-amber-600 rounded-xl transition-colors" title="Manage Price">
                        <Banknote className="w-4 h-4" />
                      </button>
                      <button onClick={() => openInvoiceModal(ticket)} className="p-2 md:p-2.5 bg-[#f5f3ef] text-[#8c8a86] hover:bg-emerald-100 hover:text-emerald-600 rounded-xl transition-colors" title="Download PDF Invoice">
                        <Download className="w-4 h-4" />
                      </button>
                      <button onClick={() => handleDelete(ticket)} className="p-2 md:p-2.5 bg-[#f5f3ef] text-[#8c8a86] hover:bg-red-100 hover:text-red-600 rounded-xl transition-colors ml-1" title="Delete">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>

                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* UPGRADED LEAD DETAILS MODAL WITH TIMESTAMP & INDIVIDUAL PRICES */}
      {isDetailsModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#1c1c1c]/50 backdrop-blur-sm print:hidden">
          <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-[420px] overflow-hidden animate-in fade-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
            <div className="px-6 py-6 border-b border-[#e5e0d8] flex justify-between items-start bg-[#fdfbf7] shrink-0">
              <div>
                <h3 className="font-black text-xl text-[#1c1c1c]">Lead Details</h3>
                <p className="text-sm font-bold text-[#8c8a86]">{activeTicket?.customer}</p>
                <p className="text-[10px] font-bold text-[#8c8a86] uppercase tracking-widest mt-2 flex items-center gap-1.5">
                  <Clock className="w-3 h-3" /> Submitted: {new Date(activeTicket?.created_at).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
              <button onClick={() => setIsDetailsModalOpen(false)} className="text-[#8c8a86] hover:text-[#1c1c1c] transition-colors p-2 bg-white rounded-full shadow-sm border border-[#e5e0d8]">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-8 flex-1">
              <div>
                <h4 className="text-[10px] font-black text-[#8c8a86] uppercase tracking-widest mb-1">Event Information</h4>
                <p className="font-black text-[#1c1c1c] text-xl leading-tight">{activeTicket?.event || 'Not specified'}</p>
              </div>

              <div>
                <h4 className="text-[10px] font-black text-[#8c8a86] uppercase tracking-widest mb-3">Menu Selection</h4>
                <div className="space-y-3">
                  {Array.isArray(activeTicket?.dishes) ? (
                    activeTicket.dishes.map((dish, index) => {
                      const parsed = parseDishString(dish);
                      return (
                        <div key={index} className="flex justify-between items-center gap-3 bg-[#fdfbf7] border border-[#e5e0d8] p-4 rounded-2xl shadow-sm">
                          <div className="flex items-start gap-3">
                            <div className="w-6 h-6 rounded-full border-[1.5px] border-[#e25f38] flex items-center justify-center shrink-0 mt-0.5">
                              <Check className="w-3.5 h-3.5 text-[#e25f38] stroke-[3]" />
                            </div>
                            <div>
                              <span className="font-bold text-[#1c1c1c] text-[13px] block">{parsed.title}</span>
                              {parsed.details && <span className="text-xs font-medium text-[#8c8a86] block mt-0.5">{parsed.details}</span>}
                            </div>
                          </div>
                          {parsed.price !== null && (
                            <span className="font-black text-[#1c1c1c] shrink-0 pl-2">{formatCurrency(parsed.price)}</span>
                          )}
                        </div>
                      );
                    })
                  ) : (
                    <div className="flex items-center gap-3 bg-[#fdfbf7] border border-[#e5e0d8] p-4 rounded-2xl shadow-sm">
                      <span className="font-bold text-[#1c1c1c] text-[13px]">{activeTicket?.dishes || 'No menu selected'}</span>
                    </div>
                  )}
                </div>
              </div>

              <div>
                <h4 className="text-[10px] font-black text-[#8c8a86] uppercase tracking-widest mb-3">CRM Notes & Contacts</h4>
                <div className="bg-[#fdfbf7] border border-[#e5e0d8] p-5 rounded-2xl shadow-sm">
                  <pre className="whitespace-pre-wrap font-bold text-[#1c1c1c] font-sans text-[13px] leading-relaxed">
                    {activeTicket?.admin_notes || activeTicket?.notes || 'No additional details provided.'}
                  </pre>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* CRM WORKSPACE MODAL */}
      {isSidebarOpen && (
        <div className="fixed inset-0 z-50 flex justify-end bg-[#1c1c1c]/50 backdrop-blur-sm print:hidden">
          <div className="absolute inset-0" onClick={() => setIsSidebarOpen(false)}></div>
          <div className="w-full max-w-md bg-[#fdfbf7] h-full shadow-2xl relative flex flex-col animate-in slide-in-from-right duration-300">
            <div className="px-6 py-5 border-b border-[#e5e0d8] flex justify-between items-center bg-white shrink-0">
              <div>
                <h3 className="font-black text-xl text-[#1c1c1c]">Lead CRM Workspace</h3>
                <p className="text-sm font-bold text-[#8c8a86]">{activeTicket?.customer}</p>
              </div>
              <button onClick={() => setIsSidebarOpen(false)} className="text-[#8c8a86] hover:text-[#1c1c1c] transition-colors p-2 bg-[#f5f3ef] rounded-full shadow-sm border border-[#e5e0d8]">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto flex-1 space-y-6">
              <div className="space-y-4 bg-white p-5 rounded-2xl border border-[#e5e0d8] shadow-sm">
                <div>
                  <label className="text-[10px] font-black text-[#1c1c1c] uppercase tracking-widest mb-2 flex items-center gap-1.5">
                    <CalendarIcon className="w-3.5 h-3.5 text-[#e25f38]" />
                    Next Follow-Up Date
                  </label>
                  <input
                    type="date"
                    value={crmData.follow_up_date}
                    onChange={(event) => setCrmData({ ...crmData, follow_up_date: event.target.value })}
                    className="w-full bg-[#f5f3ef] border border-[#e5e0d8] focus:border-[#e25f38] rounded-xl p-3 font-bold text-[#1c1c1c] outline-none transition-colors"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-black text-[#1c1c1c] uppercase tracking-widest mb-2 block">Internal Admin Notes</label>
                  <textarea
                    value={crmData.admin_notes}
                    onChange={(event) => setCrmData({ ...crmData, admin_notes: event.target.value })}
                    placeholder="Record negotiation details, budget constraints, or competitor quotes here..."
                    className="w-full bg-[#f5f3ef] border border-[#e5e0d8] focus:border-[#e25f38] rounded-xl p-3 font-bold text-[#1c1c1c] outline-none transition-colors min-h-[120px] resize-none"
                  />
                </div>

                <button
                  onClick={() => {
                    if (!activeTicket?.id) return;
                    updateMutation.mutate({
                      id: activeTicket.id,
                      updates: { admin_notes: crmData.admin_notes, follow_up_date: crmData.follow_up_date }
                    });
                    setIsSidebarOpen(false);
                  }}
                  disabled={updateMutation.isPending}
                  className="w-full py-3.5 bg-[#1c1c1c] text-white font-bold rounded-xl flex items-center justify-center gap-2 hover:bg-black transition-colors shadow-lg active:scale-95 mt-2 disabled:opacity-60"
                >
                  <Save className="w-4 h-4" />
                  {updateMutation.isPending ? 'Saving...' : 'Save CRM Data'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* FINANCIAL PROPOSAL MODAL */}
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

            <form
              onSubmit={(event) => {
                event.preventDefault();
                const food = Number(quoteDetails.foodCost);
                const logistics = Number(quoteDetails.logistics);
                const discount = Number(quoteDetails.discount || 0);
                if (food < 0 || logistics < 0 || discount < 0) {
                  setErrorMessage('Financial fields cannot be negative.');
                  return;
                }
                const total = calculateGrandTotal();
                if (total <= 0) {
                  setErrorMessage('Grand total must be greater than zero.');
                  return;
                }
                if (!activeTicket?.id) return;
                updateMutation.mutate({
                  id: activeTicket.id,
                  updates: { total, status: 'awaiting-deposit' }
                });
                setIsQuoteModalOpen(false);
              }}
              className="p-6"
            >
              <div className="space-y-4 mb-8">
                <div>
                  <label className="block text-[10px] font-black text-[#8c8a86] mb-1 uppercase tracking-widest">Base Food & Beverage</label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 pl-4 flex items-center text-[#8c8a86] font-bold">GHS</span>
                    <input
                      type="number"
                      min="0"
                      required
                      value={quoteDetails.foodCost}
                      onChange={(event) => setQuoteDetails({ ...quoteDetails, foodCost: event.target.value })}
                      className="w-full pl-14 pr-4 py-3 bg-[#f5f3ef] border border-[#e5e0d8] rounded-xl font-black text-[#1c1c1c] outline-none focus:border-[#e25f38] transition-colors"
                      placeholder="0.00"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-black text-[#8c8a86] mb-1 uppercase tracking-widest">Logistics</label>
                    <div className="relative">
                      <span className="absolute inset-y-0 left-0 pl-4 flex items-center text-[#8c8a86] font-bold">GHS</span>
                      <input
                        type="number"
                        min="0"
                        required
                        value={quoteDetails.logistics}
                        onChange={(event) => setQuoteDetails({ ...quoteDetails, logistics: event.target.value })}
                        className="w-full pl-14 pr-4 py-3 bg-[#f5f3ef] border border-[#e5e0d8] rounded-xl font-black text-[#1c1c1c] outline-none focus:border-[#e25f38] transition-colors"
                        placeholder="0.00"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-[10px] font-black text-[#8c8a86] mb-1 uppercase tracking-widest">Discount</label>
                    <div className="relative">
                      <span className="absolute inset-y-0 left-0 pl-4 flex items-center text-[#8c8a86] font-bold">GHS</span>
                      <input
                        type="number"
                        min="0"
                        value={quoteDetails.discount}
                        onChange={(event) => setQuoteDetails({ ...quoteDetails, discount: event.target.value })}
                        className="w-full pl-14 pr-4 py-3 bg-[#f5f3ef] border border-[#e5e0d8] rounded-xl font-black text-[#1c1c1c] outline-none focus:border-[#e25f38] transition-colors"
                        placeholder="0.00"
                      />
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

              <button type="submit" className="w-full flex items-center justify-center gap-2 px-4 py-4 bg-[#e25f38] text-white font-bold rounded-xl shadow-lg hover:bg-[#c9512e] transition-colors active:scale-95">
                <CheckCircle className="w-5 h-5" />
                Save & Request Deposit
              </button>
            </form>
          </div>
        </div>
      )}

      {/* PDF INVOICE MODAL */}
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
                onClick={() => {
                  setIsInvoiceModalOpen(false);
                  window.print();
                }}
                className="w-full py-4 bg-[#1c1c1c] text-white font-bold rounded-xl shadow-xl flex items-center justify-center gap-2 active:scale-95 transition-transform"
              >
                <Printer className="w-5 h-5" />
                Download / Print PDF
              </button>
              <button onClick={() => setIsInvoiceModalOpen(false)} className="w-full py-4 bg-white border border-[#e5e0d8] text-[#1c1c1c] font-bold rounded-xl hover:bg-[#f5f3ef] transition-colors">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* HIDDEN A4 PRINT TEMPLATE */}
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
              <p className="text-sm font-bold text-gray-500">Invoice #: INV-{String(activeTicket.id).split('-')[0].toUpperCase()}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-12 mb-12">
            <div>
              <p className="text-xs font-black text-gray-400 uppercase tracking-widest mb-2">Billed To</p>
              <p className="text-xl font-black text-gray-800">{activeTicket.customer}</p>
              <p className="text-sm font-semibold text-gray-600 mt-2 whitespace-pre-wrap">{invoiceMeta.billingExtra}</p>
            </div>
            <div>
              <p className="text-xs font-black text-gray-400 uppercase tracking-widest mb-2">Event Details</p>
              <p className="text-xl font-black text-gray-800">{activeTicket.event}</p>
              <div className="mt-2 space-y-1">
                <p className="text-sm font-semibold text-gray-600">
                  <span className="font-bold text-gray-800">Venue:</span> {invoiceMeta.venue}
                </p>
                <p className="text-sm font-semibold text-gray-600">
                  <span className="font-bold text-gray-800">Date:</span> {invoiceMeta.date}
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
              {Array.isArray(activeTicket.dishes) ? (
                activeTicket.dishes.map((dish, index) => {
                  const parsed = parseDishString(dish);
                  return (
                    <tr key={index}>
                      <td className="py-6 pr-8">
                        <p className="font-black text-gray-800 text-lg mb-1">{parsed.title}</p>
                        <p className="text-sm font-semibold text-gray-500 leading-relaxed">{parsed.details}</p>
                      </td>
                      <td className="py-6 text-right font-black text-gray-800 text-lg align-top pt-7">
                        {parsed.price !== null ? formatCurrency(parsed.price) : '-'}
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td className="py-6 pr-8">
                    <p className="font-black text-gray-800 text-lg">{activeTicket.dishes || 'Menu details on file'}</p>
                  </td>
                  <td className="py-6 text-right font-black text-gray-800 text-lg align-top">-</td>
                </tr>
              )}
            </tbody>
          </table>

          <div className="flex justify-end mb-16">
            <div className="w-1/2">
              <div className="flex justify-between py-3 border-b border-gray-200 text-sm font-semibold text-gray-600">
                <span>Base Food & Beverage</span>
                <span>{formatCurrency(invoiceBase)}</span>
              </div>
              <div className="flex justify-between py-3 border-b border-gray-200 text-sm font-semibold text-gray-600">
                <span>Logistics & Setup</span>
                <span>{formatCurrency(invoiceLogistics)}</span>
              </div>
              <div className="flex justify-between py-3 border-b border-gray-200 text-sm font-semibold text-gray-600">
                <span>Required 50% Deposit</span>
                <span>{formatCurrency(invoiceTotal * 0.5)}</span>
              </div>
              <div className="flex justify-between py-5 mt-2 bg-gray-50 rounded-xl px-4">
                <span className="font-black text-gray-800 text-xl">Grand Total</span>
                <span className="font-black text-[#e25f38] text-2xl">{formatCurrency(invoiceTotal)}</span>
              </div>
            </div>
          </div>

          <div className="border-t border-gray-200 pt-8 flex justify-between">
            <div className="w-1/2 pr-8">
              <p className="text-xs font-black text-gray-400 uppercase tracking-widest mb-3">Payment Instructions</p>
              <p className="text-sm font-semibold text-gray-600 mb-1">
                MTN Mobile Money: <span className="font-black text-gray-800">024 228 6269</span>
              </p>
              <p className="text-sm font-semibold text-gray-600">
                Name: <span className="font-black text-gray-800">MAXWEL YAW AHENKORAH</span>
              </p>
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
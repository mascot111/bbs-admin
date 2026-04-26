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
  GripVertical,
  Loader2,
  Printer,
  Save,
  Trash2,
  X
} from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { formatCurrency } from '../utils/helpers';

const COLUMNS = [
  { id: 'new-request', title: 'New Leads', color: 'border-blue-500', bg: 'bg-blue-500' },
  { id: 'negotiation', title: 'In Negotiation', color: 'border-amber-500', bg: 'bg-amber-500' },
  { id: 'awaiting-deposit', title: 'Awaiting Deposit', color: 'border-purple-500', bg: 'bg-purple-500' },
  { id: 'secured', title: 'Secured Contracts', color: 'border-emerald-500', bg: 'bg-emerald-500' }
];

const ALLOWED_TRANSITIONS = {
  'new-request': ['negotiation'],
  negotiation: ['awaiting-deposit'],
  'awaiting-deposit': ['secured'],
  secured: []
};

function parseDishString(dishString) {
  if (!dishString || typeof dishString !== 'string') return { title: 'Unknown Item', details: null };
  const normalized = dishString.replace(/â€”/g, '—').replace(/â€¢/g, '•');
  const parts = normalized.split(/\s[—-]\s/);
  return { title: (parts[0] || 'Unknown Item').trim(), details: parts[1] ? parts[1].trim() : null };
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

function canTransition(fromStatus, toStatus, ticket) {
  if (!fromStatus || fromStatus === toStatus) return true;
  const allowed = ALLOWED_TRANSITIONS[fromStatus] || [];
  if (!allowed.includes(toStatus)) return false;
  if (toStatus === 'awaiting-deposit' && !(Number(ticket?.total) > 0)) return false;
  return true;
}

export default function CateringQuotes() {
  const queryClient = useQueryClient();

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
    return COLUMNS.reduce((acc, column) => {
      const scoped = tickets.filter((ticket) => ticket.status === column.id);
      acc[column.id] = {
        count: scoped.length,
        total: scoped.reduce((sum, ticket) => sum + (Number(ticket.total) || 0), 0)
      };
      return acc;
    }, {});
  }, [tickets]);

  const activePipelineTotal = (totalsByColumn.negotiation?.total || 0) + (totalsByColumn['awaiting-deposit']?.total || 0);
  const closedWonTotal = totalsByColumn.secured?.total || 0;

  const handleDragStart = (event, ticketId) => {
    event.dataTransfer.setData('ticketId', ticketId);
  };

  const handleDragOver = (event) => event.preventDefault();

  const handleDrop = (event, newStatus) => {
    event.preventDefault();
    const ticketId = event.dataTransfer.getData('ticketId');
    if (!ticketId) return;
    const ticket = tickets.find((item) => String(item.id) === String(ticketId));
    if (!ticket) return;

    if (!canTransition(ticket.status, newStatus, ticket)) {
      if (newStatus === 'awaiting-deposit' && !(Number(ticket.total) > 0)) {
        setErrorMessage('Assign a final price before moving this lead to Awaiting Deposit.');
      } else {
        setErrorMessage('That move is not allowed in this workflow.');
      }
      return;
    }

    updateMutation.mutate({ id: ticketId, updates: { status: newStatus } });
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
      <div className="max-w-full mx-auto space-y-6 overflow-hidden h-[calc(100vh-8rem)] flex flex-col print:hidden">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 mb-4 shrink-0 w-full">
          <div>
            <p className="text-[#8c8a86] font-bold text-xs uppercase tracking-wider mb-1">Corporate & Events CRM</p>
            <h2 className="text-3xl font-black text-[#1c1c1c] leading-none">Catering Pipeline</h2>
          </div>
          <div className="bg-[#1c1c1c] w-full md:w-auto px-5 py-3 rounded-xl shadow-lg flex justify-between md:justify-start gap-4 md:gap-6 text-sm font-bold text-white">
            <div className="flex flex-col">
              <span className="text-[#8c8a86] text-[10px] md:text-xs uppercase tracking-widest">Active Pipeline</span>
              <span className="text-lg">{formatCurrency(activePipelineTotal)}</span>
            </div>
            <div className="w-px bg-white/20"></div>
            <div className="flex flex-col items-end md:items-start">
              <span className="text-[#8c8a86] text-[10px] md:text-xs uppercase tracking-widest">Closed Won</span>
              <span className="text-emerald-400 text-lg">{formatCurrency(closedWonTotal)}</span>
            </div>
          </div>
        </div>

        {errorMessage && (
          <div className="flex items-start gap-2 p-3 rounded-xl border border-red-200 bg-red-50 text-red-700 text-sm font-semibold shrink-0">
            <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        <div className="flex gap-4 md:gap-6 overflow-x-auto pb-4 flex-1 items-start snap-x snap-mandatory hide-scrollbar">
          {COLUMNS.map((column) => (
            <div
              key={column.id}
              className="bg-[#e5e0d8]/30 rounded-2xl min-w-[300px] md:min-w-[340px] max-w-[300px] md:max-w-[340px] flex flex-col h-full max-h-full border border-[#e5e0d8]/50 overflow-hidden snap-center shrink-0"
              onDragOver={handleDragOver}
              onDrop={(event) => handleDrop(event, column.id)}
            >
              <div className="p-4 border-b border-[#e5e0d8] flex justify-between items-center bg-[#f5f3ef] shrink-0">
                <div className="flex items-center gap-2">
                  <div className={`w-3 h-3 rounded-full ${column.bg}`}></div>
                  <h3 className="text-md font-bold text-[#1c1c1c] tracking-wide">{column.title}</h3>
                </div>
                <div className="flex flex-col items-end">
                  <span className="text-[#1c1c1c] font-black">{formatCurrency(totalsByColumn[column.id]?.total || 0)}</span>
                  <span className="text-[#8c8a86] text-xs font-bold">{totalsByColumn[column.id]?.count || 0} Leads</span>
                </div>
              </div>

              <div className="p-4 flex flex-col gap-4 overflow-y-auto flex-1">
                {tickets.filter((ticket) => ticket.status === column.id).map((ticket) => {
                  const dishesList = Array.isArray(ticket.dishes) ? ticket.dishes : [];
                  const followUpState = getFollowUpBadge(ticket);

                  return (
                    <div
                      key={ticket.id}
                      draggable
                      onDragStart={(event) => handleDragStart(event, ticket.id)}
                      className={`bg-white rounded-xl p-5 shadow-sm border-l-4 ${column.color} hover:shadow-md transition-all cursor-grab active:cursor-grabbing group relative`}
                    >
                      <div className="absolute right-3 top-4 text-gray-300 hidden md:block md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                        <GripVertical className="w-5 h-5" />
                      </div>

                      <h4 className="font-black text-[#1c1c1c] mb-1 pr-6">{ticket.customer}</h4>
                      <p className="text-xs font-bold text-[#e25f38] mb-3 uppercase tracking-wider">{ticket.event}</p>

                      {followUpState && (
                        <div className={`inline-flex items-center gap-1 px-2 py-1 rounded text-[10px] font-black uppercase tracking-wider mb-3 border ${followUpState.tone}`}>
                          <CalendarIcon className="w-3 h-3" />
                          {followUpState.label}: {new Date(ticket.follow_up_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
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
                          {dishesList.length > 2 && <li className="text-xs italic pl-4">+ {dishesList.length - 2} more items</li>}
                        </ul>
                      </div>

                      <div className="flex justify-between items-center mt-5 pt-4 border-t border-[#e5e0d8]">
                        <div className="font-black text-[#1c1c1c]">
                          {ticket.total ? (
                            formatCurrency(ticket.total)
                          ) : (
                            <span className="text-[#8c8a86] text-sm flex items-center gap-1">
                              <AlertCircle className="w-3.5 h-3.5" />
                              Pricing Pending
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                          <button onClick={() => openDetailsModal(ticket)} className="p-2 text-[#8c8a86] hover:bg-[#1c1c1c] hover:text-white rounded-lg transition-colors" title="View Full Details">
                            <Eye className="w-4 h-4" />
                          </button>
                          <button onClick={() => openInvoiceModal(ticket)} className="p-2 text-[#8c8a86] hover:bg-emerald-50 hover:text-emerald-600 rounded-lg transition-colors" title="Download PDF Invoice">
                            <Download className="w-4 h-4" />
                          </button>
                          <button onClick={() => openQuoteModal(ticket)} className="p-2 text-[#8c8a86] hover:bg-blue-50 hover:text-blue-600 rounded-lg transition-colors" title="Manage Price">
                            <Banknote className="w-4 h-4" />
                          </button>
                          <button onClick={() => openCRMSidebar(ticket)} className="p-2 text-[#8c8a86] hover:bg-[#1c1c1c] hover:text-white rounded-lg transition-colors" title="Open CRM">
                            <Briefcase className="w-4 h-4" />
                          </button>
                          <button onClick={() => handleDelete(ticket)} className="p-2 text-[#8c8a86] hover:bg-red-50 hover:text-red-500 rounded-lg transition-colors" title="Delete">
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

      {isDetailsModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#1c1c1c]/50 backdrop-blur-sm print:hidden">
          <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-[420px] overflow-hidden animate-in fade-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
            <div className="px-6 py-6 border-b border-[#e5e0d8] flex justify-between items-start bg-[#fdfbf7] shrink-0">
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
                        <div key={index} className="flex items-center gap-3 bg-[#fdfbf7] border border-[#e5e0d8] p-4 rounded-2xl shadow-sm">
                          <div className="w-6 h-6 rounded-full border-[1.5px] border-[#e25f38] flex items-center justify-center shrink-0">
                            <Check className="w-3.5 h-3.5 text-[#e25f38] stroke-[3]" />
                          </div>
                          <span className="font-bold text-[#1c1c1c] text-[13px]">{parsed.title}</span>
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
                      <td className="py-6 text-right font-black text-gray-800 text-lg align-top pt-7">-</td>
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

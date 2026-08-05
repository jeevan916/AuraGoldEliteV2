import React, { useState, useEffect, useMemo } from 'react';
import { 
  Plus, Search, ReceiptIndianRupee, QrCode, MessageSquare, Share2, 
  CheckCircle2, Clock, XCircle, AlertTriangle, CreditCard, Copy, 
  ExternalLink, Trash2, Filter, Calendar, DollarSign, Check, Send, 
  Download, RefreshCw, X, ShieldCheck, ArrowUpRight, HelpCircle,
  Code, Terminal, Bug, FileText, ChevronDown, ChevronUp
} from 'lucide-react';
import { ExternalPaymentRecord, ExternalPaymentStatus } from '../types';
import { storageService } from '../services/storageService';
import { whatsappService } from '../services/whatsappService';

export const ExternalPaymentLedger: React.FC = () => {
  const [records, setRecords] = useState<ExternalPaymentRecord[]>(storageService.getExternalPayments());
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<ExternalPaymentRecord | null>(null);
  const [activeDetailTab, setActiveDetailTab] = useState<'OVERVIEW' | 'RAW_DEBUG'>('OVERVIEW');
  const [showQrModal, setShowQrModal] = useState<ExternalPaymentRecord | null>(null);
  const [showQrRawDebug, setShowQrRawDebug] = useState(false);
  const [showManualPayModal, setShowManualPayModal] = useState<ExternalPaymentRecord | null>(null);
  const [manualPayMethod, setManualPayMethod] = useState<'CASH' | 'BANK_TRANSFER' | 'POS' | 'OTHER'>('CASH');
  const [manualPayAmount, setManualPayAmount] = useState('');
  const [manualTxnId, setManualTxnId] = useState('');
  const [manualNote, setManualNote] = useState('');

  const openManualPayModal = (r: ExternalPaymentRecord) => {
    setShowManualPayModal(r);
    const alreadyPaid = r.amountPaid || (r.status === 'PAID' ? r.amount : 0);
    const remaining = Math.max(0, r.amount - alreadyPaid);
    setManualPayAmount(remaining > 0 ? remaining.toString() : r.amount.toString());
    setManualPayMethod('CASH');
    setManualTxnId('');
    setManualNote('');
  };
  
  // Loading & notification state
  const [isGeneratingSetu, setIsGeneratingSetu] = useState(false);
  const [isSendingWa, setIsSendingWa] = useState(false);
  const [checkingStatusId, setCheckingStatusId] = useState<string | null>(null);
  const [notification, setNotification] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // New Request Form State
  const [formData, setFormData] = useState({
    customerName: '',
    customerContact: '',
    amount: '',
    description: '',
    referenceNote: 'External payment request',
    dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    dispatchWaImmediately: true
  });

  useEffect(() => {
    const unsubscribe = storageService.subscribe(() => {
      setRecords(storageService.getExternalPayments());
    });
    return () => unsubscribe();
  }, []);

  const triggerNotification = (type: 'success' | 'error' | 'info', message: string) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 4000);
  };

  const copyToClipboard = (text: string, label: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    triggerNotification('success', `${label} copied to clipboard!`);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Metrics
  const metrics = useMemo(() => {
    const total = records.length;
    const paidRecords = records.filter(r => r.status === 'PAID');
    const pendingRecords = records.filter(r => r.status === 'PENDING');
    const cancelledRecords = records.filter(r => r.status === 'CANCELLED');

    const totalPaidAmount = paidRecords.reduce((sum, r) => sum + Number(r.amount || 0), 0);
    const totalPendingAmount = pendingRecords.reduce((sum, r) => sum + Number(r.amount || 0), 0);
    const collectionRate = total > 0 ? Math.round((paidRecords.length / total) * 100) : 0;

    return {
      total,
      paidCount: paidRecords.length,
      pendingCount: pendingRecords.length,
      cancelledCount: cancelledRecords.length,
      totalPaidAmount,
      totalPendingAmount,
      collectionRate
    };
  }, [records]);

  // Filtered records
  const filteredRecords = useMemo(() => {
    return records.filter(r => {
      const matchesSearch = 
        r.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
        r.customerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        r.customerContact.includes(searchTerm) ||
        r.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
        r.referenceNote.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesStatus = statusFilter === 'ALL' || r.status === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [records, searchTerm, statusFilter]);

  // Helper to generate or re-generate Setu UPI link with full raw response and debug logs
  const handleGenerateSetuLink = async (record: ExternalPaymentRecord) => {
    setIsGeneratingSetu(true);
    const timestamp = new Date().toISOString();
    const payload = {
      amount: record.amount,
      customerID: record.customerContact,
      name: record.customerName,
      externalPaymentId: record.id,
      forceRefresh: true
    };

    let setuData: any = null;
    let rawResponse: any = null;
    let errorMsg: string | undefined = undefined;

    try {
      const res = await fetch('/api/setu/create-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      setuData = await res.json();
      rawResponse = setuData.rawSetuResponse || setuData.data || setuData;

      if (!res.ok || !setuData.success) {
        errorMsg = setuData.error || `HTTP ${res.status}: ${setuData.message || 'Setu Link Generation Failed'}`;
      }
    } catch (err: any) {
      errorMsg = `Network Error: ${err.message}`;
      rawResponse = { error: err.message };
    }

    const debugEntry = {
      timestamp,
      stage: 'SETU_LINK_CREATION',
      payload,
      response: rawResponse,
      error: errorMsg
    };

    const updatedDebugLogs = [...(record.debugLogs || []), debugEntry];
    const updatedHistory = [...(record.history || [])];

    const updates: Partial<ExternalPaymentRecord> = {
      rawSetuResponse: rawResponse,
      debugLogs: updatedDebugLogs,
      history: updatedHistory
    };

    const resData = setuData?.data?.data || setuData?.data || setuData;
    if (!errorMsg && setuData && setuData.success && resData) {
      updates.platformBillID = resData.platformBillID || resData.id;
      if (resData.paymentLink) {
        const pl = resData.paymentLink;
        updates.shortLink = pl.shortUrl || pl.shortURL || pl.shortLink || pl.url;
        updates.upiIntentLink = pl.upiIntentLink || pl.upiURL || pl.upiLink || (pl.upiID && pl.upiID.includes('@') ? `upi://pay?pa=${pl.upiID}&pn=AuraGold%20Jewellers&am=${record.amount}&cu=INR` : undefined);
      }
      updatedHistory.push({
        date: timestamp,
        action: 'SETU_LINK_GENERATED',
        details: `Setu UPI Link generated (Bill ID: ${updates.platformBillID})`
      });
      triggerNotification('success', `Setu UPI link generated for ${record.customerName}!`);
    } else {
      updatedHistory.push({
        date: timestamp,
        action: 'SETU_LINK_ERROR',
        details: `Setu Link Failed: ${errorMsg}`
      });
      triggerNotification('error', `Setu Link Generation Failed: ${errorMsg}`);
    }

    storageService.updateExternalPayment(record.id, updates);

    const updatedRecord: ExternalPaymentRecord = { ...record, ...updates };

    if (selectedRecord && selectedRecord.id === record.id) {
      setSelectedRecord(updatedRecord);
    }
    if (showQrModal && showQrModal.id === record.id) {
      setShowQrModal(updatedRecord);
    }

    setIsGeneratingSetu(false);
    return updatedRecord;
  };

  // Create Request Handler
  const handleCreateRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.customerName.trim() || !formData.customerContact.trim() || !formData.amount || Number(formData.amount) <= 0) {
      triggerNotification('error', 'Please fill all required fields with valid amounts.');
      return;
    }

    const shareToken = `ext_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const newId = `EXT-${Math.floor(1000 + Math.random() * 9000)}`;

    const newRecord: ExternalPaymentRecord = {
      id: newId,
      customerName: formData.customerName.trim(),
      customerContact: formData.customerContact.trim().replace(/[^0-9]/g, ''),
      amount: Number(formData.amount),
      description: formData.description.trim() || 'Offline Sale / Repair Payment',
      referenceNote: formData.referenceNote.trim() || 'External payment request',
      status: 'PENDING',
      createdAt: new Date().toISOString(),
      dueDate: formData.dueDate,
      shareToken: shareToken,
      history: [{
        date: new Date().toISOString(),
        action: 'REQUEST_CREATED',
        details: `External Payment Request generated for ₹${formData.amount}. Reference: ${formData.referenceNote}`
      }]
    };

    // Save initial record to storage
    storageService.addExternalPayment(newRecord);

    // Generate Setu UPI link with raw response and debug log capture
    const updatedRecord = await handleGenerateSetuLink(newRecord);

    // Optionally dispatch WhatsApp Payment Link
    if (formData.dispatchWaImmediately) {
      dispatchWaLink(updatedRecord || newRecord);
    }

    setShowCreateModal(false);
    setFormData({
      customerName: '',
      customerContact: '',
      amount: '',
      description: '',
      referenceNote: 'External payment request',
      dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      dispatchWaImmediately: true
    });
    triggerNotification('success', `External Payment Request ${newRecord.id} created successfully!`);
  };

  // Helper to determine valid Setu UPI payment link or fallback UPI link
  const getValidPayLink = (record: ExternalPaymentRecord) => {
    if (record.shortLink && (record.shortLink.startsWith('http://') || record.shortLink.startsWith('https://')) && !record.shortLink.includes('token=')) {
      return record.shortLink;
    }
    let upiUrl = record.upiIntentLink && record.upiIntentLink.startsWith('upi://') ? record.upiIntentLink : null;
    if (!upiUrl && record.upiIntentLink && record.upiIntentLink.includes('@')) {
      upiUrl = `upi://pay?pa=${record.upiIntentLink}&pn=AuraGold%20Jewellers&tr=${record.id}&am=${record.amount}&cu=INR`;
    }
    if (upiUrl) {
      const base64Upi = btoa(unescape(encodeURIComponent(upiUrl))).replace(/\+/g, '-').replace(/\//g, '_');
      return `${window.location.origin}/api/setu/pay/${base64Upi}`;
    }
    if (record.platformBillID) {
      return `${window.location.origin}/api/setu/pay/${record.platformBillID}`;
    }
    return `${window.location.origin}/?token=${record.shareToken}`;
  };

  // Dispatch WhatsApp Message
  const dispatchWaLink = async (record: ExternalPaymentRecord) => {
    setIsSendingWa(true);
    try {
      const validPayLink = getValidPayLink(record);

      const res = await whatsappService.sendTemplateMessage(
        record.customerContact,
        'auragold_external_payment_request',
        'en_US',
        [
          record.customerName,
          record.amount.toLocaleString('en-IN'),
          record.description || 'Jewelry Purchase',
          validPayLink
        ],
        record.customerName,
        validPayLink,
        undefined,
        'ADMIN'
      );

      if (res.success) {
        const updatedHistory = [...(record.history || []), {
          date: new Date().toISOString(),
          action: 'WHATSAPP_DISPATCHED',
          details: `Sent WhatsApp payment request to ${record.customerContact}`
        }];
        storageService.updateExternalPayment(record.id, { history: updatedHistory });
        triggerNotification('success', `WhatsApp payment link dispatched to ${record.customerName}`);
      } else {
        triggerNotification('error', `Failed to send WhatsApp: ${res.error || 'Meta API issue'}`);
      }
    } catch (err: any) {
      triggerNotification('error', `WhatsApp error: ${err.message}`);
    } finally {
      setIsSendingWa(false);
    }
  };

  // Record Manual Offline Payment
  const handleRecordManualPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!showManualPayModal) return;

    const totalRequested = showManualPayModal.amount;
    const previousPaid = showManualPayModal.amountPaid || (showManualPayModal.status === 'PAID' ? totalRequested : 0);
    const enteredAmount = Number(manualPayAmount) || Math.max(0, totalRequested - previousPaid);

    if (enteredAmount <= 0) {
      triggerNotification('error', 'Please enter a valid payment amount greater than 0.');
      return;
    }

    const newTotalPaid = previousPaid + enteredAmount;
    const remaining = Math.max(0, totalRequested - newTotalPaid);
    const isFullyPaid = newTotalPaid >= (totalRequested - 0.5);
    const newStatus = isFullyPaid ? 'PAID' : 'PARTIAL';
    const now = new Date().toISOString();

    const partialPayments = [
      ...(showManualPayModal.partialPayments || []),
      {
        amount: enteredAmount,
        paidAt: now,
        mode: manualPayMethod,
        txnId: manualTxnId || `MANUAL-${Date.now()}`
      }
    ];

    const updated: Partial<ExternalPaymentRecord> = {
      amountPaid: newTotalPaid,
      remainingAmount: remaining,
      status: newStatus,
      paidAt: isFullyPaid ? now : showManualPayModal.paidAt,
      lastPaymentAt: now,
      paymentMode: manualPayMethod,
      txnId: manualTxnId || `MANUAL-${Date.now()}`,
      partialPayments,
      notes: manualNote ? `${showManualPayModal.notes || ''}\n${manualNote}`.trim() : showManualPayModal.notes,
      history: [
        ...(showManualPayModal.history || []),
        {
          date: now,
          action: isFullyPaid ? 'MANUAL_FULL_PAYMENT' : 'MANUAL_PARTIAL_PAYMENT',
          details: `Recorded manual payment of ₹${enteredAmount.toLocaleString('en-IN')} via ${manualPayMethod} (Txn: ${manualTxnId || 'N/A'}). Total Paid: ₹${newTotalPaid.toLocaleString('en-IN')}/${totalRequested.toLocaleString('en-IN')}. Remaining Balance: ₹${remaining.toLocaleString('en-IN')}.`
        }
      ]
    };

    storageService.updateExternalPayment(showManualPayModal.id, updated);

    if (showManualPayModal.customerContact) {
      try {
        await whatsappService.sendTemplateMessage(
          showManualPayModal.customerContact,
          'auragold_payment_receipt_store',
          'en_US',
          [
            showManualPayModal.customerName || 'Customer',
            Number(enteredAmount).toLocaleString('en-IN'),
            manualPayMethod,
            showManualPayModal.id,
            Number(remaining).toLocaleString('en-IN')
          ],
          showManualPayModal.customerName || 'Customer',
          undefined,
          undefined,
          'SYSTEM',
          showManualPayModal.id
        );
      } catch (waErr: any) {
        console.warn("Could not dispatch WhatsApp receipt for manual payment:", waErr);
      }
    }

    setShowManualPayModal(null);
    setManualTxnId('');
    setManualNote('');
    setManualPayAmount('');
    triggerNotification('success', `Recorded ₹${enteredAmount.toLocaleString('en-IN')} payment for ${showManualPayModal.customerName}! ${isFullyPaid ? 'Link fully settled.' : `Remaining: ₹${remaining.toLocaleString('en-IN')}`}`);
  };

  // Verify Setu Payment Status Live
  const verifyStatus = async (record: ExternalPaymentRecord) => {
    const billId = record.platformBillID || (record.pendingSetuPayments && record.pendingSetuPayments[0]?.platformBillID);
    if (!billId) {
      triggerNotification('info', 'Generating Setu payment link first...');
      await handleGenerateSetuLink(record);
      return;
    }
    setCheckingStatusId(record.id);
    try {
      const res = await fetch(`/api/setu/status/${billId}`);
      const data = await res.json();
      if (data.success && data.data && ['PAYMENT_SUCCESSFUL', 'SUCCESS', 'BILL_FULFILLED', 'CREDIT_RECEIVED'].includes(data.data.status)) {
        triggerNotification('success', `Payment verified as PAID for ${record.customerName}!`);
      } else {
        triggerNotification('info', `Setu Status: ${data.data?.status || data.error || 'Payment pending on Setu'}`);
      }
    } catch (err: any) {
      triggerNotification('error', `Status check failed: ${err.message}`);
    } finally {
      setCheckingStatusId(null);
    }
  };

  // Cancel Request
  const handleCancelRequest = (id: string) => {
    if (!confirm("Are you sure you want to cancel this External Payment Request?")) return;
    const target = records.find(r => r.id === id);
    if (!target) return;

    const updatedHistory = [...(target.history || []), {
      date: new Date().toISOString(),
      action: 'REQUEST_CANCELLED',
      details: 'Request cancelled by store manager'
    }];

    storageService.updateExternalPayment(id, { status: 'CANCELLED', history: updatedHistory });
    triggerNotification('info', `External Payment Request ${id} cancelled.`);
  };

  // Export to CSV
  const exportToCSV = () => {
    if (records.length === 0) {
      triggerNotification('error', 'No records to export.');
      return;
    }

    const headers = ['Request ID', 'Customer Name', 'Contact', 'Amount (INR)', 'Purpose', 'Reference Tag', 'Status', 'Created Date', 'Due Date', 'Paid Date', 'Payment Mode', 'Txn ID'];
    const csvRows = records.map(r => [
      r.id,
      `"${r.customerName.replace(/"/g, '""')}"`,
      r.customerContact,
      r.amount,
      `"${r.description.replace(/"/g, '""')}"`,
      `"${r.referenceNote.replace(/"/g, '""')}"`,
      r.status,
      r.createdAt ? new Date(r.createdAt).toLocaleDateString('en-IN') : '',
      r.dueDate,
      r.paidAt ? new Date(r.paidAt).toLocaleDateString('en-IN') : '',
      r.paymentMode || '',
      r.txnId || ''
    ]);

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(','), ...csvRows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `external_payment_ledger_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    triggerNotification('success', 'Ledger exported to CSV!');
  };

  return (
    <div className="space-y-6 pb-20 animate-fadeIn">
      {/* Toast Notification */}
      {notification && (
        <div className={`fixed top-4 right-4 z-50 px-5 py-3 rounded-2xl shadow-2xl flex items-center gap-3 text-xs font-bold text-white transition-all transform animate-slideDown ${
          notification.type === 'success' ? 'bg-emerald-600' : notification.type === 'error' ? 'bg-rose-600' : 'bg-slate-900'
        }`}>
          {notification.type === 'success' && <CheckCircle2 size={16} />}
          {notification.type === 'error' && <AlertTriangle size={16} />}
          {notification.type === 'info' && <ShieldCheck size={16} />}
          <span>{notification.message}</span>
        </div>
      )}

      {/* Module Banner / Header */}
      <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-amber-950 p-6 md:p-8 rounded-3xl text-white shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-amber-500/20 text-amber-300 border border-amber-500/30 rounded-full text-[11px] font-bold uppercase tracking-wider mb-3">
              <ReceiptIndianRupee size={12} />
              Separate Offline Ledger
            </div>
            <h1 className="text-2xl md:text-3xl font-black text-white tracking-tight">
              External Payment Ledger
            </h1>
            <p className="text-slate-300 text-sm mt-1 max-w-xl leading-relaxed">
              Collect payments for non-Auragold offline orders, counter sales, and repairs using Setu UPI and WhatsApp notifications — seamlessly distinguished under <span className="font-semibold text-amber-300">External Payment Request</span>.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={exportToCSV}
              className="px-4 py-2.5 bg-slate-800/80 hover:bg-slate-700 text-slate-200 rounded-2xl font-bold text-xs uppercase tracking-wider transition-all flex items-center gap-2 border border-slate-700 active:scale-95 shadow-md"
            >
              <Download size={14} /> Export CSV
            </button>
            <button
              onClick={() => setShowCreateModal(true)}
              className="px-5 py-3 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 font-black text-xs uppercase tracking-wider rounded-2xl shadow-xl transition-all flex items-center gap-2 active:scale-95"
            >
              <Plus size={16} /> New Payment Request
            </button>
          </div>
        </div>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">Total Received</span>
            <div className="w-8 h-8 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <CheckCircle2 size={18} />
            </div>
          </div>
          <div>
            <div className="text-2xl font-black text-emerald-600">₹{metrics.totalPaidAmount.toLocaleString('en-IN')}</div>
            <div className="text-[11px] font-semibold text-slate-500 mt-0.5">{metrics.paidCount} Transactions Paid</div>
          </div>
        </div>

        <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">Pending Balance</span>
            <div className="w-8 h-8 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center">
              <Clock size={18} />
            </div>
          </div>
          <div>
            <div className="text-2xl font-black text-amber-600">₹{metrics.totalPendingAmount.toLocaleString('en-IN')}</div>
            <div className="text-[11px] font-semibold text-slate-500 mt-0.5">{metrics.pendingCount} Requests Awaiting</div>
          </div>
        </div>

        <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">Total Requests</span>
            <div className="w-8 h-8 rounded-2xl bg-slate-100 text-slate-600 flex items-center justify-center">
              <CreditCard size={18} />
            </div>
          </div>
          <div>
            <div className="text-2xl font-black text-slate-800">{metrics.total}</div>
            <div className="text-[11px] font-semibold text-slate-500 mt-0.5">Offline Requests Created</div>
          </div>
        </div>

        <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">Collection Rate</span>
            <div className="w-8 h-8 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <ShieldCheck size={18} />
            </div>
          </div>
          <div>
            <div className="text-2xl font-black text-blue-600">{metrics.collectionRate}%</div>
            <div className="text-[11px] font-semibold text-slate-500 mt-0.5">Success Conversion</div>
          </div>
        </div>
      </div>

      {/* Controls Bar */}
      <div className="bg-white p-4 rounded-3xl border border-slate-200/80 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
        {/* Search */}
        <div className="relative w-full sm:w-80">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by customer, phone, ID or purpose..."
            className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
          />
          {searchTerm && (
            <button onClick={() => setSearchTerm('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
              <X size={14} />
            </button>
          )}
        </div>

        {/* Status Filters */}
        <div className="flex items-center gap-1.5 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0">
          {['ALL', 'PENDING', 'PAID', 'CANCELLED'].map((st) => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`px-3.5 py-2 rounded-xl text-[11px] font-bold uppercase tracking-wider transition-all whitespace-nowrap ${
                statusFilter === st
                  ? 'bg-slate-900 text-white shadow-md'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {st}
            </button>
          ))}
        </div>
      </div>

      {/* Ledger Table */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-100 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                <th className="py-4 px-6">Request ID</th>
                <th className="py-4 px-6">Customer</th>
                <th className="py-4 px-6">Amount</th>
                <th className="py-4 px-6">Purpose / Description</th>
                <th className="py-4 px-6">Reference Badge</th>
                <th className="py-4 px-6">Status</th>
                <th className="py-4 px-6 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {filteredRecords.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    <div className="flex flex-col items-center justify-center space-y-2">
                      <ReceiptIndianRupee size={36} className="text-slate-300" />
                      <p className="font-semibold text-sm text-slate-600">No External Payment Requests Found</p>
                      <p className="text-xs text-slate-400 max-w-sm">
                        Create an external payment request to collect offline payments via Setu UPI & WhatsApp.
                      </p>
                      <button
                        onClick={() => setShowCreateModal(true)}
                        className="mt-2 px-4 py-2 bg-amber-500 text-slate-950 font-bold rounded-xl text-xs flex items-center gap-2 hover:bg-amber-600"
                      >
                        <Plus size={14} /> Create First Request
                      </button>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredRecords.map((r) => {
                  const publicUrl = `${window.location.origin}/?token=${r.shareToken}`;
                  return (
                    <tr key={r.id} className="hover:bg-slate-50/60 transition-colors">
                      {/* Request ID */}
                      <td className="py-4 px-6">
                        <span className="font-mono font-bold text-slate-900 bg-slate-100 px-2.5 py-1 rounded-lg border border-slate-200">
                          {r.id}
                        </span>
                        <div className="text-[10px] text-slate-400 mt-1">
                          {new Date(r.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                        </div>
                      </td>

                      {/* Customer */}
                      <td className="py-4 px-6">
                        <div className="font-bold text-slate-800">{r.customerName}</div>
                        <div className="text-[11px] text-slate-500 font-mono mt-0.5">{r.customerContact}</div>
                      </td>

                      {/* Amount */}
                      <td className="py-4 px-6">
                        <div className="font-black text-slate-900 text-sm">₹{r.amount.toLocaleString('en-IN')}</div>
                        {r.amountPaid && r.amountPaid > 0 && r.status !== 'PAID' ? (
                          <div className="text-[10px] text-amber-700 font-bold mt-0.5">
                            Bal: ₹{Math.max(0, r.amount - r.amountPaid).toLocaleString('en-IN')}
                          </div>
                        ) : (
                          <div className="text-[10px] text-slate-400 mt-0.5">Due: {r.dueDate}</div>
                        )}
                      </td>

                      {/* Purpose */}
                      <td className="py-4 px-6 max-w-xs">
                        <p className="text-slate-700 font-medium truncate" title={r.description}>
                          {r.description}
                        </p>
                      </td>

                      {/* Reference Badge */}
                      <td className="py-4 px-6">
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-amber-50 text-amber-800 border border-amber-200/80 rounded-full font-bold text-[10px] uppercase tracking-wider">
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                          {r.referenceNote}
                        </span>
                      </td>

                      {/* Status */}
                      <td className="py-4 px-6">
                        {r.status === 'PAID' && (
                          <div className="flex flex-col">
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full font-bold text-[10px] uppercase tracking-wider w-fit">
                              <CheckCircle2 size={12} /> PAID
                            </span>
                            <span className="text-[10px] text-slate-500 font-mono mt-1">
                              {r.paymentMode || 'UPI'} • {r.paidAt ? new Date(r.paidAt).toLocaleDateString('en-IN') : ''}
                            </span>
                          </div>
                        )}

                        {r.status === 'PARTIAL' && (
                          <div className="flex flex-col">
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-amber-50 text-amber-800 border border-amber-300 rounded-full font-bold text-[10px] uppercase tracking-wider w-fit">
                              <Clock size={12} className="text-amber-600" /> PARTIAL
                            </span>
                            <span className="text-[10px] text-amber-700 font-bold mt-1">
                              ₹{(r.amountPaid || 0).toLocaleString('en-IN')} / ₹{r.amount.toLocaleString('en-IN')}
                            </span>
                          </div>
                        )}

                        {r.status === 'PENDING' && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-amber-50 text-amber-700 border border-amber-200 rounded-full font-bold text-[10px] uppercase tracking-wider">
                            <Clock size={12} className="animate-spin" /> PENDING
                          </span>
                        )}

                        {r.status === 'CANCELLED' && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-rose-50 text-rose-700 border border-rose-200 rounded-full font-bold text-[10px] uppercase tracking-wider">
                            <XCircle size={12} /> CANCELLED
                          </span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-4 px-6 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Send WhatsApp & Check Status */}
                          {(r.status === 'PENDING' || r.status === 'PARTIAL') && (
                            <>
                              <button
                                onClick={() => verifyStatus(r)}
                                disabled={checkingStatusId === r.id}
                                title="Check / Verify Payment Status with Setu"
                                className="p-2 bg-sky-50 hover:bg-sky-100 text-sky-700 rounded-xl transition-all border border-sky-200 active:scale-95 flex items-center gap-1 font-bold text-[11px]"
                              >
                                <RefreshCw size={14} className={checkingStatusId === r.id ? 'animate-spin' : ''} />
                              </button>
                              <button
                                onClick={() => dispatchWaLink(r)}
                                disabled={isSendingWa}
                                title="Dispatch WhatsApp Payment Link"
                                className="p-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-xl transition-all border border-emerald-200 active:scale-95"
                              >
                                <MessageSquare size={14} />
                              </button>
                            </>
                          )}

                          {/* Setu UPI QR */}
                          <button
                            onClick={() => setShowQrModal(r)}
                            title="Show Setu UPI QR / Payment Info"
                            className="p-2 bg-amber-50 hover:bg-amber-100 text-amber-700 rounded-xl transition-all border border-amber-200 active:scale-95"
                          >
                            <QrCode size={14} />
                          </button>

                          {/* Copy Remote Link */}
                          <button
                            onClick={() => copyToClipboard(publicUrl, 'Remote payment URL', r.id)}
                            title="Copy Remote Customer Payment Link"
                            className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition-all border border-slate-200 active:scale-95"
                          >
                            {copiedId === r.id ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}
                          </button>

                          {/* Record Offline Pay */}
                          {(r.status === 'PENDING' || r.status === 'PARTIAL') && (
                            <button
                              onClick={() => openManualPayModal(r)}
                              title="Record Offline Payment (Cash/POS)"
                              className="px-2.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-bold text-[11px] transition-all flex items-center gap-1 active:scale-95 shadow-sm"
                            >
                              <CreditCard size={12} /> Record
                            </button>
                          )}

                          {/* Raw Response & Debug View */}
                          <button
                            onClick={() => {
                              setSelectedRecord(r);
                              setActiveDetailTab('RAW_DEBUG');
                            }}
                            title="View Raw Setu Response & Debug Logs"
                            className="p-2 bg-purple-50 hover:bg-purple-100 text-purple-700 rounded-xl transition-all border border-purple-200 active:scale-95"
                          >
                            <Code size={14} />
                          </button>

                          {/* View Details / History */}
                          <button
                            onClick={() => {
                              setSelectedRecord(r);
                              setActiveDetailTab('OVERVIEW');
                            }}
                            title="View Audit Details"
                            className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl transition-all active:scale-95"
                          >
                            <ExternalLink size={14} />
                          </button>

                          {/* Cancel */}
                          {r.status === 'PENDING' && (
                            <button
                              onClick={() => handleCancelRequest(r.id)}
                              title="Cancel Request"
                              className="p-2 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-xl transition-all border border-rose-200 active:scale-95"
                            >
                              <XCircle size={14} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* CREATE REQUEST MODAL */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 md:p-8 shadow-2xl border border-slate-200 relative animate-scaleUp">
            <button
              onClick={() => setShowCreateModal(false)}
              className="absolute top-5 right-5 text-slate-400 hover:text-slate-600 p-2 rounded-full hover:bg-slate-100"
            >
              <X size={18} />
            </button>

            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-2xl bg-amber-500/10 text-amber-600 flex items-center justify-center">
                <ReceiptIndianRupee size={20} />
              </div>
              <div>
                <h2 className="text-lg font-black text-slate-900">New External Payment Request</h2>
                <p className="text-xs text-slate-500">Collect money for offline orders, repairs, or counter sales</p>
              </div>
            </div>

            <form onSubmit={handleCreateRequest} className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                  Customer Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Rahul Sharma"
                  value={formData.customerName}
                  onChange={e => setFormData({ ...formData, customerName: e.target.value })}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                  Mobile Number (WhatsApp) *
                </label>
                <input
                  type="tel"
                  required
                  placeholder="e.g. 9876543210"
                  value={formData.customerContact}
                  onChange={e => setFormData({ ...formData, customerContact: e.target.value })}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                    Amount (₹) *
                  </label>
                  <input
                    type="number"
                    required
                    min="1"
                    placeholder="e.g. 2500"
                    value={formData.amount}
                    onChange={e => setFormData({ ...formData, amount: e.target.value })}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                    Due Date
                  </label>
                  <input
                    type="date"
                    value={formData.dueDate}
                    onChange={e => setFormData({ ...formData, dueDate: e.target.value })}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                  Purpose / Description
                </label>
                <input
                  type="text"
                  placeholder="e.g. Counter sale / Ring polish & resize charges"
                  value={formData.description}
                  onChange={e => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                  Reference Note Tag
                </label>
                <input
                  type="text"
                  value={formData.referenceNote}
                  onChange={e => setFormData({ ...formData, referenceNote: e.target.value })}
                  className="w-full px-4 py-2.5 bg-amber-50/50 border border-amber-200 rounded-2xl text-xs font-semibold text-amber-900 focus:outline-none"
                  readOnly
                />
                <p className="text-[10px] text-slate-400 mt-1">This reference tag distinguishes non-Auragold offline payments across the ledger.</p>
              </div>

              <div className="pt-2">
                <label className="flex items-center gap-3 p-3 bg-slate-50 rounded-2xl border border-slate-200 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.dispatchWaImmediately}
                    onChange={e => setFormData({ ...formData, dispatchWaImmediately: e.target.checked })}
                    className="w-4 h-4 rounded text-amber-600 focus:ring-amber-500"
                  />
                  <div>
                    <div className="text-xs font-bold text-slate-800">Dispatch WhatsApp Payment Link Immediately</div>
                    <div className="text-[10px] text-slate-500">Sends standard WhatsApp template with Setu UPI pay link</div>
                  </div>
                </label>
              </div>

              <div className="pt-4 flex items-center justify-end gap-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-2xl transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isGeneratingSetu}
                  className="px-6 py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950 font-black text-xs uppercase tracking-wider rounded-2xl shadow-xl transition-all hover:brightness-105 active:scale-95 flex items-center gap-2"
                >
                  {isGeneratingSetu ? (
                    <>
                      <RefreshCw size={14} className="animate-spin" /> Generating Setu UPI Link...
                    </>
                  ) : (
                    <>
                      <Plus size={14} /> Create Request
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* SETU UPI QR & PAYMENT INFO MODAL */}
      {showQrModal && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 relative text-center animate-scaleUp max-h-[90vh] overflow-y-auto">
            <button
              onClick={() => {
                setShowQrModal(null);
                setShowQrRawDebug(false);
              }}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 p-2 rounded-full hover:bg-slate-100"
            >
              <X size={18} />
            </button>

            <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-50 text-amber-800 border border-amber-200 rounded-full font-bold text-[10px] uppercase tracking-wider mb-4">
              <QrCode size={12} />
              Setu UPI Remote Payment QR
            </div>

            <h3 className="text-xl font-black text-slate-900">{showQrModal.customerName}</h3>
            <p className="text-xs text-slate-500 mt-0.5">{showQrModal.description} • {showQrModal.referenceNote}</p>

            <div className="text-3xl font-black text-amber-600 my-4">
              ₹{showQrModal.amount.toLocaleString('en-IN')}
            </div>

            {/* QR Code Container */}
            <div className="bg-slate-50 p-6 rounded-3xl border border-slate-200 inline-block my-2 shadow-inner">
              <img
                src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(
                  showQrModal.upiIntentLink || showQrModal.shortLink || `${window.location.origin}/?token=${showQrModal.shareToken}`
                )}`}
                alt="UPI Payment QR"
                className="w-44 h-44 mx-auto rounded-2xl shadow-md border border-slate-200"
              />
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mt-3">Scan with GPay / PhonePe / Paytm / BHIM</p>
            </div>

            <div className="space-y-2 text-left bg-slate-50 p-4 rounded-2xl border border-slate-200 text-xs my-4">
              <div className="flex justify-between items-center text-slate-600">
                <span>Setu Bill ID:</span>
                <span className="font-mono font-bold text-slate-900 flex items-center gap-1.5">
                  {showQrModal.platformBillID || showQrModal.id}
                </span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>Pay Link:</span>
                <a
                  href={getValidPayLink(showQrModal)}
                  target="_blank"
                  rel="noreferrer"
                  className="font-mono text-amber-600 font-bold truncate max-w-[180px] hover:underline"
                >
                  {getValidPayLink(showQrModal)}
                </a>
              </div>
            </div>

            <div className="flex gap-2 mb-3">
              <button
                onClick={() => copyToClipboard(getValidPayLink(showQrModal), 'Payment URL', showQrModal.id)}
                className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs rounded-2xl transition-all flex items-center justify-center gap-2"
              >
                <Copy size={14} /> Copy Pay Link
              </button>
              <button
                onClick={() => dispatchWaLink(showQrModal)}
                className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-2xl transition-all flex items-center justify-center gap-2 shadow-lg"
              >
                <MessageSquare size={14} /> Send WhatsApp
              </button>
            </div>

            {/* Toggle Raw Debug JSON Button */}
            <div className="border-t border-slate-200 pt-3 text-left">
              <button
                onClick={() => setShowQrRawDebug(!showQrRawDebug)}
                className="w-full py-2 px-3 bg-slate-900 text-slate-200 rounded-xl font-mono text-[11px] font-bold flex items-center justify-between hover:bg-slate-800 transition-all"
              >
                <span className="flex items-center gap-2">
                  <Terminal size={14} className="text-amber-400" />
                  View Raw Setu Response & Debug JSON
                </span>
                {showQrRawDebug ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              </button>

              {showQrRawDebug && (
                <div className="mt-3 space-y-3 animate-fadeIn">
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-bold text-slate-700">Setu API Response Payload:</span>
                    <button
                      onClick={() => handleGenerateSetuLink(showQrModal)}
                      disabled={isGeneratingSetu}
                      className="px-2.5 py-1 bg-amber-500 hover:bg-amber-600 text-slate-950 rounded-lg text-[10px] font-bold flex items-center gap-1"
                    >
                      <RefreshCw size={10} className={isGeneratingSetu ? 'animate-spin' : ''} />
                      Regenerate
                    </button>
                  </div>
                  <pre className="bg-slate-950 text-emerald-400 p-3 rounded-xl font-mono text-[11px] overflow-x-auto border border-slate-800 max-h-56 leading-snug">
                    {JSON.stringify(showQrModal.rawSetuResponse || { message: "No raw response captured yet. Click Regenerate." }, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* RECORD MANUAL PAYMENT MODAL */}
      {showManualPayModal && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 relative animate-scaleUp">
            <button
              onClick={() => setShowManualPayModal(null)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 p-2 rounded-full hover:bg-slate-100"
            >
              <X size={18} />
            </button>

            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                <CreditCard size={20} />
              </div>
              <div>
                <h3 className="text-lg font-black text-slate-900">Record Offline Payment</h3>
                <p className="text-xs text-slate-500">{showManualPayModal.customerName} • ₹{showManualPayModal.amount.toLocaleString('en-IN')}</p>
              </div>
            </div>

            <form onSubmit={handleRecordManualPayment} className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                  Payment Amount Received (₹)
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-2.5 text-xs font-bold text-slate-400">₹</span>
                  <input
                    type="number"
                    min={1}
                    max={Math.max(0, showManualPayModal.amount - (showManualPayModal.amountPaid || 0))}
                    value={manualPayAmount}
                    onChange={e => setManualPayAmount(e.target.value)}
                    className="w-full pl-8 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500/20"
                    required
                  />
                </div>
                <div className="flex justify-between text-[11px] text-slate-500 mt-1 px-1 font-medium">
                  <span>Total Bill: ₹{showManualPayModal.amount.toLocaleString('en-IN')}</span>
                  <span>Paid: ₹{(showManualPayModal.amountPaid || 0).toLocaleString('en-IN')}</span>
                  <span className="font-bold text-amber-700">Due: ₹{Math.max(0, showManualPayModal.amount - (showManualPayModal.amountPaid || 0)).toLocaleString('en-IN')}</span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                  Payment Mode
                </label>
                <select
                  value={manualPayMethod}
                  onChange={e => setManualPayMethod(e.target.value as any)}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500/20"
                >
                  <option value="CASH">Cash Payment</option>
                  <option value="BANK_TRANSFER">Direct Bank Transfer / NEFT / IMPS</option>
                  <option value="POS">Card POS Machine</option>
                  <option value="OTHER">Other Offline Mode</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                  Transaction / UTR Reference ID
                </label>
                <input
                  type="text"
                  placeholder="e.g. UTR-9812739123 or Cash Receipt #102"
                  value={manualTxnId}
                  onChange={e => setManualTxnId(e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500/20"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                  Notes / Remarks
                </label>
                <textarea
                  rows={2}
                  placeholder="Optional payment notes..."
                  value={manualNote}
                  onChange={e => setManualNote(e.target.value)}
                  className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-medium text-slate-800 focus:outline-none"
                />
              </div>

              <div className="pt-3 flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowManualPayModal(null)}
                  className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-2xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs uppercase tracking-wider rounded-2xl shadow-lg transition-all"
                >
                  Confirm Paid
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* VIEW AUDIT DETAILS & RAW RESPONSE DEBUG MODAL */}
      {selectedRecord && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-6 md:p-8 shadow-2xl border border-slate-200 relative animate-scaleUp max-h-[90vh] overflow-y-auto">
            <button
              onClick={() => setSelectedRecord(null)}
              className="absolute top-5 right-5 text-slate-400 hover:text-slate-600 p-2 rounded-full hover:bg-slate-100"
            >
              <X size={18} />
            </button>

            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-2xl bg-amber-500/10 text-amber-600 flex items-center justify-center">
                <ReceiptIndianRupee size={20} />
              </div>
              <div>
                <h2 className="text-lg font-black text-slate-900">{selectedRecord.id} Details</h2>
                <p className="text-xs text-slate-500">Audit History & Setu UPI Remote Link Payload Debug</p>
              </div>
            </div>

            {/* Modal Tabs */}
            <div className="flex border-b border-slate-200 mb-4 gap-2">
              <button
                onClick={() => setActiveDetailTab('OVERVIEW')}
                className={`pb-2.5 px-3 text-xs font-bold transition-all flex items-center gap-1.5 border-b-2 ${
                  activeDetailTab === 'OVERVIEW'
                    ? 'border-amber-500 text-amber-600'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                <ReceiptIndianRupee size={14} /> Overview & History
              </button>
              <button
                onClick={() => setActiveDetailTab('RAW_DEBUG')}
                className={`pb-2.5 px-3 text-xs font-bold transition-all flex items-center gap-1.5 border-b-2 ${
                  activeDetailTab === 'RAW_DEBUG'
                    ? 'border-amber-500 text-amber-600'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                <Code size={14} /> Raw Setu API & Debug Logs
                {selectedRecord.rawSetuResponse && (
                  <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />
                )}
              </button>
            </div>

            {/* TAB 1: OVERVIEW & HISTORY */}
            {activeDetailTab === 'OVERVIEW' && (
              <div className="space-y-4 animate-fadeIn">
                <div className="grid grid-cols-2 gap-3 bg-slate-50 p-4 rounded-2xl border border-slate-200 text-xs">
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-bold">Customer</span>
                    <span className="font-bold text-slate-900">{selectedRecord.customerName}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-bold">Phone</span>
                    <span className="font-mono text-slate-900">{selectedRecord.customerContact}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-bold">Total Bill</span>
                    <span className="font-black text-slate-900 text-sm">₹{selectedRecord.amount.toLocaleString('en-IN')}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-bold">Paid / Due</span>
                    <span className="font-bold text-emerald-600">
                      ₹{(selectedRecord.amountPaid || (selectedRecord.status === 'PAID' ? selectedRecord.amount : 0)).toLocaleString('en-IN')}
                    </span>
                    <span className="text-slate-400"> / </span>
                    <span className="font-bold text-amber-700">
                      ₹{Math.max(0, selectedRecord.amount - (selectedRecord.amountPaid || (selectedRecord.status === 'PAID' ? selectedRecord.amount : 0))).toLocaleString('en-IN')}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-bold">Reference Tag</span>
                    <span className="font-bold text-amber-700">{selectedRecord.referenceNote}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-bold">Status</span>
                    <span className="font-bold uppercase text-amber-600">{selectedRecord.status}</span>
                  </div>
                </div>

                {selectedRecord.partialPayments && selectedRecord.partialPayments.length > 0 && (
                  <div>
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 mb-2">Installments & Received Payments ({selectedRecord.partialPayments.length})</h4>
                    <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                      {selectedRecord.partialPayments.map((p, idx) => (
                        <div key={idx} className="flex justify-between items-center p-2.5 bg-slate-50 rounded-xl border border-slate-200 text-xs font-medium">
                          <span className="text-slate-600">{new Date(p.paidAt).toLocaleString('en-IN')} ({p.mode || 'UPI'})</span>
                          <span className="font-bold text-emerald-600">+₹{Number(p.amount).toLocaleString('en-IN')}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 mb-2">Activity History Log</h4>
                  <div className="space-y-2 max-h-52 overflow-y-auto pr-2">
                    {(selectedRecord.history || []).map((h, i) => (
                      <div key={i} className="p-3 bg-slate-50 rounded-xl border border-slate-100 text-[11px]">
                        <div className="flex justify-between font-bold text-slate-800 mb-1">
                          <span>{h.action}</span>
                          <span className="text-[10px] font-normal text-slate-400">{new Date(h.date).toLocaleString('en-IN')}</span>
                        </div>
                        <p className="text-slate-600 leading-snug">{h.details}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* TAB 2: RAW SETU RESPONSE & DEBUG LOGS */}
            {activeDetailTab === 'RAW_DEBUG' && (
              <div className="space-y-4 animate-fadeIn">
                <div className="flex items-center justify-between bg-slate-900 p-3 rounded-2xl text-white">
                  <div className="flex items-center gap-2">
                    <Terminal size={16} className="text-amber-400" />
                    <span className="text-xs font-bold font-mono">Setu Link Debug Inspector</span>
                  </div>
                  <button
                    onClick={() => handleGenerateSetuLink(selectedRecord)}
                    disabled={isGeneratingSetu}
                    className="px-3 py-1.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 font-black text-xs rounded-xl flex items-center gap-1.5 transition-all shadow"
                  >
                    <RefreshCw size={12} className={isGeneratingSetu ? 'animate-spin' : ''} />
                    {isGeneratingSetu ? 'Generating...' : 'Re-test Setu Link'}
                  </button>
                </div>

                {/* Raw Setu API Response JSON */}
                <div>
                  <div className="flex justify-between items-center mb-1.5">
                    <span className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                      <Code size={12} /> Raw Setu API JSON Response
                    </span>
                    {selectedRecord.rawSetuResponse && (
                      <button
                        onClick={() => copyToClipboard(JSON.stringify(selectedRecord.rawSetuResponse, null, 2), 'Raw Setu JSON', selectedRecord.id)}
                        className="text-[11px] font-bold text-amber-600 hover:underline flex items-center gap-1"
                      >
                        <Copy size={11} /> Copy JSON
                      </button>
                    )}
                  </div>
                  <pre className="bg-slate-950 text-emerald-400 p-4 rounded-2xl font-mono text-[11px] overflow-x-auto border border-slate-800 max-h-60 leading-relaxed shadow-inner">
                    {selectedRecord.rawSetuResponse
                      ? JSON.stringify(selectedRecord.rawSetuResponse, null, 2)
                      : '// No raw Setu API response captured yet.\n// Click "Re-test Setu Link" above to send live request.'}
                  </pre>
                </div>

                {/* Debug Logs Timeline */}
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 mb-2 flex items-center gap-1.5">
                    <Bug size={12} /> Debug Logs Timeline
                  </h4>
                  {(!selectedRecord.debugLogs || selectedRecord.debugLogs.length === 0) ? (
                    <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 text-xs text-slate-400 text-center font-mono">
                      No debug entries logged yet. Click "Re-test Setu Link" to record step-by-step logs.
                    </div>
                  ) : (
                    <div className="space-y-3 max-h-48 overflow-y-auto pr-2">
                      {selectedRecord.debugLogs.map((log, idx) => (
                        <div key={idx} className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200 text-xs space-y-2">
                          <div className="flex justify-between items-center font-bold">
                            <span className="px-2 py-0.5 bg-slate-900 text-amber-300 font-mono text-[10px] rounded-lg uppercase">
                              {log.stage}
                            </span>
                            <span className="text-[10px] text-slate-400 font-normal">
                              {new Date(log.timestamp).toLocaleTimeString('en-IN')}
                            </span>
                          </div>

                          {log.error && (
                            <div className="p-2 bg-rose-50 border border-rose-200 text-rose-700 text-[11px] font-bold rounded-xl">
                              ⚠️ {log.error}
                            </div>
                          )}

                          <div className="text-[11px]">
                            <span className="text-slate-400 font-bold block mb-0.5">Payload sent:</span>
                            <pre className="bg-white p-2 rounded-xl border border-slate-200 font-mono text-[10px] text-slate-800">
                              {JSON.stringify(log.payload, null, 2)}
                            </pre>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            <div className="mt-6 pt-4 border-t border-slate-100 text-right">
              <button
                onClick={() => setSelectedRecord(null)}
                className="px-6 py-2.5 bg-slate-900 text-white font-bold text-xs rounded-2xl hover:bg-slate-800"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ExternalPaymentLedger;

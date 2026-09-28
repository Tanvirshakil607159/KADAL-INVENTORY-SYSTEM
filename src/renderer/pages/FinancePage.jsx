import React, { useState, useEffect, useCallback, useMemo } from 'react';
import useStore from '../store/useStore';
import { 
  Landmark, FileText, Plus, Trash2, Printer, Download, Eye, 
  Search, CheckCircle, RefreshCw, Layers, DollarSign, Calendar, 
  ChevronRight, Building, Truck, Edit3, X, AlertCircle,
  Filter, RotateCcw, Check, CheckSquare, ChevronDown, ChevronUp,
  PackageCheck, Clock, ArrowRight, ShieldCheck, Hash, BarChart3
} from 'lucide-react';
import { numberToCurrencyWords } from '../utils/numberToWords';
import ProformaInvoicePrintView from '../components/finance/ProformaInvoicePrintView';

export default function FinancePage() {
  const { addToast, user, showConfirm } = useStore();

  // Primary section: 'pi' (Proforma Invoices) or 'bills' (Commercial Bills)
  const [activeSection, setActiveSection] = useState('pi');
  
  // Under 'pi': 'orders' (PI list & reconciliation) or 'create' (create PI pre-production)
  const [piSubTab, setPiSubTab] = useState('orders');

  const [loading, setLoading] = useState(false);
  const [records, setRecords] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [recipientFilter, setRecipientFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  // Dropdown reference data
  const [recipients, setRecipients] = useState([]);
  const [inventoryItems, setInventoryItems] = useState([]);

  // ==================== CREATE PI FORM STATE ====================
  const [selectedRecipientId, setSelectedRecipientId] = useState('');
  const [applicantName, setApplicantName] = useState('');
  const [applicantAddress, setApplicantAddress] = useState('');
  const [beneficiaryName, setBeneficiaryName] = useState('K.A. DESIGN ACCESSORIES LTD.');
  const [beneficiaryAddress, setBeneficiaryAddress] = useState('356/1, BLOCK-B, TEK KATHORA, SALNA, GAZIPUR-1703, BANGLADESH');
  const [beneficiaryBin, setBeneficiaryBin] = useState('');
  const [bankDetails, setBankDetails] = useState(
    'UNITED COMMERCIAL BANK PLC.\nTONGI BRANCH\n18, S.K. MANNAN TOWER, CHERAG ALI\nGAZIPUR-1712, BANGLADESH\nSWIFT CODE: UCBLBDDHTNG'
  );
  const [buyer, setBuyer] = useState('');
  const [buyersList, setBuyersList] = useState([]);
  const [customBuyerMode, setCustomBuyerMode] = useState(false);
  const [piNumber, setPiNumber] = useState('');
  const [piDate, setPiDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [currency, setCurrency] = useState('USD');
  const [currencySymbol, setCurrencySymbol] = useState('$');
  const [netWeight, setNetWeight] = useState('250 KGS');
  const [grossWeight, setGrossWeight] = useState('260 KGS');
  const [termsConditions, setTermsConditions] = useState('CASH ON DELIVERY.');
  const [piItems, setPiItems] = useState([]);
  const [savingPi, setSavingPi] = useState(false);

  // ==================== RECONCILIATION MODAL STATE ====================
  const [reconciliationModalPi, setReconciliationModalPi] = useState(null);
  const [reconciliationData, setReconciliationData] = useState(null);
  const [loadingRecon, setLoadingRecon] = useState(false);
  const [transferring, setTransferring] = useState(false);

  // ==================== PREVIEW PRINT STATE ====================
  const [previewPi, setPreviewPi] = useState(null);
  const [previewMode, setPreviewMode] = useState('pi'); // 'pi' or 'bill'

  // Auto-generate next PI number
  const generateNextPiNumber = useCallback(async (applicant = '') => {
    try {
      const nextPi = await window.kadal.finance.getNextNumber(applicant);
      const pNum = nextPi?.success ? nextPi.data : (typeof nextPi === 'string' ? nextPi : '');
      if (pNum) setPiNumber(pNum);
    } catch (e) {
      console.error('Failed to generate PI number:', e);
    }
  }, []);

  // Load initial data
  const loadInitialData = useCallback(async () => {
    setLoading(true);
    try {
      const [recRes, itemRes, finRes, buyersRes] = await Promise.all([
        window.kadal.recipients.getAll().catch(() => ({ success: false, data: [] })),
        window.kadal.items.getAll({}).catch(() => ({ success: false, data: [] })),
        window.kadal.finance.getAll().catch(() => ({ success: false, data: [] })),
        window.kadal.buyers.getAll().catch(() => ({ success: false, data: [] }))
      ]);

      if (recRes?.success) setRecipients(recRes.data || []);
      else if (Array.isArray(recRes)) setRecipients(recRes);

      if (itemRes?.success) setInventoryItems(itemRes.data || []);
      else if (Array.isArray(itemRes)) setInventoryItems(itemRes);

      if (finRes?.success) setRecords(finRes.data || []);
      else if (Array.isArray(finRes)) setRecords(finRes);

      const bRaw = buyersRes?.success ? (buyersRes.data || []) : (Array.isArray(buyersRes) ? buyersRes : []);
      const bSet = new Set(bRaw.map(b => (b.name || '').trim()).filter(Boolean));
      // Also collect any buyer names from items
      const itArr = itemRes?.data || (Array.isArray(itemRes) ? itemRes : []);
      itArr.forEach(it => {
        if (it.buyer_name) bSet.add(it.buyer_name.trim());
      });
      setBuyersList(Array.from(bSet).sort());
    } catch (e) {
      console.error('Failed to load finance data:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadInitialData();
  }, [loadInitialData]);

  // Auto-generate PI number when opening Create tab
  useEffect(() => {
    if (piSubTab === 'create' && !piNumber) {
      generateNextPiNumber(applicantName);
    }
  }, [piSubTab, piNumber, applicantName, generateNextPiNumber]);

  // Handle Recipient selection in Create PI
  const handleRecipientChange = async (recId) => {
    const rId = Number(recId);
    setSelectedRecipientId(rId);

    const rec = recipients.find(r => r.id === rId);
    if (rec) {
      setApplicantName(rec.name);
      setApplicantAddress(rec.receiver_address || '');
      await generateNextPiNumber(rec.name);
    } else {
      setApplicantName('');
      setApplicantAddress('');
      await generateNextPiNumber('');
    }
  };

  // Add Item Line in Create PI
  const handleAddLineItem = () => {
    setPiItems(prev => [
      ...prev,
      {
        slNo: prev.length + 1,
        itemId: null,
        itemDescription: '',
        poStyleNo: '',
        quantity: 1000,
        unit: 'PCS',
        unitPrice: 0.05,
        totalAmount: 50.00
      }
    ]);
  };

  const handleSelectInventoryItem = (index, itemId) => {
    const it = inventoryItems.find(i => i.id === Number(itemId));
    if (!it) return;

    setPiItems(prev => prev.map((item, idx) => {
      if (idx !== index) return item;
      const rate = Number(it.unit_price) || 0;
      const qty = Number(item.quantity) || 1000;
      return {
        ...item,
        itemId: it.id,
        itemDescription: it.name,
        poStyleNo: it.style_name || it.order_number || it.purchase_no || item.poStyleNo,
        unit: (it.unit || 'PCS').toUpperCase(),
        unitPrice: rate,
        totalAmount: Number((qty * rate).toFixed(2))
      };
    }));
  };

  const handleUpdateItemField = (index, field, val) => {
    setPiItems(prev => prev.map((item, idx) => {
      if (idx !== index) return item;
      const updated = { ...item, [field]: val };
      if (field === 'quantity' || field === 'unitPrice') {
        const q = field === 'quantity' ? Number(val) || 0 : Number(item.quantity) || 0;
        const p = field === 'unitPrice' ? Number(val) || 0 : Number(item.unitPrice) || 0;
        updated.totalAmount = Number((q * p).toFixed(2));
      }
      return updated;
    }));
  };

  const handleRemoveLineItem = (index) => {
    setPiItems(prev => prev.filter((_, i) => i !== index).map((it, i) => ({ ...it, slNo: i + 1 })));
  };

  // Totals for Create PI
  const totalQuantity = useMemo(() => {
    return piItems.reduce((sum, it) => sum + (Number(it.quantity) || 0), 0);
  }, [piItems]);

  const totalAmount = useMemo(() => {
    return Number(piItems.reduce((sum, it) => sum + (Number(it.totalAmount) || 0), 0).toFixed(2));
  }, [piItems]);

  const amountInWords = useMemo(() => {
    if (totalAmount <= 0) return 'ZERO ONLY';
    return `IN WORDS: ${numberToCurrencyWords(totalAmount, currency)}`;
  }, [totalAmount, currency]);

  // Currency handler
  const handleCurrencyChange = (curr) => {
    setCurrency(curr);
    if (curr === 'USD') setCurrencySymbol('$');
    else if (curr === 'BDT') setCurrencySymbol('৳');
    else if (curr === 'EUR') setCurrencySymbol('€');
    else setCurrencySymbol(curr);
  };

  // Submit / Save Proforma Invoice
  const handleSavePi = async (initialStatus = 'APPROVED') => {
    if (!applicantName.trim()) {
      addToast('error', 'Please select or enter Applicant Name / Recipient');
      return;
    }
    if (!piNumber.trim()) {
      addToast('error', 'Proforma Invoice Number is required');
      return;
    }
    if (piItems.length === 0) {
      addToast('error', 'Please add at least one item to the Proforma Invoice');
      return;
    }

    setSavingPi(true);
    try {
      const payload = {
        piNumber: piNumber.trim(),
        piDate: piDate || new Date().toISOString(),
        recipientId: selectedRecipientId || null,
        applicantName: applicantName.trim(),
        applicantAddress: applicantAddress.trim() || null,
        beneficiaryName,
        beneficiaryAddress,
        beneficiaryBin,
        bankDetails,
        buyer: buyer.trim() || null,
        currency,
        currencySymbol,
        totalQuantity,
        totalAmount,
        amountInWords,
        netWeight,
        grossWeight,
        termsConditions,
        status: initialStatus,
        items: piItems.map(it => ({
          itemId: it.itemId || null,
          itemDescription: it.itemDescription.trim() || 'Custom Accessory Item',
          poStyleNo: it.poStyleNo.trim() || '-',
          quantity: Number(it.quantity) || 0,
          unit: (it.unit || 'PCS').toUpperCase(),
          unitPrice: Number(it.unitPrice) || 0,
          totalAmount: Number(it.totalAmount) || 0
        }))
      };

      const res = await window.kadal.finance.create(payload);
      if (res?.success) {
        addToast('success', `Proforma Invoice ${res.piNumber || piNumber} created successfully!`);
        // Reset form
        setPiItems([]);
        setSelectedRecipientId('');
        setApplicantName('');
        setApplicantAddress('');
        setBuyer('');
        setPiNumber('');
        setPiSubTab('orders');
        await loadInitialData();
      } else {
        addToast('error', res?.error || 'Failed to create Proforma Invoice');
      }
    } catch (e) {
      addToast('error', e.message || 'Error creating PI');
    } finally {
      setSavingPi(false);
    }
  };

  // Open Reconciliation Modal
  const handleOpenReconciliation = async (pi) => {
    setReconciliationModalPi(pi);
    setLoadingRecon(true);
    try {
      const res = await window.kadal.finance.getPiReconciliation(pi.id);
      const data = res?.success ? res.data : (res?.data || res);
      setReconciliationData(data);
    } catch (e) {
      addToast('error', 'Failed to load reconciliation data');
    } finally {
      setLoadingRecon(false);
    }
  };

  // Transfer PI to Bill
  const handleTransferToBill = async (piId) => {
    const confirmed = await showConfirm({
      title: 'Transfer PI to Commercial Bill',
      message: 'All order quantities have been 100% received from recipient side. Do you want to convert this Proforma Invoice into a finalized Commercial Bill?',
      confirmText: 'Transfer to Bill',
      cancelText: 'Cancel',
      type: 'info'
    });
    if (!confirmed) return;

    setTransferring(true);
    try {
      const res = await window.kadal.finance.transferToBill(piId);
      if (res?.success) {
        addToast('success', `Transferred to Bill #${res.data?.billNumber || res.billNumber}!`);
        setReconciliationModalPi(null);
        await loadInitialData();
        // Switch to Bills view so user can see and print the new Bill
        setActiveSection('bills');
      } else {
        addToast('error', res?.error || 'Failed to transfer to bill');
      }
    } catch (e) {
      addToast('error', e.message || 'Error transferring to bill');
    } finally {
      setTransferring(false);
    }
  };

  // Open Preview Modal
  const handlePreview = (item, mode = 'pi') => {
    setPreviewPi(item);
    setPreviewMode(mode);
  };

  // Filter records
  const piList = useMemo(() => {
    return records.filter(r => {
      // Must not be a pure historical bill without PI number
      if (!r.pi_number && r.bill_number) return false;

      if (recipientFilter && r.recipient_id !== Number(recipientFilter)) return false;
      if (statusFilter !== 'all') {
        if (statusFilter === '100_received') {
          if (!r.is_100_percent_received || r.status === 'BILLED') return false;
        } else if (r.status !== statusFilter) {
          return false;
        }
      }

      if (searchQuery.trim()) {
        const s = searchQuery.toLowerCase();
        const matches = (r.pi_number && r.pi_number.toLowerCase().includes(s)) ||
                        (r.applicant_name && r.applicant_name.toLowerCase().includes(s)) ||
                        (r.buyer && r.buyer.toLowerCase().includes(s)) ||
                        (r.bill_number && r.bill_number.toLowerCase().includes(s));
        if (!matches) return false;
      }
      return true;
    });
  }, [records, recipientFilter, statusFilter, searchQuery]);

  const billsList = useMemo(() => {
    return records.filter(r => {
      // Must have a bill_number (Historical bills + Converted bills)
      if (!r.bill_number) return false;

      if (recipientFilter && r.recipient_id !== Number(recipientFilter)) return false;
      if (searchQuery.trim()) {
        const s = searchQuery.toLowerCase();
        const matches = (r.bill_number && r.bill_number.toLowerCase().includes(s)) ||
                        (r.applicant_name && r.applicant_name.toLowerCase().includes(s)) ||
                        (r.pi_number && r.pi_number.toLowerCase().includes(s)) ||
                        (r.challan_numbers && r.challan_numbers.toLowerCase().includes(s));
        if (!matches) return false;
      }
      return true;
    });
  }, [records, recipientFilter, searchQuery]);

  // Statistics for PI
  const piStats = useMemo(() => {
    let totalPis = 0;
    let inProduction = 0;
    let readyToBill = 0;
    let billed = 0;

    records.forEach(r => {
      if (r.pi_number) {
        totalPis++;
        if (r.status === 'BILLED') billed++;
        else if (r.is_100_percent_received) readyToBill++;
        else inProduction++;
      }
    });

    return { totalPis, inProduction, readyToBill, billed };
  }, [records]);

  return (
    <div className="page-container" style={{ padding: '24px 32px' }}>
      {/* Top Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
        <div>
          <h1 style={{ display: 'flex', alignItems: 'center', gap: 12, margin: 0, fontSize: 24, fontWeight: 700, color: 'var(--text)' }}>
            <Landmark size={28} color="var(--primary)" />
            Finance & Billing Management
          </h1>
          <p style={{ margin: '6px 0 0 0', color: 'var(--text-muted)', fontSize: 14 }}>
            Pre-production Proforma Invoices (PI), Recipient delivery reconciliation, and Final Commercial Bills.
          </p>
        </div>

        <button className="btn btn-outline btn-sm" onClick={loadInitialData} disabled={loading} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <RefreshCw size={15} className={loading ? 'spin' : ''} /> Refresh
        </button>
      </div>

      {/* Main Navigation: PI vs Commercial Bills */}
      <div style={{ display: 'flex', gap: 10, borderBottom: '2px solid var(--border)', marginBottom: 24 }}>
        <button
          onClick={() => setActiveSection('pi')}
          style={{
            padding: '12px 20px',
            background: 'none',
            border: 'none',
            borderBottom: activeSection === 'pi' ? '3px solid var(--primary)' : '3px solid transparent',
            color: activeSection === 'pi' ? 'var(--primary)' : 'var(--text-muted)',
            fontWeight: 700,
            fontSize: 15,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            transition: 'all 0.15s ease'
          }}
        >
          <FileText size={18} />
          Proforma Invoices (PI)
          <span style={{ 
            fontSize: 11, padding: '2px 8px', borderRadius: 10, 
            background: activeSection === 'pi' ? 'rgba(99,102,241,0.15)' : 'var(--border)', 
            color: activeSection === 'pi' ? 'var(--primary)' : 'var(--text-muted)' 
          }}>
            {piStats.totalPis}
          </span>
        </button>

        <button
          onClick={() => setActiveSection('bills')}
          style={{
            padding: '12px 20px',
            background: 'none',
            border: 'none',
            borderBottom: activeSection === 'bills' ? '3px solid var(--primary)' : '3px solid transparent',
            color: activeSection === 'bills' ? 'var(--primary)' : 'var(--text-muted)',
            fontWeight: 700,
            fontSize: 15,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            transition: 'all 0.15s ease'
          }}
        >
          <Landmark size={18} />
          Commercial Bills & Invoices
          <span style={{ 
            fontSize: 11, padding: '2px 8px', borderRadius: 10, 
            background: activeSection === 'bills' ? 'rgba(99,102,241,0.15)' : 'var(--border)', 
            color: activeSection === 'bills' ? 'var(--primary)' : 'var(--text-muted)' 
          }}>
            {billsList.length}
          </span>
        </button>
      </div>

      {/* ========================================================================= */}
      {/* SECTION 1: PROFORMA INVOICES (PI) */}
      {/* ========================================================================= */}
      {activeSection === 'pi' && (
        <div>
          {/* Subtabs for PI */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <div style={{ display: 'flex', gap: 8, background: 'var(--bg-card)', padding: 4, borderRadius: 8, border: '1px solid var(--border)' }}>
              <button
                className={`btn btn-sm ${piSubTab === 'orders' ? 'btn-primary' : 'btn-ghost'}`}
                onClick={() => setPiSubTab('orders')}
                style={{ fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}
              >
                <Layers size={14} /> PI Orders & Reconciliation
              </button>
              <button
                className={`btn btn-sm ${piSubTab === 'create' ? 'btn-primary' : 'btn-ghost'}`}
                onClick={() => setPiSubTab('create')}
                style={{ fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}
              >
                <Plus size={14} /> Create Proforma Invoice
              </button>
            </div>

            {piSubTab === 'orders' && (
              <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Status Filter:</span>
                <select
                  value={statusFilter}
                  onChange={e => setStatusFilter(e.target.value)}
                  style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid var(--border)', fontSize: 12, background: 'var(--bg-card)' }}
                >
                  <option value="all">All Statuses</option>
                  <option value="100_received">100% Received (Ready to Bill)</option>
                  <option value="APPROVED">Approved / In Production</option>
                  <option value="BILLED">Transferred to Bill</option>
                </select>
              </div>
            )}
          </div>

          {/* VIEW A: PI ORDERS & RECONCILIATION LIST */}
          {piSubTab === 'orders' && (
            <div>
              {/* Metric Cards for PI */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 20 }}>
                <div style={{ padding: '14px 18px', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 10 }}>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>Total PIs Issued</div>
                  <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--text)' }}>{piStats.totalPis}</div>
                </div>
                <div style={{ padding: '14px 18px', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 10 }}>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>In Production / Dispatched</div>
                  <div style={{ fontSize: 24, fontWeight: 700, color: '#6366f1' }}>{piStats.inProduction}</div>
                </div>
                <div style={{ padding: '14px 18px', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 10 }}>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>Ready to Bill (100% Received)</div>
                  <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--success, #10b981)' }}>{piStats.readyToBill}</div>
                </div>
                <div style={{ padding: '14px 18px', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 10 }}>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>Transferred to Commercial Bill</div>
                  <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--text-muted)' }}>{piStats.billed}</div>
                </div>
              </div>

              {/* PI Search Bar */}
              <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 10, padding: 12, marginBottom: 16 }}>
                <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                  <div style={{ position: 'relative', flex: 1 }}>
                    <Search size={16} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                    <input
                      type="text"
                      placeholder="Search by PI #, Applicant, Buyer, Bill #..."
                      value={searchQuery}
                      onChange={e => setSearchQuery(e.target.value)}
                      style={{ width: '100%', padding: '7px 10px 7px 32px', borderRadius: 6, border: '1px solid var(--border)', fontSize: 13, background: 'var(--bg-base)' }}
                    />
                  </div>
                  <select
                    value={recipientFilter}
                    onChange={e => setRecipientFilter(e.target.value)}
                    style={{ padding: '7px 12px', borderRadius: 6, border: '1px solid var(--border)', fontSize: 13, background: 'var(--bg-base)', minWidth: 200 }}
                  >
                    <option value="">All Applicants / Factories</option>
                    {recipients.map(r => (
                      <option key={r.id} value={r.id}>{r.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* PI Table */}
              <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 13 }}>
                  <thead>
                    <tr style={{ background: 'var(--bg-base, rgba(0,0,0,0.02))', borderBottom: '1px solid var(--border)', color: 'var(--text-muted)', fontSize: 12 }}>
                      <th style={{ padding: '12px 16px' }}>PI NUMBER</th>
                      <th style={{ padding: '12px 16px' }}>DATE</th>
                      <th style={{ padding: '12px 16px' }}>APPLICANT / BUYER</th>
                      <th style={{ padding: '12px 16px', textAlign: 'right' }}>ORDER QTY</th>
                      <th style={{ padding: '12px 16px', textAlign: 'right' }}>RECEIVED QTY</th>
                      <th style={{ padding: '12px 16px', width: 180 }}>RECEIPT MATCH</th>
                      <th style={{ padding: '12px 16px', textAlign: 'center' }}>STATUS</th>
                      <th style={{ padding: '12px 16px', textAlign: 'right' }}>ACTIONS</th>
                    </tr>
                  </thead>
                  <tbody>
                    {piList.length === 0 ? (
                      <tr>
                        <td colSpan={8} style={{ padding: 48, textAlign: 'center', color: 'var(--text-muted)' }}>
                          <FileText size={40} style={{ opacity: 0.3, marginBottom: 10 }} />
                          <p style={{ margin: 0, fontSize: 14 }}>No Proforma Invoices found matching your criteria.</p>
                        </td>
                      </tr>
                    ) : (
                      piList.map(pi => {
                        const pct = pi.fulfillment_pct || 0;
                        const isReadyToBill = pi.is_100_percent_received && pi.status !== 'BILLED';
                        const isBilled = pi.status === 'BILLED' || !!pi.bill_number;

                        return (
                          <tr key={pi.id} style={{ borderBottom: '1px solid var(--border)' }}>
                            <td style={{ padding: '12px 16px', fontWeight: 600, color: 'var(--primary)' }}>
                              {pi.pi_number}
                              {pi.bill_number && (
                                <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 'normal' }}>
                                  Bill: {pi.bill_number}
                                </div>
                              )}
                            </td>
                            <td style={{ padding: '12px 16px', color: 'var(--text-muted)' }}>
                              {pi.pi_date ? new Date(pi.pi_date).toLocaleDateString('en-GB') : '-'}
                            </td>
                            <td style={{ padding: '12px 16px' }}>
                              <div style={{ fontWeight: 600, color: 'var(--text)' }}>{pi.applicant_name}</div>
                              {pi.buyer && <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Buyer: {pi.buyer}</div>}
                            </td>
                            <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 600 }}>
                              {Number(pi.total_quantity || 0).toLocaleString()}
                            </td>
                            <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 600, color: pi.is_100_percent_received ? 'var(--success, #10b981)' : 'var(--text)' }}>
                              {Number(pi.received_quantity || 0).toLocaleString()}
                            </td>
                            <td style={{ padding: '12px 16px' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <div style={{ flex: 1, height: 6, background: 'var(--border)', borderRadius: 3, overflow: 'hidden' }}>
                                  <div style={{ 
                                    height: '100%', 
                                    width: `${pct}%`, 
                                    background: isBilled ? '#64748b' : (pct >= 100 ? 'var(--success, #10b981)' : 'var(--primary)'),
                                    transition: 'width 0.3s ease'
                                  }} />
                                </div>
                                <span style={{ fontSize: 11, fontWeight: 600, minWidth: 34, textAlign: 'right' }}>{pct}%</span>
                              </div>
                            </td>
                            <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                              {isBilled ? (
                                <span style={{ 
                                  display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 8px', 
                                  borderRadius: 12, background: 'rgba(100,116,139,0.12)', color: '#475569', fontSize: 11, fontWeight: 600 
                                }}>
                                  <CheckCircle size={12} /> Billed
                                </span>
                              ) : isReadyToBill ? (
                                <span style={{ 
                                  display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 8px', 
                                  borderRadius: 12, background: 'rgba(16,185,129,0.15)', color: '#059669', fontSize: 11, fontWeight: 600 
                                }}>
                                  <CheckCircle size={12} /> Ready to Bill
                                </span>
                              ) : (
                                <span style={{ 
                                  display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 8px', 
                                  borderRadius: 12, background: 'rgba(99,102,241,0.1)', color: '#6366f1', fontSize: 11, fontWeight: 600 
                                }}>
                                  <Clock size={12} /> Production
                                </span>
                              )}
                            </td>
                            <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                              <div style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}>
                                <button
                                  className="btn btn-outline btn-sm"
                                  onClick={() => handleOpenReconciliation(pi)}
                                  title="View Reconciliation & Transfer to Bill"
                                  style={{ display: 'flex', alignItems: 'center', gap: 4 }}
                                >
                                  <BarChart3 size={13} /> Reconcile
                                </button>
                                <button
                                  className="btn btn-ghost btn-sm btn-icon"
                                  onClick={() => handlePreview(pi, 'pi')}
                                  title="Print Proforma Invoice"
                                >
                                  <Printer size={15} />
                                </button>
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
          )}

          {/* VIEW B: CREATE PROFORMA INVOICE (PRE-PRODUCTION) */}
          {piSubTab === 'create' && (
            <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 10, padding: 24 }}>
              <div style={{ borderBottom: '1px solid var(--border)', paddingBottom: 16, marginBottom: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700 }}>Create New Proforma Invoice (Sales Order)</h3>
                  <p style={{ margin: '4px 0 0 0', fontSize: 13, color: 'var(--text-muted)' }}>
                    Enter ordered accessories, agreed unit prices, and client terms before issuing production.
                  </p>
                </div>
                <button className="btn btn-ghost btn-sm" onClick={() => setPiSubTab('orders')}>
                  ← Back to Orders
                </button>
              </div>

              {/* Order Meta Header Form */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16, marginBottom: 24 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>
                    Recipient / Applicant Factory *
                  </label>
                  <select
                    value={selectedRecipientId}
                    onChange={e => handleRecipientChange(e.target.value)}
                    style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid var(--border)', fontSize: 13, background: 'var(--bg-base)' }}
                  >
                    <option value="">-- Select Factory / Recipient --</option>
                    {recipients.map(r => (
                      <option key={r.id} value={r.id}>{r.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                    <label style={{ fontSize: 12, fontWeight: 600, margin: 0 }}>
                      Proforma Invoice No. *
                    </label>
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      style={{ fontSize: 11, padding: '0 4px', height: 'auto', color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: 4 }}
                      onClick={() => generateNextPiNumber(applicantName)}
                      title="Auto-generate next number"
                    >
                      <RefreshCw size={11} /> Auto-Generate
                    </button>
                  </div>
                  <input
                    type="text"
                    value={piNumber}
                    onChange={e => setPiNumber(e.target.value)}
                    placeholder="Auto-generating..."
                    style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid var(--border)', fontSize: 13, fontWeight: 600, fontFamily: 'monospace', background: 'var(--bg-base)' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>
                    PI Date *
                  </label>
                  <input
                    type="date"
                    value={piDate}
                    onChange={e => setPiDate(e.target.value)}
                    style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid var(--border)', fontSize: 13 }}
                  />
                </div>

                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                    <label style={{ fontSize: 12, fontWeight: 600, margin: 0 }}>
                      Buyer Name
                    </label>
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      style={{ fontSize: 11, padding: '0 4px', height: 'auto', color: 'var(--primary)' }}
                      onClick={() => setCustomBuyerMode(!customBuyerMode)}
                    >
                      {customBuyerMode ? '← Select from list' : '+ Type Custom'}
                    </button>
                  </div>
                  {customBuyerMode ? (
                    <input
                      type="text"
                      value={buyer}
                      onChange={e => setBuyer(e.target.value)}
                      placeholder="Type custom buyer name..."
                      style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid var(--border)', fontSize: 13, background: 'var(--bg-base)' }}
                    />
                  ) : (
                    <select
                      value={buyer}
                      onChange={e => {
                        if (e.target.value === '__custom__') {
                          setCustomBuyerMode(true);
                          setBuyer('');
                        } else {
                          setBuyer(e.target.value);
                        }
                      }}
                      style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid var(--border)', fontSize: 13, background: 'var(--bg-base)' }}
                    >
                      <option value="">-- Select Buyer from System --</option>
                      {buyersList.map(bName => (
                        <option key={bName} value={bName}>{bName}</option>
                      ))}
                      <option value="__custom__">+ Enter Custom Buyer...</option>
                    </select>
                  )}
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>
                    Currency
                  </label>
                  <select
                    value={currency}
                    onChange={e => handleCurrencyChange(e.target.value)}
                    style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid var(--border)', fontSize: 13, background: 'var(--bg-base)' }}
                  >
                    <option value="USD">USD ($)</option>
                    <option value="BDT">BDT (৳)</option>
                    <option value="EUR">EUR (€)</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>
                    Applicant Address
                  </label>
                  <input
                    type="text"
                    value={applicantAddress}
                    onChange={e => setApplicantAddress(e.target.value)}
                    placeholder="Factory Address"
                    style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid var(--border)', fontSize: 13 }}
                  />
                </div>
              </div>

              {/* Line Items Table */}
              <div style={{ marginBottom: 24 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <h4 style={{ margin: 0, fontSize: 14, fontWeight: 700 }}>Ordered Items & Unit Pricing</h4>
                  <button className="btn btn-outline btn-sm" onClick={handleAddLineItem} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Plus size={14} /> Add Line Item
                  </button>
                </div>

                <div style={{ border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                    <thead>
                      <tr style={{ background: 'var(--bg-base)', borderBottom: '1px solid var(--border)', color: 'var(--text-muted)' }}>
                        <th style={{ padding: '8px 10px', width: 40 }}>#</th>
                        <th style={{ padding: '8px 10px', width: 220 }}>SELECT INVENTORY ITEM (OPTIONAL)</th>
                        <th style={{ padding: '8px 10px' }}>ITEM DESCRIPTION *</th>
                        <th style={{ padding: '8px 10px', width: 140 }}>PO / STYLE NO.</th>
                        <th style={{ padding: '8px 10px', width: 110, textAlign: 'right' }}>ORDER QTY *</th>
                        <th style={{ padding: '8px 10px', width: 70, textAlign: 'center' }}>UNIT</th>
                        <th style={{ padding: '8px 10px', width: 100, textAlign: 'right' }}>UNIT PRICE *</th>
                        <th style={{ padding: '8px 10px', width: 110, textAlign: 'right' }}>TOTAL ({currencySymbol})</th>
                        <th style={{ padding: '8px 10px', width: 40 }}></th>
                      </tr>
                    </thead>
                    <tbody>
                      {piItems.length === 0 ? (
                        <tr>
                          <td colSpan={9} style={{ padding: 30, textAlign: 'center', color: 'var(--text-muted)' }}>
                            No items added yet. Click "+ Add Line Item" above to add accessories to this Proforma Invoice.
                          </td>
                        </tr>
                      ) : (
                        piItems.map((item, idx) => (
                          <tr key={idx} style={{ borderBottom: '1px solid var(--border)' }}>
                            <td style={{ padding: '8px 10px', color: 'var(--text-muted)' }}>{idx + 1}</td>
                            <td style={{ padding: '8px 10px' }}>
                              <select
                                value={item.itemId || ''}
                                onChange={e => handleSelectInventoryItem(idx, e.target.value)}
                                style={{ width: '100%', padding: '5px 8px', borderRadius: 4, border: '1px solid var(--border)', fontSize: 12, background: 'var(--bg-base)' }}
                              >
                                <option value="">-- Or type manually --</option>
                                {inventoryItems.map(inv => (
                                  <option key={inv.id} value={inv.id}>{inv.name} ({inv.item_code})</option>
                                ))}
                              </select>
                            </td>
                            <td style={{ padding: '8px 10px' }}>
                              <input
                                type="text"
                                value={item.itemDescription}
                                onChange={e => handleUpdateItemField(idx, 'itemDescription', e.target.value)}
                                placeholder="e.g. 100% COTTON TWILL TAPE (12MM)"
                                style={{ width: '100%', padding: '5px 8px', borderRadius: 4, border: '1px solid var(--border)', fontSize: 12 }}
                              />
                            </td>
                            <td style={{ padding: '8px 10px' }}>
                              <input
                                type="text"
                                value={item.poStyleNo}
                                onChange={e => handleUpdateItemField(idx, 'poStyleNo', e.target.value)}
                                placeholder="Style / PO"
                                style={{ width: '100%', padding: '5px 8px', borderRadius: 4, border: '1px solid var(--border)', fontSize: 12 }}
                              />
                            </td>
                            <td style={{ padding: '8px 10px', textAlign: 'right' }}>
                              <input
                                type="number"
                                step="any"
                                min="1"
                                value={item.quantity}
                                onChange={e => handleUpdateItemField(idx, 'quantity', e.target.value)}
                                style={{ width: '100%', padding: '5px 8px', textAlign: 'right', borderRadius: 4, border: '1px solid var(--border)', fontSize: 12, fontWeight: 600 }}
                              />
                            </td>
                            <td style={{ padding: '8px 10px', textAlign: 'center' }}>
                              <input
                                type="text"
                                value={item.unit}
                                onChange={e => handleUpdateItemField(idx, 'unit', e.target.value.toUpperCase())}
                                style={{ width: '100%', padding: '5px 8px', textAlign: 'center', borderRadius: 4, border: '1px solid var(--border)', fontSize: 12 }}
                              />
                            </td>
                            <td style={{ padding: '8px 10px', textAlign: 'right' }}>
                              <input
                                type="number"
                                step="0.0001"
                                min="0"
                                value={item.unitPrice}
                                onChange={e => handleUpdateItemField(idx, 'unitPrice', e.target.value)}
                                style={{ width: '100%', padding: '5px 8px', textAlign: 'right', borderRadius: 4, border: '1px solid var(--border)', fontSize: 12, fontWeight: 600 }}
                              />
                            </td>
                            <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 700 }}>
                              {currencySymbol} {Number(item.totalAmount || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </td>
                            <td style={{ padding: '8px 10px', textAlign: 'center' }}>
                              <button
                                className="btn btn-ghost btn-sm btn-icon"
                                onClick={() => handleRemoveLineItem(idx)}
                                style={{ color: 'var(--danger, #ef4444)' }}
                              >
                                <Trash2 size={14} />
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                    {piItems.length > 0 && (
                      <tfoot>
                        <tr style={{ background: 'var(--bg-base)', borderTop: '2px solid var(--border)', fontWeight: 700 }}>
                          <td colSpan={4} style={{ padding: '10px 12px', textAlign: 'right' }}>TOTAL ORDER:</td>
                          <td style={{ padding: '10px 8px', textAlign: 'right', fontSize: 13 }}>
                            {totalQuantity.toLocaleString()}
                          </td>
                          <td></td>
                          <td style={{ padding: '10px 8px', textAlign: 'right' }}></td>
                          <td style={{ padding: '10px 8px', textAlign: 'right', fontSize: 14, color: 'var(--primary)' }}>
                            {currencySymbol} {totalAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </td>
                          <td></td>
                        </tr>
                      </tfoot>
                    )}
                  </table>
                </div>
              </div>

              {/* Amount in words & Terms */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 16, marginBottom: 24 }}>
                <div style={{ gridColumn: '1 / -1', padding: 12, background: 'var(--bg-base)', borderRadius: 6, border: '1px solid var(--border)' }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)' }}>AMOUNT IN WORDS:</div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', marginTop: 2 }}>{amountInWords}</div>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Net Weight</label>
                  <input
                    type="text"
                    value={netWeight}
                    onChange={e => setNetWeight(e.target.value)}
                    style={{ width: '100%', padding: '7px 10px', borderRadius: 6, border: '1px solid var(--border)', fontSize: 12 }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Gross Weight</label>
                  <input
                    type="text"
                    value={grossWeight}
                    onChange={e => setGrossWeight(e.target.value)}
                    style={{ width: '100%', padding: '7px 10px', borderRadius: 6, border: '1px solid var(--border)', fontSize: 12 }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Terms and Conditions</label>
                  <input
                    type="text"
                    value={termsConditions}
                    onChange={e => setTermsConditions(e.target.value)}
                    style={{ width: '100%', padding: '7px 10px', borderRadius: 6, border: '1px solid var(--border)', fontSize: 12 }}
                  />
                </div>
              </div>

              {/* Action buttons */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
                <button className="btn btn-outline" onClick={() => setPiSubTab('orders')} disabled={savingPi}>
                  Cancel
                </button>
                <button className="btn btn-primary" onClick={() => handleSavePi('APPROVED')} disabled={savingPi} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <CheckCircle size={16} /> {savingPi ? 'Creating PI...' : 'Create & Approve Proforma Invoice'}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* SECTION 2: COMMERCIAL BILLS & INVOICES */}
      {/* ========================================================================= */}
      {activeSection === 'bills' && (
        <div>
          {/* Bills Header Bar */}
          <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 10, padding: 14, marginBottom: 20 }}>
            <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
              <div style={{ position: 'relative', flex: 1 }}>
                <Search size={16} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                <input
                  type="text"
                  placeholder="Search by Bill #, Applicant, PI Ref, Challan #..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  style={{ width: '100%', padding: '7px 10px 7px 32px', borderRadius: 6, border: '1px solid var(--border)', fontSize: 13, background: 'var(--bg-base)' }}
                />
              </div>
              <select
                value={recipientFilter}
                onChange={e => setRecipientFilter(e.target.value)}
                style={{ padding: '7px 12px', borderRadius: 6, border: '1px solid var(--border)', fontSize: 13, background: 'var(--bg-base)', minWidth: 200 }}
              >
                <option value="">All Applicants / Factories</option>
                {recipients.map(r => (
                  <option key={r.id} value={r.id}>{r.name}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Bills List Table */}
          <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 13 }}>
              <thead>
                <tr style={{ background: 'var(--bg-base, rgba(0,0,0,0.02))', borderBottom: '1px solid var(--border)', color: 'var(--text-muted)', fontSize: 12 }}>
                  <th style={{ padding: '12px 16px' }}>BILL NUMBER</th>
                  <th style={{ padding: '12px 16px' }}>BILL DATE</th>
                  <th style={{ padding: '12px 16px' }}>APPLICANT / FACTORY</th>
                  <th style={{ padding: '12px 16px' }}>PI REF NO</th>
                  <th style={{ padding: '12px 16px' }}>LINKED CHALLAN(S)</th>
                  <th style={{ padding: '12px 16px', textAlign: 'right' }}>TOTAL AMOUNT</th>
                  <th style={{ padding: '12px 16px', textAlign: 'center' }}>TYPE</th>
                  <th style={{ padding: '12px 16px', textAlign: 'right' }}>ACTION</th>
                </tr>
              </thead>
              <tbody>
                {billsList.length === 0 ? (
                  <tr>
                    <td colSpan={8} style={{ padding: 48, textAlign: 'center', color: 'var(--text-muted)' }}>
                      <Landmark size={40} style={{ opacity: 0.3, marginBottom: 10 }} />
                      <p style={{ margin: 0, fontSize: 14 }}>No Commercial Bills found.</p>
                      <p style={{ margin: '4px 0 0 0', fontSize: 12, color: 'var(--text-muted)' }}>
                        Completed Proforma Invoices will appear here once 100% received and transferred to Bill.
                      </p>
                    </td>
                  </tr>
                ) : (
                  billsList.map(b => (
                    <tr key={b.id} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ padding: '12px 16px', fontWeight: 700, color: 'var(--primary)' }}>
                        {b.bill_number}
                      </td>
                      <td style={{ padding: '12px 16px', color: 'var(--text-muted)' }}>
                        {b.bill_date ? new Date(b.bill_date).toLocaleDateString('en-GB') : (b.pi_date ? new Date(b.pi_date).toLocaleDateString('en-GB') : '-')}
                      </td>
                      <td style={{ padding: '12px 16px', fontWeight: 600 }}>
                        {b.applicant_name}
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        {b.pi_number ? (
                          <span style={{ padding: '2px 6px', borderRadius: 4, background: 'rgba(99,102,241,0.08)', color: '#6366f1', fontSize: 11, fontWeight: 600 }}>
                            {b.pi_number}
                          </span>
                        ) : '-'}
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)', maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={b.challan_numbers}>
                          {b.challan_numbers || '-'}
                        </div>
                      </td>
                      <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 700, color: 'var(--success, #10b981)' }}>
                        {b.currency_symbol || '$'} {Number(b.total_amount || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                        <span style={{ 
                          display: 'inline-flex', padding: '3px 8px', borderRadius: 12, 
                          background: 'rgba(16,185,129,0.12)', color: '#059669', fontSize: 11, fontWeight: 600 
                        }}>
                          Commercial Bill
                        </span>
                      </td>
                      <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                        <button
                          className="btn btn-primary btn-sm"
                          onClick={() => handlePreview(b, 'bill')}
                          style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}
                        >
                          <Printer size={13} /> View / Print Bill
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* RECONCILIATION & TRANSFER MODAL */}
      {/* ========================================================================= */}
      {reconciliationModalPi && (
        <div className="modal-backdrop" style={{ 
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, 
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 
        }}>
          <div style={{ 
            background: 'var(--bg-card, #ffffff)', borderRadius: 12, width: '100%', maxWidth: 860, 
            maxHeight: '90vh', overflowY: 'auto', padding: 24, boxShadow: '0 20px 25px -5px rgba(0,0,0,0.2)' 
          }}>
            {/* Modal Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid var(--border)', paddingBottom: 16, marginBottom: 20 }}>
              <div>
                <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <BarChart3 color="var(--primary)" size={22} />
                  PI Order Reconciliation & Bill Transfer
                </h3>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
                  PI No: <strong>{reconciliationModalPi.pi_number}</strong> | Applicant: <strong>{reconciliationModalPi.applicant_name}</strong>
                </div>
              </div>
              <button className="btn btn-ghost btn-icon btn-sm" onClick={() => setReconciliationModalPi(null)}>
                <X size={18} />
              </button>
            </div>

            {loadingRecon ? (
              <div style={{ padding: 40, textAlign: 'center' }}>
                <RefreshCw size={24} className="spin" style={{ margin: '0 auto 10px auto' }} />
                <p>Calculating order vs delivery vs receipt status...</p>
              </div>
            ) : reconciliationData ? (
              <div>
                {/* Progress bar banner */}
                <div style={{ 
                  padding: 16, borderRadius: 8, marginBottom: 20,
                  background: reconciliationData.is100PercentReceived ? 'rgba(16,185,129,0.1)' : 'rgba(99,102,241,0.08)',
                  border: `1px solid ${reconciliationData.is100PercentReceived ? 'var(--success, #10b981)' : 'var(--primary)'}`
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: reconciliationData.is100PercentReceived ? 'var(--success, #10b981)' : 'var(--primary)' }}>
                      {reconciliationData.is100PercentReceived 
                        ? '✓ All Items 100% Received by Recipient - Ready for Commercial Bill Transfer'
                        : `Pending Full Receipt (${reconciliationData.overallFulfillmentPct}% fulfilled)`}
                    </span>
                    <span style={{ fontSize: 14, fontWeight: 800 }}>
                      {reconciliationData.totalReceived.toLocaleString()} / {reconciliationData.totalOrdered.toLocaleString()} PCS
                    </span>
                  </div>
                  <div style={{ height: 8, background: 'var(--border)', borderRadius: 4, overflow: 'hidden' }}>
                    <div style={{ 
                      height: '100%', 
                      width: `${reconciliationData.overallFulfillmentPct}%`, 
                      background: reconciliationData.is100PercentReceived ? 'var(--success, #10b981)' : 'var(--primary)' 
                    }} />
                  </div>
                </div>

                {/* Items breakdown table */}
                <h4 style={{ margin: '0 0 10px 0', fontSize: 13, fontWeight: 700 }}>Item-by-Item Verification:</h4>
                <div style={{ border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden', marginBottom: 20 }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                    <thead>
                      <tr style={{ background: 'var(--bg-base)', borderBottom: '1px solid var(--border)', color: 'var(--text-muted)' }}>
                        <th style={{ padding: '8px 10px' }}>ITEM DESCRIPTION</th>
                        <th style={{ padding: '8px 10px' }}>STYLE / PO</th>
                        <th style={{ padding: '8px 10px', textAlign: 'right' }}>ORDER QTY</th>
                        <th style={{ padding: '8px 10px', textAlign: 'right' }}>DISPATCHED</th>
                        <th style={{ padding: '8px 10px', textAlign: 'right' }}>RECEIVED</th>
                        <th style={{ padding: '8px 10px', textAlign: 'right' }}>REMAINING</th>
                        <th style={{ padding: '8px 10px', textAlign: 'center' }}>STATUS</th>
                      </tr>
                    </thead>
                    <tbody>
                      {reconciliationData.items.map((it, idx) => (
                        <tr key={idx} style={{ borderBottom: '1px solid var(--border)' }}>
                          <td style={{ padding: '8px 10px', fontWeight: 600 }}>{it.item_description}</td>
                          <td style={{ padding: '8px 10px', color: 'var(--text-muted)' }}>{it.po_style_no || '-'}</td>
                          <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 600 }}>
                            {it.orderQuantity} {it.unit}
                          </td>
                          <td style={{ padding: '8px 10px', textAlign: 'right', color: 'var(--text-muted)' }}>
                            {it.dispatchedQuantity}
                          </td>
                          <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 700, color: it.isFullyReceived ? 'var(--success, #10b981)' : 'var(--danger, #ef4444)' }}>
                            {it.receivedQuantity}
                          </td>
                          <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 600, color: it.remainingToReceive > 0 ? 'var(--warning, #f59e0b)' : 'var(--text-muted)' }}>
                            {it.remainingToReceive > 0 ? it.remainingToReceive : '0'}
                          </td>
                          <td style={{ padding: '8px 10px', textAlign: 'center' }}>
                            {it.isFullyReceived ? (
                              <span style={{ color: 'var(--success, #10b981)', fontWeight: 600 }}>✓ Matched</span>
                            ) : (
                              <span style={{ color: 'var(--warning, #f59e0b)', fontWeight: 600 }}>Pending</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Linked Challans Section */}
                <h4 style={{ margin: '0 0 10px 0', fontSize: 13, fontWeight: 700 }}>
                  Linked Delivery Challans ({reconciliationData.challans.length}):
                </h4>
                {reconciliationData.challans.length === 0 ? (
                  <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 20 }}>
                    No delivery challans dispatched against this PI yet. Create challans linked to this PI to dispatch goods.
                  </p>
                ) : (
                  <div style={{ border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden', marginBottom: 20 }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                      <thead>
                        <tr style={{ background: 'var(--bg-base)', borderBottom: '1px solid var(--border)', color: 'var(--text-muted)' }}>
                          <th style={{ padding: '8px 10px' }}>CHALLAN NO</th>
                          <th style={{ padding: '8px 10px' }}>DATE</th>
                          <th style={{ padding: '8px 10px' }}>RECEIVER</th>
                          <th style={{ padding: '8px 10px' }}>RECEIVED BY</th>
                          <th style={{ padding: '8px 10px', textAlign: 'center' }}>STATUS</th>
                        </tr>
                      </thead>
                      <tbody>
                        {reconciliationData.challans.map(c => (
                          <tr key={c.id} style={{ borderBottom: '1px solid var(--border)' }}>
                            <td style={{ padding: '8px 10px', fontWeight: 600, color: 'var(--primary)' }}>{c.challan_number}</td>
                            <td style={{ padding: '8px 10px', color: 'var(--text-muted)' }}>{new Date(c.challan_date).toLocaleDateString('en-GB')}</td>
                            <td style={{ padding: '8px 10px' }}>{c.receiver_name}</td>
                            <td style={{ padding: '8px 10px' }}>{c.received_by || '-'}</td>
                            <td style={{ padding: '8px 10px', textAlign: 'center' }}>
                              <span style={{ 
                                padding: '2px 6px', borderRadius: 4, fontSize: 11, fontWeight: 600,
                                background: c.received_status === 'RECEIVED' ? 'rgba(16,185,129,0.1)' : 'rgba(245,158,11,0.1)',
                                color: c.received_status === 'RECEIVED' ? '#059669' : '#d97706'
                              }}>
                                {c.received_status || 'PENDING'}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* Transfer Action Bar */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--border)', paddingTop: 16 }}>
                  <div>
                    {!reconciliationData.is100PercentReceived && (
                      <span style={{ fontSize: 12, color: 'var(--danger, #ef4444)', fontWeight: 600 }}>
                        ⚠️ Cannot transfer to Bill until all items are 100% received from recipient side.
                      </span>
                    )}
                    {reconciliationData.pi.status === 'BILLED' && (
                      <span style={{ fontSize: 12, color: 'var(--success, #10b981)', fontWeight: 600 }}>
                        ✓ Already transferred to Bill: {reconciliationData.pi.bill_number}
                      </span>
                    )}
                  </div>

                  <div style={{ display: 'flex', gap: 10 }}>
                    <button className="btn btn-outline" onClick={() => setReconciliationModalPi(null)}>
                      Close
                    </button>
                    {reconciliationData.canTransferToBill && (
                      <button 
                        className="btn btn-primary" 
                        onClick={() => handleTransferToBill(reconciliationModalPi.id)}
                        disabled={transferring}
                        style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700 }}
                      >
                        <CheckCircle size={16} /> {transferring ? 'Transferring...' : 'Transfer to Commercial Bill'}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* PRINT VIEW PREVIEW MODAL */}
      {/* ========================================================================= */}
      {previewPi && (
        <div className="modal-backdrop" style={{ 
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', zIndex: 1100, 
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 
        }}>
          <div style={{ 
            background: 'var(--bg-card, #ffffff)', borderRadius: 12, width: '100%', maxWidth: 960, 
            maxHeight: '94vh', overflowY: 'auto', padding: 24, boxShadow: '0 25px 50px -12px rgba(0,0,0,0.3)' 
          }}>
            <ProformaInvoicePrintView
              pi={previewPi}
              mode={previewMode}
              isModal={true}
              onClose={() => setPreviewPi(null)}
              onPrint={() => window.print()}
            />
          </div>
        </div>
      )}
    </div>
  );
}

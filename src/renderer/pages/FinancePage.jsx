import React, { useState, useEffect, useCallback, useMemo } from 'react';
import useStore from '../store/useStore';
import { 
  Landmark, FileText, Plus, Trash2, Printer, Download, Eye, 
  Search, CheckCircle, RefreshCw, Layers, DollarSign, Calendar, 
  ChevronRight, Building, Truck, Edit3, X, AlertCircle,
  Filter, RotateCcw, Check, CheckSquare, ChevronDown, ChevronUp
} from 'lucide-react';
import { numberToCurrencyWords } from '../utils/numberToWords';
import ProformaInvoicePrintView from '../components/finance/ProformaInvoicePrintView';

export default function FinancePage() {
  const { addToast, user, showConfirm } = useStore();

  const [activeTab, setActiveTab] = useState('create'); // 'create' or 'history'
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState([]);
  const [historySearch, setHistorySearch] = useState('');
  const [historyRecipientFilter, setHistoryRecipientFilter] = useState('');

  // Dropdown data
  const [recipients, setRecipients] = useState([]);
  const [allChallans, setAllChallans] = useState([]);
  const [usedChallanIds, setUsedChallanIds] = useState([]);

  // Form State
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
  const [piNumber, setPiNumber] = useState('');
  const [billNumber, setBillNumber] = useState('');
  const [piDate, setPiDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [billDate, setBillDate] = useState(() => new Date().toISOString().split('T')[0]);

  const [selectedChallans, setSelectedChallans] = useState([]);
  const [challanSearch, setChallanSearch] = useState('');
  const [showAllChallans, setShowAllChallans] = useState(false);
  const [challanRecipientFilter, setChallanRecipientFilter] = useState('');
  const [challanDateFrom, setChallanDateFrom] = useState('');
  const [challanDateTo, setChallanDateTo] = useState('');
  const [challanBuyerFilter, setChallanBuyerFilter] = useState('');
  const [challanStyleFilter, setChallanStyleFilter] = useState('');
  const [challanInvoiceStatus, setChallanInvoiceStatus] = useState('all'); // 'all', 'uninvoiced', 'invoiced'
  const [challanSelectionStatus, setChallanSelectionStatus] = useState('all'); // 'all', 'unselected', 'selected'
  const [isSearchingServer, setIsSearchingServer] = useState(false);

  // Items in PI
  const [piItems, setPiItems] = useState([]);
  const [netWeight, setNetWeight] = useState('250 KGS');
  const [grossWeight, setGrossWeight] = useState('260 KGS');
  const [termsConditions, setTermsConditions] = useState('CASH ON DELIVERY.');
  const [currency, setCurrency] = useState('USD');
  const [currencySymbol, setCurrencySymbol] = useState('$');

  // Preview Modal State
  const [previewPi, setPreviewPi] = useState(null);
  const [saving, setSaving] = useState(false);

  // Load Recipients, Challans, and History
  const loadInitialData = useCallback(async () => {
    setLoading(true);
    try {
      const [recRes, chalRes, usedRes] = await Promise.all([
        window.kadal.recipients.getAll().catch(() => ({ success: false, data: [] })),
        window.kadal.challans.getAll({ status: 'ACTIVE', limit: 2000 }).catch(() => ({ success: false, data: [] })),
        window.kadal.finance?.getUsedChallanIds().catch(() => ({ success: false, data: [] }))
      ]);

      if (recRes?.success) setRecipients(recRes.data || []);
      else if (Array.isArray(recRes)) setRecipients(recRes);

      if (chalRes?.success) setAllChallans(chalRes.data || []);
      else if (Array.isArray(chalRes)) setAllChallans(chalRes);

      if (usedRes?.success) setUsedChallanIds(usedRes.data || []);
      else if (Array.isArray(usedRes)) setUsedChallanIds(usedRes);
    } catch (e) {
      console.error('Failed to load initial data:', e);
    }
    setLoading(false);
  }, []);

  const loadHistory = useCallback(async () => {
    try {
      const res = await window.kadal.finance.getAll();
      if (res.success) setHistory(res.data || []);
    } catch (e) {
      console.error('Failed to load PI history:', e);
    }
  }, []);

  useEffect(() => {
    loadInitialData();
  }, [loadInitialData]);

  useEffect(() => {
    if (activeTab === 'history') {
      loadHistory();
    }
  }, [activeTab, loadHistory]);

  // When recipient changes, update applicant fields and auto-suggest PI and Bill numbers
  const handleRecipientChange = async (recId) => {
    const rId = Number(recId);
    setSelectedRecipientId(rId);

    const rec = recipients.find(r => r.id === rId);
    if (rec) {
      setApplicantName(rec.name);
      setApplicantAddress(rec.receiver_address || '');

      // Generate next PI number and Bill number
      try {
        const [nextPi, nextBill] = await Promise.all([
          window.kadal.finance.getNextNumber(rec.name),
          window.kadal.finance.getNextBillNumber(rec.name)
        ]);
        if (nextPi.success) setPiNumber(nextPi.data);
        if (nextBill.success) setBillNumber(nextBill.data);
      } catch (err) {
        console.error('Error generating numbers:', err);
      }
    } else {
      setApplicantName('');
      setApplicantAddress('');
    }
  };

  // Extract distinct buyers and recipients for filters
  const distinctBuyers = useMemo(() => {
    const set = new Set();
    allChallans.forEach(c => {
      if (c.buyer_names) {
        c.buyer_names.split(',').forEach(b => {
          const t = b.trim();
          if (t) set.add(t);
        });
      }
    });
    return Array.from(set).sort();
  }, [allChallans]);

  const distinctRecipients = useMemo(() => {
    const set = new Set();
    recipients.forEach(r => { if (r.name) set.add(r.name.trim()); });
    allChallans.forEach(c => { if (c.receiver_name) set.add(c.receiver_name.trim()); });
    return Array.from(set).sort();
  }, [recipients, allChallans]);

  // Date filter presets
  const setDatePresetToday = () => {
    const today = new Date().toISOString().split('T')[0];
    setChallanDateFrom(today);
    setChallanDateTo(today);
  };

  const setDatePresetLast7Days = () => {
    const d = new Date();
    const to = d.toISOString().split('T')[0];
    d.setDate(d.getDate() - 7);
    const from = d.toISOString().split('T')[0];
    setChallanDateFrom(from);
    setChallanDateTo(to);
  };

  const setDatePresetThisMonth = () => {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const lastDay = new Date(y, now.getMonth() + 1, 0).getDate();
    setChallanDateFrom(`${y}-${m}-01`);
    setChallanDateTo(`${y}-${m}-${lastDay}`);
  };

  const setDatePresetThisYear = () => {
    const y = new Date().getFullYear();
    setChallanDateFrom(`${y}-01-01`);
    setChallanDateTo(`${y}-12-31`);
  };

  const clearDatePreset = () => {
    setChallanDateFrom('');
    setChallanDateTo('');
  };

  const handleResetChallanFilters = () => {
    setChallanSearch('');
    setChallanRecipientFilter('');
    setShowAllChallans(false);
    setChallanDateFrom('');
    setChallanDateTo('');
    setChallanBuyerFilter('');
    setChallanStyleFilter('');
    setChallanInvoiceStatus('all');
    setChallanSelectionStatus('all');
  };

  const hasActiveChallanFilters = Boolean(
    challanSearch.trim() ||
    challanRecipientFilter ||
    showAllChallans ||
    challanDateFrom ||
    challanDateTo ||
    challanBuyerFilter ||
    challanStyleFilter.trim() ||
    challanInvoiceStatus !== 'all' ||
    challanSelectionStatus !== 'all'
  );

  const handleRemoteSearch = async () => {
    if (!challanSearch.trim()) return;
    setIsSearchingServer(true);
    try {
      const res = await window.kadal.challans.getAll({
        search: challanSearch.trim(),
        limit: 100
      });
      const data = res?.data || (Array.isArray(res) ? res : []);
      if (data.length > 0) {
        setAllChallans(prev => {
          const existingIds = new Set(prev.map(c => c.id));
          const newOnes = data.filter(c => !existingIds.has(c.id));
          return newOnes.length > 0 ? [...newOnes, ...prev] : prev;
        });
        addToast('success', `Found ${data.length} challan(s) matching "${challanSearch.trim()}"`);
      } else {
        addToast('info', `No challans found in database for "${challanSearch.trim()}"`);
      }
    } catch (e) {
      console.error('Remote search error:', e);
      addToast('error', 'Search error: ' + e.message);
    }
    setIsSearchingServer(false);
  };

  // Filter available challans with multi-field search and robust filters
  const availableChallans = useMemo(() => {
    return allChallans.filter(c => {
      const isSelected = selectedChallans.some(sc => sc.id === c.id);
      const isUsed = usedChallanIds.includes(c.id);

      // Selection filter:
      if (challanSelectionStatus === 'selected' && !isSelected) return false;
      if (challanSelectionStatus === 'unselected' && isSelected && !challanSearch.trim()) return false;

      // Invoiced status filter:
      if (challanInvoiceStatus === 'uninvoiced' && isUsed) return false;
      if (challanInvoiceStatus === 'invoiced' && !isUsed) return false;

      // Recipient filter:
      if (challanRecipientFilter && challanRecipientFilter !== 'ALL') {
        const matchesRec = (c.receiver_name || '').trim().toLowerCase() === challanRecipientFilter.trim().toLowerCase();
        if (!matchesRec) return false;
      } else if (!showAllChallans && applicantName && challanRecipientFilter !== 'ALL') {
        const matchesApplicant = (c.receiver_name || '').trim().toLowerCase() === applicantName.trim().toLowerCase();
        // If user typed a search query matching this challan number specifically, do not filter out by applicant
        const searchMatchesNum = challanSearch.trim() && (c.challan_number || '').toLowerCase().includes(challanSearch.trim().toLowerCase());
        if (!matchesApplicant && !searchMatchesNum) return false;
      }

      // Date Range filter:
      if (challanDateFrom) {
        const cDate = c.challan_date ? c.challan_date.split('T')[0] : '';
        if (cDate && cDate < challanDateFrom) return false;
      }
      if (challanDateTo) {
        const cDate = c.challan_date ? c.challan_date.split('T')[0] : '';
        if (cDate && cDate > challanDateTo) return false;
      }

      // Buyer filter:
      if (challanBuyerFilter) {
        const b = (c.buyer_names || '').toLowerCase();
        if (!b.includes(challanBuyerFilter.toLowerCase())) return false;
      }

      // Style / Order / PO filter:
      if (challanStyleFilter.trim()) {
        const sf = challanStyleFilter.toLowerCase();
        const matchStyle = (c.style_names || '').toLowerCase().includes(sf);
        const matchOrder = (c.order_numbers || '').toLowerCase().includes(sf);
        const matchPurchase = (c.purchase_nos || '').toLowerCase().includes(sf);
        if (!matchStyle && !matchOrder && !matchPurchase) return false;
      }

      // Search query (search across number, receiver, item, buyer, style, order, purchase)
      if (challanSearch.trim()) {
        const q = challanSearch.toLowerCase();
        const matchNum = (c.challan_number || '').toLowerCase().includes(q);
        const matchRec = (c.receiver_name || '').toLowerCase().includes(q);
        const matchItem = (c.item_names || '').toLowerCase().includes(q);
        const matchBuyer = (c.buyer_names || '').toLowerCase().includes(q);
        const matchStyle = (c.style_names || '').toLowerCase().includes(q);
        const matchOrder = (c.order_numbers || '').toLowerCase().includes(q);
        const matchPurchase = (c.purchase_nos || '').toLowerCase().includes(q);
        if (!matchNum && !matchRec && !matchItem && !matchBuyer && !matchStyle && !matchOrder && !matchPurchase) {
          return false;
        }
      }

      return true;
    });
  }, [
    allChallans, selectedChallans, usedChallanIds, showAllChallans, 
    applicantName, challanSearch, challanRecipientFilter, 
    challanDateFrom, challanDateTo, challanInvoiceStatus, 
    challanBuyerFilter, challanStyleFilter, challanSelectionStatus
  ]);

  // Toggle selection for all visible challans
  const areAllVisibleSelected = useMemo(() => {
    if (availableChallans.length === 0) return false;
    return availableChallans.every(c => selectedChallans.some(sc => sc.id === c.id));
  }, [availableChallans, selectedChallans]);

  const handleToggleSelectAllVisible = async () => {
    if (areAllVisibleSelected) {
      const visibleIds = new Set(availableChallans.map(c => c.id));
      const remaining = selectedChallans.filter(c => !visibleIds.has(c.id));
      setSelectedChallans(remaining);
      await syncItemsFromChallans(remaining);
    } else {
      const selectedIds = new Set(selectedChallans.map(c => c.id));
      const toAdd = availableChallans.filter(c => !selectedIds.has(c.id));
      const updated = [...selectedChallans, ...toAdd];
      setSelectedChallans(updated);
      await syncItemsFromChallans(updated);
    }
  };

  const handleClearAllSelected = async () => {
    setSelectedChallans([]);
    await syncItemsFromChallans([]);
  };

  // Add a challan to selection
  const handleSelectChallan = async (challan) => {
    if (selectedChallans.some(sc => sc.id === challan.id)) return;
    const updatedChallans = [...selectedChallans, challan];
    setSelectedChallans(updatedChallans);
    await syncItemsFromChallans(updatedChallans);
  };

  // Remove a challan from selection
  const handleRemoveChallan = async (challanId) => {
    const updatedChallans = selectedChallans.filter(c => c.id !== challanId);
    setSelectedChallans(updatedChallans);
    await syncItemsFromChallans(updatedChallans);
  };

  // Auto-aggregate / sync items from all selected challans
  const syncItemsFromChallans = async (challans) => {
    if (challans.length === 0) {
      setPiItems([]);
      return;
    }

    try {
      // Fetch full details of each challan
      const fullChallans = await Promise.all(
        challans.map(async c => {
          try {
            const r = await window.kadal.challans.getById(c.id);
            return r?.data || (r?.items ? r : c);
          } catch (e) {
            console.warn('Failed to get challan by id:', c.id, e);
            return c;
          }
        })
      );

      // Collect all items and check if any need fallback lookup from inventory items
      const rawItems = [];
      const buyersList = [];
      const purchaseNosList = [];
      const billDatesList = [];
      const missingItemIds = new Set();

      for (const fc of fullChallans) {
        if (fc.challan_date) billDatesList.push(fc.challan_date);
        const items = fc.items || fc.challan_items || [];
        for (const it of items) {
          const itemId = it.item_id || it.itemId;
          if (itemId && (!it.item_name || it.unit_price === undefined || !it.order_number || !it.style_name)) {
            missingItemIds.add(itemId);
          }
        }
      }

      // If any items are missing details, fetch them directly from inventory
      const fallbackItemMap = new Map();
      if (missingItemIds.size > 0 && window.kadal?.items?.getById) {
        try {
          const fetchedItems = await Promise.all(
            Array.from(missingItemIds).map(id => window.kadal.items.getById(id).catch(() => null))
          );
          for (const res of fetchedItems) {
            const item = res?.data || res;
            if (item && item.id) {
              fallbackItemMap.set(item.id, item);
            }
          }
        } catch (e) {
          console.warn('Error fetching missing items fallback:', e);
        }
      }

      for (const fc of fullChallans) {
        const items = fc.items || fc.challan_items || [];
        for (const it of items) {
          const itemId = it.item_id || it.itemId;
          const fallback = fallbackItemMap.get(itemId) || {};
          const itemObj = it.items || fallback || {};

          const name = it.item_name || itemObj.name || it.name || 'Item';
          const size = it.size || itemObj.size || '';
          const color = it.color || itemObj.color || '';
          const styleName = it.style_name || itemObj.style_name || '';
          const orderNumber = it.order_number || itemObj.order_number || '';
          const purchaseNo = it.purchase_no || itemObj.purchase_no || '';
          const buyerName = it.buyer_name || itemObj.buyer_name || '';
          const quantity = Number(it.quantity) || 0;
          const unit = (it.unit || itemObj.unit || 'PCS').toUpperCase();
          const unitPrice = Number(it.unit_price !== undefined ? it.unit_price : (itemObj.unit_price !== undefined ? itemObj.unit_price : 0));

          rawItems.push({
            challanId: fc.id,
            challanNumber: fc.challan_number,
            itemId,
            name,
            size,
            color,
            styleName,
            orderNumber,
            purchaseNo,
            buyerName,
            quantity,
            unit,
            unitPrice,
          });

          if (buyerName) buyersList.push(buyerName);
          if (purchaseNo && !['N/A', 'NA', 'NONE', '-'].includes(purchaseNo.trim().toUpperCase())) {
            purchaseNosList.push(purchaseNo);
          }
        }
      }

      // Group items with identical item description and style
      // or group by item description + unit
      const groupedMap = new Map();

      for (const item of rawItems) {
        // Construct description
        let desc = item.name || 'ACCESSORY ITEM';
        const cleanSize = (item.size || '').trim();
        if (cleanSize && !['N/A', 'NA', 'NONE', '-'].includes(cleanSize.toUpperCase())) {
          if (!desc.toLowerCase().includes(cleanSize.toLowerCase())) {
            desc += ` (${cleanSize})`;
          }
        }

        // Construct PO & Style No
        const poParts = [];
        const cleanOrder = (item.orderNumber || '').trim();
        const cleanStyle = (item.styleName || '').trim();
        const cleanPurchase = (item.purchaseNo || '').trim();

        if (cleanOrder && !['N/A', 'NA', 'NONE', '-'].includes(cleanOrder.toUpperCase())) {
          poParts.push(cleanOrder);
        }
        if (cleanStyle && !['N/A', 'NA', 'NONE', 'ALL', '-'].includes(cleanStyle.toUpperCase())) {
          poParts.push(cleanStyle);
        }
        if (poParts.length === 0 && cleanPurchase && !['N/A', 'NA', 'NONE', '-'].includes(cleanPurchase.toUpperCase())) {
          poParts.push(cleanPurchase);
        }

        const poStyle = poParts.join('+') || '-';
        const key = `${desc.trim().toLowerCase()}||${poStyle.trim().toLowerCase()}||${item.unit.trim().toLowerCase()}`;

        if (groupedMap.has(key)) {
          const existing = groupedMap.get(key);
          existing.quantity += item.quantity;
          if (poStyle !== '-' && !existing.poStyleNo.split('+').includes(poStyle)) {
            existing.poStyleNo = existing.poStyleNo === '-' ? poStyle : `${existing.poStyleNo}+${poStyle}`;
            existing.po_style_no = existing.poStyleNo;
          }
        } else {
          groupedMap.set(key, {
            challanId: item.challanId,
            challan_id: item.challanId,
            itemId: item.itemId,
            item_id: item.itemId,
            itemDescription: desc,
            item_description: desc,
            poStyleNo: poStyle,
            po_style_no: poStyle,
            quantity: item.quantity,
            unit: item.unit,
            unitPrice: item.unitPrice,
            unit_price: item.unitPrice,
            totalAmount: 0,
            total_amount: 0
          });
        }
      }

      const aggregated = Array.from(groupedMap.values()).map((it, idx) => {
        const rate = Number(it.unitPrice) || 0;
        const total = Number((it.quantity * rate).toFixed(2));
        return {
          ...it,
          slNo: idx + 1,
          sl_no: idx + 1,
          unitPrice: rate,
          unit_price: rate,
          totalAmount: total,
          total_amount: total
        };
      });

      setPiItems(aggregated);

      // Pre-fill Buyer field if empty
      const uniqueBuyers = [...new Set(buyersList.filter(Boolean))];
      const uniquePurchases = [...new Set(purchaseNosList.filter(Boolean))];
      if (!buyer.trim() && (uniqueBuyers.length > 0 || uniquePurchases.length > 0)) {
        let buyerStr = uniqueBuyers.join(', ');
        if (uniquePurchases.length > 0) {
          buyerStr += ` // PURCHASE NO. ${uniquePurchases.join('+')}`;
        }
        setBuyer(buyerStr);
      }

      // Set Bill Date from first challan if available
      if (billDatesList.length > 0 && !billDate) {
        setBillDate(new Date(billDatesList[0]).toISOString().split('T')[0]);
      }

    } catch (err) {
      console.error('Error syncing items from challans:', err);
      addToast('error', 'Failed to load items from selected challan(s)');
    }
  };

  // Modify unit price for an item
  const handlePriceChange = (index, newPrice) => {
    const priceNum = parseFloat(newPrice) || 0;
    setPiItems(prev => prev.map((item, idx) => {
      if (idx === index) {
        const total = Number((item.quantity * priceNum).toFixed(2));
        return { 
          ...item, 
          unitPrice: priceNum, 
          unit_price: priceNum, 
          totalAmount: total, 
          total_amount: total 
        };
      }
      return item;
    }));
  };

  // Modify quantity for an item
  const handleQuantityChange = (index, newQty) => {
    const qtyNum = parseFloat(newQty) || 0;
    setPiItems(prev => prev.map((item, idx) => {
      if (idx === index) {
        const rate = Number(item.unitPrice !== undefined ? item.unitPrice : item.unit_price) || 0;
        const total = Number((qtyNum * rate).toFixed(2));
        return { 
          ...item, 
          quantity: qtyNum, 
          totalAmount: total, 
          total_amount: total 
        };
      }
      return item;
    }));
  };

  // Modify PO/Style for an item
  const handlePoStyleChange = (index, newPo) => {
    setPiItems(prev => prev.map((item, idx) => 
      idx === index ? { ...item, poStyleNo: newPo, po_style_no: newPo } : item
    ));
  };

  // Modify Item Description
  const handleDescriptionChange = (index, newDesc) => {
    setPiItems(prev => prev.map((item, idx) => 
      idx === index ? { ...item, itemDescription: newDesc, item_description: newDesc } : item
    ));
  };

  // Add custom line item
  const handleAddLineItem = () => {
    setPiItems(prev => [
      ...prev,
      {
        slNo: prev.length + 1,
        sl_no: prev.length + 1,
        itemDescription: 'NEW ACCESSORY ITEM',
        item_description: 'NEW ACCESSORY ITEM',
        poStyleNo: '-',
        po_style_no: '-',
        quantity: 1000,
        unit: 'PCS',
        unitPrice: 0.05,
        unit_price: 0.05,
        totalAmount: 50.00,
        total_amount: 50.00
      }
    ]);
  };

  // Remove a line item
  const handleRemoveLineItem = (index) => {
    setPiItems(prev => prev.filter((_, idx) => idx !== index).map((it, idx) => ({ ...it, slNo: idx + 1, sl_no: idx + 1 })));
  };

  // Totals
  const totalQuantity = useMemo(() => {
    return piItems.reduce((sum, it) => sum + (Number(it.quantity) || 0), 0);
  }, [piItems]);

  const totalAmount = useMemo(() => {
    return Number(piItems.reduce((sum, it) => sum + (Number(it.totalAmount !== undefined ? it.totalAmount : it.total_amount) || 0), 0).toFixed(2));
  }, [piItems]);

  const amountInWords = useMemo(() => {
    return `IN WORDS: ${numberToCurrencyWords(totalAmount, currency)}`;
  }, [totalAmount, currency]);

  // Construct current PI payload for preview or saving
  const buildCurrentPiPayload = () => {
    const challanNums = selectedChallans.map(c => c.challan_number).join(', ');
    return {
      pi_number: piNumber || 'DRAFT-PI',
      piNumber: piNumber || 'DRAFT-PI',
      bill_number: billNumber || '',
      billNumber: billNumber || '',
      pi_date: piDate,
      piDate: piDate,
      bill_date: billDate,
      billDate: billDate,
      recipient_id: selectedRecipientId || null,
      recipientId: selectedRecipientId || null,
      applicant_name: applicantName || 'RECIPIENT COMPANY',
      applicantName: applicantName || 'RECIPIENT COMPANY',
      applicant_address: applicantAddress || '',
      applicantAddress: applicantAddress || '',
      beneficiary_name: beneficiaryName,
      beneficiaryName: beneficiaryName,
      beneficiary_address: beneficiaryAddress,
      beneficiaryAddress: beneficiaryAddress,
      beneficiary_bin: beneficiaryBin,
      beneficiaryBin: beneficiaryBin,
      bank_details: bankDetails,
      bankDetails: bankDetails,
      buyer: buyer || '-',
      challan_ids: selectedChallans.map(c => c.id),
      challanIds: selectedChallans.map(c => c.id),
      challan_numbers: challanNums,
      challanNumbers: challanNums,
      currency,
      currency_symbol: currencySymbol,
      currencySymbol: currencySymbol,
      total_quantity: totalQuantity,
      totalQuantity: totalQuantity,
      total_amount: totalAmount,
      totalAmount: totalAmount,
      amount_in_words: amountInWords,
      amountInWords: amountInWords,
      net_weight: netWeight,
      netWeight: netWeight,
      gross_weight: grossWeight,
      grossWeight: grossWeight,
      terms_conditions: termsConditions,
      termsConditions: termsConditions,
      status: 'ACTIVE',
      items: piItems
    };
  };

  // Open Preview Modal
  const handlePreview = () => {
    if (!applicantName.trim()) {
      addToast('error', 'Please select an Applicant (Recipient Company)');
      return;
    }
    if (piItems.length === 0) {
      addToast('error', 'Please select at least one Challan to populate items');
      return;
    }
    setPreviewPi(buildCurrentPiPayload());
  };

  // Save PI to Database
  const handleSavePi = async () => {
    if (!applicantName.trim()) {
      addToast('error', 'Please select an Applicant (Recipient Company)');
      return;
    }
    if (piItems.length === 0) {
      addToast('error', 'Please select at least one Challan or add line items');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        piNumber,
        billNumber,
        piDate,
        billDate,
        recipientId: selectedRecipientId,
        applicantName,
        applicantAddress,
        beneficiaryName,
        beneficiaryAddress,
        beneficiaryBin,
        bankDetails,
        buyer,
        challanIds: selectedChallans.map(c => c.id),
        challanNumbers: selectedChallans.map(c => c.challan_number).join(', '),
        currency,
        currencySymbol,
        totalQuantity,
        totalAmount,
        amountInWords,
        netWeight,
        grossWeight,
        termsConditions,
        items: piItems.map((it, idx) => ({
          slNo: it.slNo || it.sl_no || idx + 1,
          sl_no: it.slNo || it.sl_no || idx + 1,
          challanId: it.challanId || it.challan_id || null,
          challan_id: it.challanId || it.challan_id || null,
          itemId: it.itemId || it.item_id || null,
          item_id: it.itemId || it.item_id || null,
          itemDescription: it.itemDescription || it.item_description || '',
          item_description: it.itemDescription || it.item_description || '',
          poStyleNo: it.poStyleNo || it.po_style_no || null,
          po_style_no: it.poStyleNo || it.po_style_no || null,
          quantity: Number(it.quantity) || 0,
          unit: (it.unit || 'PCS').toUpperCase(),
          unitPrice: Number(it.unitPrice !== undefined ? it.unitPrice : it.unit_price) || 0,
          unit_price: Number(it.unitPrice !== undefined ? it.unitPrice : it.unit_price) || 0,
          totalAmount: Number(it.totalAmount !== undefined ? it.totalAmount : it.total_amount) || 0,
          total_amount: Number(it.totalAmount !== undefined ? it.totalAmount : it.total_amount) || 0,
        }))
      };

      const res = await window.kadal.finance.create(payload);
      if (res.success) {
        addToast('success', `Proforma Invoice ${res.piNumber || piNumber} created successfully!`);
        
        // Prompt to open print view
        const createdObj = {
          ...payload,
          id: res.id,
          pi_number: res.piNumber || piNumber,
          bill_number: billNumber,
          pi_date: piDate,
          bill_date: billDate,
          applicant_name: applicantName,
          applicant_address: applicantAddress,
          beneficiary_name: beneficiaryName,
          beneficiary_address: beneficiaryAddress,
          bank_details: bankDetails,
          buyer,
          total_quantity: totalQuantity,
          total_amount: totalAmount,
          amount_in_words: amountInWords,
          net_weight: netWeight,
          gross_weight: grossWeight,
          terms_conditions: termsConditions,
          items: payload.items
        };
        setPreviewPi(createdObj);

        // Reset form
        setSelectedChallans([]);
        setPiItems([]);
        loadHistory();
      } else {
        addToast('error', res.error || 'Failed to create Proforma Invoice');
      }
    } catch (err) {
      console.error('Error creating PI:', err);
      addToast('error', err.message || 'Error saving Proforma Invoice');
    }
    setSaving(false);
  };

  // Export PDF from preview
  const handleExportPdf = async (piToExport) => {
    try {
      const payload = piToExport || buildCurrentPiPayload();
      const res = await window.kadal.finance.exportPdf(payload.id ? payload.id : payload);
      if (res && res.success) {
        addToast('success', 'PDF exported successfully!');
      } else {
        if (res && res.error) {
          addToast('error', res.error);
        } else {
          window.print();
        }
      }
    } catch (err) {
      console.warn('PDF export failed, falling back to window.print():', err);
      window.print();
    }
  };

  // Delete an invoice from history
  const handleDeletePi = async (pi) => {
    const ok = await showConfirm({
      title: 'Delete Proforma Invoice',
      message: `Are you sure you want to delete Proforma Invoice ${pi.pi_number}? This cannot be undone.`,
      confirmText: 'Delete',
      type: 'danger'
    });
    if (!ok) return;

    try {
      const res = await window.kadal.finance.delete(pi.id);
      if (res.success) {
        addToast('success', `PI ${pi.pi_number} deleted`);
        loadHistory();
      } else {
        addToast('error', res.error || 'Failed to delete PI');
      }
    } catch (err) {
      addToast('error', err.message);
    }
  };

  // History filtering
  const filteredHistory = useMemo(() => {
    return history.filter(pi => {
      if (historyRecipientFilter && pi.recipient_id !== Number(historyRecipientFilter)) {
        return false;
      }
      if (historySearch.trim()) {
        const q = historySearch.toLowerCase();
        const matchNum = (pi.pi_number || '').toLowerCase().includes(q);
        const matchBill = (pi.bill_number || '').toLowerCase().includes(q);
        const matchApp = (pi.applicant_name || '').toLowerCase().includes(q);
        const matchBuyer = (pi.buyer || '').toLowerCase().includes(q);
        const matchChallans = (pi.challan_numbers || '').toLowerCase().includes(q);
        if (!matchNum && !matchBill && !matchApp && !matchBuyer && !matchChallans) return false;
      }
      return true;
    });
  }, [history, historyRecipientFilter, historySearch]);

  return (
    <div className="finance-page-container" style={{ padding: '20px 24px', maxWidth: 1400, margin: '0 auto' }}>
      {/* Top Banner */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ 
              background: 'linear-gradient(135deg, #059669 0%, #10b981 100%)', 
              color: '#ffffff', 
              padding: 8, 
              borderRadius: 8,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <Landmark size={24} />
            </div>
            <div>
              <h2 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: 'var(--text-color)' }}>Finance & Invoicing</h2>
              <p style={{ margin: 0, fontSize: 13, color: 'var(--text-muted)' }}>
                Generate official Proforma Invoices (PI) from Delivery Challans for Recipient Companies
              </p>
            </div>
          </div>
        </div>

        {/* Tab Switcher */}
        <div style={{ display: 'flex', gap: 8, background: 'var(--card-bg)', padding: 4, borderRadius: 8, border: '1px solid var(--border-color)' }}>
          <button 
            className={`btn btn-sm ${activeTab === 'create' ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => setActiveTab('create')}
          >
            <Plus size={15} style={{ marginRight: 6 }} /> Create PI
          </button>
          <button 
            className={`btn btn-sm ${activeTab === 'history' ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => setActiveTab('history')}
          >
            <FileText size={15} style={{ marginRight: 6 }} /> PI History ({history.length})
          </button>
        </div>
      </div>

      {/* CREATE TAB */}
      {activeTab === 'create' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 24, alignItems: 'start' }}>
          {/* Main Form Body */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            
            {/* Step 1: Select Recipient & Applicant Card */}
            <div className="card" style={{ padding: 20, background: 'var(--card-bg)', borderRadius: 10, border: '1px solid var(--border-color)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                <Building size={18} color="var(--primary)" />
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>1. Applicant & Beneficiary Details</h3>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <div>
                  <label className="form-label" style={{ fontWeight: 600, display: 'block', marginBottom: 6 }}>
                    Select Recipient Company (Applicant) *
                  </label>
                  <select 
                    className="form-select" 
                    value={selectedRecipientId} 
                    onChange={e => handleRecipientChange(e.target.value)}
                    style={{ width: '100%', padding: '9px 12px', borderRadius: 6, border: '1px solid var(--border-color)', background: 'var(--input-bg)' }}
                  >
                    <option value="">-- Choose Recipient Company --</option>
                    {recipients.map(r => (
                      <option key={r.id} value={r.id}>
                        {r.name} {r.receiver_address ? `(${r.receiver_address.slice(0, 35)}...)` : ''}
                      </option>
                    ))}
                  </select>

                  {applicantName && (
                    <div style={{ marginTop: 12, padding: 12, background: 'var(--badge-bg, rgba(16,185,129,0.08))', borderRadius: 6, border: '1px solid var(--border-color)' }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>APPLICANT DISPLAY (LINE BREAK WITH ADDRESS)</div>
                      <div style={{ fontWeight: 700, fontSize: 13, marginTop: 4, color: 'var(--text-color)' }}>{applicantName}</div>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)', whiteSpace: 'pre-line', marginTop: 2 }}>{applicantAddress || 'No address registered'}</div>
                    </div>
                  )}
                </div>

                <div>
                  <div style={{ padding: 12, background: 'var(--table-header-bg, rgba(0,0,0,0.03))', borderRadius: 6, border: '1px solid var(--border-color)' }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>BENEFICIARY (FIXED)</div>
                    <div style={{ fontWeight: 700, fontSize: 13, marginTop: 4, color: 'var(--text-color)' }}>{beneficiaryName}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', whiteSpace: 'pre-line', marginTop: 2 }}>{beneficiaryAddress}</div>
                    
                    <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 11, fontWeight: 600 }}>BIN (Optional):</span>
                      <input 
                        type="text" 
                        className="form-input" 
                        placeholder="e.g. 001928374-0101"
                        value={beneficiaryBin}
                        onChange={e => setBeneficiaryBin(e.target.value)}
                        style={{ padding: '4px 8px', fontSize: 12, flex: 1, borderRadius: 4, border: '1px solid var(--border-color)', background: 'var(--input-bg)' }}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Bank Details & Buyer definition */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginTop: 16, paddingTop: 16, borderTop: '1px dashed var(--border-color)' }}>
                <div>
                  <label className="form-label" style={{ fontWeight: 600, display: 'block', marginBottom: 4, fontSize: 12 }}>
                    Bank Detail (Default UCB Tongi Branch, editable)
                  </label>
                  <textarea 
                    className="form-input"
                    rows={4}
                    value={bankDetails}
                    onChange={e => setBankDetails(e.target.value)}
                    style={{ width: '100%', fontSize: 11.5, fontFamily: 'monospace', borderRadius: 6, border: '1px solid var(--border-color)', background: 'var(--input-bg)', padding: 8 }}
                  />
                </div>

                <div>
                  <label className="form-label" style={{ fontWeight: 600, display: 'block', marginBottom: 4, fontSize: 12 }}>
                    BUYER (User Define) *
                  </label>
                  <textarea 
                    className="form-input"
                    rows={4}
                    placeholder="e.g. INTERSPORT AW26 (MICRO FLEECE PROGRAM 3RD) // PURCHASE NO. KAD/#00663+00704+00669+00665/2026"
                    value={buyer}
                    onChange={e => setBuyer(e.target.value)}
                    style={{ width: '100%', fontSize: 12, borderRadius: 6, border: '1px solid var(--border-color)', background: 'var(--input-bg)', padding: 8 }}
                  />
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                    Define the buyer brand, program name, and purchase order numbers.
                  </div>
                </div>
              </div>
            </div>

            {/* Step 2: Challan Selection */}
            <div className="card" style={{ padding: 20, background: 'var(--card-bg)', borderRadius: 10, border: '1px solid var(--border-color)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, flexWrap: 'wrap', gap: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Truck size={18} color="var(--primary)" />
                  <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>2. Select Delivery Challans (Single or Multiple)</h3>
                  {selectedChallans.length > 0 && (
                    <span className="badge badge-success" style={{ fontSize: 11, fontWeight: 600 }}>
                      {selectedChallans.length} Selected
                    </span>
                  )}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, cursor: 'pointer', color: 'var(--text-muted)' }}>
                    <input 
                      type="checkbox" 
                      checked={showAllChallans || challanRecipientFilter === 'ALL'} 
                      onChange={e => {
                        setShowAllChallans(e.target.checked);
                        if (e.target.checked) setChallanRecipientFilter('ALL');
                        else setChallanRecipientFilter('');
                      }} 
                    />
                    Show challans from all recipients
                  </label>
                  {selectedChallans.length > 0 && (
                    <button 
                      type="button"
                      className="btn btn-ghost btn-xs"
                      onClick={handleClearAllSelected}
                      style={{ color: 'var(--danger)', fontSize: 11, padding: '2px 6px' }}
                    >
                      Clear Selection
                    </button>
                  )}
                </div>
              </div>

              {/* Selected Challans Chips */}
              <div style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6 }}>
                  Selected Challans ({selectedChallans.length}):
                </div>
                {selectedChallans.length === 0 ? (
                  <div style={{ padding: '10px 14px', background: 'var(--badge-bg, rgba(0,0,0,0.03))', borderRadius: 6, border: '1px dashed var(--border-color)', color: 'var(--text-muted)', fontSize: 12.5 }}>
                    No challans selected yet. Search and click "+ Add" on any challan below to include its items in this Proforma Invoice.
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    {selectedChallans.map(c => (
                      <div 
                        key={c.id} 
                        style={{ 
                          display: 'inline-flex', 
                          alignItems: 'center', 
                          gap: 8, 
                          background: 'var(--primary-light, rgba(16,185,129,0.12))', 
                          color: 'var(--primary, #059669)',
                          padding: '5px 12px',
                          borderRadius: 20,
                          fontSize: 12,
                          fontWeight: 600,
                          border: '1px solid rgba(16,185,129,0.3)'
                        }}
                      >
                        <FileText size={13} />
                        <span>{c.challan_number}</span>
                        <span style={{ opacity: 0.7, fontSize: 11 }}>({c.total_quantity || c.item_count || 0} items)</span>
                        <button 
                          type="button"
                          onClick={() => handleRemoveChallan(c.id)}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center', color: 'inherit' }}
                          title="Remove Challan"
                        >
                          <X size={13} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Comprehensive Filter Toolbar */}
              <div style={{ 
                background: 'var(--badge-bg, rgba(0,0,0,0.02))', 
                padding: '12px 14px', 
                borderRadius: 8, 
                border: '1px solid var(--border-color)', 
                marginBottom: 12 
              }}>
                {/* Row 1: Search, Recipient Dropdown, Invoiced Status, Selection Status */}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center', marginBottom: 10 }}>
                  {/* Search Query */}
                  <div style={{ position: 'relative', flex: '1 1 240px', minWidth: 210 }}>
                    <Search size={14} style={{ position: 'absolute', left: 10, top: 10, color: 'var(--text-muted)' }} />
                    <input 
                      type="text" 
                      className="form-input" 
                      placeholder="Search Challan #, buyer, item, style, PO..."
                      value={challanSearch}
                      onChange={e => setChallanSearch(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') handleRemoteSearch(); }}
                      style={{ width: '100%', paddingLeft: 30, paddingRight: challanSearch ? 28 : 10, height: 34, fontSize: 12.5, borderRadius: 6, border: '1px solid var(--border-color)', background: 'var(--input-bg)' }}
                    />
                    {challanSearch && (
                      <button
                        type="button"
                        onClick={() => setChallanSearch('')}
                        style={{ position: 'absolute', right: 8, top: 9, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 0 }}
                        title="Clear search"
                      >
                        <X size={14} />
                      </button>
                    )}
                  </div>

                  {/* Recipient Dropdown Filter */}
                  <div style={{ flex: '1 1 180px', minWidth: 170 }}>
                    <select 
                      className="form-input"
                      value={challanRecipientFilter}
                      onChange={e => {
                        const val = e.target.value;
                        setChallanRecipientFilter(val);
                        if (val === 'ALL') setShowAllChallans(true);
                      }}
                      style={{ width: '100%', height: 34, fontSize: 12, borderRadius: 6, border: '1px solid var(--border-color)', background: 'var(--input-bg)', padding: '0 8px' }}
                    >
                      <option value="">
                        {applicantName ? `Recipient: ${applicantName}` : 'All Recipients'}
                      </option>
                      <option value="ALL">-- Show All Recipients --</option>
                      {distinctRecipients.map(r => (
                        <option key={r} value={r}>{r}</option>
                      ))}
                    </select>
                  </div>

                  {/* Invoiced Status Toggle */}
                  <div style={{ display: 'inline-flex', background: 'var(--card-bg)', padding: 2, borderRadius: 6, border: '1px solid var(--border-color)' }}>
                    <button
                      type="button"
                      onClick={() => setChallanInvoiceStatus('all')}
                      style={{
                        border: 'none',
                        padding: '4px 9px',
                        fontSize: 11.5,
                        fontWeight: challanInvoiceStatus === 'all' ? 600 : 400,
                        borderRadius: 4,
                        cursor: 'pointer',
                        background: challanInvoiceStatus === 'all' ? 'var(--primary)' : 'transparent',
                        color: challanInvoiceStatus === 'all' ? '#fff' : 'var(--text-muted)'
                      }}
                    >
                      All Status
                    </button>
                    <button
                      type="button"
                      onClick={() => setChallanInvoiceStatus('uninvoiced')}
                      style={{
                        border: 'none',
                        padding: '4px 9px',
                        fontSize: 11.5,
                        fontWeight: challanInvoiceStatus === 'uninvoiced' ? 600 : 400,
                        borderRadius: 4,
                        cursor: 'pointer',
                        background: challanInvoiceStatus === 'uninvoiced' ? 'var(--primary)' : 'transparent',
                        color: challanInvoiceStatus === 'uninvoiced' ? '#fff' : 'var(--text-muted)'
                      }}
                      title="Only challans not yet included in any Proforma Invoice"
                    >
                      Un-invoiced
                    </button>
                    <button
                      type="button"
                      onClick={() => setChallanInvoiceStatus('invoiced')}
                      style={{
                        border: 'none',
                        padding: '4px 9px',
                        fontSize: 11.5,
                        fontWeight: challanInvoiceStatus === 'invoiced' ? 600 : 400,
                        borderRadius: 4,
                        cursor: 'pointer',
                        background: challanInvoiceStatus === 'invoiced' ? 'var(--primary)' : 'transparent',
                        color: challanInvoiceStatus === 'invoiced' ? '#fff' : 'var(--text-muted)'
                      }}
                      title="Challans already billed in a Proforma Invoice"
                    >
                      Invoiced
                    </button>
                  </div>

                  {/* Selection Status Toggle */}
                  <div style={{ display: 'inline-flex', background: 'var(--card-bg)', padding: 2, borderRadius: 6, border: '1px solid var(--border-color)' }}>
                    <button
                      type="button"
                      onClick={() => setChallanSelectionStatus('all')}
                      style={{
                        border: 'none',
                        padding: '4px 8px',
                        fontSize: 11.5,
                        fontWeight: challanSelectionStatus === 'all' ? 600 : 400,
                        borderRadius: 4,
                        cursor: 'pointer',
                        background: challanSelectionStatus === 'all' ? 'var(--primary)' : 'transparent',
                        color: challanSelectionStatus === 'all' ? '#fff' : 'var(--text-muted)'
                      }}
                    >
                      All
                    </button>
                    <button
                      type="button"
                      onClick={() => setChallanSelectionStatus('selected')}
                      style={{
                        border: 'none',
                        padding: '4px 8px',
                        fontSize: 11.5,
                        fontWeight: challanSelectionStatus === 'selected' ? 600 : 400,
                        borderRadius: 4,
                        cursor: 'pointer',
                        background: challanSelectionStatus === 'selected' ? 'var(--primary)' : 'transparent',
                        color: challanSelectionStatus === 'selected' ? '#fff' : 'var(--text-muted)'
                      }}
                      title="Show only selected challans"
                    >
                      Selected ({selectedChallans.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setChallanSelectionStatus('unselected')}
                      style={{
                        border: 'none',
                        padding: '4px 8px',
                        fontSize: 11.5,
                        fontWeight: challanSelectionStatus === 'unselected' ? 600 : 400,
                        borderRadius: 4,
                        cursor: 'pointer',
                        background: challanSelectionStatus === 'unselected' ? 'var(--primary)' : 'transparent',
                        color: challanSelectionStatus === 'unselected' ? '#fff' : 'var(--text-muted)'
                      }}
                    >
                      Unselected
                    </button>
                  </div>
                </div>

                {/* Row 2: Date Pickers + Quick Presets + Buyer Dropdown + Style/PO + Reset */}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center' }}>
                  {/* Date Pickers */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12 }}>
                    <Calendar size={13} color="var(--text-muted)" />
                    <span style={{ color: 'var(--text-muted)', fontSize: 11.5 }}>Date:</span>
                    <input 
                      type="date" 
                      className="form-input" 
                      value={challanDateFrom} 
                      onChange={e => setChallanDateFrom(e.target.value)} 
                      style={{ width: 120, height: 30, fontSize: 11.5, padding: '2px 6px', borderRadius: 4, border: '1px solid var(--border-color)', background: 'var(--input-bg)' }}
                      title="From Date"
                    />
                    <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>to</span>
                    <input 
                      type="date" 
                      className="form-input" 
                      value={challanDateTo} 
                      onChange={e => setChallanDateTo(e.target.value)} 
                      style={{ width: 120, height: 30, fontSize: 11.5, padding: '2px 6px', borderRadius: 4, border: '1px solid var(--border-color)', background: 'var(--input-bg)' }}
                      title="To Date"
                    />
                  </div>

                  {/* Date Quick Presets */}
                  <div style={{ display: 'flex', gap: 4 }}>
                    <button 
                      type="button" 
                      className="btn btn-outline btn-xs" 
                      onClick={setDatePresetToday}
                      style={{ padding: '2px 7px', fontSize: 11 }}
                    >
                      Today
                    </button>
                    <button 
                      type="button" 
                      className="btn btn-outline btn-xs" 
                      onClick={setDatePresetLast7Days}
                      style={{ padding: '2px 7px', fontSize: 11 }}
                    >
                      7 Days
                    </button>
                    <button 
                      type="button" 
                      className="btn btn-outline btn-xs" 
                      onClick={setDatePresetThisMonth}
                      style={{ padding: '2px 7px', fontSize: 11 }}
                    >
                      This Month
                    </button>
                    <button 
                      type="button" 
                      className="btn btn-outline btn-xs" 
                      onClick={setDatePresetThisYear}
                      style={{ padding: '2px 7px', fontSize: 11 }}
                    >
                      This Year
                    </button>
                    {(challanDateFrom || challanDateTo) && (
                      <button 
                        type="button" 
                        className="btn btn-ghost btn-xs" 
                        onClick={clearDatePreset}
                        style={{ padding: '2px 6px', fontSize: 11, color: 'var(--danger)' }}
                        title="Clear date filter"
                      >
                        <X size={11} /> Clear Date
                      </button>
                    )}
                  </div>

                  {/* Buyer Filter */}
                  <div style={{ minWidth: 140, flex: '1 1 140px' }}>
                    <select
                      className="form-input"
                      value={challanBuyerFilter}
                      onChange={e => setChallanBuyerFilter(e.target.value)}
                      style={{ width: '100%', height: 30, fontSize: 11.5, borderRadius: 4, border: '1px solid var(--border-color)', background: 'var(--input-bg)', padding: '0 6px' }}
                    >
                      <option value="">All Buyers ({distinctBuyers.length})</option>
                      {distinctBuyers.map(b => (
                        <option key={b} value={b}>{b}</option>
                      ))}
                    </select>
                  </div>

                  {/* Style / PO Filter */}
                  <div style={{ minWidth: 130, flex: '1 1 130px' }}>
                    <input 
                      type="text"
                      className="form-input"
                      placeholder="Filter Style / PO #..."
                      value={challanStyleFilter}
                      onChange={e => setChallanStyleFilter(e.target.value)}
                      style={{ width: '100%', height: 30, fontSize: 11.5, borderRadius: 4, border: '1px solid var(--border-color)', background: 'var(--input-bg)', padding: '0 8px' }}
                    />
                  </div>

                  {/* Reset All Filters Button */}
                  {hasActiveChallanFilters && (
                    <button 
                      type="button" 
                      className="btn btn-ghost btn-xs"
                      onClick={handleResetChallanFilters}
                      style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '4px 8px', fontSize: 11, color: 'var(--danger)' }}
                      title="Reset all filters to default"
                    >
                      <RotateCcw size={12} /> Reset Filters
                    </button>
                  )}
                </div>

                {/* Filter Summary & Actions */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 10, paddingTop: 8, borderTop: '1px dashed var(--border-color)', fontSize: 11.5, flexWrap: 'wrap', gap: 8 }}>
                  <div style={{ color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <span>
                      Showing <strong>{availableChallans.length}</strong> matching challan{availableChallans.length !== 1 ? 's' : ''} (out of {allChallans.length})
                    </span>
                    {selectedChallans.length > 0 && (
                      <span style={{ color: 'var(--primary)', fontWeight: 600 }}>
                        • {selectedChallans.length} selected
                      </span>
                    )}
                    {challanSearch.trim() && (
                      <span className="badge" style={{ background: 'var(--badge-bg)', fontSize: 10.5 }}>
                        Search: "{challanSearch}"
                      </span>
                    )}
                    {challanBuyerFilter && (
                      <span className="badge" style={{ background: 'var(--badge-bg)', fontSize: 10.5 }}>
                        Buyer: {challanBuyerFilter}
                      </span>
                    )}
                    {challanInvoiceStatus !== 'all' && (
                      <span className="badge" style={{ background: 'var(--badge-bg)', fontSize: 10.5 }}>
                        {challanInvoiceStatus === 'uninvoiced' ? 'Un-invoiced Only' : 'Invoiced Only'}
                      </span>
                    )}
                  </div>

                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    {challanSearch.trim() && (
                      <button 
                        type="button"
                        className="btn btn-outline btn-xs"
                        onClick={handleRemoteSearch}
                        disabled={isSearchingServer}
                        style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, height: 26 }}
                        title="Search entire database for matching challans"
                      >
                        {isSearchingServer ? <RefreshCw size={11} className="spin" /> : <Search size={11} />}
                        Search Database
                      </button>
                    )}
                    {availableChallans.length > 0 && (
                      <button
                        type="button"
                        className="btn btn-ghost btn-xs"
                        onClick={handleToggleSelectAllVisible}
                        style={{ fontSize: 11, color: 'var(--primary)', height: 26, fontWeight: 600 }}
                      >
                        {areAllVisibleSelected ? 'Deselect All Visible' : '+ Add All Visible'}
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Challan Table */}
              <div style={{ maxHeight: 280, overflowY: 'auto', border: '1px solid var(--border-color)', borderRadius: 6 }}>
                <table className="table" style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ background: 'var(--table-header-bg, #f8fafc)', borderBottom: '1px solid var(--border-color)' }}>
                      <th style={{ padding: '8px 10px', textAlign: 'left' }}>Challan No</th>
                      <th style={{ padding: '8px 10px', textAlign: 'left' }}>Date</th>
                      <th style={{ padding: '8px 10px', textAlign: 'left' }}>Receiver</th>
                      <th style={{ padding: '8px 10px', textAlign: 'left' }}>Buyer</th>
                      <th style={{ padding: '8px 10px', textAlign: 'left' }}>Style / PO</th>
                      <th style={{ padding: '8px 10px', textAlign: 'right' }}>Total Qty</th>
                      <th style={{ padding: '8px 10px', textAlign: 'center', width: 90 }}>Status</th>
                      <th style={{ padding: '8px 10px', textAlign: 'center', width: 95 }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {availableChallans.length === 0 ? (
                      <tr>
                        <td colSpan={8} style={{ textAlign: 'center', padding: '24px 16px', color: 'var(--text-muted)' }}>
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
                            <FileText size={26} style={{ opacity: 0.4 }} />
                            <div style={{ fontWeight: 500 }}>
                              {applicantName ? `No challans found matching filters for "${applicantName}".` : 'No challans found matching current filters.'}
                            </div>
                            <div style={{ fontSize: 11.5, opacity: 0.8 }}>
                              {hasActiveChallanFilters ? (
                                <span>Try adjusting or clearing your filters.</span>
                              ) : (
                                <span>Try choosing "Show challans from all recipients" or searching by Challan #.</span>
                              )}
                            </div>
                            <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                              {hasActiveChallanFilters && (
                                <button 
                                  type="button"
                                  className="btn btn-outline btn-xs"
                                  onClick={handleResetChallanFilters}
                                >
                                  Clear Filters
                                </button>
                              )}
                              {challanSearch.trim() && (
                                <button 
                                  type="button"
                                  className="btn btn-primary btn-xs" 
                                  onClick={handleRemoteSearch}
                                  disabled={isSearchingServer}
                                  style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
                                >
                                  {isSearchingServer ? <RefreshCw size={11} className="spin" /> : <Search size={11} />}
                                  Search database for "{challanSearch.trim()}"
                                </button>
                              )}
                            </div>
                          </div>
                        </td>
                      </tr>
                    ) : (
                      availableChallans.slice(0, 100).map(c => {
                        const isSelected = selectedChallans.some(sc => sc.id === c.id);
                        const isAlreadyUsed = usedChallanIds.includes(c.id);
                        return (
                          <tr 
                            key={c.id} 
                            style={{ 
                              borderBottom: '1px solid var(--border-color)',
                              background: isSelected ? 'rgba(16, 185, 129, 0.07)' : undefined 
                            }}
                          >
                            <td style={{ padding: '8px 10px', fontWeight: 600, fontFamily: 'monospace' }}>
                              {c.challan_number}
                            </td>
                            <td style={{ padding: '8px 10px', color: 'var(--text-muted)' }}>
                              {c.challan_date ? new Date(c.challan_date).toLocaleDateString('en-GB') : '-'}
                            </td>
                            <td style={{ padding: '8px 10px', maxWidth: 170, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={c.receiver_name}>
                              {c.receiver_name}
                            </td>
                            <td style={{ padding: '8px 10px', maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={c.buyer_names}>
                              {c.buyer_names || '-'}
                            </td>
                            <td style={{ padding: '8px 10px', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={[c.style_names, c.order_numbers, c.purchase_nos].filter(Boolean).join(' / ')}>
                              {[c.style_names, c.order_numbers, c.purchase_nos].filter(Boolean).join(' / ') || '-'}
                            </td>
                            <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 600 }}>
                              {Number(c.total_quantity || 0).toLocaleString()}
                            </td>
                            <td style={{ padding: '8px 10px', textAlign: 'center' }}>
                              {isSelected ? (
                                <span style={{ fontSize: 10.5, padding: '2px 6px', borderRadius: 4, background: '#dcfce7', color: '#166534', fontWeight: 600 }}>
                                  Selected ✓
                                </span>
                              ) : isAlreadyUsed ? (
                                <span style={{ fontSize: 10.5, padding: '2px 6px', borderRadius: 4, background: '#fef3c7', color: '#92400e', fontWeight: 500 }} title="Already billed in a Proforma Invoice">
                                  Invoiced
                                </span>
                              ) : (
                                <span style={{ fontSize: 10.5, padding: '2px 6px', borderRadius: 4, background: '#e0f2fe', color: '#0369a1', fontWeight: 500 }}>
                                  Active
                                </span>
                              )}
                            </td>
                            <td style={{ padding: '8px 10px', textAlign: 'center' }}>
                              {isSelected ? (
                                <button 
                                  type="button"
                                  className="btn btn-ghost btn-xs"
                                  onClick={() => handleRemoveChallan(c.id)}
                                  style={{ display: 'inline-flex', alignItems: 'center', gap: 3, color: 'var(--danger)', fontSize: 11 }}
                                  title="Remove from selection"
                                >
                                  <X size={12} /> Remove
                                </button>
                              ) : (
                                <button 
                                  type="button"
                                  className="btn btn-outline btn-xs"
                                  onClick={() => handleSelectChallan(c)}
                                  style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 11 }}
                                  title="Add to selection"
                                >
                                  <Plus size={12} /> Add
                                </button>
                              )}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Step 3: Extracted Goods Table */}
            <div className="card" style={{ padding: 20, background: 'var(--card-bg)', borderRadius: 10, border: '1px solid var(--border-color)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Layers size={18} color="var(--primary)" />
                  <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>3. Description of Goods (Extracted Items & Rates)</h3>
                </div>
                <button 
                  className="btn btn-ghost btn-sm"
                  onClick={handleAddLineItem}
                  style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}
                >
                  <Plus size={14} /> Add Line Item
                </button>
              </div>

              <div style={{ overflowX: 'auto', border: '1px solid var(--border-color)', borderRadius: 6, marginBottom: 14 }}>
                <table className="table" style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ background: 'var(--table-header-bg, #f8fafc)', borderBottom: '1px solid var(--border-color)' }}>
                      <th style={{ padding: '8px 8px', textAlign: 'center', width: 45 }}>#</th>
                      <th style={{ padding: '8px 10px', textAlign: 'left' }}>Item Description</th>
                      <th style={{ padding: '8px 10px', textAlign: 'left', width: 180 }}>PO & Style No.</th>
                      <th style={{ padding: '8px 10px', textAlign: 'right', width: 100 }}>Qty</th>
                      <th style={{ padding: '8px 10px', textAlign: 'center', width: 75 }}>Unit</th>
                      <th style={{ padding: '8px 10px', textAlign: 'right', width: 110 }}>Unit Price ({currencySymbol})</th>
                      <th style={{ padding: '8px 10px', textAlign: 'right', width: 120 }}>Total ({currencySymbol})</th>
                      <th style={{ padding: '8px 8px', textAlign: 'center', width: 45 }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {piItems.length === 0 ? (
                      <tr>
                        <td colSpan={8} style={{ textAlign: 'center', padding: 24, color: 'var(--text-muted)' }}>
                          No items loaded. Select one or more delivery challans above to populate goods automatically.
                        </td>
                      </tr>
                    ) : (
                      piItems.map((item, idx) => (
                        <tr key={idx} style={{ borderBottom: '1px solid var(--border-color)' }}>
                          <td style={{ padding: '8px 8px', textAlign: 'center', color: 'var(--text-muted)' }}>
                            {idx + 1}
                          </td>
                          <td style={{ padding: '6px 8px' }}>
                            <input 
                              type="text" 
                              className="form-input" 
                              value={item.itemDescription !== undefined ? item.itemDescription : (item.item_description || '')}
                              onChange={e => handleDescriptionChange(idx, e.target.value)}
                              style={{ width: '100%', padding: '4px 6px', fontSize: 12, borderRadius: 4, border: '1px solid var(--border-color)', background: 'var(--input-bg)' }}
                            />
                          </td>
                          <td style={{ padding: '6px 8px' }}>
                            <input 
                              type="text" 
                              className="form-input" 
                              value={item.poStyleNo !== undefined ? item.poStyleNo : (item.po_style_no || '')}
                              onChange={e => handlePoStyleChange(idx, e.target.value)}
                              style={{ width: '100%', padding: '4px 6px', fontSize: 12, borderRadius: 4, border: '1px solid var(--border-color)', background: 'var(--input-bg)' }}
                            />
                          </td>
                          <td style={{ padding: '6px 8px' }}>
                            <input 
                              type="number" 
                              step="any"
                              className="form-input" 
                              value={item.quantity !== undefined ? item.quantity : 0}
                              onChange={e => handleQuantityChange(idx, e.target.value)}
                              style={{ width: '100%', padding: '4px 6px', fontSize: 12, textAlign: 'right', fontWeight: 600, borderRadius: 4, border: '1px solid var(--border-color)', background: 'var(--input-bg)' }}
                            />
                          </td>
                          <td style={{ padding: '6px 8px', textAlign: 'center' }}>
                            <input 
                              type="text" 
                              className="form-input" 
                              value={item.unit || 'PCS'}
                              onChange={e => {
                                const val = e.target.value.toUpperCase();
                                setPiItems(prev => prev.map((it, i) => i === idx ? { ...it, unit: val } : it));
                              }}
                              style={{ width: '100%', padding: '4px 6px', fontSize: 12, textAlign: 'center', borderRadius: 4, border: '1px solid var(--border-color)', background: 'var(--input-bg)' }}
                            />
                          </td>
                          <td style={{ padding: '6px 8px' }}>
                            <input 
                              type="number" 
                              step="0.0001"
                              className="form-input" 
                              value={item.unitPrice !== undefined ? item.unitPrice : (item.unit_price !== undefined ? item.unit_price : 0)}
                              onChange={e => handlePriceChange(idx, e.target.value)}
                              style={{ width: '100%', padding: '4px 6px', fontSize: 12, textAlign: 'right', borderRadius: 4, border: '1px solid var(--border-color)', background: 'var(--input-bg)' }}
                            />
                          </td>
                          <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 600 }}>
                            {currencySymbol} {Number(item.totalAmount !== undefined ? item.totalAmount : (item.total_amount || 0)).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </td>
                          <td style={{ padding: '6px 8px', textAlign: 'center' }}>
                            <button 
                              onClick={() => handleRemoveLineItem(idx)}
                              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--danger, #ef4444)' }}
                              title="Delete row"
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
                      <tr style={{ background: 'var(--table-header-bg, #f8fafc)', borderTop: '2px solid var(--border-color)', fontWeight: 'bold' }}>
                        <td colSpan={3} style={{ padding: '10px 12px', textAlign: 'right' }}>TOTAL</td>
                        <td style={{ padding: '10px 8px', textAlign: 'right', fontSize: 13 }}>
                          {totalQuantity.toLocaleString('en-US')}
                        </td>
                        <td colSpan={2}></td>
                        <td style={{ padding: '10px 10px', textAlign: 'right', fontSize: 14, color: 'var(--primary, #059669)' }}>
                          {currencySymbol} {totalAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                        <td></td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>

              {/* Amount In Words */}
              {piItems.length > 0 && (
                <div style={{ padding: '10px 14px', background: 'var(--badge-bg, rgba(16,185,129,0.06))', borderRadius: 6, border: '1px solid var(--border-color)', marginBottom: 16 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)' }}>AMOUNT IN WORDS (AUTO-CALCULATED):</div>
                  <div style={{ fontSize: 12.5, fontWeight: 700, marginTop: 3, color: 'var(--text-color)' }}>
                    {amountInWords}
                  </div>
                </div>
              )}

              {/* Weight & Terms Section */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1.5fr', gap: 14 }}>
                <div>
                  <label className="form-label" style={{ fontSize: 11.5, fontWeight: 600 }}>NET WEIGHT</label>
                  <input 
                    type="text" 
                    className="form-input" 
                    value={netWeight} 
                    onChange={e => setNetWeight(e.target.value)}
                    style={{ width: '100%', padding: '6px 10px', fontSize: 12, borderRadius: 4, border: '1px solid var(--border-color)', background: 'var(--input-bg)' }}
                  />
                </div>
                <div>
                  <label className="form-label" style={{ fontSize: 11.5, fontWeight: 600 }}>GROSS WEIGHT</label>
                  <input 
                    type="text" 
                    className="form-input" 
                    value={grossWeight} 
                    onChange={e => setGrossWeight(e.target.value)}
                    style={{ width: '100%', padding: '6px 10px', fontSize: 12, borderRadius: 4, border: '1px solid var(--border-color)', background: 'var(--input-bg)' }}
                  />
                </div>
                <div>
                  <label className="form-label" style={{ fontSize: 11.5, fontWeight: 600 }}>TERMS AND CONDITIONS</label>
                  <input 
                    type="text" 
                    className="form-input" 
                    value={termsConditions} 
                    onChange={e => setTermsConditions(e.target.value)}
                    style={{ width: '100%', padding: '6px 10px', fontSize: 12, borderRadius: 4, border: '1px solid var(--border-color)', background: 'var(--input-bg)' }}
                  />
                </div>
              </div>
            </div>

          </div>

          {/* Right Sidebar: Meta Numbers & Actions */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {/* Numbers Card */}
            <div className="card" style={{ padding: 18, background: 'var(--card-bg)', borderRadius: 10, border: '1px solid var(--border-color)' }}>
              <h4 style={{ margin: '0 0 14px 0', fontSize: 14, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}>
                <Edit3 size={15} color="var(--primary)" /> Invoice Identifiers
              </h4>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div>
                  <label className="form-label" style={{ fontSize: 11.5, fontWeight: 600 }}>PROFORMA INVOICE NO. *</label>
                  <input 
                    type="text" 
                    className="form-input" 
                    value={piNumber} 
                    onChange={e => setPiNumber(e.target.value)}
                    placeholder="e.g. KADWL/KADAL/2026/127"
                    style={{ width: '100%', padding: '7px 10px', fontSize: 12, fontWeight: 600, fontFamily: 'monospace', borderRadius: 4, border: '1px solid var(--border-color)', background: 'var(--input-bg)' }}
                  />
                </div>

                <div>
                  <label className="form-label" style={{ fontSize: 11.5, fontWeight: 600 }}>PI Date *</label>
                  <input 
                    type="date" 
                    className="form-input" 
                    value={piDate} 
                    onChange={e => setPiDate(e.target.value)}
                    style={{ width: '100%', padding: '7px 10px', fontSize: 12, borderRadius: 4, border: '1px solid var(--border-color)', background: 'var(--input-bg)' }}
                  />
                </div>

                <div style={{ paddingTop: 8, borderTop: '1px dashed var(--border-color)' }}>
                  <label className="form-label" style={{ fontSize: 11.5, fontWeight: 600 }}>BILL Reference / No.</label>
                  <input 
                    type="text" 
                    className="form-input" 
                    value={billNumber} 
                    onChange={e => setBillNumber(e.target.value)}
                    placeholder="e.g. KADWL/KADAL/2026/86"
                    style={{ width: '100%', padding: '7px 10px', fontSize: 12, fontWeight: 600, fontFamily: 'monospace', borderRadius: 4, border: '1px solid var(--border-color)', background: 'var(--input-bg)' }}
                  />
                </div>

                <div>
                  <label className="form-label" style={{ fontSize: 11.5, fontWeight: 600 }}>BILL Date</label>
                  <input 
                    type="date" 
                    className="form-input" 
                    value={billDate} 
                    onChange={e => setBillDate(e.target.value)}
                    style={{ width: '100%', padding: '7px 10px', fontSize: 12, borderRadius: 4, border: '1px solid var(--border-color)', background: 'var(--input-bg)' }}
                  />
                </div>

                <div style={{ paddingTop: 8, borderTop: '1px dashed var(--border-color)' }}>
                  <label className="form-label" style={{ fontSize: 11.5, fontWeight: 600 }}>Currency</label>
                  <select 
                    className="form-select" 
                    value={currency} 
                    onChange={e => {
                      const cur = e.target.value;
                      setCurrency(cur);
                      setCurrencySymbol(cur === 'BDT' ? '৳' : '$');
                    }}
                    style={{ width: '100%', padding: '7px 10px', fontSize: 12, borderRadius: 4, border: '1px solid var(--border-color)', background: 'var(--input-bg)' }}
                  >
                    <option value="USD">USD ($) - US Dollars</option>
                    <option value="BDT">BDT (৳) - Bangladeshi Taka</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Quick Summary & Action Buttons */}
            <div className="card" style={{ padding: 18, background: 'var(--card-bg)', borderRadius: 10, border: '1px solid var(--border-color)' }}>
              <h4 style={{ margin: '0 0 12px 0', fontSize: 14, fontWeight: 700 }}>Summary</h4>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 13, marginBottom: 18 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Challans:</span>
                  <strong>{selectedChallans.length}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Goods Items:</span>
                  <strong>{piItems.length}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Total Quantity:</span>
                  <strong>{totalQuantity.toLocaleString()}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 15, paddingTop: 8, borderTop: '1px solid var(--border-color)', color: 'var(--primary)' }}>
                  <span>Total Amount:</span>
                  <strong>{currencySymbol} {totalAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <button 
                  className="btn btn-primary"
                  onClick={handleSavePi}
                  disabled={saving || !applicantName || piItems.length === 0}
                  style={{ width: '100%', padding: '10px 16px', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 8, fontWeight: 600 }}
                >
                  <CheckCircle size={16} /> {saving ? 'Creating PI...' : 'Confirm & Save PI'}
                </button>

                <button 
                  className="btn btn-outline"
                  onClick={handlePreview}
                  disabled={!applicantName || piItems.length === 0}
                  style={{ width: '100%', padding: '9px 16px', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 8 }}
                >
                  <Eye size={16} /> Preview Document
                </button>

                <button 
                  className="btn btn-ghost btn-sm"
                  onClick={() => {
                    setSelectedChallans([]);
                    setPiItems([]);
                  }}
                  style={{ color: 'var(--text-muted)', marginTop: 4 }}
                >
                  Clear Form
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* HISTORY TAB */}
      {activeTab === 'history' && (
        <div className="card" style={{ padding: 20, background: 'var(--card-bg)', borderRadius: 10, border: '1px solid var(--border-color)' }}>
          {/* History Filters */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18, gap: 16 }}>
            <div style={{ position: 'relative', flex: 1, maxWidth: 400 }}>
              <Search size={15} style={{ position: 'absolute', left: 10, top: 11, color: 'var(--text-muted)' }} />
              <input 
                type="text" 
                className="form-input" 
                placeholder="Search by PI #, Bill #, Applicant, Buyer..."
                value={historySearch}
                onChange={e => setHistorySearch(e.target.value)}
                style={{ width: '100%', paddingLeft: 32, borderRadius: 6, border: '1px solid var(--border-color)', background: 'var(--input-bg)' }}
              />
            </div>

            <div style={{ display: 'flex', gap: 12 }}>
              <select 
                className="form-select"
                value={historyRecipientFilter}
                onChange={e => setHistoryRecipientFilter(e.target.value)}
                style={{ padding: '8px 12px', borderRadius: 6, border: '1px solid var(--border-color)', background: 'var(--input-bg)', fontSize: 13 }}
              >
                <option value="">All Recipient Companies</option>
                {recipients.map(r => (
                  <option key={r.id} value={r.id}>{r.name}</option>
                ))}
              </select>

              <button 
                className="btn btn-outline btn-sm"
                onClick={loadHistory}
                title="Refresh History"
              >
                <RefreshCw size={15} />
              </button>
            </div>
          </div>

          {/* History Table */}
          <div style={{ overflowX: 'auto', border: '1px solid var(--border-color)', borderRadius: 6 }}>
            <table className="table" style={{ width: '100%', fontSize: 12.5, borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: 'var(--table-header-bg, #f8fafc)', borderBottom: '1px solid var(--border-color)' }}>
                  <th style={{ padding: '10px 12px', textAlign: 'left' }}>PI Number</th>
                  <th style={{ padding: '10px 12px', textAlign: 'left' }}>Bill No.</th>
                  <th style={{ padding: '10px 12px', textAlign: 'left' }}>Date</th>
                  <th style={{ padding: '10px 12px', textAlign: 'left' }}>Applicant</th>
                  <th style={{ padding: '10px 12px', textAlign: 'left' }}>Buyer</th>
                  <th style={{ padding: '10px 12px', textAlign: 'right' }}>Total Qty</th>
                  <th style={{ padding: '10px 12px', textAlign: 'right' }}>Total Amount</th>
                  <th style={{ padding: '10px 12px', textAlign: 'center', width: 140 }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredHistory.length === 0 ? (
                  <tr>
                    <td colSpan={8} style={{ textAlign: 'center', padding: 32, color: 'var(--text-muted)' }}>
                      No Proforma Invoices found matching your filter criteria.
                    </td>
                  </tr>
                ) : (
                  filteredHistory.map(pi => (
                    <tr key={pi.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                      <td style={{ padding: '10px 12px', fontWeight: 700, fontFamily: 'monospace', color: 'var(--primary)' }}>
                        {pi.pi_number}
                      </td>
                      <td style={{ padding: '10px 12px', fontFamily: 'monospace' }}>
                        {pi.bill_number || '-'}
                      </td>
                      <td style={{ padding: '10px 12px', color: 'var(--text-muted)' }}>
                        {pi.pi_date ? new Date(pi.pi_date).toLocaleDateString('en-GB') : '-'}
                      </td>
                      <td style={{ padding: '10px 12px', fontWeight: 600 }}>
                        {pi.applicant_name}
                      </td>
                      <td style={{ padding: '10px 12px', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {pi.buyer || '-'}
                      </td>
                      <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 600 }}>
                        {Number(pi.total_quantity || 0).toLocaleString()}
                      </td>
                      <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 700, color: 'var(--text-color)' }}>
                        {pi.currency_symbol || '$'} {Number(pi.total_amount || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                        <div style={{ display: 'flex', justifyContent: 'center', gap: 6 }}>
                          <button 
                            className="btn btn-ghost btn-icon btn-sm"
                            onClick={() => setPreviewPi(pi)}
                            title="View / Print Document"
                          >
                            <Printer size={15} />
                          </button>
                          <button 
                            className="btn btn-ghost btn-icon btn-sm"
                            onClick={() => handleExportPdf(pi)}
                            title="Download PDF"
                          >
                            <Download size={15} />
                          </button>
                          {(user?.roleName === 'Admin' || user?.roleName === 'Super Admin') && (
                            <button 
                              className="btn btn-ghost btn-icon btn-sm"
                              onClick={() => handleDeletePi(pi)}
                              style={{ color: 'var(--danger)' }}
                              title="Delete PI"
                            >
                              <Trash2 size={15} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* FULL PREVIEW MODAL */}
      {previewPi && (
        <div 
          className="modal-overlay" 
          style={{ 
            position: 'fixed', 
            top: 0, 
            left: 0, 
            right: 0, 
            bottom: 0, 
            background: 'rgba(15, 23, 42, 0.75)', 
            display: 'flex', 
            justifyContent: 'center', 
            alignItems: 'flex-start',
            overflowY: 'auto',
            padding: '40px 20px',
            zIndex: 9999 
          }}
          onClick={() => setPreviewPi(null)}
        >
          <div onClick={e => e.stopPropagation()}>
            <ProformaInvoicePrintView 
              pi={previewPi} 
              isModal={true}
              onClose={() => setPreviewPi(null)}
              onExportPdf={() => handleExportPdf(previewPi)}
            />
          </div>
        </div>
      )}
    </div>
  );
}

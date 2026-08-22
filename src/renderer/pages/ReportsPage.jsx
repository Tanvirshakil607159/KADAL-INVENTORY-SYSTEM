import React, { useState, useEffect } from 'react';
import useStore from '../store/useStore';
import { Download, FileSpreadsheet, FileText, Eye, ArrowLeft, XCircle, Trash2, ArrowUpDown, ArrowUp, ArrowDown, ClipboardList } from 'lucide-react';

const TABS = [
  { id: 'stock', label: 'Current Stock' },
  { id: 'movement', label: 'Stock Movement' },
  { id: 'lowStock', label: 'Low Stock' },
  { id: 'challan', label: 'Challan History' },
  { id: 'itemChallan', label: 'Item Wise Challan Report' },
  { id: 'dailyDelivery', label: 'Daily Delivery Report' },
  { id: 'itemDeliverySummary', label: 'Item Wise Delivery Summary' },
  { id: 'categoryDeliverySummary', label: 'Category Wise Delivery Summary' },
  { id: 'monthlyReport', label: 'Monthly Report' },
  { id: 'audit', label: '📋 Audit Report' },
];


export default function ReportsPage() {
  const { addToast, showConfirm, user } = useStore();
  const [activeTab, setActiveTab] = useState('stock');
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [search, setSearch] = useState('');
  const [styleName, setStyleName] = useState('');
  const [orderNumber, setOrderNumber] = useState('');
  const [purchaseNo, setPurchaseNo] = useState('');
  const [buyerName, setBuyerName] = useState('');
  const [status, setStatus] = useState('');
  const [receiverName, setReceiverName] = useState('');
  const [distinctValues, setDistinctValues] = useState({ styles: [], orders: [], purchases: [], buyers: [] });
  const [recipientsList, setRecipientsList] = useState([]);
  const [detailItem, setDetailItem] = useState(null);
  const [detailData, setDetailData] = useState([]);
  const [detailLoading, setDetailLoading] = useState(false);
  const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' });
  const [auditData, setAuditData] = useState(null);
  const [auditSection, setAuditSection] = useState('wip');
  const [auditCutoffDate, setAuditCutoffDate] = useState('2026-06-30');

  const handleSort = (key) => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  const sortedData = [...data].sort((a, b) => {
    if (!sortConfig.key) return 0;
    let valA = a[sortConfig.key];
    let valB = b[sortConfig.key];

    // Numeric fields
    const numericFields = [
      'current_stock', 'order_quantity', 'min_stock_level', 'unit_price',
      'total_in', 'total_out', 'shipped_quantity', 'total_shipped', 'balance'
    ];

    if (numericFields.includes(sortConfig.key)) {
      valA = Number(valA) || 0;
      valB = Number(valB) || 0;
    } else {
      valA = (valA || '').toString().toLowerCase();
      valB = (valB || '').toString().toLowerCase();
    }

    if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
    if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
    return 0;
  });

  const SortHeader = ({ label, field, className = "" }) => (
    <th
      className={`sortable ${className}`}
      onClick={() => handleSort(field)}
    >
      <div className="flex items-center justify-between">
        {label}
        <span className={`sort-icon-container ${sortConfig.key === field ? 'active' : ''}`}>
          {sortConfig.key !== field ? <ArrowUpDown size={12} /> :
            sortConfig.direction === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />}
        </span>
      </div>
    </th>
  );

  useEffect(() => {
    const fetchDV = async () => {
      const res = await window.kadal.items.getDistinctValues();
      if (res?.success) setDistinctValues(res.data);
    };
    const fetchRec = async () => {
      try {
        const r = await window.kadal.recipients.getAll();
        if (r?.success) setRecipientsList(r.data);
        else if (Array.isArray(r)) setRecipientsList(r);
      } catch (e) { }
    };
    fetchDV();
    fetchRec();
  }, []);

  useEffect(() => { loadReport(); }, [activeTab, dateFrom, dateTo, search, styleName, orderNumber, purchaseNo, buyerName, auditCutoffDate, status, receiverName]);

  const loadReport = async () => {
    setLoading(true);
    try {
      let res;
      const filters = { dateFrom, dateTo, search, styleName, orderNumber, purchaseNo, buyerName, status: status || undefined, receiverName: receiverName || undefined };
      switch (activeTab) {
        case 'stock': res = await window.kadal.reports.stockReport(filters); break;
        case 'movement':
          res = await window.kadal.reports.movementReport(filters);
          if (res?.success && res.data) {
            res.data = res.data.map(d => ({ ...d, balance: (Number(d.order_quantity) || 0) - (Number(d.total_out) || 0) }));
          }
          break;
        case 'lowStock': res = await window.kadal.reports.lowStockReport(filters); break;
        case 'challan': res = await window.kadal.reports.challanHistory(filters); break;
        case 'itemChallan': res = await window.kadal.reports.challanHistory(filters); break;
        case 'dailyDelivery': res = await window.kadal.reports.challanHistory(filters); break;
        case 'itemDeliverySummary': res = await window.kadal.reports.challanHistory(filters); break;
        case 'categoryDeliverySummary': res = await window.kadal.reports.challanHistory(filters); break;
        case 'monthlyReport': res = await window.kadal.reports.challanHistory({ ...filters, limit: 5000 }); break;
        case 'audit': {
          const auditRes = await window.kadal.reports.auditReport({ ...filters, cutoffDate: auditCutoffDate });
          if (auditRes?.success) {
            setAuditData(auditRes.data);
          }
          setLoading(false);
          return;
        }
      }

      if (res?.success) setData(res.data || []);
    } catch (e) { addToast('error', 'Failed to load report'); }
    setLoading(false);
  };

  const getExportOptions = () => {
    const options = {};
    if (activeTab === 'monthlyReport' || activeTab === 'dailyDelivery' || activeTab === 'itemDeliverySummary' || activeTab === 'categoryDeliverySummary' || activeTab === 'movement' || activeTab === 'challan' || activeTab === 'itemChallan') {
      if (dateFrom || dateTo) {
        let dateStr = 'Date Range: ';
        if (dateFrom && dateTo) {
          dateStr += `${new Date(dateFrom).toLocaleDateString('en-GB')} to ${new Date(dateTo).toLocaleDateString('en-GB')}`;
        } else if (dateFrom) {
          dateStr += `From ${new Date(dateFrom).toLocaleDateString('en-GB')}`;
        } else {
          dateStr += `Up to ${new Date(dateTo).toLocaleDateString('en-GB')}`;
        }

        if (dateFrom) {
          const monthStr = new Date(dateFrom).toLocaleString('en-US', { month: 'long', year: 'numeric' });
          dateStr += `    |    Month: ${monthStr}`;
        } else if (dateTo) {
          const monthStr = new Date(dateTo).toLocaleString('en-US', { month: 'long', year: 'numeric' });
          dateStr += `    |    Month: ${monthStr}`;
        }

        options.subtitles = [dateStr];
      }
    }
    return options;
  };

  // Aggregate data by item for itemDeliverySummary export
  const getExportData = () => {
    if (activeTab === 'itemDeliverySummary') {
      const activeOnly = data.filter(r => r.status === 'ACTIVE');
      const itemMap = {};
      activeOnly.forEach(r => {
        const key = r.item_id || r.item_code;
        if (!itemMap[key]) {
          itemMap[key] = {
            item_name: r.item_name, item_code: r.item_code, size: r.size, color: r.color,
            unit: r.unit, unit_price: r.unit_price || 0,
            currency: r.currency || 'BDT',
            total_delivered: 0, challan_numbers: [], delivery_count: 0,
          };
        }
        itemMap[key].total_delivered += (Number(r.shipped_quantity) || 0);
        itemMap[key].delivery_count++;
        if (r.challan_number && !itemMap[key].challan_numbers.includes(r.challan_number)) {
          itemMap[key].challan_numbers.push(r.challan_number);
        }
      });
      return Object.values(itemMap).sort((a, b) => (a.item_name || '').localeCompare(b.item_name || ''));
    }

    if (activeTab === 'categoryDeliverySummary') {
      const activeOnly = data.filter(r => r.status === 'ACTIVE');
      const catMap = {};
      activeOnly.forEach(r => {
        const key = r.category_name || 'Uncategorized';
        if (!catMap[key]) {
          catMap[key] = {
            category_name: key,
            total_delivered: 0,
            item_details_map: new Map(),
            total_value_bdt: 0,
            total_value_usd: 0
          };
        }
        const qty = Number(r.shipped_quantity) || 0;
        const val = qty * (Number(r.unit_price) || 0);
        catMap[key].total_delivered += qty;

        const itemId = r.item_id || r.item_code;
        if (itemId) {
          if (!catMap[key].item_details_map.has(itemId)) {
            const details = `${r.item_name || '-'}` + (r.item_code ? ` (${r.item_code})` : '') + ((r.size || r.color) ? ` - ${[r.size, r.color].filter(Boolean).join('/')}` : '');
            catMap[key].item_details_map.set(itemId, details);
          }
        }

        if (r.currency === 'USD') catMap[key].total_value_usd += val;
        else catMap[key].total_value_bdt += val;
      });
      return Object.values(catMap).map(c => ({
        ...c,
        unique_items: c.item_details_map.size,
        item_details_list: Array.from(c.item_details_map.values()),
        item_details_text: Array.from(c.item_details_map.values()).join('\n')
      })).sort((a, b) => (a.category_name || '').localeCompare(b.category_name || ''));
    }

    return data;
  };

  const exportExcel = async () => {
    const res = await window.kadal.reports.exportExcel(activeTab, getExportData(), getExportOptions());
    if (res?.success) addToast('success', 'Excel exported');
    else addToast('error', res?.error || 'Export failed');
  };

  const exportPdf = async () => {
    const res = await window.kadal.reports.exportPdf(activeTab, getExportData(), getExportOptions());
    if (res?.success) addToast('success', 'PDF exported');
    else addToast('error', res?.error || 'Export failed');
  };

  // Audit section export helpers
  const getAuditExportType = (section) => {
    switch (section) {
      case 'wip': return 'auditWorkingProcess';
      case 'fg': return 'auditFinishedGoods';
      case 'raw': return 'auditRawMaterial';
      default: return 'auditRawMaterial';
    }
  };
  const getAuditSectionData = (section) => {
    if (!auditData) return [];
    switch (section) {
      case 'wip': return auditData.workingProcess || [];
      case 'fg': return auditData.finishedGoods || [];
      case 'raw': return auditData.rawMaterials || [];
      default: return [];
    }
  };
  const formatCutoffDisplay = (dateStr) => {
    const d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' });
  };
  const formatCutoffShort = (dateStr) => {
    const d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });
  };

  const exportAuditExcel = async (section) => {
    const type = getAuditExportType(section);
    const sectionData = getAuditSectionData(section);
    const sum = auditData?.summary;
    const cutoff = auditData?.cutoffDate || auditCutoffDate;
    const subtitles = [
      `Inventory Audit Report — In Hand Stock (Till ${formatCutoffShort(cutoff)})`,
      `Generated: ${new Date().toLocaleString('en-GB')}`,
    ];
    if (sum) {
      subtitles.push(`Grand Total: ৳${Number(sum.grandTotalBDT || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}${sum.grandTotalUSD > 0 ? ` + $${Number(sum.grandTotalUSD).toLocaleString(undefined, { minimumFractionDigits: 2 })}` : ''}`);
    }
    const res = await window.kadal.reports.exportExcel(type, sectionData, { subtitles });
    if (res?.success) addToast('success', 'Excel exported');
    else addToast('error', res?.error || 'Export failed');
  };
  const exportAuditPdf = async (section) => {
    const type = getAuditExportType(section);
    const sectionData = getAuditSectionData(section);
    const sum = auditData?.summary;
    const cutoff = auditData?.cutoffDate || auditCutoffDate;
    const subtitles = [
      `Inventory Audit Report — In Hand Stock (Till ${formatCutoffShort(cutoff)})`,
      `Generated: ${new Date().toLocaleString('en-GB')}`,
    ];
    if (sum) {
      subtitles.push(`Grand Total: ৳${Number(sum.grandTotalBDT || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}${sum.grandTotalUSD > 0 ? ` + $${Number(sum.grandTotalUSD).toLocaleString(undefined, { minimumFractionDigits: 2 })}` : ''}`);
    }
    const res = await window.kadal.reports.exportPdf(type, sectionData, { subtitles });
    if (res?.success) addToast('success', 'PDF exported');
    else addToast('error', res?.error || 'Export failed');
  };

  const exportDetailExcel = async () => {
    const currencySign = detailItem.currency === 'USD' ? '$' : '৳';
    const currentValue = Number(detailItem.current_stock * (detailItem.unit_price || 0)).toLocaleString(undefined, { minimumFractionDigits: 2 });
    const subtitles = [
      `Item: ${detailItem.item_name} (${detailItem.item_code})`,
      `Buyer: ${detailItem.buyer_name || '-'}    |    Style: ${detailItem.style_name || '-'}    |    Purchase: ${detailItem.purchase_no || '-'}    |    Order: ${detailItem.order_number || '-'}`,
      `Size/Color: ${[detailItem.size, detailItem.color].filter(Boolean).join(' / ') || '-'}    |    Current Stock: ${detailItem.current_stock} ${detailItem.unit}    |    Current Value: ${currencySign}${currentValue}`,
      `Total IN: ${detailItem.total_in}    |    Total OUT: ${detailItem.total_out}`
    ];
    const res = await window.kadal.reports.exportExcel('movementDetail', detailData, { subtitles });
    if (res?.success) addToast('success', 'Excel exported');
    else addToast('error', res?.error || 'Export failed');
  };

  const exportDetailPdf = async () => {
    const currencySign = detailItem.currency === 'USD' ? '$' : '৳';
    const currentValue = Number(detailItem.current_stock * (detailItem.unit_price || 0)).toLocaleString(undefined, { minimumFractionDigits: 2 });
    const subtitles = [
      `Item: ${detailItem.item_name} (${detailItem.item_code})`,
      `Buyer: ${detailItem.buyer_name || '-'}    |    Style: ${detailItem.style_name || '-'}    |    Purchase: ${detailItem.purchase_no || '-'}    |    Order: ${detailItem.order_number || '-'}`,
      `Size/Color: ${[detailItem.size, detailItem.color].filter(Boolean).join(' / ') || '-'}    |    Current Stock: ${detailItem.current_stock} ${detailItem.unit}    |    Current Value: ${currencySign}${currentValue}`,
      `Total IN: ${detailItem.total_in}    |    Total OUT: ${detailItem.total_out}`
    ];
    const res = await window.kadal.reports.exportPdf('movementDetail', detailData, { subtitles });
    if (res?.success) addToast('success', 'PDF exported');
    else addToast('error', res?.error || 'Export failed');
  };

  const showDetails = async (item) => {
    setDetailItem(item);
    setDetailLoading(true);
    try {
      const res = await window.kadal.stock.getTransactions({ itemId: item.id });
      if (res?.success) setDetailData(res.data || []);
    } catch (e) { addToast('error', 'Failed to load details'); }
    setDetailLoading(false);
  };

  const handleCancelReport = async (row) => {
    const reason = prompt('Reason for cancellation:');
    if (!reason) return;
    const confirmed = await showConfirm({
      title: 'Cancel Challan',
      message: `Cancel challan ${row.challan_number}? Stock will be reversed.`,
      type: 'warning',
      confirmText: 'Yes, Cancel'
    });
    if (!confirmed) return;
    const res = await window.kadal.challans.cancel(row.challan_id, reason);
    if (res.success) {
      addToast('success', 'Challan cancelled and stock reversed');
      loadReport();
    }
    else addToast('error', res.error);
  };

  const handleDeleteReport = async (row) => {
    const confirmed = await showConfirm({
      title: 'Delete Challan',
      message: `Permanently DELETE challan ${row.challan_number}? This action cannot be undone and will NOT reverse stock. Use only for data cleanup.`,
      type: 'danger',
      confirmText: 'Yes, Delete Permanently'
    });
    if (!confirmed) return;
    const res = await window.kadal.challans.delete(row.challan_id);
    if (res.success) {
      addToast('success', 'Challan deleted successfully');
      loadReport();
    }
    else addToast('error', res.error);
  };

  const renderTable = () => {
    if (loading) return <div className="loading"><div className="spinner"></div></div>;
    if (data.length === 0) return <div className="empty-state"><h3>No data</h3><p>No records found for this report</p></div>;

    switch (activeTab) {
      case 'stock':
        return (
          <table className="data-table">
            <thead>
              <tr>
                <SortHeader label="Item / Code" field="name" />
                <SortHeader label="Style / Purchase / Order" field="style_name" />
                <SortHeader label="Size / Color" field="size" />
                <SortHeader label="Buyer" field="buyer_name" />
                <SortHeader label="Unit Price" field="unit_price" className="text-right" />
                <SortHeader label="Stock" field="current_stock" className="text-right" />
                <th className="text-right">Total Value</th>
                <SortHeader label="Unit" field="unit" />
                <SortHeader label="Min Level" field="min_stock_level" className="text-right" />
              </tr>
            </thead>
            <tbody>{sortedData.map(r => (
              <tr key={r.id}>
                <td>
                  <div style={{ fontWeight: 600 }}>{r.name}</div>
                  <div className="text-mono text-muted" style={{ fontSize: 11 }}>{r.item_code}</div>
                </td>
                <td>
                  <div style={{ fontSize: 12 }}>{r.style_name || '-'}</div>
                  <div className="text-muted" style={{ fontSize: 11 }}>{r.purchase_no || '-'} / {r.order_number || '-'}</div>
                </td>
                <td>{[r.size, r.color].filter(Boolean).join(' / ') || '-'}</td>
                <td>{r.buyer_name || '-'}</td>
                <td className="text-right text-mono">{r.currency === 'USD' ? '$' : '৳'}{Number(r.unit_price || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                <td className="text-right text-mono fw-bold" style={{ color: r.current_stock <= r.min_stock_level && r.min_stock_level > 0 ? 'var(--danger)' : 'var(--success)' }}>{r.current_stock}</td>
                <td className="text-right text-mono">{r.currency === 'USD' ? '$' : '৳'}{Number((r.current_stock * (r.unit_price || 0))).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                <td>{r.unit}</td>
                <td className="text-right text-mono">{r.min_stock_level}</td>
              </tr>
            ))}</tbody>
          </table>
        );
      case 'movement':
        return (
          <table className="data-table">
            <thead>
              <tr>
                <SortHeader label="Item / Code" field="item_name" />
                <SortHeader label="Style / Purchase / Order" field="style_name" />
                <SortHeader label="Size / Color" field="size" />
                <SortHeader label="Buyer" field="buyer_name" />
                <SortHeader label="Order Qty" field="order_quantity" className="text-right" />
                <SortHeader label="Total IN" field="total_in" className="text-right" />
                <SortHeader label="Total OUT" field="total_out" className="text-right" />
                <SortHeader label="Balance" field="balance" className="text-right" />
                <SortHeader label="Current Stock" field="current_stock" className="text-right" />
                <SortHeader label="Unit" field="unit" />
                <th>Action</th>
              </tr>
            </thead>
            <tbody>{sortedData.map((r, i) => (
              <tr key={i}>
                <td>
                  <div style={{ fontWeight: 600 }}>{r.item_name}</div>
                  <div className="text-mono text-muted" style={{ fontSize: 11 }}>{r.item_code}</div>
                </td>
                <td>
                  <div style={{ fontSize: 12 }}>{r.style_name || '-'}</div>
                  <div className="text-muted" style={{ fontSize: 11 }}>{r.purchase_no || '-'} / {r.order_number || '-'}</div>
                </td>
                <td>{[r.size, r.color].filter(Boolean).join(' / ') || '-'}</td>
                <td>{r.buyer_name || '-'}</td>
                <td className="text-right text-mono">{r.order_quantity || 0}</td>
                <td className="text-right text-mono text-success">{r.total_in ?? 0}</td>
                <td className="text-right text-mono text-warning">{r.total_out ?? 0}</td>
                <td className={`text-right text-mono fw-bold ${r.balance > 0 ? 'text-danger' : 'text-success'}`}>{r.balance ?? 0}</td>
                <td className="text-right text-mono fw-bold">{r.current_stock}</td>
                <td>{r.unit}</td>
                <td><button className="btn btn-outline btn-sm" onClick={() => showDetails(r)}><Eye size={13} /> Details</button></td>
              </tr>
            ))}</tbody>
          </table>
        );
      case 'lowStock':
        return (
          <table className="data-table">
            <thead>
              <tr>
                <SortHeader label="Code" field="item_code" />
                <SortHeader label="Item" field="name" />
                <SortHeader label="Buyer" field="buyer_name" />
                <SortHeader label="Category" field="category_name" />
                <SortHeader label="Current" field="current_stock" className="text-right" />
                <SortHeader label="Min Level" field="min_stock_level" className="text-right" />
                <th style={{ textAlign: 'right' }}>Deficit</th>
              </tr>
            </thead>
            <tbody>{sortedData.map(r => (
              <tr key={r.id}>
                <td className="text-mono" style={{ fontSize: 12 }}>{r.item_code}</td><td style={{ fontWeight: 600 }}>{r.name}</td>
                <td>{r.buyer_name || '-'}</td>
                <td>{r.category_name || '-'}</td>
                <td className="text-right text-mono text-danger fw-bold">{r.current_stock}</td>
                <td className="text-right text-mono">{r.min_stock_level}</td>
                <td className="text-right text-mono text-danger">{r.current_stock - r.min_stock_level}</td>
              </tr>
            ))}</tbody>
          </table>
        );
      case 'challan':
        return (
          <table className="data-table">
            <thead>
              <tr>
                <SortHeader label="Challan No" field="challan_number" />
                <SortHeader label="Date" field="challan_date" />
                <SortHeader label="Receiver" field="receiver_name" />
                <SortHeader label="Buyer" field="buyer_name" />
                <SortHeader label="Item Details" field="item_name" />
                <SortHeader label="Style / Order / Purchase" field="style_name" />
                <SortHeader label="Order Qty" field="order_quantity" className="text-right" />
                <SortHeader label="Shipped" field="shipped_quantity" className="text-right" />
                <SortHeader label="Total Out" field="total_shipped" className="text-right" />
                <SortHeader label="Balance" field="balance" className="text-right" />
                <SortHeader label="Status" field="status" />
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>{sortedData.map((r, i) => (
              <tr key={i}>
                <td className="text-mono" style={{ fontSize: 12, color: 'var(--accent)' }}>{r.challan_number}</td>
                <td style={{ fontSize: 11 }}>{new Date(r.challan_date).toLocaleDateString('en-GB')}</td>
                <td style={{ fontSize: 12 }}>{r.receiver_name}</td>
                <td style={{ fontSize: 11 }}>{r.buyer_name || '-'}</td>
                <td>
                  <div style={{ fontWeight: 600 }}>{r.item_name}</div>
                  <div className="text-muted" style={{ fontSize: 11 }}>{[r.size, r.color].filter(Boolean).join(' / ') || '-'}</div>
                </td>
                <td style={{ fontSize: 12 }}>
                  <div>{r.style_name || '-'}</div>
                  <div className="text-muted" style={{ fontSize: 11 }}>{r.order_number || '-'} / {r.purchase_no || '-'}</div>
                </td>
                <td className="text-right text-mono">{r.order_quantity || 0}</td>

                <td className="text-right text-mono fw-bold text-success">{r.shipped_quantity}</td>
                <td className="text-right text-mono text-warning">{r.total_shipped}</td>
                <td className="text-right text-mono fw-bold" style={{ color: r.balance > 0 ? 'var(--danger)' : 'var(--success)' }}>{r.balance}</td>
                <td><span className={`badge badge-${r.status === 'ACTIVE' ? 'success' : 'danger'}`}>{r.status === 'ACTIVE' ? 'Active' : 'Inactive'}</span></td>
                <td>
                  <div style={{ display: 'flex', gap: 4 }}>
                    <button className="btn btn-ghost btn-icon btn-sm" title="Download PDF" onClick={async () => {
                      const res = await window.kadal.challans.exportPdf(r.challan_id);
                      if (res?.success) addToast('success', 'PDF exported');
                    }}><FileText size={14} /></button>
                    <button className="btn btn-ghost btn-icon btn-sm" title="Download Excel" onClick={async () => {
                      const res = await window.kadal.challans.exportExcel(r.challan_id);
                      if (res?.success) addToast('success', 'Excel exported');
                    }}><FileSpreadsheet size={14} /></button>
                    {r.status === 'ACTIVE' && (
                      <button className="btn btn-ghost btn-icon btn-sm" title="Cancel Challan" onClick={() => handleCancelReport(r)}>
                        <XCircle size={14} color="var(--danger)" />
                      </button>
                    )}
                    {(user?.roleName === 'Super Admin' || user?.role_name === 'Super Admin') && (
                      <button className="btn btn-ghost btn-icon btn-sm" title="Delete Permanently" onClick={() => handleDeleteReport(r)}>
                        <Trash2 size={14} color="var(--danger)" />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}</tbody>
          </table>
        );
      case 'itemChallan':
        return (
          <table className="data-table">
            <thead>
              <tr>
                <SortHeader label="Item Details" field="item_name" />
                <SortHeader label="Style / Order / Purchase" field="style_name" />
                <SortHeader label="Buyer" field="buyer_name" />
                <SortHeader label="Challan No" field="challan_number" />
                <SortHeader label="Date" field="challan_date" />
                <SortHeader label="Receiver" field="receiver_name" />
                <SortHeader label="Order Qty" field="order_quantity" className="text-right" />
                <SortHeader label="Shipped" field="shipped_quantity" className="text-right" />
                <SortHeader label="Status" field="status" />
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>{sortedData.map((r, i) => (
              <tr key={i}>
                <td>
                  <div style={{ fontWeight: 600 }}>{r.item_name}</div>
                  <div className="text-mono text-muted" style={{ fontSize: 11 }}>{r.item_code}</div>
                  <div className="text-muted" style={{ fontSize: 11 }}>{[r.size, r.color].filter(Boolean).join(' / ') || '-'}</div>
                </td>
                <td style={{ fontSize: 12 }}>
                  <div>{r.style_name || '-'}</div>
                  <div className="text-muted" style={{ fontSize: 11 }}>{r.order_number || '-'} / {r.purchase_no || '-'}</div>
                </td>
                <td style={{ fontSize: 11 }}>{r.buyer_name || '-'}</td>
                <td className="text-mono" style={{ fontSize: 12, color: 'var(--accent)' }}>{r.challan_number}</td>
                <td style={{ fontSize: 11 }}>{new Date(r.challan_date).toLocaleDateString('en-GB')}</td>
                <td style={{ fontSize: 12 }}>{r.receiver_name}</td>
                <td className="text-right text-mono">{r.order_quantity || 0}</td>
                <td className="text-right text-mono fw-bold text-success">{r.shipped_quantity}</td>
                <td><span className={`badge badge-${r.status === 'ACTIVE' ? 'success' : 'danger'}`}>{r.status === 'ACTIVE' ? 'Active' : 'Inactive'}</span></td>
                <td>
                  <div style={{ display: 'flex', gap: 4 }}>
                    <button className="btn btn-ghost btn-icon btn-sm" title="Download PDF" onClick={async () => {
                      const res = await window.kadal.challans.exportPdf(r.challan_id);
                      if (res?.success) addToast('success', 'PDF exported');
                    }}><FileText size={14} /></button>
                    <button className="btn btn-ghost btn-icon btn-sm" title="Download Excel" onClick={async () => {
                      const res = await window.kadal.challans.exportExcel(r.challan_id);
                      if (res?.success) addToast('success', 'Excel exported');
                    }}><FileSpreadsheet size={14} /></button>
                  </div>
                </td>
              </tr>
            ))}</tbody>
          </table>
        );
      case 'itemDeliverySummary': {
        // Aggregate by item
        const activeOnly = sortedData.filter(r => r.status === 'ACTIVE');
        const itemMap = {};
        activeOnly.forEach(r => {
          const key = r.item_id || r.item_code;
          if (!itemMap[key]) {
            itemMap[key] = {
              item_name: r.item_name,
              item_code: r.item_code,
              size: r.size,
              color: r.color,
              unit: r.unit,
              unit_price: r.unit_price || 0,
              currency: r.currency || 'BDT',
              total_delivered: 0,
              challan_numbers: [],
              delivery_count: 0,
            };
          }
          itemMap[key].total_delivered += (Number(r.shipped_quantity) || 0);
          itemMap[key].delivery_count++;
          if (r.challan_number && !itemMap[key].challan_numbers.includes(r.challan_number)) {
            itemMap[key].challan_numbers.push(r.challan_number);
          }
        });
        const itemSummary = Object.values(itemMap).sort((a, b) => (a.item_name || '').localeCompare(b.item_name || ''));

        const sumTotalQty = itemSummary.reduce((s, r) => s + r.total_delivered, 0);
        const sumTotalBDT = itemSummary.filter(r => r.currency !== 'USD').reduce((s, r) => s + (r.total_delivered * r.unit_price), 0);
        const sumTotalUSD = itemSummary.filter(r => r.currency === 'USD').reduce((s, r) => s + (r.total_delivered * r.unit_price), 0);
        const sumUniqueItems = itemSummary.length;

        const fmtBDT2 = (v) => `৳${Number(v || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}`;
        const fmtUSD2 = (v) => `$${Number(v || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}`;

        return (
          <div>
            {/* Summary Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginBottom: 16 }}>
              <div className="card" style={{ padding: '14px 18px', background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)', color: '#fff', borderRadius: 10 }}>
                <div style={{ fontSize: 11, opacity: 0.85, marginBottom: 4 }}>Unique Items</div>
                <div style={{ fontSize: 24, fontWeight: 700 }}>{sumUniqueItems}</div>
              </div>
              <div className="card" style={{ padding: '14px 18px', background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)', color: '#fff', borderRadius: 10 }}>
                <div style={{ fontSize: 11, opacity: 0.85, marginBottom: 4 }}>Total Delivery Qty</div>
                <div style={{ fontSize: 24, fontWeight: 700 }}>{sumTotalQty.toLocaleString()}</div>
              </div>
              <div className="card" style={{ padding: '14px 18px', background: 'linear-gradient(135deg, #1e40af 0%, #3b82f6 100%)', color: '#fff', borderRadius: 10 }}>
                <div style={{ fontSize: 11, opacity: 0.85, marginBottom: 4 }}>Total Value (BDT)</div>
                <div style={{ fontSize: 22, fontWeight: 700 }}>{fmtBDT2(sumTotalBDT)}</div>
              </div>
              {sumTotalUSD > 0 && (
                <div className="card" style={{ padding: '14px 18px', background: 'linear-gradient(135deg, #b45309 0%, #f59e0b 100%)', color: '#fff', borderRadius: 10 }}>
                  <div style={{ fontSize: 11, opacity: 0.85, marginBottom: 4 }}>Total Value (USD)</div>
                  <div style={{ fontSize: 22, fontWeight: 700 }}>{fmtUSD2(sumTotalUSD)}</div>
                </div>
              )}
            </div>

            <table className="data-table">
              <thead>
                <tr>
                  <th>SL No.</th>
                  <SortHeader label="Item Details" field="item_name" />
                  <SortHeader label="Total Delivered" field="total_delivered" className="text-right" />
                  <SortHeader label="Unit Price" field="unit_price" className="text-right" />
                  <th className="text-right">Total Value</th>
                  <th>Challans</th>
                </tr>
              </thead>
              <tbody>{itemSummary.map((r, i) => {
                return (
                  <tr key={i}>
                    <td>{i + 1}</td>
                    <td>
                      <div style={{ fontWeight: 600 }}>{r.item_name || '-'}</div>
                      <div className="text-mono text-muted" style={{ fontSize: 11 }}>{r.item_code}</div>
                      <div className="text-muted" style={{ fontSize: 11 }}>{[r.size, r.color].filter(Boolean).join(' / ') || '-'}</div>
                    </td>
                    <td className="text-right text-mono fw-bold text-success">{r.total_delivered}</td>
                    <td className="text-right text-mono">{r.currency === 'USD' ? '$' : '৳'}{Number(r.unit_price || 0).toFixed(2)}</td>
                    <td className="text-right text-mono fw-bold">{r.currency === 'USD' ? '$' : '৳'}{Number(r.total_delivered * (r.unit_price || 0)).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                    <td>
                      <div style={{ fontSize: 11, color: 'var(--accent)', maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={r.challan_numbers.join(', ')}>
                        {r.challan_numbers.join(', ')}
                      </div>
                      <div className="text-muted" style={{ fontSize: 10 }}>{r.delivery_count} deliveries</div>
                    </td>
                  </tr>
                );
              })}</tbody>
              <tfoot>
                <tr style={{ fontWeight: 700, background: 'var(--card-bg)' }}>
                  <td colSpan={2} style={{ textAlign: 'right' }}>Grand Total:</td>
                  <td className="text-right text-mono">{sumTotalQty.toLocaleString()}</td>
                  <td></td>
                  <td className="text-right text-mono fw-bold">
                    {sumTotalBDT > 0 && <div>{fmtBDT2(sumTotalBDT)}</div>}
                    {sumTotalUSD > 0 && <div style={{ color: '#f59e0b' }}>{fmtUSD2(sumTotalUSD)}</div>}
                  </td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
          </div>
        );
      }
      case 'categoryDeliverySummary': {
        const catData = getExportData();
        const sumTotalQty = catData.reduce((s, r) => s + r.total_delivered, 0);
        const sumUniqueItems = catData.reduce((s, r) => s + (r.unique_items || 0), 0);
        const sumTotalBDT = catData.reduce((s, r) => s + r.total_value_bdt, 0);
        const sumTotalUSD = catData.reduce((s, r) => s + r.total_value_usd, 0);
        const sumCategories = catData.length;

        const fmtBDT2 = (v) => `৳${Number(v || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}`;
        const fmtUSD2 = (v) => `$${Number(v || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}`;

        return (
          <div>
            {/* Summary Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginBottom: 16 }}>
              <div className="card" style={{ padding: '14px 18px', background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)', color: '#fff', borderRadius: 10 }}>
                <div style={{ fontSize: 11, opacity: 0.85, marginBottom: 4 }}>Total Categories</div>
                <div style={{ fontSize: 24, fontWeight: 700 }}>{sumCategories}</div>
              </div>
              <div className="card" style={{ padding: '14px 18px', background: 'linear-gradient(135deg, #ec4899 0%, #be185d 100%)', color: '#fff', borderRadius: 10 }}>
                <div style={{ fontSize: 11, opacity: 0.85, marginBottom: 4 }}>Total Unique Items</div>
                <div style={{ fontSize: 24, fontWeight: 700 }}>{sumUniqueItems.toLocaleString()}</div>
              </div>
              <div className="card" style={{ padding: '14px 18px', background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)', color: '#fff', borderRadius: 10 }}>
                <div style={{ fontSize: 11, opacity: 0.85, marginBottom: 4 }}>Total Delivery Qty</div>
                <div style={{ fontSize: 24, fontWeight: 700 }}>{sumTotalQty.toLocaleString()}</div>
              </div>
              <div className="card" style={{ padding: '14px 18px', background: 'linear-gradient(135deg, #1e40af 0%, #3b82f6 100%)', color: '#fff', borderRadius: 10 }}>
                <div style={{ fontSize: 11, opacity: 0.85, marginBottom: 4 }}>Total Value (BDT)</div>
                <div style={{ fontSize: 22, fontWeight: 700 }}>{fmtBDT2(sumTotalBDT)}</div>
              </div>
              {sumTotalUSD > 0 && (
                <div className="card" style={{ padding: '14px 18px', background: 'linear-gradient(135deg, #b45309 0%, #f59e0b 100%)', color: '#fff', borderRadius: 10 }}>
                  <div style={{ fontSize: 11, opacity: 0.85, marginBottom: 4 }}>Total Value (USD)</div>
                  <div style={{ fontSize: 22, fontWeight: 700 }}>{fmtUSD2(sumTotalUSD)}</div>
                </div>
              )}
            </div>

            <table className="data-table">
              <thead>
                <tr>
                  <th>SL No.</th>
                  <SortHeader label="Category Name" field="category_name" />
                  <SortHeader label="Unique Items" field="unique_items" className="text-center" />
                  <SortHeader label="Total Delivered" field="total_delivered" className="text-right" />
                  <th className="text-right">Total Value (BDT)</th>
                  <th className="text-right">Total Value (USD)</th>
                </tr>
              </thead>
              <tbody>{catData.map((r, i) => (
                <tr key={i}>
                  <td>{i + 1}</td>
                  <td style={{ fontWeight: 600 }}>{r.category_name}</td>
                  <td className="text-center text-mono text-muted">{r.unique_items}</td>
                  <td className="text-right text-mono fw-bold text-success">{r.total_delivered.toLocaleString()}</td>
                  <td className="text-right text-mono">{r.total_value_bdt > 0 ? fmtBDT2(r.total_value_bdt) : '-'}</td>
                  <td className="text-right text-mono" style={{ color: '#f59e0b' }}>{r.total_value_usd > 0 ? fmtUSD2(r.total_value_usd) : '-'}</td>
                </tr>
              ))}</tbody>
              <tfoot>
                <tr style={{ fontWeight: 700, background: 'var(--card-bg)' }}>
                  <td colSpan={2} style={{ textAlign: 'right' }}>Grand Total:</td>
                  <td className="text-center text-mono fw-bold">{sumUniqueItems.toLocaleString()}</td>
                  <td className="text-right text-mono">{sumTotalQty.toLocaleString()}</td>
                  <td className="text-right text-mono fw-bold">{sumTotalBDT > 0 ? fmtBDT2(sumTotalBDT) : '-'}</td>
                  <td className="text-right text-mono fw-bold" style={{ color: '#f59e0b' }}>{sumTotalUSD > 0 ? fmtUSD2(sumTotalUSD) : '-'}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        );
      }
      case 'dailyDelivery':
      case 'monthlyReport': {
        // Compute summary
        const deliveryData = sortedData;
        const totalItems = deliveryData.length;
        const totalQty = deliveryData.reduce((s, r) => s + (Number(r.shipped_quantity) || 0), 0);
        const totalBDT = deliveryData.filter(r => (r.currency || 'BDT') !== 'USD').reduce((s, r) => s + ((Number(r.shipped_quantity) || 0) * (Number(r.unit_price) || 0)), 0);
        const totalUSD = deliveryData.filter(r => r.currency === 'USD').reduce((s, r) => s + ((Number(r.shipped_quantity) || 0) * (Number(r.unit_price) || 0)), 0);

        // Buyer-wise breakdown
        const buyerMap = {};
        deliveryData.forEach(r => {
          const buyer = r.buyer_name || 'N/A';
          if (!buyerMap[buyer]) buyerMap[buyer] = { qty: 0, bdt: 0, usd: 0, count: 0 };
          buyerMap[buyer].count++;
          buyerMap[buyer].qty += (Number(r.shipped_quantity) || 0);
          if (r.currency === 'USD') buyerMap[buyer].usd += (Number(r.shipped_quantity) || 0) * (Number(r.unit_price) || 0);
          else buyerMap[buyer].bdt += (Number(r.shipped_quantity) || 0) * (Number(r.unit_price) || 0);
        });
        const buyerSummary = Object.entries(buyerMap).sort((a, b) => (b[1].bdt + b[1].usd) - (a[1].bdt + a[1].usd));

        const fmtBDT = (v) => `৳${Number(v || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}`;
        const fmtUSD = (v) => `$${Number(v || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}`;

        return (
          <div>
            {/* Summary Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginBottom: 16 }}>
              <div className="card" style={{ padding: '14px 18px', background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)', color: '#fff', borderRadius: 10 }}>
                <div style={{ fontSize: 11, opacity: 0.85, marginBottom: 4 }}>Total Items</div>
                <div style={{ fontSize: 24, fontWeight: 700 }}>{totalItems}</div>
              </div>
              <div className="card" style={{ padding: '14px 18px', background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)', color: '#fff', borderRadius: 10 }}>
                <div style={{ fontSize: 11, opacity: 0.85, marginBottom: 4 }}>Total Delivery Qty</div>
                <div style={{ fontSize: 24, fontWeight: 700 }}>{totalQty.toLocaleString()}</div>
              </div>
              <div className="card" style={{ padding: '14px 18px', background: 'linear-gradient(135deg, #1e40af 0%, #3b82f6 100%)', color: '#fff', borderRadius: 10 }}>
                <div style={{ fontSize: 11, opacity: 0.85, marginBottom: 4 }}>Total Value (BDT)</div>
                <div style={{ fontSize: 22, fontWeight: 700 }}>{fmtBDT(totalBDT)}</div>
              </div>
              {totalUSD > 0 && (
                <div className="card" style={{ padding: '14px 18px', background: 'linear-gradient(135deg, #b45309 0%, #f59e0b 100%)', color: '#fff', borderRadius: 10 }}>
                  <div style={{ fontSize: 11, opacity: 0.85, marginBottom: 4 }}>Total Value (USD)</div>
                  <div style={{ fontSize: 22, fontWeight: 700 }}>{fmtUSD(totalUSD)}</div>
                </div>
              )}
            </div>

            {/* Buyer-wise Summary */}
            {buyerSummary.length > 0 && (
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8, color: 'var(--text-secondary)' }}>Item Summary</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 8 }}>
                  {buyerSummary.map(([buyer, s]) => (
                    <div key={buyer} className="card" style={{ padding: '10px 14px', borderRadius: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: 13 }}>{buyer}</div>
                        <div className="text-muted" style={{ fontSize: 11 }}>{s.count} items · Qty: {s.qty.toLocaleString()}</div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        {s.bdt > 0 && <div style={{ fontWeight: 700, fontSize: 13 }}>{fmtBDT(s.bdt)}</div>}
                        {s.usd > 0 && <div style={{ fontWeight: 700, fontSize: 13, color: '#f59e0b' }}>{fmtUSD(s.usd)}</div>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <table className="data-table">
              <thead>
                <tr>
                  <th>SL No.</th>
                  <SortHeader label="Item Details" field="item_name" />
                  <SortHeader label="Buyer" field="buyer_name" />
                  <SortHeader label="Style" field="style_name" />
                  <SortHeader label="Delivery Qty" field="shipped_quantity" className="text-right" />
                  <SortHeader label="Unit Price" field="unit_price" className="text-right" />
                  <th className="text-right">Total Value</th>
                  <SortHeader label="Challan No." field="challan_number" />
                </tr>
              </thead>
              <tbody>{deliveryData.map((r, i) => (
                <tr key={i}>
                  <td>{i + 1}</td>
                  <td>
                    <div style={{ fontWeight: 600 }}>{r.item_name || '-'}</div>
                    <div className="text-muted" style={{ fontSize: 11 }}>{[r.size, r.color].filter(Boolean).join(' / ') || '-'}</div>
                  </td>
                  <td>{r.buyer_name || '-'}</td>
                  <td>{r.style_name || '-'}</td>
                  <td className="text-right text-mono fw-bold text-success">{r.shipped_quantity}</td>
                  <td className="text-right text-mono">{r.currency === 'USD' ? '$' : '৳'}{Number(r.unit_price || 0).toFixed(2)}</td>
                  <td className="text-right text-mono fw-bold">{r.currency === 'USD' ? '$' : '৳'}{Number((r.shipped_quantity || 0) * (r.unit_price || 0)).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                  <td className="text-mono" style={{ fontSize: 12, color: 'var(--accent)' }}>{r.challan_number}</td>
                </tr>
              ))}</tbody>
              <tfoot>
                <tr style={{ fontWeight: 700, background: 'var(--card-bg)' }}>
                  <td colSpan={4} style={{ textAlign: 'right' }}>Grand Total:</td>
                  <td className="text-right text-mono">{totalQty.toLocaleString()}</td>
                  <td></td>
                  <td className="text-right text-mono fw-bold">
                    {totalBDT > 0 && <div>{fmtBDT(totalBDT)}</div>}
                    {totalUSD > 0 && <div style={{ color: '#f59e0b' }}>{fmtUSD(totalUSD)}</div>}
                  </td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
          </div>
        );
      }
      case 'audit':
        return renderAuditReport();
    }

  };

  // ==================== AUDIT REPORT RENDER ====================
  const renderAuditReport = () => {
    if (loading) return <div className="loading"><div className="spinner"></div></div>;
    if (!auditData) return <div className="empty-state"><h3>No data</h3><p>Click to load the audit report</p></div>;

    const s = auditData.summary;
    const SECTIONS = [
      { id: 'wip', label: '🔧 Working Process In Hand', count: s.wip.itemCount, color: '#f59e0b' },
      { id: 'fg', label: '📦 Finished Goods In Hand', count: s.finished.itemCount, color: '#10b981' },
      { id: 'raw', label: '🧱 Raw Material In Hand', count: s.raw.itemCount, color: '#6366f1' },
    ];

    const fmtBDT = (v) => `৳${Number(v || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}`;
    const fmtUSD = (v) => `$${Number(v || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}`;

    return (
      <div>
        {/* Report Header */}
        <div style={{
          background: 'linear-gradient(135deg, #1e1b4b 0%, #312e81 50%, #4338ca 100%)',
          borderRadius: 12, padding: '24px 28px', marginBottom: 20, color: '#fff'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <h2 style={{ margin: 0, fontSize: 22, fontWeight: 700, letterSpacing: '-0.5px' }}>
                <ClipboardList size={22} style={{ verticalAlign: 'middle', marginRight: 8 }} />
                Inventory Audit Report
              </h2>
              <p style={{ margin: '6px 0 0', opacity: 0.85, fontSize: 14 }}>In Hand Stock &nbsp;|&nbsp; As of {formatCutoffDisplay(auditData?.cutoffDate || auditCutoffDate)}</p>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
                <label style={{ fontSize: 11, opacity: 0.7, letterSpacing: '0.5px' }}>REPORT DATE</label>
                <input
                  type="date"
                  value={auditCutoffDate}
                  onChange={e => setAuditCutoffDate(e.target.value)}
                  style={{
                    padding: '6px 12px', fontSize: 13, borderRadius: 6,
                    border: '1px solid rgba(255,255,255,0.3)',
                    background: 'rgba(255,255,255,0.12)', color: '#fff',
                    cursor: 'pointer', outline: 'none', minWidth: 150
                  }}
                />
              </div>
              <div style={{ width: 1, height: 40, background: 'rgba(255,255,255,0.2)' }} />
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 11, opacity: 0.7, marginBottom: 4 }}>GRAND TOTAL VALUE</div>
                <div style={{ fontSize: 22, fontWeight: 700 }}>{fmtBDT(s.grandTotalBDT)}</div>
                {s.grandTotalUSD > 0 && <div style={{ fontSize: 16, fontWeight: 600, opacity: 0.9 }}>+ {fmtUSD(s.grandTotalUSD)}</div>}
              </div>
            </div>
          </div>
        </div>

        {/* Summary Cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 24 }}>
          {SECTIONS.map(sec => {
            const sum = sec.id === 'wip' ? s.wip : sec.id === 'fg' ? s.finished : s.raw;
            return (
              <div key={sec.id}
                onClick={() => setAuditSection(sec.id)}
                style={{
                  background: 'var(--card-bg)', border: auditSection === sec.id ? `2px solid ${sec.color}` : '1px solid var(--border)',
                  borderRadius: 10, padding: '18px 20px', cursor: 'pointer', transition: 'all 0.2s',
                  boxShadow: auditSection === sec.id ? `0 0 0 3px ${sec.color}22` : 'none'
                }}
              >
                <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 12, color: sec.color }}>{sec.label}</div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                  <div>
                    <div style={{ fontSize: 28, fontWeight: 700, lineHeight: 1 }}>{sum.itemCount}</div>
                    <div className="text-muted" style={{ fontSize: 11, marginTop: 2 }}>Items &nbsp;|&nbsp; Qty: {Number(sum.totalQty || 0).toLocaleString()}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 16, fontWeight: 600 }}>{fmtBDT(sum.totalBDT)}</div>
                    {sum.totalUSD > 0 && <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>+ {fmtUSD(sum.totalUSD)}</div>}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Section Table */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>
            {SECTIONS.find(s => s.id === auditSection)?.label || ''}
          </h3>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-outline btn-sm" onClick={() => exportAuditExcel(auditSection)} disabled={getAuditSectionData(auditSection).length === 0}>
              <FileSpreadsheet size={14} /> Excel
            </button>
            <button className="btn btn-outline btn-sm" onClick={() => exportAuditPdf(auditSection)} disabled={getAuditSectionData(auditSection).length === 0}>
              <FileText size={14} /> PDF
            </button>
          </div>
        </div>

        {auditSection === 'wip' && renderWIPTable()}
        {auditSection === 'fg' && renderFGTable()}
        {auditSection === 'raw' && renderRawTable()}
      </div>
    );
  };

  const renderWIPTable = () => {
    const items = auditData?.workingProcess || [];
    if (items.length === 0) return <div className="empty-state"><h3>No Working Process Items</h3><p>No outstanding factory-issued items found</p></div>;
    return (
      <table className="data-table">
        <thead>
          <tr>
            <th>Issue ID</th>
            <th>Factory</th>
            <th>Item / Code</th>
            <th>Style / Purchase / Order</th>
            <th>Size / Color</th>
            <th>Buyer</th>
            <th className="text-right">Issued</th>
            <th className="text-right">Consumed</th>
            <th className="text-right">Returned</th>
            <th className="text-right">Outstanding</th>
            <th>Unit</th>
            <th className="text-right">Unit Price</th>
            <th className="text-right">Outstanding Value</th>
          </tr>
        </thead>
        <tbody>{items.map((r, i) => (
          <tr key={i}>
            <td className="text-mono" style={{ fontSize: 12, color: 'var(--accent)' }}>{r.issue_id}</td>
            <td style={{ fontSize: 12 }}>{r.recipient_name || '-'}</td>
            <td>
              <div style={{ fontWeight: 600 }}>{r.item_name}</div>
              <div className="text-mono text-muted" style={{ fontSize: 11 }}>{r.item_code}</div>
            </td>
            <td style={{ fontSize: 12 }}>
              <div>{r.style_name || '-'}</div>
              <div className="text-muted" style={{ fontSize: 11 }}>{r.purchase_no || '-'} / {r.order_number || '-'}</div>
            </td>
            <td>{[r.size, r.color].filter(Boolean).join(' / ') || '-'}</td>
            <td>{r.buyer_name || '-'}</td>
            <td className="text-right text-mono">{r.issued_qty}</td>
            <td className="text-right text-mono text-muted">{r.consumed_qty}</td>
            <td className="text-right text-mono text-muted">{r.returned_qty}</td>
            <td className="text-right text-mono fw-bold" style={{ color: '#f59e0b' }}>{r.outstanding}</td>
            <td>{r.unit}</td>
            <td className="text-right text-mono">{r.currency === 'USD' ? '$' : '৳'}{Number(r.unit_price || 0).toFixed(2)}</td>
            <td className="text-right text-mono fw-bold">{r.currency === 'USD' ? '$' : '৳'}{Number(r.outstanding_value || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
          </tr>
        ))}</tbody>
        <tfoot>
          <tr style={{ fontWeight: 700, background: 'var(--card-bg)' }}>
            <td colSpan={6} style={{ textAlign: 'right' }}>Total:</td>
            <td className="text-right text-mono">{items.reduce((s, r) => s + (r.issued_qty || 0), 0)}</td>
            <td className="text-right text-mono">{items.reduce((s, r) => s + (r.consumed_qty || 0), 0)}</td>
            <td className="text-right text-mono">{items.reduce((s, r) => s + (r.returned_qty || 0), 0)}</td>
            <td className="text-right text-mono" style={{ color: '#f59e0b' }}>{items.reduce((s, r) => s + (r.outstanding || 0), 0)}</td>
            <td></td>
            <td></td>
            <td className="text-right text-mono fw-bold">
              ৳{items.filter(r => (r.currency || 'BDT') !== 'USD').reduce((s, r) => s + (r.outstanding_value || 0), 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
              {items.some(r => r.currency === 'USD') && <div>+ ${items.filter(r => r.currency === 'USD').reduce((s, r) => s + (r.outstanding_value || 0), 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>}
            </td>
          </tr>
        </tfoot>
      </table>
    );
  };

  const renderFGTable = () => {
    const items = auditData?.finishedGoods || [];
    if (items.length === 0) return <div className="empty-state"><h3>No Finished Goods</h3><p>No production items with stock found</p></div>;
    return (
      <table className="data-table">
        <thead>
          <tr>
            <th>Item Code</th>
            <th>Item Name</th>
            <th>Style / Purchase / Order</th>
            <th>Size / Color</th>
            <th>Buyer</th>
            <th className="text-right">Stock In Hand</th>
            <th>Unit</th>
            <th className="text-right">Unit Price</th>
            <th className="text-right">Total Value</th>
          </tr>
        </thead>
        <tbody>{items.map((r, i) => (
          <tr key={i}>
            <td className="text-mono" style={{ fontSize: 12 }}>{r.item_code}</td>
            <td style={{ fontWeight: 600 }}>{r.name}</td>
            <td style={{ fontSize: 12 }}>
              <div>{r.style_name || '-'}</div>
              <div className="text-muted" style={{ fontSize: 11 }}>{r.purchase_no || '-'} / {r.order_number || '-'}</div>
            </td>
            <td>{[r.size, r.color].filter(Boolean).join(' / ') || '-'}</td>
            <td>{r.buyer_name || '-'}</td>
            <td className="text-right text-mono fw-bold" style={{ color: '#10b981' }}>{r.current_stock}</td>
            <td>{r.unit}</td>
            <td className="text-right text-mono">{r.currency === 'USD' ? '$' : '৳'}{Number(r.unit_price || 0).toFixed(2)}</td>
            <td className="text-right text-mono fw-bold">{r.currency === 'USD' ? '$' : '৳'}{Number(r.total_value || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
          </tr>
        ))}</tbody>
        <tfoot>
          <tr style={{ fontWeight: 700, background: 'var(--card-bg)' }}>
            <td colSpan={4} style={{ textAlign: 'right' }}>Total:</td>
            <td></td>
            <td className="text-right text-mono" style={{ color: '#10b981' }}>{items.reduce((s, r) => s + (r.current_stock || 0), 0)}</td>
            <td></td>
            <td></td>
            <td className="text-right text-mono fw-bold">
              ৳{items.filter(r => (r.currency || 'BDT') !== 'USD').reduce((s, r) => s + (r.total_value || 0), 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
              {items.some(r => r.currency === 'USD') && <div>+ ${items.filter(r => r.currency === 'USD').reduce((s, r) => s + (r.total_value || 0), 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>}
            </td>
          </tr>
        </tfoot>
      </table>
    );
  };

  const renderRawTable = () => {
    const items = auditData?.rawMaterials || [];
    if (items.length === 0) return <div className="empty-state"><h3>No Raw Materials</h3><p>No sourced items with stock found</p></div>;
    return (
      <table className="data-table">
        <thead>
          <tr>
            <th>Item Code</th>
            <th>Item Name</th>
            <th>Style / Purchase / Order</th>
            <th>Size / Color</th>
            <th>Buyer</th>
            <th>Supplier</th>
            <th className="text-right">Stock In Hand</th>
            <th>Unit</th>
            <th className="text-right">Unit Price</th>
            <th className="text-right">Total Value</th>
          </tr>
        </thead>
        <tbody>{items.map((r, i) => (
          <tr key={i}>
            <td className="text-mono" style={{ fontSize: 12 }}>{r.item_code}</td>
            <td style={{ fontWeight: 600 }}>{r.name}</td>
            <td style={{ fontSize: 12 }}>
              <div>{r.style_name || '-'}</div>
              <div className="text-muted" style={{ fontSize: 11 }}>{r.purchase_no || '-'} / {r.order_number || '-'}</div>
            </td>
            <td>{[r.size, r.color].filter(Boolean).join(' / ') || '-'}</td>
            <td>{r.buyer_name || '-'}</td>
            <td style={{ fontSize: 12 }}>{r.supplier_name || '-'}</td>
            <td className="text-right text-mono fw-bold" style={{ color: '#6366f1' }}>{r.current_stock}</td>
            <td>{r.unit}</td>
            <td className="text-right text-mono">{r.currency === 'USD' ? '$' : '৳'}{Number(r.unit_price || 0).toFixed(2)}</td>
            <td className="text-right text-mono fw-bold">{r.currency === 'USD' ? '$' : '৳'}{Number(r.total_value || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
          </tr>
        ))}</tbody>
        <tfoot>
          <tr style={{ fontWeight: 700, background: 'var(--card-bg)' }}>
            <td colSpan={5} style={{ textAlign: 'right' }}>Total:</td>
            <td></td>
            <td className="text-right text-mono" style={{ color: '#6366f1' }}>{items.reduce((s, r) => s + (r.current_stock || 0), 0)}</td>
            <td></td>
            <td></td>
            <td className="text-right text-mono fw-bold">
              ৳{items.filter(r => (r.currency || 'BDT') !== 'USD').reduce((s, r) => s + (r.total_value || 0), 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
              {items.some(r => r.currency === 'USD') && <div>+ ${items.filter(r => r.currency === 'USD').reduce((s, r) => s + (r.total_value || 0), 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>}
            </td>
          </tr>
        </tfoot>
      </table>
    );
  };

  // Detail view for a specific item's transactions
  if (detailItem) {
    return (
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <button className="btn btn-outline" onClick={() => { setDetailItem(null); setDetailData([]); }}><ArrowLeft size={16} /> Back to Stock Movement</button>
          <div style={{ display: 'flex', gap: 10 }}>
            <button className="btn btn-outline btn-sm" onClick={exportDetailExcel} disabled={detailData.length === 0}><FileSpreadsheet size={14} /> Excel</button>
            <button className="btn btn-outline btn-sm" onClick={exportDetailPdf} disabled={detailData.length === 0}><FileText size={14} /> PDF</button>
          </div>
        </div>
        <div className="card mb-4" style={{ padding: '16px 20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>{detailItem.item_name}</h3>
              <p className="text-muted" style={{ margin: '4px 0 0', fontSize: 13 }}>Code: {detailItem.item_code} &nbsp;|&nbsp; Unit: {detailItem.unit} &nbsp;|&nbsp; Unit Price: {detailItem.currency === 'USD' ? '$' : '৳'}{Number(detailItem.unit_price || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })} &nbsp;|&nbsp; Buyer: <strong>{detailItem.buyer_name || '-'}</strong></p>
              <p className="text-muted" style={{ margin: '2px 0 0', fontSize: 13 }}>Style: <strong>{detailItem.style_name || '-'}</strong> &nbsp;|&nbsp; Purchase: <strong>{detailItem.purchase_no || '-'}</strong> &nbsp;|&nbsp; Order: <strong>{detailItem.order_number || '-'}</strong> &nbsp;|&nbsp; Size/Color: <strong>{[detailItem.size, detailItem.color].filter(Boolean).join(' / ') || '-'}</strong></p>
            </div>
            <div style={{ display: 'flex', gap: 20, alignItems: 'center' }}>
              <div style={{ textAlign: 'center' }}>
                <div className="text-success" style={{ fontSize: 20, fontWeight: 700 }}>{detailItem.total_in}</div>
                <div className="text-muted" style={{ fontSize: 11 }}>Total IN</div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div className="text-warning" style={{ fontSize: 20, fontWeight: 700 }}>{detailItem.total_out}</div>
                <div className="text-muted" style={{ fontSize: 11 }}>Total OUT</div>
              </div>
              <div style={{ width: 1, height: 30, backgroundColor: 'var(--border)', margin: '0 4px' }}></div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--accent)' }}>{detailItem.current_stock}</div>
                <div className="text-muted" style={{ fontSize: 11 }}>Current Stock</div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--accent)' }}>{detailItem.currency === 'USD' ? '$' : '৳'}{Number(detailItem.current_stock * (detailItem.unit_price || 0)).toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
                <div className="text-muted" style={{ fontSize: 11 }}>Current Value</div>
              </div>
            </div>
          </div>
        </div>
        {detailLoading ? <div className="loading"><div className="spinner"></div></div> : detailData.length === 0 ? (
          <div className="empty-state"><h3>No transactions</h3><p>No stock transactions found for this item</p></div>
        ) : (
          <div className="table-wrapper">
            <table className="data-table">
              <thead><tr><th>Date & Time</th><th>Type</th><th style={{ textAlign: 'right' }}>Qty</th><th style={{ textAlign: 'right' }}>Unit Price</th><th style={{ textAlign: 'right' }}>Total Value</th><th style={{ textAlign: 'right' }}>Stock Before</th><th style={{ textAlign: 'right' }}>Stock After</th><th>Reference</th><th>By</th><th>Notes</th></tr></thead>
              <tbody>{detailData.map((t, i) => (
                <tr key={i}>
                  <td style={{ fontSize: 12 }}>{new Date(t.created_at).toLocaleString('en-GB')}</td>
                  <td><span className={`badge badge-${t.type === 'IN' ? 'success' : 'warning'}`}>{t.type}</span></td>
                  <td className="text-right text-mono fw-bold">{t.quantity}</td>
                  <td className="text-right text-mono">{t.currency === 'USD' ? '$' : '৳'}{Number(t.unit_price || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                  <td className="text-right text-mono">{t.currency === 'USD' ? '$' : '৳'}{Number(t.quantity * (t.unit_price || 0)).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                  <td className="text-right text-mono text-muted">{t.stock_before}</td>
                  <td className="text-right text-mono fw-bold">{t.stock_after}</td>
                  <td style={{ fontSize: 12 }}>{t.reference || t.challan_number || '-'}</td>
                  <td style={{ fontSize: 12 }}>{t.created_by_name || '-'}</td>
                  <td className="text-muted" style={{ fontSize: 12, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.notes || '-'}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        )}
      </div>
    );
  }

  return (
    <div>
      <div className="tabs">
        {TABS.map(t => <button key={t.id} className={`tab ${activeTab === t.id ? 'active' : ''}`} onClick={() => { setActiveTab(t.id); setSearch(''); }}>{t.label}</button>)}
      </div>

      <div className="toolbar" style={{ flexWrap: 'wrap', gap: 10 }}>
        <div className="toolbar-left" style={{ flexWrap: 'wrap', gap: 10 }}>
          {(activeTab === 'stock' || activeTab === 'movement' || activeTab === 'challan' || activeTab === 'itemChallan' || activeTab === 'dailyDelivery' || activeTab === 'itemDeliverySummary' || activeTab === 'categoryDeliverySummary' || activeTab === 'monthlyReport') && (
            <input className="form-input" placeholder="Search..." value={search} onChange={e => setSearch(e.target.value)} style={{ width: 180, padding: '8px 12px', fontSize: 13 }} />
          )}

          <div className="toolbar-row" style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <select className="form-input" style={{ width: 150 }} value={buyerName} onChange={e => setBuyerName(e.target.value)}>
              <option value="">All Buyers</option>
              {distinctValues.buyers.map(v => <option key={v} value={v}>{v}</option>)}
            </select>
            <select className="form-input" style={{ width: 150 }} value={styleName} onChange={e => setStyleName(e.target.value)}>
              <option value="">All Styles</option>
              {distinctValues.styles.map(v => <option key={v} value={v}>{v}</option>)}
            </select>
            <select className="form-select" value={orderNumber} onChange={e => setOrderNumber(e.target.value)} style={{ width: 140, padding: '8px 12px', fontSize: 13 }}>
              <option value="">All Orders</option>
              {distinctValues.orders?.map((v, i) => <option key={i} value={v}>{v}</option>)}
            </select>
            <select className="form-select" value={purchaseNo} onChange={e => setPurchaseNo(e.target.value)} style={{ width: 140, padding: '8px 12px', fontSize: 13 }}>
              <option value="">All Purchase No</option>
              {distinctValues.purchases.map((v, i) => <option key={i} value={v}>{v}</option>)}
            </select>
            {(activeTab === 'challan' || activeTab === 'itemChallan' || activeTab === 'dailyDelivery' || activeTab === 'itemDeliverySummary' || activeTab === 'categoryDeliverySummary' || activeTab === 'monthlyReport') && (
              <>
                <select className="form-select" value={status} onChange={e => setStatus(e.target.value)} style={{ width: 120, padding: '8px 12px', fontSize: 13 }}>
                  <option value="">All Status</option>
                  <option value="ACTIVE">Active</option>
                  <option value="CANCELLED">Inactive</option>
                </select>
                <select className="form-select" style={{ width: 150, padding: '8px 12px', fontSize: 13 }} value={receiverName} onChange={e => setReceiverName(e.target.value)}>
                  <option value="">All Recipients</option>
                  {recipientsList.map(r => <option key={r.id} value={r.name}>{r.name}</option>)}
                </select>
              </>
            )}
          </div>

          {(activeTab === 'movement' || activeTab === 'challan' || activeTab === 'itemChallan' || activeTab === 'dailyDelivery' || activeTab === 'itemDeliverySummary' || activeTab === 'categoryDeliverySummary' || activeTab === 'monthlyReport') && (
            <div className="filter-group">
              <input type="date" className="form-input" value={dateFrom} onChange={e => setDateFrom(e.target.value)} style={{ width: 130, padding: '8px 12px', fontSize: 13 }} />
              <span className="text-muted">to</span>
              <input type="date" className="form-input" value={dateTo} onChange={e => setDateTo(e.target.value)} style={{ width: 130, padding: '8px 12px', fontSize: 13 }} />
            </div>
          )}
        </div>
        <div className="toolbar-right">
          <button className="btn btn-outline btn-sm" onClick={exportExcel} disabled={data.length === 0}><FileSpreadsheet size={14} /> Excel</button>
          <button className="btn btn-outline btn-sm" onClick={exportPdf} disabled={data.length === 0}><FileText size={14} /> PDF</button>
        </div>
      </div>

      <div className="table-wrapper">{renderTable()}</div>
    </div>
  );
}

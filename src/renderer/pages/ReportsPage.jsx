import React, { useState, useEffect } from 'react';
import useStore from '../store/useStore';
import { Download, FileSpreadsheet, FileText, Eye, ArrowLeft, XCircle, Trash2, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';

const TABS = [
  { id: 'stock', label: 'Current Stock' },
  { id: 'movement', label: 'Stock Movement' },
  { id: 'lowStock', label: 'Low Stock' },
  { id: 'challan', label: 'Challan History' },
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
  const [distinctValues, setDistinctValues] = useState({ styles: [], orders: [], purchases: [], buyers: [] });
  const [detailItem, setDetailItem] = useState(null);
  const [detailData, setDetailData] = useState([]);
  const [detailLoading, setDetailLoading] = useState(false);
  const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' });

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
    fetchDV();
  }, []);

  useEffect(() => { loadReport(); }, [activeTab, dateFrom, dateTo, search, styleName, orderNumber, purchaseNo, buyerName]);

  const loadReport = async () => {
    setLoading(true);
    try {
      let res;
      const filters = { dateFrom, dateTo, search, styleName, orderNumber, purchaseNo, buyerName, status: status || undefined };
      switch (activeTab) {
        case 'stock': res = await window.kadal.reports.stockReport(filters); break;
        case 'movement': res = await window.kadal.reports.movementReport(filters); break;
        case 'lowStock': res = await window.kadal.reports.lowStockReport(filters); break;
        case 'challan': res = await window.kadal.reports.challanHistory(filters); break;
      }

      if (res?.success) setData(res.data || []);
    } catch (e) { addToast('error', 'Failed to load report'); }
    setLoading(false);
  };

  const exportExcel = async () => {
    const res = await window.kadal.reports.exportExcel(activeTab, data);
    if (res?.success) addToast('success', 'Excel exported');
    else addToast('error', res?.error || 'Export failed');
  };

  const exportPdf = async () => {
    const res = await window.kadal.reports.exportPdf(activeTab, data);
    if (res?.success) addToast('success', 'PDF exported');
    else addToast('error', res?.error || 'Export failed');
  };

  const exportDetailExcel = async () => {
    const currencySign = detailItem.currency === 'USD' ? '$' : '৳';
    const currentValue = Number(detailItem.current_stock * (detailItem.unit_price||0)).toLocaleString(undefined, {minimumFractionDigits: 2});
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
    const currentValue = Number(detailItem.current_stock * (detailItem.unit_price||0)).toLocaleString(undefined, {minimumFractionDigits: 2});
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
                  <div style={{fontWeight:600}}>{r.name}</div>
                  <div className="text-mono text-muted" style={{fontSize:11}}>{r.item_code}</div>
                </td>
                <td>
                  <div style={{fontSize:12}}>{r.style_name || '-'}</div>
                  <div className="text-muted" style={{fontSize:11}}>{r.purchase_no || '-'} / {r.order_number || '-'}</div>
                </td>
                <td>{[r.size, r.color].filter(Boolean).join(' / ') || '-'}</td>
                <td>{r.buyer_name || '-'}</td>
                <td className="text-right text-mono">{r.currency === 'USD' ? '$' : '৳'}{Number(r.unit_price||0).toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                <td className="text-right text-mono fw-bold" style={{color: r.current_stock<=r.min_stock_level && r.min_stock_level>0?'var(--danger)':'var(--success)'}}>{r.current_stock}</td>
                <td className="text-right text-mono">{r.currency === 'USD' ? '$' : '৳'}{Number((r.current_stock*(r.unit_price||0))).toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
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
                <SortHeader label="Total IN" field="total_in" className="text-right" />
                <SortHeader label="Total OUT" field="total_out" className="text-right" />
                <SortHeader label="Current Stock" field="current_stock" className="text-right" />
                <SortHeader label="Unit" field="unit" />
                <th>Action</th>
              </tr>
            </thead>
            <tbody>{sortedData.map((r,i) => (
              <tr key={i}>
                <td>
                  <div style={{fontWeight:600}}>{r.item_name}</div>
                  <div className="text-mono text-muted" style={{fontSize:11}}>{r.item_code}</div>
                </td>
                <td>
                  <div style={{fontSize:12}}>{r.style_name || '-'}</div>
                  <div className="text-muted" style={{fontSize:11}}>{r.purchase_no || '-'} / {r.order_number || '-'}</div>
                </td>
                <td>{[r.size, r.color].filter(Boolean).join(' / ') || '-'}</td>
                <td>{r.buyer_name || '-'}</td>
                <td className="text-right text-mono text-success">{r.total_in ?? 0}</td>
                <td className="text-right text-mono text-warning">{r.total_out ?? 0}</td>
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
                <th style={{textAlign:'right'}}>Deficit</th>
              </tr>
            </thead>
            <tbody>{sortedData.map(r => (
              <tr key={r.id}>
                <td className="text-mono" style={{fontSize:12}}>{r.item_code}</td><td style={{fontWeight:600}}>{r.name}</td>
                <td>{r.buyer_name || '-'}</td>
                <td>{r.category_name||'-'}</td>
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
                <td className="text-mono" style={{fontSize:12,color:'var(--accent)'}}>{r.challan_number}</td>
                <td style={{fontSize:11}}>{new Date(r.challan_date).toLocaleDateString('en-GB')}</td>
                <td style={{fontSize:12}}>{r.receiver_name}</td>
                <td style={{fontSize:11}}>{r.buyer_name || '-'}</td>
                <td>
                  <div style={{fontWeight:600}}>{r.item_name}</div>
                  <div className="text-muted" style={{fontSize:11}}>{[r.size, r.color].filter(Boolean).join(' / ') || '-'}</div>
                </td>
                <td style={{fontSize:12}}>
                  <div>{r.style_name || '-'}</div>
                  <div className="text-muted" style={{fontSize:11}}>{r.order_number || '-'} / {r.purchase_no || '-'}</div>
                </td>
                <td className="text-right text-mono">{r.order_quantity || 0}</td>

                <td className="text-right text-mono fw-bold text-success">{r.shipped_quantity}</td>
                <td className="text-right text-mono text-warning">{r.total_shipped}</td>
                <td className="text-right text-mono fw-bold" style={{color: r.balance > 0 ? 'var(--danger)' : 'var(--success)'}}>{r.balance}</td>
                <td><span className={`badge badge-${r.status==='ACTIVE'?'success':'danger'}`}>{r.status === 'ACTIVE' ? 'Active' : 'Inactive'}</span></td>
                <td>
                  <div style={{display:'flex', gap:4}}>
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
    }

  };

  // Detail view for a specific item's transactions
  if (detailItem) {
    return (
      <div>
        <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom: 16}}>
          <button className="btn btn-outline" onClick={() => { setDetailItem(null); setDetailData([]); }}><ArrowLeft size={16} /> Back to Stock Movement</button>
          <div style={{display:'flex', gap:10}}>
            <button className="btn btn-outline btn-sm" onClick={exportDetailExcel} disabled={detailData.length===0}><FileSpreadsheet size={14} /> Excel</button>
            <button className="btn btn-outline btn-sm" onClick={exportDetailPdf} disabled={detailData.length===0}><FileText size={14} /> PDF</button>
          </div>
        </div>
        <div className="card mb-4" style={{padding: '16px 20px'}}>
          <div style={{display:'flex', justifyContent:'space-between', alignItems:'center'}}>
            <div>
              <h3 style={{margin:0, fontSize:18, fontWeight:700}}>{detailItem.item_name}</h3>
              <p className="text-muted" style={{margin:'4px 0 0', fontSize:13}}>Code: {detailItem.item_code} &nbsp;|&nbsp; Unit: {detailItem.unit} &nbsp;|&nbsp; Unit Price: {detailItem.currency === 'USD' ? '$' : '৳'}{Number(detailItem.unit_price||0).toLocaleString(undefined, {minimumFractionDigits: 2})} &nbsp;|&nbsp; Buyer: <strong>{detailItem.buyer_name || '-'}</strong></p>
              <p className="text-muted" style={{margin:'2px 0 0', fontSize:13}}>Style: <strong>{detailItem.style_name || '-'}</strong> &nbsp;|&nbsp; Purchase: <strong>{detailItem.purchase_no || '-'}</strong> &nbsp;|&nbsp; Order: <strong>{detailItem.order_number || '-'}</strong> &nbsp;|&nbsp; Size/Color: <strong>{[detailItem.size, detailItem.color].filter(Boolean).join(' / ') || '-'}</strong></p>
            </div>
            <div style={{display:'flex', gap:20, alignItems:'center'}}>
              <div style={{textAlign:'center'}}>
                <div className="text-success" style={{fontSize:20,fontWeight:700}}>{detailItem.total_in}</div>
                <div className="text-muted" style={{fontSize:11}}>Total IN</div>
              </div>
              <div style={{textAlign:'center'}}>
                <div className="text-warning" style={{fontSize:20,fontWeight:700}}>{detailItem.total_out}</div>
                <div className="text-muted" style={{fontSize:11}}>Total OUT</div>
              </div>
              <div style={{width: 1, height: 30, backgroundColor: 'var(--border)', margin: '0 4px'}}></div>
              <div style={{textAlign:'center'}}>
                <div style={{fontSize:20,fontWeight:700,color:'var(--accent)'}}>{detailItem.current_stock}</div>
                <div className="text-muted" style={{fontSize:11}}>Current Stock</div>
              </div>
              <div style={{textAlign:'center'}}>
                <div style={{fontSize:20,fontWeight:700,color:'var(--accent)'}}>{detailItem.currency === 'USD' ? '$' : '৳'}{Number(detailItem.current_stock * (detailItem.unit_price||0)).toLocaleString(undefined, {minimumFractionDigits: 2})}</div>
                <div className="text-muted" style={{fontSize:11}}>Current Value</div>
              </div>
            </div>
          </div>
        </div>
        {detailLoading ? <div className="loading"><div className="spinner"></div></div> : detailData.length === 0 ? (
          <div className="empty-state"><h3>No transactions</h3><p>No stock transactions found for this item</p></div>
        ) : (
          <div className="table-wrapper">
            <table className="data-table">
              <thead><tr><th>Date & Time</th><th>Type</th><th style={{textAlign:'right'}}>Qty</th><th style={{textAlign:'right'}}>Unit Price</th><th style={{textAlign:'right'}}>Total Value</th><th style={{textAlign:'right'}}>Stock Before</th><th style={{textAlign:'right'}}>Stock After</th><th>Reference</th><th>By</th><th>Notes</th></tr></thead>
              <tbody>{detailData.map((t, i) => (
                <tr key={i}>
                  <td style={{fontSize:12}}>{new Date(t.created_at).toLocaleString('en-GB')}</td>
                  <td><span className={`badge badge-${t.type==='IN'?'success':'warning'}`}>{t.type}</span></td>
                  <td className="text-right text-mono fw-bold">{t.quantity}</td>
                  <td className="text-right text-mono">{t.currency === 'USD' ? '$' : '৳'}{Number(t.unit_price||0).toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                  <td className="text-right text-mono">{t.currency === 'USD' ? '$' : '৳'}{Number(t.quantity*(t.unit_price||0)).toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                  <td className="text-right text-mono text-muted">{t.stock_before}</td>
                  <td className="text-right text-mono fw-bold">{t.stock_after}</td>
                  <td style={{fontSize:12}}>{t.reference || t.challan_number || '-'}</td>
                  <td style={{fontSize:12}}>{t.created_by_name || '-'}</td>
                  <td className="text-muted" style={{fontSize:12, maxWidth:200, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'}}>{t.notes || '-'}</td>
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

      <div className="toolbar" style={{flexWrap:'wrap', gap:10}}>
        <div className="toolbar-left" style={{flexWrap:'wrap', gap:10}}>
          {(activeTab === 'stock' || activeTab === 'movement' || activeTab === 'challan') && (
            <input className="form-input" placeholder="Search..." value={search} onChange={e => setSearch(e.target.value)} style={{width:180,padding:'8px 12px',fontSize:13}} />
          )}
          
          <div className="toolbar-row" style={{display:'flex', gap:10, flexWrap:'wrap'}}>
            <select className="form-input" style={{width: 150}} value={buyerName} onChange={e => setBuyerName(e.target.value)}>
              <option value="">All Buyers</option>
              {distinctValues.buyers.map(v => <option key={v} value={v}>{v}</option>)}
            </select>
            <select className="form-input" style={{width: 150}} value={styleName} onChange={e => setStyleName(e.target.value)}>
              <option value="">All Styles</option>
              {distinctValues.styles.map(v => <option key={v} value={v}>{v}</option>)}
            </select>
              <select className="form-select" value={orderNumber} onChange={e => setOrderNumber(e.target.value)} style={{width:140,padding:'8px 12px',fontSize:13}}>
                <option value="">All Orders</option>
                {distinctValues.orders?.map((v,i) => <option key={i} value={v}>{v}</option>)}
              </select>
            <select className="form-select" value={purchaseNo} onChange={e => setPurchaseNo(e.target.value)} style={{width:140,padding:'8px 12px',fontSize:13}}>
              <option value="">All Purchase No</option>
              {distinctValues.purchases.map((v,i) => <option key={i} value={v}>{v}</option>)}
            </select>
            {activeTab === 'challan' && (
              <select className="form-select" value={status} onChange={e => setStatus(e.target.value)} style={{width:120,padding:'8px 12px',fontSize:13}}>
                <option value="">All Status</option>
                <option value="ACTIVE">Active</option>
                <option value="CANCELLED">Inactive</option>
              </select>
            )}
          </div>

          {(activeTab === 'movement' || activeTab === 'challan') && (
            <div className="filter-group">
              <input type="date" className="form-input" value={dateFrom} onChange={e => setDateFrom(e.target.value)} style={{width:130,padding:'8px 12px',fontSize:13}} />
              <span className="text-muted">to</span>
              <input type="date" className="form-input" value={dateTo} onChange={e => setDateTo(e.target.value)} style={{width:130,padding:'8px 12px',fontSize:13}} />
            </div>
          )}
        </div>
        <div className="toolbar-right">
          <button className="btn btn-outline btn-sm" onClick={exportExcel} disabled={data.length===0}><FileSpreadsheet size={14} /> Excel</button>
          <button className="btn btn-outline btn-sm" onClick={exportPdf} disabled={data.length===0}><FileText size={14} /> PDF</button>
        </div>
      </div>

      <div className="table-wrapper">{renderTable()}</div>
    </div>
  );
}

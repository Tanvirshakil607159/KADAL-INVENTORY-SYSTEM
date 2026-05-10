import React, { useState, useEffect } from 'react';
import useStore from '../store/useStore';
import { Download, FileSpreadsheet, FileText, Eye, ArrowLeft } from 'lucide-react';

const TABS = [
  { id: 'stock', label: 'Current Stock' },
  { id: 'movement', label: 'Stock Movement' },
  { id: 'lowStock', label: 'Low Stock' },
  { id: 'challan', label: 'Challan History' },
];


export default function ReportsPage() {
  const { addToast } = useStore();
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
  const [distinctValues, setDistinctValues] = useState({ styles: [], orders: [], purchases: [], buyers: [] });
  const [detailItem, setDetailItem] = useState(null);
  const [detailData, setDetailData] = useState([]);
  const [detailLoading, setDetailLoading] = useState(false);

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
      const filters = { dateFrom, dateTo, search, styleName, orderNumber, purchaseNo, buyerName };
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

  const renderTable = () => {
    if (loading) return <div className="loading"><div className="spinner"></div></div>;
    if (data.length === 0) return <div className="empty-state"><h3>No data</h3><p>No records found for this report</p></div>;

    switch (activeTab) {
      case 'stock':
        return (
          <table className="data-table">
            <thead>
              <tr>
                <th>Item / Code</th>
                <th>Style / Purchase / Order</th>
                <th>Size / Color</th>
                <th>Buyer</th>
                <th style={{textAlign:'right'}}>Unit Price</th>
                <th style={{textAlign:'right'}}>Stock</th>
                <th style={{textAlign:'right'}}>Total Value</th>
                <th>Unit</th>
                <th style={{textAlign:'right'}}>Min Level</th>
              </tr>
            </thead>
            <tbody>{data.map(r => (
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
                <th>Item / Code</th>
                <th>Style / Purchase / Order</th>
                <th>Size / Color</th>
                <th>Buyer</th>
                <th style={{textAlign:'right'}}>Total IN</th>
                <th style={{textAlign:'right'}}>Total OUT</th>
                <th style={{textAlign:'right'}}>Current Stock</th>
                <th>Unit</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>{data.map((r,i) => (
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
                <td className="text-right text-mono text-success">{r.total_in}</td>
                <td className="text-right text-mono text-warning">{r.total_out}</td>
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
            <thead><tr><th>Code</th><th>Item</th><th>Buyer</th><th>Category</th><th style={{textAlign:'right'}}>Current</th><th style={{textAlign:'right'}}>Min Level</th><th style={{textAlign:'right'}}>Deficit</th></tr></thead>
            <tbody>{data.map(r => (
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
                <th>Challan No</th>
                <th>Date</th>
                <th>Receiver</th>
                <th>Buyer</th>
                <th>Item Details</th>
                <th>Style / Order / Purchase</th>
                <th style={{textAlign:'right'}}>Order Qty</th>

                <th style={{textAlign:'right'}}>Shipped</th>
                <th style={{textAlign:'right'}}>Total Out</th>
                <th style={{textAlign:'right'}}>Balance</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>{data.map((r, i) => (
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
                <td><span className={`badge badge-${r.status==='ACTIVE'?'success':'danger'}`}>{r.status}</span></td>
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

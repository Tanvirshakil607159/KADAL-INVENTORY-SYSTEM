import React, { useEffect, useState } from 'react';
import useStore from '../store/useStore';
import { Search, FileText, XCircle, Eye, Download, FileSpreadsheet } from 'lucide-react';

export default function ChallanHistoryPage() {
  const { addToast, showConfirm } = useStore();
  const [challans, setChallans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [detail, setDetail] = useState(null);

  const loadData = async () => {
    setLoading(true);
    const res = await window.kadal.challans.getAll({ search, status: statusFilter || undefined, dateFrom: dateFrom || undefined, dateTo: dateTo || undefined });
    if (res.success) setChallans(res.data);
    setLoading(false);
  };

  useEffect(() => { loadData(); }, [search, statusFilter, dateFrom, dateTo]);

  const viewDetail = async (id) => {
    const res = await window.kadal.challans.getById(id);
    if (res.success) setDetail(res.data);
  };

  const handleCancel = async (challan) => {
    const reason = prompt('Reason for cancellation:');
    if (!reason) return;
    const confirmed = await showConfirm({ title: 'Cancel Challan', message: `Cancel challan ${challan.challan_number}? Stock will be reversed.`, type: 'warning', confirmText: 'Yes, Cancel' });
    if (!confirmed) return;
    const res = await window.kadal.challans.cancel(challan.id, reason);
    if (res.success) { addToast('success', 'Challan cancelled and stock reversed'); loadData(); setDetail(null); }
    else addToast('error', res.error);
  };

  const exportPdf = async (id) => {
    const res = await window.kadal.challans.exportPdf(id);
    if (res.success) addToast('success', 'PDF generated and opened');
    else addToast('error', res.error || 'Failed to generate PDF');
  };

  const exportListExcel = async () => {
    const res = await window.kadal.reports.exportExcel('challan', challans);
    if (res?.success) addToast('success', 'Excel exported');
    else addToast('error', res?.error || 'Export failed');
  };

  const exportListPdf = async () => {
    const res = await window.kadal.reports.exportPdf('challan', challans);
    if (res?.success) addToast('success', 'PDF exported');
    else addToast('error', res?.error || 'Export failed');
  };

  const setFilterToday = () => {
    const today = new Date().toISOString().split('T')[0];
    setDateFrom(today);
    setDateTo(today);
  };

  const setFilterThisYear = () => {
    const currentYear = new Date().getFullYear();
    setDateFrom(`${currentYear}-01-01`);
    setDateTo(`${currentYear}-12-31`);
  };

  const handleMonthSelect = (e) => {
    const val = e.target.value;
    if (!val) {
      setDateFrom('');
      setDateTo('');
      return;
    }
    const [y, m] = val.split('-');
    const lastDay = new Date(y, m, 0).getDate();
    setDateFrom(`${y}-${m}-01`);
    setDateTo(`${y}-${m}-${lastDay}`);
  };

  if (detail) {
    return (
      <div>
        <button className="btn btn-outline mb-4" onClick={() => setDetail(null)}>← Back to List</button>
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">Challan: {detail.challan_number}</h3>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-primary btn-sm" onClick={() => exportPdf(detail.id)}><Download size={14} /> Export PDF</button>
              {detail.status === 'ACTIVE' && <button className="btn btn-danger btn-sm" onClick={() => handleCancel(detail)}><XCircle size={14} /> Cancel</button>}
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 20 }}>
            <div>
              <p className="text-muted" style={{ fontSize: 12 }}>Receiver</p>
              <p style={{ fontWeight: 600 }}>{detail.receiver_name}</p>
              {detail.receiver_contact && <p className="text-muted">{detail.receiver_contact}</p>}
              {detail.receiver_address && <p className="text-muted">{detail.receiver_address}</p>}
            </div>
            <div>
              <p className="text-muted" style={{ fontSize: 12 }}>Details</p>
              <p>Date: <strong>{new Date(detail.challan_date).toLocaleDateString('en-GB')}</strong></p>
              <p>Status: <span className={`badge badge-${detail.status === 'ACTIVE' ? 'success' : 'danger'}`}>{detail.status}</span></p>
              <p>Created by: {detail.created_by_name}</p>
            </div>
          </div>
          {detail.status === 'CANCELLED' && (
            <div style={{ background: 'var(--danger-dim)', padding: 12, borderRadius: 'var(--radius-sm)', marginBottom: 16, fontSize: 13 }}>
              <strong style={{ color: 'var(--danger)' }}>Cancelled</strong> — {detail.cancel_reason || 'No reason'}
              {detail.cancelled_by_name && <span className="text-muted"> by {detail.cancelled_by_name}</span>}
            </div>
          )}
          <div className="table-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Item / Code</th>
                  <th>Style / Order / Purchase</th>
                  <th>Size / Color</th>
                  <th style={{textAlign:'right'}}>Challan Qty</th>
                  <th style={{textAlign:'right'}}>Order Qty</th>
                  <th style={{textAlign:'right'}}>Total Shipped</th>
                  <th style={{textAlign:'right'}}>Balance</th>
                  <th style={{textAlign:'right'}}>Current Stock</th>
                  <th>Unit</th>
                </tr>
              </thead>
              <tbody>
                {detail.items?.map((item, idx) => {
                  const balance = (item.order_quantity || 0) - (item.total_shipped || 0);
                  return (
                    <tr key={idx}>
                      <td>{idx + 1}</td>
                      <td>
                        <div style={{ fontWeight: 600 }}>{item.item_name}</div>
                        <div className="text-mono" style={{ fontSize: 11, color: 'var(--accent)' }}>{item.item_code}</div>
                      </td>
                      <td style={{ fontSize: 12 }}>
                        <div>{item.style_name || '-'}</div>
                        <div className="text-muted">{item.order_number || '-'} / {item.purchase_no || '-'}</div>
                      </td>
                      <td>{[item.size, item.color].filter(Boolean).join(' / ') || '-'}</td>
                      <td className="text-right text-mono fw-bold">{item.quantity}</td>
                      <td className="text-right text-mono">{item.order_quantity || '-'}</td>
                      <td className="text-right text-mono text-info">{item.total_shipped || 0}</td>
                      <td className="text-right text-mono fw-bold" style={{ color: balance <= 0 ? 'var(--success)' : 'var(--warning)' }}>
                        {balance}
                      </td>
                      <td className="text-right text-mono">{item.current_stock}</td>
                      <td>{item.unit}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {detail.notes && <p className="mt-4 text-muted" style={{ fontStyle: 'italic' }}>Notes: {detail.notes}</p>}
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="toolbar">
        <div className="toolbar-left">
          <div className="search-bar"><Search /><input className="form-input" placeholder="Search by challan no or receiver..." value={search} onChange={e => setSearch(e.target.value)} /></div>
          <select className="form-select" value={statusFilter} onChange={e => setStatusFilter(e.target.value)} style={{ width: 'auto', minWidth: 120, padding: '8px 32px 8px 12px', fontSize: 13 }}>
            <option value="">All Status</option>
            <option value="ACTIVE">Active</option>
            <option value="CANCELLED">Cancelled</option>
          </select>
          <div className="filter-group" style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <button className="btn btn-outline btn-sm" onClick={setFilterToday}>Today</button>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'var(--bg)', borderRadius: 'var(--radius-sm)' }}>
              <span className="text-muted" style={{ fontSize: 12, fontWeight: 500, marginLeft: 4 }}>Month:</span>
              <input type="month" className="form-input" onChange={handleMonthSelect} style={{ width: 130, padding: '6px 8px', fontSize: 13 }} title="Select Month" />
            </div>
            <button className="btn btn-outline btn-sm" onClick={setFilterThisYear}>This Year</button>
            <span style={{ borderLeft: '1px solid var(--border)', height: '24px', margin: '0 4px' }}></span>
            <input type="date" className="form-input" value={dateFrom} onChange={e => setDateFrom(e.target.value)} style={{width:130,padding:'8px 10px',fontSize:13}} />
            <span className="text-muted">to</span>
            <input type="date" className="form-input" value={dateTo} onChange={e => setDateTo(e.target.value)} style={{width:130,padding:'8px 10px',fontSize:13}} />
          </div>
        </div>
        <div className="toolbar-right">
          <button className="btn btn-outline btn-sm" onClick={exportListExcel} disabled={challans.length===0}><FileSpreadsheet size={14} /> Excel</button>
          <button className="btn btn-outline btn-sm" onClick={exportListPdf} disabled={challans.length===0}><FileText size={14} /> PDF</button>
        </div>
      </div>
      {loading ? <div className="loading"><div className="spinner"></div></div> : challans.length === 0 ? (
        <div className="empty-state"><FileText size={48} /><h3>No challans found</h3><p>Create your first challan to see it here</p></div>
      ) : (
        <div className="table-wrapper">
          <table className="data-table">
            <thead><tr><th>Challan No</th><th>Date</th><th>Receiver</th><th>Items</th><th style={{textAlign:'right'}}>Qty</th><th>Status</th><th>Created By</th><th>Actions</th></tr></thead>
            <tbody>
              {challans.map(c => (
                <tr key={c.id}>
                  <td className="text-mono" style={{ fontSize: 12, color: 'var(--accent)' }}>{c.challan_number}</td>
                  <td>{new Date(c.challan_date).toLocaleDateString('en-GB')}</td>
                  <td style={{ fontWeight: 600 }}>{c.receiver_name}</td>
                  <td className="text-muted" style={{ maxWidth: 200, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={c.item_names}>{c.item_names || '-'}</td>
                  <td className="text-right text-mono fw-bold">{c.total_quantity}</td>
                  <td><span className={`badge badge-${c.status === 'ACTIVE' ? 'success' : 'danger'}`}>{c.status}</span></td>
                  <td className="text-muted">{c.created_by_name}</td>
                  <td>
                    <div className="table-actions">
                      <button className="btn btn-ghost btn-icon btn-sm" title="View" onClick={() => viewDetail(c.id)}><Eye size={15} /></button>
                      <button className="btn btn-ghost btn-icon btn-sm" title="PDF" onClick={() => exportPdf(c.id)}><Download size={15} color="var(--accent)" /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

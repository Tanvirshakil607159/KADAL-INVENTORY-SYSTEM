import React, { useState, useEffect, useCallback } from 'react';
import useStore from '../store/useStore';
import { Send, RotateCcw, BarChart3, Plus, Trash2, FileSpreadsheet, FileText, Search, Package } from 'lucide-react';

const TABS = [
  { id: 'entry', label: 'Issue Entry', icon: Send },
  { id: 'return', label: 'Returns', icon: RotateCcw },
  { id: 'reports', label: 'Reports', icon: BarChart3 },
];

const REPORT_TABS = [
  { id: 'issueReport', label: 'Issue Report' },
  { id: 'returnReport', label: 'Return Report' },
  { id: 'employeeOutstanding', label: 'Employee Outstanding' },
  { id: 'issueReturnSummary', label: 'Issue vs Return Summary' },
];

export default function IssuePage() {
  const { addToast, user } = useStore();
  const [activeTab, setActiveTab] = useState('entry');
  return (
    <div>
      <div className="tabs">
        {TABS.map(t => {
          const Icon = t.icon;
          return <button key={t.id} className={`tab ${activeTab === t.id ? 'active' : ''}`} onClick={() => setActiveTab(t.id)}><Icon size={14} style={{marginRight:6}}/>{t.label}</button>;
        })}
      </div>
      {activeTab === 'entry' && <IssueEntryTab addToast={addToast} user={user} />}
      {activeTab === 'return' && <ReturnTab addToast={addToast} user={user} />}
      {activeTab === 'reports' && <ReportsTab addToast={addToast} />}
    </div>
  );
}

// ==================== ISSUE ENTRY TAB ====================
function IssueEntryTab({ addToast, user }) {
  const { issueForm, setIssueForm, issueItems, setIssueItems, clearIssue, openModal, showConfirm } = useStore();
  const [recipients, setRecipients] = useState([]);
  const [allItems, setAllItems] = useState([]);
  const [distinctValues, setDistinctValues] = useState({ styles: [], orders: [], purchases: [] });
  const [nextId, setNextId] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [issues, setIssues] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const isSuperAdmin = user?.role_name === 'Super Admin';

  const loadData = useCallback(async () => {
    try { const r = await window.kadal.recipients.getAll(); if (r?.success) setRecipients(r.data); } catch (e) {}
    try { const r = await window.kadal.items.getAll({}); if (r?.success) setAllItems(r.data); } catch (e) {}
    try { const r = await window.kadal.items.getDistinctValues(); if (r?.success) setDistinctValues(r.data); } catch (e) {}
    try { const r = await window.kadal.issues.getNextId(); if (r?.success) setNextId(r.data); } catch (e) {}
    try { const r = await window.kadal.issues.getAll({}); if (r?.success) setIssues(r.data); } catch (e) {}
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const updateForm = (field, value) => setIssueForm({ ...issueForm, [field]: value });

  const handleRecipientChange = (id) => {
    const rec = recipients.find(r => r.id === Number(id));
    if (rec) setIssueForm({ ...issueForm, recipientId: rec.id, recipientName: rec.name, issueType: rec.type });
  };

  const updateItem = (idx, field, value) => {
    const updated = [...issueItems];
    updated[idx] = { ...updated[idx], [field]: value };
    setIssueItems(updated);
  };

  const removeItem = (idx) => setIssueItems(issueItems.filter((_, i) => i !== idx));

  const handleSubmit = async () => {
    if (!issueForm.recipientId) return addToast('error', 'Select a recipient');
    if (issueItems.length === 0) return addToast('error', 'Add at least one item');
    for (const item of issueItems) {
      if (item.quantity <= 0) return addToast('error', `Invalid quantity for ${item.name}`);
      if (item.quantity > item.currentStock) return addToast('error', `Insufficient stock for ${item.name}`);
    }
    setSubmitting(true);
    try {
      const res = await window.kadal.issues.create({
        issueType: issueForm.issueType, recipientId: issueForm.recipientId, recipientName: issueForm.recipientName,
        issueDate: issueForm.issueDate, expectedReturnDate: issueForm.expectedReturnDate, remarks: issueForm.remarks,
        items: issueItems.map(i => ({ itemId: i.itemId, quantity: Number(i.quantity), unit: i.unit, styleNo: i.styleNo, orderNumber: i.orderNumber, purchaseNo: i.purchaseNo, notes: i.notes })),
      });
      if (res?.success) { addToast('success', `Issue ${res.data.issueId} created!`); clearIssue(); setShowForm(false); loadData(); }
      else addToast('error', res?.error || 'Failed');
    } catch (e) { addToast('error', e.message); }
    setSubmitting(false);
  };

  const handleDelete = async (iss) => {
    const ok = await showConfirm({ title: 'Delete Issue', message: `Delete ${iss.issue_id}? Stock will be reversed. This cannot be undone.`, confirmText: 'Delete', danger: true });
    if (!ok) return;
    try {
      const res = await window.kadal.issues.delete(iss.id);
      if (res?.success) { addToast('success', `Issue ${iss.issue_id} deleted`); loadData(); }
      else addToast('error', res?.error || 'Failed');
    } catch (e) { addToast('error', e.message); }
  };

  if (showForm) {
    return (
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h3 style={{ margin: 0 }}>New Issue — <span style={{ color: 'var(--accent)' }}>{nextId}</span></h3>
          <button className="btn btn-outline" onClick={() => { setShowForm(false); clearIssue(); }}>Cancel</button>
        </div>
        <div className="card" style={{ padding: 20, marginBottom: 16 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
            <div><label className="form-label">Recipient *</label>
              <select className="form-input" value={issueForm.recipientId} onChange={e => handleRecipientChange(e.target.value)}>
                <option value="">Select Recipient</option>
                {recipients.map(r => <option key={r.id} value={r.id}>{r.name} ({r.type})</option>)}
              </select>
            </div>
            <div><label className="form-label">Issue Date</label><input type="date" className="form-input" value={issueForm.issueDate} onChange={e => updateForm('issueDate', e.target.value)} /></div>
            <div><label className="form-label">Expected Return Date</label><input type="date" className="form-input" value={issueForm.expectedReturnDate} onChange={e => updateForm('expectedReturnDate', e.target.value)} /></div>
          </div>
          <div style={{ marginTop: 12 }}><label className="form-label">Remarks</label><input className="form-input" value={issueForm.remarks} onChange={e => updateForm('remarks', e.target.value)} placeholder="Optional remarks..." /></div>
        </div>

        <div className="card" style={{ padding: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <h4 style={{ margin: 0 }}>Items ({issueItems.length})</h4>
            <button className="btn btn-outline btn-sm" onClick={() => openModal('ISSUE_BROWSER', { items: allItems, distinctValues })}>
              <Search size={14} /> Browse Inventory
            </button>
          </div>
          {issueItems.length === 0 ? <p className="text-muted" style={{ textAlign: 'center', padding: 24 }}><Package size={20} style={{marginBottom:6}} /><br/>Click "Browse Inventory" to search and add items</p> : (
            <div className="table-wrapper"><table className="data-table"><thead><tr><th>Item</th><th>Buyer</th><th>Style / Order</th><th style={{textAlign:'right'}}>Stock</th><th style={{textAlign:'right',width:90}}>Qty *</th><th>Unit</th><th>Notes</th><th></th></tr></thead>
              <tbody>{issueItems.map((item, idx) => (
                <tr key={idx}>
                  <td><div style={{fontWeight:600}}>{item.name}</div><div style={{fontSize:11,color:'var(--text-muted)'}}>{item.itemCode}{item.size ? ` | ${item.size}` : ''}{item.color ? ` | ${item.color}` : ''}</div></td>
                  <td style={{fontSize:12}}>{item.buyerName || '-'}</td>
                  <td style={{fontSize:12}}>{item.styleNo || '-'} / {item.orderNumber || '-'}</td>
                  <td className="text-right text-mono fw-bold" style={{color: item.currentStock <= 5 ? 'var(--danger)' : 'var(--success)'}}>{item.currentStock}</td>
                  <td><input type="number" className="form-input" style={{width:80,textAlign:'right'}} value={item.quantity} min={1} max={item.currentStock} onChange={e => updateItem(idx, 'quantity', e.target.value)} /></td>
                  <td style={{fontSize:12}}>{item.unit}</td>
                  <td><input className="form-input" style={{width:100}} value={item.notes} onChange={e => updateItem(idx, 'notes', e.target.value)} placeholder="Notes" /></td>
                  <td><button className="btn btn-ghost btn-icon btn-sm" onClick={() => removeItem(idx)}><Trash2 size={14} color="var(--danger)" /></button></td>
                </tr>
              ))}</tbody>
            </table></div>
          )}
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16, gap: 10 }}>
            <button className="btn btn-primary" onClick={handleSubmit} disabled={submitting || issueItems.length === 0}>
              {submitting ? 'Creating...' : 'Create Issue'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <h3 style={{ margin: 0 }}>Recent Issues</h3>
        <button className="btn btn-primary" onClick={() => setShowForm(true)}><Plus size={14} /> New Issue</button>
      </div>
      {issues.length === 0 ? <div className="empty-state"><h3>No issues yet</h3><p>Create your first issue</p></div> : (
        <div className="table-wrapper"><table className="data-table"><thead><tr><th>Issue ID</th><th>Date</th><th>Type</th><th>Recipient</th><th style={{textAlign:'center'}}>Items</th><th>Status</th><th style={{textAlign:'right'}}>Actions</th></tr></thead>
          <tbody>{issues.map(iss => (
            <tr key={iss.id}>
              <td className="text-mono" style={{color:'var(--accent)',fontSize:12}}>{iss.issue_id}</td>
              <td style={{fontSize:12}}>{new Date(iss.issue_date).toLocaleDateString('en-GB')}</td>
              <td><span className={`badge badge-${iss.issue_type==='FACTORY'?'info':'warning'}`}>{iss.issue_type}</span></td>
              <td>{iss.recipient_name}</td>
              <td className="text-center">{iss.item_count}</td>
              <td><span className={`badge badge-${iss.status==='RETURNED'?'success':iss.status==='PARTIAL'?'warning':'danger'}`}>{iss.status}</span></td>
              <td style={{textAlign:'right'}}>
                <div style={{display:'flex', gap:4, justifyContent:'flex-end'}}>
                  <button className="btn btn-ghost btn-icon btn-sm" onClick={() => window.kadal.issues.exportPdf(iss.id)} title="Download PDF"><FileText size={14} /></button>
                  <button className="btn btn-ghost btn-icon btn-sm" onClick={() => window.kadal.issues.exportExcel(iss.id)} title="Download Excel"><FileSpreadsheet size={14} /></button>
                  {isSuperAdmin && <button className="btn btn-ghost btn-icon btn-sm" onClick={() => handleDelete(iss)} title="Delete"><Trash2 size={14} color="var(--danger)" /></button>}
                </div>
              </td>
            </tr>
          ))}</tbody>
        </table></div>
      )}
    </div>
  );
}

// ==================== RETURN TAB ====================
function ReturnTab({ addToast }) {
  const [issues, setIssues] = useState([]);
  const [selectedIssue, setSelectedIssue] = useState(null);
  const [returnItems, setReturnItems] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [returnDate, setReturnDate] = useState(new Date().toISOString().split('T')[0]);
  const [remarks, setRemarks] = useState('');

  useEffect(() => { loadIssues(); }, []);
  const loadIssues = async () => {
    try {
      const [r1, r2] = await Promise.all([
        window.kadal.issues.getAll({ status: 'PENDING' }),
        window.kadal.issues.getAll({ status: 'PARTIAL' }),
      ]);
      setIssues([...(r1?.data || []), ...(r2?.data || [])]);
    } catch (e) {}
  };

  const selectIssue = async (issueId) => {
    const id = Number(issueId);
    const iss = issues.find(i => i.id === id);
    setSelectedIssue(iss);
    if (!iss) { setReturnItems([]); return; }
    try {
      const res = await window.kadal.issues.getOutstandingItems(id);
      if (res?.success) setReturnItems(res.data.map(i => ({ issueItemId: i.id, itemName: i.item_name, itemCode: i.item_code, remaining: i.remaining, returnedQuantity: 0, damageQuantity: 0, rejectedQuantity: 0, notes: '' })));
    } catch (e) { setReturnItems([]); }
  };

  const updateReturn = (idx, field, value) => {
    const u = [...returnItems]; u[idx] = { ...u[idx], [field]: Number(value) || 0 }; setReturnItems(u);
  };

  const handleSubmit = async () => {
    const valid = returnItems.filter(i => (i.returnedQuantity + i.damageQuantity + i.rejectedQuantity) > 0);
    if (valid.length === 0) return addToast('error', 'Enter return quantities');
    for (const i of valid) { if ((i.returnedQuantity + i.damageQuantity + i.rejectedQuantity) > i.remaining) return addToast('error', `Over-return for ${i.itemName}`); }
    setSubmitting(true);
    try {
      const res = await window.kadal.returns.create({ issueId: selectedIssue.id, returnDate, remarks, items: valid });
      if (res?.success) { addToast('success', `Return processed. Status: ${res.data.newStatus}`); setSelectedIssue(null); setReturnItems([]); loadIssues(); }
      else addToast('error', res?.error || 'Failed');
    } catch (e) { addToast('error', e.message); }
    setSubmitting(false);
  };

  return (
    <div>
      <div className="card" style={{ padding: 20, marginBottom: 16 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
          <div><label className="form-label">Select Issue *</label>
            <select className="form-input" value={selectedIssue?.id || ''} onChange={e => selectIssue(e.target.value)}>
              <option value="">Select pending issue...</option>
              {issues.map(i => <option key={i.id} value={i.id}>{i.issue_id} — {i.recipient_name} ({i.status})</option>)}
            </select>
          </div>
          <div><label className="form-label">Return Date</label><input type="date" className="form-input" value={returnDate} onChange={e => setReturnDate(e.target.value)} /></div>
          <div><label className="form-label">Remarks</label><input className="form-input" value={remarks} onChange={e => setRemarks(e.target.value)} placeholder="Optional" /></div>
        </div>
      </div>
      {selectedIssue && returnItems.length > 0 && (
        <div className="card" style={{ padding: 20 }}>
          <h4 style={{ marginTop: 0 }}>Outstanding Items for {selectedIssue.issue_id}</h4>
          <div className="table-wrapper"><table className="data-table"><thead><tr><th>Item</th><th>Code</th><th style={{textAlign:'right'}}>Remaining</th><th style={{textAlign:'right',width:90}}>Good Qty</th><th style={{textAlign:'right',width:90}}>Damaged</th><th style={{textAlign:'right',width:90}}>Rejected</th><th>Notes</th></tr></thead>
            <tbody>{returnItems.map((item, idx) => (
              <tr key={idx}>
                <td style={{fontWeight:600}}>{item.itemName}</td>
                <td className="text-mono" style={{fontSize:12}}>{item.itemCode}</td>
                <td className="text-right text-mono fw-bold">{item.remaining}</td>
                <td><input type="number" className="form-input" style={{width:80,textAlign:'right'}} min={0} max={item.remaining} value={item.returnedQuantity} onChange={e => updateReturn(idx, 'returnedQuantity', e.target.value)} /></td>
                <td><input type="number" className="form-input" style={{width:80,textAlign:'right'}} min={0} value={item.damageQuantity} onChange={e => updateReturn(idx, 'damageQuantity', e.target.value)} /></td>
                <td><input type="number" className="form-input" style={{width:80,textAlign:'right'}} min={0} value={item.rejectedQuantity} onChange={e => updateReturn(idx, 'rejectedQuantity', e.target.value)} /></td>
                <td><input className="form-input" style={{width:100}} value={item.notes||''} onChange={e => { const u=[...returnItems]; u[idx]={...u[idx],notes:e.target.value}; setReturnItems(u); }} /></td>
              </tr>
            ))}</tbody>
          </table></div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}>
            <button className="btn btn-primary" onClick={handleSubmit} disabled={submitting}>{submitting ? 'Processing...' : 'Process Return'}</button>
          </div>
        </div>
      )}
      {selectedIssue && returnItems.length === 0 && <div className="empty-state"><h3>No outstanding items</h3></div>}
    </div>
  );
}

// ==================== REPORTS TAB ====================
function ReportsTab({ addToast }) {
  const [reportTab, setReportTab] = useState('issueReport');
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [issueType, setIssueType] = useState('');

  useEffect(() => { loadReport(); }, [reportTab, dateFrom, dateTo, issueType]);

  const loadReport = async () => {
    setLoading(true);
    try {
      const filters = { dateFrom, dateTo, issueType: issueType || undefined };
      let res;
      switch (reportTab) {
        case 'issueReport': res = await window.kadal.reports.issueReport(filters); break;
        case 'returnReport': res = await window.kadal.reports.returnReport(filters); break;
        case 'employeeOutstanding': res = await window.kadal.reports.employeeOutstandingReport(filters); break;
        case 'issueReturnSummary': res = await window.kadal.reports.issueReturnSummary(filters); break;
      }
      if (res?.success) setData(res.data || []);
    } catch (e) { addToast('error', 'Failed to load report'); }
    setLoading(false);
  };

  const exportExcel = async () => { const r = await window.kadal.reports.exportExcel(reportTab, data); if (r?.success) addToast('success', 'Excel exported'); else addToast('error', 'Export failed'); };
  const exportPdf = async () => { const r = await window.kadal.reports.exportPdf(reportTab, data); if (r?.success) addToast('success', 'PDF exported'); else addToast('error', 'Export failed'); };

  const renderTable = () => {
    if (loading) return <div className="loading"><div className="spinner"></div></div>;
    if (data.length === 0) return <div className="empty-state"><h3>No data</h3></div>;
    switch (reportTab) {
      case 'issueReport': return (<table className="data-table"><thead><tr><th>Issue ID</th><th>Date</th><th>Type</th><th>Recipient</th><th>Item</th><th>Code</th><th style={{textAlign:'right'}}>Issued</th><th style={{textAlign:'right'}}>Returned</th><th style={{textAlign:'right'}}>Damaged</th><th style={{textAlign:'right'}}>Rejected</th><th style={{textAlign:'right'}}>Outstanding</th><th>Status</th></tr></thead>
        <tbody>{data.map((r,i) => <tr key={i}><td className="text-mono" style={{fontSize:12,color:'var(--accent)'}}>{r.issue_id}</td><td style={{fontSize:12}}>{r.issue_date?new Date(r.issue_date).toLocaleDateString('en-GB'):''}</td><td><span className="badge badge-info">{r.issue_type}</span></td><td>{r.recipient_name}</td><td style={{fontWeight:600}}>{r.item_name}</td><td className="text-mono" style={{fontSize:11}}>{r.item_code}</td><td className="text-right text-mono">{r.quantity}</td><td className="text-right text-mono text-success">{r.returned_quantity||0}</td><td className="text-right text-mono text-danger">{r.damage_quantity||0}</td><td className="text-right text-mono text-warning">{r.rejected_quantity||0}</td><td className="text-right text-mono fw-bold">{r.outstanding}</td><td><span className={`badge badge-${r.status==='RETURNED'?'success':r.status==='PARTIAL'?'warning':'danger'}`}>{r.status}</span></td></tr>)}</tbody></table>);
      case 'returnReport': return (<table className="data-table"><thead><tr><th>Issue ID</th><th>Return Date</th><th>Recipient</th><th>Item</th><th>Code</th><th style={{textAlign:'right'}}>Good</th><th style={{textAlign:'right'}}>Damaged</th><th style={{textAlign:'right'}}>Rejected</th><th>By</th></tr></thead>
        <tbody>{data.map((r,i) => <tr key={i}><td className="text-mono" style={{fontSize:12}}>{r.issue_id}</td><td style={{fontSize:12}}>{r.return_date?new Date(r.return_date).toLocaleDateString('en-GB'):''}</td><td>{r.recipient_name}</td><td style={{fontWeight:600}}>{r.item_name}</td><td className="text-mono" style={{fontSize:11}}>{r.item_code}</td><td className="text-right text-mono text-success">{r.returned_quantity}</td><td className="text-right text-mono text-danger">{r.damage_quantity}</td><td className="text-right text-mono text-warning">{r.rejected_quantity}</td><td style={{fontSize:12}}>{r.created_by_name||'-'}</td></tr>)}</tbody></table>);
      case 'employeeOutstanding': return (<table className="data-table"><thead><tr><th>Employee</th><th>Issue ID</th><th>Date</th><th>Item</th><th>Code</th><th style={{textAlign:'right'}}>Issued</th><th style={{textAlign:'right'}}>Outstanding</th><th>Due Date</th></tr></thead>
        <tbody>{data.map((r,i) => <tr key={i}><td style={{fontWeight:600}}>{r.recipient_name}</td><td className="text-mono" style={{fontSize:12}}>{r.issue_id}</td><td style={{fontSize:12}}>{r.issue_date?new Date(r.issue_date).toLocaleDateString('en-GB'):''}</td><td>{r.item_name}</td><td className="text-mono" style={{fontSize:11}}>{r.item_code}</td><td className="text-right text-mono">{r.quantity}</td><td className="text-right text-mono fw-bold text-danger">{r.outstanding}</td><td style={{fontSize:12}}>{r.expected_return_date?new Date(r.expected_return_date).toLocaleDateString('en-GB'):'-'}</td></tr>)}</tbody></table>);
      case 'issueReturnSummary': return (<table className="data-table"><thead><tr><th>Issue ID</th><th>Type</th><th>Recipient</th><th>Date</th><th style={{textAlign:'right'}}>Issued</th><th style={{textAlign:'right'}}>Returned</th><th style={{textAlign:'right'}}>Damaged</th><th style={{textAlign:'right'}}>Rejected</th><th style={{textAlign:'right'}}>Outstanding</th><th>Status</th></tr></thead>
        <tbody>{data.map((r,i) => <tr key={i}><td className="text-mono" style={{fontSize:12,color:'var(--accent)'}}>{r.issue_id}</td><td><span className="badge badge-info">{r.issue_type}</span></td><td>{r.recipient_name}</td><td style={{fontSize:12}}>{r.issue_date?new Date(r.issue_date).toLocaleDateString('en-GB'):''}</td><td className="text-right text-mono">{r.total_issued}</td><td className="text-right text-mono text-success">{r.total_returned}</td><td className="text-right text-mono text-danger">{r.total_damaged}</td><td className="text-right text-mono text-warning">{r.total_rejected||0}</td><td className="text-right text-mono fw-bold">{r.outstanding}</td><td><span className={`badge badge-${r.status==='RETURNED'?'success':r.status==='PARTIAL'?'warning':'danger'}`}>{r.status}</span></td></tr>)}</tbody></table>);
      default: return null;
    }
  };

  return (
    <div>
      <div className="tabs" style={{marginBottom:12}}>{REPORT_TABS.map(t => <button key={t.id} className={`tab ${reportTab===t.id?'active':''}`} onClick={() => setReportTab(t.id)}>{t.label}</button>)}</div>
      <div className="toolbar" style={{flexWrap:'wrap', gap:10}}>
        <div className="toolbar-left" style={{display:'flex',gap:10,flexWrap:'wrap'}}>
          <select className="form-input" style={{width:140}} value={issueType} onChange={e => setIssueType(e.target.value)}><option value="">All Types</option><option value="FACTORY">Factory</option><option value="EMPLOYEE">Employee</option></select>
          <input type="date" className="form-input" value={dateFrom} onChange={e => setDateFrom(e.target.value)} style={{width:130}} />
          <span className="text-muted">to</span>
          <input type="date" className="form-input" value={dateTo} onChange={e => setDateTo(e.target.value)} style={{width:130}} />
        </div>
        <div className="toolbar-right">
          <button className="btn btn-outline btn-sm" onClick={exportExcel} disabled={data.length===0}><FileSpreadsheet size={14}/> Excel</button>
          <button className="btn btn-outline btn-sm" onClick={exportPdf} disabled={data.length===0}><FileText size={14}/> PDF</button>
        </div>
      </div>
      <div className="table-wrapper">{renderTable()}</div>
    </div>
  );
}

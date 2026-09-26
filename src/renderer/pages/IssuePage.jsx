import SearchableSelect from '../components/ui/SearchableSelect';
import React, { useState, useEffect, useCallback } from 'react';
import useStore from '../store/useStore';
import { Send, RotateCcw, BarChart3, Plus, Trash2, FileSpreadsheet, FileText, Search, Package, Eye, Clock, Filter, X } from 'lucide-react';

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
  const [isReturnable, setIsReturnable] = useState(true);
  const [pendingApprovalsCount, setPendingApprovalsCount] = useState(0);
  const canDeleteIssue = ['Super Admin', 'Admin'].includes(user?.role_name) || ['Super Admin', 'Admin'].includes(user?.roleName);

  const loadData = useCallback(async () => {
    try { const r = await window.kadal.recipients.getAll(); if (r?.success) setRecipients(r.data); } catch (e) {}
    try { const r = await window.kadal.items.getAll({}); if (r?.success) setAllItems(r.data); } catch (e) {}
    try { const r = await window.kadal.items.getDistinctValues(); if (r?.success) setDistinctValues(r.data); } catch (e) {}
    try { const r = await window.kadal.issues.getNextId(); if (r?.success) setNextId(r.data); } catch (e) {}
    try { const r = await window.kadal.issues.getAll({}); if (r?.success) setIssues(r.data); } catch (e) {}
    try {
      const a = await window.kadal.approvals.getAll({ status: 'PENDING' });
      if (a?.success && Array.isArray(a.data)) {
        const issueApprovals = a.data.filter(req => req.type === 'CREATE_ISSUE');
        setPendingApprovalsCount(issueApprovals.length);
      }
    } catch (e) {}
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const [selectedDetailIssue, setSelectedDetailIssue] = useState(null);
  const [associatedProduction, setAssociatedProduction] = useState([]);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [producedProducts, setProducedProducts] = useState([]);
  const [searchProductQuery, setSearchProductQuery] = useState('');
  const [isReissuing, setIsReissuing] = useState(false);
  const [reissueItems, setReissueItems] = useState([]);
  const [reissuing, setReissuing] = useState(false);

  useEffect(() => {
    if (!selectedDetailIssue) {
      setAssociatedProduction([]);
      setIsReissuing(false);
      setReissueItems([]);
      return;
    }
    const fetchDetails = async () => {
      setLoadingDetails(true);
      try {
        const issueRes = await window.kadal.issues.getById(selectedDetailIssue.id);
        if (issueRes?.success) {
          setSelectedDetailIssue(issueRes.data);
        }
        const prodRes = await window.kadal.production.getAll({});
        if (prodRes?.success) {
          const matched = prodRes.data.filter(p => p.issue_id === selectedDetailIssue.id);
          setAssociatedProduction(matched);
        }
      } catch (e) {
        console.error(e);
      }
      setLoadingDetails(false);
    };
    fetchDetails();
  }, [selectedDetailIssue?.id]);

  const updateForm = (field, value) => setIssueForm({ ...issueForm, [field]: value });

  const handleRecipientChange = (id) => {
    const rec = recipients.find(r => r.id === Number(id));
    if (rec) {
      setIssueForm({ ...issueForm, recipientId: rec.id, recipientName: rec.name, issueType: rec.type });
      // Reset returnable state based on type
      if (rec.type === 'FACTORY') setIsReturnable(true);
    }
  };

  const updateItem = (idx, field, value) => {
    const updated = [...issueItems];
    updated[idx] = { ...updated[idx], [field]: value };
    setIssueItems(updated);
  };

  const removeItem = (idx) => setIssueItems(issueItems.filter((_, i) => i !== idx));

  const removeProducedProduct = (id) => {
    setProducedProducts(producedProducts.filter(p => p.id !== id));
  };

  const handleSubmit = async () => {
    if (!issueForm.recipientId) return addToast('error', 'Select a recipient');
    if (issueForm.issueType === 'FACTORY' && producedProducts.length === 0) {
      return addToast('error', 'Select at least one target finished product to be produced');
    }
    if (issueItems.length === 0) return addToast('error', 'Add at least one item');
    for (const item of issueItems) {
      if (item.quantity <= 0) return addToast('error', `Invalid quantity for ${item.name}`);
      if (item.quantity > item.currentStock) return addToast('error', `Insufficient stock for ${item.name}`);
    }
    setSubmitting(true);
    try {
      const res = await window.kadal.issues.create({
        issueType: issueForm.issueType, recipientId: issueForm.recipientId, recipientName: issueForm.recipientName,
        issueDate: issueForm.issueDate, expectedReturnDate: !isReturnable ? null : issueForm.expectedReturnDate, remarks: issueForm.remarks,
        isReturnable: isReturnable,
        producedItemId: producedProducts[0]?.id,
        producedItemIds: producedProducts.map(p => p.id),
        items: issueItems.map(i => ({ 
          itemId: i.itemId, 
          name: i.name,
          itemCode: i.itemCode,
          buyerName: i.buyerName,
          currentStock: i.currentStock,
          quantity: Number(i.quantity), 
          unit: i.unit, 
          styleNo: i.styleNo, 
          orderNumber: i.orderNumber, 
          purchaseNo: i.purchaseNo, 
          notes: i.notes 
        })),
      });
      if (res?.success) { 
        if (res.data?.pendingApproval) {
          addToast('success', 'Issue request submitted for Admin approval');
        } else {
          addToast('success', `Issue ${res.data?.issueId || ''} created!`); 
        }
        clearIssue(); 
        setProducedProducts([]);
        setSearchProductQuery('');
        setIsReturnable(true);
        setShowForm(false); 
        loadData(); 
      }
      else addToast('error', res?.error || 'Failed');
    } catch (e) { addToast('error', e.message); }
    setSubmitting(false);
  };

  const handleReissueSubmit = async () => {
    if (reissueItems.length === 0) return addToast('error', 'Add at least one item to reissue');
    for (const item of reissueItems) {
      if (item.quantity <= 0) return addToast('error', `Invalid quantity for ${item.name}`);
      if (item.quantity > (item.currentStock || item.current_stock)) return addToast('error', `Insufficient stock for ${item.name}`);
    }
    setReissuing(true);
    try {
      const res = await window.kadal.issues.addItems({
        issueId: selectedDetailIssue.id,
        items: reissueItems.map(i => ({
          itemId: i.itemId || i.id,
          name: i.name,
          itemCode: i.itemCode || i.item_code,
          currentStock: i.currentStock || i.current_stock,
          quantity: Number(i.quantity),
          unit: i.unit,
          styleNo: i.styleNo || i.style_name,
          orderNumber: i.orderNumber || i.order_number,
          purchaseNo: i.purchaseNo || i.purchase_no,
          notes: i.notes
        }))
      });
      if (res?.success) {
        addToast('success', `Items successfully added to issue ${selectedDetailIssue.issue_id}`);
        setReissueItems([]);
        setIsReissuing(false);
        // Refresh detail view
        const issueRes = await window.kadal.issues.getById(selectedDetailIssue.id);
        if (issueRes?.success) setSelectedDetailIssue(issueRes.data);
        loadData();
      } else {
        addToast('error', res?.error || 'Failed to add items');
      }
    } catch (e) {
      addToast('error', e.message);
    }
    setReissuing(false);
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
          <button className="btn btn-outline" onClick={() => { setShowForm(false); clearIssue(); setProducedProducts([]); setIsReturnable(true); }}>Cancel</button>
        </div>
        <div className="card" style={{ padding: 20, marginBottom: 16 }}>
          <div style={{ display: 'grid', gridTemplateColumns: issueForm.issueType === 'EMPLOYEE' ? '1fr 1fr 1fr 1fr' : '1fr 1fr 1fr', gap: 16 }}>
            <div><label className="form-label">Recipient *</label>
              <select className="form-input" value={issueForm.recipientId} onChange={e => handleRecipientChange(e.target.value)}>
                <option value="">Select Recipient</option>
                {recipients.map(r => <option key={r.id} value={r.id}>{r.name} ({r.type})</option>)}
              </select>
            </div>
            {issueForm.issueType === 'EMPLOYEE' && (
              <div><label className="form-label">Issue Category</label>
                <div style={{ display: 'flex', gap: 16, marginTop: 8 }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 13 }}>
                    <input type="radio" name="isReturnable" checked={isReturnable} onChange={() => setIsReturnable(true)} />
                    Returnable
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 13 }}>
                    <input type="radio" name="isReturnable" checked={!isReturnable} onChange={() => setIsReturnable(false)} />
                    Non-Returnable
                  </label>
                </div>
              </div>
            )}
            <div><label className="form-label">Issue Date</label><input type="date" className="form-input" value={issueForm.issueDate} onChange={e => updateForm('issueDate', e.target.value)} /></div>
            <div>
              <label className="form-label">Expected Return Date</label>
              <input 
                type="date" 
                className="form-input" 
                value={!isReturnable ? '' : issueForm.expectedReturnDate} 
                disabled={!isReturnable} 
                onChange={e => updateForm('expectedReturnDate', e.target.value)} 
                placeholder={!isReturnable ? 'N/A' : ''} 
              />
            </div>
          </div>

          {/* TARGET PRODUCTS SEARCH & SELECT FOR FACTORY ISSUES */}
          {issueForm.issueType === 'FACTORY' && (
            <div style={{ marginTop: 12, borderTop: '1px dashed var(--border)', paddingTop: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <label className="form-label" style={{ fontWeight: 600, margin: 0 }}>Target Finished Product(s) to be Produced * ({producedProducts.length})</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  {producedProducts.length > 0 && (
                    <button 
                      type="button" 
                      className="btn btn-ghost btn-sm" 
                      onClick={() => setProducedProducts([])}
                      style={{ color: 'var(--danger)', fontSize: 11 }}
                    >
                      <Trash2 size={12} /> Clear All
                    </button>
                  )}
                  <button 
                    type="button"
                    className="btn btn-outline btn-sm" 
                    onClick={() => openModal('TARGET_PRODUCT_BROWSER', { 
                      items: allItems, 
                      onSelect: (item) => { 
                        setProducedProducts(prev => {
                          if (prev.some(p => p.id === item.id)) return prev;
                          return [...prev, item];
                        }); 
                      } 
                    })}
                  >
                    <Search size={14} /> Add Target Product
                  </button>
                </div>
              </div>
              {producedProducts.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {producedProducts.map((pProduct, pIdx) => (
                    <div key={pProduct.id || pIdx} style={{ padding: '10px 14px', border: '1px solid var(--accent)', background: 'rgba(var(--accent-rgb), 0.05)', borderRadius: 6 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                        <div>
                          <div style={{ fontWeight: 600, color: 'var(--accent)', fontSize: 13 }}>{pProduct.name}</div>
                          <span className="text-mono text-muted" style={{ fontSize: 11 }}>{pProduct.item_code}</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ fontSize: 11 }} className="badge badge-info">Target #{pIdx + 1}</span>
                          <button type="button" className="btn btn-ghost btn-icon btn-sm" onClick={() => removeProducedProduct(pProduct.id)} title="Remove Product">
                            <Trash2 size={13} color="var(--danger)" />
                          </button>
                        </div>
                      </div>
                      <div style={{ 
                        display: 'grid', 
                        gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', 
                        gap: '6px 12px', 
                        fontSize: 11, 
                        background: 'var(--bg-card)', 
                        padding: '6px 10px', 
                        borderRadius: 4, 
                        border: '1px solid var(--border)' 
                      }}>
                        <div><span className="text-muted">Buyer:</span> <strong>{pProduct.buyer_name || pProduct.buyerName || '-'}</strong></div>
                        <div><span className="text-muted">Color:</span> <strong>{pProduct.color || '-'}</strong></div>
                        <div><span className="text-muted">Order No:</span> <strong>{pProduct.order_number || pProduct.orderNumber || '-'}</strong></div>
                        <div><span className="text-muted">Style:</span> <strong>{pProduct.style_name || pProduct.styleName || '-'}</strong></div>
                        {pProduct.order_quantity != null && <div><span className="text-muted">Order Qty:</span> <strong>{pProduct.order_quantity} {pProduct.unit}</strong></div>}
                        <div><span className="text-muted">Stock:</span> <strong>{pProduct.current_stock ?? pProduct.currentStock ?? 0} {pProduct.unit}</strong></div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-muted" style={{ textAlign: 'center', padding: 16, margin: 0 }}>
                  <Package size={18} style={{marginBottom: 4}} /><br/>
                  Click "Add Target Product" to search and select one or multiple finished products to produce
                </p>
              )}
            </div>
          )}

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
                  <td><div style={{fontWeight:600}}>{item.name}</div><div style={{fontSize:11,color:'var(--text-muted)'}}>{item.itemCode}{item.orderQuantity != null && item.orderQuantity > 0 ? ` | Order Qty: ${item.orderQuantity}` : ''}{item.size ? ` | Size: ${item.size}` : ''}{item.color ? ` | Color: ${item.color}` : ''}</div></td>
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
      {pendingApprovalsCount > 0 && (
        <div style={{
          marginBottom: 16,
          padding: '10px 14px',
          background: 'rgba(var(--warning-rgb, 245, 158, 11), 0.1)',
          border: '1px solid var(--warning)',
          borderRadius: 6,
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          fontSize: 13,
          color: 'var(--warning)'
        }}>
          <Clock size={16} />
          <span>There {pendingApprovalsCount === 1 ? 'is 1 issue request' : `are ${pendingApprovalsCount} issue requests`} awaiting Admin approval in the <strong>Approvals</strong> module.</span>
        </div>
      )}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <h3 style={{ margin: 0 }}>Recent Issues</h3>
        <button className="btn btn-primary" onClick={() => setShowForm(true)}><Plus size={14} /> New Issue</button>
      </div>
      {issues.length === 0 ? <div className="empty-state"><h3>No issues yet</h3><p>Create your first issue</p></div> : (
        <div className="table-wrapper"><table className="data-table"><thead><tr><th>Issue ID</th><th>Date</th><th>Type</th><th>Recipient</th><th style={{textAlign:'center'}}>Items</th><th>Status</th><th style={{textAlign:'right'}}>Actions</th></tr></thead>
          <tbody>{issues.map(iss => (
            <tr key={iss.id}>
              <td 
                className="text-mono" 
                style={{color:'var(--accent)',fontSize:12,cursor:'pointer',textDecoration:'underline'}}
                onClick={() => setSelectedDetailIssue(iss)}
                title="View Full Details"
              >
                {iss.issue_id}
              </td>
              <td style={{fontSize:12}}>{new Date(iss.issue_date).toLocaleDateString('en-GB')}</td>
              <td>
                <span className={`badge badge-${iss.issue_type==='FACTORY'?'info':'warning'}`}>{iss.issue_type}</span>
                {iss.issue_type === 'EMPLOYEE' && (
                  <span style={{ fontSize: 10, marginLeft: 4, color: 'var(--text-muted)' }}>
                    ({iss.is_returnable ? 'Returnable' : 'Non-Returnable'})
                  </span>
                )}
              </td>
              <td>{iss.recipient_name}</td>
              <td className="text-center">{iss.item_count}</td>
              <td><span className={`badge badge-${iss.status==='RETURNED'?'success':iss.status==='PARTIAL'?'warning':'danger'}`}>{iss.status}</span></td>
              <td style={{textAlign:'right'}}>
                <div style={{display:'flex', gap:4, justifyContent:'flex-end'}}>
                  <button className="btn btn-ghost btn-icon btn-sm" onClick={() => setSelectedDetailIssue(iss)} title="View Details"><Eye size={14} /></button>
                  <button className="btn btn-ghost btn-icon btn-sm" onClick={() => window.kadal.issues.exportPdf(iss.id)} title="Download PDF"><FileText size={14} /></button>
                  <button className="btn btn-ghost btn-icon btn-sm" onClick={() => window.kadal.issues.exportExcel(iss.id)} title="Download Excel"><FileSpreadsheet size={14} /></button>
                  {canDeleteIssue && <button className="btn btn-ghost btn-icon btn-sm" onClick={() => handleDelete(iss)} title="Delete"><Trash2 size={14} color="var(--danger)" /></button>}
                </div>
              </td>
            </tr>
          ))}</tbody>
        </table></div>
      )}

      {/* ISSUE DETAILS MODAL */}
      {selectedDetailIssue && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center',
          justifyContent: 'center', zIndex: 1000, padding: 20
        }}>
          <div className="card" style={{
            width: '80%', maxWidth: 1000, maxHeight: '90vh', overflowY: 'auto',
            padding: 24, background: 'var(--bg-card)', border: '1px solid var(--border)',
            position: 'relative', boxShadow: '0 8px 32px rgba(0,0,0,0.4)'
          }}>
            <div style={{ position: 'absolute', top: 20, right: 20, display: 'flex', gap: 8 }}>
              {!isReissuing && selectedDetailIssue.issue_type === 'FACTORY' && (
                <button 
                  className="btn btn-outline btn-sm" 
                  onClick={() => setIsReissuing(true)}
                  title="Add more items to this issue"
                >
                  <Plus size={14} style={{ marginRight: 4 }} /> Reissue Items
                </button>
              )}
              <button 
                className="btn btn-primary btn-sm" 
                onClick={() => window.kadal.issues.exportPdf(selectedDetailIssue.id)}
                title="Print PDF Issue Paper"
              >
                <FileText size={14} style={{ marginRight: 4 }} /> Print PDF
              </button>
              <button 
                className="btn btn-outline btn-sm" 
                onClick={() => setSelectedDetailIssue(null)}
              >
                Close
              </button>
            </div>

            <h3 style={{ marginTop: 0, marginBottom: 4, display: 'flex', alignItems: 'center', gap: 10 }}>
              <Eye size={20} color="var(--accent)" /> Issue Details — <span style={{ color: 'var(--accent)' }}>{selectedDetailIssue.issue_id}</span>
            </h3>
            <p className="text-muted" style={{ margin: '0 0 20px 0' }}>
              Full audit, item specifications, and finished goods reconciliation
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16, background: 'var(--bg-muted)', padding: 16, borderRadius: 8, marginBottom: 20 }}>
              <div><strong>Recipient:</strong> {selectedDetailIssue.recipient_name} ({selectedDetailIssue.issue_type})</div>
              <div><strong>Issue Date:</strong> {new Date(selectedDetailIssue.issue_date).toLocaleDateString('en-GB')}</div>
              <div><strong>Status:</strong> <span className={`badge badge-${selectedDetailIssue.status==='RETURNED'?'success':selectedDetailIssue.status==='PARTIAL'?'warning':'danger'}`}>{selectedDetailIssue.status}</span></div>
              <div><strong>Category:</strong> {selectedDetailIssue.issue_type === 'EMPLOYEE' ? (selectedDetailIssue.is_returnable ? 'Returnable' : 'Non-Returnable') : 'N/A'}</div>
              <div><strong>Expected Return:</strong> {selectedDetailIssue.expected_return_date ? new Date(selectedDetailIssue.expected_return_date).toLocaleDateString('en-GB') : 'N/A'}</div>
              <div><strong>Remarks:</strong> {selectedDetailIssue.remarks || 'None'}</div>
              {(selectedDetailIssue.produced_items?.length > 0 || selectedDetailIssue.produced_item || selectedDetailIssue.produced_item_id) && (
                <div style={{ gridColumn: 'span 3', borderTop: '1px solid var(--border)', paddingTop: 12, marginTop: 6 }}>
                  <strong style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8, fontSize: 13 }}>
                    <Package size={15} color="var(--accent)" /> Target Finished Product(s) to Produce:
                  </strong>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {(selectedDetailIssue.produced_items && selectedDetailIssue.produced_items.length > 0
                      ? selectedDetailIssue.produced_items
                      : [selectedDetailIssue.produced_item || allItems.find(it => it.id === selectedDetailIssue.produced_item_id)]
                    ).filter(Boolean).map((pItem, pIdx) => (
                      <div key={pItem.id || pIdx} style={{ padding: '10px 14px', background: 'var(--bg-card)', borderRadius: 6, border: '1px solid var(--border)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                          <div>
                            <strong style={{ fontSize: 13 }}>{pItem.name}</strong>
                            <span className="text-mono text-muted" style={{ fontSize: 11, marginLeft: 6 }}>({pItem.item_code})</span>
                          </div>
                          {pItem.order_quantity != null && (
                            <span className="badge badge-info" style={{ fontSize: 11 }}>
                              Order Qty: {pItem.order_quantity} {pItem.unit || ''}
                            </span>
                          )}
                        </div>
                        <div style={{ 
                          display: 'grid', 
                          gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', 
                          gap: '6px 12px', 
                          fontSize: 11, 
                          background: 'var(--bg-muted)', 
                          padding: '8px 12px', 
                          borderRadius: 4,
                          border: '1px solid var(--border)' 
                        }}>
                          <div><span className="text-muted">Buyer:</span> <strong style={{ color: 'var(--text)' }}>{pItem.buyer_name || pItem.buyerName || '-'}</strong></div>
                          <div><span className="text-muted">Color:</span> <strong style={{ color: 'var(--text)' }}>{pItem.color || '-'}</strong></div>
                          <div><span className="text-muted">Order No:</span> <strong style={{ color: 'var(--text)' }}>{pItem.order_number || pItem.orderNumber || '-'}</strong></div>
                          <div><span className="text-muted">Style:</span> <strong style={{ color: 'var(--text)' }}>{pItem.style_name || pItem.styleName || '-'}</strong></div>
                          {pItem.purchase_no && <div><span className="text-muted">Purchase No:</span> <strong style={{ color: 'var(--text)' }}>{pItem.purchase_no}</strong></div>}
                          {pItem.size && pItem.size !== 'N/A' && <div><span className="text-muted">Size:</span> <strong style={{ color: 'var(--text)' }}>{pItem.size}</strong></div>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              </div>

            {isReissuing && (
              <div className="card" style={{ padding: 16, marginBottom: 20, border: '1px solid var(--accent)', background: 'rgba(var(--accent-rgb, 59, 130, 246), 0.03)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                  <h4 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Plus size={16} color="var(--accent)" /> Add Items to Issue
                  </h4>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button className="btn btn-outline btn-sm" onClick={() => openModal('ISSUE_BROWSER', { 
                      items: allItems, 
                      distinctValues,
                      onSelect: (item) => setReissueItems(prev => {
                        if (prev.some(p => (p.itemId || p.id) === item.id)) return prev;
                        return [...prev, { ...item, quantity: 1, notes: '' }];
                      }) 
                    })}>
                      <Search size={14} style={{ marginRight: 4 }} /> Browse Inventory
                    </button>
                    <button className="btn btn-ghost btn-sm" onClick={() => { setIsReissuing(false); setReissueItems([]); }}>Cancel</button>
                  </div>
                </div>

                {reissueItems.length === 0 ? (
                  <p className="text-muted" style={{ textAlign: 'center', padding: 16, margin: 0 }}>
                    Click "Browse Inventory" to search and add new items to this issue.
                  </p>
                ) : (
                  <div className="table-wrapper">
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>Item</th>
                          <th>Style / Order</th>
                          <th style={{textAlign:'right'}}>Stock</th>
                          <th style={{textAlign:'right',width:100}}>Qty *</th>
                          <th>Notes</th>
                          <th style={{width: 40}}></th>
                        </tr>
                      </thead>
                      <tbody>
                        {reissueItems.map((item, idx) => (
                          <tr key={idx}>
                            <td>
                              <div style={{fontWeight:600}}>{item.name}</div>
                              <div style={{fontSize:11,color:'var(--text-muted)'}}>{item.itemCode || item.item_code}</div>
                            </td>
                            <td style={{fontSize:12}}>{item.styleNo || item.style_name || '-'} / {item.orderNumber || item.order_number || '-'}</td>
                            <td className="text-right text-mono fw-bold" style={{color: (item.currentStock || item.current_stock) <= 5 ? 'var(--danger)' : 'var(--success)'}}>
                              {item.currentStock || item.current_stock}
                            </td>
                            <td>
                              <input 
                                type="number" 
                                className="form-input" 
                                style={{width:90,textAlign:'right'}} 
                                value={item.quantity} 
                                min={1} 
                                max={item.currentStock || item.current_stock} 
                                onChange={e => {
                                  const u = [...reissueItems];
                                  u[idx].quantity = e.target.value;
                                  setReissueItems(u);
                                }} 
                              />
                            </td>
                            <td>
                              <input 
                                className="form-input" 
                                style={{width: '100%'}} 
                                value={item.notes} 
                                onChange={e => {
                                  const u = [...reissueItems];
                                  u[idx].notes = e.target.value;
                                  setReissueItems(u);
                                }} 
                                placeholder="Optional" 
                              />
                            </td>
                            <td>
                              <button className="btn btn-ghost btn-icon btn-sm" onClick={() => setReissueItems(reissueItems.filter((_, i) => i !== idx))}>
                                <Trash2 size={14} color="var(--danger)" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 12 }}>
                      <button className="btn btn-primary" onClick={handleReissueSubmit} disabled={reissuing}>
                        {reissuing ? 'Adding...' : 'Submit Items'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {loadingDetails ? (
              <div style={{ textAlign: 'center', padding: 40 }}>
                <div className="spinner" style={{margin:'0 auto'}}></div>
                <p style={{marginTop:8}}>Loading issue items and production logs...</p>
              </div>
            ) : (
              <>
                <h4 style={{ margin: '0 0 10px 0' }}>Issued Items & Specifications</h4>
                <div className="table-wrapper" style={{ marginBottom: 24 }}>
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Item Details (Specs)</th>
                        <th>Buyer</th>
                        <th>Style / Order / Purchase</th>
                        <th style={{ textAlign: 'right' }}>Issued Qty</th>
                        <th style={{ textAlign: 'right' }}>Returned</th>
                        <th style={{ textAlign: 'right' }}>Consumed (Prod)</th>
                        <th style={{ textAlign: 'right' }}>Outstanding</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(selectedDetailIssue.items || []).map((item, idx) => {
                        const issued = Number(item.quantity || 0);
                        const returned = Number(item.returned_quantity || 0) + Number(item.damage_quantity || 0) + Number(item.rejected_quantity || 0);
                        const consumed = Number(item.consumed_quantity || 0);
                        const outstanding = Math.max(0, issued - returned - consumed);
                        return (
                          <tr key={item.id || idx}>
                            <td>
                              <div style={{ fontWeight: 600 }}>{item.item_name}</div>
                              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                                Code: {item.item_code} {item.size ? `| Size: ${item.size}` : ''} {item.color ? `| Color: ${item.color}` : ''}
                              </div>
                            </td>
                            <td>{item.buyer_name || item.buyerName || '-'}</td>
                            <td style={{ fontSize: 12 }}>
                              {item.style_no || item.styleNo || '-'} / {item.order_number || item.orderNumber || '-'} / {item.purchase_no || item.purchaseNo || '-'}
                            </td>
                            <td className="text-right text-mono">{item.quantity} {item.unit || item.item_unit}</td>
                            <td className="text-right text-mono text-success">
                              {returned} {item.unit || item.item_unit}
                              {(item.damage_quantity > 0 || item.rejected_quantity > 0) && (
                                <div style={{ fontSize: 10, color: 'var(--danger)' }}>
                                  ({item.returned_quantity||0} G | {item.damage_quantity||0} D | {item.rejected_quantity||0} R)
                                </div>
                              )}
                            </td>
                            <td className="text-right text-mono text-warning">{consumed} {item.unit || item.item_unit}</td>
                            <td className="text-right text-mono fw-bold" style={{ color: 'var(--accent)' }}>
                              {outstanding} {item.unit || item.item_unit}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {selectedDetailIssue.issue_type === 'FACTORY' && (
                  <>
                    <h4 style={{ margin: '0 0 10px 0', display: 'flex', alignItems: 'center', gap: 6 }}>
                      <Package size={16} color="var(--accent)" /> Finished Goods Produced from this Issue
                    </h4>
                    {associatedProduction.length === 0 ? (
                      <div style={{ padding: 20, textAlign: 'center', background: 'var(--bg-muted)', borderRadius: 8, color: 'var(--text-muted)', fontSize: 13 }}>
                        No finished products have been logged/produced from this issue yet.
                      </div>
                    ) : (
                      <div className="table-wrapper">
                        <table className="data-table">
                          <thead>
                            <tr>
                              <th>Production Date</th>
                              <th>Batch ID</th>
                              <th>Produced Product</th>
                              <th>Style / Purchase / Order</th>
                              <th>Size / Color</th>
                              <th>Buyer</th>
                              <th style={{ textAlign: 'right' }}>Produced Qty</th>
                              <th style={{ textAlign: 'right' }}>Wastage Qty</th>
                              <th>Remarks</th>
                            </tr>
                          </thead>
                          <tbody>
                            {associatedProduction.map(prod => (
                              <tr key={prod.id}>
                                <td style={{ fontSize: 13 }}>{new Date(prod.created_at).toLocaleDateString('en-GB')}</td>
                                <td className="text-mono fw-bold" style={{ color: 'var(--accent)' }}>PRD-{prod.id}</td>
                                <td>
                                  <div style={{ fontWeight: 600 }}>{prod.product_name}</div>
                                  {prod.product_code && <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{prod.product_code}</div>}
                                </td>
                                <td>
                                  <div style={{ fontSize: 12 }}>{prod.style_name || '-'}</div>
                                  <div className="text-muted" style={{ fontSize: 10 }}>{prod.purchase_no || '-'} / {prod.order_number || '-'}</div>
                                </td>
                                <td>{[prod.size, prod.color].filter(Boolean).join(' / ') || '-'}</td>
                                <td>{prod.buyer_name || '-'}</td>
                                <td className="text-right text-mono text-success">+{prod.production_quantity}</td>
                                <td className="text-right text-mono text-danger">{prod.wastage_quantity || 0}</td>
                                <td style={{ fontSize: 12 }}>{prod.remarks || '-'}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </>
                )}
              </>
            )}
          </div>
        </div>
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
  const [status, setStatus] = useState('');
  const [recipientName, setRecipientName] = useState('');
  const [buyerName, setBuyerName] = useState('');
  const [styleName, setStyleName] = useState('');
  const [orderNumber, setOrderNumber] = useState('');
  const [purchaseNo, setPurchaseNo] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [recipientsList, setRecipientsList] = useState([]);
  const [distinctValues, setDistinctValues] = useState({ styles: [], orders: [], purchases: [], buyers: [] });

  useEffect(() => {
    const fetchOptions = async () => {
      try {
        const [recRes, dvRes] = await Promise.all([
          window.kadal.recipients.getAll(),
          window.kadal.items.getDistinctValues()
        ]);
        if (recRes?.success) setRecipientsList(recRes.data || []);
        else if (Array.isArray(recRes)) setRecipientsList(recRes);
        if (dvRes?.success) setDistinctValues(dvRes.data || { styles: [], orders: [], purchases: [], buyers: [] });
      } catch (e) {}
    };
    fetchOptions();
  }, []);

  // Collect filter options combining distinctValues and current dataset
  const buyerOptions = React.useMemo(() => {
    const set = new Set(distinctValues?.buyers || []);
    data.forEach(r => {
      if (r.buyer_name) set.add(r.buyer_name);
      if (r.target_products) r.target_products.forEach(tp => { if (tp.buyer_name) set.add(tp.buyer_name); });
    });
    return Array.from(set).filter(Boolean).sort();
  }, [distinctValues?.buyers, data]);

  const styleOptions = React.useMemo(() => {
    const set = new Set(distinctValues?.styles || []);
    data.forEach(r => {
      if (r.style_name && r.style_name !== '-') set.add(r.style_name);
      if (r.target_products) r.target_products.forEach(tp => { if (tp.style_name && tp.style_name !== '-') set.add(tp.style_name); });
    });
    return Array.from(set).filter(Boolean).sort();
  }, [distinctValues?.styles, data]);

  const orderOptions = React.useMemo(() => {
    const set = new Set(distinctValues?.orders || []);
    data.forEach(r => {
      if (r.order_number && r.order_number !== '-') set.add(r.order_number);
      if (r.target_products) r.target_products.forEach(tp => { if (tp.order_number && tp.order_number !== '-') set.add(tp.order_number); });
    });
    return Array.from(set).filter(Boolean).sort();
  }, [distinctValues?.orders, data]);

  const purchaseOptions = React.useMemo(() => {
    const set = new Set(distinctValues?.purchases || []);
    data.forEach(r => {
      if (r.purchase_no && r.purchase_no !== '-') set.add(r.purchase_no);
      if (r.target_products) r.target_products.forEach(tp => { if (tp.purchase_no && tp.purchase_no !== '-') set.add(tp.purchase_no); });
    });
    return Array.from(set).filter(Boolean).sort();
  }, [distinctValues?.purchases, data]);

  const recipientOptions = React.useMemo(() => {
    const set = new Set((recipientsList || []).map(r => r.name || r).filter(Boolean));
    data.forEach(r => { if (r.recipient_name) set.add(r.recipient_name); });
    return Array.from(set).sort();
  }, [recipientsList, data]);

  const loadReport = async () => {
    setLoading(true);
    try {
      const filters = {
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
        issueType: issueType || undefined,
        status: status || undefined,
        recipientName: recipientName || undefined,
        buyerName: buyerName || undefined,
        styleName: styleName || undefined,
        orderNumber: orderNumber || undefined,
        purchaseNo: purchaseNo || undefined,
      };
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

  useEffect(() => { 
    loadReport(); 
  }, [reportTab, dateFrom, dateTo, issueType, status, recipientName, buyerName, styleName, orderNumber, purchaseNo]);

  const filteredData = React.useMemo(() => {
    return data.filter(r => {
      // 1. Search Query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesSearch = 
          r.issue_id?.toLowerCase().includes(q) ||
          r.recipient_name?.toLowerCase().includes(q) ||
          r.item_name?.toLowerCase().includes(q) ||
          r.item_code?.toLowerCase().includes(q) ||
          r.created_by_name?.toLowerCase().includes(q) ||
          r.notes?.toLowerCase().includes(q) ||
          r.target_products_summary?.toLowerCase().includes(q) ||
          (r.target_products && r.target_products.some(tp => 
            tp.name?.toLowerCase().includes(q) || 
            tp.item_code?.toLowerCase().includes(q) || 
            tp.style_name?.toLowerCase().includes(q) ||
            tp.order_number?.toLowerCase().includes(q) ||
            tp.buyer_name?.toLowerCase().includes(q) ||
            tp.color?.toLowerCase().includes(q) ||
            tp.purchase_no?.toLowerCase().includes(q)
          )) ||
          r.style_name?.toLowerCase().includes(q) ||
          r.order_number?.toLowerCase().includes(q) ||
          r.purchase_no?.toLowerCase().includes(q) ||
          r.buyer_name?.toLowerCase().includes(q) ||
          r.color?.toLowerCase().includes(q) ||
          r.size?.toLowerCase().includes(q) ||
          r.status?.toLowerCase().includes(q);
        if (!matchesSearch) return false;
      }

      // 2. Issue Type
      if (issueType && r.issue_type !== issueType) return false;

      // 3. Status
      if (status && r.status !== status) return false;

      // 4. Recipient Name
      if (recipientName && !r.recipient_name?.toLowerCase().includes(recipientName.toLowerCase())) return false;

      // 5. Buyer Name
      if (buyerName) {
        const b = buyerName.toLowerCase();
        const matchesBuyer = r.buyer_name?.toLowerCase() === b ||
          (r.target_products && r.target_products.some(tp => tp.buyer_name?.toLowerCase() === b));
        if (!matchesBuyer) return false;
      }

      // 6. Style Name
      if (styleName) {
        const s = styleName.toLowerCase();
        const matchesStyle = r.style_name?.toLowerCase() === s ||
          (r.target_products && r.target_products.some(tp => tp.style_name?.toLowerCase() === s));
        if (!matchesStyle) return false;
      }

      // 7. Order Number
      if (orderNumber) {
        const o = orderNumber.toLowerCase();
        const matchesOrder = r.order_number?.toLowerCase() === o ||
          (r.target_products && r.target_products.some(tp => tp.order_number?.toLowerCase() === o));
        if (!matchesOrder) return false;
      }

      // 8. Purchase No
      if (purchaseNo) {
        const p = purchaseNo.toLowerCase();
        const matchesPurchase = r.purchase_no?.toLowerCase() === p ||
          (r.target_products && r.target_products.some(tp => tp.purchase_no?.toLowerCase() === p));
        if (!matchesPurchase) return false;
      }

      return true;
    });
  }, [data, searchQuery, issueType, status, recipientName, buyerName, styleName, orderNumber, purchaseNo]);

  const hasActiveFilters = Boolean(
    searchQuery || issueType || status || recipientName || buyerName || styleName || orderNumber || purchaseNo || dateFrom || dateTo
  );

  const resetFilters = () => {
    setSearchQuery('');
    setIssueType('');
    setStatus('');
    setRecipientName('');
    setBuyerName('');
    setStyleName('');
    setOrderNumber('');
    setPurchaseNo('');
    setDateFrom('');
    setDateTo('');
  };

  const exportExcel = async () => { const r = await window.kadal.reports.exportExcel(reportTab, filteredData); if (r?.success) addToast('success', 'Excel exported'); else addToast('error', 'Export failed'); };
  const exportPdf = async () => { const r = await window.kadal.reports.exportPdf(reportTab, filteredData); if (r?.success) addToast('success', 'PDF exported'); else addToast('error', 'Export failed'); };

  const renderTable = () => {
    if (loading) return <div className="loading"><div className="spinner"></div></div>;
    if (filteredData.length === 0) return <div className="empty-state"><h3>No data</h3></div>;
    switch (reportTab) {
      case 'issueReport': return (
        <table className="data-table">
          <thead>
            <tr>
              <th>Issue ID</th>
              <th>Date</th>
              <th>Type</th>
              <th>Recipient</th>
              <th>Issued Material / Code</th>
              <th>Target Finished Item(s)</th>
              <th>Style / Purchase / Order</th>
              <th>Size / Color</th>
              <th>Buyer</th>
              <th style={{textAlign:'right'}}>Issued</th>
              <th style={{textAlign:'right'}}>Returned</th>
              <th style={{textAlign:'right'}}>Damaged</th>
              <th style={{textAlign:'right'}}>Rejected</th>
              <th style={{textAlign:'right'}}>Outstanding</th>
              <th>Unit</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {filteredData.map((r, i) => (
              <tr key={i}>
                <td className="text-mono" style={{fontSize:12,color:'var(--accent)'}}>{r.issue_id}</td>
                <td style={{fontSize:12}}>{r.issue_date?new Date(r.issue_date).toLocaleDateString('en-GB'):''}</td>
                <td><span className="badge badge-info">{r.issue_type}</span></td>
                <td>{r.recipient_name}</td>
                <td>
                  <div style={{fontWeight:600}}>{r.item_name}</div>
                  <div className="text-mono text-muted" style={{fontSize:10}}>{r.item_code}</div>
                </td>
                <td>
                  {r.target_products && r.target_products.length > 0 ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {r.target_products.map((tp, idx) => (
                        <div key={idx} style={{ fontSize: 12, lineHeight: 1.35, padding: '4px 0', borderBottom: idx < r.target_products.length - 1 ? '1px dashed var(--border)' : 'none' }}>
                          <div>
                            <span style={{ fontWeight: 600, color: 'var(--text)' }}>{tp.name}</span>
                            {tp.item_code && <span className="text-mono text-muted" style={{ fontSize: 10, marginLeft: 4 }}>({tp.item_code})</span>}
                          </div>
                          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2, display: 'flex', flexWrap: 'wrap', gap: '4px 8px' }}>
                            {tp.buyer_name && <span><strong>Buyer:</strong> {tp.buyer_name}</span>}
                            {tp.color && tp.color !== 'N/A' && <span><strong>Color:</strong> {tp.color}</span>}
                            {tp.order_number && <span><strong>Order:</strong> {tp.order_number}</span>}
                            {tp.style_name && <span><strong>Style:</strong> {tp.style_name}</span>}
                            {tp.size && tp.size !== 'N/A' && <span><strong>Size:</strong> {tp.size}</span>}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <span className="text-muted" style={{ fontSize: 12 }}>{r.target_products_summary || '-'}</span>
                  )}
                </td>
                <td>
                  <div style={{fontSize:12}}>{r.style_name || '-'}</div>
                  <div className="text-muted" style={{fontSize:10}}>{r.purchase_no || '-'} / {r.order_number || '-'}</div>
                </td>
                <td>{[r.size, r.color].filter(Boolean).join(' / ') || '-'}</td>
                <td>{r.buyer_name || '-'}</td>
                <td className="text-right text-mono">{r.quantity}</td>
                <td className="text-right text-mono text-success">{r.returned_quantity||0}</td>
                <td className="text-right text-mono text-danger">{r.damage_quantity||0}</td>
                <td className="text-right text-mono text-warning">{r.rejected_quantity||0}</td>
                <td className="text-right text-mono fw-bold">{r.outstanding}</td>
                <td>{r.unit || '-'}</td>
                <td><span className={`badge badge-${r.status==='RETURNED'?'success':r.status==='PARTIAL'?'warning':'danger'}`}>{r.status}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      );
      case 'returnReport': return (
        <table className="data-table">
          <thead>
            <tr>
              <th>Issue ID</th>
              <th>Return Date</th>
              <th>Recipient</th>
              <th>Item</th>
              <th>Code</th>
              <th style={{textAlign:'right'}}>Good</th>
              <th style={{textAlign:'right'}}>Damaged</th>
              <th style={{textAlign:'right'}}>Rejected</th>
              <th>By</th>
            </tr>
          </thead>
          <tbody>
            {filteredData.map((r,i) => (
              <tr key={i}>
                <td className="text-mono" style={{fontSize:12}}>{r.issue_id}</td>
                <td style={{fontSize:12}}>{r.return_date?new Date(r.return_date).toLocaleDateString('en-GB'):''}</td>
                <td>{r.recipient_name}</td>
                <td style={{fontWeight:600}}>{r.item_name}</td>
                <td className="text-mono" style={{fontSize:11}}>{r.item_code}</td>
                <td className="text-right text-mono text-success">{r.returned_quantity}</td>
                <td className="text-right text-mono text-danger">{r.damage_quantity}</td>
                <td className="text-right text-mono text-warning">{r.rejected_quantity}</td>
                <td style={{fontSize:12}}>{r.created_by_name||'-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      );
      case 'employeeOutstanding': return (
        <table className="data-table">
          <thead>
            <tr>
              <th>Employee</th>
              <th>Issue ID</th>
              <th>Date</th>
              <th>Item</th>
              <th>Code</th>
              <th style={{textAlign:'right'}}>Issued</th>
              <th style={{textAlign:'right'}}>Outstanding</th>
              <th>Due Date</th>
            </tr>
          </thead>
          <tbody>
            {filteredData.map((r,i) => (
              <tr key={i}>
                <td style={{fontWeight:600}}>{r.recipient_name}</td>
                <td className="text-mono" style={{fontSize:12}}>{r.issue_id}</td>
                <td style={{fontSize:12}}>{r.issue_date?new Date(r.issue_date).toLocaleDateString('en-GB'):''}</td>
                <td>{r.item_name}</td>
                <td className="text-mono" style={{fontSize:11}}>{r.item_code}</td>
                <td className="text-right text-mono">{r.quantity}</td>
                <td className="text-right text-mono fw-bold text-danger">{r.outstanding}</td>
                <td style={{fontSize:12}}>{r.expected_return_date?new Date(r.expected_return_date).toLocaleDateString('en-GB'):'-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      );
      case 'issueReturnSummary': return (
        <table className="data-table">
          <thead>
            <tr>
              <th>Issue ID</th>
              <th>Type</th>
              <th>Recipient</th>
              <th>Date</th>
              <th style={{textAlign:'right'}}>Issued</th>
              <th style={{textAlign:'right'}}>Returned</th>
              <th style={{textAlign:'right'}}>Damaged</th>
              <th style={{textAlign:'right'}}>Rejected</th>
              <th style={{textAlign:'right'}}>Outstanding</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {filteredData.map((r,i) => (
              <tr key={i}>
                <td className="text-mono" style={{fontSize:12,color:'var(--accent)'}}>{r.issue_id}</td>
                <td><span className="badge badge-info">{r.issue_type}</span></td>
                <td>{r.recipient_name}</td>
                <td style={{fontSize:12}}>{r.issue_date?new Date(r.issue_date).toLocaleDateString('en-GB'):''}</td>
                <td className="text-right text-mono">{r.total_issued}</td>
                <td className="text-right text-mono text-success">{r.total_returned}</td>
                <td className="text-right text-mono text-danger">{r.total_damaged}</td>
                <td className="text-right text-mono text-warning">{r.total_rejected||0}</td>
                <td className="text-right text-mono fw-bold">{r.outstanding}</td>
                <td><span className={`badge badge-${r.status==='RETURNED'?'success':r.status==='PARTIAL'?'warning':'danger'}`}>{r.status}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      );
      default: return null;
    }
  };

  return (
    <div>
      <div className="tabs" style={{ marginBottom: 12 }}>
        {REPORT_TABS.map(t => (
          <button key={t.id} className={`tab ${reportTab === t.id ? 'active' : ''}`} onClick={() => setReportTab(t.id)}>
            {t.label}
          </button>
        ))}
      </div>

      <div className="card mb-3" style={{ padding: '12px 16px', background: 'var(--card-bg)', borderRadius: 8, border: '1px solid var(--border)' }}>
        {/* Top Filter Row: Search, Type, Status, Recipient, Date Range, Export */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
            {/* Search Input */}
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
              <Search size={14} style={{ position: 'absolute', left: 10, color: 'var(--text-muted)' }} />
              <input 
                type="text" 
                className="form-input" 
                placeholder="Search material, target item, recipient..." 
                value={searchQuery} 
                onChange={e => setSearchQuery(e.target.value)} 
                style={{ paddingLeft: 30, width: 250, fontSize: 13 }} 
              />
              {searchQuery && (
                <button 
                  onClick={() => setSearchQuery('')}
                  style={{ position: 'absolute', right: 8, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex' }}
                  title="Clear search"
                >
                  <X size={13} />
                </button>
              )}
            </div>

            {/* Issue Type */}
            <SearchableSelect className="form-input" style={{ width: 130, fontSize: 13 }} value={issueType} onValueChange={value => setIssueType(value)}>
              <option value="">All Types</option>
              <option value="FACTORY">Factory</option>
              <option value="EMPLOYEE">Employee</option>
            </SearchableSelect>

            {/* Status (for issueReport & summary) */}
            {(reportTab === 'issueReport' || reportTab === 'issueReturnSummary') && (
              <SearchableSelect className="form-input" style={{ width: 130, fontSize: 13 }} value={status} onValueChange={value => setStatus(value)}>
                <option value="">All Statuses</option>
                <option value="PENDING">Pending</option>
                <option value="PARTIAL">Partial</option>
                <option value="RETURNED">Returned</option>
              </SearchableSelect>
            )}

            {/* Recipient */}
            <SearchableSelect className="form-input" style={{ width: 150, fontSize: 13 }} value={recipientName} onValueChange={value => setRecipientName(value)}>
              <option value="">All Recipients</option>
              {recipientOptions.map((name, i) => <option key={i} value={name}>{name}</option>)}
            </SearchableSelect>

            {/* Date Range */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <input type="date" className="form-input" value={dateFrom} onChange={e => setDateFrom(e.target.value)} style={{ width: 130, fontSize: 13 }} title="From Date" />
              <span className="text-muted" style={{ fontSize: 12 }}>to</span>
              <input type="date" className="form-input" value={dateTo} onChange={e => setDateTo(e.target.value)} style={{ width: 130, fontSize: 13 }} title="To Date" />
            </div>
          </div>

          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button className="btn btn-outline btn-sm" onClick={exportExcel} disabled={filteredData.length === 0}><FileSpreadsheet size={14} /> Excel</button>
            <button className="btn btn-outline btn-sm" onClick={exportPdf} disabled={filteredData.length === 0}><FileText size={14} /> PDF</button>
          </div>
        </div>

        {/* Product / Finished Item Details Row */}
        {reportTab === 'issueReport' && (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10, marginTop: 10, paddingTop: 10, borderTop: '1px dashed var(--border)' }}>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 4 }}>
                <Filter size={13} /> Product Filters:
              </span>

              {/* Buyer */}
              <SearchableSelect className="form-input" style={{ width: 150, fontSize: 13 }} value={buyerName} onValueChange={value => setBuyerName(value)}>
                <option value="">All Buyers</option>
                {buyerOptions.map((v, i) => <option key={i} value={v}>{v}</option>)}
              </SearchableSelect>

              {/* Style */}
              <SearchableSelect className="form-input" style={{ width: 150, fontSize: 13 }} value={styleName} onValueChange={value => setStyleName(value)}>
                <option value="">All Styles</option>
                {styleOptions.map((v, i) => <option key={i} value={v}>{v}</option>)}
              </SearchableSelect>

              {/* Order No */}
              <SearchableSelect className="form-input" style={{ width: 140, fontSize: 13 }} value={orderNumber} onValueChange={value => setOrderNumber(value)}>
                <option value="">All Orders</option>
                {orderOptions.map((v, i) => <option key={i} value={v}>{v}</option>)}
              </SearchableSelect>

              {/* Purchase No */}
              <SearchableSelect className="form-input" style={{ width: 150, fontSize: 13 }} value={purchaseNo} onValueChange={value => setPurchaseNo(value)}>
                <option value="">All Purchase No</option>
                {purchaseOptions.map((v, i) => <option key={i} value={v}>{v}</option>)}
              </SearchableSelect>

              {/* Reset Filters button */}
              {hasActiveFilters && (
                <button 
                  className="btn btn-ghost btn-sm text-danger" 
                  onClick={resetFilters} 
                  style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, padding: '4px 8px' }}
                  title="Reset all filters"
                >
                  <RotateCcw size={12} /> Clear Filters
                </button>
              )}
            </div>

            {/* Live Count Indicator */}
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
              {hasActiveFilters ? (
                <span>Showing <strong>{filteredData.length}</strong> of <strong>{data.length}</strong> records</span>
              ) : (
                <span>Total: <strong>{data.length}</strong> records</span>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="table-wrapper">{renderTable()}</div>
    </div>
  );
}

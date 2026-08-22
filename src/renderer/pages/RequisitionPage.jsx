import React, { useState, useEffect, useCallback } from 'react';
import useStore from '../store/useStore';
import { ClipboardList, Plus, Trash2, FileText, FileSpreadsheet, Search, CheckCircle, XCircle, Ban, Package, Eye, ChevronRight } from 'lucide-react';

const STATUS_STYLES = {
  PENDING:   { badge: 'badge-warning', label: 'PENDING' },
  APPROVED:  { badge: 'badge-info',    label: 'APPROVED' },
  FULFILLED: { badge: 'badge-success', label: 'FULFILLED' },
  REJECTED:  { badge: 'badge-danger',  label: 'REJECTED' },
  CANCELLED: { badge: 'badge-secondary', label: 'CANCELLED' },
};

export default function RequisitionPage() {
  const { addToast, user, openModal, showConfirm } = useStore();
  const [view, setView] = useState('list'); // 'list' | 'form' | 'detail'
  const [requisitions, setRequisitions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedReq, setSelectedReq] = useState(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  // Filters
  const [filterStatus, setFilterStatus] = useState('');
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo] = useState('');
  const [filterSearch, setFilterSearch] = useState('');

  // Form state
  const [form, setForm] = useState({ requesterName: '', department: '', purpose: '', notes: '', requisitionDate: new Date().toISOString().split('T')[0], recipientId: '' });
  const [formItems, setFormItems] = useState([]);
  const [allItems, setAllItems] = useState([]);
  const [recipients, setRecipients] = useState([]);
  const [nextNumber, setNextNumber] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const isAdmin = ['Super Admin', 'Admin'].includes(user?.roleName);
  const isSuperAdmin = user?.roleName === 'Super Admin';
  const canWrite = isAdmin || ['Operator', 'Inventory'].includes(user?.roleName);

  const loadRequisitions = useCallback(async () => {
    setLoading(true);
    try {
      const res = await window.kadal.requisitions.getAll({
        status: filterStatus || undefined,
        dateFrom: filterDateFrom || undefined,
        dateTo: filterDateTo || undefined,
        search: filterSearch || undefined,
      });
      if (res?.success) setRequisitions(res.data || []);
    } catch (e) { addToast('error', 'Failed to load requisitions'); }
    setLoading(false);
  }, [filterStatus, filterDateFrom, filterDateTo, filterSearch]);

  useEffect(() => { loadRequisitions(); }, [loadRequisitions]);

  const loadFormData = async () => {
    try {
      const [r1, r2, r3] = await Promise.all([
        window.kadal.items.getAll({}),
        window.kadal.recipients.getAll(),
        window.kadal.requisitions.getNextNumber(),
      ]);
      if (r1?.success) setAllItems(r1.data || []);
      if (r2?.success) setRecipients(r2.data || []);
      if (r3?.success) setNextNumber(r3.data || 'REQ-0001');
    } catch (e) {}
  };

  const openForm = () => { loadFormData(); setView('form'); };
  const cancelForm = () => { setView('list'); setFormItems([]); setForm({ requesterName: '', department: '', purpose: '', notes: '', requisitionDate: new Date().toISOString().split('T')[0], recipientId: '' }); };

  const updateFormItem = (idx, field, value) => {
    const upd = [...formItems];
    upd[idx] = { ...upd[idx], [field]: value };
    setFormItems(upd);
  };
  const removeFormItem = (idx) => setFormItems(formItems.filter((_, i) => i !== idx));

  const handleSubmit = async () => {
    if (!form.requesterName.trim()) return addToast('error', 'Requester name is required');
    if (formItems.length === 0) return addToast('error', 'Add at least one item');
    for (const item of formItems) {
      if (!item.itemId) return addToast('error', 'Each item row must have an item selected');
      if (!(Number(item.quantity) > 0)) return addToast('error', `Invalid quantity for ${item.name || 'item'}`);
    }
    setSubmitting(true);
    try {
      const res = await window.kadal.requisitions.create({
        recipientId: form.recipientId ? Number(form.recipientId) : null,
        requesterName: form.requesterName.trim(),
        department: form.department.trim(),
        purpose: form.purpose.trim(),
        notes: form.notes.trim(),
        requisitionDate: form.requisitionDate,
        items: formItems.map(i => ({ itemId: i.itemId, quantity: Number(i.quantity), notes: i.notes || '' })),
      });
      if (res?.success) {
        const msg = res.data?.pendingApproval ? `Requisition submitted for approval` : `Requisition ${res.data?.requisitionNo || nextNumber} created!`;
        addToast('success', msg);
        cancelForm();
        loadRequisitions();
      } else {
        addToast('error', res?.error || 'Failed to create requisition');
      }
    } catch (e) { addToast('error', e.message); }
    setSubmitting(false);
  };

  const viewDetail = async (req) => {
    setLoadingDetail(true);
    setView('detail');
    try {
      const res = await window.kadal.requisitions.getById(req.id);
      if (res?.success) setSelectedReq(res.data);
      else setSelectedReq(req);
    } catch (e) { setSelectedReq(req); }
    setLoadingDetail(false);
  };

  const handleAction = async (action, req) => {
    const actionLabels = { approve: 'Approve', reject: 'Reject', cancel: 'Cancel', fulfill: 'Fulfill', delete: 'Delete' };
    const actionMessages = {
      approve: `Approve requisition ${req.requisition_no}?`,
      reject: `Reject requisition ${req.requisition_no}? This cannot be undone.`,
      cancel: `Cancel requisition ${req.requisition_no}?`,
      fulfill: `Fulfill requisition ${req.requisition_no}? Stock will be deducted for all items.`,
      delete: `Delete requisition ${req.requisition_no}? ${req.status === 'FULFILLED' ? 'Stock will be reversed.' : ''} This cannot be undone.`,
    };
    const ok = await showConfirm({ title: actionLabels[action] + ' Requisition', message: actionMessages[action], confirmText: actionLabels[action], danger: ['reject', 'cancel', 'delete'].includes(action) });
    if (!ok) return;

    try {
      let res;
      if (action === 'approve') res = await window.kadal.requisitions.approve(req.id, '');
      else if (action === 'reject') res = await window.kadal.requisitions.reject(req.id, '');
      else if (action === 'cancel') res = await window.kadal.requisitions.cancel(req.id, '');
      else if (action === 'fulfill') res = await window.kadal.requisitions.fulfill(req.id);
      else if (action === 'delete') res = await window.kadal.requisitions.delete(req.id);

      if (res?.success) {
        addToast('success', `Requisition ${actionLabels[action].toLowerCase()}d successfully`);
        if (view === 'detail') { setView('list'); setSelectedReq(null); }
        loadRequisitions();
      } else {
        addToast('error', res?.error || 'Action failed');
      }
    } catch (e) { addToast('error', e.message); }
  };

  // ============ FORM VIEW ============
  if (view === 'form') {
    return (
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
            <ClipboardList size={20} color="var(--accent)" />
            New Requisition — <span style={{ color: 'var(--accent)' }}>{nextNumber}</span>
          </h3>
          <button className="btn btn-outline" onClick={cancelForm}>Cancel</button>
        </div>

        <div className="card" style={{ padding: 20, marginBottom: 16 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
            <div>
              <label className="form-label">Requester Name *</label>
              <input className="form-input" value={form.requesterName} onChange={e => setForm({ ...form, requesterName: e.target.value })} placeholder="Who is requesting..." />
            </div>
            <div>
              <label className="form-label">Department</label>
              <input className="form-input" value={form.department} onChange={e => setForm({ ...form, department: e.target.value })} placeholder="e.g. Cutting, Sewing..." />
            </div>
            <div>
              <label className="form-label">Requisition Date</label>
              <input type="date" className="form-input" value={form.requisitionDate} onChange={e => setForm({ ...form, requisitionDate: e.target.value })} />
            </div>
            <div>
              <label className="form-label">Recipient / Section</label>
              <select className="form-input" value={form.recipientId} onChange={e => setForm({ ...form, recipientId: e.target.value })}>
                <option value="">No specific recipient</option>
                {recipients.map(r => <option key={r.id} value={r.id}>{r.name} ({r.type})</option>)}
              </select>
            </div>
            <div>
              <label className="form-label">Purpose</label>
              <input className="form-input" value={form.purpose} onChange={e => setForm({ ...form, purpose: e.target.value })} placeholder="Purpose of requisition..." />
            </div>
            <div>
              <label className="form-label">Notes</label>
              <input className="form-input" value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} placeholder="Optional notes..." />
            </div>
          </div>
        </div>

        <div className="card" style={{ padding: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <h4 style={{ margin: 0 }}>Requested Items ({formItems.length})</h4>
            <button className="btn btn-outline btn-sm" onClick={() => openModal('ISSUE_BROWSER', {
              items: allItems,
              distinctValues: {},
              onSelect: (item) => setFormItems(prev => {
                if (prev.some(i => i.itemId === item.id)) { addToast('warning', 'Item already added'); return prev; }
                return [...prev, { itemId: item.id, name: item.name, itemCode: item.item_code, unit: item.unit, currentStock: item.current_stock, buyerName: item.buyer_name, size: item.size, color: item.color, quantity: 1, notes: '' }];
              }),
            })}>
              <Search size={14} /> Browse Inventory
            </button>
          </div>

          {formItems.length === 0 ? (
            <p className="text-muted" style={{ textAlign: 'center', padding: 24 }}>
              <Package size={20} style={{ marginBottom: 6 }} /><br />
              Click "Browse Inventory" to search and add items to this requisition
            </p>
          ) : (
            <div className="table-wrapper">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Item</th><th>Buyer</th><th>Size / Color</th>
                    <th style={{ textAlign: 'right' }}>In Stock</th>
                    <th style={{ textAlign: 'right', width: 100 }}>Req. Qty *</th>
                    <th>Unit</th><th>Notes</th><th></th>
                  </tr>
                </thead>
                <tbody>
                  {formItems.map((item, idx) => (
                    <tr key={idx}>
                      <td>
                        <div style={{ fontWeight: 600 }}>{item.name}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{item.itemCode}</div>
                      </td>
                      <td style={{ fontSize: 12 }}>{item.buyerName || '-'}</td>
                      <td style={{ fontSize: 12 }}>{[item.size, item.color].filter(Boolean).join(' / ') || '-'}</td>
                      <td className="text-right text-mono fw-bold" style={{ color: item.currentStock <= 5 ? 'var(--danger)' : 'var(--success)' }}>{item.currentStock}</td>
                      <td>
                        <input type="number" className="form-input" style={{ width: 90, textAlign: 'right' }}
                          value={item.quantity} min={1} onChange={e => updateFormItem(idx, 'quantity', e.target.value)} />
                      </td>
                      <td style={{ fontSize: 12 }}>{item.unit}</td>
                      <td><input className="form-input" style={{ width: 100 }} value={item.notes || ''} onChange={e => updateFormItem(idx, 'notes', e.target.value)} placeholder="Notes" /></td>
                      <td><button className="btn btn-ghost btn-icon btn-sm" onClick={() => removeFormItem(idx)}><Trash2 size={14} color="var(--danger)" /></button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16, gap: 10 }}>
            <button className="btn btn-primary" onClick={handleSubmit} disabled={submitting || formItems.length === 0}>
              {submitting ? 'Submitting...' : 'Submit Requisition'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ============ DETAIL VIEW ============
  if (view === 'detail') {
    const req = selectedReq;
    const status = req?.status || 'PENDING';
    const canApprove = isAdmin && status === 'PENDING';
    const canFulfill = canWrite && ['PENDING', 'APPROVED'].includes(status);
    const canReject = isAdmin && ['PENDING', 'APPROVED'].includes(status);
    const canCancel = canWrite && ['PENDING', 'APPROVED'].includes(status);

    return (
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <button className="btn btn-ghost btn-sm" onClick={() => { setView('list'); setSelectedReq(null); }}>← Back</button>
            <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
              <ClipboardList size={18} color="var(--accent)" />
              Requisition Details — <span style={{ color: 'var(--accent)' }}>{req?.requisition_no}</span>
            </h3>
            {req && <span className={`badge ${STATUS_STYLES[status]?.badge || 'badge-secondary'}`}>{status}</span>}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            {req && <button className="btn btn-outline btn-sm" onClick={() => window.kadal.requisitions.exportPdf(req.id)}><FileText size={14} /> PDF</button>}
            {req && <button className="btn btn-outline btn-sm" onClick={() => window.kadal.requisitions.exportExcel(req.id)}><FileSpreadsheet size={14} /> Excel</button>}
          </div>
        </div>

        {loadingDetail ? (
          <div className="loading"><div className="spinner" /></div>
        ) : req ? (
          <>
            <div className="card" style={{ padding: 20, marginBottom: 16 }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
                <div><span className="form-label">Requester</span><div style={{ fontWeight: 600 }}>{req.requester_name || '-'}</div></div>
                <div><span className="form-label">Department</span><div>{req.department || '-'}</div></div>
                <div><span className="form-label">Date</span><div>{req.requisition_date ? new Date(req.requisition_date).toLocaleDateString('en-GB') : '-'}</div></div>
                <div><span className="form-label">Recipient</span><div>{req.recipient_name || '-'}</div></div>
                <div><span className="form-label">Purpose</span><div>{req.purpose || '-'}</div></div>
                <div><span className="form-label">Approved By</span><div>{req.approved_by || '-'}</div></div>
                {req.notes && <div style={{ gridColumn: 'span 3' }}><span className="form-label">Notes</span><div style={{ color: 'var(--text-muted)' }}>{req.notes}</div></div>}
              </div>
            </div>

            <div className="card" style={{ padding: 20, marginBottom: 16 }}>
              <h4 style={{ marginTop: 0, marginBottom: 12 }}>Requested Items</h4>
              <div className="table-wrapper">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>#</th><th>Item</th><th>Buyer</th><th>Style / PO / Order</th><th>Size / Color</th>
                      <th style={{ textAlign: 'right' }}>Req. Qty</th>
                      <th style={{ textAlign: 'right' }}>Apv. Qty</th>
                      <th style={{ textAlign: 'right' }}>Issued</th>
                      <th>Unit</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(req.items || []).map((item, idx) => {
                      const spo = [item.style_name, item.purchase_no, item.order_number].filter(Boolean).filter(v => v !== '-').join(' / ') || '-';
                      const sc = [item.size, item.color].filter(Boolean).filter(v => v !== '-').join(' / ') || '-';
                      return (
                        <tr key={item.id || idx}>
                          <td style={{ fontSize: 12 }}>{idx + 1}</td>
                          <td>
                            <div style={{ fontWeight: 600 }}>{item.item_name}</div>
                            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{item.item_code}</div>
                          </td>
                          <td style={{ fontSize: 12 }}>{item.buyer_name || '-'}</td>
                          <td style={{ fontSize: 11 }}>{spo}</td>
                          <td style={{ fontSize: 12 }}>{sc}</td>
                          <td className="text-right text-mono fw-bold">{item.requested_quantity}</td>
                          <td className="text-right text-mono" style={{ color: 'var(--accent)' }}>{item.approved_quantity || 0}</td>
                          <td className="text-right text-mono text-success">{item.issued_quantity || 0}</td>
                          <td style={{ fontSize: 12 }}>{item.item_unit || '-'}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              {canApprove && (
                <button className="btn btn-success btn-sm" onClick={() => handleAction('approve', req)}>
                  <CheckCircle size={14} /> Approve
                </button>
              )}
              {canFulfill && (
                <button className="btn btn-primary btn-sm" onClick={() => handleAction('fulfill', req)}>
                  <ChevronRight size={14} /> Fulfill (Deduct Stock)
                </button>
              )}
              {canReject && (
                <button className="btn btn-outline btn-sm" style={{ color: 'var(--danger)', borderColor: 'var(--danger)' }} onClick={() => handleAction('reject', req)}>
                  <XCircle size={14} /> Reject
                </button>
              )}
              {canCancel && (
                <button className="btn btn-outline btn-sm" onClick={() => handleAction('cancel', req)}>
                  <Ban size={14} /> Cancel
                </button>
              )}
              {isSuperAdmin && (
                <button className="btn btn-ghost btn-sm" style={{ color: 'var(--danger)', marginLeft: 'auto' }} onClick={() => handleAction('delete', req)}>
                  <Trash2 size={14} /> Delete
                </button>
              )}
            </div>
          </>
        ) : (
          <div className="empty-state"><h3>Not found</h3></div>
        )}
      </div>
    );
  }

  // ============ LIST VIEW ============
  return (
    <div>
      <div className="toolbar" style={{ marginBottom: 16 }}>
        <div className="toolbar-left" style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
            <ClipboardList size={20} color="var(--accent)" /> Requisitions
          </h3>
          <input className="form-input" style={{ width: 180 }} value={filterSearch} onChange={e => setFilterSearch(e.target.value)} placeholder="Search..." />
          <select className="form-input" style={{ width: 130 }} value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
            <option value="">All Statuses</option>
            <option value="PENDING">Pending</option>
            <option value="APPROVED">Approved</option>
            <option value="FULFILLED">Fulfilled</option>
            <option value="REJECTED">Rejected</option>
            <option value="CANCELLED">Cancelled</option>
          </select>
          <input type="date" className="form-input" style={{ width: 130 }} value={filterDateFrom} onChange={e => setFilterDateFrom(e.target.value)} />
          <span className="text-muted">to</span>
          <input type="date" className="form-input" style={{ width: 130 }} value={filterDateTo} onChange={e => setFilterDateTo(e.target.value)} />
        </div>
        <div className="toolbar-right">
          {canWrite && (
            <button className="btn btn-primary" onClick={openForm}>
              <Plus size={14} /> New Requisition
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <div className="loading"><div className="spinner" /></div>
      ) : requisitions.length === 0 ? (
        <div className="empty-state">
          <ClipboardList size={40} style={{ opacity: 0.3, marginBottom: 12 }} />
          <h3>No requisitions found</h3>
          <p>Create a new requisition to request materials from the store.</p>
        </div>
      ) : (
        <div className="table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th>Req. No</th>
                <th>Date</th>
                <th>Requester</th>
                <th>Department</th>
                <th>Recipient</th>
                <th style={{ textAlign: 'center' }}>Items</th>
                <th>Status</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {requisitions.map(req => {
                const statusStyle = STATUS_STYLES[req.status] || STATUS_STYLES.PENDING;
                return (
                  <tr key={req.id}>
                    <td
                      className="text-mono"
                      style={{ color: 'var(--accent)', fontSize: 12, cursor: 'pointer', textDecoration: 'underline' }}
                      onClick={() => viewDetail(req)}
                      title="View Details"
                    >
                      {req.requisition_no}
                    </td>
                    <td style={{ fontSize: 12 }}>{new Date(req.requisition_date).toLocaleDateString('en-GB')}</td>
                    <td style={{ fontWeight: 600 }}>{req.requester_name || '-'}</td>
                    <td style={{ fontSize: 12 }}>{req.department || '-'}</td>
                    <td style={{ fontSize: 12 }}>{req.recipient_name || '-'}</td>
                    <td className="text-center">{req.item_count || 0}</td>
                    <td><span className={`badge ${statusStyle.badge}`}>{req.status}</span></td>
                    <td style={{ textAlign: 'right' }}>
                      <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
                        <button className="btn btn-ghost btn-icon btn-sm" onClick={() => viewDetail(req)} title="View Details"><Eye size={14} /></button>
                        {isAdmin && req.status === 'PENDING' && (
                          <button className="btn btn-ghost btn-icon btn-sm" onClick={() => handleAction('approve', req)} title="Approve" style={{ color: 'var(--success)' }}><CheckCircle size={14} /></button>
                        )}
                        {canWrite && ['PENDING', 'APPROVED'].includes(req.status) && (
                          <button className="btn btn-ghost btn-icon btn-sm" onClick={() => handleAction('fulfill', req)} title="Fulfill" style={{ color: 'var(--accent)' }}><ChevronRight size={14} /></button>
                        )}
                        <button className="btn btn-ghost btn-icon btn-sm" onClick={() => window.kadal.requisitions.exportPdf(req.id)} title="PDF"><FileText size={14} /></button>
                        <button className="btn btn-ghost btn-icon btn-sm" onClick={() => window.kadal.requisitions.exportExcel(req.id)} title="Excel"><FileSpreadsheet size={14} /></button>
                        {isSuperAdmin && (
                          <button className="btn btn-ghost btn-icon btn-sm" onClick={() => handleAction('delete', req)} title="Delete"><Trash2 size={14} color="var(--danger)" /></button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

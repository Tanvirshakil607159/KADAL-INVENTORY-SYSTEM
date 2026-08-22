import React, { useState, useEffect, useCallback } from 'react';
import useStore from '../store/useStore';
import { Plus, Search, Trash2, FileText, ArrowLeft, Package, Clock, X, AlertCircle } from 'lucide-react';

export default function ChallanPage() {
  const { 
    addToast, setPage, openModal, 
    challanForm, setChallanForm, 
    challanItems, setChallanItems, 
    clearChallan, user, showConfirm
  } = useStore();
  
  const [items, setItems] = useState([]);
  const [distinctValues, setDistinctValues] = useState({ styles: [], orders: [], purchases: [] });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [preview, setPreview] = useState(false);
  const [settings, setSettings] = useState({});
  const [recipients, setRecipients] = useState([]);
  const [lockedItemIds, setLockedItemIds] = useState(new Set());
  const [challanNumber, setChallanNumber] = useState('...');
  const [addressSuggestions, setAddressSuggestions] = useState([]);
  const [contactSuggestions, setContactSuggestions] = useState([]);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      // Parallelize all fetches for maximum speed while maintaining individual resilience
      const [
        itemsRes, dvRes, settingsRes, numberRes, recipientsRes, approvalsRes, addrRes, contRes
      ] = await Promise.all([
        window.kadal.items.getAll().catch(e => ({ success: false, error: e })),
        window.kadal.items.getDistinctValues().catch(e => ({ success: false, error: e })),
        window.kadal.settings.getAll().catch(e => ({ success: false, error: e })),
        window.kadal.challans.getNextNumber().catch(e => ({ success: false, error: e })),
        window.kadal.recipients.getAll().catch(e => ({ success: false, error: e })),
        window.kadal.approvals.getAll({ status: 'PENDING' }).catch(e => ({ success: false, error: e })),
        window.kadal.challans.getFieldSuggestions('receiverAddress').catch(e => ({ success: false, error: e })),
        window.kadal.challans.getFieldSuggestions('receiverContact').catch(e => ({ success: false, error: e }))
      ]);

      if (itemsRes?.success) setItems(itemsRes.data || []);
      if (dvRes?.success) setDistinctValues(dvRes.data || { styles: [], orders: [], purchases: [] });
      if (settingsRes?.success) setSettings(settingsRes.data || {});
      if (numberRes?.success) setChallanNumber(numberRes.data || '...');
      if (recipientsRes?.success) setRecipients(recipientsRes.data || []);
      if (addrRes?.success) setAddressSuggestions(addrRes.data || []);
      if (contRes?.success) setContactSuggestions(contRes.data || []);

      if (approvalsRes?.success && Array.isArray(approvalsRes.data)) {
        const locked = new Set();
        approvalsRes.data.filter(r => r.type === 'CREATE_CHALLAN').forEach(r => {
          r.data?.items?.forEach(it => {
            if (it.itemId) locked.add(it.itemId);
          });
        });
        setLockedItemIds(locked);
      }
    } catch (e) { 
      addToast('error', 'Failed to load some page data'); 
      console.error("General loadData error:", e);
    }
    setLoading(false);
  }, [addToast]);

  useEffect(() => { loadData(); }, [loadData]);

  const updateItemQty = (idx, qty) => {
    const newItems = (challanItems || []).map((it, i) => i === idx ? { ...it, quantity: Number(qty) } : it);
    setChallanItems(newItems);
  };

  const removeItem = (idx) => {
    setChallanItems((challanItems || []).filter((_, i) => i !== idx));
  };

  const handleSave = async () => {
    if (!challanForm?.receiverName?.trim()) { addToast('error', 'Receiver name is required'); return; }
    if (!challanItems || challanItems.length === 0) { addToast('error', 'Add at least one item'); return; }
    for (const item of challanItems) {
      if (item.quantity <= 0) { addToast('error', `Invalid quantity for ${item.itemName}`); return; }
      if (item.quantity > item.available) { 
        addToast('error', `Insufficient stock for "${item.itemName}". Available: ${item.available}`); 
        return; 
      }
    }

    // Duplicate check: Same name and same size
    const seenItems = new Set();
    let hasDuplicate = false;
    for (const item of (challanItems || [])) {
      const namePart = String(item.itemName || '').trim().toLowerCase();
      const sizePart = String(item.size || '').trim().toLowerCase();
      const key = `${namePart}|${sizePart}`;
      if (seenItems.has(key)) {
        hasDuplicate = true;
        break;
      }
      seenItems.add(key);
    }


    if (hasDuplicate) {
      const confirmed = await showConfirm({
        title: 'Duplicate Items Detected',
        message: 'It seems items are duplicate please check before submit/approved. Do you want to proceed?',
        confirmText: 'Checked',
        cancelText: 'Cancel',
        type: 'warning'
      });
      if (!confirmed) return;
    }


    setSaving(true);
    try {
      const res = await window.kadal.challans.create({
        ...challanForm,
        items: challanItems.map(i => ({ 
          itemId: i.itemId, 
          name: i.itemName, 
          itemCode: i.itemCode,
          size: i.size,
          color: i.color,
          styleName: i.styleName,
          orderNumber: i.orderNumber,
          buyerName: i.buyerName,
          quantity: i.quantity, 
          unit: i.unit, 
          notes: i.notes 
        })),
      });
      if (res.success && res.data?.success) {
        if (res.data.pendingApproval) {
          addToast('success', 'Request submitted for Admin approval');
          clearChallan();
          setPage('dashboard');
        } else {
          addToast('success', `Challan ${res.data.challanNumber} created!`);
          try { await window.kadal.challans.exportPdf(res.data.id); } catch (e) {}
          clearChallan();
          setPage('challan-history');
        }
      } else { addToast('error', res.data?.error || res.error || 'Failed'); }
    } catch (e) { addToast('error', e.message); }
    setSaving(false);
  };

  const deleteSuggestion = async (field, value) => {
    const res = await window.kadal.challans.deleteSuggestion(field, value);
    if (res.success) {
      if (field === 'receiverAddress') setAddressSuggestions(prev => prev.filter(v => v !== value));
      if (field === 'receiverContact') setContactSuggestions(prev => prev.filter(v => v !== value));
      addToast('success', 'Suggestion removed');
    } else {
      addToast('error', res.error || 'Failed to remove suggestion');
    }
  };

  const set = (key, val) => setChallanForm({ ...challanForm, [key]: val });

  if (loading) return <div className="loading"><div className="spinner"></div></div>;

  if (preview) {
    const seenItems = new Set();
    let hasDuplicate = false;
    (challanItems || []).forEach(it => {
      const namePart = String(it.itemName || '').trim().toLowerCase();
      const sizePart = String(it.size || '').trim().toLowerCase();
      const key = `${namePart}|${sizePart}`;
      if (seenItems.has(key)) hasDuplicate = true;
      seenItems.add(key);
    });

    return (
      <div>
        <button className="btn btn-outline mb-4" onClick={() => setPreview(false)}>← Back to Edit</button>
        {hasDuplicate && (
          <div style={{ marginBottom: 16, padding: 12, background: 'rgba(245,158,11,0.1)', border: '1px solid var(--warning)', borderRadius: 'var(--radius-sm)', color: 'var(--warning)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 10 }}>
            <AlertCircle size={18} /> It seems items are duplicate please check before submit/approved
          </div>
        )}
        <div className="challan-preview">
          <div className="challan-preview-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              {settings?.company_logo ? (
                <img src={settings.company_logo} alt="Company Logo" style={{ maxHeight: 180, maxWidth: 350, objectFit: 'contain', marginBottom: 8 }} />
              ) : (
                <h2 style={{ fontSize: 20, fontWeight: 800 }}>{settings?.company_name || 'KA Design Accessories LTD'}</h2>
              )}
              {settings?.company_address && <p style={{ fontSize: 12, fontWeight: 'bold' }}>{settings.company_address}</p>}
              {settings?.company_phone && <p style={{ fontSize: 12, fontWeight: 'bold' }}>Phone: {settings.company_phone}</p>}
              {settings?.company_email && <p style={{ fontSize: 12, fontWeight: 'bold' }}>Email: {settings.company_email}</p>}
            </div>
            <div style={{ textAlign: 'right' }}>
              <h3 style={{ color: '#6366f1', fontSize: 16 }}>DELIVERY CHALLAN</h3>
              <p>No: {challanNumber}</p>
              <p>Date: {new Date().toLocaleDateString('en-GB')}</p>
            </div>
          </div>
          <div style={{ marginBottom: 16 }}>
            <p><strong>To:</strong> {challanForm?.receiverName}</p>
            {challanForm?.receiverContact && <p>Contact: {challanForm.receiverContact}</p>}
            {challanForm?.receiverAddress && <p>Address: {challanForm.receiverAddress}</p>}
          </div>
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>Item</th>
                <th>Code</th>
                <th>Size/Color</th>
                <th>Buyer</th>
                <th>Order No</th>
                <th style={{ textAlign: 'right' }}>Order Qty</th>
                <th style={{ textAlign: 'right' }}>Qty</th>
                <th style={{ textAlign: 'right' }}>Balance</th>
                <th>Unit</th>
              </tr>
            </thead>
            <tbody>
              {(challanItems || []).map((item, idx) => {
                const totalAfter = (item.totalDelivered || 0) + item.quantity;
                const balance = item.orderQuantity ? (item.orderQuantity - totalAfter) : null;
                return (
                  <tr key={idx}>
                    <td>{idx + 1}</td>
                    <td style={{ fontWeight: 600 }}>{item.itemName}</td>
                    <td className="text-mono" style={{ fontSize: 11 }}>{item.itemCode}</td>
                    <td>{item.size} / {item.color}</td>
                    <td>{item.buyerName || '-'}</td>
                    <td>{item.orderNumber || '-'}</td>
                    <td style={{ textAlign: 'right' }}>{item.orderQuantity || '-'}</td>
                    <td style={{ textAlign: 'right', fontWeight: 700 }}>{item.quantity}</td>
                    <td style={{ textAlign: 'right', fontWeight: 700, color: balance < 0 ? 'var(--danger)' : 'inherit' }}>
                      {balance !== null ? balance : '-'}
                    </td>
                    <td>{item.unit}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <div style={{ marginBottom: 40, marginTop: 24 }}>
            <p style={{ fontSize: 12 }}><strong>Notes:</strong> {challanForm?.notes || 'None'}</p>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
            <div style={{ width: '22%' }}>
              <div style={{ borderTop: '1px solid #000', textAlign: 'center', paddingTop: 4, fontSize: 11 }}>Signature of the Recipient</div>
            </div>
            <div style={{ width: '22%' }}>
              <div style={{ borderTop: '1px solid #000', textAlign: 'center', paddingTop: 4, fontSize: 11 }}>Store Incharge</div>
            </div>
            <div style={{ width: '22%' }}>
              <div style={{ borderTop: '1px solid #000', textAlign: 'center', paddingTop: 4, fontSize: 11 }}>Prepared By</div>
            </div>
            <div style={{ width: '22%' }}>
              <div style={{ borderTop: '1px solid #000', textAlign: 'center', paddingTop: 4, fontSize: 11 }}>Authorized Signature</div>
            </div>
          </div>

        </div>
        <div style={{ marginTop: 20, display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
          <button className="btn btn-outline" onClick={() => setPreview(false)}>Edit More</button>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? 'Processing...' : 'Confirm & Create Challan'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="challan-create-container">
      <div className="card challan-card">
        <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 className="card-title">New Delivery Challan</h3>
          <div className="text-muted text-mono" style={{ fontSize: 13 }}>Next No: {challanNumber}</div>
        </div>

        <div className="form-row">
          <div className="form-group" style={{ flex: 1.5 }}>
            <label className="form-label">Select Receiver (Factory/Employee) *</label>
            <select 
              className="form-input" 
              value={challanForm?.receiverId || ''} 
              onChange={e => {
                const recId = Number(e.target.value);
                const rec = (recipients || []).find(r => r.id === recId);
                if (rec) {
                  setChallanForm({
                    ...challanForm,
                    receiverId: rec.id,
                    receiverName: rec.name,
                    receiverContact: rec.contact_info || '',
                    receiverAddress: rec.receiver_address || ''
                  });
                } else {
                  setChallanForm({ ...challanForm, receiverId: '', receiverName: '' });
                }
              }}
            >
              <option value="">Select Managed Receiver...</option>
              {(recipients || []).map(r => <option key={r.id} value={r.id}>{r.name} ({r.type})</option>)}
            </select>
          </div>
          <SuggestionInput 
            label="Contact Person / Phone"
            value={challanForm?.receiverContact}
            onChange={v => set('receiverContact', v)}
            suggestions={contactSuggestions}
            field="receiverContact"
            placeholder="Auto-filled if available"
            onDelete={deleteSuggestion}
          />
        </div>

        <SuggestionInput 
          label="Delivery Address"
          value={challanForm?.receiverAddress}
          onChange={v => set('receiverAddress', v)}
          suggestions={addressSuggestions}
          field="receiverAddress"
          placeholder="Full address"
          disabled={user?.permissions?.challan !== 'rw'}
          onDelete={deleteSuggestion}
        />

        <div className="challan-items-section">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <h4 style={{ fontSize: 14, fontWeight: 600 }}>Items to Deliver</h4>
            {user?.permissions?.challan === 'rw' && (
              <button className="btn btn-outline btn-sm" onClick={() => openModal('CHALLAN_BROWSER', { items, distinctValues, lockedItemIds })}>
                <Search size={14} /> Browse Inventory
              </button>
            )}
          </div>

          <div className="table-wrapper">
            <table className="data-table">
              <thead><tr><th>Item</th><th>Order No</th><th>Order Qty</th><th>Delivered</th><th>Stock</th><th>Balance</th><th>Quantity</th><th>Unit</th>{user?.permissions?.challan === 'rw' && <th></th>}</tr></thead>
              <tbody>
                {(challanItems || []).map((item, idx) => {
                  const totalAfter = (item.totalDelivered || 0) + item.quantity;
                  const balance = item.orderQuantity ? (item.orderQuantity - totalAfter) : null;
                  return (
                    <tr key={idx}>
                      <td>
                        <div style={{ fontWeight: 600 }}>{item.itemName}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{item.itemCode} | {item.size} {item.color}</div>
                      </td>
                      <td style={{ fontSize: 12 }}>{item.orderNumber || '-'}</td>
                      <td className="text-mono">{item.orderQuantity || '-'}</td>
                      <td className="text-mono">{totalAfter}</td>
                      <td className="text-mono fw-bold" style={{ color: (item.available || 0) <= 5 ? 'var(--danger)' : 'var(--success)' }}>{item.available || 0}</td>
                      <td className="text-mono" style={{ fontWeight: 700, color: balance < 0 ? 'var(--danger)' : 'var(--primary)' }}>
                        {balance !== null ? balance : '-'}
                      </td>
                      <td>
                        <input className="form-input text-center" type="number" min="1" value={item.quantity} onChange={e => updateItemQty(idx, e.target.value)} style={{ width: 70, padding: '4px 8px' }} />
                      </td>
                      <td className="text-muted">{item.unit}</td>
                      <td>
                        <button className="btn btn-ghost btn-icon btn-sm" onClick={() => removeItem(idx)}><Trash2 size={14} color="var(--danger)" /></button>
                      </td>
                    </tr>
                  );
                })}
                {(!challanItems || challanItems.length === 0) && (
                  <tr><td colSpan={9} className="text-center text-muted" style={{ padding: 24 }}>No items added yet. Browse inventory to add.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="form-group mt-4">
          <label className="form-label">Notes</label>
          <textarea className="form-textarea" value={challanForm?.notes || ''} onChange={e => set('notes', e.target.value)} rows={2} placeholder="Optional notes..."></textarea>
        </div>

        <div className="modal-footer" style={{ padding: '16px 0 0 0', borderTop: '1px solid var(--border)' }}>
          <button className="btn btn-outline" onClick={() => clearChallan()}>Clear Form</button>
          <div style={{ flex: 1 }}></div>
          <button className="btn btn-outline" onClick={() => setPreview(true)} disabled={!challanItems || challanItems.length === 0}>Preview Challan</button>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving || !challanItems || challanItems.length === 0}>
            {saving ? 'Saving...' : 'Create Challan'}
          </button>
        </div>
      </div>
    </div>
  );
}

const SuggestionInput = ({ label, value, onChange, suggestions, field, placeholder, disabled, onDelete }) => {
  const [show, setShow] = useState(false);
  const [filtered, setFiltered] = useState([]);
  const [isFocused, setIsFocused] = useState(false);

  const isFilled = (val) => {
    if (val === null || val === undefined) return false;
    if (typeof val === 'string') return val.trim().length > 0;
    if (typeof val === 'number') return val >= 0;
    return !!val;
  };

  useEffect(() => {
    if (!value || (isFocused && suggestions.includes(value))) {
      setFiltered(suggestions);
    } else {
      setFiltered(suggestions.filter(s => s.toLowerCase().includes(value.toLowerCase())));
    }
  }, [value, suggestions, isFocused]);

  return (
    <div className="form-group" style={{ position: 'relative', flex: 1 }}>
      <label className="form-label">{label}</label>
      <div style={{ position: 'relative' }}>
        <input 
          className={`form-input ${isFilled(value) ? 'filled' : ''}`} 
          value={value || ''} 
          onChange={e => {
            onChange(e.target.value);
            setShow(true);
          }} 
          onFocus={() => {
            setShow(true);
            setIsFocused(true);
          }}
          onBlur={() => {
            // Delay to allow onClick to fire
            setTimeout(() => {
              setShow(false);
              setIsFocused(false);
            }, 200);
          }}
          placeholder={placeholder}
          disabled={disabled}
          autoComplete="off"
        />
        {show && filtered?.length > 0 && (
          <div className="custom-suggestions" onMouseDown={e => e.preventDefault()}>
            {filtered.map((s, i) => (
              <div 
                key={i} 
                className={`suggestion-item ${s === value ? 'active' : ''}`} 
                onClick={() => {
                  onChange(s);
                  setShow(false);
                }}
              >
                <span>{s}</span>
                <button 
                  className="btn-delete-suggestion" 
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete(field, s);
                  }}
                  type="button"
                  title="Remove suggestion"
                >
                  <X size={12} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

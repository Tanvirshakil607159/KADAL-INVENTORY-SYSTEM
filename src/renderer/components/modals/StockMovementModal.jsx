import React, { useState } from 'react';
import useStore from '../../store/useStore';

export default function StockMovementModal({ data, onSaved }) {
  const { addToast, closeModal, setModalMinimized, modal } = useStore();
  const { item, type } = data;
  const isMinimized = modal?.isMinimized;

  const [quantity, setQuantity] = useState('');
  const [reference, setReference] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [suggestions, setSuggestions] = useState({ reference: [], notes: [] });

  const fetchSuggestions = async (field, value) => {
    try {
      const res = await window.kadal.stock.getFieldSuggestions(field, value || '');
      if (res.success) setSuggestions(prev => ({ ...prev, [field]: res.data }));
    } catch (e) {}
  };

  const handleSave = async () => {
    const qty = Number(quantity);
    if (!qty || qty <= 0) { addToast('error', 'Enter a valid quantity'); return; }
    setSaving(true);
    try {
      const res = await window.kadal.stock.addMovement({ itemId: item.id, itemName: item.name, type, quantity: qty, reference, notes });
      if (res.success && res.data?.success) {
        if (res.data.pendingApproval) {
          addToast('success', 'Stock movement submitted for Admin approval');
        } else {
          addToast('success', `Stock ${type === 'IN' ? 'added' : 'deducted'}: ${qty} ${item.unit}`);
        }
        if (onSaved) onSaved();
        closeModal();
      } else { addToast('error', res.data?.error || res.error || 'Failed'); }
    } catch (e) { addToast('error', e.message); }
    setSaving(false);
  };

  return (
    <div className={`modal-overlay ${isMinimized ? 'minimized-mode' : ''}`}>
      <div className={`modal ${isMinimized ? 'minimized' : ''}`} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3 className="modal-title" style={{ color: type === 'IN' ? 'var(--success)' : 'var(--warning)' }}>
            Stock {type} — {item.name}
          </h3>
          <div className="modal-controls">
            <button className="btn-control btn-minimize" onClick={() => setModalMinimized(!isMinimized)} title={isMinimized ? 'Restore' : 'Minimize'}>{isMinimized ? '+' : '-'}</button>
            <button className="btn-control btn-close" onClick={closeModal} title="Close">✕</button>
          </div>
        </div>
        <div className="modal-body">
          <div style={{ background: 'var(--bg-tertiary)', padding: 14, borderRadius: 'var(--radius-sm)', marginBottom: 16, display: 'flex', justifyContent: 'space-between' }}>
            <span className="text-muted">Current Stock:</span>
            <span className="text-mono fw-bold">{item.current_stock} {item.unit}</span>
          </div>
          <div className="form-group">
            <label className="form-label">Quantity *</label>
            <input className="form-input" type="number" min="1" value={quantity} onChange={e => setQuantity(e.target.value)} autoFocus placeholder="Enter quantity" />
          </div>
          <div className="form-group">
            <label className="form-label">Reference</label>
            <input className="form-input" list="stock-reference-list" value={reference} onChange={e => { setReference(e.target.value); fetchSuggestions('reference', e.target.value); }} onFocus={() => fetchSuggestions('reference', reference)} placeholder="e.g. PO-12345, Manual adjustment" autoComplete="off" />
            <datalist id="stock-reference-list">{suggestions.reference.map((s, i) => <option key={i} value={s} />)}</datalist>
          </div>
          <div className="form-group">
            <label className="form-label">Notes</label>
            <input className="form-input" list="stock-notes-list" value={notes} onChange={e => { setNotes(e.target.value); fetchSuggestions('notes', e.target.value); }} onFocus={() => fetchSuggestions('notes', notes)} placeholder="Optional notes..." autoComplete="off" />
            <datalist id="stock-notes-list">{suggestions.notes.map((s, i) => <option key={i} value={s} />)}</datalist>
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-outline" onClick={closeModal}>Cancel</button>
          <button className={`btn btn-${type === 'IN' ? 'success' : 'danger'}`} onClick={handleSave} disabled={saving}>
            {saving ? 'Processing...' : `Confirm Stock ${type}`}
          </button>
        </div>
      </div>
    </div>
  );
}

import React, { useState } from 'react';
import useStore from '../../store/useStore';
import { Search } from 'lucide-react';

export default function StockMovementModal({ data, onSaved }) {
  const { addToast, closeModal, setModalMinimized, modal } = useStore();
  const { item, type } = data;
  const isMinimized = modal?.isMinimized;

  const [selectedItem, setSelectedItem] = useState(item || null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);

  const [quantity, setQuantity] = useState('');
  const [reference, setReference] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [suggestions, setSuggestions] = useState({ reference: [], notes: [] });

  const handleSearchItems = async (q) => {
    setSearchQuery(q);
    if (!q || q.trim().length === 0) {
      setSearchResults([]);
      return;
    }
    setSearching(true);
    try {
      const res = await window.kadal.items.getAll({ search: q.trim() });
      if (res?.success) {
        setSearchResults(res.data || []);
      }
    } catch (e) {}
    setSearching(false);
  };

  const fetchSuggestions = async (field, value) => {
    try {
      const res = await window.kadal.stock.getFieldSuggestions(field, value || '');
      if (res.success) setSuggestions(prev => ({ ...prev, [field]: res.data }));
    } catch (e) {}
  };

  const handleSave = async () => {
    if (!selectedItem) { addToast('error', 'Please select an item first'); return; }
    const qty = Number(quantity);
    if (!qty || qty <= 0) { addToast('error', 'Enter a valid quantity'); return; }
    setSaving(true);
    try {
      const res = await window.kadal.stock.addMovement({ itemId: selectedItem.id, itemName: selectedItem.name, type, quantity: qty, reference, notes });
      if (res.success && res.data?.success) {
        if (res.data.pendingApproval) {
          addToast('success', 'Stock movement submitted for Admin approval');
        } else {
          addToast('success', `Stock ${type === 'IN' ? 'added' : 'deducted'}: ${qty} ${selectedItem.unit}`);
        }
        if (onSaved) onSaved(selectedItem);
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
            Stock {type} {selectedItem ? `— ${selectedItem.name}` : ''}
          </h3>
          <div className="modal-controls">
            <button className="btn-control btn-minimize" onClick={() => setModalMinimized(!isMinimized)} title={isMinimized ? 'Restore' : 'Minimize'}>{isMinimized ? '+' : '-'}</button>
            <button className="btn-control btn-close" onClick={closeModal} title="Close">✕</button>
          </div>
        </div>
        <div className="modal-body">
          {!selectedItem ? (
            <div className="form-group">
              <label className="form-label">Search Item for Stock {type} *</label>
              <div className="search-bar" style={{ marginBottom: 8 }}>
                <Search size={16} />
                <input
                  className="form-input"
                  placeholder="Search by code, name, size, color, style..."
                  value={searchQuery}
                  onChange={e => handleSearchItems(e.target.value)}
                  autoFocus
                />
              </div>
              {searching ? (
                <div style={{ padding: 12, textAlign: 'center' }}><div className="spinner"></div></div>
              ) : searchResults.length > 0 ? (
                <div style={{ maxHeight: 220, overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', background: 'var(--surface-card)' }}>
                  {searchResults.map(it => (
                    <div
                      key={it.id}
                      style={{ padding: '8px 12px', borderBottom: '1px solid var(--border-light)', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                      onClick={() => { setSelectedItem(it); setSearchResults([]); }}
                    >
                      <div>
                        <div style={{ fontWeight: 600, fontSize: 13 }}>{it.name}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                          Code: <span className="text-mono" style={{ color: 'var(--accent)' }}>{it.item_code}</span>
                          {(it.size || it.color) && ` | Size/Color: ${[it.size, it.color].filter(Boolean).join(' / ')}`}
                        </div>
                      </div>
                      <div style={{ fontSize: 12, textAlign: 'right' }}>
                        <span className="text-muted">Stock: </span>
                        <span className="text-mono fw-bold">{it.current_stock} {it.unit}</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : searchQuery ? (
                <div style={{ padding: 12, fontSize: 13, color: 'var(--text-muted)', textAlign: 'center' }}>No matching items found</div>
              ) : null}
            </div>
          ) : (
            <div style={{ background: 'var(--bg-tertiary)', padding: 14, borderRadius: 'var(--radius-sm)', marginBottom: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <h4 style={{ margin: 0, fontSize: 14 }}>{selectedItem.name}</h4>
                {!item && (
                  <button className="btn btn-ghost btn-xs" onClick={() => setSelectedItem(null)} style={{ fontSize: 11, color: 'var(--accent)' }}>
                    Change Item
                  </button>
                )}
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', display: 'flex', flexWrap: 'wrap', gap: '6px 16px' }}>
                <span>Code: <strong className="text-mono" style={{ color: 'var(--accent)' }}>{selectedItem.item_code}</strong></span>
                {(selectedItem.size || selectedItem.color) && (
                  <span>Size/Color: <strong>{[selectedItem.size, selectedItem.color].filter(Boolean).join(' / ')}</strong></span>
                )}
                <span>Current Stock: <strong className="text-mono text-success">{selectedItem.current_stock} {selectedItem.unit}</strong></span>
              </div>
            </div>
          )}

          {selectedItem && (
            <>
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
            </>
          )}
        </div>
        <div className="modal-footer">
          <button className="btn btn-outline" onClick={closeModal}>Cancel</button>
          <button className={`btn btn-${type === 'IN' ? 'success' : 'danger'}`} onClick={handleSave} disabled={saving || !selectedItem}>
            {saving ? 'Processing...' : `Confirm Stock ${type}`}
          </button>
        </div>
      </div>
    </div>
  );
}


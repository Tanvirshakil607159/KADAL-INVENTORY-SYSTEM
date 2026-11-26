import React, { useEffect, useState } from 'react';
import { RefreshCw, Search, X } from 'lucide-react';

/**
 * Shared modal to search and link an Inventory item to a manual Proforma Invoice line item.
 */
export default function PiItemPickerModal({
  lineIndex,
  onSelectItem,
  onClose,
  zIndex = 1300
}) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);

  const isOpen = lineIndex !== null && lineIndex !== undefined;

  useEffect(() => {
    if (!isOpen) {
      setResults([]);
      setQuery('');
      return;
    }
    let isCurrent = true;
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await window.kadal.items.getAll({ search: query.trim() || undefined });
        if (isCurrent) {
          const list = res?.success ? (res.data || []) : (Array.isArray(res) ? res : []);
          setResults(list.slice(0, 30));
        }
      } catch (e) {
        console.error('Failed to search items:', e);
      } finally {
        if (isCurrent) setLoading(false);
      }
    }, 200);

    return () => {
      isCurrent = false;
      clearTimeout(timer);
    };
  }, [isOpen, query]);

  if (!isOpen) return null;

  return (
    <div
      className="modal-backdrop"
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.65)',
        zIndex,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: 'var(--bg-card, #ffffff)',
          borderRadius: 12,
          width: '100%',
          maxWidth: 680,
          maxHeight: '85vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 20px 25px -5px rgba(0,0,0,0.25)'
        }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Search color="var(--primary)" size={18} />
            Link Inventory Item to Line #{lineIndex + 1}
          </h3>
          <button
            type="button"
            className="btn btn-ghost btn-icon btn-sm"
            onClick={onClose}
          >
            <X size={18} />
          </button>
        </div>

        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)' }}>
          <div style={{ position: 'relative' }}>
            <Search size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input
              type="text"
              autoFocus
              placeholder="Search item by name, code, order or style..."
              value={query}
              onChange={e => setQuery(e.target.value)}
              style={{ width: '100%', padding: '10px 14px 10px 36px', borderRadius: 6, border: '1px solid var(--border)', fontSize: 13, background: 'var(--bg-base)', color: 'inherit' }}
            />
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6 }}>
            Type at least 2 characters to search inventory items quickly.
          </div>
        </div>

        <div style={{ padding: 16, overflowY: 'auto', flex: 1, maxHeight: 400 }}>
          {loading ? (
            <div style={{ padding: 30, textAlign: 'center', color: 'var(--text-muted)' }}>
              <RefreshCw size={20} className="spin" style={{ marginBottom: 6 }} />
              <div>Searching items...</div>
            </div>
          ) : results.length === 0 ? (
            <div style={{ padding: 30, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
              {query.trim().length < 2 ? 'Start typing above to search inventory items...' : 'No matching items found.'}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {results.map(it => (
                <div
                  key={it.id}
                  onClick={() => onSelectItem(lineIndex, it)}
                  style={{
                    padding: '10px 14px',
                    borderRadius: 6,
                    border: '1px solid var(--border)',
                    background: 'var(--bg-base)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    cursor: 'pointer',
                    transition: 'border-color 0.15s'
                  }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--primary)'; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; }}
                >
                  <div style={{ minWidth: 0, flex: 1, marginRight: 12 }}>
                    <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--text-main)', marginBottom: 2 }}>
                      {it.name}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                      <span><strong>Code:</strong> {it.item_code || '-'}</span>
                      {it.order_number && <span><strong>PO (Order):</strong> {it.order_number}</span>}
                      {it.purchase_no && <span><strong>Purchase No:</strong> {it.purchase_no}</span>}
                      {it.style_name && <span><strong>Style:</strong> {it.style_name}</span>}
                      <span><strong>Stock:</strong> {it.current_stock || 0} {it.unit || 'PCS'}</span>
                    </div>
                  </div>
                  <div style={{ textAlign: 'right', display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--primary)' }}>
                      ${Number(it.unit_price || 0).toFixed(4)}
                    </div>
                    <button type="button" className="btn btn-primary btn-sm" style={{ padding: '4px 10px', fontSize: 11 }}>
                      Select
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div style={{ padding: '12px 20px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end' }}>
          <button type="button" className="btn btn-outline btn-sm" onClick={onClose}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

import React, { useEffect, useMemo, useState } from 'react';
import {
  CheckSquare,
  FileText,
  PackageCheck,
  Plus,
  RefreshCw,
  Search,
  X
} from 'lucide-react';
import { normalizeColorValue } from '../../../shared/pi-item-sync.mjs';

/**
 * Shared modal to load accessories from Inventory by Order Number or Purchase Order
 * into a Proforma Invoice (used in both Create PI and Edit PI / Approval Editor).
 */
export default function PiOrderLoaderModal({
  isOpen,
  mode = 'order',
  onModeChange,
  orderNumbers: propOrderNumbers,
  purchaseNumbers: propPurchaseNumbers,
  existingItemIds,
  totalPiItemsCount = 0,
  onAddItems,
  onClose,
  zIndex = 1300
}) {
  const [fetchedOrders, setFetchedOrders] = useState([]);
  const [fetchedPurchases, setFetchedPurchases] = useState([]);
  const [selectedOrderNo, setSelectedOrderNo] = useState('');
  const [selectedPurchaseNo, setSelectedPurchaseNo] = useState('');
  const [filterQuery, setFilterQuery] = useState('');
  const [orderItems, setOrderItems] = useState([]);
  const [loadingOrderItems, setLoadingOrderItems] = useState(false);
  const [selectedIds, setSelectedIds] = useState(new Set());

  const orderNumbers = propOrderNumbers ?? fetchedOrders;
  const purchaseNumbers = propPurchaseNumbers ?? fetchedPurchases;

  // Fetch distinct orders/purchases on demand if not provided by parent
  useEffect(() => {
    if (!isOpen) return;
    if (propOrderNumbers !== undefined && propPurchaseNumbers !== undefined) return;
    let active = true;
    window.kadal.items.getDistinctValues()
      .then(res => {
        if (!active) return;
        const dv = res?.success ? (res.data || {}) : (res || {});
        if (propOrderNumbers === undefined) setFetchedOrders(dv.orders || []);
        if (propPurchaseNumbers === undefined) setFetchedPurchases(dv.purchases || []);
      })
      .catch(err => console.error('Failed to load order/purchase numbers:', err));
    return () => { active = false; };
  }, [isOpen, propOrderNumbers, propPurchaseNumbers]);

  // Reset local selection when modal closes
  useEffect(() => {
    if (!isOpen) {
      setSelectedOrderNo('');
      setSelectedPurchaseNo('');
      setFilterQuery('');
      setOrderItems([]);
      setSelectedIds(new Set());
    }
  }, [isOpen]);

  const activeVal = mode === 'order' ? selectedOrderNo : selectedPurchaseNo;

  // Load items for the selected order or purchase order
  useEffect(() => {
    if (!isOpen || !activeVal) {
      setOrderItems([]);
      return;
    }
    let isCurrent = true;
    setLoadingOrderItems(true);
    const filter = mode === 'order' ? { orderNumber: activeVal } : { purchaseNo: activeVal };

    window.kadal.items.getAll(filter).then(res => {
      if (isCurrent) {
        const items = res?.success ? (res.data || []) : (Array.isArray(res) ? res : []);
        setOrderItems(items);
        setLoadingOrderItems(false);
      }
    }).catch(err => {
      console.error('Failed to load items:', err);
      if (isCurrent) setLoadingOrderItems(false);
    });
    return () => { isCurrent = false; };
  }, [isOpen, mode, activeVal]);

  const visibleList = useMemo(() => {
    const list = mode === 'order' ? orderNumbers : purchaseNumbers;
    if (!filterQuery.trim()) return list;
    const q = filterQuery.toLowerCase().trim();
    return list.filter(o => o && o.toLowerCase().includes(q));
  }, [mode, orderNumbers, purchaseNumbers, filterQuery]);

  if (!isOpen) return null;

  const selectValue = (val) => {
    if (mode === 'order') setSelectedOrderNo(val);
    else setSelectedPurchaseNo(val);
    setSelectedIds(new Set());
  };

  const handleModeSwitch = (nextMode) => {
    if (onModeChange) onModeChange(nextMode);
    setFilterQuery('');
    setSelectedIds(new Set());
  };

  const handleAdd = () => {
    const chosen = orderItems.filter(it => selectedIds.has(it.id));
    if (chosen.length === 0) return;
    onAddItems(chosen, { mode, activeVal, selectedOrderNo, selectedPurchaseNo });
    setSelectedIds(new Set());
  };

  return (
    <div
      className="modal-backdrop"
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0, 0, 0, 0.75)',
        backdropFilter: 'blur(4px)',
        WebkitBackdropFilter: 'blur(4px)',
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
          background: 'var(--bg-surface-solid, #181d28)',
          border: '1px solid var(--border)',
          borderRadius: 12,
          width: '100%',
          maxWidth: 760,
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.7), 0 0 0 1px rgba(255, 255, 255, 0.06)',
          opacity: 1
        }}
        onClick={e => e.stopPropagation()}
      >
        <div
          style={{
            padding: '16px 20px',
            borderBottom: '1px solid var(--border)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            background: 'var(--bg-surface-solid, #181d28)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
              <PackageCheck color="var(--primary)" size={20} />
              Load Items from Order
            </h3>
            {totalPiItemsCount > 0 && (
              <span
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  padding: '2px 8px',
                  borderRadius: 12,
                  background: 'rgba(59, 130, 246, 0.15)',
                  color: '#3b82f6',
                  border: '1px solid rgba(59, 130, 246, 0.3)'
                }}
              >
                {totalPiItemsCount} item(s) in PI
              </span>
            )}
          </div>
          <button
            type="button"
            className="btn btn-ghost btn-icon btn-sm"
            onClick={onClose}
            title="Close"
          >
            <X size={18} />
          </button>
        </div>

        <div style={{ padding: 20, overflowY: 'auto', flex: 1, background: 'var(--bg-surface-solid, #181d28)' }}>
          {/* Mode Switcher */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
            <button
              type="button"
              className={`btn btn-sm ${mode === 'order' ? 'btn-primary' : 'btn-outline'}`}
              onClick={() => handleModeSwitch('order')}
              style={{ display: 'flex', alignItems: 'center', gap: 6 }}
            >
              <PackageCheck size={14} /> By Order Number ({orderNumbers.length})
            </button>
            <button
              type="button"
              className={`btn btn-sm ${mode === 'purchase' ? 'btn-primary' : 'btn-outline'}`}
              onClick={() => handleModeSwitch('purchase')}
              style={{ display: 'flex', alignItems: 'center', gap: 6 }}
            >
              <FileText size={14} /> By Purchase Order ({purchaseNumbers.length})
            </button>
          </div>

          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6 }}>
              {mode === 'order' ? 'Select Order Number (PO)' : 'Select Purchase Order (PO Number)'}
            </label>
            <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
              <div style={{ position: 'relative', flex: 1 }}>
                <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                <input
                  type="text"
                  placeholder={mode === 'order' ? 'Type to filter or enter order number (e.g. 00034689)...' : 'Type to filter or enter purchase order (e.g. KAD#01849/2026)...'}
                  value={filterQuery}
                  onChange={e => setFilterQuery(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter' && filterQuery.trim()) {
                      e.preventDefault();
                      selectValue(filterQuery.trim());
                    }
                  }}
                  style={{ width: '100%', padding: '7px 10px 7px 32px', borderRadius: 6, border: '1px solid var(--border)', fontSize: 12, background: 'var(--bg-base)', color: 'inherit' }}
                />
              </div>
              {filterQuery.trim() && filterQuery.trim() !== activeVal && (
                <button
                  type="button"
                  className="btn btn-outline btn-sm"
                  onClick={() => selectValue(filterQuery.trim())}
                  style={{ fontSize: 12, padding: '4px 10px', whiteSpace: 'nowrap' }}
                  title="Select this directly"
                >
                  Select "{filterQuery.trim()}"
                </button>
              )}
              {filterQuery && (
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={() => setFilterQuery('')}
                  style={{ fontSize: 12, padding: '4px 8px' }}
                >
                  Clear
                </button>
              )}
            </div>

            <select
              value={activeVal}
              onChange={e => selectValue(e.target.value)}
              style={{ width: '100%', padding: '9px 12px', borderRadius: 6, border: '1px solid var(--border)', fontSize: 13, background: 'var(--bg-base)', color: 'inherit' }}
            >
              <option value="">-- Choose {mode === 'order' ? 'an Order Number' : 'a Purchase Order'} ({visibleList.length} available) --</option>
              {activeVal && !visibleList.includes(activeVal) && (
                <option value={activeVal}>{activeVal}</option>
              )}
              {visibleList.map(o => (
                <option key={o} value={o}>{o}</option>
              ))}
            </select>
          </div>

          {loadingOrderItems ? (
            <div style={{ padding: 36, textAlign: 'center', color: 'var(--text-muted)' }}>
              <RefreshCw size={22} className="spin" style={{ marginBottom: 8 }} />
              <div style={{ fontSize: 13 }}>
                Loading accessories for {mode === 'order' ? 'Order' : 'Purchase Order'} {activeVal}...
              </div>
            </div>
          ) : activeVal ? (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <div style={{ fontSize: 13, fontWeight: 600 }}>
                  Items in {mode === 'order' ? 'Order' : 'Purchase Order'}: <span style={{ color: 'var(--primary)' }}>{activeVal}</span> ({orderItems.length})
                </div>
                {orderItems.length > 0 && (
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    onClick={() => {
                      if (selectedIds.size === orderItems.length) {
                        setSelectedIds(new Set());
                      } else {
                        setSelectedIds(new Set(orderItems.map(it => it.id)));
                      }
                    }}
                    style={{ fontSize: 12 }}
                  >
                    {selectedIds.size === orderItems.length ? 'Deselect All' : 'Select All'}
                  </button>
                )}
              </div>

              <div style={{ border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden', background: 'var(--bg-surface-solid, #181d28)' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                  <thead>
                    <tr style={{ background: 'var(--bg-base, rgba(0,0,0,0.15))', borderBottom: '1px solid var(--border)', color: 'var(--text-muted)' }}>
                      <th style={{ padding: '8px 10px', width: 40, textAlign: 'center' }}>
                        <CheckSquare size={14} />
                      </th>
                      <th style={{ padding: '8px 10px', textAlign: 'left' }}>ITEM DESCRIPTION</th>
                      <th style={{ padding: '8px 10px', textAlign: 'left', width: 110 }}>PO (ORDER NO)</th>
                      <th style={{ padding: '8px 10px', textAlign: 'left', width: 110 }}>STYLE NAME</th>
                      <th style={{ padding: '8px 10px', textAlign: 'left', width: 120 }}>PURCHASE NO</th>
                      <th style={{ padding: '8px 10px', textAlign: 'right', width: 85 }}>ORDER QTY</th>
                      <th style={{ padding: '8px 10px', textAlign: 'right', width: 85 }}>UNIT PRICE</th>
                    </tr>
                  </thead>
                  <tbody>
                    {orderItems.length === 0 ? (
                      <tr>
                        <td colSpan={7} style={{ padding: 24, textAlign: 'center', color: 'var(--text-muted)' }}>
                          No items found for {mode === 'order' ? 'order' : 'purchase order'} "{activeVal}".
                        </td>
                      </tr>
                    ) : (
                      orderItems.map(it => {
                        const isAlreadyAdded = existingItemIds?.has(it.id);
                        return (
                          <tr key={it.id} style={{ borderBottom: '1px solid var(--border)', background: isAlreadyAdded ? 'rgba(16, 185, 129, 0.05)' : 'var(--bg-surface-solid, #181d28)' }}>
                            <td style={{ padding: '8px 10px', textAlign: 'center' }}>
                              <input
                                type="checkbox"
                                checked={selectedIds.has(it.id)}
                                onChange={e => {
                                  const next = new Set(selectedIds);
                                  if (e.target.checked) next.add(it.id);
                                  else next.delete(it.id);
                                  setSelectedIds(next);
                                }}
                                style={{ cursor: 'pointer', width: 16, height: 16 }}
                              />
                            </td>
                            <td style={{ padding: '8px 10px', fontWeight: 600 }}>
                              {it.name}
                              {normalizeColorValue(it.color) && (
                                <span style={{ fontSize: 11, color: 'var(--text-secondary)', marginLeft: 6, fontWeight: 500 }}>
                                  (Color: {normalizeColorValue(it.color)})
                                </span>
                              )}
                              {it.item_code && (
                                <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 6, fontWeight: 400 }}>
                                  ({it.item_code})
                                </span>
                              )}
                              {isAlreadyAdded && (
                                <span
                                  style={{
                                    fontSize: 10,
                                    fontWeight: 700,
                                    padding: '1px 6px',
                                    borderRadius: 4,
                                    background: 'rgba(16, 185, 129, 0.15)',
                                    color: '#10b981',
                                    border: '1px solid rgba(16, 185, 129, 0.3)',
                                    marginLeft: 8
                                  }}
                                >
                                  Added
                                </span>
                              )}
                            </td>
                            <td style={{ padding: '8px 10px', color: 'var(--text-primary)', fontWeight: 600 }}>
                              {it.order_number || '-'}
                            </td>
                            <td style={{ padding: '8px 10px', color: 'var(--text-muted)' }}>
                              {it.style_name || '-'}
                            </td>
                            <td style={{ padding: '8px 10px', color: 'var(--text-muted)', fontSize: 11 }}>
                              {it.purchase_no || '-'}
                            </td>
                            <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 600 }}>
                              {Number(it.order_quantity || it.current_stock || 0).toLocaleString()} {it.unit || 'PCS'}
                            </td>
                            <td style={{ padding: '8px 10px', textAlign: 'right', color: 'var(--primary)', fontWeight: 600 }}>
                              ${Number(it.unit_price || 0).toFixed(4)}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div style={{ padding: 30, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
              Please choose {mode === 'order' ? 'an order number' : 'a purchase order'} above to view and select accessories.
            </div>
          )}
        </div>

        <div
          style={{
            padding: '14px 20px',
            borderTop: '1px solid var(--border)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            background: 'var(--bg-surface-solid, #181d28)'
          }}
        >
          <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
            {totalPiItemsCount > 0 ? (
              <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>
                {totalPiItemsCount} item(s) in PI list
              </span>
            ) : (
              <span>Select items from an order and click "Add to PI"</span>
            )}
          </div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleAdd}
              disabled={selectedIds.size === 0}
              style={{ display: 'flex', alignItems: 'center', gap: 6 }}
            >
              <Plus size={16} /> Add to PI ({selectedIds.size})
            </button>
            <button
              type="button"
              className="btn btn-outline"
              onClick={onClose}
              style={{ display: 'flex', alignItems: 'center', gap: 6 }}
            >
              <X size={16} /> Close Modal
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

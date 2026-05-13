import React, { useState } from 'react';
import useStore from '../../store/useStore';
import { Plus, Search, Filter } from 'lucide-react';

export default function IssueBrowserModal({ data }) {
  const { closeModal, setModalMinimized, modal, issueItems, setIssueItems, addToast } = useStore();
  const { items: allItems, distinctValues } = data;
  const isMinimized = modal?.isMinimized;

  const [filters, setFilters] = useState({ search: '', style: '', order: '', purchase: '', buyer: '', category: '', size: '', color: '' });

  const sizes = [...new Set(allItems.map(i => i.size).filter(Boolean))];
  const colors = [...new Set(allItems.map(i => i.color).filter(Boolean))];
  const buyers = [...new Set(allItems.map(i => i.buyer_name).filter(Boolean))];
  const categories = [...new Set(allItems.map(i => i.category_name).filter(Boolean))];

  const filteredItems = allItems.filter(it => {
    const s = filters.search.toLowerCase();
    const matchSearch = !s || it.name.toLowerCase().includes(s) || it.item_code.toLowerCase().includes(s) || (it.buyer_name || '').toLowerCase().includes(s);
    const matchStyle = !filters.style || it.style_name === filters.style;
    const matchOrder = !filters.order || it.order_number === filters.order;
    const matchPurchase = !filters.purchase || it.purchase_no === filters.purchase;
    const matchBuyer = !filters.buyer || it.buyer_name === filters.buyer;
    const matchCategory = !filters.category || it.category_name === filters.category;
    const matchSize = !filters.size || it.size === filters.size;
    const matchColor = !filters.color || it.color === filters.color;
    return matchSearch && matchStyle && matchOrder && matchPurchase && matchBuyer && matchCategory && matchSize && matchColor;
  });

  const addItem = (item) => {
    if (item.current_stock <= 0) return addToast('error', `"${item.name}" has no stock`);
    if (issueItems.some(i => i.itemId === item.id)) return addToast('warning', 'Already added');
    setIssueItems([...issueItems, {
      itemId: item.id, name: item.name, itemCode: item.item_code,
      size: item.size, color: item.color, unit: item.unit, currentStock: item.current_stock,
      styleNo: item.style_name || '', purchaseNo: item.purchase_no || '',
      orderNumber: item.order_number || '', buyerName: item.buyer_name || '',
      orderQuantity: item.order_quantity || 0,
      quantity: 1, notes: '',
    }]);
    addToast('success', `Added ${item.name}`);
  };

  const clearFilters = () => setFilters({ search: '', style: '', order: '', purchase: '', buyer: '', category: '', size: '', color: '' });
  const hasFilters = Object.values(filters).some(v => v);

  return (
    <div className={`modal-overlay ${isMinimized ? 'minimized-mode' : ''}`}>
      <div className={`modal modal-lg ${isMinimized ? 'minimized' : ''}`} onClick={e => e.stopPropagation()} style={{ maxWidth: 1280, width: '105vw' }}>
        <div className="modal-header">
          <h3 className="modal-title">Browse Inventory — Select Items for Issue</h3>
          <div className="modal-controls">
            <button className="btn-control btn-minimize" onClick={() => setModalMinimized(!isMinimized)} title={isMinimized ? 'Restore' : 'Minimize'}>{isMinimized ? '+' : '-'}</button>
            <button className="btn-control btn-close" onClick={closeModal} title="Close">✕</button>
          </div>
        </div>
        <div className="modal-body">
          {/* Search bar */}
          <div className="search-bar mb-3" style={{ maxWidth: '100%' }}>
            <Search size={16} />
            <input className="form-input" placeholder="Search by name, code, or buyer..." value={filters.search} onChange={e => setFilters({ ...filters, search: e.target.value })} style={{ fontSize: 14 }} />
          </div>
          {/* Filter row */}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
            <select className="form-select" value={filters.category} onChange={e => setFilters({ ...filters, category: e.target.value })} style={{ width: 130, fontSize: 12 }}>
              <option value="">All Categories</option>
              {categories.map((v, i) => <option key={i} value={v}>{v}</option>)}
            </select>
            <select className="form-select" value={filters.buyer} onChange={e => setFilters({ ...filters, buyer: e.target.value })} style={{ width: 130, fontSize: 12 }}>
              <option value="">All Buyers</option>
              {buyers.map((v, i) => <option key={i} value={v}>{v}</option>)}
            </select>
            <select className="form-select" value={filters.style} onChange={e => setFilters({ ...filters, style: e.target.value })} style={{ width: 130, fontSize: 12 }}>
              <option value="">All Styles</option>
              {(distinctValues.styles || []).map((v, i) => <option key={i} value={v}>{v}</option>)}
            </select>
            <select className="form-select" value={filters.order} onChange={e => setFilters({ ...filters, order: e.target.value })} style={{ width: 130, fontSize: 12 }}>
              <option value="">All Orders</option>
              {(distinctValues.orders || []).map((v, i) => <option key={i} value={v}>{v}</option>)}
            </select>
            <select className="form-select" value={filters.size} onChange={e => setFilters({ ...filters, size: e.target.value })} style={{ width: 110, fontSize: 12 }}>
              <option value="">All Sizes</option>
              {sizes.map((v, i) => <option key={i} value={v}>{v}</option>)}
            </select>
            <select className="form-select" value={filters.color} onChange={e => setFilters({ ...filters, color: e.target.value })} style={{ width: 110, fontSize: 12 }}>
              <option value="">All Colors</option>
              {colors.map((v, i) => <option key={i} value={v}>{v}</option>)}
            </select>
            {hasFilters && <button className="btn btn-ghost btn-sm" onClick={clearFilters} style={{ fontSize: 11 }}>✕ Clear</button>}
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 8 }}>Showing {filteredItems.length} of {allItems.length} items • {issueItems.length} selected</div>
          {/* Table */}
          <div className="table-wrapper" style={{ maxHeight: 380 }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Item Details</th>
                  <th>Category</th>
                  <th>Buyer</th>
                  <th>Style</th>
                  <th>Order No</th>
                  <th>Purchase</th>
                  <th style={{ textAlign: 'right' }}>Order Qty</th>
                  <th style={{ textAlign: 'right' }}>Stock</th>
                  <th>Unit</th>
                  <th style={{ width: 70 }}></th>
                </tr>
              </thead>
              <tbody>
                {filteredItems.length === 0 && <tr><td colSpan={10} className="text-center text-muted" style={{ padding: 30 }}>No items match your filters</td></tr>}
                {filteredItems.map(item => {
                  const added = issueItems.some(i => i.itemId === item.id);
                  return (
                    <tr key={item.id} style={{ opacity: added ? 0.5 : 1 }}>
                      <td>
                        <div style={{ fontWeight: 600, fontSize: 13 }}>{item.name}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{item.item_code}{item.size ? ` | ${item.size}` : ''}{item.color ? ` | ${item.color}` : ''}</div>
                      </td>
                      <td style={{ fontSize: 12 }}>{item.category_name || '-'}</td>
                      <td style={{ fontSize: 12 }}>{item.buyer_name || '-'}</td>
                      <td style={{ fontSize: 12 }}>{item.style_name || '-'}</td>
                      <td style={{ fontSize: 12 }}>{item.order_number || '-'}</td>
                      <td style={{ fontSize: 12 }}>{item.purchase_no || '-'}</td>
                      <td className="text-right text-mono" style={{ fontSize: 12 }}>{item.order_quantity || '-'}</td>
                      <td className="text-right text-mono fw-bold" style={{ color: item.current_stock <= 0 ? 'var(--danger)' : item.current_stock <= (item.min_stock_level || 5) ? 'var(--warning)' : 'var(--success)' }}>
                        {item.current_stock}
                      </td>
                      <td style={{ fontSize: 12 }}>{item.unit}</td>
                      <td>
                        <button className="btn btn-outline btn-sm" onClick={() => addItem(item)} disabled={item.current_stock <= 0 || added} style={{ fontSize: 11 }}>
                          {added ? '✓' : <><Plus size={12} /> Add</>}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
        <div className="modal-footer">
          <span className="text-muted" style={{ fontSize: 13 }}>{issueItems.length} items selected</span>
          <button className="btn btn-primary" onClick={closeModal}>Done</button>
        </div>
      </div>
    </div>
  );
}

import React, { useState } from 'react';
import useStore from '../../store/useStore';
import { Search, CheckCircle } from 'lucide-react';

export default function TargetProductBrowserModal({ data }) {
  const { closeModal, setModalMinimized, modal, addToast } = useStore();
  const { items: allItems, onSelect, initialSelectedIds = [] } = data;
  const isMinimized = modal?.isMinimized;

  const [selectedIds, setSelectedIds] = useState(initialSelectedIds);
  const [filters, setFilters] = useState({ search: '', buyer: '', category: '', size: '', color: '', style: '', purchaseNo: '', orderNumber: '' });

  const sizes = [...new Set(allItems.map(i => i.size).filter(Boolean))];
  const colors = [...new Set(allItems.map(i => i.color).filter(Boolean))];
  const buyers = [...new Set(allItems.map(i => i.buyer_name).filter(Boolean))];
  const categories = [...new Set(allItems.map(i => i.category_name).filter(Boolean))];
  const styles = [...new Set(allItems.map(i => i.style_name).filter(Boolean))];
  const purchases = [...new Set(allItems.map(i => i.purchase_no).filter(Boolean))];
  const orders = [...new Set(allItems.map(i => i.order_number).filter(Boolean))];

  const filteredItems = allItems.filter(it => {
    const s = filters.search.toLowerCase();
    const matchSearch = !s || 
      it.name.toLowerCase().includes(s) || 
      it.item_code.toLowerCase().includes(s) || 
      (it.buyer_name || '').toLowerCase().includes(s) ||
      (it.purchase_no || '').toLowerCase().includes(s) ||
      (it.order_number || '').toLowerCase().includes(s) ||
      (it.style_name || '').toLowerCase().includes(s);
      
    const matchBuyer = !filters.buyer || it.buyer_name === filters.buyer;
    const matchCategory = !filters.category || it.category_name === filters.category;
    const matchSize = !filters.size || it.size === filters.size;
    const matchColor = !filters.color || it.color === filters.color;
    const matchStyle = !filters.style || it.style_name === filters.style;
    const matchPurchase = !filters.purchaseNo || it.purchase_no === filters.purchaseNo;
    const matchOrder = !filters.orderNumber || it.order_number === filters.orderNumber;
    return matchSearch && matchBuyer && matchCategory && matchSize && matchColor && matchStyle && matchPurchase && matchOrder;
  });

  const selectProduct = (item) => {
    if (!selectedIds.includes(item.id)) {
      setSelectedIds([...selectedIds, item.id]);
    }
    if (onSelect) onSelect(item);
    addToast('success', `Added "${item.name}" as target product`);
  };

  const clearFilters = () => setFilters({ search: '', buyer: '', category: '', size: '', color: '', style: '', purchaseNo: '', orderNumber: '' });
  const hasFilters = Object.values(filters).some(v => v);

  return (
    <div className={`modal-overlay ${isMinimized ? 'minimized-mode' : ''}`}>
      <div className={`modal modal-lg ${isMinimized ? 'minimized' : ''}`} onClick={e => e.stopPropagation()} style={{ maxWidth: 1100, width: '95vw' }}>
        <div className="modal-header">
          <h3 className="modal-title">Browse Inventory — Select Target Finished Product(s)</h3>
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
              {styles.map((v, i) => <option key={i} value={v}>{v}</option>)}
            </select>
            <select className="form-select" value={filters.purchaseNo} onChange={e => setFilters({ ...filters, purchaseNo: e.target.value })} style={{ width: 130, fontSize: 12 }}>
              <option value="">All Purchases</option>
              {purchases.map((v, i) => <option key={i} value={v}>{v}</option>)}
            </select>
            <select className="form-select" value={filters.orderNumber} onChange={e => setFilters({ ...filters, orderNumber: e.target.value })} style={{ width: 130, fontSize: 12 }}>
              <option value="">All Orders</option>
              {orders.map((v, i) => <option key={i} value={v}>{v}</option>)}
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
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 8 }}>Showing {filteredItems.length} of {allItems.length} items</div>
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
                  <th style={{ textAlign: 'right' }}>Order Qty</th>
                  <th style={{ textAlign: 'right' }}>Stock</th>
                  <th>Unit</th>
                  <th style={{ width: 100 }}></th>
                </tr>
              </thead>
              <tbody>
                {filteredItems.length === 0 && <tr><td colSpan={9} className="text-center text-muted" style={{ padding: 30 }}>No items match your filters</td></tr>}
                {filteredItems.map(item => {
                  const isAdded = selectedIds.includes(item.id);
                  return (
                    <tr key={item.id}>
                      <td>
                        <div style={{ fontWeight: 600, fontSize: 13 }}>{item.name}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{item.item_code}{item.size ? ` | ${item.size}` : ''}{item.color ? ` | ${item.color}` : ''}</div>
                      </td>
                      <td style={{ fontSize: 12 }}>{item.category_name || '-'}</td>
                      <td style={{ fontSize: 12 }}>{item.buyer_name || '-'}</td>
                      <td style={{ fontSize: 12 }}>{item.style_name || '-'}</td>
                      <td style={{ fontSize: 12 }}>{item.order_number || '-'}</td>
                      <td className="text-right text-mono" style={{ fontSize: 12 }}>{item.order_quantity || '-'}</td>
                      <td className="text-right text-mono fw-bold" style={{ color: item.current_stock <= 0 ? 'var(--danger)' : item.current_stock <= (item.min_stock_level || 5) ? 'var(--warning)' : 'var(--success)' }}>
                        {item.current_stock}
                      </td>
                      <td style={{ fontSize: 12 }}>{item.unit}</td>
                      <td>
                        <button 
                          className={`btn btn-sm ${isAdded ? 'btn-primary' : 'btn-outline'}`} 
                          onClick={() => selectProduct(item)} 
                          style={{ fontSize: 11 }}
                        >
                          <CheckCircle size={12} /> {isAdded ? 'Added ✓' : 'Add'}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
        <div className="modal-footer" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span className="text-muted" style={{ fontSize: 13 }}>
            {selectedIds.length > 0 ? `${selectedIds.length} target product(s) linked to issue` : 'Click "Add" on any finished products to link them to this issue'}
          </span>
          <button className="btn btn-primary" onClick={closeModal}>Done</button>
        </div>
      </div>
    </div>
  );
}

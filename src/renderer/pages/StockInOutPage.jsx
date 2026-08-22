import React, { useState, useCallback, useRef } from 'react';
import useStore from '../store/useStore';
import { Search, ArrowDownCircle, ArrowUpCircle, Package, ArrowUpDown, ArrowUp, ArrowDown, Clock, FileText } from 'lucide-react';

export default function StockInOutPage() {
  const { addToast, user, openModal } = useStore();
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  const selectedItemRef = useRef(null);
  const [transactions, setTransactions] = useState([]);
  const [txLoading, setTxLoading] = useState(false);
  const [sortConfig, setSortConfig] = useState({ key: 'name', direction: 'asc' });
  const searchRef = useRef('');

  const handleSort = (key) => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  const sortedItems = [...items].sort((a, b) => {
    if (!sortConfig.key) return 0;
    let valA = a[sortConfig.key];
    let valB = b[sortConfig.key];
    if (['current_stock', 'order_quantity'].includes(sortConfig.key)) {
      valA = Number(valA) || 0;
      valB = Number(valB) || 0;
    } else {
      valA = (valA || '').toString().toLowerCase();
      valB = (valB || '').toString().toLowerCase();
    }
    if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
    if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
    return 0;
  });

  const SortHeader = ({ label, field, className = "" }) => (
    <th className={`sortable ${className}`} onClick={() => handleSort(field)}>
      <div className="flex items-center justify-between">
        {label}
        <span className={`sort-icon-container ${sortConfig.key === field ? 'active' : ''}`}>
          {sortConfig.key !== field ? <ArrowUpDown size={12} /> :
           sortConfig.direction === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />}
        </span>
      </div>
    </th>
  );

  const searchItems = useCallback(async (query) => {
    if (!query || query.trim().length === 0) {
      setItems([]);
      setHasSearched(false);
      setSelectedItem(null);
      selectedItemRef.current = null;
      setTransactions([]);
      return;
    }
    setLoading(true);
    setHasSearched(true);
    setSelectedItem(null);
    selectedItemRef.current = null;
    setTransactions([]);
    try {
      const res = await window.kadal.items.getAll({ search: query.trim() });
      if (res.success) {
        setItems(res.data);
        // Auto-select the first item and load its transactions
        if (res.data.length > 0) {
          const firstItem = res.data[0];
          setSelectedItem(firstItem);
          selectedItemRef.current = firstItem;
          // Load transactions for the first item
          setTxLoading(true);
          try {
            const txRes = await window.kadal.stock.getTransactions({ itemId: firstItem.id });
            if (txRes?.success) setTransactions(txRes.data || []);
          } catch (e) {
            console.error('Failed to load transactions:', e);
          }
          setTxLoading(false);
        }
      }
      else addToast('error', res.error);
    } catch (e) {
      addToast('error', 'Failed to search items');
    }
    setLoading(false);
  }, [addToast]);

  const handleSearch = (e) => {
    e.preventDefault();
    setSearch(searchInput);
    searchRef.current = searchInput;
    searchItems(searchInput);
  };

  const loadTransactions = useCallback(async (item) => {
    setTxLoading(true);
    try {
      const [txRes, itemRes] = await Promise.all([
        window.kadal.stock.getTransactions({ itemId: item.id }),
        window.kadal.items.getById(item.id),
      ]);
      if (txRes?.success) setTransactions(txRes.data || []);
      if (itemRes?.success) {
        // Merge fresh data with original item to preserve all fields from getAll
        const mergedItem = { ...item, ...itemRes.data };
        setSelectedItem(mergedItem);
        selectedItemRef.current = mergedItem;
        // Also update the item in the search results list
        setItems(prev => prev.map(i => i.id === item.id ? { ...i, current_stock: itemRes.data.current_stock } : i));
      }
    } catch (e) {
      addToast('error', 'Failed to load transactions');
    }
    setTxLoading(false);
  }, [addToast]);

  const handleSelectItem = (item) => {
    setSelectedItem(item);
    selectedItemRef.current = item;
    loadTransactions(item);
  };

  const handleStockAction = (targetItem, type) => {
    const item = targetItem || selectedItemRef.current;
    if (item) {
      setSelectedItem(item);
      selectedItemRef.current = item;
    }
    openModal('STOCK_MOVEMENT', {
      item,
      type,
      onSaved: (updatedItem) => {
        const target = updatedItem || selectedItemRef.current;
        if (target) loadTransactions(target);
        const currentSearch = searchRef.current;
        if (currentSearch) searchItems(currentSearch);
      }
    });
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) + 
           ' ' + d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="stock-inout-page">
      {/* Search Section */}
      <div className="toolbar">
        <div className="toolbar-left" style={{ flex: 1 }}>
          <form onSubmit={handleSearch} style={{ display: 'flex', gap: 8, flex: 1 }}>
            <div className="search-bar" style={{ flex: 1, maxWidth: 600 }}>
              <Search />
              <input
                className="form-input"
                placeholder="Search by item code, name, style no, order no, purchase no, color, size..."
                value={searchInput}
                onChange={e => setSearchInput(e.target.value)}
                autoFocus
              />
            </div>
            <button type="submit" className="btn btn-primary">Search</button>
          </form>
        </div>
        <div className="toolbar-right">
          {user?.permissions?.inventory === 'rw' && (
            <button className="btn btn-success" onClick={() => handleStockAction(selectedItem, 'IN')}>
              <ArrowDownCircle size={16} /> Stock IN
            </button>
          )}
        </div>
      </div>

      <div className="stock-inout-container">
        {/* Left Panel — Search Results */}
        <div className="stock-inout-results">
          {loading ? (
            <div className="loading"><div className="spinner"></div></div>
          ) : !hasSearched ? (
            <div className="empty-state">
              <Search size={48} strokeWidth={1} />
              <h3>Search for items</h3>
              <p>Enter item code, name, size, color, style, order, or purchase number to find items and manage stock movements</p>
            </div>
          ) : items.length === 0 ? (
            <div className="empty-state">
              <Package size={48} strokeWidth={1} />
              <h3>No items found</h3>
              <p>Try a different search term</p>
            </div>
          ) : (
            <div className="table-wrapper">
              <table className="data-table">
                <thead>
                  <tr>
                    <SortHeader label="Code" field="item_code" />
                    <SortHeader label="Item Name" field="name" />
                    <SortHeader label="Size" field="size" />
                    <SortHeader label="Color" field="color" />
                    <SortHeader label="Style" field="style_name" />
                    <SortHeader label="Order No" field="order_number" />
                    <SortHeader label="Purchase" field="purchase_no" />
                    <SortHeader label="Stock" field="current_stock" className="text-right" />
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedItems.map(item => (
                    <tr
                      key={item.id}
                      className={selectedItem?.id === item.id ? 'row-selected' : ''}
                      onClick={() => handleSelectItem(item)}
                      style={{ cursor: 'pointer' }}
                    >
                      <td className="text-mono" style={{ fontSize: 12, color: 'var(--accent)' }}>{item.item_code}</td>
                      <td style={{ fontWeight: 600 }}>
                        <div>{item.name}</div>
                        {(item.size || item.color) && (
                          <div className="text-muted" style={{ fontSize: 11, fontWeight: 400 }}>
                            {[item.size, item.color].filter(Boolean).join(' / ')}
                          </div>
                        )}
                      </td>
                      <td style={{ fontSize: 13 }}>{item.size || '-'}</td>
                      <td style={{ fontSize: 13 }}>{item.color || '-'}</td>
                      <td style={{ fontSize: 13 }}>{item.style_name || '-'}</td>
                      <td style={{ fontSize: 13 }}>{item.order_number || '-'}</td>
                      <td style={{ fontSize: 13 }}>{item.purchase_no || '-'}</td>
                      <td className="text-right text-mono fw-bold" style={{ color: item.current_stock <= item.min_stock_level && item.min_stock_level > 0 ? 'var(--danger)' : 'var(--success)' }}>
                        {item.current_stock} {item.unit}
                      </td>
                      <td>
                        <div className="table-actions" onClick={e => e.stopPropagation()} style={{ display: 'flex', gap: 6 }}>
                          {user?.permissions?.inventory === 'rw' && (
                            <button className="btn btn-success btn-xs" title="Stock IN" onClick={() => handleStockAction(item, 'IN')}>
                              <ArrowDownCircle size={13} /> Stock IN
                            </button>
                          )}
                          {user?.permissions?.inventory === 'rw' && user?.roleName !== 'Inventory' && (
                            <button className="btn btn-warning btn-xs" title="Stock OUT" onClick={() => handleStockAction(item, 'OUT')}>
                              <ArrowUpCircle size={13} /> Stock OUT
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Right Panel — Item Details & Transaction History */}
        {selectedItem && (
          <div className="stock-inout-detail">
            {/* Item Info Card */}
            <div className="stock-detail-card">
              <div className="stock-detail-header">
                <div>
                  <h3 style={{ margin: 0, fontSize: 16 }}>{selectedItem.name}</h3>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 2 }}>
                    <span className="text-mono" style={{ fontSize: 12, color: 'var(--accent)' }}>{selectedItem.item_code}</span>
                    {(selectedItem.size || selectedItem.color) && (
                      <span className="badge badge-info" style={{ fontSize: 11 }}>
                        {[selectedItem.size, selectedItem.color].filter(Boolean).join(' / ')}
                      </span>
                    )}
                  </div>
                </div>
                <div className="stock-detail-actions">
                  {user?.permissions?.inventory === 'rw' && (
                    <button className="btn btn-success btn-sm" onClick={() => handleStockAction(selectedItem, 'IN')}>
                      <ArrowDownCircle size={14} /> Stock IN
                    </button>
                  )}
                  {user?.permissions?.inventory === 'rw' && user?.roleName !== 'Inventory' && (
                    <button className="btn btn-warning btn-sm" onClick={() => handleStockAction(selectedItem, 'OUT')}>
                      <ArrowUpCircle size={14} /> Stock OUT
                    </button>
                  )}
                </div>
              </div>
              <div className="stock-detail-meta">
                <div className="meta-item">
                  <span className="meta-label">Current Stock</span>
                  <span className="meta-value fw-bold" style={{ color: 'var(--success)', fontSize: 18 }}>{selectedItem.current_stock} {selectedItem.unit}</span>
                </div>
                <div className="meta-item">
                  <span className="meta-label">Order Qty</span>
                  <span className="meta-value fw-bold" style={{ fontSize: 16 }}>{selectedItem.order_quantity || '-'} {selectedItem.order_quantity ? selectedItem.unit : ''}</span>
                </div>
                {selectedItem.style_name && (
                  <div className="meta-item">
                    <span className="meta-label">Style</span>
                    <span className="meta-value">{selectedItem.style_name}</span>
                  </div>
                )}
                {selectedItem.order_number && (
                  <div className="meta-item">
                    <span className="meta-label">Order No</span>
                    <span className="meta-value">{selectedItem.order_number}</span>
                  </div>
                )}
                {selectedItem.purchase_no && (
                  <div className="meta-item">
                    <span className="meta-label">Purchase No</span>
                    <span className="meta-value">{selectedItem.purchase_no}</span>
                  </div>
                )}
                {selectedItem.size && (
                  <div className="meta-item">
                    <span className="meta-label">Size</span>
                    <span className="meta-value">{selectedItem.size}</span>
                  </div>
                )}
                {selectedItem.color && (
                  <div className="meta-item">
                    <span className="meta-label">Color</span>
                    <span className="meta-value">{selectedItem.color}</span>
                  </div>
                )}
                {selectedItem.category_name && (
                  <div className="meta-item">
                    <span className="meta-label">Category</span>
                    <span className="meta-value"><span className="badge badge-info">{selectedItem.category_name}</span></span>
                  </div>
                )}
              </div>
            </div>

            {/* Transaction History */}
            <div className="stock-transactions-section">
              <div className="section-header">
                <h4 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Clock size={16} /> Movement History
                </h4>
                <span className="text-muted" style={{ fontSize: 12 }}>{transactions.length} transactions</span>
              </div>
              {txLoading ? (
                <div className="loading" style={{ padding: 40 }}><div className="spinner"></div></div>
              ) : transactions.length === 0 ? (
                <div className="empty-state" style={{ padding: '32px 16px' }}>
                  <FileText size={36} strokeWidth={1} />
                  <h3 style={{ fontSize: 14 }}>No transactions yet</h3>
                  <p style={{ fontSize: 12 }}>Stock movements will appear here</p>
                </div>
              ) : (
                <div className="table-wrapper" style={{ maxHeight: 'calc(100vh - 400px)' }}>
                  <table className="data-table data-table-compact">
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th>Type</th>
                        <th className="text-right">Qty</th>
                        <th className="text-right">Before</th>
                        <th className="text-right">After</th>
                        <th>Reference</th>
                        <th>Notes</th>
                        <th>By</th>
                      </tr>
                    </thead>
                    <tbody>
                      {transactions.map(tx => (
                        <tr key={tx.id}>
                          <td style={{ fontSize: 12, whiteSpace: 'nowrap' }}>{formatDate(tx.created_at)}</td>
                          <td>
                            <span className={`badge ${tx.type === 'IN' ? 'badge-success' : tx.type === 'OUT' ? 'badge-warning' : 'badge-info'}`}>
                              {tx.type}
                            </span>
                          </td>
                          <td className="text-right text-mono fw-bold">{tx.quantity}</td>
                          <td className="text-right text-mono" style={{ color: 'var(--text-muted)' }}>{tx.stock_before}</td>
                          <td className="text-right text-mono">{tx.stock_after}</td>
                          <td style={{ fontSize: 12 }}>{tx.reference || '-'}</td>
                          <td style={{ fontSize: 12 }}>{tx.notes || '-'}</td>
                          <td style={{ fontSize: 12 }}>{tx.created_by_name || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

import React, { useEffect, useState, useCallback } from 'react';
import useStore from '../store/useStore';
import { Plus, Search, Package, ArrowUpDown, ArrowUp, ArrowDown, Printer, Edit2, Trash2 } from 'lucide-react';

export default function InventoryPage() {
  const { addToast, showConfirm, categories, setCategories, setSuppliers, setUnits, user, openModal } = useStore();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [catFilter, setCatFilter] = useState('');
  const [styleFilter, setStyleFilter] = useState('');
  const [orderFilter, setOrderFilter] = useState('');
  const [purchaseFilter, setPurchaseFilter] = useState('');
  const [buyers, setBuyers] = useState([]);

  const [distinctValues, setDistinctValues] = useState({ names: [], colors: [], sizes: [], styles: [], purchases: [] });
  const [sortConfig, setSortConfig] = useState({ key: 'name', direction: 'asc' });

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
    
    // Numeric sort for stock and qty
    if (['current_stock', 'order_quantity', 'min_stock_level', 'unit_price'].includes(sortConfig.key)) {
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
    <th 
      className={`sortable ${className}`} 
      onClick={() => handleSort(field)}
    >
      <div className="flex items-center justify-between">
        {label}
        <span className={`sort-icon-container ${sortConfig.key === field ? 'active' : ''}`}>
          {sortConfig.key !== field ? <ArrowUpDown size={12} /> : 
           sortConfig.direction === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />}
        </span>
      </div>
    </th>
  );

  // Load filter dropdowns on mount
  useEffect(() => {
    const loadFilters = async () => {
      try {
        const [catsRes, dvRes, buyersRes, suppRes, unitsRes] = await Promise.all([
          window.kadal.categories.getAll(),
          window.kadal.items.getDistinctValues(),
          window.kadal.buyers.getAll(),
          window.kadal.suppliers.getAll(),
          window.kadal.units.getAll(),
        ]);
        if (catsRes.success) setCategories(catsRes.data);
        if (dvRes.success) setDistinctValues(dvRes.data);
        if (buyersRes.success) setBuyers(buyersRes.data);
        if (suppRes.success) setSuppliers(suppRes.data);
        if (unitsRes.success) setUnits(unitsRes.data);
      } catch (e) { /* silent */ }
    };
    loadFilters();
  }, []);

  const loadData = useCallback(async () => {
    // Only search when user has entered a query or selected a filter
    const hasFilters = search || catFilter || styleFilter || orderFilter || purchaseFilter;
    if (!hasFilters) {
      setItems([]);
      setHasSearched(false);
      return;
    }
    setLoading(true);
    setHasSearched(true);
    try {
      const itemsRes = await window.kadal.items.getAll({ search, categoryId: catFilter || undefined, styleName: styleFilter || undefined, orderNumber: orderFilter || undefined, purchaseNo: purchaseFilter || undefined });
      if (itemsRes.success) setItems(itemsRes.data);
    } catch (e) { addToast('error', 'Failed to load data'); }
    setLoading(false);
  }, [search, catFilter, styleFilter, orderFilter, purchaseFilter]);

  // Re-search when filters change (but only if a search has been done or a filter is selected)
  useEffect(() => {
    if (search || catFilter || styleFilter || orderFilter || purchaseFilter) {
      loadData();
    }
  }, [catFilter, styleFilter, orderFilter, purchaseFilter, search]);

  const handleSearch = (e) => {
    e.preventDefault();
    setSearch(searchInput);
    if (!searchInput && !catFilter && !styleFilter && !orderFilter && !purchaseFilter) {
      setItems([]);
      setHasSearched(false);
      return;
    }
    setHasSearched(true);
    loadData();
  };

  const handleDelete = async (item) => {
    const confirmed = await showConfirm({ title: 'Delete Item', message: `Are you sure you want to delete "${item.name}"? This action cannot be undone.`, type: 'danger', confirmText: 'Delete' });
    if (!confirmed) return;
    const res = await window.kadal.items.delete(item.id);
    if (res.success) { addToast('success', 'Item deleted'); loadData(); }
    else addToast('error', res.error);
  };

  return (
    <div>
      <div className="toolbar">
        <div className="toolbar-left" style={{ flex: 1 }}>
          <form onSubmit={handleSearch} style={{ display: 'flex', gap: 8, alignItems: 'center', flex: 1 }}>
            <div className="search-bar" style={{ flex: 1, maxWidth: 400 }}>
              <Search />
              <input className="form-input" placeholder="Search name, code, style, order, purchase..." value={searchInput} onChange={e => setSearchInput(e.target.value)} />
            </div>
            <button type="submit" className="btn btn-primary">Search</button>
          </form>
          <select className="form-select" value={catFilter} onChange={e => setCatFilter(e.target.value)} style={{ width: 'auto', minWidth: 150, padding: '8px 32px 8px 12px', fontSize: 13 }}>
            <option value="">All Categories</option>
            {categories.filter(c=>c.is_active).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <select className="form-select" value={styleFilter} onChange={e => setStyleFilter(e.target.value)} style={{ width: 'auto', minWidth: 120, padding: '8px 32px 8px 12px', fontSize: 13 }}>
            <option value="">All Styles</option>
            {distinctValues.styles.map((v, i) => <option key={i} value={v}>{v}</option>)}
          </select>
          <select className="form-select" value={orderFilter} onChange={e => setOrderFilter(e.target.value)} style={{ width: 'auto', minWidth: 120, padding: '8px 32px 8px 12px', fontSize: 13 }}>
            <option value="">All Orders</option>
            {distinctValues.orders?.map((v, i) => <option key={i} value={v}>{v}</option>)}
          </select>
          <select className="form-select" value={purchaseFilter} onChange={e => setPurchaseFilter(e.target.value)} style={{ width: 'auto', minWidth: 120, padding: '8px 32px 8px 12px', fontSize: 13 }}>
            <option value="">All Purchase No</option>
            {distinctValues.purchases.map((v, i) => <option key={i} value={v}>{v}</option>)}
          </select>
        </div>
        <div className="toolbar-right">
          {user?.permissions?.inventory === 'rw' && (
            <button className="btn btn-primary" onClick={() => openModal('ITEM_FORM', { buyers, distinctValues, onSaved: loadData })}><Plus size={16} /> Add Item</button>
          )}
        </div>
      </div>

      {loading ? <div className="loading"><div className="spinner"></div></div> : !hasSearched ? (
        <div className="empty-state">
          <Search size={48} strokeWidth={1} />
          <h3>Search for items to view inventory</h3>
          <p>Use the search bar or filters above to find items and check their current stock levels</p>
        </div>
      ) : items.length === 0 ? (
        <div className="empty-state"><Package size={48} /><h3>No items found</h3><p>Try a different search term or filter</p></div>
      ) : (
        <div className="table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <SortHeader label="Code" field="item_code" />
                <SortHeader label="Item Name" field="name" />
                <SortHeader label="Order No" field="order_number" />
                <SortHeader label="Category" field="category_name" />
                <SortHeader label="Size" field="size" />
                <SortHeader label="Color" field="color" />
                <SortHeader label="Order Qty" field="order_quantity" className="text-right" />
                <SortHeader label="Stock" field="current_stock" className="text-right" />
                <th className="text-right">Total Value</th>
                <SortHeader label="Unit" field="unit" />
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {sortedItems.map(item => (
                <tr key={item.id}>
                  <td className="text-mono" style={{ fontSize: 12, color: 'var(--accent)' }}>{item.item_code}</td>
                  <td style={{ fontWeight: 600 }}>{item.name}</td>
                  <td style={{ fontSize: 13 }}>{item.order_number || '-'}</td>
                  <td><span className="badge badge-info">{item.category_name || '-'}</span></td>
                  <td>{item.size || '-'}</td>
                  <td>{item.color || '-'}</td>
                  <td className="text-right text-mono">{item.order_quantity || '-'}</td>
                  <td className="text-right text-mono fw-bold" style={{ color: item.current_stock <= item.min_stock_level && item.min_stock_level > 0 ? 'var(--danger)' : 'var(--success)' }}>
                    {item.current_stock}
                  </td>
                  <td className="text-right text-mono">{item.currency === 'USD' ? '$' : '৳'}{Number((item.current_stock * (item.unit_price || 0))).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td>
                  <td style={{ color: 'var(--text-muted)' }}>{item.unit}</td>
                  <td>
                    <div className="table-actions">
                      <button className="btn btn-ghost btn-icon btn-sm" title="Print Barcode" onClick={() => openModal('BARCODE', item)}><Printer size={15} color="var(--text-color)" /></button>
                      {(user?.roleName === 'Admin' || user?.roleName === 'Super Admin') && (
                        <button className="btn btn-ghost btn-icon btn-sm" title="Edit" onClick={() => openModal('ITEM_FORM', { item, buyers, distinctValues, onSaved: loadData })}><Edit2 size={15} /></button>
                      )}
                      {user?.roleName === 'Super Admin' && (
                        <button className="btn btn-ghost btn-icon btn-sm" title="Delete" onClick={() => handleDelete(item)}><Trash2 size={15} color="var(--danger)" /></button>
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
  );
}

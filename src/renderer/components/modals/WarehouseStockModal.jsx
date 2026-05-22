import React, { useState, useEffect } from 'react';
import { X, Search, Package } from 'lucide-react';
import useStore from '../../store/useStore';

export default function WarehouseStockModal({ isOpen, onClose, warehouse }) {
  const { addToast } = useStore();
  const [stockList, setStockList] = useState([]);
  const [items, setItems] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isOpen && warehouse) {
      loadData();
    }
  }, [isOpen, warehouse]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [stockRes, itemsRes] = await Promise.all([
        window.kadal.warehouses.getStockByWarehouse(warehouse.id),
        window.kadal.items.getAll({})
      ]);

      if (stockRes.success) setStockList(stockRes.data);
      if (itemsRes.success) setItems(itemsRes.data);
    } catch (err) {
      addToast('error', 'Failed to load warehouse stock');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen || !warehouse) return null;

  const mergedStock = stockList.map(stock => {
    const item = items.find(i => i.id === stock.item_id);
    return {
      ...stock,
      item_name: item ? item.name : 'Unknown Item',
      item_code: item ? item.item_code : 'Unknown',
      category_name: item ? item.category_name : ''
    };
  }).filter(s => s.quantity > 0);

  const filteredStock = mergedStock.filter(stock => 
    stock.item_name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    stock.item_code.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="modal-overlay">
      <div className="modal modal-lg">
        <div className="modal-header">
          <div>
            <h2 className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Package className="w-5 h-5" style={{ color: 'var(--accent)' }} />
              Stock: {warehouse.name}
            </h2>
            <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px' }}>Current inventory in this location</p>
          </div>
          <button onClick={onClose} className="btn-control btn-close" title="Close">
            <X size={14} />
          </button>
        </div>

        <div style={{ padding: '16px 24px', borderBottom: '1px solid var(--border)' }}>
          <div className="search-bar" style={{ maxWidth: '100%' }}>
            <Search />
            <input
              type="text"
              placeholder="Search by item name or code..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="form-input"
            />
          </div>
        </div>

        <div className="modal-body" style={{ padding: 0 }}>
          {loading ? (
            <div className="loading" style={{ height: '200px' }}>
              <div className="spinner"></div>
            </div>
          ) : filteredStock.length > 0 ? (
            <div className="table-wrapper" style={{ border: 'none', borderRadius: 0 }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Item Code</th>
                    <th>Item Name</th>
                    <th>Category</th>
                    <th className="text-right">Quantity</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredStock.map((stock) => (
                    <tr key={stock.item_id}>
                      <td className="text-mono" style={{ fontSize: '12px', color: 'var(--accent)' }}>
                        {stock.item_code}
                      </td>
                      <td style={{ fontWeight: 600 }}>
                        {stock.item_name}
                      </td>
                      <td>
                        <span className="badge badge-info">
                          {stock.category_name || '-'}
                        </span>
                      </td>
                      <td className="text-right text-mono fw-bold" style={{ color: 'var(--success)' }}>
                        {stock.quantity}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="empty-state">
              <Package size={48} />
              <h3>No stock found</h3>
              <p>
                {searchTerm ? 'No items match your search' : 'This warehouse is currently empty'}
              </p>
            </div>
          )}
        </div>
        
        <div className="modal-footer">
          <button onClick={onClose} className="btn btn-outline">Close</button>
        </div>
      </div>
    </div>
  );
}

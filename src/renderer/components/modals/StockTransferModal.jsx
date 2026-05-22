import React, { useState, useEffect } from 'react';
import { X, Search, Package, ArrowRight, ArrowRightLeft } from 'lucide-react';
import useStore from '../../store/useStore';

export default function StockTransferModal({ isOpen, onClose }) {
  const { addToast, setLoading } = useStore();
  const [warehouses, setWarehouses] = useState([]);
  const [items, setItems] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  
  const [formData, setFormData] = useState({
    itemId: '',
    fromWarehouseId: '',
    toWarehouseId: '',
    quantity: '',
    notes: ''
  });

  const [selectedItemStock, setSelectedItemStock] = useState([]);

  useEffect(() => {
    if (isOpen) {
      loadData();
    }
  }, [isOpen]);

  const loadData = async () => {
    try {
      const [whRes, itemsRes] = await Promise.all([
        window.kadal.warehouses.getAll(false),
        window.kadal.items.getAll({})
      ]);

      if (whRes.success) setWarehouses(whRes.data);
      if (itemsRes.success) setItems(itemsRes.data);
    } catch (err) {
      console.error(err);
      addToast('error', 'Failed to load data for transfer');
    }
  };

  const handleItemSelect = async (itemId) => {
    setFormData({ ...formData, itemId, fromWarehouseId: '', quantity: '' });
    if (itemId) {
      try {
        const res = await window.kadal.warehouses.getStockByItem(itemId);
        if (res.success) {
          setSelectedItemStock(res.data);
        }
      } catch (err) {
        console.error(err);
      }
    } else {
      setSelectedItemStock([]);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.itemId || !formData.fromWarehouseId || !formData.toWarehouseId || !formData.quantity) {
      addToast('error', 'Please fill all required fields');
      return;
    }
    
    if (formData.fromWarehouseId === formData.toWarehouseId) {
      addToast('error', 'Source and destination warehouses cannot be the same');
      return;
    }

    try {
      setLoading(true);
      const res = await window.kadal.warehouses.transferStock({
        itemId: formData.itemId,
        fromWarehouseId: formData.fromWarehouseId,
        toWarehouseId: formData.toWarehouseId,
        quantity: Number(formData.quantity),
        notes: formData.notes
      });

      if (res.success) {
        addToast('success', 'Stock transferred successfully');
        onClose();
      } else {
        addToast('error', res.error || 'Failed to transfer stock');
      }
    } catch (err) {
      addToast('error', err.message);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const filteredItems = items.filter(item => 
    item.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    item.item_code.toLowerCase().includes(searchTerm.toLowerCase())
  ).slice(0, 50); // limit to 50 for performance

  const selectedItem = items.find(i => i.id === Number(formData.itemId));

  return (
    <div className="modal-overlay">
      <div className="modal modal-lg">
        <div className="modal-header">
          <div>
            <h2 className="modal-title">Transfer Stock</h2>
            <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px' }}>Move inventory between warehouses</p>
          </div>
          <button onClick={onClose} className="btn-control btn-close" title="Close">
            <X size={14} />
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column' }}>
          <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {/* Item Selection */}
            <div className="form-group">
              <label className="form-label">Select Item *</label>
              {!selectedItem ? (
                <div style={{ position: 'relative' }}>
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
                  {searchTerm && (
                    <div className="custom-suggestions" style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 10 }}>
                      {filteredItems.map(item => (
                        <div
                          key={item.id}
                          onClick={() => {
                            handleItemSelect(item.id);
                            setSearchTerm('');
                          }}
                          className="suggestion-item"
                        >
                          <div>
                            <div style={{ fontWeight: 600 }}>{item.name}</div>
                            <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '2px' }}>{item.item_code}</div>
                          </div>
                          <div style={{ fontWeight: 600, color: 'var(--accent)' }}>
                            Total: {item.current_stock}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', border: '1px solid var(--accent-dim)', backgroundColor: 'var(--bg-tertiary)', borderRadius: 'var(--radius)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{ padding: '8px', backgroundColor: 'var(--accent-dim)', borderRadius: 'var(--radius-sm)', display: 'flex' }}>
                      <Package className="w-5 h-5" style={{ color: 'var(--accent)' }} />
                    </div>
                    <div>
                      <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{selectedItem.name}</div>
                      <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px' }}>{selectedItem.item_code} | Total Stock: <span style={{ color: 'var(--success)', fontWeight: 600 }}>{selectedItem.current_stock}</span></div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleItemSelect('')}
                    className="btn btn-outline btn-sm"
                  >
                    Change
                  </button>
                </div>
              )}
            </div>

            {selectedItem && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: '16px', alignItems: 'center' }}>
                {/* From Warehouse */}
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">From Warehouse *</label>
                  <select
                    value={formData.fromWarehouseId}
                    onChange={(e) => setFormData({ ...formData, fromWarehouseId: e.target.value, quantity: '' })}
                    className="form-select"
                    required
                  >
                    <option value="">Select source...</option>
                    {selectedItemStock.map(stock => {
                      const wh = warehouses.find(w => w.id === stock.warehouse_id);
                      if (!wh || stock.quantity <= 0) return null;
                      return (
                        <option key={stock.warehouse_id} value={stock.warehouse_id}>
                          {wh.name} ({stock.quantity} available)
                        </option>
                      );
                    })}
                  </select>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', paddingTop: '20px' }}>
                  <ArrowRight className="w-5 h-5" style={{ color: 'var(--text-secondary)' }} />
                </div>

                {/* To Warehouse */}
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">To Warehouse *</label>
                  <select
                    value={formData.toWarehouseId}
                    onChange={(e) => setFormData({ ...formData, toWarehouseId: e.target.value })}
                    className="form-select"
                    required
                  >
                    <option value="">Select destination...</option>
                    {warehouses.map(wh => (
                      <option 
                        key={wh.id} 
                        value={wh.id} 
                        disabled={wh.id.toString() === formData.fromWarehouseId}
                      >
                        {wh.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            )}

            {formData.fromWarehouseId && (
              <div className="form-row">
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Transfer Quantity *</label>
                  <input
                    type="number"
                    min="1"
                    max={selectedItemStock.find(s => s.warehouse_id.toString() === formData.fromWarehouseId)?.quantity || 1}
                    value={formData.quantity}
                    onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
                    className="form-input"
                    placeholder="Enter amount"
                    required
                  />
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Reference Notes</label>
                  <input
                    type="text"
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    className="form-input"
                    placeholder="Optional details"
                  />
                </div>
              </div>
            )}
          </div>

          <div className="modal-footer">
            <button
              type="button"
              onClick={onClose}
              className="btn btn-outline"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!formData.itemId || !formData.fromWarehouseId || !formData.toWarehouseId || !formData.quantity}
              className="btn btn-primary"
            >
              <ArrowRightLeft className="w-4 h-4" />
              Transfer Stock
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

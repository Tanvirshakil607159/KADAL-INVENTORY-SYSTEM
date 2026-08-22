import React, { useState, useEffect } from 'react';
import { Package, ArrowRightLeft } from 'lucide-react';
import useStore from '../../store/useStore';

export default function BinStockModal({ isOpen, onClose, bin }) {
  const [stock, setStock] = useState([]);
  const { setLoading, addToast } = useStore();

  const loadStock = async () => {
    try {
      setLoading(true);
      const res = await window.kadal.binStock.getByBin(bin.id);
      if (res.success) {
        setStock(res.data);
      } else {
        addToast('error', res.error);
      }
    } catch (e) {
      addToast('error', e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && bin) loadStock();
  }, [isOpen, bin]);

  if (!isOpen) return null;

  return (
    <div className="modal-overlay">
      <div className="modal-content" style={{ maxWidth: '800px' }}>
        <div className="modal-header">
          <h2>
            <Package style={{ display: 'inline', marginRight: '8px', verticalAlign: 'text-bottom' }} />
            Stock in {bin.name}
          </h2>
          <button className="close-btn" onClick={onClose}>&times;</button>
        </div>

        {stock.length === 0 ? (
          <div className="empty-state">
            <Package size={48} />
            <h3>Bin is Empty</h3>
            <p>No items are currently stored in this bin.</p>
          </div>
        ) : (
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>Item Code</th>
                  <th>Item Name</th>
                  <th style={{ textAlign: 'right' }}>Quantity</th>
                  <th>Unit</th>
                </tr>
              </thead>
              <tbody>
                {stock.map(s => (
                  <tr key={s.id}>
                    <td>{s.item_code}</td>
                    <td>{s.item_name}</td>
                    <td style={{ textAlign: 'right', fontWeight: 'bold' }}>{s.quantity}</td>
                    <td>{s.unit}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

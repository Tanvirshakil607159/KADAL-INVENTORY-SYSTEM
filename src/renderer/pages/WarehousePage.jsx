import React, { useState, useEffect } from 'react';
import { Plus, Search, Edit2, Trash2, MapPin, Package, ArrowRightLeft } from 'lucide-react';
import useStore from '../store/useStore';
import WarehouseFormModal from '../components/modals/WarehouseFormModal';
import StockTransferModal from '../components/modals/StockTransferModal';
import WarehouseStockModal from '../components/modals/WarehouseStockModal';
import WarehouseDetail from '../components/WarehouseDetail';

function WarehousePage() {
  const [warehouses, setWarehouses] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const { setLoading, addToast, showConfirm, openModal, closeModal, modal } = useStore();
  const [selectedWarehouse, setSelectedWarehouse] = useState(null);
  const [viewDetail, setViewDetail] = useState(false);

  const loadWarehouses = async () => {
    try {
      setLoading(true);
      const res = await window.kadal.warehouses.getAll(false);
      if (res.success) {
        setWarehouses(res.data);
      } else {
        addToast('error', res.error || 'Failed to load warehouses');
      }
    } catch (err) {
      addToast('error', err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadWarehouses();
  }, []);

  const handleDelete = async (id) => {
    const confirm = await showConfirm({
      title: 'Delete Warehouse',
      message: 'Are you sure you want to delete this warehouse? You cannot delete a warehouse that currently holds stock.',
      confirmText: 'Delete',
      type: 'danger'
    });

    if (confirm) {
      try {
        setLoading(true);
        const res = await window.kadal.warehouses.delete(id);
        if (res.success) {
          addToast('success', 'Warehouse deleted successfully');
          loadWarehouses();
        } else {
          addToast('error', res.error);
        }
      } catch (err) {
        addToast('error', err.message);
      } finally {
        setLoading(false);
      }
    }
  };

  const filteredWarehouses = warehouses.filter(w =>
    w.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    w.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (w.location && w.location.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  if (viewDetail && selectedWarehouse) {
    return <WarehouseDetail warehouse={selectedWarehouse} onBack={() => { setViewDetail(false); setSelectedWarehouse(null); }} />;
  }

  return (
    <div>
      <div className="toolbar">
        <div className="toolbar-left">
          <div className="search-bar">
            <Search />
            <input
              type="text"
              placeholder="Search warehouses by name, code or location..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="form-input"
            />
          </div>
        </div>
        <div className="toolbar-right">
          <button
            onClick={() => openModal('STOCK_TRANSFER')}
            className="btn btn-outline"
          >
            <ArrowRightLeft className="w-4 h-4" />
            Transfer Stock
          </button>
          <button
            onClick={() => openModal('WAREHOUSE_FORM')}
            className="btn btn-primary"
          >
            <Plus className="w-4 h-4" />
            Add Warehouse
          </button>
        </div>
      </div>

      <div className="cards-grid" style={{ marginTop: '20px' }}>
        {filteredWarehouses.map((warehouse) => (
          <div key={warehouse.id} className="card">
            <div className="card-header" style={{ marginBottom: '12px' }}>
              <div>
                <h3 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text-primary)' }}>{warehouse.name}</h3>
                <span className="badge badge-info" style={{ marginTop: '4px' }}>
                  {warehouse.code}
                </span>
              </div>
              <div className="table-actions">
                <button
                  onClick={() => openModal('WAREHOUSE_FORM', warehouse)}
                  className="btn btn-ghost btn-icon btn-sm"
                  title="Edit Warehouse"
                >
                  <Edit2 className="w-4 h-4" />
                </button>
                {!warehouse.is_default && (
                  <button
                    onClick={() => handleDelete(warehouse.id)}
                    className="btn btn-ghost btn-icon btn-sm"
                    style={{ color: 'var(--danger)' }}
                    title="Delete Warehouse"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>

            {warehouse.location && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-secondary)', fontSize: '13px', marginBottom: '16px' }}>
                <MapPin className="w-4 h-4" style={{ color: 'var(--accent)' }} />
                {warehouse.location}
              </div>
            )}

            <div style={{ borderTop: '1px solid var(--border-dim)', paddingTop: '16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 'auto' }}>
              <div style={{ fontSize: '12px' }}>
                {warehouse.is_default ? (
                  <span className="badge badge-success">Default Warehouse</span>
                ) : (
                  <span className="badge badge-warning">Secondary Location</span>
                )}
              </div>
              <button
                onClick={() => {
                  setSelectedWarehouse(warehouse);
                  openModal('WAREHOUSE_STOCK', warehouse);
                }}
                className="btn btn-outline btn-sm"
                style={{ color: 'var(--accent-hover)' }}
              >
                <Package className="w-4 h-4" />
                Total Stock
              </button>
              <button
                onClick={() => {
                  setSelectedWarehouse(warehouse);
                  setViewDetail(true);
                }}
                className="btn btn-primary btn-sm"
              >
                <MapPin className="w-4 h-4" />
                Manage Layout
              </button>
            </div>
          </div>
        ))}
      </div>

      {filteredWarehouses.length === 0 && (
        <div className="empty-state">
          <MapPin size={48} />
          <h3>No warehouses found</h3>
          <p>{searchTerm ? 'Try adjusting your search query.' : 'Get started by creating a new warehouse location.'}</p>
        </div>
      )}

      {modal?.type === 'WAREHOUSE_FORM' && (
        <WarehouseFormModal
          isOpen={true}
          onClose={() => {
            closeModal();
            loadWarehouses();
          }}
          warehouse={modal.data}
        />
      )}

      {modal?.type === 'STOCK_TRANSFER' && (
        <StockTransferModal
          isOpen={true}
          onClose={closeModal}
        />
      )}

      {modal?.type === 'WAREHOUSE_STOCK' && (
        <WarehouseStockModal
          isOpen={true}
          onClose={closeModal}
          warehouse={modal.data}
        />
      )}
    </div>
  );
}

export default WarehousePage;

import React, { useState, useEffect } from 'react';
import { ArrowLeft, Plus, Map, LayoutGrid, Package, LayoutList, Layers } from 'lucide-react';
import useStore from '../store/useStore';
import ZoneFormModal from './modals/ZoneFormModal';
import BinFormModal from './modals/BinFormModal';
import BinStockModal from './modals/BinStockModal';

export default function WarehouseDetail({ warehouse, onBack }) {
  const [zones, setZones] = useState([]);
  const [bins, setBins] = useState([]);
  const [viewMode, setViewMode] = useState('grid'); // 'grid' or 'list'
  const { setLoading, addToast, showConfirm } = useStore();
  const [modal, setModal] = useState(null);

  const loadData = async () => {
    try {
      setLoading(true);
      const resZones = await window.kadal.warehouseZones.getByWarehouse(warehouse.id);
      const resBins = await window.kadal.warehouseBins.getByWarehouse(warehouse.id);
      
      if (resZones.success) setZones(resZones.data);
      if (resBins.success) setBins(resBins.data);
    } catch (e) {
      addToast('error', e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [warehouse.id]);

  const handleDeleteZone = async (id) => {
    if (await showConfirm({ title: 'Delete Zone', message: 'Are you sure?', type: 'danger' })) {
      const res = await window.kadal.warehouseZones.delete(id);
      if (res.success) {
        addToast('success', 'Zone deleted');
        loadData();
      }
    }
  };

  const handleDeleteBin = async (id) => {
    if (await showConfirm({ title: 'Delete Bin', message: 'Are you sure?', type: 'danger' })) {
      const res = await window.kadal.warehouseBins.delete(id);
      if (res.success) {
        addToast('success', 'Bin deleted');
        loadData();
      }
    }
  };

  // Group bins by zone
  const binsByZone = {};
  zones.forEach(z => { binsByZone[z.id] = []; });
  bins.forEach(b => {
    if (binsByZone[b.zone_id]) {
      binsByZone[b.zone_id].push(b);
    }
  });

  return (
    <div style={{ animation: 'fadeIn 0.3s ease' }}>
      <div className="toolbar" style={{ marginBottom: '24px' }}>
        <div className="toolbar-left" style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <button onClick={onBack} className="btn btn-ghost btn-icon">
            <ArrowLeft />
          </button>
          <div>
            <h2 style={{ margin: 0, fontSize: '20px', display: 'flex', alignItems: 'center', gap: 10 }}>
              <Map className="w-5 h-5 text-accent" />
              {warehouse.name} Layout
            </h2>
            <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{warehouse.code}</span>
          </div>
        </div>
        <div className="toolbar-right">
          <div className="btn-group">
            <button className={`btn ${viewMode === 'grid' ? 'btn-primary' : 'btn-outline'}`} onClick={() => setViewMode('grid')}>
              <LayoutGrid className="w-4 h-4" /> Grid Map
            </button>
            <button className={`btn ${viewMode === 'list' ? 'btn-primary' : 'btn-outline'}`} onClick={() => setViewMode('list')}>
              <LayoutList className="w-4 h-4" /> List View
            </button>
          </div>
          <button onClick={() => setModal({ type: 'ZONE_FORM' })} className="btn btn-outline">
            <Plus className="w-4 h-4" /> Add Zone
          </button>
          <button onClick={() => setModal({ type: 'BIN_FORM' })} className="btn btn-primary" disabled={zones.length === 0}>
            <Plus className="w-4 h-4" /> Add Bin
          </button>
        </div>
      </div>

      {zones.length === 0 ? (
        <div className="empty-state">
          <Layers size={48} />
          <h3>No Zones Configured</h3>
          <p>Create your first Storage Zone (like Aisle A, or Cold Storage) to start mapping bins.</p>
          <button onClick={() => setModal({ type: 'ZONE_FORM' })} className="btn btn-primary" style={{ marginTop: '16px' }}>
            Create First Zone
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
          {zones.map(zone => (
            <div key={zone.id} className="card" style={{ padding: '24px', background: 'var(--bg-secondary)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <h3 style={{ margin: 0, fontSize: '18px', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Layers className="w-5 h-5 text-primary" />
                  {zone.name} {zone.type && <span className="badge badge-outline">{zone.type}</span>}
                </h3>
                <button onClick={() => handleDeleteZone(zone.id)} className="btn btn-ghost btn-sm text-danger">Delete Zone</button>
              </div>

              {binsByZone[zone.id].length === 0 ? (
                <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-secondary)', border: '1px dashed var(--border-color)', borderRadius: '8px' }}>
                  No bins in this zone yet.
                </div>
              ) : viewMode === 'grid' ? (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '16px' }}>
                  {binsByZone[zone.id].map(bin => (
                    <div key={bin.id} className="card" style={{ padding: '16px', borderLeft: '4px solid var(--primary)', cursor: 'pointer', transition: 'all 0.2s' }} onClick={() => setModal({ type: 'BIN_STOCK', data: bin })}>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <strong style={{ fontSize: '16px' }}>{bin.name}</strong>
                        <Package className="w-4 h-4 text-secondary" />
                      </div>
                      <div style={{ marginTop: '8px', fontSize: '12px', color: 'var(--text-secondary)', fontFamily: 'monospace' }}>
                        {bin.barcode || '-'}
                      </div>
                      {bin.capacity > 0 && (
                        <div style={{ marginTop: '12px', fontSize: '11px', color: 'var(--text-secondary)' }}>
                          Capacity: {bin.capacity}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <table className="table" style={{ background: 'var(--bg-primary)' }}>
                  <thead>
                    <tr>
                      <th>Bin Name</th>
                      <th>Barcode / QR</th>
                      <th>Capacity limit</th>
                      <th style={{ width: '100px', textAlign: 'right' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {binsByZone[zone.id].map(bin => (
                      <tr key={bin.id}>
                        <td><strong>{bin.name}</strong></td>
                        <td style={{ fontFamily: 'monospace' }}>{bin.barcode || '-'}</td>
                        <td>{bin.capacity > 0 ? bin.capacity : 'Unlimited'}</td>
                        <td style={{ textAlign: 'right' }}>
                           <button onClick={() => setModal({ type: 'BIN_STOCK', data: bin })} className="btn btn-ghost btn-sm">Stock</button>
                           <button onClick={() => handleDeleteBin(bin.id)} className="btn btn-ghost btn-sm text-danger">Del</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          ))}
        </div>
      )}

      {modal?.type === 'ZONE_FORM' && (
        <ZoneFormModal
          isOpen={true}
          warehouseId={warehouse.id}
          onClose={() => { setModal(null); loadData(); }}
        />
      )}

      {modal?.type === 'BIN_FORM' && (
        <BinFormModal
          isOpen={true}
          zones={zones}
          onClose={() => { setModal(null); loadData(); }}
        />
      )}

      {modal?.type === 'BIN_STOCK' && (
        <BinStockModal
          isOpen={true}
          bin={modal.data}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  );
}

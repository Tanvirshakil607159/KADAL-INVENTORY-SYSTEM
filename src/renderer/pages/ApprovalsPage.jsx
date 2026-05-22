import React, { useEffect, useState } from 'react';
import useStore from '../store/useStore';
import { Clock, CheckCircle, XCircle, ArrowUpDown, ArrowUp, ArrowDown, AlertCircle } from 'lucide-react';

export default function ApprovalsPage() {
  const { user, addToast, openModal, setCategories, setSuppliers, setUnits } = useStore();
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('pending'); // pending | history
  const [buyers, setBuyers] = useState([]);
  const [distinctValues, setDistinctValues] = useState({ names: [], colors: [], sizes: [], styles: [], purchases: [], orders: [] });
  const [sortConfig, setSortConfig] = useState({ key: 'created_at', direction: 'desc' });

  const handleSort = (key) => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  const sortedRequests = [...requests].sort((a, b) => {
    if (!sortConfig.key) return 0;
    let valA = a[sortConfig.key];
    let valB = b[sortConfig.key];
    
    valA = (valA || '').toString().toLowerCase();
    valB = (valB || '').toString().toLowerCase();

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

  const isAdmin = user?.roleName === 'Super Admin' || user?.roleName === 'Admin';

  const load = async () => {
    setLoading(true);
    try {
      const [appRes, buyersRes, dvRes, catsRes, suppRes, unitsRes] = await Promise.all([
        window.kadal.approvals.getAll(),
        window.kadal.buyers.getAll(),
        window.kadal.items.getDistinctValues(),
        window.kadal.categories.getAll(),
        window.kadal.suppliers.getAll(),
        window.kadal.units.getAll()
      ]);
      if (appRes.success) setRequests(appRes.data);
      if (buyersRes.success) setBuyers(buyersRes.data);
      if (dvRes.success) setDistinctValues(dvRes.data);
      if (catsRes.success) setCategories(catsRes.data);
      if (suppRes.success) setSuppliers(suppRes.data);
      if (unitsRes.success) setUnits(unitsRes.data);
    } catch (e) { addToast('error', 'Failed to load approvals'); }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const filteredRequests = sortedRequests.filter(r => 
    activeTab === 'pending' ? r.status === 'PENDING' : r.status !== 'PENDING'
  );

  const renderDataDetail = (data, type) => {
    if (!data) return null;
    
    const renderProperty = (label, value) => (
      <div className="approval-data-item">
        <label>{label}</label>
        <span>{value || '-'}</span>
      </div>
    );

    // Ensure data is an object
    let safeData = data;
    if (typeof data === 'string') {
      try { safeData = JSON.parse(data); } catch (e) { return <pre>{data}</pre>; }
    }
    if (!safeData) return null;

    switch (type) {
      case 'CREATE_ITEM':
      case 'UPDATE_ITEM':
        const itemData = (type === 'UPDATE_ITEM' ? safeData.data : safeData) || {};
        const oldData = (type === 'UPDATE_ITEM' ? safeData.oldData : null);

        const renderField = (label, newValue, oldValue = null) => {
          const isChanged = oldValue !== null && String(newValue) !== String(oldValue);
          return (
            <div className={`approval-data-item ${isChanged ? 'field-changed' : ''}`}>
              <label>{label}</label>
              <div className="flex flex-col">
                <span className="new-value">{newValue || '-'}</span>
                {isChanged && <span className="old-value">Was: {oldValue || '-'}</span>}
              </div>
            </div>
          );
        };

        return (
          <div className="approval-details-rich">
            <div className="approval-data-grid">
              {renderField('Name', itemData.name, oldData?.name)}
              {renderField('Code', itemData.itemCode || itemData.item_code, oldData?.item_code)}
              {renderField('Category', itemData.categoryName || itemData.category_name || itemData.category_id, oldData?.category_name)}
              {renderField('Supplier', itemData.supplierName || itemData.supplier_name || itemData.supplier_id, oldData?.supplier_name)}
              {renderField('Buyer', itemData.buyerName || itemData.buyer_name, oldData?.buyer_name)}
              {renderField('Style', itemData.styleName || itemData.style_name, oldData?.style_name)}
              {renderField('Order No', itemData.orderNumber || itemData.order_number, oldData?.order_number)}
              {renderField('Purchase No', itemData.purchaseNo || itemData.purchase_no, oldData?.purchase_no)}
              {renderField('Size', itemData.size, oldData?.size)}
              {renderField('Color', itemData.color, oldData?.color)}
              {renderField('Unit', itemData.unit, oldData?.unit)}
              {renderField('Unit Price', itemData.unitPrice || itemData.unit_price, oldData?.unit_price)}
              {renderField('Opening Stock', itemData.openingStock || itemData.opening_stock, oldData?.opening_stock)}
              {renderField('Min Level', itemData.minStockLevel || itemData.min_stock_level, oldData?.min_stock_level)}
            </div>
            {itemData.notes && (
              <div className="mt-3 p-2 bg-light rounded" style={{ fontSize: 12 }}>
                <strong>Notes:</strong> {itemData.notes}
              </div>
            )}
          </div>
        );

      case 'STOCK_MOVEMENT':
        return (
          <div className="approval-details-rich">
            <div className="approval-data-grid">
              {renderProperty('Item', safeData.itemName)}
              {renderProperty('Type', safeData.type)}
              {renderProperty('Quantity', safeData.quantity)}
              {renderProperty('Reference', safeData.reference)}
            </div>
            {safeData.notes && (
              <div className="mt-3 p-2 bg-light rounded" style={{ fontSize: 12 }}>
                <strong>Notes:</strong> {safeData.notes}
              </div>
            )}
          </div>
        );

      case 'CREATE_CHALLAN':
        const challanItems = safeData.items || [];
        const seenItems = new Set();
        let hasDuplicate = false;
        challanItems.forEach(it => {
          const namePart = String(it.name || '').trim().toLowerCase();
          const sizePart = String(it.size || '').trim().toLowerCase();
          const key = `${namePart}|${sizePart}`;
          if (seenItems.has(key)) hasDuplicate = true;
          seenItems.add(key);
        });

        return (
          <div className="approval-details-rich">
            {hasDuplicate && (
              <div style={{ marginBottom: 16, padding: 12, background: 'rgba(245,158,11,0.1)', border: '1px solid var(--warning)', borderRadius: 'var(--radius-sm)', color: 'var(--warning)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 10 }}>
                <AlertCircle size={18} /> It seems items are duplicate please check before submit/approved
              </div>
            )}
            <div className="approval-data-grid mb-3">
              {renderProperty('Receiver', safeData.receiverName)}
              {renderProperty('Contact', safeData.receiverContact)}
              {renderProperty('Address', safeData.receiverAddress)}
              {renderProperty('Date', safeData.challanDate ? new Date(safeData.challanDate).toLocaleDateString() : 'Today')}
            </div>
            <div className="table-wrapper" style={{ maxHeight: 300, border: '1px solid var(--border)' }}>
              <table className="data-table table-sm">
                <thead>
                  <tr>
                    <th>Item Name</th>
                    <th>Code</th>
                    <th>Size/Color</th>
                    <th>Style/Order</th>
                    <th className="text-right">Qty</th>
                    <th>Unit</th>
                  </tr>
                </thead>
                <tbody>
                  {safeData.items?.map((it, i) => (
                    <tr key={i}>
                      <td style={{ fontWeight: 600 }}>{it.name}</td>
                      <td className="text-mono" style={{ fontSize: 11 }}>{it.itemCode || '-'}</td>
                      <td style={{ fontSize: 11 }}>{[it.size, it.color].filter(Boolean).join(' / ') || '-'}</td>
                      <td style={{ fontSize: 11 }}>{[it.styleName, it.orderNumber].filter(Boolean).join(' / ') || '-'}</td>
                      <td className="text-right fw-bold" style={{ color: 'var(--primary)' }}>{it.quantity}</td>
                      <td className="text-muted">{it.unit}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {safeData.notes && (
              <div className="mt-3 p-2 bg-light rounded" style={{ fontSize: 12 }}>
                <strong>General Notes:</strong> {safeData.notes}
              </div>
            )}
          </div>
        );

      case 'CREATE_GATE_PASS':
        return (
          <div className="approval-details-rich">
            <div className="approval-data-grid mb-3">
              {renderProperty('Poly Bags', safeData.polyBags)}
              {renderProperty('Cartons', safeData.cartons)}
              {renderProperty('Plastic Bags', safeData.plasticBags)}
            </div>
            <div className="p-3 bg-light rounded">
              <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 8 }}>Included Challan IDs:</div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {safeData.challanIds?.map((cid, i) => (
                  <span key={i} className="badge badge-info">ID: {cid}</span>
                ))}
              </div>
            </div>
          </div>
        );

      default:
        return <pre style={{ fontSize: 11, background: '#f5f5f5', padding: 10 }}>{JSON.stringify(safeData, null, 2)}</pre>;
    }
  };

  const handleReview = (request) => {
    openModal('APPROVAL_REVIEW', { 
      selectedRequest: request, 
      renderDataDetail, 
      buyers,
      distinctValues,
      onSaved: load 
    });
  };

  return (
    <div className="approvals-container">
      <div className="tabs">
        <button className={`tab ${activeTab === 'pending' ? 'active' : ''}`} onClick={() => setActiveTab('pending')}>
          Pending Approvals ({requests.filter(r => r.status === 'PENDING').length})
        </button>
        <button className={`tab ${activeTab === 'history' ? 'active' : ''}`} onClick={() => setActiveTab('history')}>
          Recent History
        </button>
      </div>

      <div className="card">
        {loading ? (
          <div className="loading"><div className="spinner"></div></div>
        ) : filteredRequests.length === 0 ? (
          <div className="empty-state">
            <Clock size={40} className="text-muted" />
            <p>No {activeTab} requests found</p>
          </div>
        ) : (
          <div className="table-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <SortHeader label="Date" field="created_at" />
                  <SortHeader label="Requester" field="requester_name" />
                  <SortHeader label="Module" field="type" />
                  <th>Details</th>
                  <SortHeader label="Status" field="status" />
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredRequests.map(req => (
                  <tr key={req.id}>
                    <td className="text-muted" style={{ fontSize: 13 }}>{new Date(req.created_at).toLocaleString()}</td>
                    <td style={{ fontWeight: 600 }}>{req.requester_name}</td>
                    <td>
                      <span className="badge badge-info">
                        {req.type === 'CREATE_ITEM' || req.type === 'UPDATE_ITEM' ? 'Inventory' :
                         req.type === 'STOCK_MOVEMENT' ? 'Stock' :
                         req.type === 'CREATE_CHALLAN' ? 'Challan' :
                         req.type === 'CREATE_GATE_PASS' ? 'Gate Pass' : req.type}
                      </span>
                    </td>
                    <td style={{ fontSize: 13 }}>
                      {req.type === 'CREATE_ITEM' && `New Item: ${req.data.name}`}
                      {req.type === 'UPDATE_ITEM' && `Update Item: ${req.data.data?.name || req.data.name}`}
                      {req.type === 'STOCK_MOVEMENT' && `Stock ${req.data.type}: ${req.data.quantity} ${req.data.itemName || 'units'}`}
                      {req.type === 'CREATE_CHALLAN' && `New Challan: ${req.data.receiverName}`}
                      {req.type === 'CREATE_GATE_PASS' && `New Gate Pass (${req.data.challanIds?.length || 0} Challans)`}
                    </td>
                    <td>
                      <span className={`badge badge-${req.status === 'PENDING' ? 'warning' : req.status === 'APPROVED' ? 'success' : 'danger'}`}>
                        {req.status}
                      </span>
                    </td>
                    <td>
                      <button className="btn btn-ghost btn-sm" onClick={() => handleReview(req)}>
                        {activeTab === 'history' ? 'View Details' : 'Review Details'}
                      </button>
                    </td>
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

import React, { useEffect, useState } from 'react';
import useStore from '../store/useStore';
import { Clock, CheckCircle, XCircle, ArrowUpDown, ArrowUp, ArrowDown, AlertCircle, Package } from 'lucide-react';

function IssueApprovalDetails({ safeData, renderProperty }) {
  const [prodItems, setProdItems] = useState(safeData?.producedProducts || []);
  const issueItems = safeData?.items || [];

  useEffect(() => {
    let isMounted = true;
    const initial = safeData?.producedProducts || [];
    // If any item is missing buyerName or color or orderNumber, fetch it from inventory
    const needsEnrichment = initial.some(p => (!p.buyerName && !p.buyer_name) || !p.orderNumber) ||
      (initial.length === 0 && (safeData?.producedItemIds?.length > 0 || safeData?.producedItemId));

    if (needsEnrichment) {
      const pIds = initial.length > 0
        ? initial.map(p => p.id).filter(Boolean)
        : (safeData?.producedItemIds || (safeData?.producedItemId ? [safeData.producedItemId] : []));

      if (pIds.length > 0 && window.kadal?.items?.getById) {
        Promise.all(pIds.map(async (id) => {
          try {
            const res = await window.kadal.items.getById(id);
            if (res?.success && res?.data) {
              const item = res.data;
              const prev = initial.find(p => p.id === id) || {};
              return {
                id: item.id,
                name: item.name,
                itemCode: item.item_code,
                unit: item.unit || prev.unit,
                styleName: item.style_name || prev.styleName,
                buyerName: item.buyer_name || prev.buyerName,
                color: item.color || prev.color,
                size: item.size || prev.size,
                orderNumber: item.order_number || prev.orderNumber,
                purchaseNo: item.purchase_no || prev.purchaseNo,
                orderQuantity: item.order_quantity ?? prev.orderQuantity,
              };
            }
          } catch (e) {}
          return initial.find(p => p.id === id) || null;
        })).then(results => {
          if (isMounted) {
            const valid = results.filter(Boolean);
            if (valid.length > 0) setProdItems(valid);
          }
        });
      }
    } else {
      setProdItems(initial);
    }
    return () => { isMounted = false; };
  }, [safeData]);

  return (
    <div className="approval-details-rich">
      <div className="approval-data-grid mb-3">
        {renderProperty('Recipient', safeData?.recipientName)}
        {renderProperty('Issue Type', safeData?.issueType || 'FACTORY')}
        {safeData?.issueType === 'EMPLOYEE' && renderProperty('Category', safeData?.isReturnable ? 'Returnable' : 'Non-Returnable')}
        {renderProperty('Issue Date', safeData?.issueDate ? new Date(safeData.issueDate).toLocaleDateString() : 'Today')}
        {safeData?.expectedReturnDate && renderProperty('Expected Return', new Date(safeData.expectedReturnDate).toLocaleDateString())}
      </div>

      {prodItems.length > 0 && (
        <div className="p-3 bg-light rounded mb-3" style={{ border: '1px solid var(--border)' }}>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text)' }}>
            <Package size={15} color="var(--primary)" /> Target Finished Product(s) to Produce ({prodItems.length}):
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {prodItems.map((prod, pIdx) => {
              const buyer = prod.buyerName || prod.buyer_name || '-';
              const color = prod.color || '-';
              const orderNo = prod.orderNumber || prod.order_number || '-';
              const style = prod.styleName || prod.style_name || '-';
              const purchaseNo = prod.purchaseNo || prod.purchase_no || '-';
              const size = prod.size || '-';
              const orderQty = prod.orderQuantity ?? prod.order_quantity;

              return (
                <div key={prod.id || pIdx} style={{ padding: '10px 14px', background: 'var(--bg-card)', borderRadius: 6, border: '1px solid var(--border)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                    <div>
                      <strong style={{ fontSize: 13, color: 'var(--text)' }}>{prod.name}</strong>
                      <span className="text-mono text-muted" style={{ fontSize: 11, marginLeft: 6 }}>({prod.itemCode || prod.item_code})</span>
                    </div>
                    {orderQty != null && (
                      <span className="badge badge-info" style={{ fontSize: 11 }}>
                        Order Qty: {orderQty} {prod.unit || ''}
                      </span>
                    )}
                  </div>

                  <div style={{ 
                    display: 'grid', 
                    gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', 
                    gap: '6px 12px', 
                    fontSize: 11, 
                    background: 'var(--bg-muted)', 
                    padding: '8px 12px', 
                    borderRadius: 4,
                    border: '1px solid var(--border)' 
                  }}>
                    <div><span className="text-muted">Buyer:</span> <strong style={{ color: 'var(--text)' }}>{buyer}</strong></div>
                    <div><span className="text-muted">Color:</span> <strong style={{ color: 'var(--text)' }}>{color}</strong></div>
                    <div><span className="text-muted">Order No:</span> <strong style={{ color: 'var(--text)' }}>{orderNo}</strong></div>
                    <div><span className="text-muted">Style:</span> <strong style={{ color: 'var(--text)' }}>{style}</strong></div>
                    {purchaseNo !== '-' && <div><span className="text-muted">Purchase No:</span> <strong style={{ color: 'var(--text)' }}>{purchaseNo}</strong></div>}
                    {size !== '-' && size !== 'N/A' && <div><span className="text-muted">Size:</span> <strong style={{ color: 'var(--text)' }}>{size}</strong></div>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 6 }}>
        Issued Items ({issueItems.length}):
      </div>
      <div className="table-wrapper" style={{ maxHeight: 300, border: '1px solid var(--border)' }}>
        <table className="data-table table-sm">
          <thead>
            <tr>
              <th>Item Name</th>
              <th>Code</th>
              <th>Buyer</th>
              <th>Style / Order</th>
              <th className="text-right">Stock</th>
              <th className="text-right">Issued Qty</th>
              <th>Unit</th>
              <th>Notes</th>
            </tr>
          </thead>
          <tbody>
            {issueItems.map((it, i) => (
              <tr key={i}>
                <td style={{ fontWeight: 600 }}>{it.name || `Item #${it.itemId}`}</td>
                <td className="text-mono" style={{ fontSize: 11 }}>{it.itemCode || '-'}</td>
                <td style={{ fontSize: 11 }}>{it.buyerName || '-'}</td>
                <td style={{ fontSize: 11 }}>{[it.styleNo, it.orderNumber].filter(Boolean).join(' / ') || '-'}</td>
                <td className="text-right text-mono" style={{ fontSize: 11 }}>{it.currentStock ?? '-'}</td>
                <td className="text-right fw-bold" style={{ color: 'var(--primary)' }}>{it.quantity}</td>
                <td className="text-muted">{it.unit}</td>
                <td style={{ fontSize: 11 }}>{it.notes || '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {safeData?.remarks && (
        <div className="mt-3 p-2 bg-light rounded" style={{ fontSize: 12 }}>
          <strong>Remarks:</strong> {safeData.remarks}
        </div>
      )}
    </div>
  );
}

function GatePassApprovalDetails({ safeData, renderProperty }) {
  const [challans, setChallans] = useState(safeData?.challans || []);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // If challans already has details (challan_number or receiver_name), update state
    if (safeData?.challans && safeData.challans.length > 0 && (safeData.challans[0].receiver_name || safeData.challans[0].challan_number)) {
      setChallans(safeData.challans);
      return;
    }

    // Otherwise, if we have challanIds, fetch details on the fly
    if (Array.isArray(safeData?.challanIds) && safeData.challanIds.length > 0) {
      let isMounted = true;
      setLoading(true);
      Promise.all(
        safeData.challanIds.map(async (cid) => {
          try {
            const res = await window.kadal.challans.getById(cid);
            return res?.success && res?.data ? res.data : null;
          } catch (e) {
            return null;
          }
        })
      ).then(results => {
        if (isMounted) {
          const valid = results.filter(Boolean);
          if (valid.length > 0) {
            setChallans(valid);
          }
          setLoading(false);
        }
      }).catch(() => {
        if (isMounted) setLoading(false);
      });

      return () => { isMounted = false; };
    }
  }, [safeData]);

  const receiverName = [
    ...new Set([
      safeData?.receiverName,
      safeData?.receiver_name,
      ...challans.map(c => c.receiver_name || c.receiverName)
    ].filter(Boolean))
  ].join(', ');

  const receiverContact = [
    ...new Set([
      safeData?.receiverContact,
      safeData?.receiver_contact,
      ...challans.map(c => c.receiver_contact || c.receiverContact)
    ].filter(Boolean))
  ].join(', ');

  const receiverAddress = [
    ...new Set([
      safeData?.receiverAddress,
      safeData?.receiver_address,
      ...challans.map(c => c.receiver_address || c.receiverAddress)
    ].filter(Boolean))
  ].join('; ');

  return (
    <div className="approval-details-rich">
      <div className="approval-data-grid mb-3">
        {renderProperty('Receiver', receiverName || (loading ? 'Loading...' : '-'))}
        {receiverContact ? renderProperty('Contact', receiverContact) : null}
        {receiverAddress ? renderProperty('Address', receiverAddress) : null}
        {renderProperty('Poly Bags', safeData?.polyBags ?? safeData?.poly_bags)}
        {renderProperty('Cartons', safeData?.cartons)}
        {renderProperty('Plastic Bags', safeData?.plasticBags ?? safeData?.plastic_bags)}
      </div>

      <div className="p-3 bg-light rounded">
        <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>Included Challans ({challans.length || safeData?.challanIds?.length || 0}):</span>
          {loading && <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Fetching challan details...</span>}
        </div>

        {challans.length > 0 ? (
          <div className="table-wrapper" style={{ maxHeight: 200, border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)' }}>
            <table className="data-table table-sm">
              <thead>
                <tr>
                  <th>Challan No</th>
                  <th>Receiver</th>
                  <th>Date</th>
                </tr>
              </thead>
              <tbody>
                {challans.map((c, i) => (
                  <tr key={c.id || i}>
                    <td className="text-mono fw-bold" style={{ color: 'var(--accent)' }}>
                      {c.challan_number || `ID: ${c.id}`}
                    </td>
                    <td style={{ fontWeight: 500 }}>
                      {c.receiver_name || c.receiverName || receiverName || '-'}
                    </td>
                    <td className="text-muted" style={{ fontSize: 11 }}>
                      {c.challan_date ? new Date(c.challan_date).toLocaleDateString() : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {safeData?.challanIds?.map((cid, i) => (
              <span key={i} className="badge badge-info">ID: {cid}</span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

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

  const filteredRequests = sortedRequests.filter(r => {
    if (r.type === 'PENDING_ITEM') return false; // Hide from Admin Approvals (handled in Pending Items module)
    return activeTab === 'pending' ? r.status === 'PENDING' : r.status !== 'PENDING';
  });

  const renderDataDetail = (data, type) => {
    if (!data) return null;
    
    const renderProperty = (label, value) => (
      <div className="approval-data-item" title={typeof value === 'string' && value !== '-' ? value : undefined}>
        <label>{label}</label>
        <span title={typeof value === 'string' && value !== '-' ? value : undefined}>{value || '-'}</span>
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
      case 'PENDING_ITEM':
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
              {renderField('Order Qty', itemData.orderQuantity || itemData.order_quantity, oldData?.order_quantity)}
              {renderField('Purchase No', itemData.purchaseNo || itemData.purchase_no, oldData?.purchase_no)}
              {renderField('Size', itemData.size, oldData?.size)}
              {renderField('Color', itemData.color, oldData?.color)}
              {renderField('Unit', itemData.unit, oldData?.unit)}
              {renderField('Unit Price', itemData.unitPrice || itemData.unit_price, oldData?.unit_price)}
              {renderField('Currency', itemData.currency, oldData?.currency)}
              {(itemData.currency === 'USD' || oldData?.currency === 'USD') && renderField('Conversion Rate (BDT)', itemData.conversionRate || itemData.conversion_rate, oldData?.conversion_rate)}
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
              {renderProperty('Item Name', safeData.itemName || safeData.item_name || safeData.name)}
              {renderProperty('Item Code', safeData.itemCode || safeData.item_code)}
              {renderProperty('Order No', safeData.orderNumber || safeData.order_number)}
              {renderProperty('Color', safeData.color)}
              {renderProperty('Order Qty', safeData.orderQuantity ?? safeData.order_quantity)}
              {renderProperty('Stock Qty', safeData.currentStock ?? safeData.current_stock ?? safeData.stock_quantity)}
              {renderProperty('Movement Type', safeData.type)}
              {renderProperty('Movement Qty', `${safeData.quantity}${safeData.unit ? ` ${safeData.unit}` : ''}`)}
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
        return <GatePassApprovalDetails safeData={safeData} renderProperty={renderProperty} />;

      case 'CREATE_ISSUE':
        return <IssueApprovalDetails safeData={safeData} renderProperty={renderProperty} />;

      default:
        return <pre style={{ fontSize: 11, background: 'var(--bg-glass)', padding: 10, borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}>{JSON.stringify(safeData, null, 2)}</pre>;
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
                         req.type === 'CREATE_GATE_PASS' ? 'Gate Pass' :
                         req.type === 'CREATE_ISSUE' ? 'Issue' : req.type}
                      </span>
                    </td>
                    <td style={{ fontSize: 13 }}>
                      {req.type === 'CREATE_ITEM' && `New Item: ${req.data.name}`}
                      {req.type === 'PENDING_ITEM' && `Pending Item: ${req.data.name}`}
                      {req.type === 'UPDATE_ITEM' && `Update Item: ${req.data.data?.name || req.data.name}`}
                      {req.type === 'STOCK_MOVEMENT' && `Stock ${req.data.type}: ${req.data.quantity} ${req.data.itemName || 'units'}`}
                      {req.type === 'CREATE_CHALLAN' && `New Challan: ${req.data.receiverName}`}
                      {req.type === 'CREATE_GATE_PASS' && `New Gate Pass: ${req.data?.receiverName || req.data?.receiver_name ? `${req.data.receiverName || req.data.receiver_name} ` : ''}(${req.data?.challanIds?.length || 0} Challans)`}
                      {req.type === 'CREATE_ISSUE' && `New Issue: ${req.data?.recipientName || '-'} (${req.data?.items?.length || 0} Items)`}
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

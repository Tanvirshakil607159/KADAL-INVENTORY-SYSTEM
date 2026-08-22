import React, { useEffect, useState, useCallback } from 'react';
import useStore from '../store/useStore';
import { Package, Search, CheckCircle, XCircle } from 'lucide-react';

export default function PendingItemsPage() {
  const { addToast, showConfirm, openModal, closeModal, user } = useStore();
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await window.kadal.approvals.getAll({ status: 'PENDING' });
      if (res.success) {
        const pendingItems = res.data.filter(r => r.type === 'PENDING_ITEM');
        setRequests(pendingItems);
      }
    } catch (e) {
      addToast('error', 'Failed to load pending items');
    }
    setLoading(false);
  }, [addToast]);

  useEffect(() => { loadData(); }, [loadData]);

  const handleProcess = (req) => {
    let itemData = req.data;
    if (typeof itemData === 'string') {
      try { itemData = JSON.parse(itemData); } catch(e) {}
    }
    
    openModal('ITEM_FORM', {
      item: itemData,
      isNewItem: true,
      overrideSave: async (form) => {
        // Update the approval data with the final form (including opening stock)
        const updateRes = await window.kadal.approvals.updateData(req.id, form);
        if (updateRes.success) {
          // Approve the request (this now creates a CREATE_ITEM request for the Admin)
          const approveRes = await window.kadal.approvals.approve(req.id, 'Processed by Inventory');
          if (approveRes.success) {
            addToast('success', 'Sent to Admin for final approval');
            closeModal();
            loadData();
          } else {
            addToast('error', approveRes.error || 'Failed to approve item');
          }
        } else {
          addToast('error', updateRes.error || 'Failed to update item data');
        }
      }
    });
  };

  const handleReject = async (req) => {
    const confirmed = await showConfirm({
      title: 'Reject Item',
      message: 'Are you sure you want to reject this item creation request?',
      type: 'danger',
      confirmText: 'Reject'
    });
    if (!confirmed) return;
    const res = await window.kadal.approvals.reject(req.id, 'Rejected by Inventory');
    if (res.success) {
      addToast('success', 'Request rejected');
      loadData();
    } else {
      addToast('error', res.error);
    }
  };

  const filteredRequests = requests.filter(r => {
    if (!search) return true;
    let dataStr = '';
    try { dataStr = typeof r.data === 'string' ? r.data : JSON.stringify(r.data); } catch(e){}
    return dataStr.toLowerCase().includes(search.toLowerCase());
  });

  return (
    <div>
      <div className="toolbar">
        <div className="toolbar-left">
          <div className="search-bar">
            <Search />
            <input className="form-input" placeholder="Search pending items..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
        </div>
      </div>

      {loading ? (
        <div className="loading"><div className="spinner"></div></div>
      ) : filteredRequests.length === 0 ? (
        <div className="empty-state">
          <Package size={48} />
          <h3>No Pending Items</h3>
          <p>There are no item creation requests waiting for your action.</p>
        </div>
      ) : (
        <div className="table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Requested By</th>
                <th>Item Name</th>
                <th>Category</th>
                <th>Style / Order</th>
                <th>Supplier / Source</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredRequests.map(req => {
                let d = req.data;
                if (typeof d === 'string') try { d = JSON.parse(d); } catch(e){}
                return (
                  <tr key={req.id}>
                    <td>{new Date(req.created_at).toLocaleDateString('en-GB')}</td>
                    <td>{req.requester_name || 'Unknown'}</td>
                    <td style={{ fontWeight: 600 }}>{d?.name || '-'}</td>
                    <td><span className="badge badge-info">{d?.categoryName || '-'}</span></td>
                    <td>{d?.styleName || '-'}<br/>{d?.orderNumber || '-'}</td>
                    <td>{d?.supplierName || '-'}<br/><span className="text-muted">{d?.sourceType || '-'}</span></td>
                    <td>
                      <div className="table-actions">
                        <button className="btn btn-primary btn-sm" onClick={() => handleProcess(req)}>
                          <CheckCircle size={14} /> Process
                        </button>
                        <button className="btn btn-outline btn-sm" onClick={() => handleReject(req)} style={{ color: 'var(--danger)', borderColor: 'var(--danger)' }}>
                          <XCircle size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

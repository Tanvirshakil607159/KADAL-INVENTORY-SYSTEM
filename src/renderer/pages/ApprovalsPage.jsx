import React, { useState, useEffect } from 'react';
import useStore from '../store/useStore';
import { CheckCircle, XCircle, Info, Clock, User, FileText, Package, History } from 'lucide-react';

export default function ApprovalsPage() {
  const { addToast, user } = useStore();
  const [activeTab, setActiveTab] = useState('pending');
  const [showAll, setShowAll] = useState(true);
  const [requests, setRequests] = useState([]);
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);

  const isAdmin = user?.roleName === 'Admin' || user?.roleName === 'Super Admin';

  const loadRequests = async () => {
    setLoading(true);
    const filters = {
      status: activeTab === 'pending' ? 'PENDING' : undefined,
    };
    if (!isAdmin || !showAll) {
      filters.requestedBy = user?.id;
    }
    const res = await window.kadal.approvals.getAll(filters);
    if (res.success) {
      if (activeTab === 'history') {
        setRequests(res.data.filter(r => r.status !== 'PENDING'));
      } else {
        setRequests(res.data);
      }
    }
    setLoading(false);
  };

  useEffect(() => {
    loadRequests();
  }, [activeTab, showAll]);

  const handleApprove = async () => {
    if (!selectedRequest) return;
    const res = await window.kadal.approvals.approve(selectedRequest.id, notes);
    if (res.success) {
      addToast('success', 'Request approved successfully');
      setSelectedRequest(null);
      setNotes('');
      loadRequests();
    } else {
      addToast('error', res.error || 'Failed to approve');
    }
  };

  const handleReject = async () => {
    if (!selectedRequest) return;
    const res = await window.kadal.approvals.reject(selectedRequest.id, notes);
    if (res.success) {
      addToast('success', 'Request rejected');
      setSelectedRequest(null);
      setNotes('');
      loadRequests();
    } else {
      addToast('error', res.error || 'Failed to reject');
    }
  };

  const renderDataDetail = (data, type) => {
    try {
      const parsed = JSON.parse(data);
      if (type === 'CREATE_CHALLAN') {
        return (
          <div className="approval-review-container">
            <div className="approval-section">
              <div className="approval-section-title"><User size={14}/> Receiver Information</div>
              <div className="approval-grid">
                <div className="approval-item">
                  <label>Receiver Name</label>
                  <span>{parsed.receiverName}</span>
                </div>
                <div className="approval-item">
                  <label>Contact/Address</label>
                  <span>{parsed.receiverContact || 'N/A'}</span>
                </div>
              </div>
            </div>

            <div className="approval-section">
              <div className="approval-section-title"><Package size={14}/> Items to Deliver</div>
              <table className="approval-table">
                <thead>
                  <tr>
                    <th>Item Name</th>
                    <th className="text-right">Quantity</th>
                    <th className="text-right">Unit</th>
                  </tr>
                </thead>
                <tbody>
                  {parsed.items.map((it, idx) => (
                    <tr key={idx}>
                      <td>{it.name}</td>
                      <td className="text-right fw-bold">{it.quantity}</td>
                      <td className="text-right">{it.unit}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            
            {parsed.notes && (
              <div className="approval-section">
                <div className="approval-section-title"><FileText size={14}/> Notes</div>
                <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{parsed.notes}</p>
              </div>
            )}
          </div>
        );
      }
      
      if (type === 'CREATE_GATE_PASS') {
        return (
          <div className="approval-review-container">
            <div className="approval-section">
              <div className="approval-section-title"><FileText size={14}/> Gate Pass Details</div>
              <div className="approval-grid">
                <div className="approval-item">
                  <label>Linked Challans</label>
                  <span>{parsed.challanIds?.length || 0} items</span>
                </div>
                <div className="approval-item">
                  <label>Poly Bags</label>
                  <span>{parsed.polyBags || 0}</span>
                </div>
                <div className="approval-item">
                  <label>Cartons</label>
                  <span>{parsed.cartons || 0}</span>
                </div>
                <div className="approval-item">
                  <label>Plastic Bags</label>
                  <span>{parsed.plasticBags || 0}</span>
                </div>
              </div>
            </div>
          </div>
        );
      }

      if (type === 'CREATE_ITEM' || type === 'UPDATE_ITEM') {
        return (
          <div className="approval-review-container">
            <div className="approval-section">
              <div className="approval-section-title"><Package size={14}/> {type === 'CREATE_ITEM' ? 'New Item Details' : 'Updated Item Details'}</div>
              <div className="approval-grid">
                {parsed.itemCode && <div className="approval-item"><label>Code</label><span>{parsed.itemCode}</span></div>}
                <div className="approval-item"><label>Name</label><span>{parsed.name || parsed.data?.name}</span></div>
                {parsed.openingStock !== undefined && <div className="approval-item"><label>Opening Stock</label><span>{parsed.openingStock}</span></div>}
                {parsed.data?.unitPrice !== undefined && <div className="approval-item"><label>New Price</label><span>{parsed.data.unitPrice}</span></div>}
              </div>
            </div>
          </div>
        );
      }

      if (type === 'STOCK_MOVEMENT') {
        return (
          <div className="approval-review-container">
            <div className="approval-section">
              <div className="approval-section-title"><History size={14}/> Stock Movement</div>
              <div className="approval-grid">
                <div className="approval-item"><label>Item</label><span>{parsed.itemName || parsed.itemId}</span></div>
                <div className="approval-item"><label>Type</label><span className={`badge ${parsed.type === 'IN' ? 'badge-success' : 'badge-danger'}`}>{parsed.type}</span></div>
                <div className="approval-item"><label>Quantity</label><span className="fw-bold">{parsed.quantity}</span></div>
                <div className="approval-item"><label>Reference</label><span>{parsed.reference || 'N/A'}</span></div>
                <div className="approval-item full-width"><label>Reason/Notes</label><span>{parsed.notes || 'No notes provided'}</span></div>
              </div>
            </div>
          </div>
        );
      }

      return <pre style={{ background: 'var(--bg-primary)', padding: 10, borderRadius: 6, fontSize: 12 }}>{JSON.stringify(parsed, null, 2)}</pre>;
    } catch (e) {
      return <div className="text-danger">Error parsing data: {e.message}</div>;
    }
  };

  return (
    <div className="page-container">
      <header className="page-header">
        <div className="header-title">
          <CheckCircle size={24} className="text-primary" />
          <h1>Approvals Management</h1>
        </div>
        <div className="header-actions flex items-center gap-4">
          {isAdmin && (
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer' }}>
              <input type="checkbox" checked={showAll} onChange={e => setShowAll(e.target.checked)} />
              Show All Users' Requests
            </label>
          )}
        </div>
      </header>

      <div className="tabs">
        <button className={`tab ${activeTab === 'pending' ? 'active' : ''}`} onClick={() => setActiveTab('pending')}>Pending Requests</button>
        <button className={`tab ${activeTab === 'history' ? 'active' : ''}`} onClick={() => setActiveTab('history')}>Approval History</button>
      </div>

      <div className="card">
        {loading ? (
          <div className="loading"><div className="spinner"></div></div>
        ) : requests.length === 0 ? (
          <div className="empty-state">
            <CheckCircle size={48} />
            <h3>No {activeTab} requests</h3>
            <p>Everything looks clear!</p>
          </div>
        ) : (
          <div className="table-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Type</th>
                  <th>Requested By</th>
                  {activeTab === 'history' && <th>Status</th>}
                  <th className="text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {requests.map(req => (
                  <tr key={req.id}>
                    <td className="text-muted" style={{ fontSize: 12 }}>{new Date(req.created_at).toLocaleString()}</td>
                    <td>
                      <span className="badge badge-info">{req.type.replace(/_/g, ' ')}</span>
                    </td>
                    <td>
                      <div className="flex items-center gap-2">
                        <div className="topbar-user-avatar" style={{ width: 24, height: 24, fontSize: 10 }}>{req.requester_name?.charAt(0)}</div>
                        <span>{req.requester_name}</span>
                      </div>
                    </td>
                    {activeTab === 'history' && (
                      <td>
                        <span className={`badge badge-${req.status === 'APPROVED' ? 'success' : 'danger'}`}>
                          {req.status}
                        </span>
                      </td>
                    )}
                    <td className="text-right">
                      <button className="btn btn-sm btn-outline" onClick={() => setSelectedRequest(req)}>
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

      {selectedRequest && (
        <div className="modal-overlay" onClick={() => setSelectedRequest(null)}>
          <div className="modal" style={{ maxWidth: 650 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title flex items-center gap-2">
                <Clock size={18} className="text-warning" />
                {selectedRequest.status === 'PENDING' ? 'Review Request' : 'Request Details'}: {selectedRequest.type.replace(/_/g, ' ')}
              </div>
              <button className="btn btn-ghost btn-sm" onClick={() => setSelectedRequest(null)}>&times;</button>
            </div>
            <div className="modal-body">
              <div style={{ marginBottom: 24 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                  <div className="topbar-user-avatar">{selectedRequest.requester_name?.charAt(0)}</div>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 600 }}>{selectedRequest.requester_name}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Requested {new Date(selectedRequest.created_at).toLocaleString()}</div>
                  </div>
                  {selectedRequest.status !== 'PENDING' && (
                    <div style={{ marginLeft: 'auto' }}>
                      <span className={`badge badge-${selectedRequest.status === 'APPROVED' ? 'success' : 'danger'}`} style={{ fontSize: 14, padding: '6px 16px' }}>
                        {selectedRequest.status}
                      </span>
                    </div>
                  )}
                </div>

                {renderDataDetail(selectedRequest.data, selectedRequest.type)}

                {selectedRequest.status !== 'PENDING' && selectedRequest.notes && (
                  <div className="approval-section" style={{ marginTop: 20, borderLeft: `4px solid var(--${selectedRequest.status === 'APPROVED' ? 'success' : 'danger'})` }}>
                    <div className="approval-section-title">Admin Response Notes</div>
                    <p style={{ fontSize: 13, whiteSpace: 'pre-wrap' }}>{selectedRequest.notes}</p>
                  </div>
                )}
              </div>

              {selectedRequest.status === 'PENDING' && (
                <div className="approval-notes-box">
                  <div className="form-group">
                    <label className="form-label">Decision Notes</label>
                    <textarea 
                      className="form-textarea" 
                      rows={3} 
                      placeholder="Enter reason for approval or rejection (optional)..." 
                      value={notes}
                      onChange={e => setNotes(e.target.value)}
                    />
                  </div>
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn btn-outline" onClick={() => setSelectedRequest(null)}>{selectedRequest.status === 'PENDING' ? 'Later' : 'Close'}</button>
              {selectedRequest.status === 'PENDING' && isAdmin && (
                <>
                  <button className="btn btn-danger" onClick={handleReject}>
                    <XCircle size={16} /> Reject Request
                  </button>
                  <button className="btn btn-primary" onClick={handleApprove}>
                    <CheckCircle size={16} /> Approve & Execute
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

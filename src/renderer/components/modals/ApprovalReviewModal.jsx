import React, { useState } from 'react';
import useStore from '../../store/useStore';
import { Clock, CheckCircle, XCircle, Edit2, Download, FileText } from 'lucide-react';

export default function ApprovalReviewModal({ data, onSaved }) {
  const { addToast, closeModal, openModal, setModalMinimized, modal, user, showConfirm } = useStore();
  const { selectedRequest, renderDataDetail } = data;
  const isMinimized = modal?.isMinimized;
  const isAdmin = user?.roleName === 'Super Admin' || user?.roleName === 'Admin';
  
  const [notes, setNotes] = useState('');

  const handleApprove = async () => {
    // Duplicate check for Challan requests
    if (selectedRequest.type === 'CREATE_CHALLAN') {
      const items = selectedRequest.data?.items || [];
      const seenItems = new Set();
      let hasDuplicate = false;
      for (const it of items) {
        const namePart = String(it.name || '').trim().toLowerCase();
        const sizePart = String(it.size || '').trim().toLowerCase();
        const key = `${namePart}|${sizePart}`;
        if (seenItems.has(key)) {
          hasDuplicate = true;
          break;
        }
        seenItems.add(key);
      }


      if (hasDuplicate) {
        const confirmed = await showConfirm({
          title: 'Duplicate Items Detected',
          message: 'It seems items are duplicate please check before submit/approved. Do you want to proceed?',
          confirmText: 'Checked',
          cancelText: 'Cancel',
          type: 'warning'
        });
        if (!confirmed) return;
      }
    }

    try {
      const res = await window.kadal.approvals.approve(selectedRequest.id, notes);
      if (res.success) {
        addToast('success', 'Request approved');
        if (onSaved) onSaved();
        closeModal();
      } else addToast('error', res.error);
    } catch (err) { addToast('error', err.message); }
  };

  const handleReject = async () => {
    try {
      const res = await window.kadal.approvals.reject(selectedRequest.id, notes);
      if (res.success) {
        addToast('success', 'Request rejected');
        if (onSaved) onSaved();
        closeModal();
      } else addToast('error', res.error);
    } catch (err) { addToast('error', err.message); }
  };

  const handleEditData = () => {
    if (selectedRequest.type === 'CREATE_ITEM' || selectedRequest.type === 'UPDATE_ITEM') {
      const itemData = selectedRequest.type === 'UPDATE_ITEM' ? selectedRequest.data.data : selectedRequest.data;
      openModal('ITEM_FORM', {
        item: selectedRequest.type === 'UPDATE_ITEM' 
          ? { ...selectedRequest.data.oldData, ...itemData } 
          : selectedRequest.data,
        buyers: data.buyers,
        distinctValues: data.distinctValues,
        isApprovalEdit: true,
        isNewItem: selectedRequest.type === 'CREATE_ITEM',
        // We pass a custom save handler
        overrideSave: async (updatedForm) => {
          let newData;
          if (selectedRequest.type === 'UPDATE_ITEM') {
            newData = { ...selectedRequest.data, data: updatedForm };
          } else {
            newData = updatedForm;
          }
          const res = await window.kadal.approvals.updateData(selectedRequest.id, newData);
          if (res.success) {
            addToast('success', 'Request data updated');
            if (onSaved) onSaved();
            closeModal(); // Close both for safety, or we could refresh
          } else addToast('error', res.error);
        }
      });
    }
  };

  const handleDownload = async (type) => {
    try {
      if (selectedRequest.type === 'CREATE_CHALLAN') {
        if (type === 'pdf') await window.kadal.challans.exportPdf(selectedRequest.entityId);
        else await window.kadal.challans.exportExcel(selectedRequest.entityId);
      } else if (selectedRequest.type === 'CREATE_GATE_PASS') {
        await window.kadal.gatePass.exportPdf(selectedRequest.entityId);
      }
      addToast('success', 'Report exported successfully');
    } catch (err) { addToast('error', err.message); }
  };

  return (
    <div className={`modal-overlay ${isMinimized ? 'minimized-mode' : ''}`}>
      <div className={`modal ${isMinimized ? 'minimized' : ''}`} style={{ maxWidth: 650 }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title flex items-center gap-2">
            <Clock size={18} className="text-warning" />
            {selectedRequest.status === 'PENDING' ? 'Review Request' : 'Request Details'}: {selectedRequest.type.replace(/_/g, ' ')}
          </div>
          <div className="modal-controls">
            <button className="btn-control btn-minimize" onClick={() => setModalMinimized(!isMinimized)} title={isMinimized ? 'Restore' : 'Minimize'}>{isMinimized ? '+' : '-'}</button>
            <button className="btn-control btn-close" onClick={closeModal} title="Close">✕</button>
          </div>
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

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--text-secondary)' }}>Request Data</div>
              {selectedRequest.status === 'PENDING' && isAdmin && (selectedRequest.type === 'CREATE_ITEM' || selectedRequest.type === 'UPDATE_ITEM') && (
                <button className="btn btn-ghost btn-sm" onClick={handleEditData}>
                  <Edit2 size={14} /> Edit Data
                </button>
              )}
            </div>

            {renderDataDetail(selectedRequest.data, selectedRequest.type)}

            {selectedRequest.status !== 'PENDING' && selectedRequest.notes && (
              <div className="approval-section" style={{ marginTop: 20, borderLeft: `4px solid var(--${selectedRequest.status === 'APPROVED' ? 'success' : 'danger'})` }}>
                <div className="approval-section-title">Admin Response Notes</div>
                <p style={{ fontSize: 13, whiteSpace: 'pre-wrap' }}>{selectedRequest.notes}</p>
              </div>
            )}

            {selectedRequest.status === 'APPROVED' && selectedRequest.entityId && (
              <div className="approval-section" style={{ marginTop: 20, borderLeft: '4px solid var(--accent)', background: 'var(--accent-dim)' }}>
                <div className="approval-section-title" style={{ color: 'var(--accent)' }}>Generated Document</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 8 }}>
                  <div className="badge badge-outline" style={{ borderColor: 'var(--accent)', color: 'var(--accent)' }}>
                    {selectedRequest.entityNumber || 'Document Created'}
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button className="btn btn-ghost btn-sm" onClick={() => handleDownload('pdf')}>
                      <FileText size={14} /> PDF
                    </button>
                    {selectedRequest.type === 'CREATE_CHALLAN' && (
                      <button className="btn btn-ghost btn-sm" onClick={() => handleDownload('excel')}>
                        <Download size={14} /> Excel
                      </button>
                    )}
                  </div>
                </div>
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
          <button className="btn btn-outline" onClick={closeModal}>{selectedRequest.status === 'PENDING' ? 'Later' : 'Close'}</button>
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
  );
}

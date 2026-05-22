import React from 'react';
import useStore from '../../store/useStore';
import { AlertTriangle } from 'lucide-react';

export default function ConfirmDialog() {
  const { confirmDialog, closeConfirm } = useStore();
  if (!confirmDialog) return null;

  return (
    <div className="modal-overlay confirm-overlay" onClick={() => closeConfirm(false)}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 420 }}>
        <div className="modal-body">
          <div className={`confirm-icon ${confirmDialog.type || 'danger'}`}>
            <AlertTriangle size={24} />
          </div>
          <h3 className="confirm-title">{confirmDialog.title || 'Are you sure?'}</h3>
          <p className="confirm-message">{confirmDialog.message}</p>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
            <button className="btn btn-outline" onClick={() => closeConfirm(false)}>Cancel</button>
            <button className={`btn btn-${confirmDialog.type || 'danger'}`} onClick={() => closeConfirm(true)}>
              {confirmDialog.confirmText || 'Confirm'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

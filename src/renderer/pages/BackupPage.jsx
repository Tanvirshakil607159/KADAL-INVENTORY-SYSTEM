import React, { useEffect, useState } from 'react';
import useStore from '../store/useStore';
import { HardDrive, Upload, Download, Clock, FolderOpen } from 'lucide-react';

export default function BackupPage() {
  const { addToast } = useStore();
  const [backups, setBackups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  const loadBackups = async () => {
    setLoading(true);
    const res = await window.kadal.backup.getHistory();
    if (res.success) setBackups(res.data);
    setLoading(false);
  };

  useEffect(() => { loadBackups(); }, []);

  const createBackup = async () => {
    setCreating(true);
    const res = await window.kadal.backup.create();
    if (res.success) {
      addToast('success', `Backup created: ${res.data.name}`);
      loadBackups();
    } else addToast('error', res.error || 'Backup failed');
    setCreating(false);
  };

  const restoreBackup = async () => {
    const filePath = await window.kadal.backup.selectFile();
    if (!filePath?.data) return;
    const confirm = window.confirm('⚠️ This will replace your current database with the backup. The app will need to restart. Continue?');
    if (!confirm) return;
    const res = await window.kadal.backup.restore(filePath.data);
    if (res.success) {
      addToast('success', res.data?.message || 'Backup restored! Please restart.');
    } else addToast('error', res.error || 'Restore failed');
  };

  const formatSize = (bytes) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
  };

  const downloadBackup = async (b) => {
    const res = await window.kadal.backup.download(b.path);
    if (res.success) {
      addToast('success', `Backup saved to ${res.data.path}`);
    } else if (res.error) {
      addToast('error', res.error || 'Failed to save backup');
    }
  };

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 }}>
        <div className="card" style={{ textAlign: 'center', cursor: 'pointer' }} onClick={createBackup}>
          <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'var(--success-dim)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
            <Download size={24} color="var(--success)" />
          </div>
          <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>Create Backup</h3>
          <p className="text-muted" style={{ fontSize: 13 }}>Save a copy of the current database</p>
          {creating && <div className="spinner" style={{ margin: '12px auto' }}></div>}
        </div>

        <div className="card" style={{ textAlign: 'center', cursor: 'pointer' }} onClick={restoreBackup}>
          <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'var(--warning-dim)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
            <Upload size={24} color="var(--warning)" />
          </div>
          <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>Restore Backup</h3>
          <p className="text-muted" style={{ fontSize: 13 }}>Restore database from a backup file</p>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <h3 className="card-title"><Clock size={16} style={{ marginRight: 8, verticalAlign: 'middle' }} />Backup History</h3>
        </div>
        {loading ? <div className="loading"><div className="spinner"></div></div> : backups.length === 0 ? (
          <div className="empty-state"><HardDrive size={48} /><h3>No backups yet</h3><p>Create your first backup to secure your data</p></div>
        ) : (
          <div className="table-wrapper">
            <table className="data-table">
              <thead><tr><th>Backup Name</th><th>Size</th><th>Created</th><th style={{ width: 80 }}>Actions</th></tr></thead>
              <tbody>
                {backups.map((b, i) => (
                  <tr key={i}>
                    <td className="text-mono" style={{ fontSize: 12 }}>{b.name}</td>
                    <td>{formatSize(b.size)}</td>
                    <td>{new Date(b.createdAt).toLocaleString('en-GB')}</td>
                    <td>
                      <button className="btn btn-sm btn-outline" onClick={() => downloadBackup(b)} title="Download Backup">
                        <Download size={14} />
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

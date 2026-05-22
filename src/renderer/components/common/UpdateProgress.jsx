import React, { useState, useEffect } from 'react';
import { Download, CheckCircle, XCircle } from 'lucide-react';

export default function UpdateProgress() {
  const [progress, setProgress] = useState(null);
  const [status, setStatus] = useState('idle'); // idle | downloading | error
  const [error, setError] = useState(null);

  useEffect(() => {
    const unsubProgress = window.kadal.update.onDownloadProgress((data) => {
      setProgress(data);
      setStatus('downloading');
    });

    const unsubAvailable = window.kadal.update.onUpdateAvailable(() => {
      setStatus('downloading');
    });

    const unsubError = window.kadal.update.onUpdateError((err) => {
      setError(err);
      setStatus('error');
      // Hide error after 10 seconds
      setTimeout(() => {
        setStatus('idle');
        setError(null);
      }, 10000);
    });
    
    return () => {
      unsubProgress();
      unsubAvailable();
      unsubError();
    };
  }, []);

  if (status === 'idle') return null;

  if (status === 'error') {
    return (
      <div className="update-progress-bar" style={{ borderColor: 'var(--danger)' }}>
        <div className="update-progress-content">
          <div className="update-progress-title" style={{ color: 'var(--danger)' }}>
            <XCircle size={16} />
            <span>Update Error</span>
          </div>
          <div className="text-muted" style={{ fontSize: 11 }}>{error}</div>
        </div>
      </div>
    );
  }

  if (!progress) return null;

  const percent = Math.round(progress.percent || 0);
  const mbTransferred = (progress.transferred / (1024 * 1024)).toFixed(1);
  const mbTotal = (progress.total / (1024 * 1024)).toFixed(1);
  const speed = (progress.bytesPerSecond / (1024 * 1024)).toFixed(1);

  return (
    <div className="update-progress-bar">
      <div className="update-progress-content">
        <div className="update-progress-header">
          <div className="update-progress-title">
            <Download size={16} className="animate-bounce" />
            <span>Downloading Update...</span>
          </div>
          <span className="update-progress-percent">{percent}%</span>
        </div>
        
        <div className="progress-track">
          <div 
            className="progress-fill" 
            style={{ width: `${percent}%` }}
          />
        </div>
        
        <div className="update-progress-footer">
          <span>{mbTransferred} MB / {mbTotal} MB</span>
          <span>{speed} MB/s</span>
        </div>
      </div>
    </div>
  );
}

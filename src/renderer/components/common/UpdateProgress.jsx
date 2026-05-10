import React, { useState, useEffect } from 'react';
import { Download, CheckCircle, XCircle } from 'lucide-react';

export default function UpdateProgress() {
  const [progress, setProgress] = useState(null);
  const [status, setStatus] = useState('idle'); // idle | downloading | complete | error

  useEffect(() => {
    const cleanup = window.kadal.update.onDownloadProgress((data) => {
      setProgress(data);
      setStatus('downloading');
    });

    // Reset UI when the update is fully downloaded
    // We don't have a direct 'onDownloaded' in preload yet, 
    // but the main process shows a dialog anyway.
    
    return () => cleanup();
  }, []);

  if (status === 'idle' || !progress) return null;

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

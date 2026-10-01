import React from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary caught an unhandled error:', error, errorInfo);
  }

  handleReload = () => {
    window.location.reload();
  };

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 30,
          background: 'var(--bg-base, #0f172a)',
          color: 'var(--text-primary, #f8fafc)',
          textAlign: 'center'
        }}>
          <div style={{
            background: 'var(--bg-card, #1e293b)',
            padding: 36,
            borderRadius: 16,
            border: '1px solid var(--border, rgba(255,255,255,0.1))',
            maxWidth: 500,
            width: '100%',
            boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)'
          }}>
            <div style={{
              width: 56,
              height: 56,
              borderRadius: '50%',
              background: 'rgba(239, 68, 68, 0.15)',
              color: '#ef4444',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 20px auto'
            }}>
              <AlertTriangle size={32} />
            </div>

            <h2 style={{ fontSize: 20, fontWeight: 700, margin: '0 0 10px 0' }}>Something went wrong</h2>
            <p style={{ fontSize: 13, color: 'var(--text-muted, #94a3b8)', margin: '0 0 24px 0', lineHeight: 1.5 }}>
              The application encountered an unexpected error while rendering this page. You can reload to restore normal operation.
            </p>

            {this.state.error && (
              <pre style={{
                textAlign: 'left',
                padding: 12,
                borderRadius: 8,
                background: 'rgba(0,0,0,0.25)',
                color: '#f87171',
                fontSize: 11,
                overflowX: 'auto',
                marginBottom: 24,
                maxHeight: 120
              }}>
                {this.state.error.message || String(this.state.error)}
              </pre>
            )}

            <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
              <button
                className="btn btn-outline"
                onClick={this.handleReset}
                style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 16px', fontSize: 13 }}
              >
                <RefreshCw size={14} /> Try Again
              </button>
              <button
                className="btn btn-primary"
                onClick={this.handleReload}
                style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 16px', fontSize: 13 }}
              >
                <Home size={14} /> Reload App
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

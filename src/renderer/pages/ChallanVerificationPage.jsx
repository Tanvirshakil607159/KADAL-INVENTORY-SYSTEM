import React, { useState, useEffect, useMemo } from 'react';
import { CheckCircle2, Download, AlertTriangle, Shield, ShieldCheck, FileText, Phone, MapPin, User, Calendar, Info, RefreshCw, Hash, Clock, Building2, Package } from 'lucide-react';
import logo from '../assets/logo.png';
import pdfMake from 'pdfmake/build/pdfmake';
import pdfFonts from 'pdfmake/build/vfs_fonts';
import QRCode from 'qrcode';

// Initialize pdfmake vfs
pdfMake.vfs = pdfFonts.pdfMake ? pdfFonts.pdfMake.vfs : pdfFonts.vfs;

// Helper to convert logo asset URL to base64
async function getBase64FromUrl(url) {
  try {
    const data = await fetch(url);
    const blob = await data.blob();
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result);
      reader.onerror = () => reject(new Error('FileReader error'));
      reader.readAsDataURL(blob);
    });
  } catch (err) {
    console.error('Failed to convert logo to base64:', err);
    return null;
  }
}

// Generate a deterministic verification hash from challan data
function generateVerificationHash(challan) {
  const raw = `${challan.challan_number}-${challan.challan_date}-${challan.receiver_name}-${challan.id}`;
  let hash = 0;
  for (let i = 0; i < raw.length; i++) {
    const chr = raw.charCodeAt(i);
    hash = ((hash << 5) - hash) + chr;
    hash |= 0;
  }
  return Math.abs(hash).toString(16).toUpperCase().padStart(8, '0');
}

// Browser PNG QR generator
async function generateQRSvg(value) {
  try {
    // Generate clean PNG Data URL for QR codes.
    // Use errorCorrectionLevel 'L' to keep the grid size minimum (larger dots)
    // and margin 4 (standard quiet zone) for maximum scanning reliability.
    return await QRCode.toDataURL(value, {
      errorCorrectionLevel: 'L',
      margin: 4,
      width: 300
    });
  } catch (err) {
    console.error('[PdfGenerator] QR code generation failed:', err.message);
    return null;
  }
}

export default function ChallanVerificationPage({ challanNumber }) {
  const [challan, setChallan] = useState(null);
  const [settings, setSettings] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [downloading, setDownloading] = useState(false);

  const verifiedAt = useMemo(() => new Date().toLocaleString('en-GB', {
    dateStyle: 'medium', timeStyle: 'medium'
  }), []);

  useEffect(() => {
    let active = true;
    async function loadData() {
      try {
        setLoading(true);
        setError(null);

        // Fetch config.json from public root if url/key are not in storage/params (web fallback)
        const urlParams = new URLSearchParams(window.location.search);
        let hasParams = urlParams.get('u') && urlParams.get('k');
        if (!hasParams && window.location.hash) {
          const qIndex = window.location.hash.indexOf('?');
          if (qIndex !== -1) {
            const hashParams = new URLSearchParams(window.location.hash.substring(qIndex));
            hasParams = hashParams.get('u') && hashParams.get('k');
          }
        }

        if (!hasParams && !localStorage.getItem('supabase_url') && !sessionStorage.getItem('temp_supabase_url')) {
          try {
            console.log('[Verification] Fetching backend config from server...');
            const configRes = await fetch('/config.json');
            if (configRes.ok) {
              const config = await configRes.json();
              if (config.supabase_url && config.supabase_key) {
                sessionStorage.setItem('temp_supabase_url', config.supabase_url);
                sessionStorage.setItem('temp_supabase_key', config.supabase_key);
                console.log('[Verification] Backend credentials loaded from config.json.');
              }
            }
          } catch (configErr) {
            console.warn('Failed to load local config.json:', configErr);
          }
        }
        
        const [challanRes, settingsRes] = await Promise.all([
          window.kadal.challans.getByNumber(challanNumber),
          window.kadal.settings.getAll().catch(err => {
            console.error('Failed to load settings:', err);
            return { success: false };
          })
        ]);

        if (!active) return;

        if (settingsRes && settingsRes.success) {
          setSettings(settingsRes.data);
        }

        if (challanRes && challanRes.success && challanRes.data) {
          setChallan(challanRes.data);
        } else {
          setError(challanRes?.error || `Delivery Challan ${challanNumber} not found in KADAL database.`);
        }
      } catch (err) {
        if (!active) return;
        setError(err.message || 'An error occurred while fetching the verification slip.');
      } finally {
        if (active) setLoading(false);
      }
    }

    loadData();
    return () => { active = false; };
  }, [challanNumber]);

  const handleDownload = async () => {
    if (!challan) return;
    setDownloading(true);
    try {
      const logoBase64 = await getBase64FromUrl(logo);
      const companyName = settings.company_name || 'KA Design Accessories LTD';
      const companyAddress = settings.company_address || '';
      const companyPhone = settings.company_phone || '';
      
      const baseUrl = (settings.public_web_url || 'https://kadal-inventory.web.app').trim().replace(/\/$/, '');
      const verificationUrl = `${baseUrl}/challan/${challan.challan_number}`;

      const barcodeSvg = await generateQRSvg(verificationUrl);

      const rightStack = [
        { text: 'DELIVERY CHALLAN', style: 'challanTitle' },
        { text: `No: ${challan.challan_number}`, style: 'challanNumber' },
        { text: `Date: ${new Date(challan.challan_date).toLocaleDateString('en-GB')}`, style: 'challanDate' },
        { text: `Status: ${challan.status}`, style: challan.status === 'CANCELLED' ? 'statusCancelled' : 'statusActive' },
      ];

      if (barcodeSvg) {
        rightStack.push({
          table: {
            widths: [110],
            body: [
              [{ image: barcodeSvg, fit: [110, 110], alignment: 'center', link: verificationUrl }],
              [{ text: challan.challan_number, alignment: 'center', fontSize: 10, bold: true, color: '#6366f1', margin: [0, 3, 0, 0], link: verificationUrl, noWrap: true }]
            ]
          },
          layout: {
            hLineWidth: () => 0,
            vLineWidth: () => 0,
            paddingLeft: () => 0,
            paddingRight: () => 0,
            paddingTop: () => 0,
            paddingBottom: () => 0,
          },
          alignment: 'right',
          margin: [0, 4, 0, 0]
        });
      }

      const docDefinition = {
        pageSize: 'A4',
        pageMargins: [40, 40, 40, 60],
        background: (currentPage, pageSize) => {
          if (!logoBase64) return null;
          return {
            image: logoBase64,
            width: 400,
            opacity: 0.05,
            absolutePosition: { x: (pageSize.width - 400) / 2, y: (pageSize.height - 400) / 2 }
          };
        },
        content: [
          // Header
          {
            columns: [
              {
                width: '*',
                stack: [
                  settings.company_logo ? { image: settings.company_logo, fit: [350, 180], margin: [0, 0, 0, 5] } : { text: companyName, style: 'companyName' },
                  companyAddress ? { text: companyAddress, style: 'companyInfo', bold: true } : {},
                  companyPhone ? { text: `Phone: ${companyPhone}`, style: 'companyInfo', bold: true } : {},
                  settings.company_email ? { text: `Email: ${settings.company_email}`, style: 'companyInfo', bold: true } : {},
                ],
              },
              {
                width: 'auto',
                stack: rightStack,
                alignment: 'right',
              },
            ],
          },
          { canvas: [{ type: 'line', x1: 0, y1: 5, x2: 515, y2: 5, lineWidth: 1.5, lineColor: '#6366f1' }] },

          // Receiver Info
          { text: '', margin: [0, 15, 0, 0] },
          {
            table: {
              widths: ['auto', '*'],
              body: [
                [{ text: 'Delivered To:', style: 'label' }, { text: challan.receiver_name, style: 'value', bold: true }],
                [{ text: 'Contact:', style: 'label' }, { text: challan.receiver_contact || '-', style: 'value' }],
                [{ text: 'Address:', style: 'label' }, { text: challan.receiver_address || '-', style: 'value' }],
              ],
            },
            layout: 'noBorders',
          },

          // Items Table
          { text: '', margin: [0, 15, 0, 0] },
          (() => {
            const headers = [
              { text: '#', style: 'tableHeader' },
              { text: 'Item', style: 'tableHeader' },
              { text: 'Style/Purchase/Order', style: 'tableHeader' },
              { text: 'Size/Color', style: 'tableHeader' },
              { text: 'Buyer', style: 'tableHeader' },
              { text: 'Shipped Quantity', style: 'tableHeader', alignment: 'right' },
              { text: 'Unit', style: 'tableHeader' },
            ];
            const widths = [25, '*', 110, 80, 80, 70, 40];
            const colCount = headers.length;

            const rows = challan.items.map((item, idx) => {
              const spo = [item.style_name, item.purchase_no, item.order_number].filter(Boolean).join(' / ') || '-';
              return [
                { text: idx + 1, style: 'tableCell' },
                { text: item.item_name, style: 'tableCell' },
                { text: spo, style: 'tableCell', fontSize: 8 },
                { text: [item.size, item.color].filter(Boolean).join(' / ') || '-', style: 'tableCell' },
                { text: item.buyer_name || '-', style: 'tableCell' },
                { text: item.quantity.toString(), style: 'tableCell', alignment: 'right', bold: true },
                { text: item.unit, style: 'tableCell' },
              ];
            });

            const totalRow = [];
            for (let c = 0; c < colCount - 2; c++) {
              if (c === 0) totalRow.push({ text: '', colSpan: colCount - 2 });
              else totalRow.push({});
            }
            totalRow.push({ text: challan.items.reduce((s, i) => s + i.quantity, 0).toString(), style: 'tableCell', alignment: 'right', bold: true, fillColor: '#f0f0ff' });
            totalRow.push({ text: 'Total', style: 'tableCell', bold: true, fillColor: '#f0f0ff' });

            return {
              table: { headerRows: 1, widths, body: [headers, ...rows, totalRow] },
              layout: {
                hLineWidth: () => 0.5, vLineWidth: () => 0.5,
                hLineColor: () => '#ddd', vLineColor: () => '#ddd',
                fillColor: (rowIndex) => rowIndex === 0 ? '#6366f1' : null,
              },
            };
          })(),

          // Notes
          challan.notes ? { text: '', margin: [0, 15, 0, 0] } : {},
          challan.notes ? { text: 'Notes:', style: 'label' } : {},
          challan.notes ? { text: challan.notes, style: 'notes' } : {},

          // Cancel info
          challan.status === 'CANCELLED' ? { text: '', margin: [0, 15, 0, 0] } : {},
          challan.status === 'CANCELLED' ? {
            table: {
              widths: ['*'],
              body: [[{
                text: `CANCELLED - Reason: ${challan.cancel_reason || 'Not specified'}`,
                style: 'cancelledBanner',
              }]],
            },
            layout: 'noBorders',
          } : {},

          // Signatures
          { text: '', margin: [0, 50, 0, 0] },
          {
            columns: [
              { width: '*', stack: [{ canvas: [{ type: 'line', x1: 0, y1: 0, x2: 110, y2: 0, lineWidth: 1 }] }, { text: 'Prepared By', margin: [0, 5, 0, 0], fontSize: 9, color: '#666' }] },
              { width: '*', stack: [{ canvas: [{ type: 'line', x1: 0, y1: 0, x2: 110, y2: 0, lineWidth: 1 }] }, { text: 'Store Incharge', margin: [0, 5, 0, 0], fontSize: 9, color: '#666' }] },
              { width: '*', stack: [{ canvas: [{ type: 'line', x1: 0, y1: 0, x2: 110, y2: 0, lineWidth: 1 }] }, { text: 'Received By', margin: [0, 5, 0, 0], fontSize: 9, color: '#666' }] },
              { width: '*', stack: [{ canvas: [{ type: 'line', x1: 0, y1: 0, x2: 110, y2: 0, lineWidth: 1 }] }, { text: 'Authorized Signature', margin: [0, 5, 0, 0], fontSize: 9, color: '#666' }], alignment: 'right' },
            ],
          },
        ],
        styles: {
          companyName: { fontSize: 18, bold: true, color: '#1a1a2e' },
          companyInfo: { fontSize: 9, color: '#666', margin: [0, 2, 0, 0] },
          challanTitle: { fontSize: 16, bold: true, color: '#6366f1' },
          challanNumber: { fontSize: 11, margin: [0, 4, 0, 0], color: '#333' },
          challanDate: { fontSize: 10, color: '#666', margin: [0, 2, 0, 0] },
          statusActive: { fontSize: 10, color: '#10b981', bold: true, margin: [0, 2, 0, 0] },
          statusCancelled: { fontSize: 10, color: '#ef4444', bold: true, margin: [0, 2, 0, 0] },
          label: { fontSize: 9, color: '#666', margin: [0, 2, 0, 0] },
          value: { fontSize: 10, color: '#333' },
          tableHeader: { fontSize: 9, bold: true, color: '#fff', margin: [4, 6, 4, 6] },
          tableCell: { fontSize: 8, margin: [4, 5, 4, 5], color: '#333' },
          notes: { fontSize: 9, color: '#555', italics: true, margin: [0, 4, 0, 0] },
          cancelledBanner: { fontSize: 12, bold: true, color: '#fff', fillColor: '#ef4444', alignment: 'center', margin: [10, 10, 10, 10] },
        },
        footer: (currentPage, pageCount) => ({
          columns: [
            { text: `Generated by KADAL Inventory System`, fontSize: 7, color: '#999', margin: [40, 0, 0, 0] },
            { text: `Page ${currentPage} of ${pageCount}`, fontSize: 7, color: '#999', alignment: 'right', margin: [0, 0, 40, 0] },
          ],
        }),
      };

      pdfMake.createPdf(docDefinition).download(`challan-${challan.challan_number}.pdf`);
    } catch (err) {
      console.error('Error generating PDF:', err);
      alert('Failed to generate PDF. Error: ' + err.message);
    } finally {
      setDownloading(false);
    }
  };

  // ─── Loading State ──────────────────────────────────────────
  if (loading) {
    return (
      <div className="verification-portal">
        <style>{stylesText}</style>
        <div className="loading-container">
          <div className="spinner"></div>
          <p className="loading-text">Verifying challan with KADAL secure database...</p>
          <p className="loading-sub">Authenticating document integrity</p>
        </div>
      </div>
    );
  }

  // ─── Error State ────────────────────────────────────────────
  if (error) {
    return (
      <div className="verification-portal">
        <style>{stylesText}</style>
        <div className="portal-container">
          <div className="portal-header">
            <div className="portal-logo-text">KADAL</div>
            <div className="portal-subtitle">Verification System</div>
          </div>
          <div className="slip-card" style={{ border: '1px solid rgba(239, 68, 68, 0.2)' }}>
            <div className="error-card">
              <div className="seal-ring seal-ring-error">
                <AlertTriangle size={40} />
              </div>
              <h2 className="error-title">Verification Failed</h2>
              <p className="error-text">{error}</p>
              <p className="error-hint">This challan could not be found in our system. It may be invalid or the document may have been tampered with.</p>
              <button className="action-btn action-btn-secondary" onClick={() => window.location.reload()}>
                <RefreshCw size={18} /> Retry Verification
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const totalQuantity = (challan?.items || []).reduce((sum, item) => sum + (item.quantity || 0), 0);
  const isCancelled = challan.status === 'CANCELLED';
  const verificationHash = generateVerificationHash(challan);
  const companyName = settings.company_name || 'KA Design Accessories LTD';

  return (
    <div className="verification-portal">
      <style>{stylesText}</style>
      <div className="portal-container">
        
        {/* Portal Header */}
        <div className="portal-header">
          <div className="portal-logo-text">KADAL</div>
          <div className="portal-subtitle">Official Document Verification Portal</div>
        </div>

        {/* ═══════ APPROVAL SLIP CARD ═══════ */}
        <div className={`slip-card ${isCancelled ? 'cancelled' : ''}`}>
          
          {/* ── Verification Seal ── */}
          <div className="seal-section">
            {isCancelled ? (
              <>
                <div className="seal-ring seal-ring-error">
                  <AlertTriangle size={44} />
                </div>
                <h2 className="seal-title seal-title-error">CANCELLED</h2>
                <div className="seal-subtitle">This challan has been voided</div>
              </>
            ) : (
              <>
                <div className="seal-ring seal-ring-verified">
                  <ShieldCheck size={44} />
                </div>
                <h2 className="seal-title seal-title-verified">VERIFIED & APPROVED</h2>
                <div className="seal-subtitle">Authentic Challan by {companyName}</div>
              </>
            )}
          </div>

          {/* ── Certificate Section ── */}
          <div className="certificate-block">
            <div className="cert-header">
              <Shield size={14} className="cert-icon" />
              <span>APPROVAL CERTIFICATE</span>
            </div>
            <div className="cert-body">
              <div className="cert-row">
                <span className="cert-label">Document Type</span>
                <span className="cert-value">Delivery Challan</span>
              </div>
              <div className="cert-row">
                <span className="cert-label">Challan Number</span>
                <span className="cert-value cert-value-mono">{challan.challan_number}</span>
              </div>
              <div className="cert-row">
                <span className="cert-label">Issued By</span>
                <span className="cert-value">{companyName}</span>
              </div>
              <div className="cert-row">
                <span className="cert-label">Delivery Date</span>
                <span className="cert-value">
                  {new Date(challan.challan_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' })}
                </span>
              </div>
              <div className="cert-row">
                <span className="cert-label">Status</span>
                <span className={`cert-status ${isCancelled ? 'cert-status-cancelled' : 'cert-status-active'}`}>
                  {isCancelled ? '✕ CANCELLED' : '✓ DELIVERED'}
                </span>
              </div>
              <div className="cert-row">
                <span className="cert-label">Verification Hash</span>
                <span className="cert-value cert-value-mono cert-hash">#{verificationHash}</span>
              </div>
              <div className="cert-row">
                <span className="cert-label">Verified At</span>
                <span className="cert-value" style={{ fontSize: '11px' }}>{verifiedAt}</span>
              </div>
            </div>
          </div>

          {/* Cancelled Banner */}
          {isCancelled && (
            <div className="cancelled-box">
              <AlertTriangle size={16} style={{ marginBottom: '4px' }} />
              <div className="cancelled-title">Voided Document</div>
              <div className="cancelled-content">
                Reason: {challan.cancel_reason || 'Not specified'}
                {challan.cancelled_by_name && ` • By ${challan.cancelled_by_name}`}
              </div>
            </div>
          )}

          {/* ── Delivery Details ── */}
          <div className="section-label">
            <Package size={13} />
            <span>DELIVERY DETAILS</span>
          </div>
          <div className="details-grid">
            <div className="details-row">
              <span className="details-label"><User size={12} /> Receiver</span>
              <span className="details-value">{challan.receiver_name}</span>
            </div>
            <div className="details-row">
              <span className="details-label"><Phone size={12} /> Contact</span>
              <span className="details-value">{challan.receiver_contact || '-'}</span>
            </div>
            <div className="details-row">
              <span className="details-label"><MapPin size={12} /> Address</span>
              <span className="details-value">{challan.receiver_address || '-'}</span>
            </div>
            <div className="details-row">
              <span className="details-label"><Calendar size={12} /> Created</span>
              <span className="details-value">
                {new Date(challan.created_at || challan.challan_date).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })}
              </span>
            </div>
            {challan.created_by_name && (
              <div className="details-row">
                <span className="details-label"><Info size={12} /> Issuer</span>
                <span className="details-value">{challan.created_by_name}</span>
              </div>
            )}
          </div>

          {/* ── Items Table ── */}
          <div className="section-label">
            <FileText size={13} />
            <span>SHIPPED COMMODITIES</span>
          </div>
          <div className="items-container">
            <div className="table-wrapper">
              <table className="items-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Item Description</th>
                    <th>Style/Purchase/Order</th>
                    <th>Specs</th>
                    <th className="text-right">Qty</th>
                    <th>Unit</th>
                  </tr>
                </thead>
                <tbody>
                  {(challan.items || []).map((item, index) => {
                    const spo = [item.style_name, item.purchase_no, item.order_number].filter(Boolean).join(' / ') || '-';
                    const specs = [item.size, item.color].filter(Boolean).join(' / ') || '-';
                    return (
                      <tr key={item.id || index}>
                        <td className="text-center" style={{ color: 'var(--text-secondary)' }}>{index + 1}</td>
                        <td style={{ fontWeight: '600' }}>{item.item_name}</td>
                        <td style={{ color: 'var(--text-secondary)', fontSize: '11px' }}>{spo}</td>
                        <td style={{ color: 'var(--text-secondary)' }}>{specs}</td>
                        <td className="text-right" style={{ fontWeight: '700', color: 'var(--success)' }}>{item.quantity}</td>
                        <td style={{ color: 'var(--text-secondary)' }}>{item.unit}</td>
                      </tr>
                    );
                  })}
                  <tr className="table-total-row">
                    <td colSpan="4" className="text-right" style={{ textTransform: 'uppercase', fontSize: '10px', letterSpacing: '1px' }}>Total Shipped</td>
                    <td className="text-right" style={{ color: 'var(--success)', fontSize: '13px' }}>{totalQuantity}</td>
                    <td></td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Notes */}
          {challan.notes && (
            <div className="notes-box">
              <div className="notes-title">Special Instructions / Remarks</div>
              <div className="notes-content">"{challan.notes}"</div>
            </div>
          )}

          {/* ── Download Action ── */}
          <div className="download-section">
            <div className="download-label">Download the official challan copy</div>
            <button className="action-btn" onClick={handleDownload} disabled={downloading}>
              {downloading ? (
                <>
                  <RefreshCw size={18} className="spin-icon" /> Generating PDF...
                </>
              ) : (
                <>
                  <Download size={18} /> Download Challan Copy (PDF)
                </>
              )}
            </button>
          </div>

          {/* ── Security Footer ── */}
          <div className="security-footer">
            <div className="security-row">
              <Shield size={12} />
              <span>This document has been digitally verified by KADAL Store inventory system</span>
            </div>
            <div className="security-hash">
              Fingerprint: KADAL-{challan.challan_number}-{verificationHash}
            </div>
          </div>

        </div>

        {/* Footer */}
        <div className="portal-footer">
          <div>© {new Date().getFullYear()} {companyName} — All Rights Reserved</div>
          <div>Powered by KADAL Inventory Management System</div>
        </div>

      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// Premium Obsidian-Dark Approval Slip Styles
// ═══════════════════════════════════════════════════════════════
const stylesText = `
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&family=JetBrains+Mono:wght@500;700&display=swap');

:root {
  --bg-primary: #07080a;
  --bg-card: rgba(18, 21, 28, 0.65);
  --bg-inner: rgba(255, 255, 255, 0.015);
  --border-subtle: rgba(255, 255, 255, 0.07);
  --border-faint: rgba(255, 255, 255, 0.04);
  --text-primary: #f8fafc;
  --text-secondary: #94a3b8;
  --text-muted: #64748b;
  --success: #10b981;
  --success-glow: rgba(16, 185, 129, 0.25);
  --error: #ef4444;
  --error-glow: rgba(239, 68, 68, 0.25);
  --accent: #6366f1;
  --accent-secondary: #818cf8;
  --font-sans: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
  --font-mono: 'JetBrains Mono', 'Fira Code', monospace;
}

* { margin: 0; padding: 0; box-sizing: border-box; }

.verification-portal {
  min-height: 100vh;
  background: var(--bg-primary);
  background: 
    radial-gradient(ellipse at 50% -10%, rgba(16, 185, 129, 0.06), transparent 55%),
    radial-gradient(ellipse at 80% 80%, rgba(99, 102, 241, 0.03), transparent 45%),
    var(--bg-primary);
  color: var(--text-primary);
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 32px 16px;
  overflow-y: auto;
  font-family: var(--font-sans);
  -webkit-font-smoothing: antialiased;
}

.portal-container {
  width: 100%;
  max-width: 620px;
  margin: 0 auto;
}

/* ── Portal Header ── */
.portal-header {
  text-align: center;
  margin-bottom: 28px;
}

.portal-logo-text {
  font-size: 36px;
  font-weight: 900;
  letter-spacing: 6px;
  background: linear-gradient(135deg, #10b981, #34d399, #6366f1);
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
}

.portal-subtitle {
  font-size: 10px;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 3px;
  margin-top: 6px;
  font-weight: 700;
}

/* ── Main Slip Card ── */
.slip-card {
  background: var(--bg-card);
  backdrop-filter: blur(24px);
  -webkit-backdrop-filter: blur(24px);
  border: 1px solid var(--border-subtle);
  border-radius: 24px;
  padding: 36px 28px;
  box-shadow: 
    0 24px 48px rgba(0, 0, 0, 0.55),
    0 0 0 1px rgba(255, 255, 255, 0.02);
  position: relative;
  overflow: hidden;
}

.slip-card::before {
  content: '';
  position: absolute;
  top: 0; left: 0; right: 0; height: 3px;
  background: linear-gradient(90deg, #10b981, #34d399, #6366f1);
}

.slip-card.cancelled::before {
  background: linear-gradient(90deg, #ef4444, #f87171);
}

/* ── Verification Seal ── */
.seal-section {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  margin-bottom: 28px;
  padding-bottom: 24px;
  border-bottom: 1px solid var(--border-faint);
}

.seal-ring {
  width: 88px;
  height: 88px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 16px;
  position: relative;
}

.seal-ring-verified {
  background: rgba(16, 185, 129, 0.06);
  border: 2.5px solid #10b981;
  color: #10b981;
  box-shadow: 
    0 0 30px var(--success-glow),
    inset 0 0 20px rgba(16, 185, 129, 0.1);
  animation: pulseGreen 3s ease-in-out infinite alternate;
}

.seal-ring-error {
  background: rgba(239, 68, 68, 0.06);
  border: 2.5px solid #ef4444;
  color: #ef4444;
  box-shadow: 
    0 0 30px var(--error-glow),
    inset 0 0 20px rgba(239, 68, 68, 0.1);
}

@keyframes pulseGreen {
  0% { box-shadow: 0 0 20px rgba(16, 185, 129, 0.15), inset 0 0 15px rgba(16, 185, 129, 0.08); }
  100% { box-shadow: 0 0 40px rgba(16, 185, 129, 0.35), inset 0 0 25px rgba(16, 185, 129, 0.15); }
}

.seal-title {
  font-size: 22px;
  font-weight: 900;
  letter-spacing: 1.5px;
}

.seal-title-verified {
  color: #10b981;
  text-shadow: 0 0 20px rgba(16, 185, 129, 0.2);
}

.seal-title-error {
  color: #ef4444;
  text-shadow: 0 0 20px rgba(239, 68, 68, 0.2);
}

.seal-subtitle {
  font-size: 12px;
  color: var(--text-secondary);
  margin-top: 6px;
  font-weight: 500;
}

/* ── Certificate Block ── */
.certificate-block {
  background: rgba(16, 185, 129, 0.02);
  border: 1px solid rgba(16, 185, 129, 0.12);
  border-radius: 16px;
  overflow: hidden;
  margin-bottom: 24px;
}

.slip-card.cancelled .certificate-block {
  background: rgba(239, 68, 68, 0.02);
  border-color: rgba(239, 68, 68, 0.12);
}

.cert-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 18px;
  background: rgba(16, 185, 129, 0.05);
  border-bottom: 1px solid rgba(16, 185, 129, 0.08);
  font-size: 10px;
  font-weight: 800;
  letter-spacing: 2px;
  color: #10b981;
  text-transform: uppercase;
}

.slip-card.cancelled .cert-header {
  background: rgba(239, 68, 68, 0.05);
  border-bottom-color: rgba(239, 68, 68, 0.08);
  color: #ef4444;
}

.cert-icon {
  color: inherit;
}

.cert-body {
  padding: 4px 0;
}

.cert-row {
  display: grid;
  grid-template-columns: 140px 1fr;
  padding: 10px 18px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.03);
  align-items: center;
}

.cert-row:last-child {
  border-bottom: none;
}

.cert-label {
  font-size: 11px;
  color: var(--text-muted);
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.cert-value {
  font-size: 13px;
  color: var(--text-primary);
  font-weight: 600;
}

.cert-value-mono {
  font-family: var(--font-mono);
  letter-spacing: 0.8px;
}

.cert-hash {
  color: var(--accent-secondary) !important;
  font-size: 12px !important;
}

.cert-status {
  font-weight: 800;
  font-size: 12px;
  letter-spacing: 0.5px;
}

.cert-status-active {
  color: #10b981;
}

.cert-status-cancelled {
  color: #ef4444;
}

/* ── Section Labels ── */
.section-label {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 10px;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 2px;
  font-weight: 800;
  margin-bottom: 12px;
}

.section-label svg {
  color: var(--accent-secondary);
}

/* ── Details Grid ── */
.details-grid {
  background: var(--bg-inner);
  border: 1px solid rgba(255, 255, 255, 0.05);
  border-radius: 16px;
  padding: 6px 18px;
  margin-bottom: 28px;
}

.details-row {
  display: grid;
  grid-template-columns: 110px 1fr;
  padding: 11px 0;
  border-bottom: 1px solid var(--border-faint);
  align-items: center;
}

.details-row:last-child {
  border-bottom: none;
}

.details-label {
  font-size: 11px;
  color: var(--text-muted);
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 600;
}

.details-label svg {
  color: var(--accent-secondary);
}

.details-value {
  font-size: 13px;
  color: #f1f5f9;
  font-weight: 500;
}

/* ── Items Table ── */
.items-container {
  margin-bottom: 24px;
}

.table-wrapper {
  overflow-x: auto;
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 14px;
  background: rgba(10, 12, 16, 0.45);
}

.items-table {
  width: 100%;
  border-collapse: collapse;
  text-align: left;
  font-size: 12px;
  min-width: 500px;
}

.items-table th {
  background: rgba(99, 102, 241, 0.07);
  color: var(--accent-secondary);
  font-weight: 700;
  padding: 12px 14px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
  text-transform: uppercase;
  font-size: 9px;
  letter-spacing: 1px;
}

.items-table td {
  padding: 14px;
  border-bottom: 1px solid var(--border-faint);
  color: #e2e8f0;
}

.items-table tr:last-child td {
  border-bottom: none;
}

.items-table .text-right {
  text-align: right;
}

.items-table .text-center {
  text-align: center;
}

.table-total-row {
  background: rgba(255, 255, 255, 0.02);
  font-weight: 700;
}

.table-total-row td {
  border-top: 1.5px solid rgba(255, 255, 255, 0.08) !important;
  color: var(--text-primary);
}

/* ── Notes ── */
.notes-box {
  background: rgba(245, 158, 11, 0.02);
  border: 1px dashed rgba(245, 158, 11, 0.15);
  border-radius: 14px;
  padding: 16px;
  margin-bottom: 24px;
}

.notes-title {
  font-size: 10px;
  color: #f59e0b;
  text-transform: uppercase;
  letter-spacing: 1px;
  font-weight: 700;
  margin-bottom: 6px;
}

.notes-content {
  font-size: 13px;
  color: #cbd5e1;
  font-style: italic;
  line-height: 1.5;
}

/* ── Cancelled Box ── */
.cancelled-box {
  background: rgba(239, 68, 68, 0.04);
  border: 1px solid rgba(239, 68, 68, 0.18);
  border-radius: 14px;
  padding: 16px;
  margin-bottom: 24px;
  text-align: center;
  color: #f87171;
}

.cancelled-title {
  font-size: 14px;
  color: #ef4444;
  font-weight: 700;
  margin-bottom: 4px;
}

.cancelled-content {
  font-size: 13px;
  color: #f87171;
}

/* ── Download Section ── */
.download-section {
  margin-bottom: 24px;
}

.download-label {
  font-size: 11px;
  color: var(--text-muted);
  text-align: center;
  margin-bottom: 10px;
  font-weight: 600;
}

.action-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  width: 100%;
  padding: 16px;
  background: linear-gradient(135deg, #10b981, #059669);
  color: #ffffff;
  border: none;
  border-radius: 14px;
  font-size: 15px;
  font-weight: 700;
  cursor: pointer;
  font-family: var(--font-sans);
  box-shadow: 0 10px 30px rgba(16, 185, 129, 0.25);
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
}

.action-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 14px 35px rgba(16, 185, 129, 0.35);
  filter: brightness(1.1);
}

.action-btn:active {
  transform: translateY(0);
}

.action-btn:disabled {
  background: #334155;
  color: var(--text-muted);
  cursor: not-allowed;
  transform: none;
  box-shadow: none;
}

.action-btn-secondary {
  background: linear-gradient(135deg, #334155, #475569);
  box-shadow: 0 8px 20px rgba(0, 0, 0, 0.3);
  margin-top: 16px;
}

.action-btn-secondary:hover {
  box-shadow: 0 12px 28px rgba(0, 0, 0, 0.4);
}

/* ── Security Footer ── */
.security-footer {
  border-top: 1px solid var(--border-faint);
  padding-top: 18px;
  text-align: center;
}

.security-row {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  font-size: 11px;
  color: var(--text-muted);
  font-weight: 500;
}

.security-row svg {
  color: var(--success);
}

.security-hash {
  font-family: var(--font-mono);
  font-size: 10px;
  color: rgba(255, 255, 255, 0.15);
  margin-top: 8px;
  letter-spacing: 0.5px;
}

/* ── Portal Footer ── */
.portal-footer {
  text-align: center;
  font-size: 11px;
  color: #334155;
  margin-top: 20px;
  line-height: 1.6;
}

/* ── Loading States ── */
.loading-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 80vh;
}

.loading-text {
  color: var(--text-secondary);
  font-size: 14px;
  font-weight: 600;
}

.loading-sub {
  color: var(--text-muted);
  font-size: 11px;
  margin-top: 6px;
}

.spinner {
  width: 48px;
  height: 48px;
  border: 3px solid rgba(16, 185, 129, 0.08);
  border-left-color: #10b981;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
  margin-bottom: 16px;
}

.spin-icon {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

/* ── Error States ── */
.error-card {
  text-align: center;
  padding: 36px 24px;
}

.error-title {
  font-size: 22px;
  font-weight: 800;
  color: var(--text-primary);
  margin-bottom: 8px;
  margin-top: 16px;
}

.error-text {
  font-size: 14px;
  color: var(--text-secondary);
  margin-bottom: 8px;
  line-height: 1.5;
}

.error-hint {
  font-size: 12px;
  color: var(--text-muted);
  margin-bottom: 20px;
  line-height: 1.4;
}

/* ── Responsive ── */
@media (max-width: 480px) {
  .verification-portal {
    padding: 16px 10px;
  }
  .slip-card {
    padding: 24px 16px;
    border-radius: 18px;
  }
  .cert-row {
    grid-template-columns: 110px 1fr;
    padding: 8px 14px;
  }
  .seal-title {
    font-size: 18px;
  }
  .details-row {
    grid-template-columns: 95px 1fr;
  }
}
`;

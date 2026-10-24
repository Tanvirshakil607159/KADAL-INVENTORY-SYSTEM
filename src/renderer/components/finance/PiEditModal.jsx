import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Edit2, Eye, List, X, Printer, FileText, Lock } from 'lucide-react';
import useStore from '../../store/useStore';
import ProformaInvoicePrintView from './ProformaInvoicePrintView';
import PiApprovalEditor from './PiApprovalEditor';
import { buildPrintPi, toEditForm, buildApprovalPayload, buildPiUpdatePayload } from './piApprovalUtils';

/**
 * Edit an existing (saved) Proforma Invoice from the "Previous PIs & Orders" tab.
 * Mirrors the approval-page experience: full editor + details view + live PDF preview.
 *
 * Props:
 *  - pi: saved PI record (snake_case, with items)
 *  - existingPiNumbers: Set of other PI numbers (for duplicate check)
 *  - onClose(): close modal
 *  - onSaved(): called after a successful save (parent reloads data)
 */
export default function PiEditModal({ pi: rawPi, existingPiNumbers, onClose, onSaved }) {
  const { addToast } = useStore();
  const [tab, setTab] = useState('edit');
  const [saving, setSaving] = useState(false);
  const [fetchedPi, setFetchedPi] = useState(null);

  useEffect(() => {
    let active = true;
    if (rawPi?.id && (!rawPi.items || rawPi.items.length === 0)) {
      window.kadal.finance.getById(rawPi.id).then(res => {
        if (!active) return;
        const item = res?.success ? res.data : (res?.data || res);
        if (item) setFetchedPi(item);
      }).catch(err => {
        console.error('Failed to load PI items:', err);
      });
    }
    return () => { active = false; };
  }, [rawPi?.id, rawPi?.items]);

  const activePi = fetchedPi || rawPi;

  // Cloud queries don't guarantee item order, so sort by serial number first
  const pi = useMemo(() => ({
    ...activePi,
    items: [...(activePi.items || [])].sort((a, b) => (Number(a.sl_no) || 0) - (Number(b.sl_no) || 0))
  }), [activePi]);

  const initialForm = useMemo(() => toEditForm(pi), [pi]);
  const [draftForm, setDraftForm] = useState(initialForm);

  // Sync draftForm if loaded asynchronously
  useEffect(() => {
    if (fetchedPi) {
      const f = toEditForm(pi);
      setDraftForm(f);
    }
  }, [fetchedPi, pi]);

  const handleFormChange = useCallback((f) => setDraftForm(f), []);

  // Live preview built from the current (unsaved) edits
  const previewPi = useMemo(() => {
    try {
      return buildPrintPi(buildApprovalPayload(draftForm, pi));
    } catch {
      return buildPrintPi(pi);
    }
  }, [draftForm, pi]);

  const handleSave = async (form) => {
    const newNumber = form.piNumber.trim();
    if (newNumber !== (pi.pi_number || '') && existingPiNumbers?.has(newNumber)) {
      addToast('error', `PI Number "${newNumber}" is already used by another Proforma Invoice`);
      return;
    }
    setSaving(true);
    try {
      const payload = buildPiUpdatePayload(form, pi);
      const res = await window.kadal.finance.update(pi.id, payload);
      if (res?.success) {
        addToast('success', `Proforma Invoice ${newNumber} updated`);
        if (onSaved) await onSaved();
        onClose();
      } else {
        addToast('error', res?.error || 'Failed to update Proforma Invoice');
      }
    } catch (err) {
      addToast('error', err.message || 'Error updating Proforma Invoice');
    } finally {
      setSaving(false);
    }
  };

  const handleExportPdf = async () => {
    try {
      const res = await window.kadal.finance.exportPdf(previewPi);
      if (res?.success) addToast('success', 'PDF exported successfully');
    } catch (err) {
      addToast('error', err.message || 'PDF export is not available');
    }
  };

  const currencySymbol = draftForm?.currencySymbol || '$';

  return (
    <div
      className="modal-backdrop"
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', zIndex: 1150,
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20
      }}
    >
      <div
        id="pi-edit-modal"
        style={{
          background: 'var(--bg-card, #ffffff)', borderRadius: 12, width: '96vw', maxWidth: 1000,
          maxHeight: '94vh', display: 'flex', flexDirection: 'column',
          boxShadow: '0 25px 50px -12px rgba(0,0,0,0.3)', border: '1px solid var(--border)'
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{
          padding: '14px 20px', borderBottom: '1px solid var(--border)',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
            <Edit2 size={18} color="var(--primary)" />
            <div style={{ minWidth: 0 }}>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>Edit Proforma Invoice</h3>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {pi.pi_number} · {pi.applicant_name}
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
            <button
              id="pi-edit-tab-edit"
              className={`btn btn-sm ${tab === 'edit' ? 'btn-primary' : 'btn-ghost'}`}
              onClick={() => setTab('edit')}
            >
              <Edit2 size={14} /> Edit PI
            </button>
            <button
              id="pi-edit-tab-details"
              className={`btn btn-sm ${tab === 'details' ? 'btn-primary' : 'btn-ghost'}`}
              onClick={() => setTab('details')}
            >
              <List size={14} /> Details
            </button>
            <button
              id="pi-edit-tab-preview"
              className={`btn btn-sm ${tab === 'preview' ? 'btn-primary' : 'btn-ghost'}`}
              onClick={() => setTab('preview')}
            >
              <Eye size={14} /> PDF Preview
            </button>
            {tab === 'preview' && (
              <>
                <button id="pi-edit-preview-print" className="btn btn-ghost btn-sm" onClick={() => window.print()}>
                  <Printer size={14} /> Print
                </button>
                <button id="pi-edit-preview-export" className="btn btn-ghost btn-sm" onClick={handleExportPdf}>
                  <FileText size={14} /> Export PDF
                </button>
              </>
            )}
            <button className="btn btn-ghost btn-sm btn-icon" onClick={onClose} disabled={saving} title="Close">
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Body */}
        <div style={{ padding: 20, overflowY: 'auto', flex: 1 }}>
          {pi.challan_numbers && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, marginBottom: 10,
              padding: '8px 12px', borderRadius: 8, background: 'rgba(234,179,8,0.1)',
              border: '1px solid rgba(234,179,8,0.3)', color: 'var(--text-secondary)'
            }}>
              <Lock size={14} /> Linked challans: <strong>{pi.challan_numbers}</strong>. Existing rows keep their links; removing a row unlinks it.
            </div>
          )}

          {/* Keep the editor mounted while viewing preview/details so unsaved edits are preserved */}
          <div style={{ display: tab === 'edit' ? 'block' : 'none' }}>
            <PiApprovalEditor
              initialForm={initialForm}
              saving={saving}
              onSave={handleSave}
              onCancel={onClose}
              onFormChange={handleFormChange}
              notice="Editing a saved Proforma Invoice. Changes apply immediately upon clicking Save Changes. Switch to PDF Preview to verify before saving."
            />
          </div>

          {tab === 'details' && (
            <div className="approval-details-rich" style={{ padding: 4 }}>
              <div style={{
                display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                gap: 12, marginBottom: 16, background: 'var(--bg-secondary, rgba(128,128,128,0.06))',
                padding: 14, borderRadius: 8, border: '1px solid var(--border)'
              }}>
                <div><label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block' }}>PI Number</label><strong>{draftForm.piNumber || '-'}</strong></div>
                <div><label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block' }}>Date</label><strong>{draftForm.piDate || '-'}</strong></div>
                <div><label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block' }}>Applicant</label><strong>{draftForm.applicantName || '-'}</strong></div>
                <div><label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block' }}>Buyer</label><strong>{draftForm.buyer || '-'}</strong></div>
                <div><label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block' }}>Purchase No</label><strong>{draftForm.purchaseNumber || '-'}</strong></div>
                <div><label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block' }}>Total Quantity</label><strong>{Number(previewPi.total_quantity || 0).toLocaleString()}</strong></div>
                <div><label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block' }}>Total Amount</label><strong style={{ color: 'var(--primary)' }}>{currencySymbol}{Number(previewPi.total_amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ({draftForm.currency})</strong></div>
                <div><label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block' }}>Beneficiary</label><strong>{draftForm.beneficiaryName || '-'}</strong></div>
              </div>

              {draftForm.applicantAddress && (
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 14 }}>
                  <strong>Applicant Address:</strong> {draftForm.applicantAddress}
                </div>
              )}

              <div style={{ overflowX: 'auto', border: '1px solid var(--border)', borderRadius: 8 }}>
                <table className="data-table table-sm" style={{ width: '100%' }}>
                  <thead>
                    <tr>
                      <th style={{ width: 40 }}>#</th>
                      <th>Item Description</th>
                      <th>Order / Style</th>
                      <th>Purchase No</th>
                      <th className="text-right">Qty</th>
                      <th>Unit</th>
                      <th className="text-right">Unit Price</th>
                      <th className="text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(draftForm.items || []).map((it, i) => {
                      const qty = Number(it.quantity) || 0;
                      const price = Number(it.unitPrice) || 0;
                      const total = Number((qty * price).toFixed(2));
                      return (
                        <tr key={i}>
                          <td className="text-muted" style={{ fontSize: 11 }}>{i + 1}</td>
                          <td style={{ fontWeight: 600 }}>{it.itemDescription || '-'}</td>
                          <td style={{ fontSize: 11 }}>{it.poStyleNo || '-'}</td>
                          <td style={{ fontSize: 11 }}>{it.purchaseNo || '-'}</td>
                          <td className="text-right fw-bold" style={{ color: 'var(--primary)' }}>{qty.toLocaleString()}</td>
                          <td className="text-muted" style={{ fontSize: 11 }}>{it.unit || 'PCS'}</td>
                          <td className="text-right" style={{ fontSize: 11 }}>{currencySymbol}{price.toFixed(4)}</td>
                          <td className="text-right fw-bold" style={{ fontSize: 11 }}>{currencySymbol}{total.toFixed(2)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 14 }}>
                <button className="btn btn-primary" onClick={() => setTab('edit')}>
                  <Edit2 size={14} /> Back to Edit PI
                </button>
              </div>
            </div>
          )}

          {tab === 'preview' && (
            <>
              <style>{`@media print { .pi-edit-preview-scroll { overflow: visible !important; max-height: none !important; background: none !important; padding: 0 !important; } }`}</style>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 8 }}>
                Preview reflects your current edits (not yet saved).
              </div>
              <div
                className="pi-edit-preview-scroll"
                style={{ overflow: 'auto', maxHeight: '66vh', border: '1px solid var(--border)', borderRadius: 8, background: 'var(--bg-secondary, rgba(128,128,128,0.08))' }}
              >
                <div style={{ width: 'max-content', minWidth: '100%' }}>
                  <ProformaInvoicePrintView pi={previewPi} mode="pi" isModal={false} />
                </div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 14 }}>
                <button className="btn btn-primary" onClick={() => setTab('edit')}>
                  <Edit2 size={14} /> Back to Edit PI
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}


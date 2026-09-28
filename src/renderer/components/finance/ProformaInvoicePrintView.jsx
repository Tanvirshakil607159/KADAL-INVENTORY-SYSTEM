import React from 'react';
import './ProformaInvoicePrintView.css';
import logoImg from '../../assets/logo.png';
import { Printer, Download, X } from 'lucide-react';

export default function ProformaInvoicePrintView({ 
  pi, 
  onPrint, 
  onExportPdf, 
  onClose,
  isModal = false,
  mode = null // 'pi' or 'bill'
}) {
  if (!pi) return null;

  const isBill = mode === 'bill' || (mode !== 'pi' && !!pi.bill_number);

  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}.${month}.${year}`;
  };

  const currencySym = pi.currency_symbol || '$';
  const items = pi.items || [];
  const totalQty = pi.total_quantity || items.reduce((sum, it) => sum + (Number(it.quantity) || 0), 0);
  const totalAmt = pi.total_amount || items.reduce((sum, it) => sum + (Number(it.total_amount) || 0), 0);

  const handleNativePrint = () => {
    if (onPrint) {
      onPrint();
    } else {
      window.print();
    }
  };

  return (
    <div className="pi-print-wrapper">
      {isModal && (
        <div className="no-print" style={{ 
          position: 'fixed', 
          top: 16, 
          right: 24, 
          zIndex: 9999, 
          display: 'flex', 
          gap: 10,
          background: 'var(--card-bg, #ffffff)',
          padding: '8px 14px',
          borderRadius: 8,
          boxShadow: '0 4px 16px rgba(0,0,0,0.25)',
          border: '1px solid var(--border-color, #cbd5e1)'
        }}>
          <button className="btn btn-primary btn-sm" onClick={handleNativePrint}>
            <Printer size={15} style={{ marginRight: 6 }} /> {isBill ? 'Print Bill' : 'Print PI'}
          </button>
          {onExportPdf && (
            <button className="btn btn-outline btn-sm" onClick={onExportPdf}>
              <Download size={15} style={{ marginRight: 6 }} /> Export PDF
            </button>
          )}
          {onClose && (
            <button className="btn btn-ghost btn-icon btn-sm" onClick={onClose} title="Close Preview">
              <X size={18} />
            </button>
          )}
        </div>
      )}

      <div className="pi-document" id="printable-pi-document">
        {/* Background Watermark */}
        <div 
          className="pi-watermark" 
          style={{ backgroundImage: `url(${logoImg})` }}
        />

        <div className="pi-content">
          {/* Header */}
          <div className="pi-header">
            <img src={logoImg} alt="KADAL Logo" className="pi-header-logo" />
            <div className="pi-header-text">
              <h1 className="pi-company-title">K.A. DESIGN ACCESSORIES LTD.</h1>
              <p className="pi-company-tagline">
                A House of Quality Twill Tape, Herringbone Tape & Garments Accessories Manufacturer.
              </p>
            </div>
          </div>

          {/* Meta Information Section */}
          <div className="pi-meta-section">
            <div className="pi-meta-left">
              <div className="pi-info-block">
                <div className="pi-info-label">APPLICANT:</div>
                <div className="pi-info-text">
                  <strong>{pi.applicant_name}</strong>
                  {pi.applicant_address && <div>{pi.applicant_address}</div>}
                </div>
              </div>

              <div className="pi-info-block">
                <div className="pi-info-label">BENIFICARY:</div>
                <div className="pi-info-text">
                  <div>{pi.beneficiary_name || 'K.A. DESIGN ACCESSORIES LTD.'}</div>
                  <div>{pi.beneficiary_address || '356/1, BLOCK- B, TEK KATHORA, SALNA\nGAZIPUR- 1703, BANGLADESH'}</div>
                  {pi.beneficiary_bin ? <div>BIN: {pi.beneficiary_bin}</div> : <div>BIN</div>}
                </div>
              </div>

              <div className="pi-info-block">
                <div className="pi-info-label">BANK DETAIL:</div>
                <div className="pi-info-text">
                  {pi.bank_details || (
                    <>
                      <div>UNITED COMMERCIAL BANK PLC.</div>
                      <div>TONGI BRANCH</div>
                      <div>18, S.K MANNAN TOWER, CHERAG ALI</div>
                      <div>GAZIPUR- 1712, BANGLADESH</div>
                      <div>SWIFT CODE : UCBLBDDHTNG</div>
                    </>
                  )}
                </div>
              </div>

              <div className="pi-buyer-row">
                <span className="pi-info-label">BUYER : </span>
                <span style={{ fontWeight: 500 }}>{pi.buyer || '-'}</span>
              </div>
            </div>

            <div className="pi-meta-right">
              {isBill ? (
                <>
                  <div className="pi-bill-heading">BILL</div>
                  <div className="pi-meta-row">
                    <span>BILL NO. :</span>
                    <strong>{pi.bill_number || '-'}</strong>
                  </div>
                  <div className="pi-meta-row">
                    <span>Date :</span>
                    <strong>{formatDate(pi.bill_date || pi.pi_date)}</strong>
                  </div>
                  {pi.pi_number && (
                    <div className="pi-meta-row" style={{ marginTop: 4 }}>
                      <span>PI REF NO. :</span>
                      <strong>{pi.pi_number}</strong>
                    </div>
                  )}
                  {pi.challan_numbers && (
                    <div className="pi-meta-row" style={{ marginTop: 4 }}>
                      <span>CHALLAN NO(S) :</span>
                      <strong style={{ fontSize: 11 }}>{pi.challan_numbers}</strong>
                    </div>
                  )}
                </>
              ) : (
                <>
                  <div className="pi-bill-heading" style={{ fontSize: 15, letterSpacing: '1px' }}>PROFORMA INVOICE</div>
                  <div className="pi-meta-row" style={{ marginTop: 6 }}>
                    <span>PROFORMA INVOICE NO. :</span>
                    <strong>{pi.pi_number || '-'}</strong>
                  </div>
                  <div className="pi-meta-row">
                    <span>Date :</span>
                    <strong>{formatDate(pi.pi_date)}</strong>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Goods Table Section */}
          <div className="pi-table-title">DESCRIPTION OF GOODS :</div>
          <table className="pi-goods-table">
            <thead>
              <tr>
                <th className="col-sl">SL. NO</th>
                <th className="col-desc">ITEM DESCRIPTION</th>
                <th className="col-po">PO & STYLE NO.</th>
                <th className="col-qty">QTY</th>
                <th className="col-unit">UNIT</th>
                <th className="col-rate">UNIT PRICE</th>
                <th className="col-total">TOTAL</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, idx) => {
                const slNo = item.sl_no !== undefined ? item.sl_no : (item.slNo !== undefined ? item.slNo : idx + 1);
                const desc = item.item_description || item.itemDescription || item.item_name || item.name || '';
                const poStyle = item.po_style_no || item.poStyleNo || item.style_name || item.order_number || item.purchase_no || item.purchaseNo || '-';
                const qty = Number(item.quantity || 0);
                const unit = (item.unit || 'PCS').toUpperCase();
                const rate = Number(item.unit_price !== undefined ? item.unit_price : (item.unitPrice !== undefined ? item.unitPrice : 0));
                const total = Number(item.total_amount !== undefined ? item.total_amount : (item.totalAmount !== undefined ? item.totalAmount : (qty * rate).toFixed(2)));

                return (
                  <tr key={idx}>
                    <td className="col-sl">{slNo}</td>
                    <td className="col-desc">{desc}</td>
                    <td className="col-po">{poStyle}</td>
                    <td className="col-qty">{qty.toLocaleString('en-US')}</td>
                    <td className="col-unit">{unit}</td>
                    <td className="col-rate">
                      {currencySym} {rate.toFixed(4)}
                    </td>
                    <td className="col-total">
                      {currencySym} {total.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                  </tr>
                );
              })}
              <tr className="pi-total-row">
                <td colSpan={3} style={{ textAlign: 'right', fontWeight: 'bold' }}>TOTAL</td>
                <td className="col-qty" style={{ fontWeight: 'bold' }}>
                  {Number(totalQty).toLocaleString('en-US')}
                </td>
                <td className="col-unit"></td>
                <td className="col-rate"></td>
                <td className="col-total" style={{ fontWeight: 'bold' }}>
                  {currencySym} {Number(totalAmt).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </td>
              </tr>
            </tbody>
          </table>

          {/* Summary / Terms */}
          <div className="pi-summary-section">
            <div className="pi-in-words">
              {pi.amount_in_words || ''}
            </div>
            <div className="pi-spec-line">
              <strong>NET WEIGHT:</strong> {pi.net_weight || '250 KGS'}
            </div>
            <div className="pi-spec-line">
              <strong>GROSS WEIGHT:</strong> {pi.gross_weight || '260 KGS'}
            </div>
            <div className="pi-spec-line">
              <strong>TERMS AND CONDITIONS :</strong> {pi.terms_conditions || 'CASH ON DELIVERY.'}
            </div>
          </div>

          {/* Signatures */}
          <div className="pi-signatures">
            <div className="pi-sign-col">
              <div className="pi-sign-stamp">
                <div className="pi-stamp-name">Md. Ariful Rahman</div>
                <div className="pi-stamp-role">Accounts & Admin</div>
                <div className="pi-stamp-role" style={{ fontSize: 9 }}>K. A. Design Accessories Ltd.</div>
              </div>
              <div className="pi-sign-line">
                Prepared By<br />For KADAL
              </div>
            </div>

            <div className="pi-sign-col">
              <div className="pi-sign-stamp">
                <div className="pi-stamp-name" style={{ color: '#047857' }}>Maksudha Akter Kumu</div>
                <div className="pi-stamp-role" style={{ color: '#047857' }}>Chairman</div>
                <div className="pi-stamp-role" style={{ fontSize: 9, color: '#047857' }}>K.A. DESIGN ACCESSORIES LTD.</div>
              </div>
              <div className="pi-sign-line">
                Authorized By<br />For KADAL
              </div>
            </div>

            <div className="pi-sign-col">
              <div className="pi-sign-stamp"></div>
              <div className="pi-sign-line">
                Accepted By<br />Buyer Signature & Seal ({pi.applicant_name || 'KADWL'})
              </div>
            </div>
          </div>

          {/* Document Footer */}
          <div className="pi-footer">
            <div className="pi-footer-left">
              <div className="pi-footer-block-title">Office & Factory :</div>
              <div>356/1, Block-B, Tek Kathora</div>
              <div>Salna, Gazipur-1703</div>
              <div>Bangladesh</div>
            </div>
            <div className="pi-footer-right">
              <div className="pi-footer-block-title">Contact Details:</div>
              <div>Cell : +88 01766 671724</div>
              <div>E-mail : maksudakumu@kadesignaccessoriesltd.com</div>
              <div>Web : www.kadesignaccessoriesltd.com</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

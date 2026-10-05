import React, { useMemo, useState } from 'react';
import './ProformaInvoicePrintView.css';
import logoImg from '../../assets/logo.png';
import letterheadImg from '../../assets/letterhead.png';
import watermarkImg from '../../assets/watermark.png';
import { Printer, Download, X, CheckCircle, Move, RotateCcw } from 'lucide-react';
import { numberToCurrencyWords } from '../../utils/numberToWords';

const DEFAULT_COL_WIDTHS = {
  sl: 32,
  desc: 195,
  purch: 105,
  po: 115,
  qty: 55,
  unit: 40,
  rate: 65,
  total: 75
};

export default function ProformaInvoicePrintView({ 
  pi, 
  onPrint, 
  onExportPdf, 
  onClose,
  onConfirm,
  confirmLabel = 'Confirm & Approve PI',
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

  const getPiPurchaseNo = (piObj) => {
    if (!piObj) return '';
    if (piObj.purchase_no) return piObj.purchase_no;
    if (piObj.purchase_number) return piObj.purchase_number;
    if (piObj.purchaseNo) return piObj.purchaseNo;
    if (piObj.notes) {
      const match = piObj.notes.match(/Purchase(?:\s*No|\s*Order)?\s*[:=]\s*([^\n;]+)/i);
      if (match) return match[1].trim();
    }
    const piItemsList = piObj.items || [];
    for (const it of piItemsList) {
      if (it.purchase_no) return it.purchase_no;
      if (it.purchaseNo) return it.purchaseNo;
      const poStyle = it.po_style_no || it.poStyleNo || '';
      const match = poStyle.match(/Purchase(?:\s*No)?\s*[:=]\s*([^/\n;]+)/i);
      if (match) return match[1].trim();
    }
    return '';
  };
  const purchaseNo = getPiPurchaseNo(pi);

  // Group and merge rows having the same Item Description, same Purchase Number, and same PO & Style Number
  const displayItems = useMemo(() => {
    const rawList = pi.items || [];
    const map = new Map();

    rawList.forEach((item) => {
      const desc = (item.item_description || item.itemDescription || item.item_name || item.name || '').trim();
      let itemPurch = (item.purchase_no || item.purchaseNo || item.purchase_number || item.purchaseNumber || '').trim();
      let poStyle = (item.po_style_no || item.poStyleNo || '').trim();

      if (!itemPurch && poStyle) {
        const match = poStyle.match(/Purchase(?:\s*No)?\s*[:=]\s*([^/\n;]+)/i);
        if (match) itemPurch = match[1].trim();
      }
      if (!itemPurch && purchaseNo) {
        itemPurch = purchaseNo;
      }

      if (poStyle && poStyle !== '-') {
        poStyle = poStyle.replace(/\s*\/\s*Purchase(?:\s*No)?\s*[:=]\s*[^/\n;]+/i, '').trim();
      }

      const poVal = (item.order_number || item.orderNumber || '').trim();
      const styleVal = (item.style_name || item.styleName || '').trim();

      if (poStyle && poStyle !== '-') {
        let updated = poStyle;
        if (poVal && !updated.toLowerCase().includes('order:') && !updated.toLowerCase().includes('po:') && !updated.includes(poVal)) {
          updated = `Order: ${poVal} / ` + updated.replace(/^Style:\s*/i, 'Style: ');
        }
        updated = updated.replace(/^PO:\s*/i, 'Order: ').replace(/\s*\/\s*PO:\s*/gi, ' / Order: ');
        poStyle = updated;
      } else {
        const parts = [];
        if (poVal) parts.push(`Order: ${poVal}`);
        if (styleVal) parts.push(`Style: ${styleVal}`);
        poStyle = parts.length > 0 ? parts.join(' / ') : '-';
      }

      const qty = Number(item.quantity || 0);
      const unit = (item.unit || 'PCS').toUpperCase().trim();
      const rate = Number(item.unit_price !== undefined ? item.unit_price : (item.unitPrice !== undefined ? item.unitPrice : 0));
      const lineTotal = Number(item.total_amount !== undefined ? item.total_amount : (item.totalAmount !== undefined ? item.totalAmount : (qty * rate).toFixed(2)));

      // Grouping key: Item Description + Purchase No + PO & Style + Unit + Unit Price
      const cleanDesc = desc.toLowerCase().replace(/\s+/g, ' ');
      const cleanPurch = itemPurch.toLowerCase().replace(/\s+/g, ' ');
      const cleanPoStyle = poStyle.toLowerCase().replace(/[\s/]+/g, ' ');
      const cleanUnit = unit.toLowerCase();
      const rateKey = rate.toFixed(4);

      const groupKey = `${cleanDesc}:::${cleanPurch}:::${cleanPoStyle}:::${cleanUnit}:::${rateKey}`;

      if (map.has(groupKey)) {
        const existing = map.get(groupKey);
        existing.qty += qty;
        existing.total = Number((existing.total + lineTotal).toFixed(2));
      } else {
        map.set(groupKey, {
          desc,
          itemPurch,
          poStyle,
          qty,
          unit,
          rate,
          total: lineTotal
        });
      }
    });

    return Array.from(map.values()).map((m, idx) => ({
      slNo: idx + 1,
      desc: m.desc,
      itemPurch: m.itemPurch,
      poStyle: m.poStyle,
      qty: m.qty,
      unit: m.unit,
      rate: m.rate,
      total: Number((m.qty * m.rate).toFixed(2))
    }));
  }, [pi.items, purchaseNo]);

  const totalQty = displayItems.reduce((sum, it) => sum + (Number(it.qty) || 0), 0);
  const totalAmt = displayItems.reduce((sum, it) => sum + (Number(it.total) || 0), 0);

  // Column and Row Resizing State
  const [colWidths, setColWidths] = useState(() => ({ ...DEFAULT_COL_WIDTHS }));
  const [rowHeights, setRowHeights] = useState({});
  const [cellPaddingY, setCellPaddingY] = useState(4);

  const isCustomized = useMemo(() => {
    const hasCustomCols = Object.keys(DEFAULT_COL_WIDTHS).some(
      k => colWidths[k] !== DEFAULT_COL_WIDTHS[k]
    );
    const hasCustomRows = Object.keys(rowHeights).length > 0;
    const hasCustomPadding = cellPaddingY !== 4;
    return hasCustomCols || hasCustomRows || hasCustomPadding;
  }, [colWidths, rowHeights, cellPaddingY]);

  const handleResetSizes = () => {
    setColWidths({ ...DEFAULT_COL_WIDTHS });
    setRowHeights({});
    setCellPaddingY(4);
  };

  const handleColMouseDown = (colKey, e) => {
    e.preventDefault();
    e.stopPropagation();
    const startX = e.clientX;
    const startWidth = colWidths[colKey] || DEFAULT_COL_WIDTHS[colKey] || 50;

    const onMouseMove = (moveEvent) => {
      moveEvent.preventDefault();
      const diff = moveEvent.clientX - startX;
      const minW = colKey === 'sl' ? 24 : (colKey === 'unit' ? 28 : (colKey === 'qty' ? 35 : 45));
      const newWidth = Math.max(minW, Math.round(startWidth + diff));
      setColWidths(prev => ({
        ...prev,
        [colKey]: newWidth
      }));
    };

    const onMouseUp = () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };

    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  };

  const handleRowMouseDown = (rowKey, e) => {
    e.preventDefault();
    e.stopPropagation();
    const startY = e.clientY;
    const trElem = e.currentTarget.closest('tr');
    const startHeight = trElem ? trElem.getBoundingClientRect().height : (rowHeights[rowKey] || 26);

    const onMouseMove = (moveEvent) => {
      moveEvent.preventDefault();
      const diff = moveEvent.clientY - startY;
      const newHeight = Math.max(20, Math.round(startHeight + diff));
      setRowHeights(prev => ({
        ...prev,
        [rowKey]: newHeight
      }));
    };

    const onMouseUp = () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };

    document.body.style.cursor = 'row-resize';
    document.body.style.userSelect = 'none';
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  };

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
          {onConfirm && (
            <button 
              className="btn btn-sm" 
              onClick={onConfirm}
              style={{ 
                display: 'inline-flex', 
                alignItems: 'center', 
                gap: 6, 
                background: 'var(--success, #10b981)', 
                color: '#fff', 
                fontWeight: 600,
                border: 'none',
                padding: '6px 12px',
                borderRadius: 6,
                cursor: 'pointer'
              }}
            >
              <CheckCircle size={15} /> {confirmLabel}
            </button>
          )}
          <button className="btn btn-primary btn-sm" onClick={handleNativePrint}>
            <Printer size={15} style={{ marginRight: 6 }} /> {isBill ? 'Print Bill' : 'Print PI'}
          </button>
          {onExportPdf && (
            <button 
              className="btn btn-outline btn-sm" 
              onClick={() => onExportPdf({
                ...pi,
                displayItems,
                items: displayItems,
                total_quantity: totalQty,
                total_amount: totalAmt,
                amount_in_words: pi.amount_in_words || (totalAmt > 0 ? `IN WORDS: ${numberToCurrencyWords(totalAmt, pi.currency || 'USD')}` : ''),
                customColWidths: colWidths,
                customRowPadding: cellPaddingY,
                customRowHeights: rowHeights
              })}
            >
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
          style={{ backgroundImage: `url(${watermarkImg})` }}
        />

        <div className="pi-content">
          {/* Header */}
          <div className="pi-header">
            <img src={letterheadImg} alt="K.A. DESIGN ACCESSORIES LTD." className="pi-header-letterhead" />
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
                  <div>BIN: {(pi.beneficiary_bin || pi.beneficiaryBin || '009212306-1201').trim()}</div>
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

          {/* Goods Table Section with Resizable Columns and Rows */}
          <div className="pi-table-header-bar">
            <div className="pi-table-title">DESCRIPTION OF GOODS :</div>
            <div className="pi-resize-toolbar no-print">
              <span className="pi-resize-hint">
                <Move size={12} /> Drag column (↔) or row (↕) borders to resize
              </span>
              <div className="pi-density-group">
                <span style={{ fontSize: 10.5, color: '#64748b' }}>Row:</span>
                <button
                  type="button"
                  className={`pi-pill-btn ${cellPaddingY === 2 ? 'active' : ''}`}
                  onClick={() => setCellPaddingY(2)}
                  title="Compact rows"
                >
                  Compact
                </button>
                <button
                  type="button"
                  className={`pi-pill-btn ${cellPaddingY === 4 ? 'active' : ''}`}
                  onClick={() => setCellPaddingY(4)}
                  title="Normal rows"
                >
                  Normal
                </button>
                <button
                  type="button"
                  className={`pi-pill-btn ${cellPaddingY === 8 ? 'active' : ''}`}
                  onClick={() => setCellPaddingY(8)}
                  title="Spacious rows"
                >
                  Spacious
                </button>
              </div>
              {isCustomized && (
                <button
                  type="button"
                  className="pi-reset-btn"
                  onClick={handleResetSizes}
                  title="Reset column and row sizes to default"
                >
                  <RotateCcw size={11} /> Reset
                </button>
              )}
            </div>
          </div>

          <table className="pi-goods-table">
            <colgroup>
              <col style={{ width: `${colWidths.sl}px` }} />
              <col style={{ width: `${colWidths.desc}px` }} />
              <col style={{ width: `${colWidths.purch}px` }} />
              <col style={{ width: `${colWidths.po}px` }} />
              <col style={{ width: `${colWidths.qty}px` }} />
              <col style={{ width: `${colWidths.unit}px` }} />
              <col style={{ width: `${colWidths.rate}px` }} />
              <col style={{ width: `${colWidths.total}px` }} />
            </colgroup>
            <thead>
              <tr style={{ height: rowHeights.header ? `${rowHeights.header}px` : undefined }}>
                <th className="col-sl pi-col-th" style={{ padding: `${cellPaddingY}px 4px` }}>
                  SL. NO
                  <div className="pi-col-resizer no-print" onMouseDown={(e) => handleColMouseDown('sl', e)} title="Drag column width (↔)" />
                  <div className="pi-row-resizer no-print" onMouseDown={(e) => handleRowMouseDown('header', e)} title="Drag row height (↕)" />
                </th>
                <th className="col-desc pi-col-th" style={{ padding: `${cellPaddingY}px 4px` }}>
                  ITEM DESCRIPTION
                  <div className="pi-col-resizer no-print" onMouseDown={(e) => handleColMouseDown('desc', e)} title="Drag column width (↔)" />
                  <div className="pi-row-resizer no-print" onMouseDown={(e) => handleRowMouseDown('header', e)} title="Drag row height (↕)" />
                </th>
                <th className="col-purch pi-col-th" style={{ padding: `${cellPaddingY}px 4px` }}>
                  PURCHASE NO.
                  <div className="pi-col-resizer no-print" onMouseDown={(e) => handleColMouseDown('purch', e)} title="Drag column width (↔)" />
                  <div className="pi-row-resizer no-print" onMouseDown={(e) => handleRowMouseDown('header', e)} title="Drag row height (↕)" />
                </th>
                <th className="col-po pi-col-th" style={{ padding: `${cellPaddingY}px 4px` }}>
                  ORDER & STYLE NO.
                  <div className="pi-col-resizer no-print" onMouseDown={(e) => handleColMouseDown('po', e)} title="Drag column width (↔)" />
                  <div className="pi-row-resizer no-print" onMouseDown={(e) => handleRowMouseDown('header', e)} title="Drag row height (↕)" />
                </th>
                <th className="col-qty pi-col-th" style={{ padding: `${cellPaddingY}px 4px` }}>
                  QTY
                  <div className="pi-col-resizer no-print" onMouseDown={(e) => handleColMouseDown('qty', e)} title="Drag column width (↔)" />
                  <div className="pi-row-resizer no-print" onMouseDown={(e) => handleRowMouseDown('header', e)} title="Drag row height (↕)" />
                </th>
                <th className="col-unit pi-col-th" style={{ padding: `${cellPaddingY}px 4px` }}>
                  UNIT
                  <div className="pi-col-resizer no-print" onMouseDown={(e) => handleColMouseDown('unit', e)} title="Drag column width (↔)" />
                  <div className="pi-row-resizer no-print" onMouseDown={(e) => handleRowMouseDown('header', e)} title="Drag row height (↕)" />
                </th>
                <th className="col-rate pi-col-th" style={{ padding: `${cellPaddingY}px 4px` }}>
                  UNIT PRICE
                  <div className="pi-col-resizer no-print" onMouseDown={(e) => handleColMouseDown('rate', e)} title="Drag column width (↔)" />
                  <div className="pi-row-resizer no-print" onMouseDown={(e) => handleRowMouseDown('header', e)} title="Drag row height (↕)" />
                </th>
                <th className="col-total pi-col-th" style={{ padding: `${cellPaddingY}px 4px` }}>
                  TOTAL
                  <div className="pi-col-resizer no-print" onMouseDown={(e) => handleColMouseDown('total', e)} title="Drag column width (↔)" />
                  <div className="pi-row-resizer no-print" onMouseDown={(e) => handleRowMouseDown('header', e)} title="Drag row height (↕)" />
                </th>
              </tr>
            </thead>
            <tbody>
              {displayItems.map((item) => (
                <tr key={item.slNo} style={{ height: rowHeights[item.slNo] ? `${rowHeights[item.slNo]}px` : undefined }}>
                  <td className="col-sl" style={{ padding: `${cellPaddingY}px 4px`, position: 'relative' }}>
                    {item.slNo}
                    <div className="pi-row-resizer no-print" onMouseDown={(e) => handleRowMouseDown(item.slNo, e)} title="Drag row height (↕)" />
                  </td>
                  <td className="col-desc" style={{ padding: `${cellPaddingY}px 4px`, position: 'relative' }}>
                    {item.desc}
                    <div className="pi-row-resizer no-print" onMouseDown={(e) => handleRowMouseDown(item.slNo, e)} title="Drag row height (↕)" />
                  </td>
                  <td className="col-purch" style={{ padding: `${cellPaddingY}px 4px`, position: 'relative' }}>
                    {item.itemPurch || '-'}
                    <div className="pi-row-resizer no-print" onMouseDown={(e) => handleRowMouseDown(item.slNo, e)} title="Drag row height (↕)" />
                  </td>
                  <td className="col-po" style={{ padding: `${cellPaddingY}px 4px`, whiteSpace: 'pre-line', position: 'relative' }}>
                    {item.poStyle && item.poStyle.includes(' / ') ? item.poStyle.split(' / ').join('\n') : item.poStyle}
                    <div className="pi-row-resizer no-print" onMouseDown={(e) => handleRowMouseDown(item.slNo, e)} title="Drag row height (↕)" />
                  </td>
                  <td className="col-qty" style={{ padding: `${cellPaddingY}px 4px`, position: 'relative' }}>
                    {item.qty.toLocaleString('en-US')}
                    <div className="pi-row-resizer no-print" onMouseDown={(e) => handleRowMouseDown(item.slNo, e)} title="Drag row height (↕)" />
                  </td>
                  <td className="col-unit" style={{ padding: `${cellPaddingY}px 4px`, position: 'relative' }}>
                    {item.unit}
                    <div className="pi-row-resizer no-print" onMouseDown={(e) => handleRowMouseDown(item.slNo, e)} title="Drag row height (↕)" />
                  </td>
                  <td className="col-rate" style={{ padding: `${cellPaddingY}px 4px`, position: 'relative' }}>
                    {currencySym} {item.rate.toFixed(4)}
                    <div className="pi-row-resizer no-print" onMouseDown={(e) => handleRowMouseDown(item.slNo, e)} title="Drag row height (↕)" />
                  </td>
                  <td className="col-total" style={{ padding: `${cellPaddingY}px 4px`, position: 'relative' }}>
                    {currencySym} {item.total.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    <div className="pi-row-resizer no-print" onMouseDown={(e) => handleRowMouseDown(item.slNo, e)} title="Drag row height (↕)" />
                  </td>
                </tr>
              ))}
              <tr className="pi-total-row" style={{ height: rowHeights.total ? `${rowHeights.total}px` : undefined }}>
                <td colSpan={4} style={{ textAlign: 'right', fontWeight: 'bold', padding: `${cellPaddingY}px 4px`, position: 'relative' }}>
                  TOTAL
                  <div className="pi-row-resizer no-print" onMouseDown={(e) => handleRowMouseDown('total', e)} title="Drag row height (↕)" />
                </td>
                <td className="col-qty" style={{ fontWeight: 'bold', padding: `${cellPaddingY}px 4px`, position: 'relative' }}>
                  {Number(totalQty).toLocaleString('en-US')}
                  <div className="pi-row-resizer no-print" onMouseDown={(e) => handleRowMouseDown('total', e)} title="Drag row height (↕)" />
                </td>
                <td className="col-unit" style={{ padding: `${cellPaddingY}px 4px`, position: 'relative' }}>
                  <div className="pi-row-resizer no-print" onMouseDown={(e) => handleRowMouseDown('total', e)} title="Drag row height (↕)" />
                </td>
                <td className="col-rate" style={{ padding: `${cellPaddingY}px 4px`, position: 'relative' }}>
                  <div className="pi-row-resizer no-print" onMouseDown={(e) => handleRowMouseDown('total', e)} title="Drag row height (↕)" />
                </td>
                <td className="col-total" style={{ fontWeight: 'bold', padding: `${cellPaddingY}px 4px`, position: 'relative' }}>
                  {currencySym} {Number(totalAmt).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  <div className="pi-row-resizer no-print" onMouseDown={(e) => handleRowMouseDown('total', e)} title="Drag row height (↕)" />
                </td>
              </tr>
            </tbody>
          </table>

          {/* Summary / Terms */}
          <div className="pi-summary-section">
            <div className="pi-in-words">
              {pi.amount_in_words || (totalAmt > 0 ? `IN WORDS: ${numberToCurrencyWords(totalAmt, pi.currency || 'USD')}` : '')}
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
              <div className="pi-sign-stamp"></div>
              <div className="pi-sign-line">
                Prepared By<br />For KADAL
              </div>
            </div>

            <div className="pi-sign-col">
              <div className="pi-sign-stamp"></div>
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

import React, { useMemo, useState, useRef, useLayoutEffect } from 'react';
import './ProformaInvoicePrintView.css';
import logoImg from '../../assets/logo.png';
import letterheadImg from '../../assets/letterhead.png';
import watermarkImg from '../../assets/watermark.png';
import { Printer, Download, X, CheckCircle, Move, RotateCcw } from 'lucide-react';
import { numberToCurrencyWords } from '../../utils/numberToWords';

const DEFAULT_COL_WIDTHS = {
  sl: 28,
  desc: 165,
  purch: 80,
  po: 155,
  qty: 55,
  unit: 36,
  rate: 65,
  total: 88
};

// Height budgets (px at 96 DPI) available for goods-table body rows on each A4 page type.
// single = only page (header + totals + signatures), first = page 1 of many,
// middle = continuation page without totals, final = last continuation page with totals + signatures.
// If a rendered page still overflows, the overflow guard below trims the matching budget automatically.
const PAGE_CAPACITY = { single: 350, first: 530, middle: 820, final: 640 };
const MAX_CAPACITY_TRIM = 400;

const getPageType = (page) => {
  if (page.isFirstPage && page.isLastPage) return 'single';
  if (page.isFirstPage) return 'first';
  if (page.isLastPage) return 'final';
  return 'middle';
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
      const match = poStyle.match(/Purchase(?:\s*No)?\s*[:=]\s*([^\n;]+)/i);
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
        const match = poStyle.match(/Purchase(?:\s*No)?\s*[:=]\s*([^\n;]+)/i);
        if (match) itemPurch = match[1].trim();
      }
      if (!itemPurch && purchaseNo) {
        itemPurch = purchaseNo;
      }

      if (poStyle && poStyle !== '-') {
        poStyle = poStyle.replace(/\s*\/\s*Purchase(?:\s*No)?\s*[:=]\s*[^\n;]+/i, '').trim();
      }

      // Cleanup corrupted repeating purchase numbers inside the style string
      const hiddenPurchMatch = poStyle.match(/#\d{3,6}\/\d{4}/);
      if (hiddenPurchMatch) {
        const hiddenPurch = hiddenPurchMatch[0];
        if (!itemPurch || itemPurch === '-' || itemPurch.trim() === 'KAD') {
          itemPurch = itemPurch.trim() === 'KAD' ? `KAD${hiddenPurch}` : hiddenPurch;
        }
        // Remove the hidden purchase number and any of its repeats
        const escapedHidden = hiddenPurch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const regex = new RegExp(`(?:\\/\\s*)?${escapedHidden}(?:\\s*\\/\\s*${escapedHidden})*`, 'gi');
        poStyle = poStyle.replace(regex, '').trim();
        if (poStyle.endsWith('/')) poStyle = poStyle.slice(0, -1).trim();
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
      // Sum of the saved (already rounded) line totals, so the document total always
      // equals the saved PI total. Recomputing qty * rate here caused cent-level drift.
      total: Number(m.total.toFixed(2))
    }));
  }, [pi.items, purchaseNo]);

  const totalQty = displayItems.reduce((sum, it) => sum + (Number(it.qty) || 0), 0);
  const totalAmt = Number(displayItems.reduce((sum, it) => sum + (Number(it.total) || 0), 0).toFixed(2));
  // Always derive the words from the printed TOTAL so the figure and the words can never disagree
  const amountInWords = totalAmt > 0
    ? `IN WORDS: ${numberToCurrencyWords(totalAmt, pi.currency || 'USD')}`
    : (pi.amount_in_words || '');

  // Column and Row Resizing State
  const [colWidths, setColWidths] = useState(() => ({ ...DEFAULT_COL_WIDTHS }));
  const [rowHeights, setRowHeights] = useState({});
  const [cellPaddingY, setCellPaddingY] = useState(3);

  const isCustomized = useMemo(() => {
    const hasCustomCols = Object.keys(DEFAULT_COL_WIDTHS).some(
      k => colWidths[k] !== DEFAULT_COL_WIDTHS[k]
    );
    const hasCustomRows = Object.keys(rowHeights).length > 0;
    const hasCustomPadding = cellPaddingY !== 3;
    return hasCustomCols || hasCustomRows || hasCustomPadding;
  }, [colWidths, rowHeights, cellPaddingY]);

  const handleResetSizes = () => {
    setColWidths({ ...DEFAULT_COL_WIDTHS });
    setRowHeights({});
    setCellPaddingY(3);
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

  // Real rendered row heights, measured from an off-screen copy of the goods table
  const measureRef = useRef(null);
  const pagesContainerRef = useRef(null);
  const [measuredHeights, setMeasuredHeights] = useState({});
  const [capacityTrim, setCapacityTrim] = useState({ single: 0, first: 0, middle: 0, final: 0 });

  useLayoutEffect(() => {
    const host = measureRef.current;
    if (!host) return;
    const next = {};
    host.querySelectorAll('tr[data-sl]').forEach((tr) => {
      const h = tr.offsetHeight;
      if (h > 0) next[tr.getAttribute('data-sl')] = h;
    });
    setMeasuredHeights((prev) => {
      const prevKeys = Object.keys(prev);
      const nextKeys = Object.keys(next);
      if (prevKeys.length === nextKeys.length && nextKeys.every((k) => prev[k] === next[k])) return prev;
      return next;
    });
  }, [displayItems, colWidths, cellPaddingY]);

  // Dynamic Pagination across multiple A4 pages based on available height and row heights
  const pages = useMemo(() => {
    if (!displayItems || displayItems.length === 0) {
      return [{
        items: [],
        pageIndex: 0,
        totalPages: 1,
        isFirstPage: true,
        isLastPage: true
      }];
    }

    const getItemH = (it) => {
      if (rowHeights[it.slNo]) return rowHeights[it.slNo];
      if (measuredHeights[it.slNo] > 0) return measuredHeights[it.slNo];
      // Fallback estimate (used only before the first measurement)
      const desc = it.desc || '';
      const poStyle = it.poStyle || '';
      const descColWidth = colWidths.desc || DEFAULT_COL_WIDTHS.desc || 195;
      const charsPerLineDesc = Math.max(14, Math.floor(descColWidth / 7.5));
      const descLines = Math.max(1, Math.ceil(desc.length / charsPerLineDesc));

      const poColWidth = colWidths.po || DEFAULT_COL_WIDTHS.po || 115;
      const charsPerLinePo = Math.max(10, Math.floor(poColWidth / 7.2));
      const poLineBreaks = poStyle.split('\n');
      let poLines = 0;
      poLineBreaks.forEach(line => {
        poLines += Math.max(1, Math.ceil(line.length / charsPerLinePo));
      });

      const lines = Math.max(descLines, poLines, 1);
      const basePadding = (cellPaddingY || 4) * 2;
      return Math.max(26, basePadding + 14 + (lines - 1) * 14);
    };

    const itemHeights = displayItems.map(getItemH);
    const totalCount = displayItems.length;
    const capacity = (type) => Math.max(120, PAGE_CAPACITY[type] - (capacityTrim[type] || 0));

    // suffixHeights[i] = total height of rows i..end
    const suffixHeights = new Array(totalCount + 1).fill(0);
    for (let i = totalCount - 1; i >= 0; i--) suffixHeights[i] = suffixHeights[i + 1] + itemHeights[i];

    // Keep at least a couple of rows together with the TOTAL row on the last page
    const minPreserveFinal = totalCount >= 4 ? 2 : 1;
    const pageChunks = [];
    let currentIndex = 0;

    while (currentIndex < totalCount) {
      const isFirst = pageChunks.length === 0;

      // Everything left fits on this page together with totals + signatures -> last page
      if (suffixHeights[currentIndex] <= capacity(isFirst ? 'single' : 'final')) {
        pageChunks.push(displayItems.slice(currentIndex));
        break;
      }

      // Otherwise fill this page completely (no totals here), then continue on the next page
      const pageCap = capacity(isFirst ? 'first' : 'middle');
      const start = currentIndex;
      let used = 0;
      while (currentIndex < totalCount) {
        const hasRows = currentIndex > start;
        if (hasRows && totalCount - currentIndex <= minPreserveFinal) break;
        if (hasRows && used + itemHeights[currentIndex] > pageCap) break;
        used += itemHeights[currentIndex];
        currentIndex++;
      }
      pageChunks.push(displayItems.slice(start, currentIndex));
    }

    const totalPages = pageChunks.length;
    return pageChunks.map((items, idx) => ({
      items,
      pageIndex: idx,
      totalPages,
      isFirstPage: idx === 0,
      isLastPage: idx === totalPages - 1
    }));
  }, [displayItems, rowHeights, cellPaddingY, colWidths, measuredHeights, capacityTrim]);

  // Overflow guard: if any rendered A4 sheet pushes its footer past the page edge,
  // shrink that page type's budget and re-paginate (runs before paint, so no flicker).
  useLayoutEffect(() => {
    const container = pagesContainerRef.current;
    if (!container) return;
    const updates = {};
    container.querySelectorAll('.pi-document').forEach((doc, idx) => {
      const page = pages[idx];
      const content = doc.querySelector('.pi-content');
      const footer = content && content.querySelector('.pi-footer');
      if (!page || !content || !footer || !content.clientHeight) return;
      const overflow = footer.offsetTop + footer.offsetHeight - content.clientHeight;
      if (overflow > 1) {
        const type = getPageType(page);
        updates[type] = Math.max(updates[type] || 0, Math.ceil(overflow) + 4);
      }
    });
    if (Object.keys(updates).length === 0) return;
    setCapacityTrim((prev) => {
      let changed = false;
      const next = { ...prev };
      Object.entries(updates).forEach(([type, amount]) => {
        if ((next[type] || 0) < MAX_CAPACITY_TRIM) {
          next[type] = Math.min(MAX_CAPACITY_TRIM, (next[type] || 0) + amount);
          changed = true;
        }
      });
      return changed ? next : prev;
    });
  }, [pages]);

  const handleNativePrint = () => {
    if (onPrint) {
      onPrint();
    } else {
      window.print();
    }
  };

  return (
    <div className="pi-print-wrapper">
      {/* Modal Toolbar with Print, Export PDF, Close & Page Navigator */}
      {isModal && (
        <div className="no-print pi-modal-toolbar" style={{ 
          position: 'fixed', 
          top: 16, 
          right: 24, 
          zIndex: 9999, 
          display: 'flex', 
          alignItems: 'center',
          gap: 10,
          background: 'var(--card-bg, #ffffff)',
          padding: '8px 14px',
          borderRadius: 8,
          boxShadow: '0 4px 16px rgba(0,0,0,0.25)',
          border: '1px solid var(--border-color, #cbd5e1)'
        }}>
          {pages.length > 1 && (
            <div className="pi-toolbar-page-nav" style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              marginRight: 4,
              paddingRight: 10,
              borderRight: '1px solid var(--border-color, #cbd5e1)'
            }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: '#334155' }}>
                {pages.length} Pages:
              </span>
              <div style={{ display: 'flex', gap: 4 }}>
                {pages.map((p) => (
                  <button
                    key={p.pageIndex}
                    type="button"
                    className="pi-page-jump-btn"
                    onClick={() => {
                      const el = document.getElementById(`pi-page-${p.pageIndex}`);
                      if (el) el.scrollIntoView({ behavior: 'smooth' });
                    }}
                    title={`Jump to Page ${p.pageIndex + 1}`}
                  >
                    P{p.pageIndex + 1}
                  </button>
                ))}
              </div>
            </div>
          )}
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
                amount_in_words: amountInWords,
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

      {/* Floating Navigator for Non-Modal Tab Previews (e.g. PiEditModal or ApprovalReviewModal) */}
      {!isModal && pages.length > 1 && (
        <div className="no-print pi-tab-page-nav">
          <span className="pi-page-nav-badge">
            Document ({pages.length} Pages)
          </span>
          <div className="pi-page-nav-buttons">
            {pages.map((p) => (
              <button
                key={p.pageIndex}
                type="button"
                className="pi-page-jump-btn"
                onClick={() => {
                  const el = document.getElementById(`pi-page-${p.pageIndex}`);
                  if (el) el.scrollIntoView({ behavior: 'smooth' });
                }}
                title={`Scroll to Page ${p.pageIndex + 1}`}
              >
                Page {p.pageIndex + 1}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Hidden off-screen table used to measure real row heights before pagination */}
      <div 
        ref={measureRef}
        aria-hidden="true"
        className="no-print"
        style={{
          position: 'absolute',
          visibility: 'hidden',
          pointerEvents: 'none',
          top: -99999,
          left: -99999,
          width: '178mm',
          fontFamily: "'Times New Roman', Times, serif",
          fontSize: '10.5px',
          lineHeight: 1.35
        }}
      >
        <table className="pi-goods-table" style={{ width: '100%', tableLayout: 'fixed' }}>
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
          <tbody>
            {displayItems.map((item) => (
              <tr key={item.slNo} data-sl={item.slNo}>
                <td className="col-sl" style={{ padding: `${cellPaddingY}px 4px` }}>{item.slNo}</td>
                <td className="col-desc" style={{ padding: `${cellPaddingY}px 4px` }}>{item.desc}</td>
                <td className="col-purch" style={{ padding: `${cellPaddingY}px 4px` }}>{item.itemPurch || '-'}</td>
                <td className="col-po" style={{ padding: `${cellPaddingY}px 4px`, whiteSpace: 'pre-line' }}>
                  {item.poStyle && item.poStyle.includes(' / ') ? item.poStyle.split(' / ').join('\n') : item.poStyle}
                </td>
                <td className="col-qty" style={{ padding: `${cellPaddingY}px 4px` }}>{item.qty.toLocaleString('en-US')}</td>
                <td className="col-unit" style={{ padding: `${cellPaddingY}px 4px` }}>{item.unit}</td>
                <td className="col-rate" style={{ padding: `${cellPaddingY}px 4px` }}>{currencySym} {item.rate.toFixed(4)}</td>
                <td className="col-total" style={{ padding: `${cellPaddingY}px 4px` }}>
                  {currencySym} {item.total.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pages Container: Renders each A4 sheet */}
      <div className="pi-pages-container" ref={pagesContainerRef}>
        {pages.map((page) => (
          <div 
            key={`page-${page.pageIndex}`} 
            className="pi-document" 
            id={page.isFirstPage ? 'printable-pi-document' : `pi-page-${page.pageIndex}`}
          >
            {/* Background Watermark */}
            <div 
              className="pi-watermark" 
              style={{ backgroundImage: `url(${watermarkImg})` }}
            />

            <div className="pi-content">
              {/* PAGE 1: Full Letterhead & Meta Section */}
              {page.isFirstPage ? (
                <>
                  <div className="pi-header">
                    <img src={letterheadImg} alt="K.A. DESIGN ACCESSORIES LTD." className="pi-header-letterhead" />
                  </div>

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
                          className={`pi-pill-btn ${cellPaddingY === 3 ? 'active' : ''}`}
                          onClick={() => setCellPaddingY(3)}
                          title="Normal rows"
                        >
                          Normal
                        </button>
                        <button
                          type="button"
                          className={`pi-pill-btn ${cellPaddingY === 6 ? 'active' : ''}`}
                          onClick={() => setCellPaddingY(6)}
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
                </>
              ) : (
                /* PAGE 2+: Compact Continuation Header */
                <>
                  <div className="pi-continuation-header">
                    <div className="pi-continuation-left">
                      <div className="pi-continuation-company">
                        {pi.beneficiary_name || 'K.A. DESIGN ACCESSORIES LTD.'}
                      </div>
                      <div className="pi-continuation-doc-type">
                        {isBill ? 'COMMERCIAL BILL' : 'PROFORMA INVOICE'} — CONTINUATION SHEET
                      </div>
                    </div>
                    <div className="pi-continuation-right">
                      <div className="pi-continuation-row">
                        <span>{isBill ? 'BILL NO. :' : 'PROFORMA INVOICE NO. :'}</span>
                        <strong>{isBill ? (pi.bill_number || '-') : (pi.pi_number || '-')}</strong>
                      </div>
                      <div className="pi-continuation-row">
                        <span>DATE :</span>
                        <strong>{formatDate(isBill ? (pi.bill_date || pi.pi_date) : pi.pi_date)}</strong>
                      </div>
                      {isBill && pi.pi_number && (
                        <div className="pi-continuation-row">
                          <span>PI REF NO. :</span>
                          <strong>{pi.pi_number}</strong>
                        </div>
                      )}
                      <div className="pi-continuation-page-tag">
                        Page {page.pageIndex + 1} of {page.totalPages}
                      </div>
                    </div>
                  </div>

                  <div className="pi-table-header-bar pi-continuation-table-bar">
                    <div className="pi-table-title">DESCRIPTION OF GOODS (CONTINUED) :</div>
                  </div>
                </>
              )}

              {/* Goods Table for Current Page */}
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
                  {page.items.map((item) => (
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

                  {/* Grand Total Row Rendered Exclusively on Final Page */}
                  {page.isLastPage && (
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
                  )}
                </tbody>
              </table>

              {/* Continuation Notice on non-final pages */}
              {!page.isLastPage && (
                <div className="pi-continuation-notice">
                  <span>--- Continued on Page {page.pageIndex + 2} ---</span>
                </div>
              )}

              {/* Summary and Signatures on Final Page */}
              {page.isLastPage && (
                <>
                  <div className="pi-summary-section">
                    <div className="pi-in-words">
                      {amountInWords}
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
                        Accepted By<br />Buyer Signature & Seal
                      </div>
                    </div>
                  </div>
                </>
              )}

              {/* Document Footer with Page Counter */}
              <div className="pi-footer">
                <div className="pi-footer-left">
                  <div className="pi-footer-block-title">Office & Factory :</div>
                  <div>356/1, Block-B, Tek Kathora</div>
                  <div>Salna, Gazipur-1703</div>
                  <div>Bangladesh</div>
                </div>
                <div className="pi-footer-center">
                  <div className="pi-page-indicator">
                    Page {page.pageIndex + 1} of {page.totalPages}
                  </div>
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
        ))}
      </div>
    </div>
  );
}

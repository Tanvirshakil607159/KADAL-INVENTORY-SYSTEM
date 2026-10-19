import { numberToCurrencyWords } from '../../utils/numberToWords';

/**
 * Helpers for the PI approval modal (preview + admin edit).
 * A pending PI only exists as JSON inside the approval request, so the
 * preview and editor are built from that payload.
 */

export const CURRENCY_SYMBOLS = { USD: '$', BDT: '৳', EUR: '€' };

export const parseApprovalData = (raw) => {
  if (!raw) return {};
  if (typeof raw === 'string') {
    try { return JSON.parse(raw) || {}; } catch { return {}; }
  }
  return raw;
};

const num = (v) => Number(v) || 0;
const str = (v) => (v === null || v === undefined ? '' : String(v));

const stripPurchaseFromNotes = (notes) =>
  str(notes).replace(/Purchase\s*No\s*:\s*[^|;\n]+/i, '').replace(/\s*[|;]\s*[|;]\s*/g, ' | ').replace(/^[\s|;]+|[\s|;]+$/g, '');

export const calcTotals = (items, currency) => {
  const totalQuantity = items.reduce((s, it) => s + num(it.quantity), 0);
  const totalAmount = Number(
    items.reduce((s, it) => s + Number((num(it.quantity) * num(it.unitPrice)).toFixed(2)), 0).toFixed(2)
  ) || 0;
  let amountInWords = 'ZERO ONLY';
  try {
    if (totalAmount > 0) amountInWords = `IN WORDS: ${numberToCurrencyWords(totalAmount, currency)}`;
  } catch { /* keep default */ }
  return { totalQuantity, totalAmount, amountInWords };
};

/** Approval data (camel or snake) -> snake_case PI used by ProformaInvoicePrintView / PDF export. */
export const buildPrintPi = (raw) => {
  const d = parseApprovalData(raw);
  const pNum = str(d.purchaseNumber || d.purchaseNo || d.purchase_no).trim();
  const bin = str(d.beneficiaryBin || d.beneficiary_bin).trim();
  const items = Array.isArray(d.items) ? d.items : [];
  return {
    id: null,
    isDraft: true,
    pi_number: d.piNumber || d.pi_number || 'DRAFT-PI',
    pi_date: d.piDate || d.pi_date || new Date().toISOString(),
    recipient_id: d.recipientId || d.recipient_id || null,
    applicant_name: d.applicantName || d.applicant_name || '',
    applicant_address: d.applicantAddress || d.applicant_address || null,
    beneficiary_name: d.beneficiaryName || d.beneficiary_name || '',
    beneficiary_address: d.beneficiaryAddress || d.beneficiary_address || '',
    beneficiary_bin: bin,
    beneficiaryBin: bin,
    bank_details: d.bankDetails || d.bank_details || '',
    buyer: d.buyer || null,
    purchase_no: pNum,
    purchaseNo: pNum,
    currency: d.currency || 'USD',
    currency_symbol: d.currencySymbol || d.currency_symbol || '$',
    total_quantity: num(d.totalQuantity ?? d.total_quantity),
    total_amount: num(d.totalAmount ?? d.total_amount),
    amount_in_words: d.amountInWords || d.amount_in_words || '',
    net_weight: d.netWeight || d.net_weight || '',
    gross_weight: d.grossWeight || d.gross_weight || '',
    terms_conditions: d.termsConditions || d.terms_conditions || '',
    status: 'APPROVED',
    notes: d.notes || null,
    items: items.map((it, idx) => {
      const itemPurch = str(it.purchaseNo || it.purchase_no || pNum).trim();
      const poStyle = str(it.poStyleNo || it.po_style_no).trim() || '-';
      const desc = str(it.itemDescription || it.item_description).trim() || 'Custom Accessory Item';
      const unitPrice = num(it.unitPrice ?? it.unit_price);
      return {
        sl_no: it.slNo || it.sl_no || idx + 1,
        itemId: it.itemId || it.item_id || null,
        item_id: it.itemId || it.item_id || null,
        itemCode: it.itemCode || it.item_code || '',
        item_code: it.itemCode || it.item_code || '',
        item_description: desc,
        itemDescription: desc,
        purchase_no: itemPurch,
        purchaseNo: itemPurch,
        order_number: it.orderNumber || it.order_number || '',
        orderNumber: it.orderNumber || it.order_number || '',
        style_name: it.styleName || it.style_name || '',
        styleName: it.styleName || it.style_name || '',
        po_style_no: poStyle,
        poStyleNo: poStyle,
        quantity: num(it.quantity),
        unit: str(it.unit || 'PCS').toUpperCase(),
        unit_price: unitPrice,
        unitPrice,
        total_amount: num(it.totalAmount ?? it.total_amount),
        totalAmount: num(it.totalAmount ?? it.total_amount)
      };
    })
  };
};

/** Approval data -> flat editable form state. */
export const toEditForm = (raw) => {
  const d = parseApprovalData(raw);
  const items = Array.isArray(d.items) ? d.items : [];
  const dateVal = d.piDate || d.pi_date || '';
  return {
    piNumber: str(d.piNumber || d.pi_number),
    piDate: dateVal ? String(dateVal).slice(0, 10) : '',
    applicantName: str(d.applicantName || d.applicant_name),
    applicantAddress: str(d.applicantAddress || d.applicant_address),
    beneficiaryName: str(d.beneficiaryName || d.beneficiary_name),
    beneficiaryAddress: str(d.beneficiaryAddress || d.beneficiary_address),
    beneficiaryBin: str(d.beneficiaryBin || d.beneficiary_bin),
    bankDetails: str(d.bankDetails || d.bank_details),
    buyer: str(d.buyer),
    purchaseNumber: str(d.purchaseNumber || d.purchaseNo || d.purchase_no),
    currency: str(d.currency || 'USD'),
    currencySymbol: str(d.currencySymbol || d.currency_symbol || '$'),
    netWeight: str(d.netWeight || d.net_weight),
    grossWeight: str(d.grossWeight || d.gross_weight),
    termsConditions: str(d.termsConditions || d.terms_conditions),
    notes: str(d.notes),
    items: items.map((it) => ({
      ...it,
      itemId: it.itemId || it.item_id || null,
      itemDescription: str(it.itemDescription || it.item_description),
      purchaseNo: str(it.purchaseNo || it.purchase_no),
      poStyleNo: str(it.poStyleNo || it.po_style_no),
      quantity: it.quantity ?? '',
      unit: str(it.unit || 'PCS'),
      unitPrice: it.unitPrice ?? it.unit_price ?? ''
    }))
  };
};

/** Editor form + original approval data -> payload to persist via approvals.updateData. */
export const buildApprovalPayload = (form, originalRaw) => {
  const original = parseApprovalData(originalRaw);
  const pNum = form.purchaseNumber.trim();

  const items = form.items.map((it, idx) => {
    const quantity = num(it.quantity);
    const unitPrice = num(it.unitPrice);
    const totalAmount = Number((quantity * unitPrice).toFixed(2));
    const desc = str(it.itemDescription).trim();
    const purch = str(it.purchaseNo).trim() || pNum;
    const poStyle = str(it.poStyleNo).trim() || '-';
    const unit = str(it.unit || 'PCS').trim().toUpperCase();
    return {
      ...it,
      slNo: idx + 1,
      sl_no: idx + 1,
      itemId: it.itemId || null,
      item_id: it.itemId || null,
      itemDescription: desc,
      item_description: desc,
      purchaseNo: purch,
      purchase_no: purch,
      // order/style are folded into poStyleNo by the editor; clear so they are not re-prefixed
      orderNumber: '',
      order_number: '',
      styleName: '',
      style_name: '',
      poStyleNo: poStyle,
      po_style_no: poStyle,
      quantity,
      unit,
      unitPrice,
      unit_price: unitPrice,
      totalAmount,
      total_amount: totalAmount
    };
  });

  const currency = form.currency.trim() || 'USD';
  const totals = calcTotals(items, currency);

  let notes = form.notes.trim();
  if (/Purchase\s*No\s*:/i.test(notes)) {
    notes = pNum
      ? notes.replace(/Purchase\s*No\s*:\s*[^|;\n]+/i, `Purchase No: ${pNum}`)
      : stripPurchaseFromNotes(notes);
  }

  return {
    ...original,
    piNumber: form.piNumber.trim(),
    piDate: form.piDate || original.piDate,
    applicantName: form.applicantName.trim(),
    applicantAddress: form.applicantAddress.trim(),
    beneficiaryName: form.beneficiaryName,
    beneficiaryAddress: form.beneficiaryAddress,
    beneficiaryBin: form.beneficiaryBin.trim(),
    bankDetails: form.bankDetails,
    buyer: form.buyer.trim(),
    purchaseNumber: pNum,
    purchaseNo: pNum,
    currency,
    currencySymbol: form.currencySymbol || CURRENCY_SYMBOLS[currency] || currency,
    netWeight: form.netWeight,
    grossWeight: form.grossWeight,
    termsConditions: form.termsConditions,
    notes,
    ...totals,
    items
  };
};

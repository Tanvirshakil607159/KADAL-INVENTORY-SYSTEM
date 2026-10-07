const FinanceRepo = require('../database/repositories/finance');
const AuditLogsRepo = require('../database/repositories/audit-logs');
const AuthService = require('./auth-service');
const PdfGenerator = require('../utils/pdf-generator');
const SettingsRepo = require('../database/repositories/settings');
const { numberToCurrencyWords } = require('../utils/number-to-words');

const FinanceService = {
  async getAll(filters) {
    return await FinanceRepo.getAll(filters);
  },

  async getById(id) {
    return await FinanceRepo.getById(id);
  },

  async getByNumber(piNumber) {
    return await FinanceRepo.getByNumber(piNumber);
  },

  async create(data) {
    const user = await AuthService.getCurrentUser();

    if (!data.applicantName || !data.applicantName.trim()) {
      throw new Error('Applicant name is required');
    }

    if (!data.items || data.items.length === 0) {
      throw new Error('Please include at least one item in the Proforma Invoice');
    }

    // Auto calculate totals if not provided or to ensure accuracy
    let totalQty = 0;
    let totalAmt = 0;
    const sanitizedItems = (data.items || []).map((it, idx) => {
      const qty = Number(it.quantity) || 0;
      const rate = Number(it.unitPrice !== undefined ? it.unitPrice : it.unit_price) || 0;
      const lineTotal = Number(it.totalAmount !== undefined ? it.totalAmount : (it.total_amount !== undefined ? it.total_amount : (qty * rate).toFixed(2)));
      const desc = it.itemDescription || it.item_description || it.description || it.name || 'Custom Accessory Item';
      let poStyle = it.poStyleNo || it.po_style_no || '';
      const poVal = it.order_number || it.orderNumber || '';
      const styleVal = it.style_name || it.styleName || '';
      let purchaseVal = it.purchase_no || it.purchaseNo || it.purchase_number || it.purchaseNumber || '';

      if (!purchaseVal && poStyle) {
        const match = poStyle.match(/Purchase(?:\s*No)?\s*[:=]\s*([^\n;]+)/i);
        if (match) purchaseVal = match[1].trim();
      }

      let poStyleClean = poStyle;
      if (poStyleClean && poStyleClean !== '-') {
        poStyleClean = poStyleClean.replace(/\s*\/\s*Purchase(?:\s*No)?\s*[:=]\s*[^\n;]+/i, '').trim();
        if (poVal && !poStyleClean.toLowerCase().includes('po:') && !poStyleClean.includes(poVal)) {
          poStyleClean = `PO: ${poVal} / ` + poStyleClean.replace(/^Style:\s*/i, 'Style: ');
        }
      } else {
        const parts = [];
        if (poVal) parts.push(`PO: ${poVal}`);
        if (styleVal) parts.push(`Style: ${styleVal}`);
        poStyleClean = parts.length > 0 ? parts.join(' / ') : '-';
      }

      let combinedPoStyle = poStyleClean;
      if (purchaseVal && !combinedPoStyle.toLowerCase().includes('purchase')) {
        combinedPoStyle = combinedPoStyle !== '-'
          ? `${combinedPoStyle} / Purchase No: ${purchaseVal}`
          : `Purchase No: ${purchaseVal}`;
      }

      totalQty += qty;
      totalAmt += lineTotal;
      return {
        ...it,
        slNo: it.slNo || it.sl_no || idx + 1,
        sl_no: it.slNo || it.sl_no || idx + 1,
        itemDescription: desc,
        item_description: desc,
        purchaseNo: purchaseVal,
        purchase_no: purchaseVal,
        poStyleNo: poStyleClean,
        po_style_no: combinedPoStyle,
        quantity: qty,
        unit: (it.unit || 'PCS').toUpperCase(),
        unitPrice: rate,
        unit_price: rate,
        totalAmount: lineTotal,
        total_amount: lineTotal,
      };
    });

    totalAmt = Number(totalAmt.toFixed(2));
    const currency = data.currency || 'USD';
    const amountInWords = data.amountInWords || `IN WORDS: ${numberToCurrencyWords(totalAmt, currency)}`;

    let piNumber = data.piNumber;
    if (!piNumber || !piNumber.trim()) {
      piNumber = await FinanceRepo.getNextNumber(data.applicantName);
    }

    let notes = data.notes || '';
    const pNum = (data.purchaseNumber || data.purchaseNo || '').trim();
    if (pNum && !notes.toLowerCase().includes('purchase no')) {
      notes = notes ? `${notes} | Purchase No: ${pNum}` : `Purchase No: ${pNum}`;
    }

    const payload = {
      ...data,
      piNumber,
      currency,
      totalQuantity: Number(data.totalQuantity) || totalQty,
      totalAmount: totalAmt,
      amountInWords,
      notes: notes || null,
      createdBy: user?.id,
      items: sanitizedItems,
    };

    const res = await FinanceRepo.create(payload);

    await AuditLogsRepo.create({
      userId: user?.id,
      action: 'CREATE',
      entityType: 'proforma_invoice',
      entityId: res.id,
      newValue: { piNumber, applicantName: data.applicantName, totalAmount: totalAmt },
    });

    return { success: true, id: res.id, piNumber };
  },

  async update(id, data) {
    const user = await AuthService.getCurrentUser();
    const old = await FinanceRepo.getById(id);
    if (!old) throw new Error('Proforma Invoice not found');

    const res = await FinanceRepo.update(id, data);

    await AuditLogsRepo.create({
      userId: user?.id,
      action: 'UPDATE',
      entityType: 'proforma_invoice',
      entityId: id,
      oldValue: { piNumber: old.pi_number, status: old.status },
      newValue: data,
    });

    return { success: true };
  },

  async delete(id) {
    const user = await AuthService.getCurrentUser();
    const old = await FinanceRepo.getById(id);
    if (!old) throw new Error('Proforma Invoice not found');

    await FinanceRepo.delete(id);

    await AuditLogsRepo.create({
      userId: user?.id,
      action: 'DELETE',
      entityType: 'proforma_invoice',
      entityId: id,
      oldValue: { piNumber: old.pi_number, applicantName: old.applicant_name },
    });

    return { success: true };
  },

  async getNextNumber(applicantName) {
    return await FinanceRepo.getNextNumber(applicantName);
  },

  async getNextBillNumber(applicantName) {
    return await FinanceRepo.getNextBillNumber(applicantName);
  },

  async getUsedChallanIds() {
    return await FinanceRepo.getUsedChallanIds();
  },

  async getPiReconciliation(id) {
    return await FinanceRepo.getPiReconciliation(id);
  },

  async transferPiToBill(id) {
    const user = await AuthService.getCurrentUser();
    const res = await FinanceRepo.transferPiToBill(id);
    await AuditLogsRepo.create({
      userId: user?.id,
      action: 'UPDATE',
      entityType: 'proforma_invoice',
      entityId: id,
      newValue: { status: 'BILLED', billNumber: res.billNumber, billDate: res.billDate }
    });
    return res;
  },

  async exportPdf(target) {
    let pi;
    if (typeof target === 'object' && target !== null) {
      if (target.id) {
        const dbPi = await FinanceRepo.getById(target.id);
        if (dbPi) {
          pi = {
            ...dbPi,
            ...target,
            items: (target.items && target.items.length > 0) ? target.items : dbPi.items,
            displayItems: target.displayItems || null,
            total_quantity: target.total_quantity !== undefined ? target.total_quantity : dbPi.total_quantity,
            total_amount: target.total_amount !== undefined ? target.total_amount : dbPi.total_amount,
            amount_in_words: target.amount_in_words || dbPi.amount_in_words,
            customColWidths: target.customColWidths || target.colWidths,
            customRowPadding: target.customRowPadding || target.cellPaddingY,
            customRowHeights: target.customRowHeights || target.rowHeights
          };
        } else {
          pi = target;
        }
      } else {
        pi = target;
      }
    } else {
      pi = await FinanceRepo.getById(target);
    }
    if (!pi) throw new Error('Proforma Invoice not found');
    let settings = {};
    try {
      settings = (await SettingsRepo.getAll()) || {};
    } catch (e) {
      settings = {};
    }
    return await PdfGenerator.generateProformaInvoicePdf(pi, settings);
  }
};

module.exports = FinanceService;

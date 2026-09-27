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
      const desc = it.itemDescription || it.item_description || it.name || it.item_name || '';
      const poStyle = it.poStyleNo || it.po_style_no || it.style_name || it.order_number || it.purchase_no || '-';
      totalQty += qty;
      totalAmt += lineTotal;
      return {
        ...it,
        slNo: it.slNo || it.sl_no || idx + 1,
        sl_no: it.slNo || it.sl_no || idx + 1,
        itemDescription: desc,
        item_description: desc,
        poStyleNo: poStyle,
        po_style_no: poStyle,
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

    const payload = {
      ...data,
      piNumber,
      currency,
      totalQuantity: totalQty,
      totalAmount: totalAmt,
      amountInWords,
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

  async exportPdf(target) {
    let pi;
    if (typeof target === 'object' && target !== null) {
      pi = target;
    } else {
      pi = await FinanceRepo.getById(target);
    }
    if (!pi) throw new Error('Proforma Invoice not found');
    const settings = await SettingsRepo.getAll();
    return await PdfGenerator.generateProformaInvoicePdf(pi, settings);
  }
};

module.exports = FinanceService;

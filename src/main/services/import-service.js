const ExcelJS = require('exceljs');
const { dialog } = require('electron');
const https = require('https');
const http = require('http');
const ItemsRepo = require('../database/repositories/items');
const CategoriesRepo = require('../database/repositories/categories');
const SuppliersRepo = require('../database/repositories/suppliers');
const BuyersRepo = require('../database/repositories/buyers');
const StockTransactionsRepo = require('../database/repositories/stock-transactions');
const AuthService = require('./auth-service');

// Known header aliases for smart column mapping
const HEADER_MAP = {
  name: ['name', 'item name', 'item_name', 'product', 'product name', 'description', 'item'],
  category: ['category', 'category name', 'cat', 'group', 'type'],
  size: ['size', 'dimension', 'dimensions'],
  color: ['color', 'colour', 'clr'],
  unit: ['unit', 'uom', 'unit of measure', 'measurement'],
  supplier: ['supplier', 'supplier name', 'vendor', 'vendor name'],
  buyerName: ['buyer', 'buyer name', 'buyer_name', 'customer'],
  styleName: ['style', 'style name', 'style_name', 'style no', 'style no.'],
  purchaseNo: ['purchase no', 'purchase_no', 'po', 'po no', 'po number', 'purchase order', 'purchase no.'],
  openingStock: ['stock', 'opening stock', 'opening_stock', 'qty', 'quantity', 'current stock', 'balance'],
  minStockLevel: ['min stock', 'min_stock', 'min level', 'minimum', 'min_stock_level', 'reorder'],
  unitPrice: ['unit price', 'unit_price', 'price', 'cost', 'rate', 'value'],
  orderNumber: ['order number', 'order_number', 'order no', 'order no.'],
  notes: ['notes', 'note', 'remark', 'remarks', 'comment', 'comments'],
};

function matchHeader(header) {
  const h = (header || '').toString().toLowerCase().trim();
  for (const [field, aliases] of Object.entries(HEADER_MAP)) {
    if (aliases.includes(h)) return field;
  }
  return null;
}

const ImportService = {
  async selectExcelFile() {
    const result = await dialog.showOpenDialog({
      title: 'Select Excel File',
      filters: [{ name: 'Excel Files', extensions: ['xlsx', 'xls', 'csv'] }],
      properties: ['openFile'],
    });
    if (result.canceled || !result.filePaths.length) return null;
    return result.filePaths[0];
  },

  async parseExcelFile(filePath) {
    const workbook = new ExcelJS.Workbook();
    if (filePath.endsWith('.csv')) {
      await workbook.csv.readFile(filePath);
    } else {
      await workbook.xlsx.readFile(filePath);
    }

    const worksheet = workbook.worksheets[0];
    if (!worksheet || worksheet.rowCount < 2) throw new Error('Empty or invalid spreadsheet');

    return this._parseWorksheet(worksheet);
  },

  async parseGoogleSheet(url) {
    // Convert Google Sheet URL to CSV export URL
    const csvUrl = this._getGoogleSheetCsvUrl(url);
    const csvData = await this._fetchUrl(csvUrl);

    const workbook = new ExcelJS.Workbook();
    // Parse CSV from buffer
    const stream = require('stream');
    const readable = new stream.Readable();
    readable.push(csvData);
    readable.push(null);
    await workbook.csv.read(readable);

    const worksheet = workbook.worksheets[0];
    if (!worksheet || worksheet.rowCount < 2) throw new Error('Empty or invalid sheet');

    return this._parseWorksheet(worksheet);
  },

  _parseWorksheet(worksheet) {
    // Extract headers from first row
    const headerRow = worksheet.getRow(1);
    const headers = [];
    const columnMap = {};

    headerRow.eachCell({ includeEmpty: true }, (cell, colNumber) => {
      const rawHeader = (cell.value || '').toString().trim();
      const mapped = matchHeader(rawHeader);
      headers.push({ col: colNumber, raw: rawHeader, mapped });
      if (mapped) columnMap[mapped] = colNumber;
    });

    if (!columnMap.name) {
      throw new Error('Could not find an "Item Name" column. Please ensure your sheet has a column named "Name", "Item Name", or "Product".');
    }

    // Parse data rows and merge duplicates
    const rowsMap = new Map();

    for (let i = 2; i <= worksheet.rowCount; i++) {
      const row = worksheet.getRow(i);
      const getValue = (field) => {
        const col = columnMap[field];
        if (!col) return '';
        const val = row.getCell(col).value;
        if (val === null || val === undefined) return '';
        if (typeof val === 'object' && val.richText) return val.richText.map(r => r.text).join('');
        if (typeof val === 'object' && val.result !== undefined) return String(val.result);
        return String(val).trim();
      };

      const name = getValue('name');
      if (!name) continue; // Skip empty rows

      const category = getValue('category');
      const styleName = getValue('styleName');
      const purchaseNo = getValue('purchaseNo');
      const orderNumber = getValue('orderNumber');

      const key = `${name.toLowerCase()}|${category.toLowerCase()}|${styleName.toLowerCase()}|${purchaseNo.toLowerCase()}|${orderNumber.toLowerCase()}`;

      const openingStock = parseInt(getValue('openingStock'), 10) || 0;

      if (rowsMap.has(key)) {
        const existing = rowsMap.get(key);
        existing.openingStock += openingStock;
        // Optionally merge notes or sizes if needed, but the request only specified summing the quantity
      } else {
        rowsMap.set(key, {
          name,
          category,
          size: getValue('size'),
          color: getValue('color'),
          unit: getValue('unit') || 'pcs',
          supplier: getValue('supplier'),
          buyerName: getValue('buyerName'),
          styleName,
          purchaseNo,
          orderNumber,
          unitPrice: parseFloat(getValue('unitPrice')) || 0,
          openingStock,
          minStockLevel: parseInt(getValue('minStockLevel'), 10) || 0,
          notes: getValue('notes'),
        });
      }
    }

    const rows = Array.from(rowsMap.values());

    return { headers, columnMap, rows, totalRows: rows.length };
  },

  async importItems(rows) {
    let imported = 0;
    let skipped = 0;
    const errors = [];

    for (const row of rows) {
      try {
        // Auto-create category if specified and doesn't exist
        let categoryId = null;
        if (row.category) {
          const cats = await CategoriesRepo.getAll();
          const existing = cats.find(c => c.name.toLowerCase() === row.category.toLowerCase());
          if (existing) {
            categoryId = existing.id;
          } else {
            const r = await CategoriesRepo.create({ name: row.category });
            categoryId = r.lastInsertRowid || r;
          }
        }

        // Auto-create supplier if specified and doesn't exist
        let supplierId = null;
        if (row.supplier) {
          const supps = await SuppliersRepo.getAll();
          const existing = supps.find(s => s.name.toLowerCase() === row.supplier.toLowerCase());
          if (existing) {
            supplierId = existing.id;
          } else {
            const r = await SuppliersRepo.create({ name: row.supplier });
            supplierId = r.lastInsertRowid || r;
          }
        }

        // Auto-create buyer if specified and doesn't exist
        if (row.buyerName) {
          const buyers = await BuyersRepo.getAll();
          const existing = buyers.find(b => b.name.toLowerCase() === row.buyerName.toLowerCase());
          if (!existing) {
            await BuyersRepo.create({ name: row.buyerName });
          }
        }

        // Create item (item code auto-generated by ItemsRepo)
        const id = await ItemsRepo.create({
          itemCode: '', // auto-generated
          name: row.name,
          categoryId,
          size: row.size || null,
          color: row.color || null,
          unit: row.unit || 'pcs',
          supplierId,
          openingStock: row.openingStock || 0,
          minStockLevel: row.minStockLevel || 0,
          notes: row.notes || null,
          buyerName: row.buyerName || null,
          styleName: row.styleName || null,
          purchaseNo: row.purchaseNo || null,
          orderNumber: row.orderNumber || null,
          unitPrice: row.unitPrice || 0,
        });

        if (row.openingStock && row.openingStock > 0) {
          await StockTransactionsRepo.create({
            itemId: id,
            type: 'IN',
            quantity: row.openingStock,
            stockBefore: 0,
            stockAfter: row.openingStock,
            reference: 'Opening Stock',
            notes: 'Imported from spreadsheet',
            createdBy: AuthService.getCurrentUser()?.id,
          });
        }

        imported++;
      } catch (e) {
        skipped++;
        errors.push(`Row "${row.name}": ${e.message}`);
      }
    }

    return { imported, skipped, errors };
  },

  _getGoogleSheetCsvUrl(url) {
    // Handle various Google Sheet URL formats
    // Format: https://docs.google.com/spreadsheets/d/SHEET_ID/edit...
    // Convert to: https://docs.google.com/spreadsheets/d/SHEET_ID/export?format=csv
    const match = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/);
    if (!match) throw new Error('Invalid Google Sheet URL. Use the link from your browser address bar.');
    const sheetId = match[1];

    // Check for gid parameter for specific tab
    const gidMatch = url.match(/gid=(\d+)/);
    const gid = gidMatch ? gidMatch[1] : '0';

    return `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv&gid=${gid}`;
  },

  _fetchUrl(url) {
    return new Promise((resolve, reject) => {
      const client = url.startsWith('https') ? https : http;
      const request = (reqUrl) => {
        client.get(reqUrl, { headers: { 'User-Agent': 'KADAL-Inventory/1.0' } }, (res) => {
          // Follow redirects
          if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
            request(res.headers.location);
            return;
          }
          if (res.statusCode !== 200) {
            reject(new Error(`Failed to fetch sheet (HTTP ${res.statusCode}). Make sure the sheet is publicly accessible (Share → Anyone with the link).`));
            return;
          }
          const chunks = [];
          res.on('data', (chunk) => chunks.push(chunk));
          res.on('end', () => resolve(Buffer.concat(chunks).toString('utf-8')));
          res.on('error', reject);
        }).on('error', reject);
      };
      request(url);
    });
  },
  async downloadTemplate() {
    const result = await dialog.showSaveDialog({
      title: 'Save Template File',
      defaultPath: 'inventory_import_template.xlsx',
      filters: [{ name: 'Excel Files', extensions: ['xlsx'] }],
    });
    if (result.canceled || !result.filePath) return false;

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Template');

    worksheet.columns = [
      { header: 'Item Name', key: 'name', width: 25 },
      { header: 'Category', key: 'category', width: 15 },
      { header: 'Size', key: 'size', width: 10 },
      { header: 'Color', key: 'color', width: 10 },
      { header: 'Unit', key: 'unit', width: 10 },
      { header: 'Supplier', key: 'supplier', width: 20 },
      { header: 'Buyer Name', key: 'buyerName', width: 20 },
      { header: 'Style Name', key: 'styleName', width: 15 },
      { header: 'Purchase No', key: 'purchaseNo', width: 15 },
      { header: 'Order Number', key: 'orderNumber', width: 15 },
      { header: 'Unit Price', key: 'unitPrice', width: 15 },
      { header: 'Opening Stock', key: 'openingStock', width: 15 },
      { header: 'Min Stock Level', key: 'minStockLevel', width: 15 },
      { header: 'Notes', key: 'notes', width: 30 }
    ];

    worksheet.addRow({
      name: 'Cotton Yarn 50s',
      category: 'Yarn',
      size: '50s',
      color: 'White',
      unit: 'lbs',
      supplier: 'ABC Textiles',
      buyerName: 'Target',
      styleName: 'SUMMER-26',
      purchaseNo: 'PO-98765',
      orderNumber: 'ORD-54321',
      unitPrice: 5.50,
      openingStock: 500,
      minStockLevel: 100,
      notes: 'Prime quality yarn'
    });

    worksheet.getRow(1).font = { bold: true };

    await workbook.xlsx.writeFile(result.filePath);
    return true;
  },
};

module.exports = ImportService;

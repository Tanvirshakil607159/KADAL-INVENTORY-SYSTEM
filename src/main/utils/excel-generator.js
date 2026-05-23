const ExcelJS = require('exceljs');
const path = require('path');
const { app, shell } = require('electron');
const fs = require('fs');

const ExcelGenerator = {
  async generateReport(title, columns, data, settings = {}, options = {}) {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'KADAL Inventory System';
    workbook.created = new Date();

    const sheet = workbook.addWorksheet(title.slice(0, 31));

    // Company header
    const companyName = settings.company_name || 'KA Design Accessories LTD';
    sheet.mergeCells(1, 1, 1, columns.length);
    const titleCell = sheet.getCell('A1');
    titleCell.value = companyName;
    titleCell.font = { size: 16, bold: true, color: { argb: 'FF1A1A2E' } };
    titleCell.alignment = { horizontal: 'center' };

    sheet.mergeCells(2, 1, 2, columns.length);
    const subtitleCell = sheet.getCell('A2');
    subtitleCell.value = title;
    subtitleCell.font = { size: 13, bold: true, color: { argb: 'FF6366F1' } };
    subtitleCell.alignment = { horizontal: 'center' };

    sheet.mergeCells(3, 1, 3, columns.length);
    const dateCell = sheet.getCell('A3');
    dateCell.value = `Generated: ${new Date().toLocaleString('en-GB')}`;
    dateCell.font = { size: 9, italic: true, color: { argb: 'FF999999' } };
    dateCell.alignment = { horizontal: 'center' };

    if (options?.subtitles) {
      options.subtitles.forEach(st => {
        const row = sheet.addRow([st]);
        sheet.mergeCells(row.number, 1, row.number, columns.length);
        row.getCell(1).font = { size: 10, bold: true, color: { argb: 'FF333333' } };
        row.getCell(1).alignment = { horizontal: 'center' };
      });
    }

    // Empty row
    sheet.addRow([]);

    // Header row
    const headerRow = sheet.addRow(columns.map(c => c.label));
    headerRow.eachCell((cell) => {
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 10 };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF6366F1' } };
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFDDDDDD' } },
        bottom: { style: 'thin', color: { argb: 'FFDDDDDD' } },
        left: { style: 'thin', color: { argb: 'FFDDDDDD' } },
        right: { style: 'thin', color: { argb: 'FFDDDDDD' } },
      };
    });
    headerRow.height = 28;

    // Data rows
    data.forEach((row, idx) => {
      const dataRow = sheet.addRow(columns.map(c => {
        if (c.format) return c.format(row[c.key], row);
        return row[c.key] ?? '';
      }));

      dataRow.eachCell((cell, colNumber) => {
        cell.font = { size: 9 };
        cell.alignment = { horizontal: columns[colNumber - 1]?.align || 'left', vertical: 'middle', wrapText: true };

        cell.border = {
          top: { style: 'thin', color: { argb: 'FFEEEEEE' } },
          bottom: { style: 'thin', color: { argb: 'FFEEEEEE' } },
          left: { style: 'thin', color: { argb: 'FFEEEEEE' } },
          right: { style: 'thin', color: { argb: 'FFEEEEEE' } },
        };
        if (idx % 2 === 0) {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8F9FA' } };
        }
      });
    });

    // Auto-width columns
    sheet.columns.forEach((column, idx) => {
      let maxLength = columns[idx]?.label?.length || 10;
      data.forEach(row => {
        const val = String(row[columns[idx]?.key] ?? '');
        if (val.length > maxLength) maxLength = val.length;
      });
      column.width = Math.min(Math.max(maxLength + 4, 10), 40);
    });

    // Summary row
    sheet.addRow([]);
    const summaryRow = sheet.addRow([`Total Records: ${data.length}`]);
    summaryRow.getCell(1).font = { size: 9, italic: true, color: { argb: 'FF666666' } };

    if (options?.signatures) {
      sheet.addRow([]);
      sheet.addRow([]);
      sheet.addRow([]);
      const sigRow = sheet.addRow([]);
      options.signatures.forEach((sig, idx) => {
        const colIdx = Math.floor((columns.length / options.signatures.length) * idx) + 1;
        const cell = sigRow.getCell(colIdx);
        cell.value = `_____________________\n${sig}`;
        cell.font = { size: 9, bold: true, color: { argb: 'FF333333' } };
        cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
      });
      sigRow.height = 35;
    }

    // Save
    const outputDir = path.join(app.getPath('userData'), 'exports');
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    const safeName = title.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase();
    const outputPath = path.join(outputDir, `${safeName}-${Date.now()}.xlsx`);

    await workbook.xlsx.writeFile(outputPath);
    shell.openPath(outputPath);

    return { success: true, path: outputPath };
  },
};

module.exports = ExcelGenerator;

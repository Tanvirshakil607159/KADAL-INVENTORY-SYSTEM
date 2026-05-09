const PdfPrinter = require('pdfmake');
const fs = require('fs');
const path = require('path');
const { app, shell } = require('electron');

// Font descriptors for pdfmake
const fonts = {
  Roboto: {
    normal: path.join(__dirname, '../../assets/fonts/Roboto-Regular.ttf'),
    bold: path.join(__dirname, '../../assets/fonts/Roboto-Bold.ttf'),
    italics: path.join(__dirname, '../../assets/fonts/Roboto-Italic.ttf'),
    bolditalics: path.join(__dirname, '../../assets/fonts/Roboto-BoldItalic.ttf'),
  },
};

// Fallback: use pdfmake's built-in virtual fonts if custom fonts not available
function getPrinter() {
  try {
    if (fs.existsSync(fonts.Roboto.normal)) {
      return new PdfPrinter(fonts);
    }
  } catch (e) {}

  // Use pdfmake's default vfs
  const pdfmake = require('pdfmake/build/pdfmake');
  const pdfFonts = require('pdfmake/build/vfs_fonts');
  pdfmake.vfs = pdfFonts.pdfMake ? pdfFonts.pdfMake.vfs : pdfFonts.vfs;
  return pdfmake;
}

const PdfGenerator = {
  async generateChallanPdf(challan, settings = {}) {
    const companyName = settings.company_name || 'KA Design Accessories LTD';
    const companyAddress = settings.company_address || '';
    const companyPhone = settings.company_phone || '';

    const docDefinition = {
      pageSize: 'A4',
      pageMargins: [40, 40, 40, 60],
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
              stack: [
                { text: 'DELIVERY CHALLAN', style: 'challanTitle' },
                { text: `No: ${challan.challan_number}`, style: 'challanNumber' },
                { text: `Date: ${new Date(challan.challan_date).toLocaleDateString('en-GB')}`, style: 'challanDate' },
                { text: `Status: ${challan.status}`, style: challan.status === 'CANCELLED' ? 'statusCancelled' : 'statusActive' },
              ],
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

        // Items Table — build columns dynamically based on data presence
        { text: '', margin: [0, 15, 0, 0] },
        (() => {
          const hasBuyer = challan.items.some(i => i.buyer_name);
          const hasOrder = challan.items.some(i => i.order_quantity > 0);

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

        // Signatures — 4 columns
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

    return this._generateAndSave(docDefinition, `challan-${challan.challan_number}`);
  },

  async generateGatePassPdf(gp, settings = {}) {
    const companyName = settings.company_name || 'KA Design Accessories LTD';
    
    const docDefinition = {
      pageSize: 'A4',
      pageMargins: [40, 40, 40, 60],
      content: [
        // Header
        {
          columns: [
            {
              width: '*',
              stack: [
                settings.company_logo ? { image: settings.company_logo, fit: [350, 180], margin: [0, 0, 0, 5] } : { text: companyName, style: 'companyName' },
                { text: settings.company_address || '', style: 'companyInfo' },
                { text: `Phone: ${settings.company_phone || ''}`, style: 'companyInfo' },
              ],
            },
            {
              width: 'auto',
              stack: [
                { text: 'GATE PASS', style: 'challanTitle' },
                { text: `GP No: ${gp.gate_pass_number}`, style: 'challanNumber' },
                { text: `Date: ${new Date(gp.created_at).toLocaleDateString('en-GB')}`, style: 'challanDate' },
              ],
              alignment: 'right',
            },
          ],
        },
        { canvas: [{ type: 'line', x1: 0, y1: 5, x2: 515, y2: 5, lineWidth: 1.5, lineColor: '#6366f1' }] },

        // Consolidation Info
        { text: '', margin: [0, 20, 0, 0] },
        {
          columns: [
            {
              width: '*',
              stack: [
                { text: 'Challan(s) Covered:', style: 'label' },
                { text: (gp.challans || []).filter(Boolean).map(c => c.challan_number).join(', '), style: 'value', bold: true, margin: [0, 4, 0, 0] },
              ]
            },
            {
              width: 'auto',
              stack: [
                { text: 'Receiver:', style: 'label' },
                { text: (gp.challans || []).find(c => c?.receiver_name)?.receiver_name || '-', style: 'value', bold: true, margin: [0, 4, 0, 0] },
              ],
              alignment: 'right'
            }
          ]
        },

        // Packaging Details Table
        { text: '', margin: [0, 20, 0, 0] },
        {
          table: {
            widths: ['*', 100],
            body: [
              [{ text: 'PACKAGING TYPE', style: 'tableHeader' }, { text: 'QUANTITY', style: 'tableHeader', alignment: 'center' }],
              [{ text: 'Poly Bags', style: 'tableCell' }, { text: (gp.poly_bags || 0).toString(), style: 'tableCell', alignment: 'center', bold: true }],
              [{ text: 'Cartoon Boxes', style: 'tableCell' }, { text: (gp.cartons || 0).toString(), style: 'tableCell', alignment: 'center', bold: true }],
              [{ text: 'Plastic Bags', style: 'tableCell' }, { text: (gp.plastic_bags || 0).toString(), style: 'tableCell', alignment: 'center', bold: true }],
            ]
          },
          layout: {
            hLineWidth: () => 0.5, vLineWidth: () => 0.5,
            hLineColor: () => '#ddd', vLineColor: () => '#ddd',
            fillColor: (rowIndex) => rowIndex === 0 ? '#6366f1' : null,
          }
        },

        // Item Summary (Optional: Show total items across all challans)
        { text: 'Consolidated Items Summary', style: 'sectionTitle', margin: [0, 25, 0, 10] },
        {
          table: {
            headerRows: 1,
            widths: [25, '*', 70, 70, 60],
            body: [
              [
                { text: '#', style: 'tableHeader' }, 
                { text: 'Item Description (Size/Color)', style: 'tableHeader' }, 
                { text: 'Order No', style: 'tableHeader' }, 
                { text: 'Style', style: 'tableHeader' }, 
                { text: 'Total Qty', style: 'tableHeader', alignment: 'right' }
              ],
              ...(() => {
                const combined = {};
                (gp.challans || []).filter(Boolean).forEach(c => {
                  (c.items || []).forEach(i => {
                    const key = `${i.item_id}_${i.order_number}_${i.style_name}`;
                    if (!combined[key]) combined[key] = { ...i };
                    else combined[key].quantity += i.quantity;
                  });
                });
                return Object.values(combined).map((item, idx) => [
                  { text: idx + 1, style: 'tableCell' },
                  { text: `${item.item_name} ${[item.size, item.color].filter(Boolean).join(' / ') ? '('+[item.size, item.color].filter(Boolean).join(' / ')+')' : ''}`, style: 'tableCell' },
                  { text: item.order_number || '-', style: 'tableCell' },
                  { text: item.style_name || '-', style: 'tableCell' },
                  { text: item.quantity.toString(), style: 'tableCell', alignment: 'right', bold: true }
                ]);
              })()
            ]
          },
          layout: {
            hLineWidth: () => 0.5,
            vLineWidth: () => 0.5,
            hLineColor: () => '#ddd',
            vLineColor: () => '#ddd',
            fillColor: (rowIndex) => rowIndex === 0 ? '#6366f1' : null,
          }
        },

        // Footer / Signatures
        { text: '', margin: [0, 60, 0, 0] },
        {
          columns: [
            { width: '*', stack: [{ canvas: [{ type: 'line', x1: 0, y1: 0, x2: 120, y2: 0, lineWidth: 1 }] }, { text: 'Driver Signature', margin: [0, 5, 0, 0], fontSize: 9 }] },
            { width: '*', stack: [{ canvas: [{ type: 'line', x1: 0, y1: 0, x2: 120, y2: 0, lineWidth: 1 }] }, { text: 'Security Check', margin: [0, 5, 0, 0], fontSize: 9 }] },
            { width: '*', stack: [{ canvas: [{ type: 'line', x1: 0, y1: 0, x2: 120, y2: 0, lineWidth: 1 }] }, { text: 'Authorized Signature', margin: [0, 5, 0, 0], fontSize: 9 }], alignment: 'right' },
          ],
        },
      ],
      styles: {
        companyName: { fontSize: 18, bold: true, color: '#1a1a2e' },
        companyInfo: { fontSize: 9, color: '#666', margin: [0, 2, 0, 0] },
        challanTitle: { fontSize: 20, bold: true, color: '#6366f1' },
        challanNumber: { fontSize: 11, margin: [0, 4, 0, 0], color: '#333', bold: true },
        challanDate: { fontSize: 10, color: '#666', margin: [0, 2, 0, 0] },
        label: { fontSize: 10, color: '#666', textTransform: 'uppercase' },
        value: { fontSize: 12, color: '#333' },
        sectionTitle: { fontSize: 12, bold: true, color: '#6366f1', border: [0, 0, 0, 1] },
        tableHeader: { fontSize: 10, bold: true, color: '#fff', margin: [4, 6, 4, 6] },
        tableCell: { fontSize: 10, margin: [4, 5, 4, 5], color: '#333' },
      },
      footer: (currentPage, pageCount) => ({
        columns: [
          { text: `Generated by KADAL Inventory System`, fontSize: 7, color: '#999', margin: [40, 0, 0, 0] },
          { text: `Page ${currentPage} of ${pageCount}`, fontSize: 7, color: '#999', alignment: 'right', margin: [0, 0, 40, 0] },
        ],
      }),
    };

    return this._generateAndSave(docDefinition, `gate-pass-${gp.gate_pass_number}`);
  },

  async generateReportPdf(title, columns, data, settings = {}, options = {}) {
    const companyName = settings.company_name || 'KA Design Accessories LTD';

    const docDefinition = {
      pageSize: 'A4',
      pageOrientation: columns.length > 5 ? 'landscape' : 'portrait',
      pageMargins: [30, 40, 30, 50],
      content: [
        settings.company_logo ? { image: settings.company_logo, fit: [350, 180], margin: [0, 0, 0, 8] } : { text: companyName, style: 'companyName' },
        { text: title, style: 'reportTitle' },
        { text: `Generated: ${new Date().toLocaleString('en-GB')}`, style: 'dateInfo' },
        ...(options?.subtitles ? options.subtitles.map(st => ({ text: st, style: 'subtitleInfo' })) : []),
        { canvas: [{ type: 'line', x1: 0, y1: 5, x2: columns.length > 5 ? 760 : 535, y2: 5, lineWidth: 1, lineColor: '#6366f1' }] },
        { text: '', margin: [0, 10, 0, 0] },
        {
          table: {
            headerRows: 1,
            widths: columns.map(c => c.width || '*'),
            body: [
              columns.map(c => ({ text: c.label, style: 'tableHeader' })),
              ...data.map(row => columns.map(c => ({
                text: String(c.format ? c.format(row[c.key], row) : (row[c.key] ?? '')),
                style: 'tableCell',
                alignment: c.align || 'left',
              }))),
            ],
          },
          layout: {
            hLineWidth: () => 0.5,
            vLineWidth: () => 0.5,
            hLineColor: () => '#ddd',
            vLineColor: () => '#ddd',
            fillColor: (rowIndex) => rowIndex === 0 ? '#6366f1' : (rowIndex % 2 === 0 ? '#fafafa' : null),
          },
        },
        { text: `Total Records: ${data.length}`, style: 'summary', margin: [0, 10, 0, 0] },
      ],
      styles: {
        companyName: { fontSize: 14, bold: true, color: '#1a1a2e' },
        reportTitle: { fontSize: 16, bold: true, color: '#6366f1', margin: [0, 5, 0, 0] },
        dateInfo: { fontSize: 8, color: '#999', margin: [0, 3, 0, 5] },
        subtitleInfo: { fontSize: 10, bold: true, color: '#333', margin: [0, 2, 0, 2] },
        tableHeader: { fontSize: 8, bold: true, color: '#fff', margin: [3, 5, 3, 5] },
        tableCell: { fontSize: 8, margin: [3, 4, 3, 4], color: '#333' },
        summary: { fontSize: 9, color: '#666', italics: true },
      },
      footer: (currentPage, pageCount) => ({
        columns: [
          { text: 'KADAL Inventory System', fontSize: 7, color: '#999', margin: [30, 0, 0, 0] },
          { text: `Page ${currentPage} of ${pageCount}`, fontSize: 7, color: '#999', alignment: 'right', margin: [0, 0, 30, 0] },
        ],
      }),
    };

    return this._generateAndSave(docDefinition, title.replace(/\s+/g, '-').toLowerCase());
  },

  async _generateAndSave(docDefinition, filename) {
    const pdfmake = require('pdfmake/build/pdfmake');
    let pdfFonts;
    try {
      pdfFonts = require('pdfmake/build/vfs_fonts');
    } catch (e) {
      pdfFonts = { pdfMake: { vfs: {} } };
    }
    if (pdfFonts.pdfMake) {
      pdfmake.vfs = pdfFonts.pdfMake.vfs;
    } else if (pdfFonts.vfs) {
      pdfmake.vfs = pdfFonts.vfs;
    }

    return new Promise((resolve, reject) => {
      try {
        const pdfDoc = pdfmake.createPdf(docDefinition);
        const outputDir = path.join(app.getPath('userData'), 'exports');
        if (!fs.existsSync(outputDir)) {
          fs.mkdirSync(outputDir, { recursive: true });
        }

        const outputPath = path.join(outputDir, `${filename}-${Date.now()}.pdf`);

        pdfDoc.getBuffer((buffer) => {
          fs.writeFileSync(outputPath, buffer);
          shell.openPath(outputPath);
          resolve({ success: true, path: outputPath });
        });
      } catch (err) {
        reject(err);
      }
    });
  },
};

module.exports = PdfGenerator;

const PdfPrinter = require('pdfmake');
const fs = require('fs');
const path = require('path');
const { app, shell } = require('electron');
const JsBarcode = require('jsbarcode');
const { DOMImplementation, XMLSerializer } = require('@xmldom/xmldom');

async function generateBarcodeSvg(value, format = 'CODE128') {
  if (format === 'QR') {
    try {
      const QRCode = require('qrcode');
      // Generate clean PNG Data URL for QR codes.
      // Use errorCorrectionLevel 'L' to keep the grid size minimum (larger dots)
      // and margin 4 (standard quiet zone) for maximum scanning reliability.
      const pngDataUrl = await QRCode.toDataURL(value, {
        errorCorrectionLevel: 'L',
        margin: 4,
        width: 300
      });
      return pngDataUrl;
    } catch (err) {
      console.error('[PdfGenerator] QR code generation failed:', err.message);
      return null;
    }
  } else {
    try {
      const xmlDoc = new DOMImplementation().createDocument('http://www.w3.org/1999/xhtml', 'html', null);
      const svgNode = xmlDoc.createElementNS('http://www.w3.org/2000/svg', 'svg');
      JsBarcode(svgNode, value, {
        xmlDocument: xmlDoc,
        format: 'CODE128',
        displayValue: false,
        height: 60,
        width: 2.0,
        margin: 10
      });
      return new XMLSerializer().serializeToString(svgNode);
    } catch (err) {
      console.error('[PdfGenerator] Barcode generation failed:', err.message);
      return null;
    }
  }
}


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

const logoPath = path.join(__dirname, '../../assets/logo.png');
let logoBase64Cache = null;

function getLogoBase64() {
  if (logoBase64Cache) return logoBase64Cache;
  try {
    if (fs.existsSync(logoPath)) {
      const buffer = fs.readFileSync(logoPath);
      logoBase64Cache = `data:image/png;base64,${buffer.toString('base64')}`;
      return logoBase64Cache;
    }
  } catch (e) {
    console.error('[PdfGenerator] Failed to load logo for watermark:', e.message);
  }
  return null;
}

const PdfGenerator = {

  async generateChallanPdf(challan, settings = {}) {
    const companyName = settings.company_name || 'KA Design Accessories LTD';
    const companyAddress = settings.company_address || '';
    const companyPhone = settings.company_phone || '';

    // Generate Barcode/QR Code — encode clean, short verification URL for QR codes
    const format = settings.barcode_format === 'CODE128' ? 'CODE128' : 'QR';
    const baseUrl = (settings.public_web_url || 'https://kadal-inventory.web.app').trim().replace(/\/$/, '');
    const verificationUrl = `${baseUrl}/challan/${challan.challan_number}`;
    console.log('[PdfGenerator] QR/Barcode format:', format, '| Verification URL:', verificationUrl);

    const barcodeValue = format === 'QR' ? verificationUrl : challan.challan_number;
    const barcodeSvg = await generateBarcodeSvg(barcodeValue, format);

    const rightStack = [
      { text: 'DELIVERY CHALLAN', style: 'challanTitle' },
      { text: `No: ${challan.challan_number}`, style: 'challanNumber' },
      { text: `Date: ${new Date(challan.challan_date).toLocaleDateString('en-GB')}`, style: 'challanDate' },
      { text: `Status: ${challan.status}`, style: challan.status === 'CANCELLED' ? 'statusCancelled' : 'statusActive' },
    ];

    if (barcodeSvg) {
      const isQR = format === 'QR';
      const containerWidth = isQR ? 110 : 180;
      const fitDimensions = isQR ? [110, 110] : [180, 45];
      const marginVal = isQR ? [0, 4, 0, 0] : [0, 8, 0, 0];

      rightStack.push({
        table: {
          widths: [containerWidth],
          body: [
            isQR
              ? [{ image: barcodeSvg, fit: fitDimensions, alignment: 'center', link: verificationUrl }]
              : [{ svg: barcodeSvg, fit: fitDimensions, alignment: 'center', link: verificationUrl }],
            [{ text: challan.challan_number, alignment: 'center', fontSize: 10, bold: true, color: '#6366f1', margin: [0, 3, 0, 0], link: verificationUrl, noWrap: true }]
          ]
        },
        layout: {
          hLineWidth: () => 0,
          vLineWidth: () => 0,
          paddingLeft: () => 0,
          paddingRight: () => 0,
          paddingTop: () => 0,
          paddingBottom: () => 0,
        },
        alignment: 'right',
        margin: marginVal
      });
    }

    const docDefinition = {
      pageSize: 'A4',
      pageMargins: [40, 40, 40, 60],
      background: (currentPage, pageSize) => {
        const logo = getLogoBase64();
        if (!logo) return null;
        return {
          image: logo,
          width: 400,
          opacity: 0.05,
          absolutePosition: { x: (pageSize.width - 400) / 2, y: (pageSize.height - 400) / 2 }
        };
      },
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
              stack: rightStack,
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
      background: (currentPage, pageSize) => {
        const logo = getLogoBase64();
        if (!logo) return null;
        return {
          image: logo,
          width: 400,
          opacity: 0.05,
          absolutePosition: { x: (pageSize.width - 400) / 2, y: (pageSize.height - 400) / 2 }
        };
      },
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
      background: (currentPage, pageSize) => {
        const logo = getLogoBase64();
        if (!logo) return null;
        const width = columns.length > 5 ? 500 : 400;
        return {
          image: logo,
          width: width,
          opacity: 0.05,
          absolutePosition: { x: (pageSize.width - width) / 2, y: (pageSize.height - width) / 2 }
        };
      },
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

  async generateIssuePdf(issue, settings = {}) {
    const companyName = settings.company_name || 'KA Design Accessories LTD';
    const companyAddress = settings.company_address || '';
    const companyPhone = settings.company_phone || '';

    const docDefinition = {
      pageSize: 'A4',
      pageMargins: [40, 40, 40, 60],
      background: (currentPage, pageSize) => {
        const logo = getLogoBase64();
        if (!logo) return null;
        return {
          image: logo,
          width: 400,
          opacity: 0.05,
          absolutePosition: { x: (pageSize.width - 400) / 2, y: (pageSize.height - 400) / 2 }
        };
      },
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
              ],
            },
            {
              width: 'auto',
              stack: [
                { text: 'ISSUE PAPER', style: 'challanTitle' },
                { text: `No: ${issue.issue_id}`, style: 'challanNumber' },
                { text: `Date: ${new Date(issue.issue_date).toLocaleDateString('en-GB')}`, style: 'challanDate' },
                { text: `Type: ${issue.issue_type}`, style: 'value', bold: true, color: '#6366f1' },
              ],
              alignment: 'right',
            },
          ],
        },
        { canvas: [{ type: 'line', x1: 0, y1: 5, x2: 515, y2: 5, lineWidth: 1.5, lineColor: '#6366f1' }] },

        // Recipient Info
        { text: '', margin: [0, 15, 0, 0] },
        {
          table: {
            widths: ['auto', '*'],
            body: [
              [{ text: 'Issued To:', style: 'label' }, { text: issue.recipient_name, style: 'value', bold: true }],
              [{ text: 'Expected Return:', style: 'label' }, { text: issue.expected_return_date ? new Date(issue.expected_return_date).toLocaleDateString('en-GB') : '-', style: 'value' }],
              [{ text: 'Status:', style: 'label' }, { text: issue.status, style: 'value', color: issue.status === 'RETURNED' ? '#10b981' : '#f59e0b', bold: true }],
            ],
          },
          layout: 'noBorders',
        },

        // Production & Order Information (if available)
        ...(issue.produced_item ? [
          { text: 'PRODUCTION & ORDER INFORMATION', style: 'sectionHeader', margin: [0, 15, 0, 5] },
          {
            table: {
              widths: ['*', '*', 'auto', 'auto'],
              body: [
                [
                  { text: 'Produced Item', style: 'tableHeader' },
                  { text: 'Order No. / Style / Purchase No.', style: 'tableHeader' },
                  { text: 'Order Qty', style: 'tableHeader', alignment: 'right' },
                  { text: 'Specs (Color/Size)', style: 'tableHeader' }
                ],
                [
                  { text: `[${issue.produced_item.item_code}]\n${issue.produced_item.name}`, style: 'tableCell', bold: true },
                  { text: [issue.produced_item.order_number, issue.produced_item.style_name, issue.produced_item.purchase_no].filter(Boolean).join(' / ') || '-', style: 'tableCell' },
                  { text: `${issue.produced_item.order_quantity.toLocaleString()} ${issue.produced_item.unit}`, style: 'tableCell', alignment: 'right', bold: true },
                  { text: [issue.produced_item.color, issue.produced_item.size].filter(Boolean).join(' / ') || '-', style: 'tableCell' }
                ]
              ]
            },
            layout: {
              hLineWidth: () => 0.5, vLineWidth: () => 0.5,
              hLineColor: () => '#ddd', vLineColor: () => '#ddd',
              fillColor: (rowIndex) => rowIndex === 0 ? '#4f46e5' : null,
            }
          }
        ] : []),

        // Material Details (Issued Items)
        { text: 'MATERIAL DETAILS (ISSUED ITEMS)', style: 'sectionHeader', margin: [0, 15, 0, 5] },
        (() => {
          const headers = [
            { text: '#', style: 'tableHeader' },
            { text: 'Issue Item', style: 'tableHeader' },
            { text: 'Color', style: 'tableHeader' },
            { text: 'Issued Qty', style: 'tableHeader', alignment: 'right' },
            { text: 'Unit', style: 'tableHeader' },
            { text: 'Returned Qty', style: 'tableHeader', alignment: 'right' },
          ];
          const widths = [25, '*', 100, 80, 50, 80];

          const rows = (issue.items || []).map((item, idx) => {
            return [
              { text: idx + 1, style: 'tableCell' },
              { text: item.item_name || '-', style: 'tableCell', bold: true },
              { text: item.color || '-', style: 'tableCell' },
              { text: item.quantity.toString(), style: 'tableCell', alignment: 'right', bold: true },
              { text: item.unit || '-', style: 'tableCell' },
              { text: (item.returned_quantity || 0).toString(), style: 'tableCell', alignment: 'right' },
            ];
          });

          return {
            table: { headerRows: 1, widths, body: [headers, ...rows] },
            layout: {
              hLineWidth: () => 0.5, vLineWidth: () => 0.5,
              hLineColor: () => '#ddd', vLineColor: () => '#ddd',
              fillColor: (rowIndex) => rowIndex === 0 ? '#6366f1' : null,
            },
          };
        })(),

        // Remarks
        issue.remarks ? { text: '', margin: [0, 15, 0, 0] } : {},
        issue.remarks ? { text: 'Remarks:', style: 'label' } : {},
        issue.remarks ? { text: issue.remarks, style: 'notes' } : {},

        // Sign-off / Approvals
        { text: '', margin: [0, 60, 0, 0] },
        {
          columns: [
            { width: '*', stack: [{ canvas: [{ type: 'line', x1: 0, y1: 0, x2: 110, y2: 0, lineWidth: 1 }] }, { text: 'Receiver', margin: [0, 5, 0, 0], fontSize: 9, color: '#555', bold: true }] },
            { width: '*', stack: [{ canvas: [{ type: 'line', x1: 0, y1: 0, x2: 110, y2: 0, lineWidth: 1 }] }, { text: 'Issued by', margin: [0, 5, 0, 0], fontSize: 9, color: '#555', bold: true }] },
            { width: '*', stack: [{ canvas: [{ type: 'line', x1: 0, y1: 0, x2: 110, y2: 0, lineWidth: 1 }] }, { text: 'Order by', margin: [0, 5, 0, 0], fontSize: 9, color: '#555', bold: true }] },
            { width: '*', stack: [{ canvas: [{ type: 'line', x1: 0, y1: 0, x2: 110, y2: 0, lineWidth: 1 }] }, { text: 'Approved by', margin: [0, 5, 0, 0], fontSize: 9, color: '#555', bold: true }], alignment: 'right' },
          ],
        },
      ],
      styles: {
        companyName: { fontSize: 18, bold: true, color: '#1a1a2e' },
        companyInfo: { fontSize: 9, color: '#666', margin: [0, 2, 0, 0] },
        challanTitle: { fontSize: 20, bold: true, color: '#6366f1' },
        challanNumber: { fontSize: 11, margin: [0, 4, 0, 0], color: '#333', bold: true },
        challanDate: { fontSize: 10, color: '#666', margin: [0, 2, 0, 0] },
        label: { fontSize: 9, color: '#666', margin: [0, 2, 0, 0] },
        value: { fontSize: 10, color: '#333' },
        tableHeader: { fontSize: 9, bold: true, color: '#fff', margin: [4, 6, 4, 6] },
        tableCell: { fontSize: 8, margin: [4, 5, 4, 5], color: '#333' },
        notes: { fontSize: 9, color: '#555', italics: true, margin: [0, 4, 0, 0] },
        sectionHeader: { fontSize: 11, bold: true, color: '#4f46e5', margin: [0, 15, 0, 5], letterSpacing: 0.5 },
      },
      footer: (currentPage, pageCount) => ({
        columns: [
          { text: `Generated by KADAL Inventory System`, fontSize: 7, color: '#999', margin: [40, 0, 0, 0] },
          { text: `Page ${currentPage} of ${pageCount}`, fontSize: 7, color: '#999', alignment: 'right', margin: [0, 0, 40, 0] },
        ],
      }),
    };

    return this._generateAndSave(docDefinition, `issue-${issue.issue_id}`);
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

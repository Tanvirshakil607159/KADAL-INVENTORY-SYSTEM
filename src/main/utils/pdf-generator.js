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
    if (challan.pi_number) {
      rightStack.push({ text: `Ref PI: ${challan.pi_number}`, style: 'challanDate', bold: true, color: '#4338ca' });
    }

    if (barcodeSvg) {
      const isQR = format === 'QR';
      const containerWidth = 170; // Set width to align with text above
      const fitDimensions = isQR ? [70, 70] : [170, 45]; // Make QR smaller
      const marginVal = isQR ? [0, 4, 0, 0] : [0, 8, 0, 0];

      rightStack.push({
        table: {
          widths: [containerWidth],
          body: [
            isQR
              ? [{ image: barcodeSvg, fit: fitDimensions, alignment: 'right', link: verificationUrl }]
              : [{ svg: barcodeSvg, fit: fitDimensions, alignment: 'right', link: verificationUrl }],
            [{ text: isQR ? 'Scan to Verify' : challan.challan_number, alignment: 'right', fontSize: 10, bold: true, color: '#000', margin: [0, 3, 0, 0], link: verificationUrl, noWrap: true }]
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
        { canvas: [{ type: 'line', x1: 0, y1: 5, x2: 515, y2: 5, lineWidth: 1.5, lineColor: '#000' }] },

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
          totalRow.push({ text: challan.items.reduce((s, i) => s + i.quantity, 0).toString(), style: 'tableCell', alignment: 'right', bold: true, fillColor: null });
          totalRow.push({ text: 'Total', style: 'tableCell', bold: true, fillColor: null });

          return {
            table: { headerRows: 1, widths, body: [headers, ...rows, totalRow] },
            layout: {
              hLineWidth: () => 0.5, vLineWidth: () => 0.5,
              hLineColor: () => '#ddd', vLineColor: () => '#ddd',
              fillColor: () => null,
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
        challanTitle: { fontSize: 16, bold: true, color: '#000' },
        challanNumber: { fontSize: 11, margin: [0, 4, 0, 0], color: '#333' },
        challanDate: { fontSize: 10, color: '#666', margin: [0, 2, 0, 0] },
        statusActive: { fontSize: 10, color: '#000', bold: true, margin: [0, 2, 0, 0] },
        statusCancelled: { fontSize: 10, color: '#000', bold: true, margin: [0, 2, 0, 0] },
        label: { fontSize: 9, color: '#666', margin: [0, 2, 0, 0] },
        value: { fontSize: 10, color: '#333' },
        tableHeader: { fontSize: 9, bold: true, color: '#000', margin: [4, 6, 4, 6] },
        tableCell: { fontSize: 8, margin: [4, 5, 4, 5], color: '#333' },
        notes: { fontSize: 9, color: '#555', italics: true, margin: [0, 4, 0, 0] },
        cancelledBanner: { fontSize: 12, bold: true, color: '#000', alignment: 'center', margin: [10, 10, 10, 10] },
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
        { canvas: [{ type: 'line', x1: 0, y1: 5, x2: 515, y2: 5, lineWidth: 1.5, lineColor: '#000' }] },

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
            fillColor: () => null,
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
        challanTitle: { fontSize: 20, bold: true, color: '#000' },
        challanNumber: { fontSize: 11, margin: [0, 4, 0, 0], color: '#333', bold: true },
        challanDate: { fontSize: 10, color: '#666', margin: [0, 2, 0, 0] },
        label: { fontSize: 10, color: '#666', textTransform: 'uppercase' },
        value: { fontSize: 12, color: '#333' },
        sectionTitle: { fontSize: 12, bold: true, color: '#000', border: [0, 0, 0, 1] },
        tableHeader: { fontSize: 10, bold: true, color: '#000', margin: [4, 6, 4, 6] },
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
    const isDeliveryReport = !!options?.deliverySummary;
    const isLandscape = options.orientation ? options.orientation === 'landscape' : columns.length > 5;

    // Delivery reports: force portrait with tighter margins and smaller fonts
    const pageMargins = isDeliveryReport ? [20, 30, 20, 40] : (options.pageMargins || [30, 40, 30, 50]);
    const headerFontSize = isDeliveryReport ? 7 : 8;
    const cellFontSize = isDeliveryReport ? 7 : 8;
    const cellPadding = isDeliveryReport ? 2 : 3;
    const cellVPadding = isDeliveryReport ? 3 : 4;
    const pageWidth = isDeliveryReport ? 555 : (isLandscape ? 760 : 535);

    const docDefinition = {
      pageSize: 'A4',
      pageOrientation: isDeliveryReport ? 'portrait' : (isLandscape ? 'landscape' : 'portrait'),
      pageMargins: pageMargins,
      background: (currentPage, pageSize) => {
        const logo = getLogoBase64();
        if (!logo) return null;
        const width = isLandscape ? 500 : 400;
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
        { canvas: [{ type: 'line', x1: 0, y1: 5, x2: pageWidth, y2: 5, lineWidth: 1, lineColor: '#000' }] },
        { text: '', margin: [0, 8, 0, 0] },
        {
          table: {
            headerRows: 1,
            widths: columns.map(c => c.width || '*'),
            body: [
              columns.map(c => ({ text: c.label, style: 'tableHeader' })),
              ...data.map((row, idx) => columns.map(c => ({
                text: String(c.format ? c.format(row[c.key], row, idx) : (row[c.key] ?? '')),
                style: 'tableCell',
                alignment: c.align || 'left',
              }))),
              ...(options?.footerRow ? [options.footerRow] : []),
            ],
          },
          layout: {
            hLineWidth: () => 0.5,
            vLineWidth: () => 0.5,
            hLineColor: () => '#ddd',
            vLineColor: () => '#ddd',
            fillColor: (rowIndex) => (rowIndex % 2 === 0 ? '#fafafa' : null),
            paddingLeft: () => cellPadding,
            paddingRight: () => cellPadding,
            paddingTop: () => cellVPadding,
            paddingBottom: () => cellVPadding,
          },
        },
        { text: `Total Records: ${data.length}`, style: 'summary', margin: [0, 10, 0, 0] },

        // Delivery summary (buyer-wise breakdown) — only for dailyDelivery / monthlyReport
        ...(options?.deliverySummary && options.deliverySummary.buyerMap && options.deliverySummary.buyerMap.length > 0 ? (() => {
          const ds = options.deliverySummary;
          const fmtBDT = (v) => `৳${Number(v || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}`;
          const fmtUSD = (v) => `$${Number(v || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}`;
          const buyerRows = ds.buyerMap.map(([buyer, s]) => {
            let valText = '';
            if (s.bdt > 0) valText += `BDT: ${fmtBDT(s.bdt)}`;
            if (s.usd > 0) valText += (valText ? '  |  ' : '') + `USD: ${fmtUSD(s.usd)}`;
            return [
              { text: buyer, style: 'tableCell', bold: true },
              { text: `${s.count}`, style: 'tableCell', alignment: 'right' },
              { text: `${s.qty.toLocaleString()}`, style: 'tableCell', alignment: 'right' },
              { text: valText, style: 'tableCell', alignment: 'right', bold: true },
            ];
          });
          // Grand total row
          let grandValText = `BDT: ${fmtBDT(ds.totalBDT)}`;
          if (ds.totalUSD > 0) grandValText += `  |  USD: ${fmtUSD(ds.totalUSD)}`;
          buyerRows.push([
            { text: 'GRAND TOTAL', style: 'tableCell', bold: true, fillColor: '#f0f0f0' },
            { text: `${data.length}`, style: 'tableCell', alignment: 'right', bold: true, fillColor: '#f0f0f0' },
            { text: `${ds.totalQty.toLocaleString()}`, style: 'tableCell', alignment: 'right', bold: true, fillColor: '#f0f0f0' },
            { text: grandValText, style: 'tableCell', alignment: 'right', bold: true, fillColor: '#f0f0f0' },
          ]);

          return [
            { text: '', margin: [0, 15, 0, 0] },
            { text: 'BUYER-WISE SUMMARY', style: 'subtitleInfo', bold: true, margin: [0, 0, 0, 5] },
            {
              table: {
                headerRows: 1,
                widths: ['*', 50, 70, 'auto'],
                body: [
                  [
                    { text: 'Buyer', style: 'tableHeader' },
                    { text: 'Items', style: 'tableHeader', alignment: 'right' },
                    { text: 'Qty', style: 'tableHeader', alignment: 'right' },
                    { text: 'Total Value', style: 'tableHeader', alignment: 'right' },
                  ],
                  ...buyerRows,
                ],
              },
              layout: {
                hLineWidth: () => 0.5, vLineWidth: () => 0.5,
                hLineColor: () => '#ddd', vLineColor: () => '#ddd',
                fillColor: (rowIndex) => (rowIndex % 2 === 0 ? '#fafafa' : null),
              },
            },
          ];
        })() : []),
      ],
      styles: {
        companyName: { fontSize: 14, bold: true, color: '#1a1a2e' },
        reportTitle: { fontSize: isDeliveryReport ? 14 : 16, bold: true, color: '#000', margin: [0, 5, 0, 0] },
        dateInfo: { fontSize: 8, color: '#999', margin: [0, 3, 0, 5] },
        subtitleInfo: { fontSize: isDeliveryReport ? 8 : 10, bold: true, color: '#333', margin: [0, 1, 0, 1] },
        tableHeader: { fontSize: headerFontSize, bold: true, color: '#000', margin: [cellPadding, cellVPadding, cellPadding, cellVPadding] },
        tableCell: { fontSize: cellFontSize, margin: [cellPadding, cellVPadding, cellPadding, cellVPadding], color: '#333' },
        summary: { fontSize: 9, color: '#666', italics: true },
      },
      footer: (currentPage, pageCount) => ({
        columns: [
          { text: 'KADAL Inventory System', fontSize: 7, color: '#999', margin: [20, 0, 0, 0] },
          { text: `Page ${currentPage} of ${pageCount}`, fontSize: 7, color: '#999', alignment: 'right', margin: [0, 0, 20, 0] },
        ],
      }),
    };

    return this._generateAndSave(docDefinition, title.replace(/\s+/g, '-').toLowerCase());
  },

  async generateIssuePdf(issue, settings = {}) {
    const companyName = settings.company_name || 'KA Design Accessories LTD';
    const companyAddress = settings.company_address || '';
    const companyPhone = settings.company_phone || '';

    const isFactory = issue.issue_type === 'FACTORY';
    const isReturnable = issue.is_returnable === true || issue.is_returnable === 1;
    const documentTitle = isFactory ? 'ISSUE PAPER: Factory' : 'ISSUE PAPER: Employee';

    const prodItemsList = (issue.produced_items && issue.produced_items.length > 0)
      ? issue.produced_items
      : (issue.produced_item ? [issue.produced_item] : []);
    const hasProducedItem = prodItemsList.length > 0;
    
    let producedItemVal = '..........................................................................................';
    let orderStylePoVal = '..........................................................................................';
    let orderQtyVal = '........................................';
    let unitVal = '........................................';
    let colorSizeVal = '..........................................................................................';

    if (hasProducedItem) {
      producedItemVal = prodItemsList.map(p => `[${p.item_code || '-'}] ${p.name || '-'}`).join(', ');

      orderStylePoVal = prodItemsList.map(p => {
        const spoParts = [
          p.order_number ? `Ord: ${p.order_number}` : '',
          p.style_name ? `Sty: ${p.style_name}` : '',
          p.purchase_no ? `PO: ${p.purchase_no}` : ''
        ].filter(Boolean);
        return spoParts.join(' / ') || '-';
      }).join('; ');

      orderQtyVal = prodItemsList.map(p => p.order_quantity !== undefined && p.order_quantity !== null ? Number(p.order_quantity).toLocaleString() : '-').join(', ');
      unitVal = prodItemsList.map(p => p.unit || '-').join(', ');
      colorSizeVal = prodItemsList.map(p => [p.color, p.size].filter(Boolean).join(' / ') || '-').join('; ');
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
                companyAddress ? { text: companyAddress, style: 'companyInfo' } : {},
                companyPhone ? { text: `Phone: ${companyPhone}`, style: 'companyInfo' } : {},
              ],
            },
            {
              width: 'auto',
              stack: [
                { text: documentTitle, style: 'challanTitle' },
                { text: `Issue No: ${issue.issue_id}`, style: 'challanNumber' },
                { text: `Date: ${new Date(issue.issue_date).toLocaleDateString('en-GB')}`, style: 'challanDate' },
                { text: `Type: ${issue.issue_type}`, style: 'value', bold: true, color: '#000' },
              ],
              alignment: 'right',
            },
          ],
        },
        { canvas: [{ type: 'line', x1: 0, y1: 5, x2: 515, y2: 5, lineWidth: 1.5, lineColor: '#000' }] },

        // Recipient Info
        { text: '', margin: [0, 10, 0, 0] },
        (() => {
          if (isFactory) {
            return {
              columns: [
                {
                  width: '*',
                  stack: [
                    { text: 'Issued To (Factory / Section)', style: 'label' },
                    { text: issue.recipient_name, style: 'value', bold: true, fontSize: 11, margin: [0, 2, 0, 0] }
                  ]
                },
                {
                  width: 'auto',
                  stack: [
                    { text: 'Status', style: 'label', alignment: 'right' },
                    { text: issue.status, style: 'value', color: issue.status === 'RETURNED' ? '#000' : issue.status === 'PARTIAL' ? '#000' : '#000', bold: true, alignment: 'right', margin: [0, 2, 0, 0] }
                  ]
                }
              ]
            };
          } else {
            return {
              columns: [
                {
                  width: '*',
                  stack: [
                    { text: 'Issued To (Employee)', style: 'label' },
                    { text: issue.recipient_name, style: 'value', bold: true, fontSize: 11, margin: [0, 2, 0, 0] }
                  ]
                },
                {
                  width: '*',
                  stack: [
                    { text: 'Category', style: 'label' },
                    { text: isReturnable ? 'Returnable' : 'Non-Returnable', style: 'value', bold: true, color: isReturnable ? '#000' : '#64748b', margin: [0, 2, 0, 0] }
                  ]
                },
                ...(isReturnable ? [
                  {
                    width: '*',
                    stack: [
                      { text: 'Expected Return Date', style: 'label' },
                      { text: issue.expected_return_date ? new Date(issue.expected_return_date).toLocaleDateString('en-GB') : '-', style: 'value', margin: [0, 2, 0, 0] }
                    ]
                  }
                ] : []),
                {
                  width: 'auto',
                  stack: [
                    { text: 'Status', style: 'label', alignment: 'right' },
                    { text: issue.status, style: 'value', color: issue.status === 'RETURNED' ? '#000' : issue.status === 'PARTIAL' ? '#000' : '#000', bold: true, alignment: 'right', margin: [0, 2, 0, 0] }
                  ]
                }
              ]
            };
          }
        })(),

        // Production & Order Information (Factory only) — each item in its own row
        ...(isFactory ? [
          { text: 'PRODUCTION & ORDER INFORMATION', style: 'sectionHeader', margin: [0, 15, 0, 5] },
          {
            table: {
              headerRows: 1,
              widths: [20, '*', 65, 100, 45, 60, 35],
              body: [
                [
                  { text: '#', style: 'tableHeader', alignment: 'center' },
                  { text: 'Produced Item', style: 'tableHeader' },
                  { text: 'Buyer', style: 'tableHeader' },
                  { text: 'Order / Style / PO', style: 'tableHeader' },
                  { text: 'Order Qty', style: 'tableHeader', alignment: 'right' },
                  { text: 'Color / Size', style: 'tableHeader' },
                  { text: 'Unit', style: 'tableHeader', alignment: 'center' },
                ],
                ...(hasProducedItem ? prodItemsList.map((p, idx) => {
                  const spoParts = [
                    p.order_number ? `Ord: ${p.order_number}` : '',
                    p.style_name ? `Sty: ${p.style_name}` : '',
                    p.purchase_no ? `PO: ${p.purchase_no}` : ''
                  ].filter(Boolean);
                  const spoStr = spoParts.join(' / ') || '-';
                  const csStr = [p.color, p.size].filter(Boolean).join(' / ') || '-';
                  return [
                    { text: idx + 1, style: 'tableCell', alignment: 'center' },
                    { text: `[${p.item_code || '-'}] ${p.name || '-'}`, style: 'tableCell', bold: true },
                    { text: p.buyer_name || '-', style: 'tableCell' },
                    { text: spoStr, style: 'tableCell', fontSize: 8 },
                    { text: p.order_quantity !== undefined && p.order_quantity !== null ? Number(p.order_quantity).toLocaleString() : '-', style: 'tableCell', alignment: 'right' },
                    { text: csStr, style: 'tableCell' },
                    { text: p.unit || '-', style: 'tableCell', alignment: 'center' },
                  ];
                }) : [[
                  { text: '-', style: 'tableCell', alignment: 'center', colSpan: 7 }, {}, {}, {}, {}, {}, {}
                ]])
              ]
            },
            layout: {
              hLineWidth: () => 0.5,
              vLineWidth: () => 0.5,
              hLineColor: () => '#cbd5e1',
              vLineColor: () => '#cbd5e1',
              fillColor: (rowIndex) => rowIndex === 0 ? '#f1f5f9' : (rowIndex % 2 === 0 ? '#fafafa' : null),
            },
            margin: [0, 0, 0, 15]
          }
        ] : []),

        // Material Details + Production Table + Signatures — keep on same page
        {
          unbreakable: true,
          stack: [
            // Material Details (Issued Items)
            { text: 'MATERIAL DETAILS', style: 'sectionHeader', margin: [0, 10, 0, 5] },
            (() => {
              const headers = isFactory ? [
                { text: '#', style: 'tableHeader', alignment: 'center' },
                { text: 'Issue Item', style: 'tableHeader' },
                { text: 'Style/PO/Order', style: 'tableHeader' },
                { text: 'Size/Color', style: 'tableHeader' },
                { text: 'Unit', style: 'tableHeader', alignment: 'center' },
                { text: 'Issued Qty', style: 'tableHeader', alignment: 'right' },
              ] : [
                { text: '#', style: 'tableHeader', alignment: 'center' },
                { text: 'Issue Item', style: 'tableHeader' },
                { text: 'Style/PO/Order', style: 'tableHeader' },
                { text: 'Size/Color', style: 'tableHeader' },
                { text: 'Unit', style: 'tableHeader', alignment: 'center' },
                { text: 'Issued Qty', style: 'tableHeader', alignment: 'right' },
                { text: 'Returned Qty', style: 'tableHeader', alignment: 'right' },
              ];

              const widths = isFactory ? [25, '*', 90, 80, 40, 70] : [25, '*', 80, 70, 40, 60, 60];

              const items = issue.items || [];
              const rows = items.map((item, idx) => {
                const spo = [item.style_no || item.style_name, item.purchase_no, item.order_number].filter(Boolean).join(' / ') || '-';
                const sc = [item.size, item.color].filter(Boolean).join(' / ') || '-';

                return isFactory ? [
                  { text: idx + 1, style: 'tableCell', alignment: 'center' },
                  { text: item.item_name || '-', style: 'tableCell', bold: true },
                  { text: spo, style: 'tableCell', fontSize: 8 },
                  { text: sc, style: 'tableCell' },
                  { text: item.unit || '-', style: 'tableCell', alignment: 'center' },
                  { text: item.quantity.toString(), style: 'tableCell', alignment: 'right', bold: true },
                ] : [
                  { text: idx + 1, style: 'tableCell', alignment: 'center' },
                  { text: item.item_name || '-', style: 'tableCell', bold: true },
                  { text: spo, style: 'tableCell', fontSize: 8 },
                  { text: sc, style: 'tableCell' },
                  { text: item.unit || '-', style: 'tableCell', alignment: 'center' },
                  { text: item.quantity.toString(), style: 'tableCell', alignment: 'right', bold: true },
                  { text: (item.returned_quantity || 0).toString(), style: 'tableCell', alignment: 'right' },
                ];
              });

              if (rows.length === 0) {
                rows.push(isFactory ? [
                  { text: '-', style: 'tableCell', alignment: 'center' },
                  { text: 'No items issued', style: 'tableCell', colSpan: 5 },
                  {}, {}, {}, {}
                ] : [
                  { text: '-', style: 'tableCell', alignment: 'center' },
                  { text: 'No items issued', style: 'tableCell', colSpan: 6 },
                  {}, {}, {}, {}, {}
                ]);
              }

              return {
                table: { headerRows: 1, widths, body: [headers, ...rows] },
                layout: {
                  hLineWidth: () => 0.5, vLineWidth: () => 0.5,
                  hLineColor: () => '#cbd5e1', vLineColor: () => '#cbd5e1',
                  fillColor: (rowIndex) => (rowIndex % 2 === 1 && rowIndex <= items.length ? '#f8fafc' : null),
                },
              };
            })(),

            // Delivery / Production Table (Factory only)
            ...(isFactory ? [
              { text: '', margin: [0, 15, 0, 0] },
              {
                table: {
                  headerRows: 1,
                  widths: ['*', '*', '*'],
                  body: [
                    [
                      { text: 'Production Date', style: 'tableHeader', alignment: 'center' },
                      { text: 'Produce QTY', style: 'tableHeader', alignment: 'center' },
                      { text: 'Sign', style: 'tableHeader', alignment: 'center' },
                    ],
                    [ { text: '\n', margin: [0, 5, 0, 5] }, {}, {} ],
                    [ { text: '\n', margin: [0, 5, 0, 5] }, {}, {} ],
                    [ { text: '\n', margin: [0, 5, 0, 5] }, {}, {} ],
                    [ { text: '\n', margin: [0, 5, 0, 5] }, {}, {} ],
                    [ { text: '\n', margin: [0, 5, 0, 5] }, {}, {} ]
                  ]
                },
                layout: {
                  hLineWidth: () => 0.5, vLineWidth: () => 0.5,
                  hLineColor: () => '#cbd5e1', vLineColor: () => '#cbd5e1',
                  fillColor: () => null,
                }
              }
            ] : []),

            // Sign-off / Approvals
            { text: '', margin: [0, 30, 0, 0] },
            {
              table: {
                widths: ['*', '*', '*', '*'],
                body: [
                  [
                    { text: '\n\n', fontSize: 12 },
                    { text: '\n\n', fontSize: 12 },
                    { text: '\n\n', fontSize: 12 },
                    { text: '\n\n', fontSize: 12 }
                  ],
                  [
                    {
                      stack: [
                        { text: 'Receiver', style: 'sigLabel', alignment: 'center' },
                        { text: '(Sign & Date)', style: 'sigSub', alignment: 'center' }
                      ]
                    },
                    {
                      stack: [
                        { text: 'Issued by', style: 'sigLabel', alignment: 'center' },
                        { text: '(Store Incharge)', style: 'sigSub', alignment: 'center' }
                      ]
                    },
                    {
                      stack: [
                        { text: 'Order by', style: 'sigLabel', alignment: 'center' },
                        { text: '(Merchandiser)', style: 'sigSub', alignment: 'center' }
                      ]
                    },
                    {
                      stack: [
                        { text: 'Approved by', style: 'sigLabel', alignment: 'center' },
                        { text: '(Authorized Signature)', style: 'sigSub', alignment: 'center' }
                      ]
                    }
                  ]
                ]
              },
              layout: {
                hLineWidth: (i) => i === 1 ? 0.8 : 0,
                vLineWidth: () => 0,
                hLineColor: () => '#cbd5e1',
                paddingLeft: () => 10,
                paddingRight: () => 10,
                paddingTop: () => 4,
                paddingBottom: () => 4
              }
            },
          ]
        },
      ],
      styles: {
        companyName: { fontSize: 18, bold: true, color: '#000' },
        companyInfo: { fontSize: 9, color: '#64748b', margin: [0, 2, 0, 0] },
        challanTitle: { fontSize: 20, bold: true, color: '#000' },
        challanNumber: { fontSize: 11, margin: [0, 4, 0, 0], color: '#000', bold: true },
        challanDate: { fontSize: 10, color: '#64748b', margin: [0, 2, 0, 0] },
        label: { fontSize: 9, color: '#64748b', bold: true, margin: [0, 2, 0, 0] },
        value: { fontSize: 10, color: '#000' },
        tableHeader: { fontSize: 9, bold: true, color: '#000', margin: [4, 6, 4, 6] },
        tableCell: { fontSize: 8, margin: [4, 5, 4, 5], color: '#000' },
        notes: { fontSize: 9, color: '#475569', italics: true, margin: [0, 4, 0, 0] },
        sectionHeader: { fontSize: 11, bold: true, color: '#000', margin: [0, 15, 0, 5], letterSpacing: 0.5 },
        gridLabel: { fontSize: 9, bold: true, color: '#475569', margin: [4, 5, 4, 5] },
        gridValue: { fontSize: 9, color: '#000', margin: [4, 5, 4, 5] },
        sigLabel: { fontSize: 9, bold: true, color: '#334155', margin: [0, 4, 0, 0] },
        sigSub: { fontSize: 8, color: '#64748b' }
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

  async generateRequisitionPdf(req, settings = {}) {
    const companyName = settings.company_name || 'KA Design Accessories LTD';
    const companyAddress = settings.company_address || '';
    const companyPhone = settings.company_phone || '';

    const statusColors = {
      PENDING: '#000',
      APPROVED: '#000',
      FULFILLED: '#000',
      REJECTED: '#000',
      CANCELLED: '#64748b',
    };
    const statusColor = statusColors[req.status] || '#000';

    const docDefinition = {
      pageSize: 'A4',
      pageMargins: [40, 40, 40, 60],
      background: (currentPage, pageSize) => {
        const logo = getLogoBase64();
        if (!logo) return null;
        return { image: logo, width: 400, opacity: 0.05, absolutePosition: { x: (pageSize.width - 400) / 2, y: (pageSize.height - 400) / 2 } };
      },
      content: [
        // Header
        {
          columns: [
            {
              width: '*',
              stack: [
                settings.company_logo ? { image: settings.company_logo, fit: [350, 180], margin: [0, 0, 0, 5] } : { text: companyName, style: 'companyName' },
                companyAddress ? { text: companyAddress, style: 'companyInfo' } : {},
                companyPhone ? { text: `Phone: ${companyPhone}`, style: 'companyInfo' } : {},
              ],
            },
            {
              width: 'auto',
              stack: [
                { text: 'MATERIAL REQUISITION', style: 'docTitle' },
                { text: `Req No: ${req.requisition_no}`, style: 'docNumber' },
                { text: `Date: ${new Date(req.requisition_date).toLocaleDateString('en-GB')}`, style: 'docDate' },
                { text: `Status: ${req.status}`, color: statusColor, bold: true, fontSize: 10, margin: [0, 2, 0, 0] },
              ],
              alignment: 'right',
            },
          ],
        },
        { canvas: [{ type: 'line', x1: 0, y1: 5, x2: 515, y2: 5, lineWidth: 1.5, lineColor: '#000' }] },

        // Requester / Dept / Purpose info
        { text: '', margin: [0, 10, 0, 0] },
        {
          table: {
            widths: ['auto', '*', 'auto', '*'],
            body: [
              [
                { text: 'Requester:', style: 'gridLabel' },
                { text: req.requester_name || '-', style: 'gridValue' },
                { text: 'Department:', style: 'gridLabel' },
                { text: req.department || '-', style: 'gridValue' },
              ],
              [
                { text: 'Recipient:', style: 'gridLabel' },
                { text: req.recipient_name || '-', style: 'gridValue' },
                { text: 'Purpose:', style: 'gridLabel' },
                { text: req.purpose || '-', style: 'gridValue' },
              ],
              ...(req.notes ? [[
                { text: 'Notes:', style: 'gridLabel' },
                { text: req.notes, style: 'gridValue', colSpan: 3 }, {}, {},
              ]] : []),
            ],
          },
          layout: {
            hLineWidth: () => 0.5, vLineWidth: () => 0.5,
            hLineColor: () => '#e2e8f0', vLineColor: () => '#e2e8f0',
            fillColor: (row, node, col) => (col === 0 || col === 2) ? '#f8fafc' : null,
          },
          margin: [0, 0, 0, 15],
        },

        // Items Table
        { text: 'REQUESTED MATERIALS', style: 'sectionHeader' },
        (() => {
          const headers = [
            { text: '#', style: 'tableHeader', alignment: 'center' },
            { text: 'Item', style: 'tableHeader' },
            { text: 'Style / PO / Order', style: 'tableHeader' },
            { text: 'Size / Color', style: 'tableHeader' },
            { text: 'Unit', style: 'tableHeader', alignment: 'center' },
            { text: 'Req. Qty', style: 'tableHeader', alignment: 'right' },
            { text: 'Apv. Qty', style: 'tableHeader', alignment: 'right' },
            { text: 'Issued Qty', style: 'tableHeader', alignment: 'right' },
          ];
          const widths = [22, '*', 90, 75, 35, 45, 45, 50];
          const items = req.items || [];
          const rows = items.map((item, idx) => {
            const spo = [item.style_name, item.purchase_no, item.order_number].filter(Boolean).filter(v => v !== '-').join(' / ') || '-';
            const sc = [item.size, item.color].filter(Boolean).filter(v => v !== '-').join(' / ') || '-';
            return [
              { text: idx + 1, style: 'tableCell', alignment: 'center' },
              { text: `${item.item_name || '-'}\n${item.item_code || ''}`, style: 'tableCell', bold: true, fontSize: 8 },
              { text: spo, style: 'tableCell', fontSize: 7 },
              { text: sc, style: 'tableCell', fontSize: 8 },
              { text: item.item_unit || '-', style: 'tableCell', alignment: 'center' },
              { text: (item.requested_quantity || 0).toString(), style: 'tableCell', alignment: 'right', bold: true },
              { text: (item.approved_quantity || 0).toString(), style: 'tableCell', alignment: 'right' },
              { text: (item.issued_quantity || 0).toString(), style: 'tableCell', alignment: 'right' },
            ];
          });
          if (rows.length === 0) {
            rows.push([{ text: 'No items', colSpan: 8, alignment: 'center', style: 'tableCell' }, {}, {}, {}, {}, {}, {}, {}]);
          }
          return {
            table: { headerRows: 1, widths, body: [headers, ...rows] },
            layout: {
              hLineWidth: () => 0.5, vLineWidth: () => 0.5,
              hLineColor: () => '#cbd5e1', vLineColor: () => '#cbd5e1',
              fillColor: (rowIndex) => (rowIndex % 2 === 0 ? '#f8fafc' : null),
            },
          };
        })(),

        // Signatures
        { text: '', margin: [0, 40, 0, 0] },
        {
          columns: [
            { width: '*', stack: [{ canvas: [{ type: 'line', x1: 0, y1: 0, x2: 110, y2: 0, lineWidth: 1 }] }, { text: 'Requested By', margin: [0, 5, 0, 0], fontSize: 9, color: '#666' }] },
            { width: '*', stack: [{ canvas: [{ type: 'line', x1: 0, y1: 0, x2: 110, y2: 0, lineWidth: 1 }] }, { text: 'Approved By', margin: [0, 5, 0, 0], fontSize: 9, color: '#666' }] },
            { width: '*', stack: [{ canvas: [{ type: 'line', x1: 0, y1: 0, x2: 110, y2: 0, lineWidth: 1 }] }, { text: 'Store Incharge', margin: [0, 5, 0, 0], fontSize: 9, color: '#666' }] },
            { width: '*', stack: [{ canvas: [{ type: 'line', x1: 0, y1: 0, x2: 110, y2: 0, lineWidth: 1 }] }, { text: 'Authorized Signature', margin: [0, 5, 0, 0], fontSize: 9, color: '#666' }], alignment: 'right' },
          ],
        },
      ],
      styles: {
        companyName: { fontSize: 18, bold: true, color: '#1a1a2e' },
        companyInfo: { fontSize: 9, color: '#666', margin: [0, 2, 0, 0] },
        docTitle: { fontSize: 16, bold: true, color: '#000' },
        docNumber: { fontSize: 11, margin: [0, 4, 0, 0], color: '#333', bold: true },
        docDate: { fontSize: 10, color: '#666', margin: [0, 2, 0, 0] },
        sectionHeader: { fontSize: 10, bold: true, color: '#000', margin: [0, 0, 0, 5] },
        gridLabel: { fontSize: 9, bold: true, color: '#64748b', margin: [4, 5, 4, 5] },
        gridValue: { fontSize: 9, color: '#000', margin: [4, 5, 4, 5] },
        tableHeader: { fontSize: 8, bold: true, color: '#000', margin: [4, 5, 4, 5] },
        tableCell: { fontSize: 8, margin: [4, 4, 4, 4], color: '#333' },
      },
      footer: (currentPage, pageCount) => ({
        columns: [
          { text: `Generated by KADAL Inventory System`, fontSize: 7, color: '#999', margin: [40, 0, 0, 0] },
          { text: `Page ${currentPage} of ${pageCount}`, fontSize: 7, color: '#999', alignment: 'right', margin: [0, 0, 40, 0] },
        ],
      }),
    };

    return this._generateAndSave(docDefinition, `requisition-${req.requisition_no}`);
  },

  async generateProformaInvoicePdf(pi, settings = {}) {
    const formatDate = (dateStr) => {
      if (!dateStr) return '';
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr;
      const day = String(d.getDate()).padStart(2, '0');
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const year = d.getFullYear();
      return `${day}.${month}.${year}`;
    };

    const logo = getLogoBase64();
    const currencySym = pi.currency_symbol || '$';

    const items = (pi.items || []).map((it, idx) => {
      const slNo = it.sl_no !== undefined ? it.sl_no : (it.slNo !== undefined ? it.slNo : idx + 1);
      const desc = it.item_description || it.itemDescription || it.item_name || it.name || '';
      const poStyle = it.po_style_no || it.poStyleNo || it.style_name || it.order_number || it.purchase_no || it.purchaseNo || '-';
      const qty = Number(it.quantity || 0);
      const unit = (it.unit || 'PCS').toUpperCase();
      const rate = Number(it.unit_price !== undefined ? it.unit_price : (it.unitPrice !== undefined ? it.unitPrice : 0));
      const total = Number(it.total_amount !== undefined ? it.total_amount : (it.totalAmount !== undefined ? it.totalAmount : (qty * rate).toFixed(2)));

      return [
        { text: String(slNo), alignment: 'center', style: 'piTableCell' },
        { text: desc, alignment: 'left', style: 'piTableCell' },
        { text: poStyle, alignment: 'center', style: 'piTableCell' },
        { text: qty.toLocaleString('en-US'), alignment: 'right', style: 'piTableCell' },
        { text: unit, alignment: 'center', style: 'piTableCell' },
        { text: `${currencySym} ${rate.toFixed(4)}`, alignment: 'right', style: 'piTableCell' },
        { text: `${currencySym} ${total.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, alignment: 'right', style: 'piTableCell' },
      ];
    });

    // Total row
    const totalRow = [
      { text: 'TOTAL', colSpan: 3, alignment: 'right', bold: true, style: 'piTableTotal' },
      {},
      {},
      { text: Number(pi.total_quantity || 0).toLocaleString('en-US'), alignment: 'right', bold: true, style: 'piTableTotal' },
      { text: '', style: 'piTableTotal' },
      { text: '', style: 'piTableTotal' },
      { text: `${currencySym} ${Number(pi.total_amount || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, alignment: 'right', bold: true, style: 'piTableTotal' },
    ];

    const docDefinition = {
      pageSize: 'A4',
      pageMargins: [35, 30, 35, 35],
      background: (currentPage, pageSize) => {
        if (!logo) return null;
        return {
          image: logo,
          width: 320,
          opacity: 0.08,
          absolutePosition: { x: (pageSize.width - 320) / 2, y: (pageSize.height - 320) / 2 }
        };
      },
      content: [
        // Top Letterhead
        {
          columns: [
            logo ? { image: logo, width: 55, height: 55, margin: [0, 0, 10, 0] } : { text: '', width: 0 },
            {
              width: '*',
              stack: [
                { text: 'K.A. DESIGN ACCESSORIES LTD.', fontSize: 18, bold: true, color: '#1e293b' },
                { text: 'A House of Quality Twill Tape, Herringbone Tape & Garments Accessories Manufacturer.', italics: true, fontSize: 9, color: '#475569', margin: [0, 2, 0, 0] }
              ]
            }
          ],
          margin: [0, 0, 0, 8]
        },
        { canvas: [{ type: 'line', x1: 0, y1: 0, x2: 525, y2: 0, lineWidth: 1, lineColor: '#94a3b8' }], margin: [0, 0, 0, 8] },

        // Invoice Meta & Dates
        {
          columns: [
            {
              width: '*',
              stack: [
                { text: 'APPLICANT:', bold: true, fontSize: 8.5, color: '#000' },
                { text: `${pi.applicant_name || ''}\n${pi.applicant_address || ''}`, fontSize: 8.5, color: '#1e293b', margin: [0, 2, 0, 6] },

                { text: 'BENIFICARY:', bold: true, fontSize: 8.5, color: '#000' },
                { text: `${pi.beneficiary_name || 'K.A. DESIGN ACCESSORIES LTD.'}\n${pi.beneficiary_address || '356/1, BLOCK-B, TEK KATHORA, SALNA\nGAZIPUR-1703, BANGLADESH'}${pi.beneficiary_bin ? '\nBIN: ' + pi.beneficiary_bin : ''}`, fontSize: 8.5, color: '#1e293b', margin: [0, 2, 0, 6] },

                { text: 'BANK DETAIL:', bold: true, fontSize: 8.5, color: '#000' },
                { text: pi.bank_details || 'UNITED COMMERCIAL BANK PLC.\nTONGI BRANCH\n18, S.K. MANNAN TOWER, CHERAG ALI\nGAZIPUR-1712, BANGLADESH\nSWIFT CODE: UCBLBDDHTNG', fontSize: 8.5, color: '#1e293b', margin: [0, 2, 0, 6] },

                { text: [{ text: 'BUYER : ', bold: true, fontSize: 8.5 }, { text: pi.buyer || '', fontSize: 8.5 }], margin: [0, 2, 0, 6] }
              ]
            },
            {
              width: 210,
              alignment: 'right',
              stack: [
                { text: 'BILL', bold: true, fontSize: 13, alignment: 'right', margin: [0, 0, 0, 4] },
                { text: `Date : ${formatDate(pi.pi_date)}`, fontSize: 9, alignment: 'right', margin: [0, 0, 0, 4] },
                { text: [{ text: 'BILL : ', bold: true }, { text: pi.bill_number || '-' }], fontSize: 9, alignment: 'right', margin: [0, 0, 0, 4] },
                { text: `Date : ${formatDate(pi.bill_date || pi.pi_date)}`, fontSize: 9, alignment: 'right', margin: [0, 0, 0, 6] },
                { text: [{ text: 'PROFORMA INVOICE NO. : ', bold: true }, { text: pi.pi_number || '-' }], fontSize: 9, bold: true, alignment: 'right', margin: [0, 0, 0, 4] }
              ]
            }
          ],
          margin: [0, 0, 0, 8]
        },

        // Goods Table Section
        { text: 'DESCRIPTION OF GOODS :', bold: true, fontSize: 9, margin: [0, 4, 0, 4] },
        {
          table: {
            headerRows: 1,
            widths: [25, '*', 110, 45, 30, 48, 55],
            body: [
              [
                { text: 'SL. NO', alignment: 'center', bold: true, style: 'piTableHeader' },
                { text: 'ITEM DESCRIPTION', alignment: 'center', bold: true, style: 'piTableHeader' },
                { text: 'PO & STYLE NO.', alignment: 'center', bold: true, style: 'piTableHeader' },
                { text: 'QTY', alignment: 'center', bold: true, style: 'piTableHeader' },
                { text: 'UNIT', alignment: 'center', bold: true, style: 'piTableHeader' },
                { text: 'UNIT PRICE', alignment: 'center', bold: true, style: 'piTableHeader' },
                { text: 'TOTAL', alignment: 'center', bold: true, style: 'piTableHeader' },
              ],
              ...items,
              totalRow
            ]
          },
          layout: {
            hLineWidth: (i, node) => (i === 0 || i === 1 || i === node.table.body.length - 1 || i === node.table.body.length) ? 1 : 0.5,
            vLineWidth: () => 0.5,
            hLineColor: () => '#475569',
            vLineColor: () => '#475569',
            paddingLeft: () => 4,
            paddingRight: () => 4,
            paddingTop: () => 3,
            paddingBottom: () => 3,
          },
          margin: [0, 0, 0, 8]
        },

        // Summary Details
        { text: (pi.amount_in_words || '').toUpperCase(), bold: true, fontSize: 8.5, margin: [0, 3, 0, 3] },
        { text: `NET WEIGHT: ${pi.net_weight || '250 KGS'}`, fontSize: 8.5, margin: [0, 1, 0, 1] },
        { text: `GROSS WEIGHT: ${pi.gross_weight || '260 KGS'}`, fontSize: 8.5, margin: [0, 1, 0, 1] },
        { text: `TERMS AND CONDITIONS : ${pi.terms_conditions || 'CASH ON DELIVERY.'}`, fontSize: 8.5, margin: [0, 1, 0, 12] },

        // Signatures
        {
          columns: [
            {
              width: '32%',
              stack: [
                { text: 'Md. Ariful Rahman\nAccounts & Admin\nK. A. Design Accessories Ltd.', fontSize: 8, alignment: 'center', margin: [0, 15, 0, 3] },
                { canvas: [{ type: 'line', x1: 10, y1: 0, x2: 140, y2: 0, lineWidth: 0.8, lineColor: '#64748b' }] },
                { text: 'Prepared By\nFor KADAL', fontSize: 8, bold: true, alignment: 'center', margin: [0, 3, 0, 0] }
              ]
            },
            {
              width: '36%',
              stack: [
                { text: 'Maksudha Akter Kumu\nChairman\nK.A. DESIGN ACCESSORIES LTD.', fontSize: 8, alignment: 'center', margin: [0, 15, 0, 3] },
                { canvas: [{ type: 'line', x1: 15, y1: 0, x2: 155, y2: 0, lineWidth: 0.8, lineColor: '#64748b' }] },
                { text: 'Authorized By\nFor KADAL', fontSize: 8, bold: true, alignment: 'center', margin: [0, 3, 0, 0] }
              ]
            },
            {
              width: '32%',
              stack: [
                { text: '', margin: [0, 27, 0, 3] },
                { canvas: [{ type: 'line', x1: 10, y1: 0, x2: 140, y2: 0, lineWidth: 0.8, lineColor: '#64748b' }] },
                { text: `Accepted By\nBuyer Signature & Seal (${pi.applicant_name || 'KADWL'})`, fontSize: 8, bold: true, alignment: 'center', margin: [0, 3, 0, 0] }
              ]
            }
          ],
          margin: [0, 0, 0, 12]
        },

        // Clean Footer
        { canvas: [{ type: 'line', x1: 0, y1: 0, x2: 525, y2: 0, lineWidth: 0.5, lineColor: '#94a3b8' }], margin: [0, 4, 0, 4] },
        {
          columns: [
            {
              width: '*',
              stack: [
                { text: 'Office & Factory :', bold: true, fontSize: 8, color: '#065f46' },
                { text: '356/1, Block-B, Tek Kathora, Salna, Gazipur-1703, Bangladesh', fontSize: 7.5, color: '#334155' }
              ]
            },
            {
              width: 220,
              alignment: 'right',
              stack: [
                { text: 'Contact Details:', bold: true, fontSize: 8, color: '#065f46' },
                { text: 'Cell: +88 01766 671724  |  Web: www.kadesignaccessoriesltd.com\nE-mail: maksudakumu@kadesignaccessoriesltd.com', fontSize: 7.5, color: '#334155' }
              ]
            }
          ]
        }
      ],
      styles: {
        piTableHeader: { fontSize: 8, color: '#000', margin: [1, 2, 1, 2] },
        piTableCell: { fontSize: 7.5, color: '#1e293b', margin: [1, 2, 1, 2] },
        piTableTotal: { fontSize: 8, color: '#000', margin: [1, 2, 1, 2] },
      }
    };

    return this._generateAndSave(docDefinition, `PI-${(pi.pi_number || 'draft').replace(/[/\\?%*:|"<>]/g, '-')}`);
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

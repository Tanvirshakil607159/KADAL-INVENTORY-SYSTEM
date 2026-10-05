const PdfPrinter = require('pdfmake');
const fs = require('fs');

const fonts = {
  Roboto: {
    normal: 'node_modules/pdfmake/build/vfs_fonts.js' 
  }
};
// fallback
const pdfmake = require('pdfmake/build/pdfmake');
const pdfFonts = require('pdfmake/build/vfs_fonts');
pdfmake.vfs = pdfFonts.pdfMake ? pdfFonts.pdfMake.vfs : pdfFonts.vfs;

const docDefinition = {
  content: [
    {
      table: {
        widths: ['10%', '20%', '30%', '40%'],
        body: [
          [ 'A', 'B', 'C', 'D' ],
          [ '1', '2', '3', '4' ]
        ]
      }
    }
  ]
};

const pdfDoc = pdfmake.createPdf(docDefinition);
pdfDoc.getBuffer((buffer) => {
  fs.writeFileSync('test-pct.pdf', buffer);
  console.log('done');
});

import React, { useEffect, useRef, useState } from 'react';
import { X, Printer, Download } from 'lucide-react';
import JsBarcode from 'jsbarcode';
import QRCode from 'qrcode';
import useStore from '../../store/useStore';

export default function BarcodeModal({ isOpen, onClose, item }) {
  const { addToast } = useStore();
  const [format, setFormat] = useState('QR'); // CODE128 or QR
  const [copies, setCopies] = useState(1);
  const barcodeRef = useRef(null);
  const qrRef = useRef(null);

  useEffect(() => {
    // Fetch default format from settings
    window.kadal.settings.get('barcode_format').then(res => {
      if (res.success && res.data) {
        setFormat(res.data.value === 'QR' ? 'QR' : 'CODE128');
      }
    });
  }, []);

  useEffect(() => {
    if (isOpen && item) {
      const codeToEncode = item.item_code;
      
      if (format === 'CODE128' && barcodeRef.current) {
        try {
          JsBarcode(barcodeRef.current, codeToEncode, {
            format: "CODE128",
            width: 2,
            height: 60,
            displayValue: true,
            fontSize: 14,
            margin: 10
          });
        } catch (e) {
          console.error(e);
        }
      } else if (format === 'QR' && qrRef.current) {
        try {
          QRCode.toCanvas(qrRef.current, codeToEncode, {
            width: 150,
            margin: 2
          }, function (error) {
            if (error) console.error(error);
          });
        } catch (e) {
          console.error(e);
        }
      }
    }
  }, [isOpen, item, format]);

  if (!isOpen || !item) return null;

  const handlePrint = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    let contentToPrint = '';
    
    if (format === 'CODE128' && barcodeRef.current) {
      const svgData = new XMLSerializer().serializeToString(barcodeRef.current);
      contentToPrint = svgData;
    } else if (format === 'QR' && qrRef.current) {
      const dataUrl = qrRef.current.toDataURL();
      contentToPrint = `<img src="${dataUrl}" style="width:150px;height:150px;" />
                        <div style="font-family:sans-serif;margin-top:5px;font-weight:bold;">${item.item_code}</div>`;
    }

    // Generate multiple copies in print layout
    let labelsHTML = '';
    for (let i = 0; i < copies; i++) {
      labelsHTML += `
        <div class="label">
          <div class="item-name">${item.name}</div>
          ${contentToPrint}
        </div>
      `;
    }

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Print Barcode - ${item.item_code}</title>
        <style>
          body { 
            margin: 0; 
            padding: 20px; 
            font-family: Arial, sans-serif;
            display: flex;
            flex-wrap: wrap;
            gap: 20px;
          }
          .label {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            border: 1px solid #ccc;
            padding: 15px;
            border-radius: 8px;
            page-break-inside: avoid;
            text-align: center;
            background: white;
            min-width: 200px;
          }
          .item-name {
            font-weight: bold;
            font-size: 14px;
            margin-bottom: 10px;
            max-width: 200px;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
          }
          @media print {
            body { padding: 0; }
            .label { border: 1px dashed #ccc; }
          }
        </style>
      </head>
      <body>
        ${labelsHTML}
        <script>
          window.onload = () => {
            window.print();
            setTimeout(() => window.close(), 500);
          };
        </script>
      </body>
      </html>
    `;

    printWindow.document.write(html);
    printWindow.document.close();
  };

  const handleDownload = () => {
    try {
      let dataUrl = '';
      let filename = '';

      if (format === 'CODE128' && barcodeRef.current) {
        // Convert SVG to canvas to download as PNG
        const svg = barcodeRef.current;
        const svgData = new XMLSerializer().serializeToString(svg);
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");
        const img = new Image();
        img.onload = () => {
          canvas.width = img.width;
          canvas.height = img.height;
          ctx.fillStyle = "white";
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(img, 0, 0);
          const url = canvas.toDataURL("image/png");
          triggerDownload(url, `${item.item_code}_barcode.png`);
        };
        img.src = "data:image/svg+xml;base64," + btoa(unescape(encodeURIComponent(svgData)));
        return;
      } else if (format === 'QR' && qrRef.current) {
        dataUrl = qrRef.current.toDataURL("image/png");
        filename = `${item.item_code}_qrcode.png`;
        triggerDownload(dataUrl, filename);
      }
    } catch (err) {
      console.error(err);
      addToast('error', 'Failed to download image');
    }
  };

  const triggerDownload = (dataUrl, filename) => {
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between p-6 border-b border-gray-100">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Item Barcode</h2>
            <p className="text-sm text-gray-500 mt-1">{item.name}</p>
          </div>
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6">
          <div className="flex justify-center mb-6">
            <div className="inline-flex bg-gray-100 p-1 rounded-lg">
              <button
                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${format === 'CODE128' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}
                onClick={() => setFormat('CODE128')}
              >
                Barcode (1D)
              </button>
              <button
                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${format === 'QR' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}
                onClick={() => setFormat('QR')}
              >
                QR Code (2D)
              </button>
            </div>
          </div>

          <div className="bg-gray-50 border border-gray-100 rounded-xl p-8 flex flex-col items-center justify-center min-h-[200px]">
            {format === 'CODE128' ? (
              <svg ref={barcodeRef}></svg>
            ) : (
              <div className="flex flex-col items-center">
                <canvas ref={qrRef}></canvas>
                <span className="mt-2 text-sm font-bold text-gray-800">{item.item_code}</span>
              </div>
            )}
          </div>

          <div className="mt-6 flex items-center gap-4">
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 mb-1">Copies to Print</label>
              <input
                type="number"
                min="1"
                max="100"
                value={copies}
                onChange={(e) => setCopies(Math.max(1, parseInt(e.target.value) || 1))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <button
              onClick={handleDownload}
              className="mt-6 p-2 text-gray-600 hover:text-blue-600 border border-gray-300 rounded-lg hover:border-blue-300 transition-colors"
              title="Download Image"
            >
              <Download className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="flex gap-3 p-6 border-t border-gray-100 bg-gray-50">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100 font-medium transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handlePrint}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium transition-colors shadow-sm"
          >
            <Printer className="w-4 h-4" />
            Print Labels
          </button>
        </div>
      </div>
    </div>
  );
}

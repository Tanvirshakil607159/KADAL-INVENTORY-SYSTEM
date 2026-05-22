const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');

// Mock Electron
const mockElectron = {
  app: { getPath: () => 'C:\\Users\\workh\\AppData\\Roaming\\kadal-inventory' },
  shell: { openPath: () => {} }
};
const Module = require('module');
const originalRequire = Module.prototype.require;
Module.prototype.require = function(id) {
  if (id === 'electron') return mockElectron;
  return originalRequire.apply(this, arguments);
};

const pdfGeneratorPath = path.join(__dirname, 'src', 'main', 'utils', 'pdf-generator.js');
const PdfGenerator = require(pdfGeneratorPath);

const dbPath = path.join('C:', 'Users', 'workh', 'AppData', 'Roaming', 'kadal-inventory', 'kadal.db');

async function run() {
  const wasmPath = path.join(__dirname, 'node_modules', 'sql.js', 'dist', 'sql-wasm.wasm');
  const SQL = await initSqlJs({ locateFile: () => wasmPath });
  const fileBuffer = fs.readFileSync(dbPath);
  const db = new SQL.Database(fileBuffer);

  // Read all settings
  const settings = {};
  const res = db.exec("SELECT key, value FROM settings");
  res[0].values.forEach(row => {
    settings[row[0]] = row[1];
  });
  db.close();

  console.log("Database Settings:", {
    barcode_format: settings.barcode_format,
    public_web_url: settings.public_web_url,
    supabase_url: settings.supabase_url
  });

  const challan = {
    challan_number: 'CH-20260522-001',
    challan_date: '2026-05-22T00:00:00.000Z',
    status: 'ACTIVE',
    receiver_name: 'Test Receiver',
    items: []
  };

  // Let's trace how the value is generated
  const format = settings.barcode_format === 'CODE128' ? 'CODE128' : 'QR';
  let barcodeValue;
  if (format === 'QR') {
    const baseUrl = settings.public_web_url ? settings.public_web_url.trim().replace(/\/$/, '') : 'https://kadal-inventory.web.app';
    barcodeValue = `${baseUrl}/challan/${challan.challan_number}`;
    const u = settings.supabase_url;
    const k = settings.supabase_key;
    if (u && k) {
      barcodeValue += `?u=${encodeURIComponent(u)}&k=${encodeURIComponent(k)}`;
    }
  } else {
    const baseUrl = settings.public_web_url ? settings.public_web_url.trim().replace(/\/$/, '') : '';
    barcodeValue = baseUrl ? `${baseUrl}/challan/${challan.challan_number}` : challan.challan_number;
  }

  console.log("Calculated format:", format);
  console.log("Calculated barcode value:", barcodeValue);
}

run().catch(console.error);

const { createClient } = require('@supabase/supabase-js');
const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');

const dbPath = path.join('C:', 'Users', 'workh', 'AppData', 'Roaming', 'kadal-inventory', 'kadal.db');

async function run() {
  const wasmPath = path.join(__dirname, 'node_modules', 'sql.js', 'dist', 'sql-wasm.wasm');
  const SQL = await initSqlJs({ locateFile: () => wasmPath });
  const fileBuffer = fs.readFileSync(dbPath);
  const db = new SQL.Database(fileBuffer);

  const urlRow = db.exec("SELECT value FROM settings WHERE key = 'supabase_url'")[0]?.values[0][0];
  const keyRow = db.exec("SELECT value FROM settings WHERE key = 'supabase_key'")[0]?.values[0][0];
  
  // Read local settings
  const localSettings = {};
  const res = db.exec("SELECT key, value FROM settings");
  res[0].values.forEach(row => {
    localSettings[row[0]] = row[1];
  });
  db.close();

  if (!urlRow || !keyRow) {
    console.log("No cloud credentials configured locally.");
    return;
  }

  console.log("Connecting to cloud Supabase...");
  const supabase = createClient(urlRow, keyRow);
  
  const settingsToSeed = [
    { key: 'barcode_format', value: 'QR' },
    { key: 'public_web_url', value: 'https://kadal-inventory.web.app' },
    { key: 'allow_challan_to_issue', value: 'true' },
    { key: 'allow_inventory_to_produce', value: 'true' }
  ];

  for (const s of settingsToSeed) {
    console.log(`Upserting ${s.key} = '${s.value}'...`);
    const { error } = await supabase.from('settings').upsert({
      key: s.key,
      value: s.value,
      updated_at: new Date().toISOString()
    });
    if (error) {
      console.error(`Failed to upsert ${s.key}:`, error.message);
    } else {
      console.log(`Successfully upserted ${s.key}`);
    }
  }

  console.log("All settings seeded to cloud.");
}

run().catch(console.error);

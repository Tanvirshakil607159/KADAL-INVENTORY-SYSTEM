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
  db.close();

  if (!urlRow || !keyRow) {
    console.log("No cloud credentials configured locally.");
    return;
  }

  console.log("Connecting to cloud Supabase...");
  const supabase = createClient(urlRow, keyRow);
  const { data, error } = await supabase.from('settings').select('*');
  if (error) {
    console.error("Failed to fetch cloud settings:", error.message);
    return;
  }

  console.log("Cloud settings:");
  data.forEach(s => {
    console.log(`- ${s.key}: ${s.value}`);
  });
}

run().catch(console.error);

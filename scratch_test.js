const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');

const dbPath = path.join('C:', 'Users', 'workh', 'AppData', 'Roaming', 'kadal-inventory', 'kadal.db');

async function run() {
  const wasmPath = path.join(__dirname, 'node_modules', 'sql.js', 'dist', 'sql-wasm.wasm');
  const SQL = await initSqlJs({ locateFile: () => wasmPath });
  const fileBuffer = fs.readFileSync(dbPath);
  const db = new SQL.Database(fileBuffer);

  const res = db.exec("SELECT key, value FROM settings WHERE key IN ('barcode_format', 'public_web_url', 'supabase_url', 'supabase_key')");
  console.log("Settings:");
  if (res.length > 0) {
    res[0].values.forEach(row => {
      console.log(`- ${row[0]}: ${row[1]}`);
    });
  } else {
    console.log("None found");
  }
  db.close();
}
run().catch(console.error);

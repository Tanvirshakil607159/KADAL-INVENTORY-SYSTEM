const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
const initSqlJs = require('sql.js');

const dbPath = path.join('C:', 'Users', 'workh', 'AppData', 'Roaming', 'kadal-inventory', 'kadal.db');

async function run() {
  const SQL = await initSqlJs();
  if (!fs.existsSync(dbPath)) {
    console.log("Local database file not found at " + dbPath);
    return;
  }
  const fileBuffer = fs.readFileSync(dbPath);
  const db = new SQL.Database(fileBuffer);
  
  const localRows = [];
  try {
    const res = db.exec("SELECT key, value FROM settings ORDER BY key");
    if (res[0]) {
      res[0].values.forEach(row => {
        localRows.push({ key: row[0], value: row[1] });
      });
    }
  } catch (err) {
    console.error("Local SQLite error:", err);
  }
  db.close();

  console.log("=== LOCAL SQLITE SETTINGS ===");
  localRows.forEach(r => {
    console.log(`${r.key}: ${r.value}`);
  });

  const url = localRows.find(r => r.key === 'supabase_url')?.value;
  const key = localRows.find(r => r.key === 'supabase_key')?.value;

  if (url && key) {
    console.log("\nConnecting to Supabase at:", url);
    const supabase = createClient(url, key);
    const { data: cloudRows, error } = await supabase.from('settings').select('*');
    if (error) {
      console.error("Supabase settings error:", error.message);
    } else {
      console.log("\n=== CLOUD SUPABASE SETTINGS ===");
      cloudRows.forEach(r => {
        console.log(`${r.key}: ${r.value}`);
      });
    }
  } else {
    console.log("\nNo Supabase credentials found.");
  }
}

run().catch(console.error);

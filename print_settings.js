const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
const initSqlJs = require('sql.js');

const dbPath = path.join('C:', 'Users', 'workh', 'AppData', 'Roaming', 'kadal-inventory', 'kadal.db');

async function run() {
  const SQL = await initSqlJs();
  const fileBuffer = fs.readFileSync(dbPath);
  const db = new SQL.Database(fileBuffer);
  
  const getVal = (key) => {
    try {
      const res = db.exec(`SELECT value FROM settings WHERE key = '${key}'`);
      return res[0]?.values[0][0];
    } catch { return null; }
  };

  const localFormat = getVal('barcode_format');
  const localUrl = getVal('public_web_url');
  const sUrl = getVal('supabase_url');
  const sKey = getVal('supabase_key');
  db.close();

  console.log("Local barcode_format:", localFormat);
  console.log("Local public_web_url:", localUrl);

  if (sUrl && sKey) {
    const supabase = createClient(sUrl, sKey);
    const { data: cloudRows, error } = await supabase.from('settings').select('*');
    if (!error && cloudRows) {
      const cloudFormat = cloudRows.find(r => r.key === 'barcode_format')?.value;
      const cloudUrl = cloudRows.find(r => r.key === 'public_web_url')?.value;
      console.log("Cloud barcode_format:", cloudFormat);
      console.log("Cloud public_web_url:", cloudUrl);
    } else {
      console.log("Supabase error:", error);
    }
  }
}

run().catch(console.error);

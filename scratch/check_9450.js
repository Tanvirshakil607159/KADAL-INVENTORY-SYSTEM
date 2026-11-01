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
  
  const url = getVal('supabase_url');
  const key = getVal('supabase_key');
  db.close();

  if (!url || !key) {
    console.log('No supabase credentials found');
    return;
  }

  const supabase = createClient(url, key);

  console.log('=== Checking Item KADAL-9450 in Inventory ===');
  const { data: item } = await supabase.from('items').select('*').eq('item_code', 'KADAL-9450');
  console.log(item);
}

run().catch(console.error);
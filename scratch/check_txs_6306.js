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

  const supabase = createClient(url, key);

  const { data: txs } = await supabase.from('stock_transactions').select('*').eq('item_id', 6306);
  console.log('Stock transactions for 6306:', JSON.stringify(txs, null, 2));
}

run().catch(console.error);

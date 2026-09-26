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

  const { data: item7051 } = await supabase.from('items').select('*').ilike('item_code', '%7051%');
  console.log('Item 7051:', item7051);
  if (item7051 && item7051.length > 0) {
    const { data: tiers } = await supabase.from('item_price_tiers').select('*').eq('item_id', item7051[0].id);
    console.log('Tiers for 7051:', tiers);
  }
}

run().catch(console.error);

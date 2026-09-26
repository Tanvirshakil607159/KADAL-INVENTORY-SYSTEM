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

  const { data: item } = await supabase.from('items').select('*').eq('id', 6306).single();
  const { data: tiers } = await supabase.from('item_price_tiers').select('*').eq('item_id', 6306).gt('quantity', 0);

  console.log('Result for KADAL-6950:');
  console.log('Item unit_price:', item.unit_price);
  console.log('Active price tiers:', tiers.map(t => ({ quantity: t.quantity, unit_price: t.unit_price, currency: t.currency })));
}

run().catch(console.error);

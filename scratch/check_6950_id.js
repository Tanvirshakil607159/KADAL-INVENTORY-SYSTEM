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

  // Check if item id 6950 exists
  const { data: item6950 } = await supabase.from('items').select('*').eq('id', 6950);
  console.log('Item by id 6950:', item6950);

  // Check if item_price_tiers for item_id 6950 exists
  const { data: tiers6950 } = await supabase.from('item_price_tiers').select('*').eq('item_id', 6950);
  console.log('Tiers for item_id 6950:', tiers6950);

  // Check all items matching %6950%
  const { data: itemsLike } = await supabase.from('items').select('id, item_code, name, unit_price, current_stock').ilike('item_code', '%6950%');
  console.log('Items like 6950:', itemsLike);
}

run().catch(console.error);

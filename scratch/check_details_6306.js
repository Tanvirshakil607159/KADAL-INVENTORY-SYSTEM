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
    console.error('No Supabase credentials');
    return;
  }

  const supabase = createClient(url, key);

  // Check item 6306
  const { data: item } = await supabase.from('items').select('*').eq('id', 6306).single();
  console.log('Item 6306:', item);

  // Check item_price_tiers
  const { data: tiers } = await supabase.from('item_price_tiers').select('*').eq('item_id', 6306);
  console.log('Tiers for 6306:', tiers);

  // Check stock_transactions
  const { data: txs } = await supabase.from('stock_transactions').select('*').eq('item_id', 6306).limit(5);
  console.log('Stock transactions for 6306 (first 5):', txs);

  // Check challan_items
  const { data: challans } = await supabase.from('challan_items').select('*').eq('item_id', 6306);
  console.log('Challan items for 6306:', challans);

  // Check issue_items
  const { data: issues } = await supabase.from('issue_items').select('*').eq('item_id', 6306);
  console.log('Issue items for 6306 count:', issues ? issues.length : 0);

  // Check requisition_items
  const { data: reqs } = await supabase.from('requisition_items').select('*').eq('item_id', 6306);
  console.log('Requisition items count:', reqs ? reqs.length : 0);
  if (reqs && reqs.length > 0) console.log('Requisition items:', reqs);

  // Check local database for items / tiers as well
  const db2 = new SQL.Database(fileBuffer);
  try {
    const localTiers = db2.exec("SELECT * FROM item_price_tiers WHERE item_id = 6306");
    console.log('Local tiers for 6306:', JSON.stringify(localTiers, null, 2));
  } catch (e) {
    console.log('Local tiers query error:', e.message);
  }
  try {
    const localItem = db2.exec("SELECT id, item_code, unit_price FROM items WHERE id = 6306 OR item_code = 'KADAL-6950'");
    console.log('Local item 6306:', JSON.stringify(localItem, null, 2));
  } catch (e) {
    console.log('Local items query error:', e.message);
  }
  db2.close();
}

run().catch(console.error);

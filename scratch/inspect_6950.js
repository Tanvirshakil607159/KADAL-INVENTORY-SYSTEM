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
  
  // Check local items table if exists
  try {
    const res = db.exec("SELECT * FROM items WHERE id = 6950 OR item_code LIKE '%6950%'");
    console.log('LOCAL ITEMS:', JSON.stringify(res, null, 2));
  } catch (e) {
    console.log('Local items table error:', e.message);
  }

  const url = getVal('supabase_url');
  const key = getVal('supabase_key');
  db.close();

  if (url && key) {
    console.log('Connecting to Supabase at:', url);
    const supabase = createClient(url, key);

    // 1. Fetch item 6950
    const { data: items, error: iErr } = await supabase
      .from('items')
      .select('*')
      .or('id.eq.6950,item_code.ilike.%6950%');
    console.log('\n=== SUPABASE ITEMS ===');
    console.log(JSON.stringify(items, null, 2), iErr);

    // 2. Fetch item_price_tiers for item 6950
    if (items && items.length > 0) {
      const itemIds = items.map(i => i.id);
      const { data: tiers, error: tErr } = await supabase
        .from('item_price_tiers')
        .select('*')
        .in('item_id', itemIds);
      console.log('\n=== ITEM PRICE TIERS ===');
      console.log(JSON.stringify(tiers, null, 2), tErr);

      // 3. Check stock_transactions
      const { data: txs, error: txErr } = await supabase
        .from('stock_transactions')
        .select('*')
        .in('item_id', itemIds)
        .order('id', { ascending: false })
        .limit(10);
      console.log('\n=== RECENT STOCK TRANSACTIONS ===');
      console.log(JSON.stringify(txs, null, 2), txErr);

      // 4. Check challan_items
      const { data: cItems, error: cErr } = await supabase
        .from('challan_items')
        .select('*')
        .in('item_id', itemIds)
        .order('id', { ascending: false })
        .limit(10);
      console.log('\n=== RECENT CHALLAN ITEMS ===');
      console.log(JSON.stringify(cItems, null, 2), cErr);

      // 5. Check issue_items
      const { data: issItems, error: isErr } = await supabase
        .from('issue_items')
        .select('*')
        .in('item_id', itemIds)
        .order('id', { ascending: false })
        .limit(10);
      console.log('\n=== RECENT ISSUE ITEMS ===');
      console.log(JSON.stringify(issItems, null, 2), isErr);

      // 6. Check inventory_logs
      const { data: logs, error: lErr } = await supabase
        .from('inventory_logs')
        .select('*')
        .in('item_id', itemIds)
        .order('id', { ascending: false })
        .limit(10);
      console.log('\n=== RECENT INVENTORY LOGS ===');
      console.log(JSON.stringify(logs, null, 2), lErr);
    }
  }
}

run().catch(console.error);

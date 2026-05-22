const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
const initSqlJs = require('sql.js');

const dbPath = path.join('C:', 'Users', 'workh', 'AppData', 'Roaming', 'kadal-inventory', 'kadal.db');

async function run() {
  const SQL = await initSqlJs();
  if (!fs.existsSync(dbPath)) return;
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

  if (url && key) {
    const supabase = createClient(url, key);
    
    const { data: items } = await supabase.from('items').select('*');
    const { data: txs } = await supabase.from('stock_transactions').select('*');
    
    console.log(`Loaded ${items.length} items and ${txs.length} transactions.`);
    
    const targets = [];
    items.forEach(i => {
      const itemTxs = txs.filter(t => Number(t.item_id) === Number(i.id));
      const total_in = itemTxs.filter(t => t.type === 'IN').reduce((sum, t) => sum + Number(t.quantity || 0), 0);
      const total_out = itemTxs.filter(t => t.type === 'OUT').reduce((sum, t) => sum + Number(t.quantity || 0), 0);
      
      if (Number(i.current_stock || 0) === 0 && total_out > 0 && total_in === 0) {
        targets.push({ item: i, total_out, txs: itemTxs });
      }
    });

    console.log(`Found ${targets.length} target items.`);
    
    targets.slice(0, 5).forEach(({ item, total_out, txs }) => {
      console.log(`\n=== ITEM ${item.id} ===`);
      console.log('Item Name:', item.name);
      console.log('Item Code:', item.item_code);
      console.log('Opening Stock:', item.opening_stock);
      console.log('Current Stock in DB:', item.current_stock);
      console.log('Total Out Calculated:', total_out);
      console.log('Transactions:');
      txs.forEach(t => {
        console.log(`  - Type: ${t.type}, Qty: ${t.quantity}, Reference: ${t.reference}, Notes: ${t.notes}, Stock Before: ${t.stock_before}, Stock After: ${t.stock_after}, Date: ${t.created_at}`);
      });
    });
  }
}
run().catch(console.error);

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

  if (url && key) {
    const supabase = createClient(url, key);
    
    // Check Item 6643 and 6640
    for (let itemId of [6643, 6640]) {
      const { data: item } = await supabase.from('items').select('id, name, current_stock').eq('id', itemId).single();
      console.log(`\n=== ITEM ${itemId} (${item.name}) ===`);
      console.log(`Stored current_stock:`, item.current_stock);
      
      const { data: txs } = await supabase
        .from('stock_transactions')
        .select('*')
        .eq('item_id', itemId)
        .order('id', { ascending: true });
        
      let running = 0;
      txs.forEach((t, i) => {
        const qty = Number(t.quantity);
        const before = running;
        if (t.type === 'IN') running += qty;
        else if (t.type === 'OUT') running -= qty;
        console.log(`[${i+1}] ID:${t.id} Type:${t.type} Qty:${qty} Ref:${t.reference} | Logged:(before=${t.stock_before}, after=${t.stock_after}) | Ledger:(before=${before}, after=${running})`);
      });
      
      console.log(`Calculated running stock for item ${itemId}:`, running);
      console.log(`Mismatch?`, running === Number(item.current_stock) ? 'No' : 'YES');
    }
  }
}

run().catch(console.error);

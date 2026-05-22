const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
const initSqlJs = require('sql.js');

const dbPath = path.join('C:', 'Users', 'workh', 'AppData', 'Roaming', 'kadal-inventory', 'kadal.db');

async function fetchAll(queryBuilder, pageSize = 1000) {
  let allData = [];
  let page = 0;
  while (true) {
    const from = page * pageSize;
    const to = from + pageSize - 1;
    const { data, error } = await queryBuilder.range(from, to);
    if (error) throw error;
    if (!data || data.length === 0) break;
    allData = allData.concat(data);
    if (data.length < pageSize) break;
    page++;
  }
  return allData;
}

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
    
    console.log('Fetching items...');
    const items = await fetchAll(supabase.from('items').select('id, name, item_code, current_stock, opening_stock, created_at'));
    
    console.log('Fetching transactions...');
    const txs = await fetchAll(supabase.from('stock_transactions').select('item_id, type, quantity, reference'));
    
    // 1. Fetch default warehouse ID
    let whId = 1;
    const { data: defaultWh } = await supabase.from('warehouses').select('id').eq('is_default', true).maybeSingle();
    if (defaultWh) whId = defaultWh.id;
    else {
      const { data: firstWh } = await supabase.from('warehouses').select('id').limit(1);
      if (firstWh && firstWh.length > 0) whId = firstWh[0].id;
    }
    
    // 2. Fetch warehouse stock
    const whStocks = await fetchAll(supabase.from('warehouse_stock').select('warehouse_id, item_id, quantity'));

    let fixedCount = 0;
    
    for (const i of items) {
      const itemTxs = txs.filter(t => Number(t.item_id) === Number(i.id));
      const total_in = itemTxs.filter(t => t.type === 'IN').reduce((sum, t) => sum + Number(t.quantity || 0), 0);
      const total_out = itemTxs.filter(t => t.type === 'OUT').reduce((sum, t) => sum + Number(t.quantity || 0), 0);
      
      const calc_stock = Math.round((total_in - total_out) * 1000) / 1000;
      const actual_stock = Math.round(Number(i.current_stock || 0) * 1000) / 1000;
      const open_stock = Math.round(Number(i.opening_stock || 0) * 1000) / 1000;
      
      let needsFix = false;
      let missingQty = 0;
      
      if (calc_stock !== actual_stock) {
         missingQty = Math.round((actual_stock - calc_stock) * 1000) / 1000;
         if (missingQty > 0) {
           needsFix = true;
         }
      } else if (actual_stock > 0 && total_in === 0) {
         needsFix = true;
         missingQty = actual_stock;
      }
      
      if (open_stock > 0 && total_in === 0) {
         needsFix = true;
         missingQty = open_stock;
      }
      
      if (needsFix) {
        console.log(`Fixing item "${i.name}" (${i.item_code}) ID=${i.id} | DB Stock=${actual_stock} | Calc Stock=${calc_stock} | Missing IN=${missingQty}`);
        
        // Insert missing IN transaction
        await supabase.from('stock_transactions').insert([{
          item_id: i.id,
          type: 'IN',
          quantity: missingQty,
          stock_before: calc_stock,
          stock_after: actual_stock,
          reference: 'Opening Stock (Excel Import Fix)',
          notes: 'Auto-repaired missing stock transaction',
          created_at: i.created_at
        }]);
        
        // Ensure opening_stock matches
        if (Number(i.opening_stock) !== missingQty) {
           await supabase.from('items').update({ opening_stock: missingQty }).eq('id', i.id);
        }
        
        fixedCount++;
      }
      
      // Ensure warehouse stock exists and matches
      const hasWhStock = whStocks.some(ws => Number(ws.item_id) === Number(i.id));
      if (!hasWhStock && actual_stock > 0) {
         await supabase.from('warehouse_stock').upsert({
            warehouse_id: whId,
            item_id: i.id,
            quantity: actual_stock,
            updated_at: new Date().toISOString()
         }, { onConflict: 'warehouse_id,item_id' });
      }
    }
    
    console.log(`\nFixed ${fixedCount} items.`);
  }
}

run().catch(console.error);

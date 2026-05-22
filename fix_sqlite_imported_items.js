const fs = require('fs');
const path = require('path');
const initSqlJs = require('sql.js');

const dbPath = path.join('C:', 'Users', 'workh', 'AppData', 'Roaming', 'kadal-inventory', 'kadal.db');

async function run() {
  const SQL = await initSqlJs();
  if (!fs.existsSync(dbPath)) return;
  const fileBuffer = fs.readFileSync(dbPath);
  const db = new SQL.Database(fileBuffer);

  const stmtItems = db.prepare('SELECT id, name, item_code, current_stock, opening_stock, created_at FROM items');
  const items = [];
  while (stmtItems.step()) {
    items.push(stmtItems.getAsObject());
  }
  stmtItems.free();

  const stmtTxs = db.prepare('SELECT item_id, type, quantity, reference FROM stock_transactions');
  const txs = [];
  while (stmtTxs.step()) {
    txs.push(stmtTxs.getAsObject());
  }
  stmtTxs.free();

  const stmtWh = db.prepare('SELECT id FROM warehouses WHERE is_default = 1 LIMIT 1');
  let whId = 1;
  if (stmtWh.step()) {
    whId = stmtWh.getAsObject().id;
  } else {
    const stmtFirstWh = db.prepare('SELECT id FROM warehouses LIMIT 1');
    if (stmtFirstWh.step()) whId = stmtFirstWh.getAsObject().id;
    stmtFirstWh.free();
  }
  stmtWh.free();

  const stmtWhStocks = db.prepare('SELECT warehouse_id, item_id, quantity FROM warehouse_stock');
  const whStocks = [];
  while (stmtWhStocks.step()) {
    whStocks.push(stmtWhStocks.getAsObject());
  }
  stmtWhStocks.free();

  let fixedCount = 0;
  
  db.run("BEGIN TRANSACTION");

  for (const i of items) {
    const itemTxs = txs.filter(t => Number(t.item_id) === Number(i.id));
    const total_in = itemTxs.filter(t => t.type === 'IN').reduce((sum, t) => sum + Number(t.quantity || 0), 0);
    const total_out = itemTxs.filter(t => t.type === 'OUT').reduce((sum, t) => sum + Number(t.quantity || 0), 0);
    
    // Use proper rounding for floating point
    const calc_stock = Math.round((total_in - total_out) * 1000) / 1000;
    const actual_stock = Math.round(Number(i.current_stock || 0) * 1000) / 1000;
    const open_stock = Math.round(Number(i.opening_stock || 0) * 1000) / 1000;
    
    let needsFix = false;
    let missingQty = 0;
    
    // First, check if calc_stock differs from actual stock.
    if (calc_stock !== actual_stock) {
       missingQty = Math.round((actual_stock - calc_stock) * 1000) / 1000;
       if (missingQty > 0) {
         needsFix = true;
       }
    } else if (actual_stock > 0 && total_in === 0) {
       // Should not happen if calc_stock == actual_stock, but just in case
       needsFix = true;
       missingQty = actual_stock;
    }
    
    // If it's an imported item with no transaction but it has opening_stock 
    if (open_stock > 0 && total_in === 0) {
        needsFix = true;
        missingQty = open_stock;
    }

    if (needsFix) {
      console.log(`Fixing item "${i.name}" (${i.item_code}) ID=${i.id} | DB Stock=${actual_stock} | Calc Stock=${calc_stock} | Missing IN=${missingQty}`);
      
      const insertTxStmt = db.prepare(`
        INSERT INTO stock_transactions (item_id, type, quantity, stock_before, stock_after, reference, notes, created_at, created_by) 
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      insertTxStmt.run([
        i.id,
        'IN',
        missingQty,
        calc_stock,
        calc_stock + missingQty,
        'Opening Stock',
        'Auto-repaired missing stock transaction (Excel Import)',
        i.created_at || new Date().toISOString(),
        null
      ]);
      insertTxStmt.free();
      
      fixedCount++;
    }
    
    // Ensure warehouse stock exists and matches
    const hasWhStock = whStocks.some(ws => Number(ws.item_id) === Number(i.id));
    if (!hasWhStock && actual_stock > 0) {
       const upsertWhStmt = db.prepare(`
          INSERT INTO warehouse_stock (warehouse_id, item_id, quantity, updated_at) 
          VALUES (?, ?, ?, ?)
          ON CONFLICT(warehouse_id, item_id) DO UPDATE SET quantity=excluded.quantity, updated_at=excluded.updated_at
       `);
       upsertWhStmt.run([whId, i.id, actual_stock, new Date().toISOString()]);
       upsertWhStmt.free();
    }
  }

  db.run("COMMIT TRANSACTION");

  if (fixedCount > 0) {
    const updatedData = db.export();
    fs.writeFileSync(dbPath, Buffer.from(updatedData));
    console.log(`\nSuccessfully updated kadal.db with ${fixedCount} repaired items.`);
  } else {
    console.log(`\nNo missing transactions found in kadal.db. All items are perfectly synced.`);
  }
}

run().catch(console.error);

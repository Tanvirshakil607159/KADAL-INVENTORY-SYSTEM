const fs = require('fs');
const path = require('path');
const initSqlJs = require('sql.js');

const dbPath = path.join('C:', 'Users', 'workh', 'AppData', 'Roaming', 'kadal-inventory', 'kadal.db');

async function run() {
  const SQL = await initSqlJs();
  if (!fs.existsSync(dbPath)) return;
  const fileBuffer = fs.readFileSync(dbPath);
  const db = new SQL.Database(fileBuffer);

  const items = db.exec('SELECT id, name, item_code, opening_stock, current_stock FROM items');
  const txs = db.exec("SELECT item_id, type, quantity FROM stock_transactions WHERE reference = 'Opening Stock' OR type = 'IN'");

  if (!items.length) return;
  
  const txList = txs.length ? txs[0].values : [];
  let count = 0;

  for (const row of items[0].values) {
    const id = row[0];
    const name = row[1];
    const code = row[2];
    const open = Number(row[3] || 0);
    const curr = Number(row[4] || 0);

    const itemTxs = txList.filter(t => t[0] === id);
    const total_in = itemTxs.reduce((sum, t) => sum + Number(t[2] || 0), 0);

    if (open > 0 && total_in < open) {
      console.log(`Item "${name}" (${code}) ID=${id} | open=${open} | current=${curr} | total_in=${total_in}`);
      count++;
    }
  }
  
  console.log(`Found ${count} items with opening_stock > total_in`);
}

run().catch(console.error);

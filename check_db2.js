const initSqlJs = require('sql.js');
const fs = require('fs');

async function test() {
  const SQL = await initSqlJs();
  const filebuffer = fs.readFileSync('C:/Users/workh/AppData/Roaming/kadal-inventory/kadal.db');
  const db = new SQL.Database(filebuffer);
  
  const items = db.exec(`SELECT id, name FROM items WHERE order_number = '00033756'`);
  console.log('Items:', JSON.stringify(items, null, 2));
  
  if (items.length > 0 && items[0].values.length > 0) {
    const ids = items[0].values.map(v => v[0]);
    const issueItems = db.exec(`SELECT * FROM issue_items WHERE item_id IN (${ids.join(',')})`);
    console.log('Issue Items:', JSON.stringify(issueItems, null, 2));
  }
}
test();

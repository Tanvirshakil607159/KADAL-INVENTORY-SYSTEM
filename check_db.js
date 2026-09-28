const initSqlJs = require('sql.js');
const fs = require('fs');

async function test() {
  const SQL = await initSqlJs();
  const filebuffer = fs.readFileSync('C:/Users/workh/AppData/Roaming/kadal-inventory/kadal.db');
  const db = new SQL.Database(filebuffer);
  
  const issues = db.exec(`SELECT issue_id, produced_item_id, produced_item_ids, remarks FROM issues WHERE issue_type = 'FACTORY' AND (produced_item_id IS NOT NULL OR produced_item_ids IS NOT NULL OR remarks LIKE '%[PRODUCED_ITEM_IDS:%') LIMIT 10`);
  
  console.log('Issues:', JSON.stringify(issues, null, 2));
}
test();

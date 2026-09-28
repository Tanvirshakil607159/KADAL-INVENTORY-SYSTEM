const db = require('better-sqlite3')('C:/Users/workh/AppData/Roaming/kadal-inventory/kadal.db');
const items = db.prepare(`SELECT * FROM items WHERE order_number = '00033756'`).all();
const itemIds = items.map(i => i.id).join(',');
console.log('Items:', items.map(i => ({id: i.id, name: i.name, is_target: i.name.includes('TARGET') })));
if (itemIds.length > 0) {
  const issues = db.prepare(`SELECT issue_id, item_id FROM issue_items WHERE item_id IN (${itemIds})`).all();
  console.log('Issue Items:', issues);
  
  const targetIssues = db.prepare(`SELECT id, issue_id, produced_item_id, produced_item_ids FROM issues WHERE produced_item_id IN (${itemIds}) OR produced_item_ids LIKE '%[' || ? || ']%'`).all(items[0]?.id || 0);
  console.log('Target Issues:', targetIssues);
}

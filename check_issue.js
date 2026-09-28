const db = require('better-sqlite3')('C:/Users/workh/AppData/Roaming/kadal-inventory/kadal.db');
const res = db.prepare(`SELECT ii.issue_id, iss.issue_id as issue_num FROM issue_items ii JOIN issues iss ON ii.issue_id = iss.id JOIN items i ON ii.item_id = i.id WHERE i.order_number = '00033756'`).all();
console.log(res);

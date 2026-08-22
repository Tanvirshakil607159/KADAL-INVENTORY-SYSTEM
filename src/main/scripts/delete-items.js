/**
 * One-off script to delete specific items and all their related data from Supabase.
 * 
 * Run from the project root:
 *   node src/main/scripts/delete-items.js
 * 
 * This connects directly to Supabase using the credentials from db-config or settings.
 */

const { createClient } = require('@supabase/supabase-js');
const path = require('path');
const fs = require('fs');

// Item codes to delete
const ITEM_CODES = [
  'KADAL-4614', 'KADAL-4615', 'KADAL-4616', 'KADAL-4617', 'KADAL-4618',
  'KADAL-4619', 'KADAL-4620', 'KADAL-4621', 'KADAL-4622', 'KADAL-4623',
  'KADAL-4624'
];

// Read Supabase credentials from local SQLite settings DB
function getSupabaseCredentials() {
  // Try reading from userData db-config
  const userDataPath = process.env.APPDATA
    ? path.join(process.env.APPDATA, 'kadal-inventory')
    : path.join(require('os').homedir(), '.kadal-inventory');

  const dbPath = path.join(userDataPath, 'inventory.db');
  
  if (!fs.existsSync(dbPath)) {
    console.error(`Database not found at: ${dbPath}`);
    console.log('Trying alternative path...');
    // Try common electron app data paths
    const altPaths = [
      path.join(process.env.APPDATA || '', 'kadal-inventory', 'inventory.db'),
      path.join(process.env.LOCALAPPDATA || '', 'kadal-inventory', 'inventory.db'),
    ];
    for (const p of altPaths) {
      if (fs.existsSync(p)) {
        console.log(`Found DB at: ${p}`);
        return readCredsFromDb(p);
      }
    }
    return null;
  }
  return readCredsFromDb(dbPath);
}

function readCredsFromDb(dbPath) {
  try {
    const initSqlJs = require('sql.js');
    const SQL = initSqlJs();
    // sql.js is async, need different approach
    return { dbPath };
  } catch(e) {
    return null;
  }
}

async function main() {
  // Since we can't easily read from SQLite synchronously, ask user for creds
  // or read from environment
  let supabaseUrl = process.env.SUPABASE_URL;
  let supabaseKey = process.env.SUPABASE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    // Try reading from the local SQLite database
    try {
      const initSqlJs = require('sql.js');
      const SQL = await initSqlJs();
      
      // Find the DB file
      const userDataPath = path.join(process.env.APPDATA || '', 'kadal-inventory');
      
      let dbPath = path.join(userDataPath, 'kadal.db');
      
      if (!fs.existsSync(dbPath)) {
        // Check for custom db path in config
        const configPath = path.join(userDataPath, 'db-config.json');
        if (fs.existsSync(configPath)) {
          const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
          if (config.customDbPath && fs.existsSync(config.customDbPath)) {
            dbPath = config.customDbPath;
          }
        }
      }

      if (!fs.existsSync(dbPath)) {
        console.error('Cannot find inventory database file.');
        console.log('Set SUPABASE_URL and SUPABASE_KEY environment variables and run again.');
        process.exit(1);
      }

      console.log(`Reading credentials from: ${dbPath}`);
      const dbBuffer = fs.readFileSync(dbPath);
      const db = new SQL.Database(dbBuffer);
      
      const urlRow = db.exec("SELECT value FROM settings WHERE key = 'supabase_url'");
      const keyRow = db.exec("SELECT value FROM settings WHERE key = 'supabase_key'");
      
      if (urlRow.length > 0 && keyRow.length > 0) {
        supabaseUrl = urlRow[0].values[0][0];
        supabaseKey = keyRow[0].values[0][0];
      }
      
      db.close();
    } catch (e) {
      console.error('Failed to read credentials from local DB:', e.message);
    }
  }

  if (!supabaseUrl || !supabaseKey) {
    console.error('Could not find Supabase credentials.');
    console.log('Set SUPABASE_URL and SUPABASE_KEY environment variables and run again.');
    process.exit(1);
  }

  console.log(`Connecting to Supabase: ${supabaseUrl}`);
  const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false }
  });

  // Step 1: Find item IDs by item_code
  console.log(`\nLooking up ${ITEM_CODES.length} items...`);
  const { data: items, error: itemsError } = await supabase
    .from('items')
    .select('id, item_code, name')
    .in('item_code', ITEM_CODES);

  if (itemsError) {
    console.error('Failed to fetch items:', itemsError.message);
    process.exit(1);
  }

  if (!items || items.length === 0) {
    console.log('No items found with the given codes.');
    process.exit(0);
  }

  console.log(`Found ${items.length} items:`);
  items.forEach(i => console.log(`  - ${i.item_code}: ${i.name} (ID: ${i.id})`));

  const itemIds = items.map(i => i.id);

  // Step 2: Delete related records from all child tables
  const deleteOps = [
    { table: 'stock_transactions', column: 'item_id', label: 'Stock Transactions' },
    { table: 'challan_items', column: 'item_id', label: 'Challan Items' },
    { table: 'issue_items', column: 'item_id', label: 'Issue Items' },
    { table: 'requisition_items', column: 'item_id', label: 'Requisition Items' },
    { table: 'return_items', column: 'item_id', label: 'Return Items' },
    { table: 'warehouse_bin_items', column: 'item_id', label: 'Warehouse Bin Items' },
    { table: 'issue_target_products', column: 'item_id', label: 'Issue Target Products' },
    { table: 'factory_production', column: 'product_item_id', label: 'Factory Production (product)' },
  ];

  console.log(`\nDeleting related records...`);
  for (const op of deleteOps) {
    try {
      const { data, error } = await supabase
        .from(op.table)
        .delete()
        .in(op.column, itemIds)
        .select('id');
      
      if (error) {
        // Table might not exist or column doesn't exist — skip
        console.log(`  ⚠ ${op.label} (${op.table}): ${error.message}`);
      } else {
        console.log(`  ✓ ${op.label}: deleted ${data?.length || 0} records`);
      }
    } catch (e) {
      console.log(`  ⚠ ${op.label}: ${e.message}`);
    }
  }

  // Step 3: Delete the items themselves
  console.log(`\nDeleting ${itemIds.length} items...`);
  const { data: deletedItems, error: deleteError } = await supabase
    .from('items')
    .delete()
    .in('id', itemIds)
    .select('id, item_code');

  if (deleteError) {
    console.error('Failed to delete items:', deleteError.message);
    process.exit(1);
  }

  console.log(`✓ Deleted ${deletedItems?.length || 0} items:`);
  (deletedItems || []).forEach(i => console.log(`  - ${i.item_code}`));

  // Step 4: Log audit
  try {
    await supabase.from('audit_logs').insert([{
      action: 'BULK_DELETE_ITEMS',
      entity_type: 'item',
      new_value: JSON.stringify({ deleted_codes: ITEM_CODES, deleted_ids: itemIds }),
      created_at: new Date().toISOString()
    }]);
    console.log('\n✓ Audit log entry created.');
  } catch (e) {
    console.log('\n⚠ Could not create audit log:', e.message);
  }

  console.log('\n✅ Done! All items and their history have been deleted.');
}

main().catch(e => {
  console.error('Script failed:', e);
  process.exit(1);
});

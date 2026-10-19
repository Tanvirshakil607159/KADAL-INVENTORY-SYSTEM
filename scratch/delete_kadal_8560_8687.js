/**
 * Hard-delete items KADAL-8560 .. KADAL-8687 and every record that references them.
 *
 *   node scratch/delete_kadal_8560_8687.js            -> DRY RUN (report + JSON backup only)
 *   node scratch/delete_kadal_8560_8687.js --execute  -> actually delete
 */
const { createClient } = require('@supabase/supabase-js');
const path = require('path');
const fs = require('fs');

const EXECUTE = process.argv.includes('--execute');
const ITEM_CODES = [];
for (let n = 8560; n <= 8687; n++) ITEM_CODES.push(`KADAL-${n}`);

const USER_DATA = path.join(process.env.APPDATA || '', 'kadal-inventory');
const BACKUP_DIR = path.join(__dirname, 'backups');

function chunk(arr, size = 100) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

function resolveLocalDbPath() {
  let dbPath = path.join(USER_DATA, 'kadal.db');
  const cfgPath = path.join(USER_DATA, 'db-config.json');
  if (fs.existsSync(cfgPath)) {
    try {
      const cfg = JSON.parse(fs.readFileSync(cfgPath, 'utf8'));
      const custom = cfg.customDbPath || cfg.dbPath;
      if (custom && fs.existsSync(custom)) dbPath = custom;
    } catch (_) {}
  }
  return fs.existsSync(dbPath) ? dbPath : null;
}

async function getCreds(SQL) {
  let url = process.env.SUPABASE_URL, key = process.env.SUPABASE_KEY;
  const cfgPath = path.join(USER_DATA, 'db-config.json');
  if ((!url || !key) && fs.existsSync(cfgPath)) {
    try {
      const cfg = JSON.parse(fs.readFileSync(cfgPath, 'utf8'));
      url = url || cfg.supabaseUrl; key = key || cfg.supabaseKey;
    } catch (_) {}
  }
  const dbPath = resolveLocalDbPath();
  if ((!url || !key) && dbPath) {
    const db = new SQL.Database(fs.readFileSync(dbPath));
    const get = (k) => { const r = db.exec(`SELECT value FROM settings WHERE key='${k}'`); return r[0]?.values[0][0]; };
    url = url || get('supabase_url'); key = key || get('supabase_key');
    db.close();
  }
  return { url, key };
}

// Select rows from table where column IN ids (chunked). Returns [] if table/column missing.
async function selectIn(sb, table, column, ids, cols = '*') {
  const rows = [];
  for (const part of chunk(ids)) {
    const { data, error } = await sb.from(table).select(cols).in(column, part);
    if (error) return { rows: [], error: error.message };
    rows.push(...(data || []));
  }
  return { rows };
}

async function deleteIn(sb, table, column, ids) {
  let count = 0;
  for (const part of chunk(ids)) {
    const { data, error } = await sb.from(table).delete().in(column, part).select('id');
    if (error) throw new Error(`${table}: ${error.message}`);
    count += data?.length || 0;
  }
  return count;
}

async function main() {
  console.log(EXECUTE ? '=== EXECUTE MODE: records WILL be deleted ===' : '=== DRY RUN: nothing will be deleted ===');
  const SQL = await require('sql.js')();
  const { url, key } = await getCreds(SQL);
  if (!url || !key) { console.error('No Supabase credentials found.'); process.exit(1); }
  console.log('Supabase:', url);
  const sb = createClient(url, key, { auth: { persistSession: false } });

  // 1. Items
  const { rows: items, error: itemErr } = await selectIn(sb, 'items', 'item_code', ITEM_CODES);
  if (itemErr) { console.error('items lookup failed:', itemErr); process.exit(1); }
  const foundCodes = new Set(items.map(i => i.item_code));
  const missing = ITEM_CODES.filter(c => !foundCodes.has(c));
  console.log(`\nItems found: ${items.length}/${ITEM_CODES.length}` + (missing.length ? `  (missing: ${missing.join(', ')})` : ''));
  if (!items.length) { console.log('Nothing to do.'); return; }
  const itemIds = items.map(i => i.id);
  const sample = items.slice(0, 5).map(i => `${i.item_code} | ${i.name} | stock=${i.current_stock} | buyer=${i.buyer_name || ''}`);
  console.log('Sample:\n  ' + sample.join('\n  '));

  // 2. Related records
  const backup = { generated_at: new Date().toISOString(), item_codes: ITEM_CODES, items };
  const direct = [
    ['stock_transactions', 'item_id'],
    ['item_price_tiers', 'item_id'],
    ['warehouse_stock', 'item_id'],
    ['bin_stock', 'item_id'],
    ['challan_items', 'item_id'],
    ['issue_items', 'item_id'],
    ['requisition_items', 'item_id'],
    ['proforma_invoice_items', 'item_id'],
    ['factory_production', 'product_item_id'],
  ];
  console.log('\nRelated records:');
  for (const [table, col] of direct) {
    const { rows, error } = await selectIn(sb, table, col, itemIds);
    backup[table] = rows;
    console.log(`  ${table.padEnd(24)} ${error ? 'skip (' + error + ')' : rows.length}`);
  }
  // return_items hang off issue_items
  const issueItemIds = (backup.issue_items || []).map(r => r.id);
  if (issueItemIds.length) {
    const { rows, error } = await selectIn(sb, 'return_items', 'issue_item_id', issueItemIds);
    backup.return_items = rows;
    console.log(`  ${'return_items'.padEnd(24)} ${error ? 'skip (' + error + ')' : rows.length}`);
  }
  // issues whose produced_item_id points at these items (will be NULLed, not deleted)
  const { rows: prodIssues } = await selectIn(sb, 'issues', 'produced_item_id', itemIds, 'id, issue_id, produced_item_id, produced_item_ids');
  backup.issues_produced_ref = prodIssues;
  console.log(`  ${'issues.produced_item_id'.padEnd(24)} ${prodIssues.length} (will be set to NULL)`);

  // Parent documents affected
  const challanIds = [...new Set((backup.challan_items || []).map(r => r.challan_id))];
  const issueIds = [...new Set((backup.issue_items || []).map(r => r.issue_id))];
  const reqIds = [...new Set((backup.requisition_items || []).map(r => r.requisition_id))];
  if (challanIds.length) {
    const { rows } = await selectIn(sb, 'challans', 'id', challanIds, 'id, challan_number, status');
    console.log(`\n  Challans touched: ${rows.map(r => r.challan_number).join(', ')}`);
  }
  if (issueIds.length) {
    const { rows } = await selectIn(sb, 'issues', 'id', issueIds, 'id, issue_id');
    console.log(`  Issues touched: ${rows.map(r => r.issue_id).join(', ')}`);
  }
  if (reqIds.length) console.log(`  Requisitions touched (ids): ${reqIds.join(', ')}`);

  // Local SQLite
  const localPath = resolveLocalDbPath();
  let localCount = 0;
  if (localPath) {
    const db = new SQL.Database(fs.readFileSync(localPath));
    const inCodes = ITEM_CODES.map(c => `'${c}'`).join(',');
    localCount = db.exec(`SELECT COUNT(*) FROM items WHERE item_code IN (${inCodes})`)[0].values[0][0];
    db.close();
  }
  console.log(`\nLocal SQLite (${localPath || 'not found'}): ${localCount} matching items`);

  // Backup
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
  const backupFile = path.join(BACKUP_DIR, `kadal_8560_8687_${Date.now()}.json`);
  fs.writeFileSync(backupFile, JSON.stringify(backup, null, 2));
  console.log(`Backup written: ${backupFile}`);

  if (!EXECUTE) { console.log('\nDry run complete. Re-run with --execute to delete.'); return; }

  // 3. Delete (children first)
  console.log('\nDeleting...');
  if (backup.return_items?.length) console.log('  return_items:', await deleteIn(sb, 'return_items', 'id', backup.return_items.map(r => r.id)));
  if (prodIssues.length) {
    for (const part of chunk(prodIssues.map(r => r.id))) {
      const { error } = await sb.from('issues').update({ produced_item_id: null }).in('id', part);
      if (error) throw new Error('issues produced_item_id: ' + error.message);
    }
    console.log('  issues.produced_item_id nulled:', prodIssues.length);
  }
  for (const [table, col] of direct) {
    if (!backup[table]?.length) continue;
    console.log(`  ${table}:`, await deleteIn(sb, table, col, itemIds));
  }
  console.log('  items:', await deleteIn(sb, 'items', 'id', itemIds));

  // Local SQLite cleanup
  if (localPath && localCount) {
    const db = new SQL.Database(fs.readFileSync(localPath));
    const sub = `(SELECT id FROM items WHERE item_code IN (${ITEM_CODES.map(c => `'${c}'`).join(',')}))`;
    const stmts = [
      `DELETE FROM return_items WHERE issue_item_id IN (SELECT id FROM issue_items WHERE item_id IN ${sub})`,
      `UPDATE issues SET produced_item_id = NULL WHERE produced_item_id IN ${sub}`,
      ...direct.map(([t, c]) => `DELETE FROM ${t} WHERE ${c} IN ${sub}`),
      `DELETE FROM items WHERE id IN ${sub}`,
    ];
    for (const s of stmts) { try { db.run(s); } catch (_) { /* table may not exist locally */ } }
    fs.writeFileSync(localPath, Buffer.from(db.export()));
    db.close();
    console.log('  local SQLite cleaned');
  }

  await sb.from('audit_logs').insert([{
    action: 'BULK_DELETE_ITEMS', entity_type: 'item',
    new_value: JSON.stringify({ deleted_codes: items.map(i => i.item_code), deleted_ids: itemIds }),
    created_at: new Date().toISOString(),
  }]);
  console.log('\n✅ Done.');
}

main().catch(e => { console.error('FAILED:', e.message); process.exit(1); });

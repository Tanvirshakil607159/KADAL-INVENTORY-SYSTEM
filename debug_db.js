const { getDb, getSupabase, isCloudEnabled, initDatabase } = require('./src/main/database/connection');

async function debug() {
  await initDatabase();
  console.log('--- DEBUG START ---');
  console.log('Cloud Enabled:', isCloudEnabled());

  if (isCloudEnabled()) {
    const supabase = getSupabase();
    const { data: gps } = await supabase.from('gate_passes').select('gate_pass_number, challan_ids');
    console.log('Cloud Gate Passes:', gps);
    const { data: apps } = await supabase.from('approvals').select('type, status, data').eq('type', 'CREATE_GATE_PASS');
    console.log('Cloud Gate Pass Approvals:', apps);
  } else {
    const { dbPrepare } = require('./src/main/database/connection');
    const gps = dbPrepare('SELECT gate_pass_number, challan_ids FROM gate_passes').all();
    console.log('Local Gate Passes:', gps);
    const apps = dbPrepare("SELECT type, status, data FROM approvals WHERE type = 'CREATE_GATE_PASS'").all();
    console.log('Local Gate Pass Approvals:', apps);
  }
  console.log('--- DEBUG END ---');
}

debug().catch(console.error);

const { dbPrepare, saveDatabase, getSupabase, isCloudEnabled } = require('../connection');

const GLOBAL_KEYS = [
  'company_name', 'company_logo', 'company_address', 'company_phone', 'company_email',
  'challan_prefix', 'low_stock_threshold', 
  'require_challan_approval', 'require_inventory_approval', 'require_gate_pass_approval',
  'allow_challan_to_issue', 'allow_inventory_to_produce', 'public_web_url', 'barcode_format'
];

const SettingsRepo = {
  async getAll() {
    const localRows = dbPrepare('SELECT * FROM settings ORDER BY key').all();
    const map = {};
    localRows.forEach(r => { map[r.key] = r.value; });

    if (isCloudEnabled()) {
      try {
        const { data: cloudRows, error } = await getSupabase().from('settings').select('*');
        if (!error && cloudRows) {
          cloudRows.forEach(r => {
            if (GLOBAL_KEYS.includes(r.key)) {
              map[r.key] = r.value;
              // Sync to local for offline use
              this.setLocal(r.key, r.value);
            }
          });
        }
      } catch (e) {
        console.error('[SettingsRepo] Cloud fetch failed:', e.message);
      }
    }
    return map;
  },

  get(key) {
    const row = dbPrepare('SELECT value FROM settings WHERE key = ?').get(key);
    return row ? row.value : null;
  },

  async set(key, value) {
    this.setLocal(key, value);
    
    if (isCloudEnabled() && GLOBAL_KEYS.includes(key)) {
      try {
        const { error } = await getSupabase().from('settings').upsert({ key, value, updated_at: new Date().toISOString() });
        if (error) console.error('[SettingsRepo] Cloud update failed:', error.message);
      } catch (e) {
        console.error('[SettingsRepo] Cloud update failed:', e.message);
      }
    }
  },

  setLocal(key, value) {
    const exists = dbPrepare('SELECT id FROM settings WHERE key = ?').get(key);
    if (exists) {
      dbPrepare('UPDATE settings SET value = ?, updated_at = CURRENT_TIMESTAMP WHERE key = ?').run(value, key);
    } else {
      dbPrepare('INSERT INTO settings (key, value) VALUES (?, ?)').run(key, value);
    }
  },

  async setBulk(settings) {
    for (const [key, value] of Object.entries(settings)) {
      await this.set(key, value);
    }
  },
};
module.exports = SettingsRepo;

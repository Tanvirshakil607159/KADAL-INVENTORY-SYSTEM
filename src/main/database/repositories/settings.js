const { dbPrepare, saveDatabase } = require('../connection');

const SettingsRepo = {
  getAll() {
    const rows = dbPrepare('SELECT * FROM settings ORDER BY key').all();
    const map = {};
    rows.forEach(r => { map[r.key] = r.value; });
    return map;
  },
  get(key) {
    const row = dbPrepare('SELECT value FROM settings WHERE key = ?').get(key);
    return row ? row.value : null;
  },
  set(key, value) {
    const exists = dbPrepare('SELECT id FROM settings WHERE key = ?').get(key);
    if (exists) {
      dbPrepare('UPDATE settings SET value = ?, updated_at = CURRENT_TIMESTAMP WHERE key = ?').run(value, key);
    } else {
      dbPrepare('INSERT INTO settings (key, value) VALUES (?, ?)').run(key, value);
    }
  },
  setBulk(settings) {
    for (const [key, value] of Object.entries(settings)) {
      const exists = dbPrepare('SELECT id FROM settings WHERE key = ?').get(key);
      if (exists) {
        dbPrepare('UPDATE settings SET value = ?, updated_at = CURRENT_TIMESTAMP WHERE key = ?').run(value, key);
      } else {
        dbPrepare('INSERT INTO settings (key, value) VALUES (?, ?)').run(key, value);
      }
    }
  },
};
module.exports = SettingsRepo;

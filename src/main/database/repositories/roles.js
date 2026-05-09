const { dbPrepare, getSupabase, isCloudEnabled } = require('../connection');

const RolesRepo = {
  async getAll() {
    if (isCloudEnabled()) {
      const { data, error } = await getSupabase().from('roles').select('id, name, permissions').order('id', { ascending: true });
      if (error) throw error;
      return data;
    }
    return dbPrepare(`SELECT id, name, permissions FROM roles ORDER BY id ASC`).all();
  }
};

module.exports = RolesRepo;

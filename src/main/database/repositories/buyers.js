const { dbPrepare, getSupabase, isCloudEnabled } = require('../connection');

const BuyersRepo = {
  async getAll() {
    if (isCloudEnabled()) {
      const { data, error } = await getSupabase().from('buyers').select('*').order('name');
      if (error) throw error;
      return data;
    }
    return dbPrepare('SELECT * FROM buyers ORDER BY name').all();
  },
  async getById(id) { 
    if (isCloudEnabled()) {
      const { data, error } = await getSupabase().from('buyers').select('*').eq('id', id).single();
      if (error) throw error;
      return data;
    }
    return dbPrepare('SELECT * FROM buyers WHERE id = ?').get(id); 
  },
  async create({ name }) {
    if (isCloudEnabled()) {
      const { data, error } = await getSupabase().from('buyers').insert([{ name }]).select().single();
      if (error) throw error;
      return data.id;
    }
    return dbPrepare('INSERT INTO buyers (name) VALUES (?)').run(name).lastInsertRowid;
  },
  async delete(id) {
    if (isCloudEnabled()) {
      const { error } = await getSupabase().from('buyers').delete().eq('id', id);
      if (error) throw error;
      return true;
    }
    return dbPrepare('DELETE FROM buyers WHERE id = ?').run(id);
  },
};
module.exports = BuyersRepo;

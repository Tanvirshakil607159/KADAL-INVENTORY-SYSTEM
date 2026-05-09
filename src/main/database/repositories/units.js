const { dbPrepare, getSupabase, isCloudEnabled } = require('../connection');

const UnitsRepo = {
  async getAll(includeInactive = false) {
    if (isCloudEnabled()) {
      let query = getSupabase().from('units').select('*');
      if (!includeInactive) query = query.eq('is_active', true);
      const { data, error } = await query.order('name');
      if (error) throw error;
      return data;
    }
    const where = includeInactive ? '' : 'WHERE is_active = 1';
    return dbPrepare(`SELECT * FROM units ${where} ORDER BY name`).all();
  },
  async getById(id) { 
    if (isCloudEnabled()) {
      const { data, error } = await getSupabase().from('units').select('*').eq('id', id).single();
      if (error) throw error;
      return data;
    }
    return dbPrepare('SELECT * FROM units WHERE id = ?').get(id); 
  },
  async create({ name }) {
    if (isCloudEnabled()) {
      const { data, error } = await getSupabase().from('units').insert([{ name }]).select().single();
      if (error) throw error;
      return data.id;
    }
    return dbPrepare('INSERT INTO units (name) VALUES (?)').run(name).lastInsertRowid;
  },
  async update(id, { name }) {
    if (isCloudEnabled()) {
      const { error } = await getSupabase().from('units').update({ name }).eq('id', id);
      if (error) throw error;
      return true;
    }
    return dbPrepare('UPDATE units SET name = ? WHERE id = ?').run(name, id);
  },
  async delete(id) {
    if (isCloudEnabled()) {
      const { error } = await getSupabase().from('units').delete().eq('id', id);
      if (error) throw error;
      return true;
    }
    return dbPrepare('DELETE FROM units WHERE id = ?').run(id);
  },
};
module.exports = UnitsRepo;

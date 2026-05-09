const { dbPrepare, getSupabase, isCloudEnabled } = require('../connection');

const CategoriesRepo = {
  async getAll(includeInactive = false) {
    if (isCloudEnabled()) {
      let query = getSupabase().from('categories').select('*');
      if (!includeInactive) query = query.eq('is_active', true);
      const { data, error } = await query.order('name');
      if (error) throw error;
      return data;
    }
    const where = includeInactive ? '' : 'WHERE is_active = 1';
    return dbPrepare(`SELECT * FROM categories ${where} ORDER BY name`).all();
  },

  async getById(id) {
    if (isCloudEnabled()) {
      const { data, error } = await getSupabase().from('categories').select('*').eq('id', id).single();
      if (error) throw error;
      return data;
    }
    return dbPrepare('SELECT * FROM categories WHERE id = ?').get(id);
  },

  async create({ name, description }) {
    if (isCloudEnabled()) {
      const { data, error } = await getSupabase().from('categories').insert([{ name, description: description || null }]).select().single();
      if (error) throw error;
      return data.id;
    }
    return dbPrepare('INSERT INTO categories (name, description) VALUES (?, ?)').run(name, description || null).lastInsertRowid;
  },

  async update(id, { name, description }) {
    if (isCloudEnabled()) {
      const { error } = await getSupabase().from('categories').update({ name, description: description || null }).eq('id', id);
      if (error) throw error;
      return true;
    }
    return dbPrepare('UPDATE categories SET name = ?, description = ? WHERE id = ?').run(name, description || null, id);
  },

  async delete(id) {
    if (isCloudEnabled()) {
      await getSupabase().from('items').update({ category_id: null }).eq('category_id', id);
      const { error } = await getSupabase().from('categories').delete().eq('id', id);
      if (error) throw error;
      return true;
    }
    dbPrepare('UPDATE items SET category_id = NULL WHERE category_id = ?').run(id);
    return dbPrepare('DELETE FROM categories WHERE id = ?').run(id);
  },
};
module.exports = CategoriesRepo;

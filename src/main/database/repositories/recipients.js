const { dbPrepare, getSupabase, isCloudEnabled } = require('../connection');

const RecipientsRepo = {
  async getAll(filters = {}) {
    if (isCloudEnabled()) {
      const supabase = getSupabase();
      let query = supabase.from('recipients').select('*').eq('is_active', true).order('name');
      if (filters.type) query = query.eq('type', filters.type);
      const { data, error } = await query;
      if (error) throw error;
      return data;
    }
    let where = ['is_active = 1'];
    let params = [];
    if (filters.type) { where.push('type = ?'); params.push(filters.type); }
    return dbPrepare(`SELECT * FROM recipients WHERE ${where.join(' AND ')} ORDER BY name`).all(...params);
  },

  async getById(id) {
    if (isCloudEnabled()) {
      const { data, error } = await getSupabase().from('recipients').select('*').eq('id', id).single();
      if (error) throw error;
      return data;
    }
    return dbPrepare('SELECT * FROM recipients WHERE id = ?').get(id);
  },

  async create({ name, type, contactInfo }) {
    if (isCloudEnabled()) {
      const { data, error } = await getSupabase().from('recipients')
        .insert([{ name, type, contact_info: contactInfo || null }]).select().single();
      if (error) throw error;
      return data.id;
    }
    return dbPrepare('INSERT INTO recipients (name, type, contact_info) VALUES (?, ?, ?)').run(name, type, contactInfo || null).lastInsertRowid;
  },

  async update(id, { name, type, contactInfo }) {
    if (isCloudEnabled()) {
      const { error } = await getSupabase().from('recipients')
        .update({ name, type, contact_info: contactInfo || null }).eq('id', id);
      if (error) throw error;
      return true;
    }
    return dbPrepare('UPDATE recipients SET name = ?, type = ?, contact_info = ? WHERE id = ?').run(name, type, contactInfo || null, id);
  },

  async delete(id) {
    if (isCloudEnabled()) {
      const { error } = await getSupabase().from('recipients').update({ is_active: false }).eq('id', id);
      if (error) throw error;
      return true;
    }
    return dbPrepare('UPDATE recipients SET is_active = 0 WHERE id = ?').run(id);
  },
};

module.exports = RecipientsRepo;

const { dbPrepare, getSupabase, isCloudEnabled } = require('../connection');
const { normalizeBuyerName } = require('../../utils/buyer-normalizer');

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
    // Normalize buyer name to canonical format (UPPERCASE)
    const normalized = normalizeBuyerName(name) || name;
    
    // Check if buyer already exists (case-insensitive) to prevent duplicates
    const existing = await this.getAll();
    const duplicate = existing.find(b => b.name.toUpperCase() === normalized.toUpperCase());
    if (duplicate) return duplicate.id;
    
    if (isCloudEnabled()) {
      const { data, error } = await getSupabase().from('buyers').insert([{ name: normalized }]).select().single();
      if (error) throw error;
      return data.id;
    }
    return dbPrepare('INSERT INTO buyers (name) VALUES (?)').run(normalized).lastInsertRowid;
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

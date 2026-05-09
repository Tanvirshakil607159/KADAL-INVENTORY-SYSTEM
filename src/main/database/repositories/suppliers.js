const { dbPrepare, getSupabase, isCloudEnabled } = require('../connection');

const SuppliersRepo = {
  async getAll(includeInactive = false) {
    if (isCloudEnabled()) {
      let query = getSupabase().from('suppliers').select('*');
      if (!includeInactive) query = query.eq('is_active', true);
      const { data, error } = await query.order('name');
      if (error) throw error;
      return data;
    }
    const where = includeInactive ? '' : 'WHERE is_active = 1';
    return dbPrepare(`SELECT * FROM suppliers ${where} ORDER BY name`).all();
  },

  async getById(id) {
    if (isCloudEnabled()) {
      const { data, error } = await getSupabase().from('suppliers').select('*').eq('id', id).single();
      if (error) throw error;
      return data;
    }
    return dbPrepare('SELECT * FROM suppliers WHERE id = ?').get(id);
  },

  async create({ name, contactPerson, phone, email, address }) {
    if (isCloudEnabled()) {
      const { data, error } = await getSupabase().from('suppliers').insert([{
        name, 
        contact_person: contactPerson || null, 
        phone: phone || null, 
        email: email || null, 
        address: address || null
      }]).select().single();
      if (error) throw error;
      return data.id;
    }
    return dbPrepare('INSERT INTO suppliers (name, contact_person, phone, email, address) VALUES (?, ?, ?, ?, ?)').run(name, contactPerson||null, phone||null, email||null, address||null).lastInsertRowid;
  },

  async update(id, { name, contactPerson, phone, email, address }) {
    if (isCloudEnabled()) {
      const { error } = await getSupabase().from('suppliers').update({
        name, 
        contact_person: contactPerson || null, 
        phone: phone || null, 
        email: email || null, 
        address: address || null,
        updated_at: new Date().toISOString()
      }).eq('id', id);
      if (error) throw error;
      return true;
    }
    return dbPrepare('UPDATE suppliers SET name=?, contact_person=?, phone=?, email=?, address=?, updated_at=CURRENT_TIMESTAMP WHERE id=?').run(name, contactPerson||null, phone||null, email||null, address||null, id);
  },

  async delete(id) {
    if (isCloudEnabled()) {
      await getSupabase().from('items').update({ supplier_id: null }).eq('supplier_id', id);
      const { error } = await getSupabase().from('suppliers').delete().eq('id', id);
      if (error) throw error;
      return true;
    }
    dbPrepare('UPDATE items SET supplier_id = NULL WHERE supplier_id = ?').run(id);
    return dbPrepare('DELETE FROM suppliers WHERE id = ?').run(id);
  },

  async getFieldSuggestions(field, query = '') {
    if (isCloudEnabled()) {
      const validFields = { 'name': 'name', 'contactPerson': 'contact_person', 'phone': 'phone', 'email': 'email', 'address': 'address' };
      const dbField = validFields[field];
      if (!dbField) return [];
      const { data, error } = await getSupabase()
        .from('suppliers')
        .select(dbField)
        .ilike(dbField, `%${query}%`)
        .not(dbField, 'is', null)
        .neq(dbField, '')
        .limit(20);
      if (error) throw error;
      return [...new Set(data.map(r => r[dbField]))].sort();
    }
    const validFields = { 'name': 'name', 'contactPerson': 'contact_person', 'phone': 'phone', 'email': 'email', 'address': 'address' };
    const dbField = validFields[field];
    if (!dbField) return [];
    const q = `%${query}%`;
    return dbPrepare(`SELECT DISTINCT ${dbField} as value FROM suppliers WHERE ${dbField} LIKE ? AND ${dbField} IS NOT NULL AND TRIM(${dbField}) != '' ORDER BY ${dbField} ASC LIMIT 20`).all(q).map(r => r.value);
  },
};
module.exports = SuppliersRepo;

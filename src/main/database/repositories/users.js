const { dbPrepare, getSupabase, isCloudEnabled } = require('../connection');

const UsersRepo = {
  async getAll() {
    if (isCloudEnabled()) {
      const { data, error } = await getSupabase()
        .from('users')
        .select(`id, username, full_name, role_id, is_active, last_login, created_at, custom_permissions, roles (name)`)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data.map(u => ({ ...u, role_name: u.roles?.name }));
    }
    return dbPrepare(`SELECT u.id, u.username, u.full_name, u.role_id, r.name as role_name, u.custom_permissions, u.is_active, u.last_login, u.created_at FROM users u JOIN roles r ON u.role_id = r.id ORDER BY u.created_at DESC`).all();
  },

  async getById(id) {
    if (isCloudEnabled()) {
      const { data: user, error } = await getSupabase()
        .from('users')
        .select(`*, roles (name, permissions)`)
        .eq('id', id)
        .single();
      if (error) throw error;
      if (user) {
        user.role_name = user.roles?.name;
        user.permissions = user.custom_permissions || user.roles?.permissions;
      }
      return user;
    }
    const user = dbPrepare(`SELECT u.id, u.username, u.full_name, u.role_id, r.name as role_name, r.permissions, u.custom_permissions, u.is_active, u.last_login, u.created_at FROM users u JOIN roles r ON u.role_id = r.id WHERE u.id = ?`).get(id);
    if (user && user.custom_permissions) user.permissions = user.custom_permissions;
    return user;
  },

  async getByUsername(username) {
    if (isCloudEnabled()) {
      const { data: user, error } = await getSupabase()
        .from('users')
        .select(`*, roles (name, permissions)`)
        .eq('username', username)
        .eq('is_active', true)
        .maybeSingle();
      if (error) throw error;
      if (user) {
        user.role_name = user.roles?.name;
        user.permissions = user.custom_permissions || user.roles?.permissions;
      }
      return user;
    }
    const user = dbPrepare(`SELECT u.*, r.name as role_name, r.permissions FROM users u JOIN roles r ON u.role_id = r.id WHERE u.username = ? AND u.is_active = 1`).get(username);
    if (user && user.custom_permissions) user.permissions = user.custom_permissions;
    return user;
  },

  async create({ username, passwordHash, fullName, roleId, customPermissions }) {
    if (isCloudEnabled()) {
      const { data, error } = await getSupabase().from('users').insert([{
        username, password_hash: passwordHash, full_name: fullName, role_id: roleId, custom_permissions: customPermissions || null
      }]).select().single();
      if (error) throw error;
      return data.id;
    }
    return dbPrepare(`INSERT INTO users (username, password_hash, full_name, role_id, custom_permissions) VALUES (?, ?, ?, ?, ?)`).run(username, passwordHash, fullName, roleId, customPermissions || null).lastInsertRowid;
  },

  async update(id, { fullName, roleId, customPermissions }) {
    if (isCloudEnabled()) {
      const { error } = await getSupabase().from('users').update({
        full_name: fullName, role_id: roleId, custom_permissions: customPermissions || null, updated_at: new Date().toISOString()
      }).eq('id', id);
      if (error) throw error;
      return true;
    }
    return dbPrepare(`UPDATE users SET full_name = ?, role_id = ?, custom_permissions = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`).run(fullName, roleId, customPermissions || null, id);
  },

  async updatePassword(id, passwordHash) {
    if (isCloudEnabled()) {
      const { error } = await getSupabase().from('users').update({ password_hash: passwordHash, updated_at: new Date().toISOString() }).eq('id', id);
      if (error) throw error;
      return true;
    }
    return dbPrepare(`UPDATE users SET password_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`).run(passwordHash, id);
  },

  async toggleActive(id) {
    if (isCloudEnabled()) {
      const { data: user } = await getSupabase().from('users').select('is_active').eq('id', id).single();
      const { error } = await getSupabase().from('users').update({ is_active: !user.is_active, updated_at: new Date().toISOString() }).eq('id', id);
      if (error) throw error;
      return true;
    }
    return dbPrepare(`UPDATE users SET is_active = CASE WHEN is_active = 1 THEN 0 ELSE 1 END, updated_at = CURRENT_TIMESTAMP WHERE id = ?`).run(id);
  },

  async updateLastLogin(id) {
    if (isCloudEnabled()) {
      const { error } = await getSupabase().from('users').update({ last_login: new Date().toISOString() }).eq('id', id);
      if (error) throw error;
      return true;
    }
    return dbPrepare(`UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?`).run(id);
  },

  async delete(id) {
    if (isCloudEnabled()) {
      const { error } = await getSupabase().from('users').delete().eq('id', id);
      if (error) throw error;
      return true;
    }
    return dbPrepare(`DELETE FROM users WHERE id = ?`).run(id);
  },
};
module.exports = UsersRepo;

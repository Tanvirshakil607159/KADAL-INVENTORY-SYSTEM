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

  async getByUsername(username, activeOnly = true) {
    if (isCloudEnabled()) {
      let query = getSupabase()
        .from('users')
        .select(`*, roles (name, permissions)`)
        .eq('username', username);
      
      if (activeOnly) query = query.eq('is_active', true);
      
      const { data: user, error } = await query.maybeSingle();
      if (error) throw error;
      if (user) {
        user.role_name = user.roles?.name;
        user.permissions = user.custom_permissions || user.roles?.permissions;
      }
      return user;
    }
    const filter = activeOnly ? 'AND u.is_active = 1' : '';
    const user = dbPrepare(`SELECT u.*, r.name as role_name, r.permissions FROM users u LEFT JOIN roles r ON u.role_id = r.id WHERE u.username = ? ${filter}`).get(username);
    if (user && user.custom_permissions) user.permissions = user.custom_permissions;
    return user;
  },

  async create({ username, passwordHash, fullName, roleId, customPermissions, isActive = 1 }) {
    if (isCloudEnabled()) {
      const { data, error } = await getSupabase().from('users').insert([{
        username, password_hash: passwordHash, full_name: fullName, role_id: roleId, custom_permissions: customPermissions || null, is_active: isActive
      }]).select().single();
      if (error) throw error;
      return data.id;
    }
    return dbPrepare(`INSERT INTO users (username, password_hash, full_name, role_id, custom_permissions, is_active) VALUES (?, ?, ?, ?, ?, ?)`).run(username, passwordHash, fullName, roleId, customPermissions || null, isActive).lastInsertRowid;
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
    // Safety: Protect the default admin user from being deactivated
    const userToToggle = await this.getById(id);
    if (userToToggle?.username === 'admin') {
      throw new Error('The default admin user cannot be deactivated.');
    }

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
    // Safety: Protect the default admin user from being deleted
    const userToDelete = await this.getById(id);
    if (userToDelete?.username === 'admin') {
      throw new Error('The default admin user cannot be deleted to prevent system lockout.');
    }

    try {
      if (isCloudEnabled()) {
        const { error } = await getSupabase().from('users').delete().eq('id', id);
        if (error) throw error;
        return true;
      }
      return dbPrepare(`DELETE FROM users WHERE id = ?`).run(id);
    } catch (err) {
      if (err.message.includes('foreign key constraint') || err.code === '23503' || err.message.includes('REFERENCE constraint')) {
        throw new Error('This user has history records (Audit Logs, Challans, or Transactions) and cannot be deleted. Please deactivate the user instead to preserve system integrity.');
      }
      throw err;
    }
  },
};
module.exports = UsersRepo;

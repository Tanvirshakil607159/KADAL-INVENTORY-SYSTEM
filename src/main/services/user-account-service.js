// User management (Settings > Users). In cloud mode with supabase_security_lockdown.sql applied,
// accounts are created/changed by server-side functions that check the admin's session; the
// password is hashed inside the database. Otherwise the previous direct writes are used.
const bcrypt = require('bcryptjs');
const UsersRepo = require('../database/repositories/users');
const AuditLogsRepo = require('../database/repositories/audit-logs');
const AccountRpc = require('../database/repositories/account-rpc');
const AuthService = require('./auth-service');

function token() {
  return AuthService.getCurrentUser()?.sessionToken || null;
}

const UserAccountService = {
  async createUser(data) {
    if (!data.username || !data.password) throw new Error('Username and password are required');
    let id;
    if (token()) {
      id = await AccountRpc.saveUser(token(), {
        username: data.username, password: data.password, fullName: data.fullName,
        roleId: data.roleId, customPermissions: data.customPermissions, isActive: true,
      });
    }
    if (id === undefined || id === null) {
      id = await UsersRepo.create({
        username: data.username,
        passwordHash: bcrypt.hashSync(data.password, 10),
        fullName: data.fullName,
        roleId: data.roleId,
        customPermissions: data.customPermissions,
      });
    }
    const user = AuthService.getCurrentUser();
    await AuditLogsRepo.create({
      userId: user?.id, action: 'CREATE', entityType: 'user', entityId: id,
      newValue: { username: data.username, fullName: data.fullName },
    });
    return { id };
  },

  async updateUser(id, data) {
    if (token()) {
      const done = await AccountRpc.saveUser(token(), {
        id, password: data.password, fullName: data.fullName, roleId: data.roleId,
        customPermissions: data.customPermissions === undefined ? undefined : (data.customPermissions || ''),
      });
      if (done !== undefined) return { success: true };
    }
    await UsersRepo.update(id, { fullName: data.fullName, roleId: data.roleId, customPermissions: data.customPermissions });
    if (data.password) await UsersRepo.updatePassword(id, bcrypt.hashSync(data.password, 10));
    return { success: true };
  },

  async toggleActive(id) {
    if (token()) {
      const target = await UsersRepo.getById(id);
      if (!target) throw new Error('User not found');
      const done = await AccountRpc.saveUser(token(), { id, isActive: !target.is_active });
      if (done !== undefined) return { success: true };
    }
    await UsersRepo.toggleActive(id);
    return { success: true };
  },

  async deleteUser(id) {
    if (token()) {
      const done = await AccountRpc.deleteUser(token(), id);
      if (done !== undefined) return { success: true };
    }
    await UsersRepo.delete(id);
    return { success: true };
  },
};

module.exports = UserAccountService;

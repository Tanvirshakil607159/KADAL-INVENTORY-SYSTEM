const bcrypt = require('bcryptjs');
const UsersRepo = require('../database/repositories/users');
const AuditLogsRepo = require('../database/repositories/audit-logs');
const AccountRpc = require('../database/repositories/account-rpc');

let currentUser = null;

function parsePermissions(p) {
  if (!p) return {};
  if (typeof p !== 'string') return p;
  try {
    const parsed = JSON.parse(p);
    return typeof parsed === 'string' ? JSON.parse(parsed) : (parsed || {});
  } catch (e) {
    return {};
  }
}

const AuthService = {
  async login(username, password) {
    // Cloud with the lockdown installed: the password is checked inside the database and
    // the hash never leaves it. Falls through to the old check on databases without it.
    let rpcUser;
    try {
      rpcUser = await AccountRpc.login(username, password);
    } catch (err) {
      return { success: false, error: err.message || 'Invalid username or password' };
    }
    if (rpcUser) {
      currentUser = {
        id: rpcUser.id, username: rpcUser.username, fullName: rpcUser.full_name,
        roleId: rpcUser.role_id, roleName: rpcUser.role_name, role_name: rpcUser.role_name,
        permissions: parsePermissions(rpcUser.permissions),
        sessionToken: rpcUser.token,
      };
      await AuditLogsRepo.create({ userId: rpcUser.id, action: 'LOGIN', entityType: 'user', entityId: rpcUser.id });
      return { success: true, user: currentUser };
    }

    const user = await UsersRepo.getByUsername(username);
    if (!user) return { success: false, error: 'Invalid username or password' };
    if (!user.is_active) return { success: false, error: 'Account is deactivated' };

    const valid = bcrypt.compareSync(password, user.password_hash);
    if (!valid) return { success: false, error: 'Invalid username or password' };

    await UsersRepo.updateLastLogin(user.id);
    await AuditLogsRepo.create({ userId: user.id, action: 'LOGIN', entityType: 'user', entityId: user.id });

    currentUser = {
      id: user.id, username: user.username, fullName: user.full_name,
      roleId: user.role_id, roleName: user.role_name, role_name: user.role_name,
      permissions: parsePermissions(user.permissions),
    };
    return { success: true, user: currentUser };
  },
  
  async register(username, password, fullName) {
    if (!username || !password || !fullName) return { success: false, error: 'All fields are required' };
    if (password.length < 4) return { success: false, error: 'Password must be at least 4 characters' };

    try {
      const viaRpc = await AccountRpc.register(username, password, fullName);
      if (viaRpc !== undefined) return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
    
    const existing = await UsersRepo.getByUsername(username, false);
    if (existing) return { success: false, error: 'Username already taken' };

    const hash = bcrypt.hashSync(password, 10);
    // New accounts start inactive with the Operator role (looked up by name, not by position)
    const RolesRepo = require('../database/repositories/roles');
    const roles = await RolesRepo.getAll();
    const operator = (roles || []).find(r => r.name === 'Operator');
    if (!operator) return { success: false, error: 'Operator role not found. Please ask an administrator to create your account.' };
    const userId = await UsersRepo.create({ 
      username, 
      passwordHash: hash, 
      fullName, 
      roleId: operator.id, 
      isActive: 0 
    });
    
    await AuditLogsRepo.create({ userId, action: 'REGISTER', entityType: 'user', entityId: userId });
    
    return { success: true };
  },

  logout() {
    if (currentUser) AuditLogsRepo.create({ userId: currentUser.id, action: 'LOGOUT', entityType: 'user', entityId: currentUser.id });
    if (currentUser?.sessionToken) AccountRpc.logout(currentUser.sessionToken).catch(() => {});
    currentUser = null;
    return { success: true };
  },

  getCurrentUser() { return currentUser; },

  // Called by the window after a reload. The role and permissions are re-read from the database:
  // the object sent by the window is only trusted for *which* user it is, never for what they may do.
  async syncSession(user) {
    if (!user?.id) throw new Error('No session to restore');
    if (currentUser && currentUser.id === user.id) return { success: true };
    const dbUser = await UsersRepo.getById(user.id);
    if (!dbUser || !dbUser.is_active) throw new Error('Session is no longer valid. Please log in again.');
    currentUser = {
      id: dbUser.id, username: dbUser.username, fullName: dbUser.full_name,
      roleId: dbUser.role_id, roleName: dbUser.role_name, role_name: dbUser.role_name,
      permissions: parsePermissions(dbUser.permissions),
      sessionToken: user.sessionToken,
    };
    return { success: true };
  },

  async changePassword(userId, oldPassword, newPassword) {
    if (currentUser?.sessionToken && Number(currentUser.id) === Number(userId)) {
      try {
        const viaRpc = await AccountRpc.changePassword(currentUser.sessionToken, oldPassword, newPassword);
        if (viaRpc !== undefined) return { success: true };
      } catch (err) {
        return { success: false, error: err.message };
      }
    }
    const storedHash = await UsersRepo.getPasswordHash(userId);
    if (!storedHash) return { success: false, error: 'User not found' };
    if (!bcrypt.compareSync(oldPassword, storedHash)) return { success: false, error: 'Current password is incorrect' };
    if (newPassword.length < 4) return { success: false, error: 'Password must be at least 4 characters' };
    const hash = bcrypt.hashSync(newPassword, 10);
    await UsersRepo.updatePassword(userId, hash);
    return { success: true };
  },

  hasPermission(module, level = 'r') {
    if (!currentUser) return false;
    const p = currentUser.permissions;
    if (currentUser.roleName === 'Super Admin') return true;
    if (!p[module]) return false;
    if (p[module] === true) return true;
    if (p[module] === 'rw') return true;
    return p[module] === 'r' && level === 'r';
  },
};
module.exports = AuthService;

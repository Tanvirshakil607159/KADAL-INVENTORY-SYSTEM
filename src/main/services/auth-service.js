const bcrypt = require('bcryptjs');
const UsersRepo = require('../database/repositories/users');
const AuditLogsRepo = require('../database/repositories/audit-logs');
const { dbPrepare } = require('../database/connection');

let currentUser = null;

const AuthService = {
  async login(username, password) {
    const user = await UsersRepo.getByUsername(username);
    if (!user) return { success: false, error: 'Invalid username or password' };
    if (!user.is_active) return { success: false, error: 'Account is deactivated' };

    const valid = bcrypt.compareSync(password, user.password_hash);
    if (!valid) return { success: false, error: 'Invalid username or password' };

    await UsersRepo.updateLastLogin(user.id);
    await AuditLogsRepo.create({ userId: user.id, action: 'LOGIN', entityType: 'user', entityId: user.id });

    currentUser = {
      id: user.id, username: user.username, fullName: user.full_name,
      roleId: user.role_id, roleName: user.role_name,
      permissions: typeof user.permissions === 'string' ? JSON.parse(user.permissions || '{}') : (user.permissions || {}),
    };
    return { success: true, user: currentUser };
  },
  
  async register(username, password, fullName) {
    if (!username || !password || !fullName) return { success: false, error: 'All fields are required' };
    if (password.length < 4) return { success: false, error: 'Password must be at least 4 characters' };
    
    const existing = await UsersRepo.getByUsername(username, false);
    if (existing) return { success: false, error: 'Username already taken' };

    const hash = bcrypt.hashSync(password, 10);
    // Role 2 is typically "Operator" or similar. Default to inactive (0).
    const userId = await UsersRepo.create({ 
      username, 
      passwordHash: hash, 
      fullName, 
      roleId: 2, 
      isActive: 0 
    });
    
    await AuditLogsRepo.create({ userId, action: 'REGISTER', entityType: 'user', entityId: userId });
    
    return { success: true };
  },

  logout() {
    if (currentUser) AuditLogsRepo.create({ userId: currentUser.id, action: 'LOGOUT', entityType: 'user', entityId: currentUser.id });
    currentUser = null;
    return { success: true };
  },

  getCurrentUser() { return currentUser; },

  async changePassword(userId, oldPassword, newPassword) {
    const fullUser = await UsersRepo.getById(userId);
    if (!fullUser) return { success: false, error: 'User not found' };
    if (!bcrypt.compareSync(oldPassword, fullUser.password_hash)) return { success: false, error: 'Current password is incorrect' };
    if (newPassword.length < 4) return { success: false, error: 'Password must be at least 4 characters' };
    const hash = bcrypt.hashSync(newPassword, 10);
    await UsersRepo.updatePassword(userId, hash);
    return { success: true };
  },

  hasPermission(module, level = 'r') {
    if (!currentUser) return false;
    const p = currentUser.permissions;
    if (!p[module]) return false;
    if (p[module] === 'rw') return true;
    return p[module] === 'r' && level === 'r';
  },
};
module.exports = AuthService;

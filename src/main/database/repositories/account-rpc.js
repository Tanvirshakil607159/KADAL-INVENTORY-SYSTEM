// Server-side account functions installed by supabase_security_lockdown.sql.
// Each helper returns `undefined` when the function is not installed yet (older database),
// so callers can fall back to the previous behaviour; any other error is thrown.
const { getSupabase, isCloudEnabled } = require('../connection');

function isMissingRpc(error) {
  if (!error) return false;
  return error.code === 'PGRST202' || error.code === '42883' || /could not find the function/i.test(error.message || '');
}

async function call(name, params) {
  if (!isCloudEnabled()) return undefined;
  const { data, error } = await getSupabase().rpc(name, params);
  if (isMissingRpc(error)) return undefined;
  if (error) throw new Error(error.message || `${name} failed`);
  return data;
}

module.exports = {
  isMissingRpc,
  login: (username, password) => call('kadal_login', { p_username: username, p_password: password }),
  logout: (token) => call('kadal_logout', { p_token: token }),
  changePassword: (token, oldPw, newPw) => call('kadal_change_password', { p_token: token, p_old: oldPw, p_new: newPw }),
  saveUser: (token, u) => call('kadal_save_user', {
    p_token: token, p_id: u.id ?? null, p_username: u.username ?? null, p_password: u.password || null,
    p_full_name: u.fullName ?? null, p_role_id: u.roleId ?? null,
    p_custom_permissions: u.customPermissions === undefined ? null : (u.customPermissions || ''),
    p_is_active: u.isActive === undefined ? null : !!u.isActive,
  }),
  deleteUser: (token, id) => call('kadal_delete_user', { p_token: token, p_id: id }),
  register: (username, password, fullName) => call('kadal_register', { p_username: username, p_password: password, p_full_name: fullName }),
};

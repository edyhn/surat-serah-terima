// RBAC untuk endpoint Asset: object-level authorization.
// Model scope: ownership, PIC, lokasi, status profil (active/inactive/tombstone).
// Default fail-closed: inactive/tombstone ditolak aksesnya.

const ROLE_OPERATIONS = {
  viewer: ['read'],
  pic: ['read', 'create', 'update', 'transition'],
  admin: ['read', 'create', 'update', 'delete', 'transition', 'admin'],
};

const OPERATION_ALIAS = {
  list: 'read',
  detail: 'read',
  create: 'create',
  update: 'update',
  delete: 'delete',
  lifecycle: 'transition',
  status: 'transition',
  history: 'read',
};

function isAllowedRole(role, operation) {
  const op = OPERATION_ALIAS[operation] || operation;
  return (ROLE_OPERATIONS[role] || []).includes(op);
}

function isProfileActive(aset) {
  if (!aset) return false;
  if (aset.status === 'inactive' || aset.status === 'tombstone') return false;
  if (aset.banned_at) return false;
  return true;
}

function canAccessObject(user, aset) {
  if (!user || !user.active) return false;
  if (!aset) return user.role === 'admin' || user.role === 'viewer';
  if (!isProfileActive(aset)) return false;
  if (user.role === 'admin') return true;
  if (aset.owner_id && String(aset.owner_id) === String(user.userId)) return true;
  if (Array.isArray(aset.pic_ids) && aset.pic_ids.some((p) => String(p) === String(user.userId))) return true;
  if (user.role === 'pic') {
    return (Array.isArray(aset.pic_ids) && aset.pic_ids.some((p) => String(p) === String(user.userId)));
  }
  if (user.role === 'viewer') return true;
  return false;
}

function filterByScope(user, daftar) {
  if (!user) return [];
  if (user.role === 'admin') return daftar.filter((a) => isProfileActive(a));
  if (user.role === 'viewer') return daftar.filter((a) => isProfileActive(a));
  return daftar.filter((a) => canAccessObject(user, a));
}

module.exports = { isAllowedRole, canAccessObject, filterByScope, ROLE_OPERATIONS, isProfileActive };

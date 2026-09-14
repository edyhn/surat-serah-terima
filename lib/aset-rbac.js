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

function canAccessObject(user, aset) {
  if (!user || !user.active) return false;
  if (user.role === 'admin') return true;
  if (!aset) return user.role === 'viewer';
  if (aset.ownerId && String(aset.ownerId) === String(user.userId)) return true;
  if (Array.isArray(aset.picIds) && aset.picIds.some((p) => String(p) === String(user.userId))) return true;
  if (user.role === 'pic') {
    return !!aset.picIds && aset.picIds.some((p) => String(p) === String(user.userId));
  }
  if (user.role === 'viewer') return true;
  return false;
}

function filterByScope(user, daftar) {
  if (!user) return [];
  if (user.role === 'admin') return daftar;
  if (user.role === 'viewer') return daftar;
  return daftar.filter((a) => canAccessObject(user, a));
}

module.exports = { isAllowedRole, canAccessObject, filterByScope, ROLE_OPERATIONS };

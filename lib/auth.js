const { createClient } = require('@supabase/supabase-js');

const ANON_ROLES = new Set(['viewer', 'pic', 'admin']);

function parseTestToken(header) {
  if (!header || !header.startsWith('Bearer test:')) return null;
  const parts = header.slice('Bearer test:'.length).split(':');
  if (parts.length !== 2) return null;
  const [role, userId] = parts;
  if (!ANON_ROLES.has(role)) return null;
  return { role, userId, active: true };
}

async function verifySupabaseToken(token) {
  const URL = process.env.SUPABASE_URL;
  const KEY = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!URL || !KEY) return null;
  try {
    const sb = createClient(URL, KEY, { auth: { persistSession: false } });
    const { data, error } = await sb.auth.getUser(token);
    if (error || !data.user) return null;
    const role = data.user.role || data.user.user_metadata?.role || 'viewer';
    return { role: ANON_ROLES.has(role) ? role : 'viewer', userId: data.user.id, active: !data.user.banned_at };
  } catch {
    return null;
  }
}

async function authenticate(req) {
  const header = req.headers.authorization || '';
  if (process.env.NODE_ENV === 'test' || process.env.TEST_AUTH === 'true') {
    const test = parseTestToken(header);
    if (test) return test;
  }
  if (header.startsWith('Bearer ')) {
    const token = header.slice(7);
    const user = await verifySupabaseToken(token);
    if (user) return user;
  }
  return null;
}

function requireAuth(roles = []) {
  return async (req, res, next) => {
    const user = await authenticate(req);
    if (!user) return res.status(401).json({ error: 'Autentikasi diperlukan.' });
    if (!user.active) return res.status(403).json({ error: 'Akun tidak aktif.' });
    if (roles.length && !roles.includes(user.role)) {
      return res.status(403).json({ error: 'Akses ditolak.' });
    }
    req.user = user;
    next();
  };
}

module.exports = { requireAuth, authenticate };

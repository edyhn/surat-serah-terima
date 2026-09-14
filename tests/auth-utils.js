const { decodeJWT } = require('@supabase/auth-js/dist/main/lib/helpers.js');

const HEADER = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url');

function makeToken(claims = {}) {
  const payload = { ...claims, exp: Math.floor(Date.now() / 1000) + 3600 };
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return `${HEADER}.${body}.sig`;
}

function expiredToken(claims = {}) {
  const payload = { ...claims, exp: Math.floor(Date.now() / 1000) - 3600 };
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return `${HEADER}.${body}.sig`;
}

function malformedToken() {
  return 'not-a-valid-jwt-token';
}

module.exports = { makeToken, expiredToken, malformedToken };

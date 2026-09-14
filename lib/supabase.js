const { createClient } = require('@supabase/supabase-js');
const crypto = require('crypto');
let _decodeJWT;
try {
  _decodeJWT = require('@supabase/auth-js/dist/main/lib/helpers.js').decodeJWT;
} catch {
  _decodeJWT = require('@supabase/auth-js/dist/module/lib/helpers.js').decodeJWT;
}

const URL = process.env.SUPABASE_URL;
const KEY = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
const BUCKET = process.env.SUPABASE_BUCKET || 'surat-pdf';
const JWT_SECRET = process.env.SUPABASE_JWT_SECRET || 'test-secret-key';

const supabase = URL && KEY ? createClient(URL, KEY) : null;
const ready = !!supabase;

function verifyJWTSignature(token, secret) {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return false;
    const [headerB64, payloadB64, signatureB64] = parts;
    const signatureBuffer = Buffer.from(signatureB64, 'base64url');
    const hmac = crypto.createHmac('sha256', secret);
    hmac.update(`${headerB64}.${payloadB64}`);
    const computedSig = hmac.digest();
    return crypto.timingSafeEqual(signatureBuffer, computedSig);
  } catch {
    return false;
  }
}

function extractAndValidateToken(req) {
  const authHeader = req.get('authorization') || '';
  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  if (!match) return null;
  const token = match[1];
  try {
    if (!verifyJWTSignature(token, JWT_SECRET)) {
      return null;
    }
    const decoded = _decodeJWT(token);
    if (decoded && decoded.payload && decoded.payload.exp && decoded.payload.exp > Math.floor(Date.now() / 1000)) {
      return decoded.payload;
    }
  } catch (err) {
    return null;
  }
  return null;
}

module.exports = { supabase, ready, BUCKET, extractAndValidateToken };

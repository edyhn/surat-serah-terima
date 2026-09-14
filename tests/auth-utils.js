const crypto = require('crypto');

const TEST_SECRET = 'test-secret-key';

function makeToken(claims = {}) {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const payload = { ...claims, exp: Math.floor(Date.now() / 1000) + 3600 };
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const hmac = crypto.createHmac('sha256', TEST_SECRET);
  hmac.update(`${header}.${body}`);
  const sig = hmac.digest('base64url');
  return `${header}.${body}.${sig}`;
}

function expiredToken(claims = {}) {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const payload = { ...claims, exp: Math.floor(Date.now() / 1000) - 3600 };
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const hmac = crypto.createHmac('sha256', TEST_SECRET);
  hmac.update(`${header}.${body}`);
  const sig = hmac.digest('base64url');
  return `${header}.${body}.${sig}`;
}

function forgedToken(claims = {}) {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const payload = { ...claims, exp: Math.floor(Date.now() / 1000) + 3600 };
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const wrongHmac = crypto.createHmac('sha256', 'wrong-secret');
  wrongHmac.update(`${header}.${body}`);
  const sig = wrongHmac.digest('base64url');
  return `${header}.${body}.${sig}`;
}

function malformedToken() {
  return 'not-a-valid-jwt-token';
}

module.exports = { makeToken, expiredToken, forgedToken, malformedToken, TEST_SECRET };

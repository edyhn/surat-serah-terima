const { test } = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { makeToken, expiredToken, forgedToken, malformedToken } = require('./auth-utils');

const PORT = 3399;
const BASE = `http://localhost:${PORT}`;
const tmp = path.join(os.tmpdir(), 'ssterima-auth-test');

function nyalakan() {
  return new Promise((resolve, reject) => {
    fs.rmSync(tmp, { recursive: true, force: true });
    const child = spawn(process.execPath, ['server.js'], {
      cwd: path.join(__dirname, '..'),
      env: {
        ...process.env,
        PORT: String(PORT),
        EXCEL_FILE: path.join(tmp, 'riwayat.xlsx'),
        PDF_DIR: path.join(tmp, 'pdf'),
        NOMOR_FILE: path.join(tmp, 'nomor.json'),
        ASET_FILE: path.join(tmp, 'aset.json'),
        SURAT_ASET_FILE: path.join(tmp, 'surat_aset.json'),
        SUPABASE_JWT_SECRET: 'test-secret-key',
      },
      stdio: 'ignore',
    });
    const awal = Date.now();
    const cek = setInterval(async () => {
      try {
        const r = await fetch(`${BASE}/api/config`);
        if (r.ok) {
          clearInterval(cek);
          resolve(child);
          return;
        }
      } catch {
      }
      if (Date.now() - awal > 10000) {
        clearInterval(cek);
        child.kill();
        reject(new Error('Server tidak bisa dinyalakan untuk tes.'));
      }
    }, 300);
  });
}

async function json(method, url, token) {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(BASE + url, {
    method,
    headers,
  });
  return { status: res.status, data: await res.json().catch(() => ({})) };
}

test('auth: aset tanpa token → 401', async () => {
  const child = await nyalakan();
  try {
    const res = await json('GET', '/api/aset', null);
    assert.equal(res.status, 401);
    assert.ok(res.data.error);
  } finally {
    child.kill();
  }
});

test('auth: aset dengan token expired → 401', async () => {
  const child = await nyalakan();
  try {
    const res = await json('GET', '/api/aset', expiredToken({ role: 'admin' }));
    assert.equal(res.status, 401);
    assert.ok(res.data.error);
  } finally {
    child.kill();
  }
});

test('auth: aset dengan token forged (signature salah) → 401', async () => {
  const child = await nyalakan();
  try {
    const res = await json('GET', '/api/aset', forgedToken({ role: 'admin' }));
    assert.equal(res.status, 401);
    assert.ok(res.data.error);
  } finally {
    child.kill();
  }
});

test('auth: aset dengan token malformed → 401', async () => {
  const child = await nyalakan();
  try {
    const res = await json('GET', '/api/aset', malformedToken());
    assert.equal(res.status, 401);
    assert.ok(res.data.error);
  } finally {
    child.kill();
  }
});

test('auth: POST aset tanpa token → 401', async () => {
  const child = await nyalakan();
  try {
    const res = await fetch(`${BASE}/api/aset`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nama: 'test' }),
    });
    const data = await res.json();
    assert.equal(res.status, 401);
    assert.ok(data.error);
  } finally {
    child.kill();
  }
});

test('auth: POST aset dengan role user (bukan admin) → 403', async () => {
  const child = await nyalakan();
  try {
    const token = makeToken({ sub: 'test-user', role: 'user' });
    const res = await fetch(`${BASE}/api/aset`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({ nama: 'test' }),
    });
    const data = await res.json();
    assert.equal(res.status, 403);
    assert.ok(data.error);
  } finally {
    child.kill();
  }
});

test('auth: DELETE aset tanpa token → 401', async () => {
  const child = await nyalakan();
  try {
    const res = await json('DELETE', '/api/aset/DUMMY', null);
    assert.equal(res.status, 401);
    assert.ok(res.data.error);
  } finally {
    child.kill();
  }
});

test('auth: config tanpa token → 200 (public)', async () => {
  const child = await nyalakan();
  try {
    const res = await json('GET', '/api/config', null);
    assert.equal(res.status, 200);
    assert.ok(res.data.kota);
  } finally {
    child.kill();
  }
});

test('auth: GET aset dengan token valid + admin → 200', async () => {
  const child = await nyalakan();
  try {
    const token = makeToken({ sub: 'test-user', role: 'admin' });
    const res = await json('GET', '/api/aset', token);
    assert.equal(res.status, 200);
    assert.ok(Array.isArray(res.data));
  } finally {
    child.kill();
  }
});

test('auth: GET aset dengan token valid + user → 200 (read allowed)', async () => {
  const child = await nyalakan();
  try {
    const token = makeToken({ sub: 'test-user', role: 'user' });
    const res = await json('GET', '/api/aset', token);
    assert.equal(res.status, 200);
    assert.ok(Array.isArray(res.data));
  } finally {
    child.kill();
  }
});

test('auth: trailing slash /api/aset/ + token valid → still protected', async () => {
  const child = await nyalakan();
  try {
    const res = await json('GET', '/api/aset/', null);
    assert.equal(res.status, 401);
  } finally {
    child.kill();
  }
});

test('auth: unsupported method PATCH /api/aset + token → 405 or no-match', async () => {
  const child = await nyalakan();
  try {
    const token = makeToken({ sub: 'test-user', role: 'admin' });
    const res = await fetch(`${BASE}/api/aset`, {
      method: 'PATCH',
      headers: { 'Authorization': `Bearer ${token}` },
    });
    assert.ok([404, 405].includes(res.status), `Expected 404/405, got ${res.status}`);
  } finally {
    child.kill();
  }
});

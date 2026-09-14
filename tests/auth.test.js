const { test } = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { makeToken, expiredToken, malformedToken } = require('./auth-utils');

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

test('auth: surat tanpa token → 401', async () => {
  const child = await nyalakan();
  try {
    const res = await json('GET', '/api/riwayat', null);
    assert.equal(res.status, 401);
    assert.ok(res.data.error);
  } finally {
    child.kill();
  }
});

test('auth: aset dengan token expired → 401', async () => {
  const child = await nyalakan();
  try {
    const res = await json('GET', '/api/aset', expiredToken());
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

test('auth: POST surat tanpa token → 401', async () => {
  const child = await nyalakan();
  try {
    const res = await fetch(`${BASE}/api/surat`, {
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

test('auth: aset dengan token valid → 200', async () => {
  const child = await nyalakan();
  try {
    const token = makeToken({ sub: 'test-user' });
    const res = await json('GET', '/api/aset', token);
    assert.equal(res.status, 200);
    assert.ok(Array.isArray(res.data));
  } finally {
    child.kill();
  }
});

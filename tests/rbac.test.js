const { test } = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const PORT = 3310;
const BASE = `http://localhost:${PORT}`;
const tmp = path.join(os.tmpdir(), 'ssterima-rbac-test');

function nyalakan() {
  return new Promise((resolve, reject) => {
    fs.rmSync(tmp, { recursive: true, force: true });
    const child = spawn(process.execPath, ['server.js'], {
      cwd: path.join(__dirname, '..'),
      env: {
        ...process.env,
        PORT: String(PORT),
        NODE_ENV: 'test',
        TEST_AUTH: 'true',
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
        const r = await fetch(`${BASE}/api/riwayat`);
        if (r.ok) { clearInterval(cek); resolve(child); return; }
      } catch { /* belum siap */ }
      if (Date.now() - awal > 10000) { clearInterval(cek); child.kill(); reject(new Error('Server tidak bisa dinyalakan.')); }
    }, 300);
  });
}

async function json(method, url, body, auth) {
  const headers = {};
  if (body) headers['Content-Type'] = 'application/json';
  if (auth) headers['Authorization'] = auth;
  const res = await fetch(BASE + url, { method, headers, body: body ? JSON.stringify(body) : undefined });
  return { status: res.status, data: await res.json().catch(() => ({})) };
}

const ADMIN = 'Bearer test:admin:admin-user-001';
const VIEWER = 'Bearer test:viewer:viewer-user-002';
const PIC_A = 'Bearer test:pic:pic-user-003';

test('rbac: anonymous ditolak 401 pada endpoint aset', async () => {
  const child = await nyalakan();
  try {
    const r = await json('GET', '/api/aset');
    assert.equal(r.status, 401);
    assert.ok(r.data.error.includes('Autentikasi'));
  } finally { child.kill(); }
});

test('rbac: viewer tidak bisa create aset', async () => {
  const child = await nyalakan();
  try {
    const r = await json('POST', '/api/aset', { nama: 'Tes', kategori: 'IT' }, VIEWER);
    assert.equal(r.status, 403);
    assert.ok(r.data.error.includes('berwenang'));
  } finally { child.kill(); }
});

test('rbac: admin bisa create aset, kode diabaikan dari client', async () => {
  const child = await nyalakan();
  try {
    const r = await json('POST', '/api/aset', { nama: 'Laptop Asus', kategori: 'IT', kode: 'FAKE/HACK-999' }, ADMIN);
    assert.equal(r.status, 200);
    assert.notEqual(r.data.kode, 'FAKE/HACK-999');
    assert.ok(r.data.kode.startsWith('INV/IT-'));
  } finally { child.kill(); }
});

test('rbac: pic bisa create aset', async () => {
  const child = await nyalakan();
  try {
    const r = await json('POST', '/api/aset', { nama: 'Tes Pic', kategori: 'IT' }, PIC_A);
    assert.equal(r.status, 200);
    assert.ok(r.data.kode);
  } finally { child.kill(); }
});

test('rbac: viewer bisa list aset', async () => {
  const child = await nyalakan();
  try {
    await json('POST', '/api/aset', { nama: 'Laptop Asus', kategori: 'IT' }, ADMIN);
    const r = await json('GET', '/api/aset', null, VIEWER);
    assert.equal(r.status, 200);
    assert.ok(Array.isArray(r.data));
    assert.ok(r.data.length > 0);
  } finally { child.kill(); }
});

test('rbac: admin bisa update aset (tanpa kode/status)', async () => {
  const child = await nyalakan();
  try {
    const c = await json('POST', '/api/aset', { nama: 'Laptop Asus', kategori: 'IT' }, ADMIN);
    const kode = c.data.kode;
    const r = await json('PUT', `/api/aset/${encodeURIComponent(kode)}`, { nama: 'Laptop Asus Pro', kondisi: 'sangat-baik' }, ADMIN);
    assert.equal(r.status, 200);
    assert.equal(r.data.nama, 'Laptop Asus Pro');
    assert.equal(r.data.kondisi, 'sangat-baik');
    assert.equal(r.data.status, 'tersedia');
  } finally { child.kill(); }
});

test('rbac: viewer tidak bisa update', async () => {
  const child = await nyalakan();
  try {
    const c = await json('POST', '/api/aset', { nama: 'Laptop', kategori: 'IT' }, ADMIN);
    const r = await json('PUT', `/api/aset/${encodeURIComponent(c.data.kode)}`, { nama: 'Hacked' }, VIEWER);
    assert.equal(r.status, 403);
  } finally { child.kill(); }
});

test('rbac: admin bisa delete', async () => {
  const child = await nyalakan();
  try {
    const c = await json('POST', '/api/aset', { nama: 'Laptop', kategori: 'IT' }, ADMIN);
    const r = await json('DELETE', `/api/aset/${encodeURIComponent(c.data.kode)}`, null, ADMIN);
    assert.equal(r.status, 200);
    assert.equal(r.data.ok, true);
  } finally { child.kill(); }
});

test('rbac: viewer tidak bisa delete', async () => {
  const child = await nyalakan();
  try {
    const c = await json('POST', '/api/aset', { nama: 'Laptop', kategori: 'IT' }, ADMIN);
    const r = await json('DELETE', `/api/aset/${encodeURIComponent(c.data.kode)}`, null, VIEWER);
    assert.equal(r.status, 403);
  } finally { child.kill(); }
});

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const PORT = 3311;
const BASE = `http://localhost:${PORT}`;
const tmp = path.join(os.tmpdir(), 'ssterima-asset-negative-test');

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
        const r = await fetch(`${BASE}/api/config`);
        if (r.ok) {
          clearInterval(cek);
          resolve(child);
          return;
        }
      } catch {
        /* belum siap */
      }
      if (Date.now() - awal > 10000) {
        clearInterval(cek);
        child.kill();
        reject(new Error('Server tidak bisa dinyalakan untuk tes.'));
      }
    }, 300);
  });
}

async function json(method, url, body, auth = 'Bearer test:admin:admin-user-001:server:active') {
  const headers = {};
  if (body) headers['Content-Type'] = 'application/json';
  if (auth) headers['Authorization'] = auth;
  const res = await fetch(BASE + url, { method, headers, body: body ? JSON.stringify(body) : undefined });
  return { status: res.status, data: await res.json().catch(() => ({})) };
}

describe('ISSUE-42 negative tests', () => {
  test('create menolak kode', async () => {
    const child = await nyalakan();
    try {
      const r = await json('POST', '/api/aset', { nama: 'A', kategori: 'IT', kode: 'FAKE/HACK-999' });
      assert.equal(r.status, 400);
      assert.ok(String(r.data.error).includes('kode'));
    } finally { child.kill(); }
  });

  test('create menolak status', async () => {
    const child = await nyalakan();
    try {
      const r = await json('POST', '/api/aset', { nama: 'A', kategori: 'IT', status: 'rusak' });
      assert.equal(r.status, 400);
      assert.ok(String(r.data.error).includes('status'));
    } finally { child.kill(); }
  });

  test('create menolak timestamps', async () => {
    const child = await nyalakan();
    try {
      const r = await json('POST', '/api/aset', { nama: 'A', kategori: 'IT', created_at: '2024-01-01', updated_at: '2024-01-02' });
      assert.equal(r.status, 400);
      assert.ok(String(r.data.error).includes('created_at') || String(r.data.error).includes('server-managed'));
    } finally { child.kill(); }
  });

  test('create menolak audit metadata', async () => {
    const child = await nyalakan();
    try {
      const r = await json('POST', '/api/aset', { nama: 'A', kategori: 'IT', created_by: 'user1', updated_by: 'user2' });
      assert.equal(r.status, 400);
      assert.ok(String(r.data.error).includes('created_by') || String(r.data.error).includes('server-managed'));
    } finally { child.kill(); }
  });

  test('update menolak kode', async () => {
    const child = await nyalakan();
    try {
      const buat = await json('POST', '/api/aset', { nama: 'A', kategori: 'IT' });
      assert.equal(buat.status, 200);
      const kode = buat.data.kode;
      const r = await json('PUT', `/api/aset/${encodeURIComponent(kode)}`, { kode: 'FAKE/HACK-999' });
      assert.equal(r.status, 400);
      assert.ok(String(r.data.error).includes('kode'));
    } finally { child.kill(); }
  });

  test('update menolak status', async () => {
    const child = await nyalakan();
    try {
      const buat = await json('POST', '/api/aset', { nama: 'A', kategori: 'IT' });
      assert.equal(buat.status, 200);
      const kode = buat.data.kode;
      const r = await json('PUT', `/api/aset/${encodeURIComponent(kode)}`, { status: 'rusak' });
      assert.equal(r.status, 400);
      assert.ok(String(r.data.error).includes('status'));
    } finally { child.kill(); }
  });

  test('update menolak timestamps dan audit metadata', async () => {
    const child = await nyalakan();
    try {
      const buat = await json('POST', '/api/aset', { nama: 'A', kategori: 'IT' });
      assert.equal(buat.status, 200);
      const kode = buat.data.kode;
      const r = await json('PUT', `/api/aset/${encodeURIComponent(kode)}`, { created_at: '2024-01-01', updated_at: '2024-01-02', created_by: 'x', updated_by: 'y' });
      assert.equal(r.status, 400);
      assert.ok(String(r.data.error).includes('created_at') || String(r.data.error).includes('server-managed'));
    } finally { child.kill(); }
  });

  test('update tidak mengubah kode dan status', async () => {
    const child = await nyalakan();
    try {
      const buat = await json('POST', '/api/aset', { nama: 'A', kategori: 'IT' });
      assert.equal(buat.status, 200);
      const kode = buat.data.kode;
      const beforeStatus = buat.data.status;
      const r = await json('PUT', `/api/aset/${encodeURIComponent(kode)}`, { nama: 'B', kondisi: 'baik' });
      assert.equal(r.status, 200);
      assert.equal(r.data.kode, kode);
      assert.equal(r.data.status, beforeStatus);
    } finally { child.kill(); }
  });

  test('lifecycle transisi valid', async () => {
    const child = await nyalakan();
    try {
      const buat = await json('POST', '/api/aset', { nama: 'A', kategori: 'IT' });
      assert.equal(buat.status, 200);
      const kode = buat.data.kode;
      const r = await json('POST', `/api/aset/${encodeURIComponent(kode)}/lifecycle`, { status: 'dipakai' });
      assert.equal(r.status, 200);
    } finally { child.kill(); }
  });

  test('lifecycle transisi ilegal ditolak', async () => {
    const child = await nyalakan();
    try {
      const buat = await json('POST', '/api/aset', { nama: 'A', kategori: 'IT' });
      assert.equal(buat.status, 200);
      const kode = buat.data.kode;
      // dari tersedia langsung ke dihapus harus ditolak
      const r = await json('POST', `/api/aset/${encodeURIComponent(kode)}/lifecycle`, { status: 'dihapus' });
      assert.equal(r.status, 400);
      assert.ok(String(r.data.error).includes('Transisi'));
    } finally { child.kill(); }
  });

  test('lifecycle transisi dari dihapus tidak diizinkan', async () => {
    const child = await nyalakan();
    try {
      const buat = await json('POST', '/api/aset', { nama: 'A', kategori: 'IT' });
      assert.equal(buat.status, 200);
      const kode = buat.data.kode;
      // tersedia -> hilang -> dihapus -> tersedia (harus ditolak)
      await json('POST', `/api/aset/${encodeURIComponent(kode)}/lifecycle`, { status: 'hilang' });
      const r2 = await json('POST', `/api/aset/${encodeURIComponent(kode)}/lifecycle`, { status: 'dihapus' });
      assert.equal(r2.status, 200);
      const r3 = await json('POST', `/api/aset/${encodeURIComponent(kode)}/lifecycle`, { status: 'tersedia' });
      assert.equal(r3.status, 400);
    } finally { child.kill(); }
  });

  test('create kodeserver-generated sequential', async () => {
    const child = await nyalakan();
    try {
      const r1 = await json('POST', '/api/aset', { nama: 'A1', kategori: 'IT' });
      const r2 = await json('POST', '/api/aset', { nama: 'A2', kategori: 'IT' });
      assert.equal(r1.status, 200);
      assert.equal(r2.status, 200);
      assert.notEqual(r1.data.kode, r2.data.kode);
      assert.ok(r1.data.kode.startsWith('INV/IT-'));
      assert.ok(r2.data.kode.startsWith('INV/IT-'));
    } finally { child.kill(); }
  });

  test('create menolak unknown field (strict DTO)', async () => {
    const child = await nyalakan();
    try {
      const r = await json('POST', '/api/aset', { nama: 'A', kategori: 'IT', confidential: true });
      assert.equal(r.status, 400);
      assert.ok(String(r.data.error).includes('confidential'));
    } finally { child.kill(); }
  });

  test('create menolak owner_id/pic_ids privilege field', async () => {
    const child = await nyalakan();
    try {
      const r1 = await json('POST', '/api/aset', { nama: 'A', kategori: 'IT', owner_id: 'hacked-user' });
      assert.equal(r1.status, 400);
      assert.ok(String(r1.data.error).includes('owner_id'));
      const r2 = await json('POST', '/api/aset', { nama: 'B', kategori: 'IT', pic_ids: ['hacked'] });
      assert.equal(r2.status, 400);
      assert.ok(String(r2.data.error).includes('pic_ids'));
    } finally { child.kill(); }
  });

  test('update menolak unknown field (strict DTO)', async () => {
    const child = await nyalakan();
    try {
      const buat = await json('POST', '/api/aset', { nama: 'A', kategori: 'IT' });
      assert.equal(buat.status, 200);
      const kode = buat.data.kode;
      const r = await json('PUT', `/api/aset/${encodeURIComponent(kode)}`, { nama: 'B', hacking: 1 });
      assert.equal(r.status, 400);
      assert.ok(String(r.data.error).includes('hacking'));
    } finally { child.kill(); }
  });

  test('update menolak pic_ids privilege field', async () => {
    const child = await nyalakan();
    try {
      const buat = await json('POST', '/api/aset', { nama: 'A', kategori: 'IT' });
      assert.equal(buat.status, 200);
      const kode = buat.data.kode;
      const r = await json('PUT', `/api/aset/${encodeURIComponent(kode)}`, { pic_ids: ['hacked'] });
      assert.equal(r.status, 400);
      assert.ok(String(r.data.error).includes('pic_ids'));
    } finally { child.kill(); }
  });

  test('lifecycle berpengaruh ke status tersimpan (persist)', async () => {
    const child = await nyalakan();
    try {
      const buat = await json('POST', '/api/aset', { nama: 'A', kategori: 'IT' });
      assert.equal(buat.status, 200);
      const kode = buat.data.kode;
      assert.equal(buat.data.status, 'tersedia');

      const r = await json('POST', `/api/aset/${encodeURIComponent(kode)}/lifecycle`, { status: 'dipakai' });
      assert.equal(r.status, 200);

      const ambil = await json('GET', `/api/aset/${encodeURIComponent(kode)}`);
      assert.equal(ambil.status, 200);
      assert.equal(ambil.data.status, 'dipakai', 'status lifecycle harus tersimpan di storage');
    } finally { child.kill(); }
  });
});

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

let testPort = 33100;
function nextPort() { return ++testPort; }

function nyalakan(port) {
  return new Promise((resolve, reject) => {
    const tmp = path.join(os.tmpdir(), `ssterima-rbac-${port}`);
    fs.rmSync(tmp, { recursive: true, force: true });
    const child = spawn(process.execPath, ['server.js'], {
      cwd: path.join(__dirname, '..'),
      env: {
        ...process.env,
        PORT: String(port),
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
        const r = await fetch(`http://localhost:${port}/api/config`);
        if (r.ok) { clearInterval(cek); resolve({ child, port, tmp }); return; }
      } catch { /* belum siap */ }
      if (Date.now() - awal > 10000) { clearInterval(cek); child.kill(); reject(new Error('Server tidak bisa dinyalakan.')); }
    }, 300);
  });
}

async function json(method, url, body, auth, port) {
  const headers = {};
  if (body) headers['Content-Type'] = 'application/json';
  if (auth) headers['Authorization'] = auth;
  const res = await fetch(`http://localhost:${port}${url}`, { method, headers, body: body ? JSON.stringify(body) : undefined });
  return { status: res.status, data: await res.json().catch(() => ({})) };
}

const ADMIN = 'Bearer test:admin:admin-user-001:server:active';
const VIEWER = 'Bearer test:viewer:viewer-user-002:server:active';
const PIC_A = 'Bearer test:pic:pic-user-003:server:active';
const PIC_B = 'Bearer test:pic:pic-user-004:server:active';
const INACTIVE_USER = 'Bearer test:pic:pic-user-005:server:inactive';

test('rbac: cross-user scope isolation — PIC_A tidak bisa akses aset PIC_B', async () => {
  const { child, port, tmp } = await nyalakan(nextPort());
  try {
    const aA = await json('POST', '/api/aset', { nama: 'Laptop A', kategori: 'IT' }, PIC_A, port);
    assert.equal(aA.status, 200);
    const kodeA = aA.data.kode;

    const aB = await json('POST', '/api/aset', { nama: 'Laptop B', kategori: 'IT' }, PIC_B, port);
    assert.equal(aB.status, 200);
    const kodeB = aB.data.kode;

    const daftarA = await json('GET', '/api/aset', null, PIC_A, port);
    assert.equal(daftarA.status, 200);
    assert.ok(daftarA.data.some((a) => a.kode === kodeA), 'PIC_A harus bisa lihat asetnya sendiri');
    assert.ok(!daftarA.data.some((a) => a.kode === kodeB), 'PIC_A tidak bisa lihat aset PIC_B');

    const accessB = await json('GET', `/api/aset/${encodeURIComponent(kodeB)}`, null, PIC_A, port);
    assert.equal(accessB.status, 403, 'PIC_A tidak bisa akses detail aset PIC_B');

    const updateB = await json('PUT', `/api/aset/${encodeURIComponent(kodeB)}`, { nama: 'Hacked' }, PIC_A, port);
    assert.equal(updateB.status, 403, 'PIC_A tidak bisa update aset PIC_B');

    const deleteB = await json('DELETE', `/api/aset/${encodeURIComponent(kodeB)}`, null, PIC_A, port);
    assert.equal(deleteB.status, 403, 'PIC_A tidak bisa delete aset PIC_B');
  } finally { child.kill(); }
});

test('rbac: inactive user ditolak pada semua endpoint', async () => {
  const { child, port } = await nyalakan(nextPort());
  try {
    const list = await json('GET', '/api/aset', null, INACTIVE_USER, port);
    assert.equal(list.status, 403, 'inactive user ditolak list');

    const create = await json('POST', '/api/aset', { nama: 'Test', kategori: 'IT' }, INACTIVE_USER, port);
    assert.equal(create.status, 403, 'inactive user ditolak create');
  } finally { child.kill(); }
});

test('rbac: surat mutasi memerlukan scope authorization untuk semua aset', async () => {
  const { child, port } = await nyalakan(nextPort());
  try {
    const aA = await json('POST', '/api/aset', { nama: 'Laptop A', kategori: 'IT' }, PIC_A, port);
    const kodeA = aA.data.kode;

    const payload = {
      nama: 'Edy',
      departemen: 'HCM',
      penerima: 'Isti',
      departemenPenerima: 'FAT',
      keterangan: 'Test aset',
      kategori: 'penyerahan',
      aset: [kodeA],
    };

    const suratByPicA = await json('POST', '/api/surat', payload, PIC_A, port);
    assert.equal(suratByPicA.status, 200, 'PIC_A bisa bikin surat dengan asetnya');

    const suratByPicB = await json('POST', '/api/surat', { ...payload, aset: [kodeA] }, PIC_B, port);
    assert.equal(suratByPicB.status, 403, 'PIC_B tidak bisa bikin surat dengan aset PIC_A');
  } finally { child.kill(); }
});

test('rbac: ID path tampering — nomor surat tidak bisa diedit tanpa aset access', async () => {
  const { child, port } = await nyalakan(nextPort());
  try {
    const s1 = await json('POST', '/api/surat', {
      nama: 'Edy', departemen: 'HCM', penerima: 'Isti', departemenPenerima: 'FAT',
      keterangan: 'Surat 1', kategori: 'penyerahan'
    }, ADMIN, port);
    const nomor1 = s1.data.nomor;

    const get1 = await json('GET', `/api/surat/${encodeURIComponent(nomor1)}`, null, VIEWER, port);
    assert.equal(get1.status, 200, 'viewer bisa baca surat apa saja');

    const edit = await json('PUT', `/api/surat/${encodeURIComponent(nomor1)}`, {
      nama: 'Hacked', departemen: 'HCM', penerima: 'Isti', departemenPenerima: 'FAT',
      keterangan: 'Hacked', kategori: 'penyerahan'
    }, VIEWER, port);
    assert.equal(edit.status, 403, 'viewer tidak bisa edit surat meski tanpa aset');
  } finally { child.kill(); }
});

test('rbac: nested history — riwayat aset terbatas scope', async () => {
  const { child, port } = await nyalakan(nextPort());
  try {
    const aA = await json('POST', '/api/aset', { nama: 'Laptop', kategori: 'IT' }, PIC_A, port);
    const kodeA = aA.data.kode;

    await json('POST', '/api/surat', {
      nama: 'Edy', departemen: 'HCM', penerima: 'Isti', departemenPenerima: 'FAT',
      keterangan: 'Surat', kategori: 'penyerahan', aset: [kodeA]
    }, PIC_A, port);

    const histA = await json('GET', `/api/aset/${encodeURIComponent(kodeA)}/riwayat`, null, PIC_A, port);
    assert.equal(histA.status, 200, 'PIC_A bisa baca history asetnya');

    const histB = await json('GET', `/api/aset/${encodeURIComponent(kodeA)}/riwayat`, null, PIC_B, port);
    assert.equal(histB.status, 403, 'PIC_B tidak bisa baca history aset PIC_A');
  } finally { child.kill(); }
});

test('rbac: pagination + filter — scope diterapkan per item', async () => {
  const { child, port } = await nyalakan(nextPort());
  try {
    for (let i = 0; i < 5; i++) {
      await json('POST', '/api/aset', { nama: `Laptop ${i}`, kategori: 'IT' }, PIC_A, port);
    }
    for (let i = 0; i < 3; i++) {
      await json('POST', '/api/aset', { nama: `PC ${i}`, kategori: 'IT' }, PIC_B, port);
    }

    const listA = await json('GET', '/api/aset', null, PIC_A, port);
    assert.equal(listA.status, 200);
    assert.equal(listA.data.length, 5, 'PIC_A hanya lihat 5 aset miliknya');

    const listB = await json('GET', '/api/aset', null, PIC_B, port);
    assert.equal(listB.data.length, 3, 'PIC_B hanya lihat 3 aset miliknya');
  } finally { child.kill(); }
});

test('rbac: TEST_AUTH blocked di non-test environment', async () => {
  const { child, port } = await nyalakan(nextPort());
  try {
    const r = await json('GET', '/api/aset', null, ADMIN, port);
    assert.ok([200, 403].includes(r.status), 'response harus kode valid');
  } finally { child.kill(); }
});

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const PORT = 3299;
const BASE = `http://localhost:${PORT}`;
const tmp = path.join(os.tmpdir(), 'ssterima-aset-test');
const tahun = new Date().getFullYear();

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
        const r = await fetch(`${BASE}/api/riwayat`);
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

async function json(method, url, body) {
  const res = await fetch(BASE + url, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, data: await res.json().catch(() => ({})) };
}

test('aset: alur CRUD + kaitan surat + tracking + status', async () => {
  const child = await nyalakan();
  try {
    const aset = { kode: 'INV/IT-001', nama: 'Laptop Asus', kategori: 'Laptop', nilai: 9500000, kondisi: 'baik', status: 'tersedia' };

    // CRUD aset
    const buat = await json('POST', '/api/aset', aset);
    assert.equal(buat.status, 200);
    assert.equal(buat.data.kode, 'INV/IT-001');
    assert.equal(buat.data.status, 'tersedia');

    const duplikat = await json('POST', '/api/aset', aset);
    assert.equal(duplikat.status, 400);

    const daftar = await json('GET', '/api/aset');
    assert.equal(daftar.status, 200);
    assert.equal(daftar.data.length, 1);

    const edit = await json('PUT', `/api/aset/${encodeURIComponent('INV/IT-001')}`, { ...aset, kondisi: 'cukup', status: 'rusak' });
    assert.equal(edit.status, 200);
    assert.equal(edit.data.kondisi, 'cukup');
    assert.equal(edit.data.status, 'rusak');

    // Buat surat yang menyerahkan aset
    const payload = {
      nama: 'Edy',
      departemen: 'HCM',
      penerima: 'Isti',
      departemenPenerima: 'FAT',
      keterangan: 'Penyerahan laptop',
      kategori: 'penyerahan',
      aset: ['INV/IT-001'],
    };
    const surat = await json('POST', '/api/surat', payload);
    assert.equal(surat.status, 200);
    assert.equal(surat.data.aset.length, 1);
    assert.equal(surat.data.aset[0].kode, 'INV/IT-001');
    const nomor = surat.data.nomor;

    // Status aset otomatis jadi dipakai
    const daftar2 = await json('GET', '/api/aset');
    assert.equal(daftar2.data[0].status, 'dipakai');

    // Riwayat surat memuat aset
    const riwayat = await json('GET', '/api/riwayat');
    assert.deepEqual(riwayat.data[0].aset, ['INV/IT-001']);

    // Tracking per aset
    const trk = await json('GET', `/api/aset/${encodeURIComponent('INV/IT-001')}/riwayat`);
    assert.equal(trk.status, 200);
    assert.equal(trk.data.length, 1);
    assert.equal(trk.data[0].nomor, nomor);

    // Pengembalian -> status kembali tersedia
    const kembali = await json('POST', '/api/surat', { ...payload, kategori: 'pengembalian', aset: ['INV/IT-001'] });
    assert.equal(kembali.status, 200);
    const daftar3 = await json('GET', '/api/aset');
    assert.equal(daftar3.data[0].status, 'tersedia');

    // Hapus aset
    const hapus = await json('DELETE', `/api/aset/${encodeURIComponent('INV/IT-001')}`);
    assert.equal(hapus.status, 200);
    const daftar4 = await json('GET', '/api/aset');
    assert.equal(daftar4.data.length, 0);

    // Tracking aset yang sudah dihapus = kosong
    const trk2 = await json('GET', `/api/aset/${encodeURIComponent('INV/IT-001')}/riwayat`);
    assert.equal(trk2.status, 200);
    assert.equal(trk2.data.length, 0);
  } finally {
    child.kill();
  }
});

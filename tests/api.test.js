const { test } = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const PORT = 3199;
const BASE = `http://localhost:${PORT}`;
const tmp = path.join(os.tmpdir(), 'ssterima-api-test');
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

test('api: alur lengkap POST-GET-PUT-DELETE + PDF', async () => {
  const child = await nyalakan();
  try {
    const payload = {
      nama: 'Edy',
      departemen: 'HCM',
      penerima: 'Isti',
      departemenPenerima: 'FAT',
      keterangan: 'Laptop Asus',
      kategori: 'penyerahan',
    };

    const buat = await json('POST', '/api/surat', payload);
    assert.equal(buat.status, 200);
    assert.equal(buat.data.nomor, `001/SRT-ST/${tahun}`);

    const validasi = await json('POST', '/api/surat', { ...payload, nama: '   ' });
    assert.equal(validasi.status, 400);

    const kedua = await json('POST', '/api/surat', { ...payload, nama: 'Budi', kategori: 'pengembalian' });
    assert.equal(kedua.status, 200);
    assert.equal(kedua.data.nomor, `002/SRT-ST/${tahun}`);

    const riwayat = await json('GET', '/api/riwayat');
    assert.equal(riwayat.status, 200);
    assert.equal(riwayat.data.length, 2);

    const edit = await json('PUT', `/api/surat/${encodeURIComponent(`001/SRT-ST/${tahun}`)}`, {
      ...payload,
      keterangan: 'Diubah',
    });
    assert.equal(edit.status, 200);
    assert.equal(edit.data.keterangan, 'Diubah');

    const hapus = await json('DELETE', `/api/surat/${encodeURIComponent(`001/SRT-ST/${tahun}`)}`);
    assert.equal(hapus.status, 200);

    const riwayat2 = await json('GET', '/api/riwayat');
    assert.equal(riwayat2.data.length, 1);

    const pdf = await fetch(`${BASE}/pdf/${`002-SRT-ST-${tahun}`}.pdf`);
    assert.equal(pdf.status, 200);
    assert.ok((await pdf.arrayBuffer()).byteLength > 1000, 'PDF tidak boleh kosong');
  } finally {
    child.kill();
  }
});

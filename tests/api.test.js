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

test('api: tanda tangan digital disertakan dalam PDF', async () => {
  const child = await nyalakan();
  try {
    const png = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
    const payload = {
      nama: 'Edy',
      departemen: 'HCM',
      penerima: 'Isti',
      departemenPenerima: 'FAT',
      keterangan: 'Laptop Asus',
      kategori: 'penyerahan',
      ttd: {
        menyerahkan: 'data:image/png;base64,' + png,
        menerima: 'data:image/png;base64,' + png,
        hrd: 'data:image/png;base64,' + png,
      },
    };

    const buat = await json('POST', '/api/surat', payload);
    assert.equal(buat.status, 200);
    assert.ok(buat.data.ttd, 'respon harus memuat ttd');
    assert.equal(buat.data.ttd.menyerahkan, 'data:image/png;base64,' + png);

    const pdf = await fetch(`${BASE}/pdf/${`001-SRT-ST-${tahun}`}.pdf`);
    assert.equal(pdf.status, 200);
    assert.ok((await pdf.arrayBuffer()).byteLength > 1000, 'PDF dengan ttd harus dihasilkan');
  } finally {
    child.kill();
  }
});

test('api: ttd parsial dari penerima + QR + status di riwayat', async () => {
  const child = await nyalakan();
  try {
    const png = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
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
    const nomor = buat.data.nomor;

    const ttd = await json('POST', `/api/surat/${encodeURIComponent(nomor)}/ttd`, {
      ttd: { menerima: 'data:image/png;base64,' + png },
    });
    assert.equal(ttd.status, 200);
    assert.ok(ttd.data.ttd && ttd.data.ttd.menerima, 'ttd menerima harus tersimpan');
    assert.equal(ttd.data.ttd.menyerahkan, undefined, 'ttd menyerahkan belum ada');

    const satu = await json('GET', `/api/surat/${encodeURIComponent(nomor)}`);
    assert.equal(satu.status, 200);
    assert.ok(satu.data.ttd.menerima, 'GET surat tunggal memuat ttd');

    const riwayat = await json('GET', '/api/riwayat');
    const r = riwayat.data.find((x) => x.nomor === nomor);
    assert.ok(r.ttd.menerima === true, 'status ttd menerima true di riwayat');
    assert.ok(r.ttd.menyerahkan === false, 'status ttd menyerahkan masih false');

    const qr = await fetch(`${BASE}/api/surat/${encodeURIComponent(nomor)}/qr`);
    assert.equal(qr.status, 200);
    assert.ok((qr.headers.get('content-type') || '').includes('image/png'), 'QR berupa PNG');

    const qrHrd = await fetch(`${BASE}/api/surat/${encodeURIComponent(nomor)}/qr?pihak=hrd`);
    assert.equal(qrHrd.status, 200);
    assert.ok((qrHrd.headers.get('content-type') || '').includes('image/png'), 'QR per pihak berupa PNG');
  } finally {
    child.kill();
  }
});

test('api: namaHrd tersimpan + nama dari ttd + ttd overwrite last-wins', async () => {
  const child = await nyalakan();
  try {
    const pngA = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
    const pngB = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
    const payload = {
      nama: 'Edy',
      departemen: 'HCM',
      penerima: 'Isti',
      departemenPenerima: 'FAT',
      keterangan: 'Laptop',
      kategori: 'penyerahan',
      namaHrd: 'Budi HRD',
    };
    const buat = await json('POST', '/api/surat', payload);
    assert.equal(buat.status, 200);
    assert.equal(buat.data.namaHrd, 'Budi HRD', 'namaHrd tersimpan saat buat surat');

    const awal = await json('GET', `/api/surat/${encodeURIComponent(buat.data.nomor)}`);
    assert.equal(awal.data.namaHrd, 'Budi HRD', 'namaHrd tersimpan di penyimpanan');

    const ttd = await json('POST', `/api/surat/${encodeURIComponent(buat.data.nomor)}/ttd`, {
      ttd: { hrd: 'data:image/png;base64,' + pngA },
      nama: 'Siti HRD',
    });
    assert.equal(ttd.status, 200);
    assert.equal(ttd.data.namaHrd, 'Siti HRD', 'nama pihak hrd bisa diisi lewat ttd.html');

    const setelah = await json('GET', `/api/surat/${encodeURIComponent(buat.data.nomor)}`);
    assert.equal(setelah.data.namaHrd, 'Siti HRD', 'namaHrd dari ttd.html tersimpan di penyimpanan');

    const ttd1 = await json('POST', `/api/surat/${encodeURIComponent(buat.data.nomor)}/ttd`, {
      ttd: { menerima: 'data:image/png;base64,' + pngA },
    });
    assert.equal(ttd1.status, 200);
    assert.equal(ttd1.data.ttd.menerima, 'data:image/png;base64,' + pngA);

    const ttd2 = await json('POST', `/api/surat/${encodeURIComponent(buat.data.nomor)}/ttd`, {
      ttd: { menerima: 'data:image/png;base64,' + pngB },
    });
    assert.equal(ttd2.status, 200);
    assert.equal(ttd2.data.ttd.menerima, 'data:image/png;base64,' + pngB, 'ttd kedua harus menggantikan yang pertama');

    const satu = await json('GET', `/api/surat/${encodeURIComponent(buat.data.nomor)}`);
    assert.equal(satu.data.ttd.menerima, 'data:image/png;base64,' + pngB, 'yang tampil = ttd terbaru');
  } finally {
    child.kill();
  }
});

test('api: validasi aset + status konsisten saat edit + nilai aset di GET', async () => {
  const child = await nyalakan();
  try {
    const asetPayload = {
      kode: 'INV/TEST-001',
      nama: 'Laptop Test',
      kategori: 'Laptop',
      nilai: 5000000,
      kondisi: 'baru',
      status: 'tersedia',
    };
    const buatAset = await json('POST', '/api/aset', asetPayload);
    assert.equal(buatAset.status, 200);

    const payload = {
      nama: 'Edy',
      departemen: 'HCM',
      penerima: 'Isti',
      departemenPenerima: 'FAT',
      keterangan: 'Laptop',
      kategori: 'penyerahan',
      aset: ['INV/TEST-001'],
    };
    const buat = await json('POST', '/api/surat', payload);
    assert.equal(buat.status, 200);
    assert.equal(buat.data.aset[0].kode, 'INV/TEST-001');
    assert.equal(buat.data.aset[0].nilai, 5000000, 'GET/POST surat memuat nilai aset');

    let daftar = await json('GET', '/api/aset');
    let a = daftar.data.find((x) => x.kode === 'INV/TEST-001');
    assert.equal(a.status, 'dipakai', 'aset penyerahan otomatis jadi dipakai');

    const objAset = await json('POST', '/api/surat', { ...payload, nama: 'Budi', aset: [{ kode: 'INV/TEST-001' }] });
    assert.equal(objAset.status, 400, 'aset bertipe objek harus ditolak');

    const edit = await json('PUT', `/api/surat/${encodeURIComponent(buat.data.nomor)}`, {
      ...payload,
      aset: [],
    });
    assert.equal(edit.status, 200);

    daftar = await json('GET', '/api/aset');
    a = daftar.data.find((x) => x.kode === 'INV/TEST-001');
    assert.equal(a.status, 'tersedia', 'aset yang dilepas dari surat kembali tersedia');
  } finally {
    child.kill();
  }
});

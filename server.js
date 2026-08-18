const express = require('express');
const path = require('path');
const fs = require('fs');
const config = require('./config');
const { nextNomor } = require('./lib/nomor');
const { bikinExcel } = require('./lib/excel');
const { buatPdf, dirPdf } = require('./lib/pdf');
const storage = require('./lib/storage');
const QRCode = require('qrcode');

const app = express();
app.use(express.json({ limit: '10mb' }));
app.use(
  express.static(path.join(__dirname, 'public'), {
    etag: true,
    setHeaders(res, filePath) {
      if (/\.(html?|js|css)$/i.test(filePath)) {
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      }
    },
  })
);
app.use('/pdf', express.static(dirPdf()));

function validasiData(body) {
  const bersih = (v) => (typeof v === 'string' ? v.trim() : '');
  const data = {
    nama: bersih(body.nama),
    departemen: bersih(body.departemen),
    penerima: bersih(body.penerima),
    departemenPenerima: bersih(body.departemenPenerima),
    keterangan: bersih(body.keterangan),
    kategori: bersih(body.kategori),
  };
  const wajib = ['nama', 'departemen', 'penerima', 'departemenPenerima', 'keterangan'];
  const kosong = wajib.find((k) => !data[k]);
  if (kosong) return { error: 'Nama, departemen, dan keterangan (kedua pihak) wajib diisi.' };
  if (!['penyerahan', 'pengembalian'].includes(data.kategori)) return { error: 'Kategori tidak valid.' };
  return { data };
}

const PIHAK_TTD = ['menyerahkan', 'menerima', 'hrd'];

function ambilTtd(obj) {
  const out = {};
  PIHAK_TTD.forEach((k) => {
    const v = obj && obj[k];
    if (typeof v === 'string' && v.startsWith('data:image/')) {
      const b64 = v.slice(v.indexOf(',') + 1);
      const buf = Buffer.from(b64, 'base64');
      if (buf.length && buf.length <= 1024 * 1024) out[k] = buf;
    }
  });
  return out;
}

function ttdDataUrl(ttd) {
  const out = {};
  PIHAK_TTD.forEach((k) => {
    if (ttd && ttd[k]) out[k] = 'data:image/png;base64,' + ttd[k].toString('base64');
  });
  return out;
}

function validasiAset(body) {
  const bersih = (v) => (typeof v === 'string' ? v.trim() : '');
  const kode = bersih(body.kode);
  const nama = bersih(body.nama);
  if (!nama) return { error: 'Nama aset wajib diisi.' };
  const nilai = Number(body.nilai);
  const status = bersih(body.status);
  const kondisi = bersih(body.kondisi);
  const KONDISI_VALID = ['baru', 'sangat-baik', 'baik', 'cukup', 'rusak-ringan', 'rusak-berat'];
  const STATUS_VALID = ['tersedia', 'dipakai', 'perbaikan', 'rusak', 'hilang', 'dihapus'];
  return {
    data: {
      kode,
      nama,
      kategori: bersih(body.kategori),
      nilai: Number.isFinite(nilai) && nilai > 0 ? nilai : 0,
      kondisi: KONDISI_VALID.includes(kondisi) ? kondisi : 'baik',
      status: STATUS_VALID.includes(status) ? status : 'tersedia',
    },
  };
}

async function autoKodeAset(kategori) {
  const seg =
    String(kategori || '')
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'ASET';
  const daftar = await storage.aset.daftarAset();
  const pola = new RegExp(`^INV/${seg.replace(/[-/\\]/g, '\\-')}-(\\d+)$`);
  let maks = 0;
  daftar.forEach((a) => {
    const m = pola.exec(String(a.kode).toUpperCase());
    if (m) maks = Math.max(maks, parseInt(m[1], 10));
  });
  return `INV/${seg}-${String(maks + 1).padStart(3, '0')}`;
}

const KONDISI_LABEL = {
  baru: 'Baru',
  'sangat-baik': 'Sangat Baik',
  baik: 'Baik',
  cukup: 'Cukup',
  'rusak-ringan': 'Rusak Ringan',
  'rusak-berat': 'Rusak Berat',
};

async function ambilInfoAset(kodeAset) {
  if (!kodeAset || kodeAset.length === 0) return [];
  const semua = await storage.aset.daftarAset();
  const map = new Map(semua.map((a) => [String(a.kode), a]));
  return kodeAset.map((k) => {
    const a = map.get(String(k));
    return a
      ? { kode: a.kode, nama: a.nama, kondisi: KONDISI_LABEL[a.kondisi] || a.kondisi, status: a.status }
      : { kode: String(k), nama: '', kondisi: '', status: '' };
  });
}

async function buatSurat(data) {
  // Retry jika nomor bentrok (kemungkinan dua permintaan bersamaan di mode supabase).
  for (let i = 0; i < 4; i++) {
    const daftar = await storage.bacaRiwayat();
    const { nomor, tanggal, tanggalSingkat } = nextNomor(data.kategori, daftar.map((r) => r.nomor));
    const surat = { ...data, nomor, tanggal, tanggalSingkat };
    try {
      await storage.tambahRiwayat(surat);
      return surat;
    } catch (err) {
      const pesan = String((err && err.message) || '');
      const bentrok = err && (err.code === '23505' || /duplicate|unique/i.test(pesan));
      if (bentrok) continue;
      throw err;
    }
  }
  throw new Error('Gagal menghasilkan nomor surat yang unik.');
}

async function simpanSuratDanPdf(surat) {
  const { namaFile, buffer } = await buatPdf(surat);
  await storage.simpanPdf(namaFile, buffer);
  return namaFile;
}

async function simpanTtdSurat(nomor, ttdBaru) {
  for (const pihak of Object.keys(ttdBaru)) {
    await storage.ttd.simpanTtd(nomor, pihak, ttdBaru[pihak]);
  }
}

function ttdUrl(req, nomor) {
  const proto = req.headers['x-forwarded-proto'] || req.protocol || 'https';
  return `${proto}://${req.get('host')}/ttd.html?nomor=${encodeURIComponent(String(nomor))}`;
}

function cariSurat(nomor) {
  return storage.bacaRiwayat().then((daftar) => daftar.find((r) => String(r.nomor) === String(nomor)));
}

app.get('/api/riwayat/download', async (_req, res) => {
  try {
    if (storage.mode === 'file') {
      const file = storage.fileRiwayat();
      if (!fs.existsSync(file)) return res.status(404).json({ error: 'File riwayat belum ada.' });
      return res.download(file, 'riwayat.xlsx');
    }
    const daftar = await storage.bacaRiwayat();
    const buffer = await bikinExcel(daftar);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="riwayat.xlsx"');
    res.send(buffer);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Gagal mengunduh riwayat.' });
  }
});

app.get('/api/surat/:nomor/pdf', async (req, res) => {
  try {
    const namaFile = String(req.params.nomor).replace(/[/\\]/g, '-') + '.pdf';
    const buffer = await storage.ambilPdf(namaFile);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${namaFile}"`);
    res.send(buffer);
  } catch (err) {
    console.error(err);
    res.status(404).json({ error: 'PDF tidak ditemukan.' });
  }
});

app.get('/api/surat/:nomor/qr', async (req, res) => {
  try {
    const png = await QRCode.toBuffer(ttdUrl(req, req.params.nomor), {
      width: 320,
      margin: 1,
      color: { dark: '#000000', light: '#ffffff' },
    });
    res.setHeader('Content-Type', 'image/png');
    res.send(png);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Gagal membuat QR.' });
  }
});

app.post('/api/surat/:nomor/ttd', async (req, res) => {
  try {
    const surat = await cariSurat(req.params.nomor);
    if (!surat) return res.status(404).json({ error: 'Surat tidak ditemukan.' });

    const ttdBaru = ambilTtd(req.body && req.body.ttd);
    if (Object.keys(ttdBaru).length === 0) {
      return res.status(400).json({ error: 'Tidak ada tanda tangan yang dikirim.' });
    }

    await simpanTtdSurat(surat.nomor, ttdBaru);
    surat.ttd = await storage.ttd.muatTtd(surat.nomor);
    const kodeAset = (await storage.aset.kodeAsetPerNomor())[surat.nomor] || [];
    surat.aset = await ambilInfoAset(kodeAset);
    const namaFile = await simpanSuratDanPdf(surat);

    res.json({ ...surat, pdf: namaFile, ttd: ttdDataUrl(surat.ttd) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Gagal menyimpan tanda tangan.' });
  }
});

app.get('/api/surat/:nomor', async (req, res) => {
  try {
    const surat = await cariSurat(req.params.nomor);
    if (!surat) return res.status(404).json({ error: 'Surat tidak ditemukan.' });
    const kodeAset = (await storage.aset.kodeAsetPerNomor())[surat.nomor] || [];
    surat.aset = await ambilInfoAset(kodeAset);
    surat.ttd = ttdDataUrl(await storage.ttd.muatTtd(surat.nomor));
    res.json(surat);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Gagal membaca surat.' });
  }
});

app.get('/api/config', (_req, res) => {
  res.json({
    kota: config.kota,
    deptPengelola: config.deptPengelola,
    namaInstansi: config.namaInstansi,
    alamatInstansi: config.alamatInstansi,
    departemen: config.departemen || [],
  });
});

app.get('/api/riwayat', async (_req, res) => {
  try {
    const daftar = await storage.bacaRiwayat();
    const map = await storage.aset.kodeAsetPerNomor();
    const hasil = [];
    for (const s of daftar) {
      hasil.push({ ...s, aset: map[s.nomor] || [], ttd: await storage.ttd.statusTtd(s.nomor) });
    }
    res.json(hasil);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Gagal membaca riwayat.' });
  }
});

app.post('/api/surat', async (req, res) => {
  try {
    const hasil = validasiData(req.body || {});
    if (hasil.error) return res.status(400).json({ error: hasil.error });

    const kodeAset = Array.isArray(req.body.aset) ? req.body.aset : [];
    const surat = await buatSurat(hasil.data);

    if (kodeAset.length) {
      await storage.aset.tautkanSurat(surat.nomor, kodeAset);
      await storage.aset.aturStatus(kodeAset, hasil.data.kategori === 'penyerahan' ? 'dipakai' : 'tersedia');
    }
    surat.aset = await ambilInfoAset(kodeAset);
    const ttdBaru = ambilTtd(req.body.ttd);
    if (Object.keys(ttdBaru).length) await simpanTtdSurat(surat.nomor, ttdBaru);
    surat.ttd = await storage.ttd.muatTtd(surat.nomor);
    const namaFile = await simpanSuratDanPdf(surat);

    res.json({ ...surat, pdf: namaFile, ttd: ttdDataUrl(surat.ttd) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Terjadi kesalahan pada server.' });
  }
});

app.put('/api/surat/:nomor', async (req, res) => {
  try {
    const hasil = validasiData(req.body || {});
    if (hasil.error) return res.status(400).json({ error: hasil.error });

    const lama = (await storage.bacaRiwayat()).find((r) => String(r.nomor) === String(req.params.nomor));
    if (!lama) return res.status(404).json({ error: 'Nomor surat tidak ditemukan.' });

    const kodeAset = Array.isArray(req.body.aset) ? req.body.aset : [];
    const surat = { ...lama, ...hasil.data };
    await storage.updateRiwayat(lama.nomor, surat);

    await storage.aset.tautkanSurat(surat.nomor, kodeAset);
    await storage.aset.aturStatus(kodeAset, hasil.data.kategori === 'penyerahan' ? 'dipakai' : 'tersedia');
    surat.aset = await ambilInfoAset(kodeAset);
    const ttdEdit = ambilTtd(req.body.ttd);
    if (Object.keys(ttdEdit).length) await simpanTtdSurat(surat.nomor, ttdEdit);
    surat.ttd = await storage.ttd.muatTtd(surat.nomor);
    const namaFile = await simpanSuratDanPdf(surat);

    res.json({ ...surat, pdf: namaFile, ttd: ttdDataUrl(surat.ttd) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Terjadi kesalahan pada server.' });
  }
});

app.delete('/api/surat/:nomor', async (req, res) => {
  try {
    const nomor = String(req.params.nomor);
    const dihapus = await storage.hapusRiwayat(nomor);
    if (!dihapus) return res.status(404).json({ error: 'Nomor surat tidak ditemukan.' });

    const namaFile = nomor.replace(/[/\\]/g, '-') + '.pdf';
    try {
      await storage.hapusPdf(namaFile);
    } catch {
      /* PDF tidak ditemukan, abaikan */
    }
    try {
      await storage.ttd.hapusTtd(nomor);
    } catch {
      /* file ttd tidak ditemukan, abaikan */
    }
    try {
      await storage.aset.hapusTautanSurat(nomor);
    } catch {
      /* tidak ada tautan */
    }

    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Gagal menghapus data.' });
  }
});

// --- Aset ---
app.get('/api/aset', async (_req, res) => {
  try {
    res.json(await storage.aset.daftarAset());
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Gagal membaca data aset.' });
  }
});

app.post('/api/aset', async (req, res) => {
  try {
    const hasil = validasiAset(req.body || {});
    if (hasil.error) return res.status(400).json({ error: hasil.error });
    if (!hasil.data.kode) hasil.data.kode = await autoKodeAset(hasil.data.kategori);
    const aset = await storage.aset.tambahAset(hasil.data);
    res.json(aset);
  } catch (err) {
    console.error(err);
    if (err && (err.code === '23505' || err.code === 'DUP' || /duplicate|sudah dipakai/i.test(String(err.message)))) {
      return res.status(400).json({ error: 'Kode aset sudah dipakai.' });
    }
    res.status(500).json({ error: 'Gagal menyimpan aset.' });
  }
});

app.put('/api/aset/:kode', async (req, res) => {
  try {
    const hasil = validasiAset(req.body || {});
    if (hasil.error) return res.status(400).json({ error: hasil.error });
    const aset = await storage.aset.updateAset(req.params.kode, hasil.data);
    if (!aset) return res.status(404).json({ error: 'Aset tidak ditemukan.' });
    res.json(aset);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Gagal mengubah aset.' });
  }
});

app.delete('/api/aset/:kode', async (req, res) => {
  try {
    const ok = await storage.aset.hapusAset(req.params.kode);
    if (!ok) return res.status(404).json({ error: 'Aset tidak ditemukan.' });
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Gagal menghapus aset.' });
  }
});

app.get('/api/aset/:kode/riwayat', async (req, res) => {
  try {
    const daftar = await storage.aset.riwayatAset(req.params.kode);
    res.json(daftar);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Gagal membaca riwayat aset.' });
  }
});

if (require.main === module) {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`Aplikasi Surat Serah Terima berjalan di http://localhost:${PORT} (mode: ${storage.mode})`);
  });
}

module.exports = app;

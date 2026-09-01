const express = require('express');
const path = require('path');
const config = require('./config');
const { nextNomor } = require('./lib/nomor');
const { bikinExcel } = require('./lib/excel');
const { buatPdf, dirPdf } = require('./lib/pdf');
const storage = require('./lib/storage');
const QRCode = require('qrcode');

const app = express();

// Rate limit sederhana in-memory: 120 req / menit per IP untuk /api
const rateMap = new Map();
const RATE_WINDOW = 60 * 1000;
const RATE_MAX = 120;
app.use('/api', (req, res, next) => {
  const ip = req.ip || req.connection.remoteAddress || 'unknown';
  const now = Date.now();
  const rec = rateMap.get(ip) || { count: 0, start: now };
  if (now - rec.start > RATE_WINDOW) {
    rec.count = 0;
    rec.start = now;
  }
  rec.count++;
  rateMap.set(ip, rec);
  if (rec.count > RATE_MAX) {
    return res.status(429).json({ error: 'Terlalu banyak permintaan, coba lagi nanti.' });
  }
  next();
});
setInterval(() => {
  const now = Date.now();
  for (const [k, v] of rateMap.entries()) {
    if (now - v.start > RATE_WINDOW * 2) rateMap.delete(k);
  }
}, RATE_WINDOW).unref();

app.use(express.json({ limit: '5mb' }));
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
// PDF arsip — tetap publik tapi hanya file .pdf yang di-serve; enumerasi dibatasi oleh nama yang tidak mudah ditebak (nomor surat)
app.use('/pdf', express.static(dirPdf(), { fallthrough: false }));

function validasiData(body) {
  const bersih = (v) => (typeof v === 'string' ? v.trim() : '');
  const data = {
    nama: bersih(body.nama),
    departemen: bersih(body.departemen),
    penerima: bersih(body.penerima),
    departemenPenerima: bersih(body.departemenPenerima),
    keterangan: bersih(body.keterangan),
    kategori: bersih(body.kategori),
    namaHrd: bersih(body.namaHrd),
  };
  const wajib = ['nama', 'departemen', 'penerima', 'departemenPenerima', 'keterangan'];
  const kosong = wajib.find((k) => !data[k]);
  if (kosong) return { error: 'Nama, departemen, dan keterangan (kedua pihak) wajib diisi.' };
  if (!['penyerahan', 'pengembalian'].includes(data.kategori)) return { error: 'Kategori tidak valid.' };
  const aset = Array.isArray(body.aset) ? body.aset : [];
  for (const k of aset) {
    if (typeof k !== 'string') return { error: 'Daftar aset tidak valid.' };
  }
  data.aset = [...new Set(aset.map((k) => k.trim()).filter(Boolean))];
  // cegah payload aset terlalu panjang
  if (data.aset.length > 50) return { error: 'Terlalu banyak aset (maks 50).' };
  return { data };
}

async function validasiKodeAsetAda(kodeAset) {
  if (!kodeAset || kodeAset.length === 0) return null;
  const semua = await storage.aset.daftarAset();
  const ada = new Set(semua.map((a) => String(a.kode)));
  const tidakAda = kodeAset.filter((k) => !ada.has(String(k)));
  if (tidakAda.length) return `Kode aset tidak ditemukan: ${tidakAda.join(', ')}`;
  return null;
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
      ? { kode: a.kode, nama: a.nama, kondisi: KONDISI_LABEL[a.kondisi] || a.kondisi, status: a.status, nilai: Number(a.nilai) || 0 }
      : { kode: String(k), nama: '', kondisi: '', status: '', nilai: 0 };
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

function ttdUrl(req, nomor, pihak) {
  // Prefer BASE_URL env agar tidak tergantung Host header (anti host-header injection)
  const baseEnv = process.env.BASE_URL ? String(process.env.BASE_URL).replace(/\/$/, '') : null;
  if (baseEnv) {
    let url = `${baseEnv}/ttd.html?nomor=${encodeURIComponent(String(nomor))}`;
    if (PIHAK_TTD.includes(pihak)) url += `&pihak=${encodeURIComponent(pihak)}`;
    return url;
  }
  const proto = req.headers['x-forwarded-proto'] || req.protocol || 'https';
  let host = req.get('host') || 'localhost';
  // sanitasi host: hanya huruf, angka, titik, dash, colon (port)
  host = String(host).replace(/[^a-zA-Z0-9.\-:]/g, '').slice(0, 200) || 'localhost';
  let url = `${proto}://${host}/ttd.html?nomor=${encodeURIComponent(String(nomor))}`;
  if (PIHAK_TTD.includes(pihak)) url += `&pihak=${encodeURIComponent(pihak)}`;
  return url;
}

function cariSurat(nomor) {
  return storage.bacaRiwayat().then((daftar) => daftar.find((r) => String(r.nomor) === String(nomor)));
}

function nomorTtdKey(nomor) {
  return String(nomor).replace(/[/\\]/g, '-');
}

function statusTtdDariMap(map, nomor) {
  const ada = map[nomorTtdKey(nomor)] || {};
  return {
    menyerahkan: !!ada.menyerahkan,
    menerima: !!ada.menerima,
    hrd: !!ada.hrd,
  };
}

async function aturStatusAset(nomorSurat, kodeLama, kodeBaru, kategori) {
  const [semua, daftar] = await Promise.all([storage.aset.kodeAsetPerNomor(), storage.bacaRiwayat()]);
  const aktif = new Set();
  for (const s of daftar) {
    if (s.kategori === 'penyerahan' && s.nomor !== nomorSurat) {
      (semua[s.nomor] || []).forEach((k) => aktif.add(String(k)));
    }
  }
  const kodeBaruSet = new Set((kodeBaru || []).map((k) => String(k)));
  const terkait = [...new Set([...(kodeLama || []), ...(kodeBaru || [])].map((k) => String(k)))];
  const perluDipakai = [];
  const perluTersedia = [];
  for (const k of terkait) {
    if (aktif.has(k) || (kodeBaruSet.has(k) && kategori === 'penyerahan')) perluDipakai.push(k);
    else perluTersedia.push(k);
  }
  if (perluDipakai.length) await storage.aset.aturStatus(perluDipakai, 'dipakai');
  if (perluTersedia.length) await storage.aset.aturStatus(perluTersedia, 'tersedia');
}

app.get('/api/riwayat/download', async (_req, res) => {
  try {
    const daftar = await storage.bacaRiwayat();
    const map = await storage.aset.kodeAsetPerNomor();
    daftar.forEach((s) => {
      s.aset = map[s.nomor] || [];
    });
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
    const pihak = PIHAK_TTD.includes(req.query.pihak) ? String(req.query.pihak) : null;
    const png = await QRCode.toBuffer(ttdUrl(req, req.params.nomor, pihak), {
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

    const kunci = Object.keys(ttdBaru);
    const nama = String(req.body && req.body.nama || '').trim();
    if (nama && kunci.length === 1 && kunci[0] === 'hrd') {
      surat.namaHrd = nama;
      await storage.updateRiwayat(surat.nomor, surat);
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
    const [kodeMap, ttd] = await Promise.all([
      storage.aset.kodeAsetPerNomor(),
      storage.ttd.muatTtd(surat.nomor),
    ]);
    const kodeAset = kodeMap[surat.nomor] || [];
    surat.aset = await ambilInfoAset(kodeAset);
    surat.ttd = ttdDataUrl(ttd);
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

app.get('/api/bootstrap', async (_req, res) => {
  try {
    const [daftar, map, ttdMap, aset] = await Promise.all([
      storage.bacaRiwayat(),
      storage.aset.kodeAsetPerNomor(),
      storage.ttd.statusSemuaTtd(),
      storage.aset.daftarAset(),
    ]);
    const riwayat = daftar.map((s) => ({
      ...s,
      aset: map[s.nomor] || [],
      ttd: statusTtdDariMap(ttdMap, s.nomor),
    }));
    res.json({
      config: {
        kota: config.kota,
        deptPengelola: config.deptPengelola,
        namaInstansi: config.namaInstansi,
        alamatInstansi: config.alamatInstansi,
        departemen: config.departemen || [],
      },
      riwayat,
      aset,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Gagal memuat data awal.' });
  }
});

app.get('/api/riwayat', async (_req, res) => {
  try {
    const [daftar, map, ttdMap] = await Promise.all([
      storage.bacaRiwayat(),
      storage.aset.kodeAsetPerNomor(),
      storage.ttd.statusSemuaTtd(),
    ]);
    const hasil = [];
    for (const s of daftar) {
      hasil.push({ ...s, aset: map[s.nomor] || [], ttd: statusTtdDariMap(ttdMap, s.nomor) });
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

    const kodeAset = hasil.data.aset || [];
    const errAset = await validasiKodeAsetAda(kodeAset);
    if (errAset) return res.status(400).json({ error: errAset });
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

    const kodeAset = hasil.data.aset || [];
    const errAset = await validasiKodeAsetAda(kodeAset);
    if (errAset) return res.status(400).json({ error: errAset });
    const kodeAsetLama = (await storage.aset.kodeAsetPerNomor())[lama.nomor] || [];
    const surat = { ...lama, ...hasil.data };
    await storage.updateRiwayat(lama.nomor, surat);

    await storage.aset.tautkanSurat(surat.nomor, kodeAset);
    await aturStatusAset(surat.nomor, kodeAsetLama, kodeAset, hasil.data.kategori);
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

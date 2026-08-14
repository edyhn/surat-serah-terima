const express = require('express');
const path = require('path');
const fs = require('fs');
const config = require('./config');
const { nextNomor } = require('./lib/nomor');
const { bikinExcel } = require('./lib/excel');
const { buatPdf, dirPdf } = require('./lib/pdf');
const storage = require('./lib/storage');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
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
    res.json(await storage.bacaRiwayat());
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Gagal membaca riwayat.' });
  }
});

app.post('/api/surat', async (req, res) => {
  try {
    const hasil = validasiData(req.body || {});
    if (hasil.error) return res.status(400).json({ error: hasil.error });

    const surat = await buatSurat(hasil.data);
    const namaFile = await simpanSuratDanPdf(surat);

    res.json({ ...surat, pdf: namaFile });
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

    const surat = { ...lama, ...hasil.data };
    await storage.updateRiwayat(lama.nomor, surat);
    const namaFile = await simpanSuratDanPdf(surat);

    res.json({ ...surat, pdf: namaFile });
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

    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Gagal menghapus data.' });
  }
});

if (require.main === module) {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`Aplikasi Surat Serah Terima berjalan di http://localhost:${PORT} (mode: ${storage.mode})`);
  });
}

module.exports = app;

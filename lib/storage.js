const excel = require('./excel');
const supabase = require('./storage-supabase');
const { ready } = require('./supabase');

const mode = ready ? 'supabase' : 'file';

let storage;
if (mode === 'supabase') {
  storage = {
    mode,
    tambahRiwayat: supabase.tambahRiwayat,
    bacaRiwayat: supabase.bacaRiwayat,
    updateRiwayat: supabase.updateRiwayat,
    hapusRiwayat: supabase.hapusRiwayat,
    fileRiwayat: () => null,
    simpanPdf: supabase.simpanPdf,
    ambilPdf: supabase.ambilPdf,
    hapusPdf: supabase.hapusPdf,
    buatBucket: async () => {},
  };
} else {
  storage = {
    mode,
    tambahRiwayat: excel.tambahRiwayat,
    bacaRiwayat: excel.bacaRiwayat,
    updateRiwayat: excel.updateRiwayat,
    hapusRiwayat: excel.hapusRiwayat,
    fileRiwayat: excel.fileRiwayat,
    simpanPdf: async (namaFile, buffer) => {
      const fs = require('fs');
      const path = require('path');
      const dir = require('./pdf').dirPdf();
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, namaFile), buffer);
    },
    ambilPdf: async (namaFile) => {
      const fs = require('fs');
      const path = require('path');
      return fs.readFileSync(path.join(require('./pdf').dirPdf(), namaFile));
    },
    hapusPdf: async (namaFile) => {
      const fs = require('fs');
      const path = require('path');
      const file = path.join(require('./pdf').dirPdf(), namaFile);
      if (fs.existsSync(file)) fs.unlinkSync(file);
    },
    buatBucket: async () => {},
  };
}

const asetImpl = mode === 'supabase' ? require('./aset-supabase') : require('./aset-file');

storage.aset = {
  ...asetImpl,
  async kodeAsetPerNomor() {
    const tautan = await asetImpl.semuaTautan();
    const map = {};
    tautan.forEach((t) => {
      const n = t.nomor_surat;
      if (!map[n]) map[n] = [];
      map[n].push(t.kode_aset);
    });
    return map;
  },
  async riwayatAset(kode) {
    const tautan = await asetImpl.semuaTautan();
    const nomorSet = new Set(
      tautan.filter((t) => String(t.kode_aset) === String(kode)).map((t) => t.nomor_surat)
    );
    const daftar = await storage.bacaRiwayat();
    return daftar.filter((s) => nomorSet.has(s.nomor));
  },
};

module.exports = storage;
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

module.exports = storage;
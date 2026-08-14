const fs = require('fs');
const path = require('path');

let FILE = process.env.NOMOR_FILE || path.join(__dirname, '../data/nomor.json');
const BULAN = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];

const MODE_SUPABASE = !!(process.env.SUPABASE_URL && (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY));

function aturFile(p) {
  FILE = p;
}

function baca() {
  if (MODE_SUPABASE) return {};
  try {
    return JSON.parse(fs.readFileSync(FILE, 'utf8'));
  } catch {
    return {};
  }
}

function simpan(data) {
  if (MODE_SUPABASE) return;
  fs.mkdirSync(path.dirname(FILE), { recursive: true });
  fs.writeFileSync(FILE, JSON.stringify(data, null, 2));
}

function formatTanggal(d) {
  return `${d.getDate()} ${BULAN[d.getMonth()]} ${d.getFullYear()}`;
}

function formatTanggalSingkat(d) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
}

function nextNomor(_kategori, daftarNomor = []) {
  const sekarang = new Date();
  const tahun = sekarang.getFullYear();

  // Hitung nomor terbesar yang sudah terpakai di riwayat (anti-duplikat)
  const pola = new RegExp(`^(\\d+)/SRT-ST/${tahun}$`);
  let maks = 0;
  daftarNomor.forEach((n) => {
    const m = pola.exec(String(n));
    if (m) maks = Math.max(maks, parseInt(m[1], 10));
  });

  const data = baca();
  const counter = typeof data[tahun] === 'number' ? data[tahun] : 0;
  const berikut = Math.max(counter, maks) + 1;
  data[tahun] = berikut;
  simpan(data);

  return {
    nomor: `${String(berikut).padStart(3, '0')}/SRT-ST/${tahun}`,
    tanggal: formatTanggal(sekarang),
    tanggalSingkat: formatTanggalSingkat(sekarang),
  };
}

module.exports = { nextNomor, aturFile };

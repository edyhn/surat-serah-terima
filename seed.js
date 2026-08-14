const { nextNomor } = require('./lib/nomor');
const { buatPdf } = require('./lib/pdf');
const storage = require('./lib/storage');

const NAMA = [
  'Edy Hartono Nasrah', 'Siti Aminah', 'Budi Santoso', 'Sri Wahyuni', 'Andi Wijaya',
  'Rina Puspita', 'Joko Susilo', 'Dewi Anggraini', 'Agus Salim', 'Fitri Handayani',
  'Rahmat Hidayat', 'Nurul Aini', 'Fajar Ramadhan', 'Lina Marlina', 'Hendra Gunawan',
  'Yanti Kusuma', 'Dedi Kurniawan', 'Ratna Sari', 'Yusuf Maulana', 'Maya Puspasari',
  'Rudi Hartono', 'Anisa Rahma', 'Taufik Hidayat', 'Wulan Suci', 'Imam Syafi\'i',
  'Citra Lestari', 'Bambang Pamungkas', 'Indah Permata', 'Galih Prakoso', 'Nia Kurnia',
];

const DEPARTEMEN = ['IT', 'Keuangan', 'HRD', 'Umum', 'Pemasaran', 'Produksi', 'Gudang'];

const BARANG = [
  'Laptop Asus VivoBook', 'Laptop Lenovo ThinkPad', 'Proyektor Epson EB-X41',
  'HP Android Samsung Galaxy A54', 'Printer Epson L3210', 'Monitor Dell 24 inci',
  'Keyboard Logitech K380', 'Mouse Wireless Logitech', 'Meja Kerja 120 cm',
  'Kursi Kantor Ergonomis', 'AC Split 1 PK', 'Kabel VGA 3 meter', 'Speaker Aktif',
  'Webcam Logitech C270', 'UPS APC 650VA', 'Switch 8 Port TP-Link', 'Scanner Canon LiDE 300',
  'Tablet Samsung Tab A7', 'Modem WiFi 4G', 'Headset Jabra Evolve 20',
];

const BULAN = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];

const pad = (n) => String(n).padStart(2, '0');
const acak = (arr) => arr[Math.floor(Math.random() * arr.length)];

function tanggalAcak() {
  // 50% hari ini, sisanya 1-120 hari lalu agar statistik "bulan ini" bervariasi
  if (Math.random() < 0.5) return new Date();
  const d = new Date();
  d.setDate(d.getDate() - Math.floor(Math.random() * 120) - 1);
  return d;
}

function formatTanggal(d) {
  return `${d.getDate()} ${BULAN[d.getMonth()]} ${d.getFullYear()}`;
}

function formatTanggalSingkat(d) {
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
}

function buatKeterangan(kategori) {
  const barang = acak(BARANG);
  if (kategori === 'penyerahan') {
    const detail = acak(['Unit Only', 'Unit + Charger', 'Unit + Aksesoris', 'Lengkap']);
    const kondisi = acak(['baik', 'bagus', 'berfungsi normal']);
    return `Penyerahan ${barang} (${detail}), dalam kondisi ${kondisi}`;
  }
  const keterangan = acak([
    'kondisi baik dan lengkap',
    'sesuai catatan serah terima',
    'berfungsi normal tanpa kerusakan',
  ]);
  return `Pengembalian ${barang}, ${keterangan}`;
}

async function main() {
  const jumlah = Math.min(Math.max(parseInt(process.argv[2] || '25', 10) || 25, 1), 200);

  await storage.buatBucket();
  const daftar = await storage.bacaRiwayat();
  const nomorTerpakai = daftar.map((r) => r.nomor);
  let penyerahan = 0;
  let pengembalian = 0;

  console.log(`Menambahkan ${jumlah} data contoh (mode: ${storage.mode})...`);
  for (let i = 0; i < jumlah; i++) {
    const kategori = Math.random() < 0.7 ? 'penyerahan' : 'pengembalian';
    const t = tanggalAcak();
    const s = nextNomor(kategori, nomorTerpakai);
    nomorTerpakai.push(s.nomor);

    const surat = {
      ...s,
      tanggal: formatTanggal(t),
      tanggalSingkat: formatTanggalSingkat(t),
      nama: acak(NAMA),
      departemen: acak(DEPARTEMEN),
      penerima: acak(NAMA),
      departemenPenerima: acak(DEPARTEMEN),
      keterangan: buatKeterangan(kategori),
      kategori,
    };

    await storage.tambahRiwayat(surat);
    const { namaFile, buffer } = await buatPdf(surat);
    await storage.simpanPdf(namaFile, buffer);

    if (kategori === 'penyerahan') penyerahan++;
    else pengembalian++;

    if ((i + 1) % 10 === 0) console.log(`  ${i + 1}/${jumlah}`);
  }

  console.log('Selesai.');
  console.log(`  Total data: ${(await storage.bacaRiwayat()).length}`);
  console.log(`  Penyerahan: ${penyerahan}`);
  console.log(`  Pengembalian: ${pengembalian}`);
  console.log('Buka http://localhost:3000 untuk melihat hasil.');
}

main().catch((err) => {
  console.error('Seeder gagal:', err);
  process.exit(1);
});

const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');
const { kota } = require('../config');

let DIR = process.env.PDF_DIR || path.join(__dirname, '../backups/pdf');

function dirPdf() {
  return DIR;
}

const CANDIDAT_FONT = [
  'C:/Windows/Fonts/arial.ttf',
  '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',
  '/usr/share/fonts/TTF/DejaVuSans.ttf',
];
const FONT = CANDIDAT_FONT.find((f) => fs.existsSync(f)) || 'Helvetica';

const CANDIDAT_FONT_BOLD = [
  'C:/Windows/Fonts/arialbd.ttf',
  '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf',
  '/usr/share/fonts/TTF/DejaVuSans-Bold.ttf',
];
const FONT_BOLD = CANDIDAT_FONT_BOLD.find((f) => fs.existsSync(f)) || 'Helvetica-Bold';

const PERNYATAAN = {
  penyerahan:
    'Dengan ini menyatakan bahwa barang/aset sebagaimana keterangan di atas TELAH DISERAHKAN oleh yang bersangkutan untuk diterima dan dikelola sesuai ketentuan yang berlaku.',
  pengembalian:
    'Dengan ini menyatakan bahwa barang/aset sebagaimana keterangan di atas TELAH DIKEMBALIKAN oleh yang bersangkutan dan telah diterima kembali dalam kondisi yang baik.',
};

const TINTA = '#111827';
const LABEL_BG = '#f3f4f6';

function formatRupiah(n) {
  const v = Number(n || 0);
  return 'Rp ' + v.toLocaleString('id-ID');
}

function ukuranPng(buf) {
  try {
    return { lebar: buf.readUInt32BE(16), tinggi: buf.readUInt32BE(20) };
  } catch {
    return { lebar: 50, tinggi: 15 };
  }
}

function gambarTabelIdentitas(doc, x, y, colW, rows) {
  const padX = 8;
  const padY = 6;
  let cy = y;
  doc.lineWidth(1);
  rows.forEach(([label, nilai]) => {
    const h = Math.max(23, doc.heightOfString(label, { width: colW[0] - padX * 2 }) + padY * 2);
    doc.fillColor(LABEL_BG);
    doc.rect(x, cy, colW[0], h).fill();
    doc.rect(x, cy, colW[0], h).strokeColor(TINTA).stroke();
    doc.rect(x + colW[0], cy, colW[1], h).strokeColor(TINTA).stroke();
    doc.fillColor(TINTA).font(FONT_BOLD).fontSize(10).text(label, x + padX, cy + padY, { width: colW[0] - padX * 2 });
    doc.fillColor(TINTA).font(FONT).fontSize(10).text(': ' + nilai, x + colW[0] + padX, cy + padY, { width: colW[1] - padX * 2 });
    cy += h;
  });
  return cy;
}

function gambarKotakBerjudul(doc, x, y, w, judul, isiTeks) {
  const pad = 10;
  const wIsi = w - pad * 2;
  doc.font(FONT_BOLD).fontSize(10);
  const hJudul = doc.heightOfString(judul, { width: wIsi });
  doc.font(FONT).fontSize(10);
  const hIsi = doc.heightOfString(isiTeks, { width: wIsi });
  const h = pad + hJudul + 5 + hIsi + pad;
  doc.lineWidth(1);
  doc.fillColor('#ffffff').rect(x, y, w, h).fill();
  doc.rect(x, y, w, h).strokeColor(TINTA).stroke();
  doc.fillColor(TINTA).font(FONT_BOLD).fontSize(10).text(judul, x + pad, y + pad, { width: wIsi });
  doc.fillColor(TINTA).font(FONT).fontSize(10).text(isiTeks, x + pad, y + pad + hJudul + 5, { width: wIsi });
  return y + h;
}

function tinggiTabelAset(doc, wIsi, aset) {
  const padX = 6;
  const padY = 5;
  const cw = [Math.round(wIsi * 0.3), Math.round(wIsi * 0.28), Math.round(wIsi * 0.25), wIsi - Math.round(wIsi * 0.3) - Math.round(wIsi * 0.28) - Math.round(wIsi * 0.25)];
  const sel = (teks, w) => Math.max(19, doc.heightOfString(String(teks), { width: w - padX * 2 }) + padY * 2);
  doc.font(FONT_BOLD).fontSize(9.5);
  let h = sel('Nama Aset', cw[1]);
  doc.font(FONT).fontSize(9.5);
  aset.forEach((a) => {
    h = Math.max(h, sel(a.kode, cw[0]), sel(a.nama || '', cw[1]), sel(formatRupiah(a.nilai), cw[2]), sel(a.kondisi || '', cw[3]));
  });
  return { cw, tinggiBaris: h, total: h * (aset.length + 1) };
}

function gambarKotakAset(doc, x, y, w, aset) {
  const pad = 10;
  const wIsi = w - pad * 2;
  const { cw, tinggiBaris, total } = tinggiTabelAset(doc, wIsi, aset);
  const hJudul = 13;
  const h = pad + hJudul + 6 + total + pad;
  doc.lineWidth(1);
  doc.fillColor('#ffffff').rect(x, y, w, h).fill();
  doc.rect(x, y, w, h).strokeColor(TINTA).stroke();
  doc.fillColor(TINTA).font(FONT_BOLD).fontSize(10).text('Aset', x + pad, y + pad, { width: wIsi });

  const tx = x + pad;
  let ty = y + pad + hJudul + 6;
  const header = ['Kode', 'Nama Aset', 'Nilai', 'Kondisi'];
  const baris = aset.map((a) => [a.kode, a.nama || '', formatRupiah(a.nilai), a.kondisi || '']);

  const gambarSel = (teks, cx, cwSel, tebal) => {
    doc.rect(cx, ty, cwSel, tinggiBaris).strokeColor(TINTA).stroke();
    doc.fillColor(TINTA).font(tebal ? FONT_BOLD : FONT).fontSize(9.5).text(String(teks), cx + 6, ty + 5, { width: cwSel - 12 });
  };
  header.forEach((hCell, i) => gambarSel(hCell, tx + cw.slice(0, i).reduce((a, b) => a + b, 0), cw[i], true));
  ty += tinggiBaris;
  baris.forEach((cells) => {
    cells.forEach((cCell, i) => gambarSel(cCell, tx + cw.slice(0, i).reduce((a, b) => a + b, 0), cw[i], false));
    ty += tinggiBaris;
  });
  return y + h;
}

function gambarKotakKategori(doc, x, y, w, kategori) {
  const pad = 10;
  const hJudul = 13;
  const barisH = 20;
  const h = pad + hJudul + 6 + barisH + pad;
  doc.lineWidth(1);
  doc.fillColor('#ffffff').rect(x, y, w, h).fill();
  doc.rect(x, y, w, h).strokeColor(TINTA).stroke();
  doc.fillColor(TINTA).font(FONT_BOLD).fontSize(10).text('Kategori', x + pad, y + pad, { width: w - pad * 2 });

  const cy = y + pad + hJudul + 6;
  const cek = 11;
  const cyBox = cy + (barisH - cek) / 2;
  const opsi = [
    { teks: 'Penyerahan', aktif: kategori === 'penyerahan', cx: x + pad },
    { teks: 'Pengembalian', aktif: kategori === 'pengembalian', cx: x + pad + 150 },
  ];
  opsi.forEach((o) => {
    doc.lineWidth(1).rect(o.cx, cyBox, cek, cek).strokeColor(TINTA).stroke();
    if (o.aktif) {
      doc.lineWidth(1)
        .moveTo(o.cx + 2, cyBox + 2).lineTo(o.cx + cek - 2, cyBox + cek - 2).strokeColor(TINTA).stroke()
        .moveTo(o.cx + cek - 2, cyBox + 2).lineTo(o.cx + 2, cyBox + cek - 2).strokeColor(TINTA).stroke();
    }
  });
  return y + h;
}

function gambarTtdKlasik(doc, x, y, w, s) {
  const colW = w / 3;
  const labels = ['Yang Menyerahkan,', 'Yang Menerima,', 'HRD,'];
  const namaTtd = [
    s.nama ? `(${s.nama})` : '(................)',
    s.penerima ? `(${s.penerima})` : '(................)',
    s.namaHrd ? `(${s.namaHrd})` : '(.............)',
  ];
  const kunciTtd = ['menyerahkan', 'menerima', 'hrd'];
  const yGaris = y + 78;

  // Fase grafis: garis tanda tangan + gambar (rasio aspek dipertahankan, duduk di atas garis)
  for (let i = 0; i < 3; i++) {
    const cx = x + i * colW + colW / 2;
    doc.lineWidth(0.8).strokeColor(TINTA)
      .moveTo(cx - 60, yGaris).lineTo(cx + 60, yGaris).stroke();
    const buf = s.ttd && s.ttd[kunciTtd[i]];
    if (buf) {
      const asli = ukuranPng(buf);
      const maksLebar = 110;
      const maksTinggi = 34;
      const skala = Math.min(maksLebar / asli.lebar, maksTinggi / asli.tinggi);
      const lebarImg = asli.lebar * skala;
      const tinggiImg = asli.tinggi * skala;
      doc.image(buf, cx - lebarImg / 2, yGaris - tinggiImg - 4, { width: lebarImg, height: tinggiImg });
    }
  }

  // Fase teks berurutan
  labels.forEach((label, i) => {
    doc.fillColor(TINTA).font(FONT).fontSize(10).text(label, x + i * colW, y, { width: colW, align: 'center' });
  });
  namaTtd.forEach((nama, i) => {
    doc.fillColor(TINTA).font(FONT).fontSize(10).text(nama, x + i * colW, yGaris + 8, { width: colW, align: 'center' });
  });
}

function gambarForm(doc, s) {
  const L = 46;
  const W = doc.page.width - L * 2;

  // Judul + garis tunggal
  doc.fillColor(TINTA).font(FONT_BOLD).fontSize(16).text('SURAT SERAH TERIMA', L, 40, {
    width: W,
    align: 'center',
    characterSpacing: 2.5,
  });
  doc.lineWidth(1.4).strokeColor(TINTA).moveTo(L, 68).lineTo(L + W, 68).stroke();

  // Baris nomor (kiri) dan kota, tanggal (kanan)
  let y = 84;
  doc.fillColor(TINTA).font(FONT).fontSize(10);
  doc.text(`Nomor      : ${s.nomor}`, L, y, { width: 280 });
  doc.text(`${kota}, ${s.tanggal}`, L + W - 220, y, { width: 220, align: 'right' });
  y += 24;

  doc.text('Telah diterima dari :', L, y, { width: W });
  y += 18;

  // Tabel identitas
  const colW1 = 165;
  y = gambarTabelIdentitas(doc, L, y, [colW1, W - colW1], [
    ['Nama yang Menyerahkan', s.nama],
    ['Departemen Penyerah', s.departemen],
    ['Nama yang Menerima', s.penerima],
    ['Departemen Penerima', s.departemenPenerima],
  ]);
  y += 14;

  // Kotak keterangan
  y = gambarKotakBerjudul(doc, L, y, W, 'Keterangan', s.keterangan);
  y += 14;

  // Kotak aset (tabel dalam: Kode, Nama Aset, Nilai, Kondisi)
  if (s.aset && s.aset.length) {
    y = gambarKotakAset(doc, L, y, W, s.aset);
    y += 12;
  }

  // Pernyataan (frasa kunci dicetak tebal, mengalir inline)
  const tebal = s.kategori === 'penyerahan' ? 'TELAH DISERAHKAN' : 'TELAH DIKEMBALIKAN';
  const [sebelum, ...sisa] = PERNYATAAN[s.kategori].split(tebal);
  doc.fillColor(TINTA).font(FONT).fontSize(10).text(sebelum, L, y, { width: W, continued: true });
  doc.font(FONT_BOLD).text(tebal, { continued: true });
  doc.font(FONT).text(sisa.join(tebal), { width: W });
  y = doc.y + 14;

  // Kotak kategori (checkbox)
  y = gambarKotakKategori(doc, L, y, W, s.kategori);
  y += 38;

  // Tanda tangan klasik 3 kolom
  const tinggiTtd = 104;
  if (y + tinggiTtd > doc.page.height - 40) {
    doc.addPage();
    y = 56;
  }
  gambarTtdKlasik(doc, L, y, W, s);
}

function buatPdf(s) {
  return new Promise((resolve, reject) => {
    const namaFile = s.nomor.replace(/[/\\]/g, '-') + '.pdf';
    const doc = new PDFDocument({ size: 'A4', margin: 50 });
    const chunks = [];
    doc.on('data', (c) => chunks.push(c));
    doc.on('end', () => resolve({ namaFile, buffer: Buffer.concat(chunks) }));
    doc.on('error', reject);
    if (FONT) doc.font(FONT);

    gambarForm(doc, s);
    doc.end();
  });
}

module.exports = { buatPdf, dirPdf };

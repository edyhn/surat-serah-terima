const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');
const { kota, deptPengelola } = require('../config');

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

function gambarTabel(doc, x, y, colW, rows, padY) {
  const padX = 8;
  let cy = y;
  rows.forEach((cells) => {
    let h = 18;
    cells.forEach((c, i) => {
      h = Math.max(h, doc.heightOfString(String(c), { width: colW[i] - padX * 2 }) + padY * 2);
    });
    let cx = x;
    cells.forEach((c, i) => {
      doc.rect(cx, cy, colW[i], h).stroke();
      if (i === 0) doc.font(FONT_BOLD).fontSize(10);
      else doc.font(FONT).fontSize(10);
      doc.text(String(c), cx + padX, cy + padY, { width: colW[i] - padX * 2 });
      cx += colW[i];
    });
    cy += h;
  });
  return cy;
}

function gambarKotak(doc, x, y, w, judul, isi, hMin) {
  const padX = 8;
  const padY = 5;
  const wIsi = w - padX * 2;
  const hJudul = doc.heightOfString(judul, { width: wIsi });
  const hIsi = doc.heightOfString(isi, { width: wIsi });
  const h = Math.max(hMin, padY + hJudul + padY + hIsi + padY);
  doc.lineWidth(0.9);
  doc.rect(x, y, w, h).stroke();
  doc.font(FONT_BOLD).fontSize(10).text(judul, x + padX, y + padY, { width: wIsi });
  doc.font(FONT).fontSize(10).text(isi, x + padX, y + padY + hJudul + padY, { width: wIsi, align: 'justify' });
  return y + h;
}

function gambarCheckbox(doc, x, y, ukuran, cek) {
  doc.lineWidth(0.9);
  doc.rect(x, y, ukuran, ukuran).stroke();
  if (cek) {
    doc.moveTo(x + 2, y + 2).lineTo(x + ukuran - 2, y + ukuran - 2).lineWidth(0.9).stroke();
    doc.moveTo(x + ukuran - 2, y + 2).lineTo(x + 2, y + ukuran - 2).lineWidth(0.9).stroke();
  }
}

function gambarKategori(doc, x, y, w, cekPS, cekPK) {
  const padX = 8;
  const padY = 5;
  const wIsi = w - padX * 2;
  const hJudul = doc.heightOfString('Kategori', { width: wIsi });
  const barisH = 16;
  const h = padY + hJudul + padY + barisH + padY;
  doc.lineWidth(0.9);
  doc.rect(x, y, w, h).stroke();
  doc.font(FONT_BOLD).fontSize(10).text('Kategori', x + padX, y + padY, { width: wIsi });

  const cy = y + padY + hJudul + padY;
  const cek = 11;
  const cyBox = cy + (barisH - cek) / 2;

  let cx = x + padX;
  gambarCheckbox(doc, cx, cyBox, cek, cekPS);
  doc.font(FONT).fontSize(10).text('Penyerahan', cx + cek + 6, cy, { width: 100 });

  cx = x + 210;
  gambarCheckbox(doc, cx, cyBox, cek, cekPK);
  doc.font(FONT).fontSize(10).text('Pengembalian', cx + cek + 6, cy, { width: 110 });

  return y + h;
}

function gambarForm(doc, s) {
  const L = 50;
  const W = doc.page.width - 100;

  doc.font(FONT_BOLD).fontSize(16).text('SURAT SERAH TERIMA', L, 45, { width: W, align: 'center', characterSpacing: 2 });
  const yG1 = 72;
  doc.moveTo(L, yG1).lineTo(L + W, yG1).lineWidth(1.2).stroke();
  doc.moveTo(L, yG1 + 3).lineTo(L + W, yG1 + 3).lineWidth(0.4).stroke();

  doc.font(FONT).fontSize(10);
  doc.text(`Nomor     : ${s.nomor}`, L, yG1 + 10, { width: 300 });
  doc.text(`${kota}, ${s.tanggal}`, L + W - 200, yG1 + 10, { width: 200, align: 'right' });

  let y = yG1 + 26;
  doc.text('Telah terima Dari :', L, y, { width: W });
  y += 18;

  doc.lineWidth(0.9);
  const colW1 = 160;
  const colW2 = W - colW1;
  const barisIdentitas = [
    ['Nama yang Menyerahkan', s.nama],
    ['Departemen Penyerah', s.departemen],
    ['Nama yang Menerima', s.penerima],
    ['Departemen Penerima', s.departemenPenerima],
  ];
  y = gambarTabel(doc, L, y, [colW1, colW2], barisIdentitas, 5);
  y += 10;

  y = gambarKotak(doc, L, y, W, 'Keterangan', s.keterangan, 34);
  y += 10;

  if (s.aset && s.aset.length) {
    const barisAset = [['Kode', 'Nama Aset', 'Kondisi']];
    s.aset.forEach((a) => barisAset.push([a.kode, a.nama || '', a.kondisi || '']));
    y = gambarTabel(doc, L, y, [130, W - 200, 70], barisAset, 5);
    y += 10;
  }

  doc.font(FONT).fontSize(10).text(PERNYATAAN[s.kategori], L, y, { width: W - 20, align: 'justify' });
  y = doc.y + 10;

  const cekPS = s.kategori === 'penyerahan';
  const cekPK = s.kategori === 'pengembalian';
  y = gambarKategori(doc, L, y, W, cekPS, cekPK);

  y += 16;
  if (y + 130 > doc.page.height - 50) doc.addPage();

  const colWidth = (doc.page.width - 120) / 3;
  const labels = ['Yang Menyerahkan,', 'Yang Menerima,', 'HRD,'];
  const namaTtd = [`(${s.nama})`, `(${s.penerima})`, '(................)'];
  doc.font(FONT).fontSize(10);
  labels.forEach((label, i) => {
    doc.text(label, 50 + i * colWidth, y, { width: colWidth, align: 'center' });
  });
  const yLine = y + 90;
  namaTtd.forEach((n, i) => {
    const cx = 50 + i * colWidth + colWidth / 2;
    doc.lineWidth(0.8);
    doc.moveTo(cx - 60, yLine).lineTo(cx + 60, yLine).stroke();
  });
  const yNama = yLine + 14;
  namaTtd.forEach((n, i) => {
    doc.text(n, 50 + i * colWidth, yNama, { width: colWidth, align: 'center' });
  });
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

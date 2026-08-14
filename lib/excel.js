const ExcelJS = require('exceljs');
const fs = require('fs');
const path = require('path');

let FILE = process.env.EXCEL_FILE || path.join(__dirname, '../backups/riwayat.xlsx');

let antrian = Promise.resolve();
function seri(fn) {
  const jalan = antrian.then(fn, fn);
  antrian = jalan.catch(() => {});
  return jalan;
}

function aturFile(p) {
  FILE = p;
}

function fileRiwayat() {
  return FILE;
}

const KOLOM_DEF = [
  { header: 'No', key: 'no', width: 6 },
  { header: 'No Surat', key: 'nomor', width: 20 },
  { header: 'Tanggal', key: 'tanggal', width: 18 },
  { header: 'Tanggal Singkat', key: 'tanggalSingkat', width: 16 },
  { header: 'Kategori', key: 'kategori', width: 15 },
  { header: 'Nama', key: 'nama', width: 25 },
  { header: 'Departemen', key: 'departemen', width: 15 },
  { header: 'Penerima', key: 'penerima', width: 25 },
  { header: 'Dept. Penerima', key: 'departemenPenerima', width: 15 },
  { header: 'Keterangan', key: 'keterangan', width: 45 },
];

const BORDER = {
  top: { style: 'thin' },
  left: { style: 'thin' },
  bottom: { style: 'thin' },
  right: { style: 'thin' },
};

const HEADER_FILL = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F4E78' } };
const BAND_FILL = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF2F7FB' } };

const KOLOM_HEADER = KOLOM_DEF.map((k) => k.header);

function beriStyle(ws) {
  const lastCol = KOLOM_DEF.length;
  const lastRow = ws.rowCount;

  const header = ws.getRow(1);
  header.height = 22;
  header.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
  header.fill = HEADER_FILL;
  header.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
  header.eachCell((c) => {
    c.border = BORDER;
  });

  for (let i = 2; i <= lastRow; i++) {
    const row = ws.getRow(i);
    row.height = 26;
    row.eachCell((c) => {
      c.border = BORDER;
      if (i % 2 === 0) c.fill = BAND_FILL;
    });
    row.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' };
    row.getCell(2).alignment = { horizontal: 'center', vertical: 'middle' };
    row.getCell(3).alignment = { horizontal: 'center', vertical: 'middle' };
    row.getCell(4).alignment = { horizontal: 'center', vertical: 'middle' };
    row.getCell(5).alignment = { horizontal: 'center', vertical: 'middle' };
    row.getCell(10).alignment = { vertical: 'top', wrapText: true };
  }

  ws.views = [{ state: 'frozen', ySplit: 1 }];
  if (lastRow > 1) {
    ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: lastRow, column: lastCol } };
  }
}

async function bukaWorkbook() {
  const wb = new ExcelJS.Workbook();
  let ws;
  if (fs.existsSync(FILE)) {
    await wb.xlsx.readFile(FILE);
    ws = wb.getWorksheet('Riwayat') || wb.addWorksheet('Riwayat');
    ws.columns = KOLOM_DEF.map((k) => ({ header: k.header, width: k.width }));
  } else {
    ws = wb.addWorksheet('Riwayat');
    ws.columns = KOLOM_DEF.map((k) => ({ header: k.header, width: k.width }));
  }
  return { wb, ws };
}

function barisKeSurat(r) {
  return {
    no: r.getCell(1).value,
    nomor: r.getCell(2).value,
    tanggal: r.getCell(3).value,
    tanggalSingkat: r.getCell(4).value,
    kategori: r.getCell(5).value,
    nama: r.getCell(6).value,
    departemen: r.getCell(7).value,
    penerima: r.getCell(8).value,
    departemenPenerima: r.getCell(9).value,
    keterangan: r.getCell(10).value,
  };
}

function aturNomorUrut(ws) {
  let n = 0;
  ws.eachRow((r, i) => {
    if (i === 1) return;
    n += 1;
    r.getCell(1).value = n;
  });
}

function cariBaris(ws, nomor) {
  let found = null;
  ws.eachRow((r, i) => {
    if (i === 1) return;
    if (String(r.getCell(2).value) === String(nomor)) found = { row: r, index: i };
  });
  return found;
}

async function tambahRiwayat(s) {
  return seri(async () => {
    fs.mkdirSync(path.dirname(FILE), { recursive: true });
    const { wb, ws } = await bukaWorkbook();
    const no = ws.rowCount;
    ws.addRow([no, s.nomor, s.tanggal, s.tanggalSingkat, s.kategori, s.nama, s.departemen, s.penerima, s.departemenPenerima, s.keterangan]);
    beriStyle(ws);
    await wb.xlsx.writeFile(FILE);
  });
}

async function updateRiwayat(nomor, s) {
  return seri(async () => {
    if (!fs.existsSync(FILE)) return null;
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.readFile(FILE);
    const ws = wb.getWorksheet('Riwayat');
    if (!ws) return null;
    const found = cariBaris(ws, nomor);
    if (!found) return null;
    const { row } = found;
    row.getCell(2).value = s.nomor;
    row.getCell(3).value = s.tanggal;
    row.getCell(4).value = s.tanggalSingkat;
    row.getCell(5).value = s.kategori;
    row.getCell(6).value = s.nama;
    row.getCell(7).value = s.departemen;
    row.getCell(8).value = s.penerima;
    row.getCell(9).value = s.departemenPenerima;
    row.getCell(10).value = s.keterangan;
    beriStyle(ws);
    await wb.xlsx.writeFile(FILE);
    return barisKeSurat(row);
  });
}

async function hapusRiwayat(nomor) {
  return seri(async () => {
    if (!fs.existsSync(FILE)) return false;
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.readFile(FILE);
    const ws = wb.getWorksheet('Riwayat');
    if (!ws) return false;
    const found = cariBaris(ws, nomor);
    if (!found) return false;
    ws.spliceRows(found.index, 1);
    aturNomorUrut(ws);
    beriStyle(ws);
    await wb.xlsx.writeFile(FILE);
    return true;
  });
}

async function bacaRiwayat() {
  return seri(async () => {
    if (!fs.existsSync(FILE)) return [];
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.readFile(FILE);
    const ws = wb.getWorksheet('Riwayat');
    if (!ws) return [];
    const out = [];
    ws.eachRow((r, i) => {
      if (i === 1) return;
      out.push(barisKeSurat(r));
    });
    return out.reverse();
  });
}

async function bikinExcel(daftar) {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Riwayat');
  ws.columns = KOLOM_DEF.map((k) => ({ header: k.header, width: k.width }));
  const urut = [...daftar].reverse();
  urut.forEach((s, i) => {
    ws.addRow([i + 1, s.nomor, s.tanggal, s.tanggalSingkat, s.kategori, s.nama, s.departemen, s.penerima, s.departemenPenerima, s.keterangan]);
  });
  beriStyle(ws);
  return wb.xlsx.writeBuffer();
}

module.exports = { tambahRiwayat, bacaRiwayat, updateRiwayat, hapusRiwayat, bikinExcel, aturFile, fileRiwayat };

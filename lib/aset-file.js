const fs = require('fs');
const path = require('path');

let FILE_ASET = process.env.ASET_FILE || path.join(__dirname, '../data/aset.json');
let FILE_TAUTAN = process.env.SURAT_ASET_FILE || path.join(__dirname, '../data/surat_aset.json');

let antrian = Promise.resolve();
function seri(fn) {
  const jalan = antrian.then(fn, fn);
  antrian = jalan.catch(() => {});
  return jalan;
}

function bacaJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return [];
  }
}

function tulisJson(file, data) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

function daftarAset() {
  return seri(async () =>
    bacaJson(FILE_ASET).sort((a, b) => String(a.kode).localeCompare(String(b.kode)))
  );
}

function tambahAset(a) {
  return seri(async () => {
    const arr = bacaJson(FILE_ASET);
    if (arr.some((x) => String(x.kode) === String(a.kode))) {
      throw Object.assign(new Error('Kode aset sudah dipakai.'), { code: 'DUP' });
    }
    const baru = { ...a, kode: String(a.kode).trim() };
    arr.push(baru);
    tulisJson(FILE_ASET, arr);
    return baru;
  });
}

function updateAset(kode, a) {
  return seri(async () => {
    const arr = bacaJson(FILE_ASET);
    const i = arr.findIndex((x) => String(x.kode) === String(kode));
    if (i < 0) return null;
    const baru = { ...arr[i], ...a, kode: String(a.kode || kode) };
    arr[i] = baru;
    tulisJson(FILE_ASET, arr);
    return baru;
  });
}

function hapusAset(kode) {
  return seri(async () => {
    const arr = bacaJson(FILE_ASET);
    const baru = arr.filter((x) => String(x.kode) !== String(kode));
    if (baru.length === arr.length) return false;
    tulisJson(FILE_ASET, baru);
    const taut = bacaJson(FILE_TAUTAN).filter((t) => String(t.kode_aset) !== String(kode));
    tulisJson(FILE_TAUTAN, taut);
    return true;
  });
}

function aturStatus(kodeAset, status) {
  return seri(async () => {
    const set = new Set((kodeAset || []).map((k) => String(k).trim()).filter(Boolean));
    if (set.size === 0) return;
    const arr = bacaJson(FILE_ASET);
    let berubah = false;
    arr.forEach((a) => {
      if (set.has(String(a.kode))) {
        a.status = status;
        berubah = true;
      }
    });
    if (berubah) tulisJson(FILE_ASET, arr);
  });
}

function tautkanSurat(nomor, kodeAset) {
  return seri(async () => {
    const kodes = [...new Set((kodeAset || []).map((k) => String(k).trim()).filter(Boolean))];
    const taut = bacaJson(FILE_TAUTAN).filter((t) => String(t.nomor_surat) !== String(nomor));
    kodes.forEach((k) => taut.push({ nomor_surat: String(nomor), kode_aset: k }));
    tulisJson(FILE_TAUTAN, taut);
  });
}

function hapusTautanSurat(nomor) {
  return seri(async () => {
    const taut = bacaJson(FILE_TAUTAN).filter((t) => String(t.nomor_surat) !== String(nomor));
    tulisJson(FILE_TAUTAN, taut);
  });
}

function semuaTautan() {
  return seri(async () => bacaJson(FILE_TAUTAN));
}

module.exports = {
  daftarAset,
  tambahAset,
  updateAset,
  hapusAset,
  aturStatus,
  tautkanSurat,
  hapusTautanSurat,
  semuaTautan,
};

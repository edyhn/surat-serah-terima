const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const excel = require('../lib/excel');

const file = path.join(os.tmpdir(), 'riwayat-test.xlsx');
const contoh = () => ({
  nomor: '001/BT-PS/2026',
  tanggal: '13 Agustus 2026',
  tanggalSingkat: '13/08/2026',
  kategori: 'penyerahan',
  nama: 'Edy',
  departemen: 'HCM',
  penerima: 'Isti',
  departemenPenerima: 'FAT',
  keterangan: 'Laptop Asus',
});

function segar() {
  excel.aturFile(file);
  fs.rmSync(file, { force: true });
}

test('excel: tambah & baca (terbaru dulu)', async () => {
  segar();
  await excel.tambahRiwayat(contoh());
  await excel.tambahRiwayat({ ...contoh(), nomor: '002/BT-PS/2026', kategori: 'pengembalian' });
  const list = await excel.bacaRiwayat();
  assert.equal(list.length, 2);
  assert.equal(list[0].no, 2);
  assert.equal(list[0].nomor, '002/BT-PS/2026');
  assert.equal(list[0].kategori, 'pengembalian');
});

test('excel: update data', async () => {
  segar();
  await excel.tambahRiwayat(contoh());
  await excel.updateRiwayat('001/BT-PS/2026', { ...contoh(), keterangan: 'Diubah' });
  const list = await excel.bacaRiwayat();
  assert.equal(list[0].keterangan, 'Diubah');
});

test('excel: hapus & nomor urut diurutkan ulang', async () => {
  segar();
  await excel.tambahRiwayat(contoh());
  await excel.tambahRiwayat({ ...contoh(), nomor: '002/BT-PS/2026' });
  await excel.tambahRiwayat({ ...contoh(), nomor: '003/BT-PS/2026' });
  await excel.hapusRiwayat('002/BT-PS/2026');
  const list = await excel.bacaRiwayat();
  assert.equal(list.length, 2);
  assert.deepEqual(list.map((r) => r.no).sort((a, b) => a - b), [1, 2]);
});

test('excel: hapus nomor yang tidak ada mengembalikan false', async () => {
  segar();
  await excel.tambahRiwayat(contoh());
  assert.equal(await excel.hapusRiwayat('999/BT-PS/2026'), false);
});

test('excel: tulis paralel tidak kehilangan data', async () => {
  segar();
  const semua = Array.from({ length: 10 }, (_, i) => ({
    ...contoh(),
    nomor: `${String(i + 1).padStart(3, '0')}/SRT-ST/2026`,
  }));
  await Promise.all(semua.map((d) => excel.tambahRiwayat(d)));
  const list = await excel.bacaRiwayat();
  assert.equal(list.length, 10);
});

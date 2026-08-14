const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { nextNomor, aturFile } = require('../lib/nomor');

const tahun = new Date().getFullYear();
const file = path.join(os.tmpdir(), 'nomor-test.json');
const st = (n) => `${String(n).padStart(3, '0')}/SRT-ST/${tahun}`;

function segar() {
  aturFile(file);
  fs.rmSync(file, { force: true });
}

test('nomor: urutan awal berurutan lintas kategori', () => {
  segar();
  assert.equal(nextNomor('penyerahan', []).nomor, st(1));
  assert.equal(nextNomor('pengembalian', []).nomor, st(2));
  assert.equal(nextNomor('penyerahan', []).nomor, st(3));
});

test('nomor: anti-duplikat dari daftar riwayat', () => {
  segar();
  const daftar = [st(1), st(2), st(3)];
  assert.equal(nextNomor('penyerahan', daftar).nomor, st(4));
});

test('nomor: counter hilang tapi riwayat sudah ada nomor besar', () => {
  segar();
  const daftar = [st(1), st(5)];
  assert.equal(nextNomor('penyerahan', daftar).nomor, st(6));
});

test('nomor: tahun lain tidak memengaruhi tahun berjalan', () => {
  segar();
  const daftar = [`009/SRT-ST/${tahun - 1}`, st(3)];
  assert.equal(nextNomor('penyerahan', daftar).nomor, st(4));
});

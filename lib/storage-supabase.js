const { supabase, ready, BUCKET } = require('./supabase');

function pastikan() {
  if (!ready) throw new Error('Supabase belum dikonfigurasi (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY).');
  return supabase;
}

let bucketSiap = false;

async function pastikanBucket() {
  if (!ready || bucketSiap) return;
  try {
    const { error } = await supabase.storage.createBucket(BUCKET, { public: true });
    if (error && !/already exists|exists|duplicate/i.test(String(error.message))) throw error;
  } catch (e) {
    if (!/already exists|exists|duplicate/i.test(String(e.message))) throw e;
  }
  bucketSiap = true;
}

function barisKeSurat(r) {
  return {
    no: r.urut,
    nomor: r.nomor,
    tanggal: r.tanggal,
    tanggalSingkat: r.tanggal_singkat,
    kategori: r.kategori,
    nama: r.nama,
    departemen: r.departemen,
    penerima: r.penerima,
    departemenPenerima: r.departemen_penerima,
    keterangan: r.keterangan,
  };
}

async function bacaRiwayat() {
  const sb = pastikan();
  const { data, error } = await sb
    .from('surat')
    .select('*')
    .order('created_at', { ascending: false })
    .order('id', { ascending: false });
  if (error) throw error;
  const total = data.length;
  return data.map((r, i) => barisKeSurat({ ...r, urut: total - i }));
}

async function tambahRiwayat(s) {
  const sb = pastikan();
  const { error } = await sb.from('surat').insert({
    nomor: s.nomor,
    tanggal: s.tanggal,
    tanggal_singkat: s.tanggalSingkat,
    kategori: s.kategori,
    nama: s.nama,
    departemen: s.departemen,
    penerima: s.penerima,
    departemen_penerima: s.departemenPenerima,
    keterangan: s.keterangan,
  });
  if (error) throw error;
}

async function updateRiwayat(nomor, s) {
  const sb = pastikan();
  const { data, error } = await sb
    .from('surat')
    .update({
      nomor: s.nomor,
      tanggal: s.tanggal,
      tanggal_singkat: s.tanggalSingkat,
      kategori: s.kategori,
      nama: s.nama,
      departemen: s.departemen,
      penerima: s.penerima,
      departemen_penerima: s.departemenPenerima,
      keterangan: s.keterangan,
    })
    .eq('nomor', nomor)
    .select();
  if (error) throw error;
  if (!data || data.length === 0) return null;
  return barisKeSurat({ ...data[0], urut: 1 });
}

async function hapusRiwayat(nomor) {
  const sb = pastikan();
  const { error, count } = await sb.from('surat').delete({ count: 'exact' }).eq('nomor', nomor);
  if (error) throw error;
  return count > 0;
}

async function simpanPdf(namaFile, buffer) {
  const sb = pastikan();
  await pastikanBucket();
  const { error } = await sb.storage
    .from(BUCKET)
    .upload(namaFile, buffer, { contentType: 'application/pdf', upsert: true });
  if (error) throw error;
}

async function ambilPdf(namaFile) {
  const sb = pastikan();
  await pastikanBucket();
  const { data, error } = await sb.storage.from(BUCKET).download(pathSegar(namaFile));
  if (error) throw error;
  return Buffer.from(await data.arrayBuffer());
}

async function hapusPdf(namaFile) {
  const sb = pastikan();
  await pastikanBucket();
  const { error } = await sb.storage.from(BUCKET).remove([namaFile]);
  if (error) throw error;
}

const PARTY_TTD = ['menyerahkan', 'menerima', 'hrd'];

let pembaruCache = 0;

function pathSegar(p) {
  pembaruCache++;
  return `${p}?v=${Date.now()}-${pembaruCache}`;
}

function namaTtd(nomor, pihak) {
  return `ttd/${String(nomor).replace(/[/\\]/g, '-')}-${pihak}.png`;
}

async function simpanTtd(nomor, pihak, buffer) {
  const sb = pastikan();
  await pastikanBucket();
  const path = namaTtd(nomor, pihak);
  const { error } = await sb.storage.from(BUCKET).update(path, buffer, { contentType: 'image/png' });
  if (error) {
    const { error: errUpload } = await sb.storage
      .from(BUCKET)
      .upload(path, buffer, { contentType: 'image/png', upsert: true });
    if (errUpload) throw errUpload;
  }
}

async function muatTtd(nomor) {
  const sb = pastikan();
  await pastikanBucket();
  const out = {};
  for (const pihak of PARTY_TTD) {
    const { data, error } = await sb.storage.from(BUCKET).download(pathSegar(namaTtd(nomor, pihak)));
    if (data && !error) out[pihak] = Buffer.from(await data.arrayBuffer());
  }
  return out;
}

async function statusTtd(nomor) {
  const sb = pastikan();
  await pastikanBucket();
  const { data, error } = await sb.storage.from(BUCKET).list('ttd');
  if (error) return {};
  const ada = new Set((data || []).map((f) => f.name));
  const out = {};
  for (const pihak of PARTY_TTD) out[pihak] = ada.has(namaTtd(nomor, pihak).slice(4));
  return out;
}

async function hapusTtd(nomor) {
  const sb = pastikan();
  await pastikanBucket();
  const { error } = await sb.storage
    .from(BUCKET)
    .remove(PARTY_TTD.map((pihak) => namaTtd(nomor, pihak)));
  if (error) throw error;
}

module.exports = {
  bacaRiwayat,
  tambahRiwayat,
  updateRiwayat,
  hapusRiwayat,
  simpanPdf,
  ambilPdf,
  hapusPdf,
  simpanTtd,
  muatTtd,
  statusTtd,
  hapusTtd,
};

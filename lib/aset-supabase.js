const { supabase, ready } = require('./supabase');

function pastikan() {
  if (!ready) throw new Error('Supabase belum dikonfigurasi.');
  return supabase;
}

async function daftarAset() {
  const { data, error } = await pastikan().from('aset').select('*').order('kode', { ascending: true });
  if (error) throw error;
  return data || [];
}

async function tambahAset(a) {
  const { data, error } = await pastikan()
    .from('aset')
    .insert({
      kode: a.kode,
      nama: a.nama,
      kategori: a.kategori || '',
      nilai: a.nilai || 0,
      kondisi: a.kondisi || 'baik',
      status: a.status || 'tersedia',
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

async function updateAset(kode, a) {
  const { data, error } = await pastikan()
    .from('aset')
    .update({
      kode: a.kode,
      nama: a.nama,
      kategori: a.kategori || '',
      nilai: a.nilai || 0,
      kondisi: a.kondisi || 'baik',
      status: a.status || 'tersedia',
    })
    .eq('kode', kode)
    .select();
  if (error) throw error;
  if (!data || data.length === 0) return null;
  return data[0];
}

async function hapusAset(kode) {
  const { error, count } = await pastikan().from('aset').delete({ count: 'exact' }).eq('kode', kode);
  if (error) throw error;
  if (count > 0) {
    const { error: e2 } = await pastikan().from('surat_aset').delete().eq('kode_aset', kode);
    if (e2) throw e2;
  }
  return count > 0;
}

async function aturStatus(kodeAset, status) {
  const k = [...new Set((kodeAset || []).map((x) => String(x).trim()).filter(Boolean))];
  if (k.length === 0) return;
  const { error } = await pastikan().from('aset').update({ status }).in('kode', k);
  if (error) throw error;
}

async function tautkanSurat(nomor, kodeAset) {
  const sb = pastikan();
  const { error: e1 } = await sb.from('surat_aset').delete().eq('nomor_surat', nomor);
  if (e1) throw e1;
  const kodes = [...new Set((kodeAset || []).map((x) => String(x).trim()).filter(Boolean))];
  if (kodes.length === 0) return;
  const baris = kodes.map((k) => ({ nomor_surat: String(nomor), kode_aset: k }));
  const { error: e2 } = await sb.from('surat_aset').insert(baris);
  if (e2) throw e2;
}

async function hapusTautanSurat(nomor) {
  const { error } = await pastikan().from('surat_aset').delete().eq('nomor_surat', nomor);
  if (error) throw error;
}

async function semuaTautan() {
  const { data, error } = await pastikan().from('surat_aset').select('nomor_surat, kode_aset');
  if (error) throw error;
  return data || [];
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

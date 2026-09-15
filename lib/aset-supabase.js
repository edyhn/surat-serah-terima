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

async function ambilAset(kode) {
  const { data, error } = await pastikan().from('aset').select('*').eq('kode', kode).single();
  if (error) return null;
  return data;
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
      owner_id: a.owner_id || null,
      pic_ids: a.pic_ids || [],
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

async function updateAset(kode, a, predicate) {
  const db = pastikan();
  if (predicate) {
    const { data: existing, error: e1 } = await db.from('aset').select('*').eq('kode', kode).single();
    if (e1 || !existing) return null;
    if (!predicate(existing)) {
      throw Object.assign(new Error('Scope mismatch.'), { code: 'SCOPE' });
    }
  }
  const { data, error } = await db
    .from('aset')
    .update({
      nama: a.nama,
      kategori: a.kategori || '',
      nilai: a.nilai || 0,
      kondisi: a.kondisi || 'baik',
    })
    .eq('kode', kode)
    .select();
  if (error) throw error;
  if (!data || data.length === 0) return null;
  return data[0];
}

async function hapusAset(kode, predicate) {
  const db = pastikan();
  if (predicate) {
    const { data: existing, error: e1 } = await db.from('aset').select('*').eq('kode', kode).single();
    if (e1 || !existing) return false;
    if (!predicate(existing)) {
      throw Object.assign(new Error('Scope mismatch.'), { code: 'SCOPE' });
    }
  }
  const { error, count } = await db.from('aset').delete({ count: 'exact' }).eq('kode', kode);
  if (error) throw error;
  if (count > 0) {
    const { error: e2 } = await db.from('surat_aset').delete().eq('kode_aset', kode);
    if (e2) throw e2;
  }
  return count > 0;
}

async function aturStatus(kodeAset, status) {
  const k = [...new Set((kodeAset || []).filter((x) => typeof x === 'string').map((x) => x.trim()).filter(Boolean))];
  if (k.length === 0) return;
  const { error } = await pastikan().from('aset').update({ status }).in('kode', k);
  if (error) throw error;
}

async function tautkanSurat(nomor, kodeAset) {
  const sb = pastikan();
  const { error: e1 } = await sb.from('surat_aset').delete().eq('nomor_surat', nomor);
  if (e1) throw e1;
  const kodes = [...new Set((kodeAset || []).filter((x) => typeof x === 'string').map((x) => x.trim()).filter(Boolean))];
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
  ambilAset,
  tambahAset,
  updateAset,
  hapusAset,
  aturStatus,
  tautkanSurat,
  hapusTautanSurat,
  semuaTautan,
};

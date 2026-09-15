const { supabase, ready } = require('./supabase');

function pastikan() {
  if (!ready) throw new Error('Supabase belum dikonfigurasi.');
  return supabase;
}

// Scope predicate sebagai filter SQL (bukan pre-read) agar write & authorization
// terjadi dalam satu statement (anti-TOCTOU). Admin/viewer tidak difilter
// (viewer mutation sudah diblokir role-level di server).
function scopeQuery(qb, user) {
  if (!user || user.role === 'admin' || user.role === 'viewer') return qb;
  if (user.role === 'pic') {
    return qb.or(`owner_id.eq.${user.userId},pic_ids.cs.{${user.userId}}`);
  }
  return qb;
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
      lokasi: a.lokasi || '',
      keterangan: a.keterangan || '',
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

async function updateAset(kode, a, predicate, user) {
  const db = pastikan();
  if (predicate) {
    const q = scopeQuery(db.from('aset').select('*').eq('kode', kode), user);
    const { data: existing, error: e1 } = await q.single();
    if (e1 || !existing) return null;
    if (!predicate(existing)) {
      throw Object.assign(new Error('Scope mismatch.'), { code: 'SCOPE' });
    }
  }
  const updatePayload = {};
  if (a.nama !== undefined) updatePayload.nama = a.nama;
  if (a.kategori !== undefined) updatePayload.kategori = a.kategori || '';
  if (a.nilai !== undefined) updatePayload.nilai = a.nilai || 0;
  if (a.kondisi !== undefined) updatePayload.kondisi = a.kondisi || 'baik';
  if (a.status !== undefined) updatePayload.status = a.status;
  if (a.owner_id !== undefined) updatePayload.owner_id = a.owner_id;
  if (a.pic_ids !== undefined) updatePayload.pic_ids = Array.isArray(a.pic_ids) ? a.pic_ids : [];
  if (a.lokasi !== undefined) updatePayload.lokasi = a.lokasi || '';
  if (a.keterangan !== undefined) updatePayload.keterangan = a.keterangan || '';
  if (a.assignee_id !== undefined) updatePayload.assignee_id = a.assignee_id;
  if (a.transfer_to_id !== undefined) updatePayload.transfer_to_id = a.transfer_to_id;

  if (Object.keys(updatePayload).length === 0) {
    const { data, error } = await scopeQuery(db.from('aset').select('*'), user).eq('kode', kode).single();
    if (error) throw error;
    return data;
  }

  let qb = db.from('aset').update(updatePayload).eq('kode', kode);
  qb = scopeQuery(qb, user);
  const { data, error } = await qb.select();
  if (error) throw error;
  if (!data || data.length === 0) return null;
  return data[0];
}

async function hapusAset(kode, predicate, user) {
  const db = pastikan();
  if (predicate) {
    const q = scopeQuery(db.from('aset').select('*'), user).eq('kode', kode);
    const { data: existing, error: e1 } = await q.single();
    if (e1 || !existing) return false;
    if (!predicate(existing)) {
      throw Object.assign(new Error('Scope mismatch.'), { code: 'SCOPE' });
    }
  }
  let qb = db.from('aset').delete({ count: 'exact' }).eq('kode', kode);
  qb = scopeQuery(qb, user);
  const { error, count } = await qb;
  if (error) throw error;
  if (count > 0) {
    const { error: e2 } = await db.from('surat_aset').delete().eq('kode_aset', kode);
    if (e2) throw e2;
  }
  return count > 0;
}

// Transition status secara atomik lewat RPC: predicate scope + kode + status
// current-state dalam satu statement. Mengembalikan jumlah baris yang berubah.
async function aturStatus(kodeAset, status, user) {
  const k = [...new Set((kodeAset || []).filter((x) => typeof x === 'string').map((x) => x.trim()).filter(Boolean))];
  if (k.length === 0) return;
  const db = pastikan();
  const isPic = user && user.role === 'pic';
  const p_owner_id = isPic ? String(user.userId) : null;
  const p_pic_ids = isPic ? [String(user.userId)] : null;
  const { error } = await db.rpc('atur_status_aset', {
    p_kode: k,
    p_status: status,
    p_owner_id,
    p_pic_ids,
  });
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
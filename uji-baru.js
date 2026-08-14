const { createClient } = require('@supabase/supabase-js');

const URL = process.env.SUPABASE_URL;
const KEY = process.env.SUPABASE_SECRET_KEY;
const sb = createClient(URL, KEY, { auth: { persistSession: false } });

async function main() {
  const r = await sb.from('surat').select('*', { count: 'exact', head: true });
  console.log('Cek tabel surat ->', r.error ? r.error.message : `ADA, count=${r.count}`);

  const b = await sb.storage.createBucket('surat-pdf', { public: true });
  console.log('Buat bucket surat-pdf ->', b.error && !/already exists|exists/i.test(String(b.error.message)) ? b.error.message : 'BERHASIL / sudah ada');
}

main().catch((e) => console.error('Err:', e.message));
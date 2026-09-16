-- Migrasi 006: Generate kode aset secara atomic (anti race condition)
--
-- Sebelumnya App menghitung kode dengan SELECT max + 1 melalui listAset(),
-- yang rawan tabrakan nomor saat dua request POST masuk bersamaan.
-- Fungsi ini memakai advisory lock transaksional sehingga hanya satu
-- request yang bisa membaca nilai max pada satu waktu.

create or replace function public.next_aset_kode(p_kategori text default '')
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_segment text;
  v_max int;
  v_next int;
begin
  -- Segment sesuai format App: uppercase, non-alnum -> "-", trim "-"
  v_segment := upper(regexp_replace(coalesce(p_kategori, ''), '[^A-Z0-9]+', '-', 'g'));
  v_segment := trim(both '-' from v_segment);
  if v_segment = '' then
    v_segment := 'ASET';
  end if;

  -- Kunci transaksional: request lain menunggu sampai commit/rollback
  perform pg_advisory_xact_lock(hashtext('aset_kode_' || v_segment));

  select coalesce(max((regexp_match(kode, '^INV/' || v_segment || '-([0-9]+)$'))[1]::int), 0)
    into v_max
    from public.aset;

  v_next := v_max + 1;
  return 'INV/' || v_segment || '-' || lpad(v_next::text, 3, '0');
end;
$$;

revoke all on function public.next_aset_kode(text) from public;
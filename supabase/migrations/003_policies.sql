-- Migrasi 003: RLS policies — service_role (server) tetap bypass,
-- anon/authenticated ditolak. Jangan pakai anon key di server.
-- Jika ingin akses anon read-only, aktifkan policy bawah.

-- Surat
drop policy if exists "allow service_role all surat" on public.surat;
create policy "allow service_role all surat"
  on public.surat for all
  to service_role
  using (true) with check (true);

-- Aset
drop policy if exists "allow service_role all aset" on public.aset;
create policy "allow service_role all aset"
  on public.aset for all
  to service_role
  using (true) with check (true);

-- Relasi surat_aset
drop policy if exists "allow service_role all surat_aset" on public.surat_aset;
create policy "allow service_role all surat_aset"
  on public.surat_aset for all
  to service_role
  using (true) with check (true);

-- Log aktivitas (opsional, jika dipakai)
drop policy if exists "allow service_role all log_aktivitas" on public.log_aktivitas;
create policy "allow service_role all log_aktivitas"
  on public.log_aktivitas for all
  to service_role
  using (true) with check (true);

-- Storage bucket surat-pdf: biarkan public read sesuai kebutuhan,
-- tulis tetap lewat service_role. Atur di Storage > Policies jika perlu.

-- Inisialisasi database Surat Serah Terima (Supabase / Postgres)
-- Jalankan sekali di: Supabase Dashboard > SQL Editor > New query

create table if not exists public.surat (
  id bigint generated always as identity primary key,
  nomor text not null unique,
  tanggal text not null,
  tanggal_singkat text not null,
  kategori text not null check (kategori in ('penyerahan', 'pengembalian')),
  nama text not null,
  departemen text not null,
  penerima text not null,
  departemen_penerima text not null,
  keterangan text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_surat_created_at on public.surat (created_at desc);

alter table public.surat enable row level security;

-- Penyimpanan PDF: buat bucket publik "surat-pdf" lewat dashboard:
-- Storage > New bucket > Name: surat-pdf > Public bucket: ON

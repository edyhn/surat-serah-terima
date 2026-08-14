-- Migrasi 002: Master aset, relasi surat-aset, dan log aktivitas

-- Tabel aset
create table if not exists public.aset (
  id bigint generated always as identity primary key,
  kode text not null unique,
  nama text not null,
  kategori text not null default '',
  nilai numeric not null default 0,
  kondisi text not null default 'baik',
  status text not null default 'tersedia',  -- tersedia | dipakai | rusak
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.aset enable row level security;

-- Relasi surat <-> aset (banyak ke banyak)
create table if not exists public.surat_aset (
  id bigint generated always as identity primary key,
  nomor_surat text not null,
  kode_aset text not null,
  created_at timestamptz not null default now(),
  unique (nomor_surat, kode_aset)
);
alter table public.surat_aset enable row level security;

-- Log aktivitas (dipakai fitur audit)
create table if not exists public.log_aktivitas (
  id bigint generated always as identity primary key,
  pelaku text not null default '',
  aksi text not null default '',          -- buat | edit | hapus | ...
  nomor_surat text not null default '',
  detail text not null default '',
  created_at timestamptz not null default now()
);
alter table public.log_aktivitas enable row level security;

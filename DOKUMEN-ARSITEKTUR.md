# Dokumen Arsitektur — Aplikasi Surat Serah Terima

Aplikasi web untuk membuat surat serah terima / pengembalian aset PT SRT, lengkap dengan
nomor surat otomatis, PDF, Excel, dan riwayat. Satu kode sumber berjalan dalam dua mode:
**lokal (file)** untuk pengembangan dan **cloud (Supabase + Vercel)** untuk produksi.

---

## 1. Ringkasan Arsitektur

```
┌──────────────┐     fetch/JSON      ┌──────────────────────┐
│   Browser    │ ──────────────────► │   API (Express)      │
│ (public/*)   │ ◄────────────────── │   server.js          │
│ HTML/CSS/JS  │  JSON/PDF/Excel     │   dijalankan oleh     │
└──────────────┘                     │   Node.js             │
                                     └───────┬──────────────┘
                                             │
                       ┌─────────────────────┼─────────────────────┐
                       │ lib/storage.js (facade)                    │
                       │  memilih mode berdasar env                 │
                       └──────────┬──────────────┬──────────────────┘
                                  │              │
                    mode supabase │              │ mode file
                     (produksi)   │              │ (lokal)
                                  ▼              ▼
                    ┌──────────────────┐   ┌──────────────────┐
                    │  Supabase        │   │  File sistem     │
                    │  ├─ PostgreSQL   │   │  ├─ riwayat.xlsx │
                    │  │   tabel surat │   │  ├─ pdf/*.pdf    │
                    │  └─ Storage      │   │  └─ nomor.json   │
                    │     bucket       │   └──────────────────┘
                    │     surat-pdf    │
                    └──────────────────┘
```

- **Frontend** dan **backend** di-serve dari satu aplikasi Express.
- **Backend** menjadi satu-satunya pengguna database (klien tidak pernah memegang kunci database).
- **PDF** dihasilkan server-side (PDFKit), disimpan ke penyimpanan, lalu diunduh lewat endpoint.

---

## 2. Stack Teknologi

| Lapisan | Teknologi | Peran |
|---|---|---|
| Frontend | HTML, CSS, JavaScript murni (vanilla) | UI satu halaman, tanpa framework |
| Backend | Node.js + Express 4 | API REST + serve halaman statis |
| PDF | PDFKit | Membuat PDF surat (1 halaman) |
| Excel | ExcelJS | Membuat/update file `riwayat.xlsx` & unduhan Excel |
| Word | `docx` | Template Word offline (penyerahan/pengembalian) |
| Database | Supabase (PostgreSQL) | Tabel `surat`, akses via `supabase-js` |
| File storage | Supabase Storage (bucket `surat-pdf`) | Menyimpan PDF produksi |
| Deploy | Vercel (serverless function) | Menjalankan API + statis di cloud |
| Tes | Test runner bawaan Node (`node --test`) | 10 tes otomatis |
| Versi | Git + GitHub (repo privat) | Riwayat perubahan kode |

Dependencies (`package.json`): `express`, `pdfkit`, `exceljs`, `docx`, `@supabase/supabase-js`.

---

## 3. Struktur File

```
C:\SuratSerahTerima\
├── server.js               # Express app: semua rute API + serve public/
├── config.js               # Konfigurasi instansi (kota, nama, daftar departemen)
├── seed.js                 # Seeder data contoh
├── vercel.json             # Config deploy Vercel (rewrite semua rute ke api/index)
├── package.json
├── buat-word.js            # Generator template Word offline
├── auto-start.cmd          # Jalankan server lokal otomatis (Windows)
├── mulai-server.bat        # Jalankan server lokal manual
├── api/
│   └── index.js            # Entry point serverless: ekspor app Express
├── lib/
│   ├── storage.js          # Facade — pilih mode 'supabase' atau 'file'
│   ├── storage-supabase.js # Implementasi CRUD + PDF via Supabase
│   ├── supabase.js         # Koneksi client supabase-js (URL/key/bucket)
│   ├── excel.js            # CRUD riwayat file xlsx (mode lokal) + pembuat Excel
│   ├── pdf.js              # Generator PDF surat + lokasi folder PDF
│   └── nomor.js            # Nomor surat otomatis NNN/SRT-ST/YYYY
├── public/
│   ├── index.html          # Halaman utama
│   ├── style.css           # Gaya halaman
│   ├── app.js              # Logika frontend (form, riwayat, edit, hapus)
│   └── logo.png
├── supabase/
│   └── migrations/001_init.sql  # Skema tabel `surat`
├── tests/                  # 10 tes otomatis (api, nomor, excel)
└── backups/                # (mode lokal) riwayat.xlsx + pdf/ — tidak di-commit
```

---

## 4. Alur Data per Permintaan

### Buat surat (POST `/api/surat`)
1. Validasi data wajib (nama, departemen, penerima, dept. penerima, keterangan, kategori).
2. `nextNomor()` → nomor `NNN/SRT-ST/YYYY` (dihitung dari data terakhir).
3. Simpan baris ke tabel `surat` (mode supabase) / file xlsx (mode lokal).
4. Buat PDF via `buatPdf()` → simpan ke storage (bucket `surat-pdf` / folder pdf).
5. Balas JSON `{ nomor, tanggal, ..., pdf }`.

### Baca riwayat (GET `/api/riwayat`)
- Mode supabase: query `SELECT ... ORDER BY created_at DESC`.
- Mode file: baca & balik urutan baris dari `riwayat.xlsx`.

### Edit (PUT `/api/surat/:nomor`) & Hapus (DELETE `/api/surat/:nomor`)
- Update/hapus baris + perbarui PDF (edit) atau hapus PDF (hapus).
- Hapus PDF yang tidak ada dibiarkan tanpa error (diabaikan).

### Unduh (GET `/api/riwayat/download`, GET `/api/surat/:nomor/pdf`)
- Excel: generate ulang in-memory dari data (mode cloud) atau kirim file (mode lokal).
- PDF: unduh dari storage/folder sesuai nomor.

---

## 5. Mode Ganda (Local vs Cloud)

| | Mode **file** (lokal) | Mode **supabase** (produksi) |
|---|---|---|
| Aktif ketika | env `SUPABASE_URL` **tidak** di-set | env `SUPABASE_URL` + key di-set |
| Riwayat | `backups/riwayat.xlsx` | tabel `surat` (PostgreSQL) |
| PDF | `backups/pdf/*.pdf` | bucket `surat-pdf` |
| Nomor | `data/nomor.json` (tidak dipakai di cloud) | dihitung dari DB |
| Kasus pakai | Pengembangan, tes, satu PC | Diakses banyak orang via internet |

Env yang dipakai:

| Env | Mode | Fungsi |
|---|---|---|
| `SUPABASE_URL` | cloud | URL proyek Supabase |
| `SUPABASE_SECRET_KEY` (atau `SUPABASE_SERVICE_ROLE_KEY`) | cloud | Kunci service-role untuk akses DB & storage |
| `SUPABASE_BUCKET` | cloud (opsional) | Nama bucket PDF, default `surat-pdf` |
| `EXCEL_FILE` | file (opsional) | Lokasi file riwayat, default `backups/riwayat.xlsx` |
| `PDF_DIR` | file (opsional) | Folder PDF, default `backups/pdf` |
| `NOMOR_FILE` | file (opsional) | File counter nomor, default `data/nomor.json` |
| `PORT` | semua | Port server lokal, default 3000 |

> Keamanan: kunci database hanya dipakai server-side (env di Vercel), tidak pernah
> dikirim ke browser. Tabel `surat` diaktifkan RLS; service-role key menembus RLS.

---

## 6. Database (Supabase)

Tabel `public.surat` (skema lengkap di `supabase/migrations/001_init.sql`):

| Kolom | Tipe | Keterangan |
|---|---|---|
| `id` | BIGSERIAL PK | Nomor urut baris |
| `nomor` | TEXT | Format `001/SRT-ST/2026` |
| `tanggal` | TEXT | Tanggal panjang (mis. `14 Agustus 2026`) |
| `tanggal_singkat` | TEXT | Format `14/08/2026` |
| `kategori` | TEXT | `penyerahan` / `pengembalian` |
| `nama`, `departemen` | TEXT | Pihak menyerahkan |
| `penerima`, `departemen_penerima` | TEXT | Pihak menerima |
| `keterangan` | TEXT | Deskripsi barang/aset |
| `created_at` | TIMESTAMPTZ | Waktu dibuat (untuk urutan riwayat) |

Bucket storage: `surat-pdf` (public) — berisi file `NNN-SRT-ST-YYYY.pdf`.

---

## 7. Deployment (Vercel + Supabase)

- **Vercel** menjalankan satu serverless function dari `api/index.js` (ekspor app Express).
  `vercel.json` me-rewrite semua rute `/api/*` dan `/*` ke function tersebut.
- **Env di Vercel (production)**: `SUPABASE_URL`, `SUPABASE_SECRET_KEY`.
- Proyek: `surat-serah-terima` — URL produksi **https://surat-serah-terima.vercel.app**.
- File sistem di Vercel bersifat read-only → semua penyimpanan wajib lewat Supabase
  (karena itu di produksi, nomor & data tidak boleh ditulis ke file lokal).

---

## 8. Alur Kerja Pengembangan

1. **Edit** kode di `C:\SuratSerahTerima` (satu-satunya folder kerja).
2. **Tes otomatis**: `npm test` → pastikan 10/10 hijau.
3. **Tes manual lokal**: `node server.js` → buka `http://localhost:3000`
   (mode file, data lokal — tidak menyentuh data produksi).
4. **Commit** perubahan: `git add -A && git commit -m "..."`.
5. **Deploy final**: `vercel --prod` (dari folder yang sama) → otomatis live.
6. Backup versi: push ke GitHub `origin/main`.

Perintah umum:

```bash
npm test          # jalankan tes
npm start         # jalankan server lokal (mode file)
node seed.js      # isi data contoh
vercel --prod     # deploy ke produksi
```

---

## 9. Troubleshooting Umum

| Gejala | Kemungkinan Penyebab | Solusi |
|---|---|---|
| Halaman login Vercel | Deployment Protection aktif | Matikan Vercel Authentication di Settings/API |
| `PGRST204 column not found` | Kolom camelCase vs snake_case | Pakai `tanggal_singkat`, `departemen_penerima` |
| `ENOENT mkdir /var/task/data` | Mencoba tulis file di Vercel | Pastikan env `SUPABASE_URL` + key aktif |
| `Not a supported font format` | Font TTF tidak ada di server | Fallback otomatis ke Helvetica (sudah ditangani) |
| PDF/riwayat kosong | Bucket/DB belum dibuat | Jalankan `supabase/migrations/001_init.sql`, buat bucket |

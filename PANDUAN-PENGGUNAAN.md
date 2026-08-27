# Panduan Penggunaan Aplikasi Surat Serah Terima

Panduan ini menjelaskan cara memakai aplikasi untuk membuat, mengedit, menandatangani, mencetak, dan mengelola surat serah terima aset.

## 1. Akses Aplikasi

- Buka aplikasi produksi di: `https://surat-serah-terima.vercel.app`
- Halaman utama berisi:
- Form Surat Serah Terima
- Preview surat
- Kelola Aset
- Riwayat surat

## 2. Membuat Surat Baru

### Langkah-langkah

1. Isi `Nama yang Menyerahkan`.
2. Isi `Nama yang Menerima`.
3. Isi `Departemen Penyerah`.
4. Isi `Departemen Penerima`.
5. Isi `Keterangan`.
6. Pilih aset pada bagian `Pilih Aset (opsional)`.
7. Pilih kategori:
- `Penyerahan`
- `Pengembalian`
8. Jika perlu, isi `Nama HRD`.
9. Jika perlu, gambar tanda tangan langsung di form.
10. Klik `Simpan & Tampilkan Surat`.

### Hasil

- Nomor surat dibuat otomatis.
- Surat langsung muncul di preview.
- PDF otomatis dibuat.
- Data masuk ke riwayat.
- Data aset ikut tercatat.

## 3. Memilih Aset

### Cara memilih aset

1. Ketik kata kunci pada kolom `Cari aset untuk dipilih...`.
2. Centang aset yang ingin dipakai.
3. Aplikasi akan menampilkan jumlah aset yang dipilih.

### Arti tampilan aset

- Setiap aset menampilkan:
- `Kode aset`
- `Nama aset`
- `Nilai aset`
- `Status aset`

- Jika aset diberi tanda status `Dipakai`, artinya aset tersebut sedang tercatat di surat lain.

## 4. Tanda Tangan Langsung dari Form

Di form utama tersedia 3 kotak tanda tangan:

- Yang Menyerahkan
- Yang Menerima
- HRD

### Fitur yang tersedia

- Gambar tanda tangan langsung dengan mouse / layar sentuh
- `Unggah` gambar tanda tangan
- `Hapus` tanda tangan

### Catatan

- Tanda tangan di form bersifat opsional.
- Jika belum ada tanda tangan, surat tetap bisa disimpan.

## 5. Minta Tanda Tangan dari HP Lain

Setelah surat dibuat dan preview tampil:

1. Buka bagian `Minta tanda tangan di HP lain`.
2. Pilih pihak:
- `Menyerahkan`
- `Menerima`
- `HRD`
3. Salin tautan atau scan QR.
4. Kirim ke orang yang akan menandatangani.

### Di halaman tanda tangan HP

Penerima tautan bisa:

1. Melihat nomor surat dan detail singkat.
2. Mengisi nama lengkap (opsional).
3. Menggambar tanda tangan.
4. Memakai tombol `Undo` bila salah gores.
5. Mengatur ketebalan pena.
6. Klik `Kirim Tanda Tangan`.

### Setelah terkirim

- Tanda tangan otomatis masuk ke surat.
- PDF otomatis diperbarui.
- Tersedia tautan `Lihat PDF final`.

## 6. Melihat dan Mencetak Surat

Setelah surat tampil di preview:

1. Klik `Cetak / Simpan PDF` untuk mencetak atau menyimpan dari browser.
2. Jika ingin membuat surat baru, klik `Buat Surat Baru`.

### Isi surat yang tampil

- Nomor surat
- Tanggal
- Data penyerah dan penerima
- Keterangan
- Tabel aset:
- `Kode`
- `Nama Aset`
- `Nilai`
- `Kondisi`
- Kategori surat
- Tanda tangan

## 7. Mengedit Surat

1. Buka bagian `Riwayat`.
2. Cari surat yang ingin diubah.
3. Klik `Edit`.
4. Ubah data yang diperlukan.
5. Klik `Simpan Perubahan`.

### Saat edit

- Nomor surat tetap.
- PDF akan dibuat ulang.
- Relasi aset ikut diperbarui.
- Status aset ikut disesuaikan.

## 8. Menghapus Surat

1. Buka bagian `Riwayat`.
2. Klik `Hapus` pada surat yang ingin dihapus.
3. Konfirmasi penghapusan.

### Efek penghapusan

- Data surat dihapus.
- PDF surat dihapus.
- Tanda tangan digital surat dihapus.
- Relasi aset pada surat tersebut dihapus.

## 9. Kelola Aset

Bagian `Kelola Aset` dipakai untuk menambah, mengubah, melihat riwayat, dan menghapus aset.

### Menambah aset

1. Klik `Tambah Aset`.
2. Isi:
- `Nama Aset`
- `Kategori`
- `Nilai`
- `Kondisi`
- `Status`
3. `Kode Aset` akan dibuat otomatis.
4. Klik `Simpan Aset`.

### Mengubah aset

1. Klik `Edit` pada tabel aset.
2. Ubah data aset.
3. Klik `Simpan Aset`.

### Melihat riwayat aset

1. Klik `Riwayat` pada aset.
2. Akan tampil daftar surat yang pernah memakai aset tersebut.

### Menghapus aset

1. Klik `Hapus` pada aset.
2. Konfirmasi penghapusan.

## 10. Riwayat Surat

Pada bagian `Riwayat`, Anda bisa:

- Melihat semua surat
- Mencari berdasarkan nomor, nama, atau keterangan
- Memfilter kategori
- Pindah halaman data
- Membuka detail surat
- Mengedit surat
- Menghapus surat
- Mengunduh Excel

## 11. Unduh Excel

1. Buka bagian `Riwayat`.
2. Klik `Unduh Excel`.

### Isi file Excel

- No
- No Surat
- Tanggal
- Tanggal Singkat
- Kategori
- Nama
- Departemen
- Penerima
- Dept. Penerima
- Keterangan
- Nama HRD
- Aset

## 12. Arti Status Aset

- `Tersedia` = belum sedang dipakai dalam surat aktif
- `Dipakai` = sedang tercatat dipakai
- `Dalam Perbaikan` = aset sedang diperbaiki
- `Rusak` = aset rusak
- `Hilang` = aset hilang
- `Dihapus` = aset sudah tidak dipakai lagi

## 13. Tips Pemakaian

- Isi `Keterangan` dengan jelas agar mudah ditelusuri.
- Pastikan aset yang dipilih benar sebelum menyimpan.
- Jika tanda tangan salah, gunakan `Hapus` atau `Undo`.
- Gunakan fitur QR/tautan jika tanda tangan dilakukan oleh orang lain dari HP masing-masing.
- Cek preview surat sebelum dicetak.

## 14. Jika Ada Masalah

### Surat tidak muncul

- Pastikan semua field wajib sudah diisi.
- Pastikan koneksi internet stabil.

### Tanda tangan tidak masuk

- Coba buka ulang tautan tanda tangan.
- Kirim ulang tanda tangan.

### Aset tidak ditemukan

- Tambah dulu dari menu `Kelola Aset`.
- Cek kata kunci pencarian aset.

### PDF tidak sesuai

- Buka surat dari `Riwayat`, lalu simpan ulang surat agar PDF dibuat ulang.

## 15. Ringkasan Alur Paling Umum

1. Tambah aset jika aset belum ada.
2. Isi form surat.
3. Pilih aset.
4. Simpan surat.
5. Minta tanda tangan bila perlu.
6. Cek preview.
7. Cetak / simpan PDF.
8. Lihat kembali di riwayat bila diperlukan.

export type KategoriSurat = "pengadaan" | "penyerahan" | "pengembalian";
export type PihakTtd = "menyerahkan" | "menerima" | "hrd";
export type KondisiAset = "baru" | "sangat-baik" | "baik" | "cukup" | "rusak-ringan" | "rusak-berat";
export type StatusAset = "proses_qc" | "siap_pakai" | "tersedia" | "dipakai" | "perbaikan" | "rusak" | "hilang" | "dihapus";

export interface Aset {
  id?: number;
  kode: string;
  nama: string;
  kategori: string;
  nilai: number;
  kondisi: KondisiAset;
  status: StatusAset;
}

export interface SuratInput {
  nama: string;
  departemen: string;
  penerima: string;
  departemenPenerima: string;
  keterangan: string;
  kategori: KategoriSurat;
  statusAsetTujuan?: "proses_qc" | "siap_pakai" | "dipakai" | "perbaikan";
  namaHrd: string;
  aset: string[];
  ttd?: Partial<Record<PihakTtd, string>>;
}

export interface Surat extends Omit<SuratInput, "aset" | "ttd"> {
  no?: number;
  nomor: string;
  tanggal: string;
  tanggalSingkat: string;
  aset?: Aset[] | string[];
  ttd?: Partial<Record<PihakTtd, Buffer | string | boolean>>;
  pdf?: string;
}

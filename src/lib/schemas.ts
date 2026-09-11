import { z } from "zod";

const requiredText = z.string().trim().min(1);
const dataImage = z.string().startsWith("data:image/png;base64,", "Tanda tangan harus berupa PNG.").max(1_500_000);

export const suratSchema = z.object({
  nama: requiredText,
  departemen: requiredText,
  penerima: requiredText,
  departemenPenerima: requiredText,
  keterangan: requiredText,
  kategori: z.enum(["pengadaan", "penyerahan", "pengembalian"]),
  statusAsetTujuan: z.enum(["proses_qc", "siap_pakai", "dipakai", "perbaikan"]).optional(),
  namaHrd: z.string().trim().default(""),
  aset: z.array(z.string().trim().min(1)).max(50).default([]).transform((items) => [...new Set(items)]),
  ttd: z.object({ menyerahkan: dataImage.optional(), menerima: dataImage.optional(), hrd: dataImage.optional() }).optional(),
});

export const asetSchema = z.object({
  kode: z.string().trim().default(""),
  nama: requiredText,
  kategori: z.string().trim().default(""),
  nilai: z.coerce.number().nonnegative().default(0),
  kondisi: z.enum(["baru", "sangat-baik", "baik", "cukup", "rusak-ringan", "rusak-berat"]).default("baik"),
  status: z.enum(["proses_qc", "siap_pakai", "tersedia", "dipakai", "perbaikan", "rusak", "hilang", "dihapus"]).default("proses_qc"),
});

export const ttdSchema = z.object({
  nama: z.string().trim().default(""),
  ttd: z.object({ menyerahkan: dataImage.optional(), menerima: dataImage.optional(), hrd: dataImage.optional() })
    .refine((value) => Object.values(value).some(Boolean), "Tidak ada tanda tangan yang dikirim."),
});

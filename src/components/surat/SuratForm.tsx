"use client";

import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { Save } from "lucide-react";
import { z } from "zod";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { fetchJson } from "@/lib/utils";
import { suratSchema } from "@/lib/schemas";
import type { Aset, Surat } from "@/types";

type Values = z.input<typeof suratSchema>;

type FlowMode = "pengadaan" | "penyerahan" | "pengembalian";

export function SuratForm({
  assets,
  initial,
  defaultFlow = "penyerahan",
  onSaved,
  onCancel,
}: {
  assets: Aset[];
  initial?: Surat;
  defaultFlow?: FlowMode;
  onSaved: (surat: Surat) => void;
  onCancel?: () => void;
}) {
  const [flow, setFlow] = useState<FlowMode>(
    initial?.kategori === "pengadaan"
      ? "pengadaan"
      : initial?.kategori === "pengembalian"
      ? "pengembalian"
      : defaultFlow
  );

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
    setError,
  } = useForm<Values>({
    resolver: zodResolver(suratSchema),
    defaultValues: {
      nama: initial?.nama ?? (defaultFlow === "pengadaan" ? "Mas Royan" : defaultFlow === "penyerahan" ? "Edy Hartono Nasrah" : ""),
      departemen: initial?.departemen ?? (defaultFlow === "pengadaan" ? "Retail" : defaultFlow === "penyerahan" ? "IT" : ""),
      penerima: initial?.penerima ?? (defaultFlow === "pengadaan" ? "Edy Hartono Nasrah" : defaultFlow === "pengembalian" ? "Edy Hartono Nasrah" : ""),
      departemenPenerima: initial?.departemenPenerima ?? (defaultFlow === "pengadaan" ? "IT" : defaultFlow === "pengembalian" ? "IT" : ""),
      keterangan: initial?.keterangan ?? (defaultFlow === "pengadaan" ? "Penerimaan unit laptop baru hasil pengadaan untuk dilakukan Proses QC, instalasi sistem, dan konfigurasi IT." : ""),
      kategori: (initial?.kategori as FlowMode) ?? defaultFlow,
      statusAsetTujuan: defaultFlow === "pengadaan" ? "proses_qc" : defaultFlow === "penyerahan" ? "dipakai" : "proses_qc",
      namaHrd: initial?.namaHrd ?? "",
      aset: (initial?.aset ?? []).map((item) => (typeof item === "string" ? item : item.kode)),
    },
  });

  function handleFlowChange(newFlow: FlowMode) {
    setFlow(newFlow);
    setValue("kategori", newFlow);

    if (newFlow === "pengadaan") {
      setValue("nama", "Mas Royan");
      setValue("departemen", "Retail");
      setValue("penerima", "Edy Hartono Nasrah");
      setValue("departemenPenerima", "IT");
      setValue("statusAsetTujuan", "proses_qc");
      setValue("keterangan", "Penerimaan unit laptop baru hasil pengadaan untuk dilakukan Proses QC, instalasi sistem, dan konfigurasi IT.");
    } else if (newFlow === "penyerahan") {
      setValue("nama", "Edy Hartono Nasrah");
      setValue("departemen", "IT");
      if (!initial) {
        setValue("penerima", "");
        setValue("departemenPenerima", "");
      }
      setValue("statusAsetTujuan", "dipakai");
      setValue("keterangan", "Penyerahan 1 unit laptop beserta aksesoris (mouse, mousepad, tas) untuk operasional kerja karyawan.");
    } else if (newFlow === "pengembalian") {
      if (!initial) {
        setValue("nama", "");
        setValue("departemen", "");
      }
      setValue("penerima", "Edy Hartono Nasrah");
      setValue("departemenPenerima", "IT");
      setValue("statusAsetTujuan", "proses_qc");
      setValue("keterangan", "Pengembalian unit laptop kantor beserta kelengkapan. Unit masuk antrean Proses QC (data wipe & verifikasi fisik).");
    }
  }

  async function submit(values: Values) {
    try {
      const url = initial ? `/api/surat/${encodeURIComponent(initial.nomor)}` : "/api/surat";
      onSaved(
        await fetchJson<Surat>(url, {
          method: initial ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(values),
        })
      );
    } catch (cause) {
      setError("root", {
        message: cause instanceof Error ? cause.message : "Surat gagal disimpan.",
      });
    }
  }

  // Filter aset yang relevan untuk alur yang dipilih
  const relevantAssets = assets.filter((asset) => {
    if (flow === "penyerahan") {
      // Prioritaskan aset yang Siap Pakai atau Tersedia
      return asset.status === "siap_pakai" || asset.status === "tersedia" || asset.status === "proses_qc";
    }
    if (flow === "pengembalian") {
      // Prioritaskan aset yang sedang dipakai
      return asset.status === "dipakai" || asset.status === "tersedia";
    }
    return true;
  });

  return (
    <form onSubmit={handleSubmit(submit)} className="space-y-6" noValidate>
      {/* 3 Alur Kerja Utama Tab Selector */}
      <div>
        <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">
          Pilih Alur Dokumen
        </label>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
          <button
            type="button"
            onClick={() => handleFlowChange("pengadaan")}
            className={`flex flex-col items-start rounded-xl border p-3 text-left transition-all ${
              flow === "pengadaan"
                ? "border-amber-600 bg-amber-50/70 text-amber-900 shadow-sm ring-1 ring-amber-600/30"
                : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50"
            }`}
          >
            <span className="text-[10px] font-bold uppercase tracking-wider text-amber-700">Tahap 1</span>
            <span className="text-xs font-bold mt-0.5">Pengadaan (Royan ➔ Edy)</span>
            <span className="text-[11px] text-slate-500 mt-1">Aset otomatis masuk Proses QC</span>
          </button>

          <button
            type="button"
            onClick={() => handleFlowChange("penyerahan")}
            className={`flex flex-col items-start rounded-xl border p-3 text-left transition-all ${
              flow === "penyerahan"
                ? "border-blue-600 bg-blue-50/70 text-blue-900 shadow-sm ring-1 ring-blue-600/30"
                : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50"
            }`}
          >
            <span className="text-[10px] font-bold uppercase tracking-wider text-blue-700">Tahap 2</span>
            <span className="text-xs font-bold mt-0.5">Serah ke Karyawan (Edy ➔ User)</span>
            <span className="text-[11px] text-slate-500 mt-1">Laptop siap pakai ➔ Dipakai</span>
          </button>

          <button
            type="button"
            onClick={() => handleFlowChange("pengembalian")}
            className={`flex flex-col items-start rounded-xl border p-3 text-left transition-all ${
              flow === "pengembalian"
                ? "border-emerald-600 bg-emerald-50/70 text-emerald-900 shadow-sm ring-1 ring-emerald-600/30"
                : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50"
            }`}
          >
            <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700">Tahap 3</span>
            <span className="text-xs font-bold mt-0.5">Pengembalian (User ➔ Edy)</span>
            <span className="text-[11px] text-slate-500 mt-1">SOP tindak lanjut & verifikasi</span>
          </button>
        </div>
        <input type="hidden" {...register("kategori")} />
      </div>

      {/* Pihak-Pihak Terkait */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-4 rounded-xl border border-slate-200 bg-slate-50/50 p-4">
          <div className="text-xs font-bold uppercase tracking-wider text-blue-700">Pihak Pertama (Penyerah)</div>
          <Input
            label="Nama Lengkap Penyerah"
            placeholder="Contoh: Budi Santoso"
            error={errors.nama?.message}
            disabled={isSubmitting}
            {...register("nama")}
          />
          <Input
            label="Departemen Penyerah"
            placeholder="Contoh: Digital Product, Operasional"
            helper="Ketik nama departemen secara bebas."
            maxLength={100}
            error={errors.departemen?.message}
            disabled={isSubmitting}
            {...register("departemen")}
          />
        </div>

        <div className="space-y-4 rounded-xl border border-slate-200 bg-slate-50/50 p-4">
          <div className="text-xs font-bold uppercase tracking-wider text-emerald-700">Pihak Kedua (Penerima)</div>
          <Input
            label="Nama Lengkap Penerima"
            placeholder="Contoh: Siti Rahma"
            error={errors.penerima?.message}
            disabled={isSubmitting}
            {...register("penerima")}
          />
          <Input
            label="Departemen Penerima"
            placeholder="Contoh: Digital Product, Operasional"
            helper="Ketik nama departemen secara bebas."
            maxLength={100}
            error={errors.departemenPenerima?.message}
            disabled={isSubmitting}
            {...register("departemenPenerima")}
          />
        </div>
      </div>

      {/* Detail Dokumen & HRD */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5 sm:col-span-2">
          <label className="text-xs font-semibold text-slate-700">
            Keterangan / Keperluan Dokumen <span className="text-red-500">*</span>
          </label>
          <textarea
            rows={3}
            disabled={isSubmitting}
            aria-invalid={Boolean(errors.keterangan)}
            placeholder="Contoh: Penyerahan 1 unit laptop kantor beserta aksesoris untuk operasional kerja."
            className="w-full rounded-xl border border-slate-200 bg-white p-3 text-xs text-slate-900 outline-none transition-colors placeholder:text-slate-400 hover:border-slate-300 focus:border-blue-600 focus:ring-2 focus:ring-blue-100 disabled:bg-slate-50"
            {...register("keterangan")}
          />
          {errors.keterangan && (
            <span role="alert" className="text-[11px] text-red-600">
              {errors.keterangan.message}
            </span>
          )}
        </div>

        <div className="sm:col-span-2">
          <Input
            label="Nama HRD / Saksi (Opsional)"
            placeholder="Nama perwakilan HRD bila diperlukan"
            error={errors.namaHrd?.message}
            disabled={isSubmitting}
            {...register("namaHrd")}
          />
        </div>
      </div>

      {/* SOP Status Tujuan untuk Pengembalian */}
      {flow === "pengembalian" && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-4 space-y-2">
          <div className="text-xs font-bold text-emerald-900">
            SOP Tindak Lanjut Pengembalian Unit:
          </div>
          <div className="grid gap-2 sm:grid-cols-3 text-xs">
            <label className="flex items-start gap-2 rounded-lg border border-emerald-200/80 bg-white p-2.5 cursor-pointer hover:bg-emerald-50">
              <input
                type="radio"
                value="proses_qc"
                className="mt-0.5"
                {...register("statusAsetTujuan")}
              />
              <div>
                <strong className="block text-slate-900">1. Masuk Proses QC (Default)</strong>
                <span className="text-[11px] text-slate-500">
                  Untuk resign / mutasi: format ulang data, hapus akun, cek fisik & kelengkapan.
                </span>
              </div>
            </label>

            <label className="flex items-start gap-2 rounded-lg border border-emerald-200/80 bg-white p-2.5 cursor-pointer hover:bg-emerald-50">
              <input
                type="radio"
                value="siap_pakai"
                className="mt-0.5"
                {...register("statusAsetTujuan")}
              />
              <div>
                <strong className="block text-slate-900">2. Langsung Siap Pakai</strong>
                <span className="text-[11px] text-slate-500">
                  Untuk pinjam singkat / meeting: unit bersih, normal, dan tidak ada data pribadi.
                </span>
              </div>
            </label>

            <label className="flex items-start gap-2 rounded-lg border border-emerald-200/80 bg-white p-2.5 cursor-pointer hover:bg-emerald-50">
              <input
                type="radio"
                value="perbaikan"
                className="mt-0.5"
                {...register("statusAsetTujuan")}
              />
              <div>
                <strong className="block text-slate-900">3. Perlu Perbaikan</strong>
                <span className="text-[11px] text-slate-500">
                  Ditemukan kerusakan hardware / fisik yang perlu diservis vendor.
                </span>
              </div>
            </label>
          </div>
        </div>
      )}

      {/* Multi-Asset Checklist */}
      <fieldset disabled={isSubmitting} className="space-y-2">
        <div className="flex items-center justify-between">
          <legend className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            Aset Terkait ({flow === "pengadaan" ? "Pilih Aset Baru" : flow === "penyerahan" ? "Pilih Laptop Siap Pakai" : "Pilih Unit yang Dikembalikan"})
          </legend>
          <span className="text-[11px] text-slate-500">{relevantAssets.length} unit tersedia untuk alur ini</span>
        </div>

        {relevantAssets.length ? (
          <div className="grid max-h-52 gap-2 overflow-y-auto rounded-xl border border-slate-200 bg-white p-3 sm:grid-cols-2">
            {relevantAssets.map((asset) => (
              <label
                key={asset.kode}
                className="flex items-start gap-3 rounded-lg border border-slate-100 bg-slate-50/70 p-2.5 text-xs transition-colors hover:border-slate-200 hover:bg-slate-100/80 cursor-pointer"
              >
                <input
                  type="checkbox"
                  value={asset.kode}
                  className="mt-0.5 size-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                  {...register("aset")}
                />
                <div>
                  <div className="flex items-center gap-1.5">
                    <strong className="font-medium text-slate-900">{asset.nama}</strong>
                    <span className="text-[10px] uppercase font-bold text-slate-500">({asset.status})</span>
                  </div>
                  <span className="text-[11px] text-slate-500">
                    {asset.kode} · <span className="capitalize">{asset.kondisi}</span>
                  </span>
                </div>
              </label>
            ))}
          </div>
        ) : (
          <p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
            Belum ada unit inventaris yang cocok untuk alur ini. Anda tetap dapat menerbitkan dokumen tanda tangan tanpa memilih kode aset.
          </p>
        )}
      </fieldset>

      {errors.root && (
        <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-600">
          {errors.root.message}
        </p>
      )}

      {/* Action Footer */}
      <div className="flex flex-wrap items-center justify-end gap-3 border-t border-slate-100 pt-4">
        {onCancel && (
          <button
            type="button"
            className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 hover:text-slate-900 transition-colors"
            onClick={onCancel}
            disabled={isSubmitting}
          >
            Batal
          </button>
        )}
        <Button
          type="submit"
          disabled={isSubmitting}
          className="rounded-xl bg-blue-600 px-5 text-xs font-semibold shadow-sm hover:bg-blue-500"
        >
          <Save className="size-4" />
          {isSubmitting ? "Menyimpan Dokumen…" : initial ? "Simpan Perubahan" : "Terbitkan Surat"}
        </Button>
      </div>
    </form>
  );
}

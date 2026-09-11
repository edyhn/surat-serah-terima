"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { Save } from "lucide-react";
import { z } from "zod";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { fetchJson } from "@/lib/utils";
import { suratSchema } from "@/lib/schemas";
import type { Aset, Surat } from "@/types";

type Values = z.input<typeof suratSchema>;
const departments = ["IT", "Keuangan", "HRD", "Umum", "Pemasaran", "Produksi", "Gudang"];

export function SuratForm({
  assets,
  initial,
  onSaved,
  onCancel,
}: {
  assets: Aset[];
  initial?: Surat;
  onSaved: (surat: Surat) => void;
  onCancel?: () => void;
}) {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    setError,
    watch,
  } = useForm<Values>({
    resolver: zodResolver(suratSchema),
    defaultValues: {
      nama: initial?.nama ?? "",
      departemen: initial?.departemen ?? "",
      penerima: initial?.penerima ?? "",
      departemenPenerima: initial?.departemenPenerima ?? "",
      keterangan: initial?.keterangan ?? "",
      kategori: initial?.kategori ?? "penyerahan",
      namaHrd: initial?.namaHrd ?? "",
      aset: (initial?.aset ?? []).map((item) => (typeof item === "string" ? item : item.kode)),
    },
  });

  const selectedKategori = watch("kategori");

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

  return (
    <form onSubmit={handleSubmit(submit)} className="space-y-6" noValidate>
      {/* Kategori Radio Selector */}
      <div>
        <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">
          Kategori Berita Acara
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label
            className={`flex cursor-pointer items-center justify-center gap-2 rounded-xl border p-3 text-xs font-bold tracking-wide transition-all ${
              selectedKategori === "penyerahan"
                ? "border-blue-600 bg-blue-50 text-blue-700 shadow-sm"
                : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50"
            }`}
          >
            <input type="radio" value="penyerahan" className="sr-only" {...register("kategori")} />
            <span>PENYERAHAN ASET</span>
          </label>
          <label
            className={`flex cursor-pointer items-center justify-center gap-2 rounded-xl border p-3 text-xs font-bold tracking-wide transition-all ${
              selectedKategori === "pengembalian"
                ? "border-emerald-600 bg-emerald-50 text-emerald-700 shadow-sm"
                : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50"
            }`}
          >
            <input type="radio" value="pengembalian" className="sr-only" {...register("kategori")} />
            <span>PENGEMBALIAN ASET</span>
          </label>
        </div>
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
          <Select
            label="Departemen Penyerah"
            error={errors.departemen?.message}
            disabled={isSubmitting}
            {...register("departemen")}
          >
            <option value="">Pilih departemen</option>
            {departments.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </Select>
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
          <Select
            label="Departemen Penerima"
            error={errors.departemenPenerima?.message}
            disabled={isSubmitting}
            {...register("departemenPenerima")}
          >
            <option value="">Pilih departemen</option>
            {departments.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </Select>
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

      {/* Multi-Asset Checklist */}
      <fieldset disabled={isSubmitting} className="space-y-2">
        <div className="flex items-center justify-between">
          <legend className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            Aset Terkait (Maksimal 50 unit)
          </legend>
          <span className="text-[11px] text-slate-500">{assets.length} aset terdaftar di sistem</span>
        </div>

        {assets.length ? (
          <div className="grid max-h-52 gap-2 overflow-y-auto rounded-xl border border-slate-200 bg-white p-3 sm:grid-cols-2">
            {assets.map((asset) => (
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
                  <strong className="block font-medium text-slate-900">{asset.nama}</strong>
                  <span className="text-[11px] text-slate-500">
                    {asset.kode} · <span className="capitalize">{asset.kondisi}</span>
                  </span>
                </div>
              </label>
            ))}
          </div>
        ) : (
          <p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
            Belum ada inventaris aset. Dokumen tetap dapat dibuat tanpa mencantumkan unit aset.
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

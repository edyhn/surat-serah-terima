"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Download,
  FileDown,
  FileText,
  Package,
  Plus,
  Search,
  Trash2,
  X,
} from "lucide-react";
import { SuratForm } from "@/components/surat/SuratForm";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { fetchJson } from "@/lib/utils";
import { useFeedback } from "@/stores/feedback";
import type { Aset, Surat } from "@/types";

interface Bootstrap {
  riwayat: Surat[];
  aset: Aset[];
}

export default function SuratPage() {
  const showFeedback = useFeedback((state) => state.show);
  const [data, setData] = useState<Bootstrap | null>(null);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<"all" | "pengadaan" | "penyerahan" | "pengembalian">("all");
  const [formOpen, setFormOpen] = useState(false);
  const [activeFlow, setActiveFlow] = useState<"pengadaan" | "penyerahan" | "pengembalian">("penyerahan");
  const [editing, setEditing] = useState<Surat>();
  const [deleting, setDeleting] = useState("");

  const load = useCallback(async () => {
    try {
      const result = await fetchJson<Bootstrap>("/api/bootstrap");
      setData(result);
      setError("");
      const edit = new URLSearchParams(window.location.search).get("edit");
      if (edit) {
        const detail = await fetchJson<Surat>(`/api/surat/${encodeURIComponent(edit)}`);
        setEditing(detail);
        setFormOpen(true);
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Data gagal dimuat.");
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  async function remove(nomor: string) {
    if (!window.confirm(`Hapus surat ${nomor}? Tindakan ini tidak dapat dibatalkan.`)) return;
    setDeleting(nomor);
    try {
      await fetchJson(`/api/surat/${encodeURIComponent(nomor)}`, { method: "DELETE" });
      setData((current) =>
        current
          ? { ...current, riwayat: current.riwayat.filter((item) => item.nomor !== nomor) }
          : current
      );
      showFeedback("Surat berhasil dihapus.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Surat gagal dihapus.");
    } finally {
      setDeleting("");
    }
  }

  // Ringkasan metrik
  const metrics = useMemo(() => {
    const riwayat = data?.riwayat ?? [];
    const aset = data?.aset ?? [];
    const total = riwayat.length;
    const pengadaan = riwayat.filter((s) => s.kategori === "pengadaan").length;
    const penyerahan = riwayat.filter((s) => s.kategori === "penyerahan").length;
    const pengembalian = riwayat.filter((s) => s.kategori === "pengembalian").length;
    const prosesQc = aset.filter((a) => a.status === "proses_qc").length;
    const siapPakai = aset.filter((a) => a.status === "siap_pakai" || a.status === "tersedia").length;
    const asetDipakai = aset.filter((a) => a.status === "dipakai").length;
    return { total, pengadaan, penyerahan, pengembalian, prosesQc, siapPakai, asetDipakai };
  }, [data]);

  const filtered = (data?.riwayat ?? []).filter((item) => {
    const matchQuery = `${item.nomor} ${item.nama} ${item.penerima} ${item.keterangan}`
      .toLowerCase()
      .includes(query.toLowerCase());
    const matchCategory = categoryFilter === "all" || item.kategori === categoryFilter;
    return matchQuery && matchCategory;
  });

  return (
    <div className="space-y-8">
      {/* Header Halaman & Aksi Cepat */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
            Surat Serah Terima
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Alur pengadaan dari Mas Royan, pengecekan QC oleh IT, hingga serah terima karyawan.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <a
            href="/api/riwayat/download"
            className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 hover:text-slate-900"
          >
            <Download className="size-3.5 text-slate-500" />
            Ekspor Excel
          </a>
          <button
            type="button"
            onClick={() => {
              setEditing(undefined);
              setActiveFlow("pengadaan");
              setFormOpen(true);
            }}
            className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-3 text-xs font-bold text-amber-900 shadow-sm transition hover:bg-amber-100"
          >
            <Plus className="size-3.5 text-amber-700" />
            Terima dari Mas Royan
          </button>
          <Button
            onClick={() => {
              setEditing(undefined);
              setActiveFlow("penyerahan");
              setFormOpen(true);
            }}
            className="min-h-9 px-3 text-xs"
          >
            <Plus className="size-3.5" />
            Serah ke Karyawan
          </Button>
        </div>
      </div>

      {/* Ringkasan Metrik Minimalis */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="text-xs font-medium text-slate-500">Total Berita Acara</div>
          <div className="mt-1 text-2xl font-bold text-slate-900">{metrics.total}</div>
          <p className="text-[11px] text-slate-400 mt-0.5">Semua dokumen tercatat</p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="text-xs font-medium text-slate-500">Dalam Proses QC</div>
          <div className="mt-1 text-2xl font-bold text-amber-600">{metrics.prosesQc}</div>
          <p className="text-[11px] text-amber-600/80 mt-0.5">Perlu dicek oleh Edy IT</p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="text-xs font-medium text-slate-500">Unit Siap Pakai</div>
          <div className="mt-1 text-2xl font-bold text-blue-600">{metrics.siapPakai}</div>
          <p className="text-[11px] text-blue-600/80 mt-0.5">Lolos QC, siap diserahkan</p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="text-xs font-medium text-slate-500">Aset Sedang Dipakai</div>
          <div className="mt-1 text-2xl font-bold text-emerald-600">{metrics.asetDipakai}</div>
          <p className="text-[11px] text-emerald-600/80 mt-0.5">Aktif di tangan karyawan</p>
        </div>
      </div>

      {/* Modal Form Pembuatan / Edit Surat */}
      {formOpen && (
        <section
          aria-labelledby="form-title"
          className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xl sm:p-8 animate-in fade-in zoom-in-95"
        >
          <div className="mb-6 flex items-center justify-between border-b border-slate-100 pb-4">
            <div>
              <h2 id="form-title" className="text-lg font-bold text-slate-900">
                {editing ? "Edit Dokumen Surat" : "Buat Surat Baru"}
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Isi data penyerahan dan pilih aset yang diserahterimakan.
              </p>
            </div>
            <button
              aria-label="Tutup formulir"
              className="grid size-9 place-items-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
              onClick={() => setFormOpen(false)}
            >
              <X className="size-4.5" />
            </button>
          </div>

          <SuratForm
            assets={data?.aset ?? []}
            initial={editing}
            defaultFlow={activeFlow}
            onCancel={() => setFormOpen(false)}
            onSaved={(surat) => {
              setData((current) =>
                current
                  ? {
                      ...current,
                      riwayat: editing
                        ? current.riwayat.map((item) => (item.nomor === surat.nomor ? surat : item))
                        : [surat, ...current.riwayat],
                    }
                  : current
              );
              setFormOpen(false);
              showFeedback(editing ? "Perubahan berhasil disimpan." : "Surat baru berhasil diterbitkan.");
            }}
          />
        </section>
      )}

      {/* Area Daftar & Tabel Surat */}
      <section className="space-y-4">
        {/* Search & Filter Bar */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative w-full max-w-sm">
            <Search className="pointer-events-none absolute left-3 top-2.5 size-4 text-slate-400" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Cari nomor atau nama pihak…"
              className="min-h-9 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-xs text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-600 focus:ring-1 focus:ring-blue-600 shadow-sm"
            />
          </div>

          <div className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white p-1 shadow-sm">
            <button
              type="button"
              onClick={() => setCategoryFilter("all")}
              className={`rounded-md px-2.5 py-1 text-xs font-semibold transition ${
                categoryFilter === "all"
                  ? "bg-slate-900 text-white"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Semua
            </button>
            <button
              type="button"
              onClick={() => setCategoryFilter("pengadaan")}
              className={`rounded-md px-2.5 py-1 text-xs font-semibold transition ${
                categoryFilter === "pengadaan"
                  ? "bg-slate-900 text-white"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Pengadaan
            </button>
            <button
              type="button"
              onClick={() => setCategoryFilter("penyerahan")}
              className={`rounded-md px-2.5 py-1 text-xs font-semibold transition ${
                categoryFilter === "penyerahan"
                  ? "bg-slate-900 text-white"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Penyerahan
            </button>
            <button
              type="button"
              onClick={() => setCategoryFilter("pengembalian")}
              className={`rounded-md px-2.5 py-1 text-xs font-semibold transition ${
                categoryFilter === "pengembalian"
                  ? "bg-slate-900 text-white"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Pengembalian
            </button>
          </div>
        </div>

        {/* Tabel / Grid Modern Clean */}
        {error ? (
          <ErrorState message={error} retry={load} />
        ) : !data ? (
          <LoadingSpinner label="Memuat data riwayat" />
        ) : filtered.length ? (
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-slate-200 bg-slate-50 font-semibold text-slate-600">
                <tr>
                  <th scope="col" className="px-4 py-3">Nomor Surat</th>
                  <th scope="col" className="px-4 py-3">Tanggal</th>
                  <th scope="col" className="px-4 py-3">Kategori</th>
                  <th scope="col" className="px-4 py-3">Yang Menyerahkan</th>
                  <th scope="col" className="px-4 py-3">Yang Menerima</th>
                  <th scope="col" className="px-4 py-3 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((surat) => (
                  <tr key={surat.nomor} className="hover:bg-slate-50/70 transition-colors">
                    <td className="px-4 py-3.5 font-bold text-slate-900">
                      <Link
                        href={`/surat/${encodeURIComponent(surat.nomor)}`}
                        className="hover:text-blue-600 hover:underline"
                      >
                        {surat.nomor}
                      </Link>
                    </td>
                    <td className="px-4 py-3.5 text-slate-500 whitespace-nowrap">
                      {surat.tanggalSingkat || surat.tanggal}
                    </td>
                    <td className="px-4 py-3.5">
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
                          surat.kategori === "pengadaan"
                            ? "bg-amber-50 text-amber-700 border border-amber-200"
                            : surat.kategori === "penyerahan"
                            ? "bg-blue-50 text-blue-700 border border-blue-200"
                            : "bg-emerald-50 text-emerald-700 border border-emerald-200"
                        }`}
                      >
                        {surat.kategori}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 font-medium text-slate-800">{surat.nama}</td>
                    <td className="px-4 py-3.5 font-medium text-slate-800">{surat.penerima}</td>
                    <td className="px-4 py-3.5 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <a
                          href={`/api/surat/${encodeURIComponent(surat.nomor)}/pdf`}
                          target="_blank"
                          rel="noreferrer"
                          title="Unduh PDF"
                          className="grid size-8 place-items-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-900 transition-colors"
                        >
                          <FileDown className="size-3.5" />
                        </a>
                        <button
                          type="button"
                          title="Hapus"
                          disabled={Boolean(deleting)}
                          onClick={() => remove(surat.nomor)}
                          className="grid size-8 place-items-center rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-600 transition-colors disabled:opacity-50"
                        >
                          <Trash2 className="size-3.5" />
                        </button>
                        <Link
                          href={`/surat/${encodeURIComponent(surat.nomor)}`}
                          className="ml-1 inline-flex items-center gap-1 rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-200 transition-colors"
                        >
                          Buka
                          <ArrowRight className="size-3" />
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState
            title={query ? "Tidak ditemukan" : "Belum ada surat"}
            description={
              query
                ? "Tidak ada surat yang sesuai dengan kata kunci pencarian."
                : "Klik tombol Buat Surat untuk menambahkan dokumen pertama."
            }
            action={
              !query && (
                <Button onClick={() => setFormOpen(true)}>
                  <Plus className="size-4" /> Buat Surat Sekarang
                </Button>
              )
            }
          />
        )}
      </section>
    </div>
  );
}

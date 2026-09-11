"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Clock,
  Download,
  FileDown,
  FilePlus,
  FileText,
  Package,
  Plus,
  Search,
  Sparkles,
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
  const [categoryFilter, setCategoryFilter] = useState<"all" | "penyerahan" | "pengembalian">("all");
  const [formOpen, setFormOpen] = useState(false);
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

  // Quick Metrics Calculation
  const metrics = useMemo(() => {
    const riwayat = data?.riwayat ?? [];
    const aset = data?.aset ?? [];
    const total = riwayat.length;
    const penyerahan = riwayat.filter((s) => s.kategori === "penyerahan").length;
    const pengembalian = riwayat.filter((s) => s.kategori === "pengembalian").length;
    const asetDipakai = aset.filter((a) => a.status === "dipakai").length;
    return { total, penyerahan, pengembalian, asetDipakai };
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
      {/* Hero & Command Header */}
      <section className="relative overflow-hidden rounded-3xl border border-slate-800 bg-gradient-to-b from-slate-900/90 to-slate-950/90 p-6 sm:p-8 backdrop-blur-2xl shadow-2xl">
        <div className="flex flex-wrap items-center justify-between gap-6">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-blue-500/20 bg-blue-500/10 px-3 py-1 text-xs font-semibold text-blue-400">
              <Sparkles className="size-3.5" /> Workspace Pengelolaan Surat Serah Terima
            </div>
            <h1 className="mt-3 text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
              Surat Studio & Dokumen Aset
            </h1>
            <p className="mt-2 text-sm leading-relaxed text-slate-400">
              Penerbitan berita acara serah terima aset, penandatanganan elektronik mandiri, verifikasi QR code, dan audit log legal.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <a
              href="/api/riwayat/download"
              className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-slate-800 bg-slate-900/80 px-4 text-xs font-semibold text-slate-300 transition-colors hover:bg-slate-800 hover:text-white"
            >
              <Download className="size-4" />
              Ekspor Excel
            </a>
            <Button
              className="min-h-11 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-5 text-xs font-semibold shadow-lg shadow-blue-500/20 hover:from-blue-500 hover:to-indigo-500"
              onClick={() => {
                setEditing(undefined);
                setFormOpen(true);
              }}
            >
              <FilePlus className="size-4" />
              Buat Surat Baru
            </Button>
          </div>
        </div>

        {/* Live Metric Bento Cards */}
        <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
          <div className="rounded-2xl border border-slate-800/80 bg-slate-900/50 p-4 transition-all hover:border-slate-700">
            <div className="flex items-center gap-2 text-xs font-medium text-slate-400">
              <FileText className="size-4 text-blue-400" /> Total Surat
            </div>
            <div className="mt-2 text-2xl font-bold text-white sm:text-3xl">{metrics.total}</div>
            <p className="mt-1 text-[11px] text-slate-500">Berita acara terarsip</p>
          </div>

          <div className="rounded-2xl border border-slate-800/80 bg-slate-900/50 p-4 transition-all hover:border-slate-700">
            <div className="flex items-center gap-2 text-xs font-medium text-slate-400">
              <ArrowRight className="size-4 text-emerald-400" /> Penyerahan
            </div>
            <div className="mt-2 text-2xl font-bold text-emerald-400 sm:text-3xl">{metrics.penyerahan}</div>
            <p className="mt-1 text-[11px] text-slate-500">Distribusi aset ke staf</p>
          </div>

          <div className="rounded-2xl border border-slate-800/80 bg-slate-900/50 p-4 transition-all hover:border-slate-700">
            <div className="flex items-center gap-2 text-xs font-medium text-slate-400">
              <Clock className="size-4 text-amber-400" /> Pengembalian
            </div>
            <div className="mt-2 text-2xl font-bold text-amber-400 sm:text-3xl">{metrics.pengembalian}</div>
            <p className="mt-1 text-[11px] text-slate-500">Retur atau mutasi</p>
          </div>

          <div className="rounded-2xl border border-slate-800/80 bg-slate-900/50 p-4 transition-all hover:border-slate-700">
            <div className="flex items-center gap-2 text-xs font-medium text-slate-400">
              <Package className="size-4 text-purple-400" /> Aset Aktif
            </div>
            <div className="mt-2 text-2xl font-bold text-purple-400 sm:text-3xl">{metrics.asetDipakai}</div>
            <p className="mt-1 text-[11px] text-slate-500">Sedang dipinjamkan</p>
          </div>
        </div>
      </section>

      {/* Form Composer Modal / Panel */}
      {formOpen && (
        <section
          aria-labelledby="form-title"
          className="relative rounded-3xl border border-blue-500/30 bg-slate-900/95 p-6 shadow-2xl backdrop-blur-2xl sm:p-8 animate-in fade-in zoom-in-95"
        >
          <div className="mb-6 flex items-center justify-between border-b border-slate-800 pb-4">
            <div>
              <h2 id="form-title" className="text-xl font-bold text-white">
                {editing ? "Perbarui Dokumen Surat" : "Buat Surat Serah Terima Baru"}
              </h2>
              <p className="text-xs text-slate-400 mt-1">
                Lengkapi identitas penyerah, penerima, dan pilih aset yang diserahterimakan.
              </p>
            </div>
            <button
              aria-label="Tutup formulir"
              className="grid size-10 place-items-center rounded-xl text-slate-400 hover:bg-slate-800 hover:text-white transition-colors"
              onClick={() => setFormOpen(false)}
            >
              <X className="size-5" />
            </button>
          </div>

          <SuratForm
            assets={data?.aset ?? []}
            initial={editing}
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

      {/* Data Explorer Section */}
      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold text-white">Daftar Arsip Surat</h2>
            <p className="text-xs text-slate-400">Cari nomor dokumen, penyerah, atau penerima.</p>
          </div>

          {/* Filters & Search Control Bar */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative min-w-[240px] sm:min-w-[300px]">
              <Search className="pointer-events-none absolute left-3.5 top-3.5 size-4 text-slate-500" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Ketik nomor surat atau nama pihak…"
                className="min-h-11 w-full rounded-xl border border-slate-800 bg-slate-900/90 pl-10 pr-3.5 text-xs text-slate-200 outline-none transition-colors placeholder:text-slate-500 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              />
            </div>

            {/* Category Segmented Control */}
            <div className="flex items-center rounded-xl border border-slate-800 bg-slate-900/80 p-1">
              <button
                type="button"
                onClick={() => setCategoryFilter("all")}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
                  categoryFilter === "all"
                    ? "bg-blue-600 text-white shadow-sm"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                Semua
              </button>
              <button
                type="button"
                onClick={() => setCategoryFilter("penyerahan")}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
                  categoryFilter === "penyerahan"
                    ? "bg-blue-600 text-white shadow-sm"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                Penyerahan
              </button>
              <button
                type="button"
                onClick={() => setCategoryFilter("pengembalian")}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
                  categoryFilter === "pengembalian"
                    ? "bg-blue-600 text-white shadow-sm"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                Pengembalian
              </button>
            </div>
          </div>
        </div>

        {/* Content Status Rendering */}
        {error ? (
          <ErrorState message={error} retry={load} />
        ) : !data ? (
          <LoadingSpinner label="Menyinkronkan basis data surat" />
        ) : filtered.length ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((surat) => (
              <article
                key={surat.nomor}
                className="group relative flex flex-col justify-between rounded-2xl border border-slate-800/80 bg-slate-900/60 p-5 backdrop-blur-sm transition-all hover:border-slate-700 hover:bg-slate-900 hover:shadow-xl"
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <span
                      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                        surat.kategori === "penyerahan"
                          ? "border border-blue-500/20 bg-blue-500/10 text-blue-400"
                          : "border border-emerald-500/20 bg-emerald-500/10 text-emerald-400"
                      }`}
                    >
                      {surat.kategori}
                    </span>
                    <span className="text-[11px] text-slate-500">{surat.tanggalSingkat || surat.tanggal}</span>
                  </div>

                  <h3 className="mt-3 text-base font-bold text-white group-hover:text-blue-400 transition-colors">
                    {surat.nomor}
                  </h3>

                  <div className="mt-4 space-y-1.5 text-xs">
                    <div className="flex items-center justify-between text-slate-400">
                      <span>Penyerah:</span>
                      <strong className="text-slate-200">{surat.nama}</strong>
                    </div>
                    <div className="flex items-center justify-between text-slate-400">
                      <span>Penerima:</span>
                      <strong className="text-slate-200">{surat.penerima}</strong>
                    </div>
                    {surat.keterangan && (
                      <p className="mt-2 line-clamp-2 text-xs italic text-slate-500">{surat.keterangan}</p>
                    )}
                  </div>
                </div>

                <div className="mt-5 flex items-center justify-between border-t border-slate-800/80 pt-3">
                  <div className="flex items-center gap-1.5">
                    <a
                      href={`/api/surat/${encodeURIComponent(surat.nomor)}/pdf`}
                      target="_blank"
                      rel="noreferrer"
                      title="Lihat PDF"
                      className="grid size-8 place-items-center rounded-lg border border-slate-800 bg-slate-950 text-slate-400 hover:bg-slate-800 hover:text-white transition-colors"
                    >
                      <FileDown className="size-3.5" />
                    </a>
                    <button
                      type="button"
                      title="Hapus surat"
                      disabled={Boolean(deleting)}
                      onClick={() => remove(surat.nomor)}
                      className="grid size-8 place-items-center rounded-lg border border-slate-800 bg-slate-950 text-slate-400 hover:border-red-500/30 hover:bg-red-500/10 hover:text-red-400 transition-colors disabled:opacity-50"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </div>

                  <Link
                    href={`/surat/${encodeURIComponent(surat.nomor)}`}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600/10 px-3 py-1.5 text-xs font-semibold text-blue-400 border border-blue-500/20 hover:bg-blue-600 hover:text-white transition-all"
                  >
                    Buka Dokumen
                    <ArrowRight className="size-3" />
                  </Link>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <EmptyState
            title={query ? "Pencarian tidak ditemukan" : "Belum ada dokumen surat"}
            description={
              query
                ? "Tidak ada dokumen yang cocok dengan kata kunci pencarian Anda."
                : "Mulai buat dokumen berita acara serah terima pertama Anda sekarang."
            }
            action={
              !query && (
                <Button
                  className="rounded-xl bg-blue-600 text-xs font-semibold"
                  onClick={() => setFormOpen(true)}
                >
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

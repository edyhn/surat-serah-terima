"use client";

import { useCallback, useEffect, useState } from "react";
import { Plus, Search, X } from "lucide-react";
import { AsetForm } from "@/components/aset/AsetForm";
import { AsetTable } from "@/components/aset/AsetTable";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { fetchJson } from "@/lib/utils";
import { useFeedback } from "@/stores/feedback";
import type { Aset } from "@/types";

export default function AsetPage() {
  const showFeedback = useFeedback((state) => state.show);
  const [data, setData] = useState<Aset[] | null>(null);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Aset>();
  const [busy, setBusy] = useState("");

  const load = useCallback(async () => {
    try {
      setData(await fetchJson<Aset[]>("/api/aset"));
      setError("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Aset gagal dimuat.");
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  async function remove(kode: string) {
    if (!window.confirm(`Hapus aset ${kode}?`)) return;
    setBusy(kode);
    try {
      await fetchJson(`/api/aset/${encodeURIComponent(kode)}`, { method: "DELETE" });
      setData((current) => current?.filter((item) => item.kode !== kode) ?? null);
      showFeedback("Aset berhasil dihapus.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Aset gagal dihapus.");
    } finally {
      setBusy("");
    }
  }

  async function markAsReady(kode: string) {
    setBusy(kode);
    try {
      const target = data?.find((item) => item.kode === kode);
      if (!target) return;
      const updated = await fetchJson<Aset>(`/api/aset/${encodeURIComponent(kode)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...target, status: "siap_pakai" }),
      });
      setData((current) => current?.map((item) => (item.kode === kode ? updated : item)) ?? null);
      showFeedback(`Aset ${kode} berhasil ditandai Lolos QC dan Siap Pakai.`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Gagal memperbarui status QC aset.");
    } finally {
      setBusy("");
    }
  }

  const filtered = (data ?? []).filter((item) =>
    `${item.kode} ${item.nama} ${item.kategori} ${item.status}`.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <main className="mx-auto max-w-7xl px-4 py-7 sm:px-6 lg:py-10 space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">Inventaris Aset</h1>
          <p className="mt-1 text-xs text-slate-500">
            Daftar laptop dan perangkat operasional, status QC IT, dan ketersediaan unit.
          </p>
        </div>
        <Button
          onClick={() => {
            setEditing(undefined);
            setFormOpen(true);
          }}
        >
          <Plus className="size-4" />
          Tambah Aset Manual
        </Button>
      </header>

      {formOpen && (
        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
          <div className="mb-6 flex items-center justify-between border-b border-slate-100 pb-3">
            <h2 className="text-base font-bold text-slate-900">{editing ? "Edit Aset" : "Pencatatan Aset Baru"}</h2>
            <button
              aria-label="Tutup formulir"
              onClick={() => setFormOpen(false)}
              className="grid size-8 place-items-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700"
            >
              <X className="size-4" />
            </button>
          </div>
          <AsetForm
            initial={editing}
            onCancel={() => setFormOpen(false)}
            onSaved={(asset) => {
              setData((current) =>
                editing ? (current ?? []).map((item) => (item.kode === editing.kode ? asset : item)) : [asset, ...(current ?? [])]
              );
              setFormOpen(false);
              showFeedback(editing ? "Aset berhasil diubah." : "Aset berhasil ditambahkan.");
            }}
          />
        </section>
      )}

      <section className="space-y-4">
        <label className="relative block max-w-md">
          <span className="sr-only">Cari aset</span>
          <Search className="pointer-events-none absolute left-3 top-2.5 size-4 text-slate-400" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Cari kode, nama, kategori, status…"
            className="min-h-9 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-xs outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 shadow-sm"
          />
        </label>

        <div>
          {error ? (
            <ErrorState message={error} retry={load} />
          ) : !data ? (
            <LoadingSpinner label="Memuat aset" />
          ) : filtered.length ? (
            <AsetTable
              data={filtered}
              busy={busy}
              onEdit={(aset) => {
                setEditing(aset);
                setFormOpen(true);
              }}
              onDelete={remove}
              onMarkReady={markAsReady}
            />
          ) : (
            <EmptyState
              title={query ? "Aset tidak ditemukan" : "Belum ada aset"}
              description={query ? "Coba kata kunci lain." : "Tambahkan aset agar dapat ditautkan ke surat."}
            />
          )}
        </div>
      </section>
    </main>
  );
}

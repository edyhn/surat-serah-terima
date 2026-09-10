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
  const showFeedback = useFeedback((state) => state.show); const [data, setData] = useState<Aset[] | null>(null); const [error, setError] = useState(""); const [query, setQuery] = useState(""); const [formOpen, setFormOpen] = useState(false); const [editing, setEditing] = useState<Aset>(); const [busy, setBusy] = useState("");
  const load = useCallback(async () => { try { setData(await fetchJson<Aset[]>("/api/aset")); setError(""); } catch (cause) { setError(cause instanceof Error ? cause.message : "Aset gagal dimuat."); } }, []);
  useEffect(() => { const timer = window.setTimeout(() => void load(), 0); return () => window.clearTimeout(timer); }, [load]);
  async function remove(kode: string) { if (!window.confirm(`Hapus aset ${kode}?`)) return; setBusy(kode); try { await fetchJson(`/api/aset/${encodeURIComponent(kode)}`, { method: "DELETE" }); setData((current) => current?.filter((item) => item.kode !== kode) ?? null); showFeedback("Aset berhasil dihapus."); } catch (cause) { setError(cause instanceof Error ? cause.message : "Aset gagal dihapus."); } finally { setBusy(""); } }
  const filtered = (data ?? []).filter((item) => `${item.kode} ${item.nama} ${item.kategori}`.toLowerCase().includes(query.toLowerCase()));
  return <main className="mx-auto max-w-7xl px-4 py-7 sm:px-6 lg:py-10"><header className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-sm font-semibold text-blue-700">Master data</p><h1 className="mt-1 text-3xl font-bold tracking-tight">Inventaris aset</h1><p className="mt-2 text-sm text-slate-600">Kelola ketersediaan dan kondisi aset perusahaan.</p></div><Button onClick={() => { setEditing(undefined); setFormOpen(true); }}><Plus className="size-4"/>Tambah aset</Button></header>{formOpen && <section className="mt-7 rounded-2xl border border-blue-100 bg-white p-5 shadow-lg sm:p-7"><div className="mb-6 flex items-center justify-between"><h2 className="text-xl font-bold">{editing ? "Edit aset" : "Aset baru"}</h2><button aria-label="Tutup formulir" onClick={() => setFormOpen(false)} className="grid size-11 place-items-center rounded-lg hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-blue-700"><X className="size-5"/></button></div><AsetForm initial={editing} onCancel={() => setFormOpen(false)} onSaved={(asset) => { setData((current) => editing ? (current ?? []).map((item) => item.kode === editing.kode ? asset : item) : [asset, ...(current ?? [])]); setFormOpen(false); showFeedback(editing ? "Aset berhasil diubah." : "Aset berhasil ditambahkan."); }}/></section>}<section className="mt-7"><label className="relative block max-w-md"><span className="sr-only">Cari aset</span><Search className="pointer-events-none absolute left-3 top-3.5 size-4 text-slate-400"/><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Cari kode, nama, kategori…" className="min-h-11 w-full rounded-lg border border-slate-300 bg-white pl-10 pr-3 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100"/></label><div className="mt-4">{error ? <ErrorState message={error} retry={load}/> : !data ? <LoadingSpinner label="Memuat aset"/> : filtered.length ? <AsetTable data={filtered} busy={busy} onEdit={(aset) => { setEditing(aset); setFormOpen(true); }} onDelete={remove}/> : <EmptyState title={query ? "Aset tidak ditemukan" : "Belum ada aset"} description={query ? "Coba kata kunci lain." : "Tambahkan aset agar dapat ditautkan ke surat."}/>}</div></section></main>;
}

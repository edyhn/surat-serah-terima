"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Calendar,
  CheckCircle2,
  Copy,
  Download,
  Edit3,
  FileDown,
  KeyRound,
  Package,
  QrCode,
  RefreshCw,
  Send,
  Trash2,
  User,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { TtdCanvas } from "@/components/ttd/TtdCanvas";
import { fetchJson, rupiah } from "@/lib/utils";
import { useFeedback } from "@/stores/feedback";
import type { Surat } from "@/types";

interface TokenItem {
  id: string;
  pihak: "menyerahkan" | "menerima" | "hrd";
  state: "active" | "exchanged" | "expired" | "revoked" | "completed";
  scopes: string[];
  document_version: number;
  expires_at: string;
  created_at: string;
  created_by: string | null;
}

export function SuratDetail({ initial }: { initial: Surat }) {
  const [surat, setSurat] = useState(initial);
  const [signature, setSignature] = useState("");
  const [party, setParty] = useState<"menyerahkan" | "menerima" | "hrd">("menerima");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [tokens, setTokens] = useState<TokenItem[]>([]);
  const [tokenLoading, setTokenLoading] = useState(false);
  const [generatingToken, setGeneratingToken] = useState(false);
  const [lastGeneratedUrl, setLastGeneratedUrl] = useState<string | null>(null);
  const show = useFeedback((state) => state.show);

  const encoded = encodeURIComponent(surat.nomor);

  useEffect(() => {
    let active = true;
    async function fetchTokens() {
      setTokenLoading(true);
      try {
        const res = await fetchJson<{ tokens: TokenItem[] }>(`/api/signing/token?nomor=${encoded}`);
        if (active) setTokens(res.tokens);
      } catch {
        // Token list fallback
      } finally {
        if (active) setTokenLoading(false);
      }
    }
    fetchTokens();
    return () => {
      active = false;
    };
  }, [encoded]);

  async function submitSignature() {
    if (!signature) {
      setError("Gambar tanda tangan terlebih dahulu.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const updated = await fetchJson<Surat>(`/api/surat/${encoded}/ttd`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ttd: { [party]: signature } }),
      });
      setSurat(updated);
      setSignature("");
      show("Tanda tangan berhasil disimpan.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Tanda tangan gagal disimpan.");
    } finally {
      setSaving(false);
    }
  }

  async function handleGenerateToken() {
    setGeneratingToken(true);
    setError("");
    try {
      const res = await fetchJson<{ signingUrl: string; tokenId: string; expiresAt: string }>(
        "/api/signing/token",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            nomor: surat.nomor,
            pihak: party,
            scopes: ["sign:ttd", "read:context", "read:pdf", "read:qr"],
          }),
        }
      );
      setLastGeneratedUrl(res.signingUrl);
      show(`Link tanda tangan sekali pakai berhasil dibuat untuk pihak ${party}.`);
      const refreshed = await fetchJson<{ tokens: TokenItem[] }>(`/api/signing/token?nomor=${encoded}`);
      setTokens(refreshed.tokens);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal menerbitkan token.");
    } finally {
      setGeneratingToken(false);
    }
  }

  async function handleRevokeToken(tokenId: string) {
    if (!confirm("Cabut link tanda tangan ini? Akses eksternal dengan link ini akan langsung dibatalkan.")) return;
    try {
      await fetchJson(`/api/signing/token/${tokenId}`, { method: "DELETE" });
      show("Link tanda tangan berhasil dicabut.");
      setTokens((prev) => prev.map((t) => (t.id === tokenId ? { ...t, state: "revoked" } : t)));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal mencabut token.");
    }
  }

  async function handleRotateToken(tokenId: string) {
    if (!confirm("Rotasi link ini? Link lama akan dicabut dan link baru dengan versi dokumen saat ini akan dibuat.")) return;
    try {
      const res = await fetchJson<{ signingUrl: string }>(`/api/signing/token/${tokenId}/rotate`, { method: "POST" });
      setLastGeneratedUrl(res.signingUrl);
      show("Link berhasil dirotasi ke versi terbaru.");
      const refreshed = await fetchJson<{ tokens: TokenItem[] }>(`/api/signing/token?nomor=${encoded}`);
      setTokens(refreshed.tokens);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal merotasi token.");
    }
  }

  function copyToClipboard(text: string) {
    navigator.clipboard.writeText(text);
    show("Tautan berhasil disalin ke papan klip.");
  }

  const assets = (surat.aset ?? []).filter((item) => typeof item !== "string");

  return (
    <div className="space-y-6">
      {/* Back link & Top Meta */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <Link
          href="/surat"
          className="inline-flex items-center gap-2 text-xs font-semibold text-slate-400 hover:text-white transition-colors"
        >
          <ArrowLeft className="size-4" />
          Kembali ke Studio Surat
        </Link>
        <div className="flex items-center gap-2">
          <span
            className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wider ${
              surat.kategori === "penyerahan"
                ? "border border-blue-500/20 bg-blue-500/10 text-blue-400"
                : "border border-emerald-500/20 bg-emerald-500/10 text-emerald-400"
            }`}
          >
            {surat.kategori}
          </span>
          <span className="text-xs text-slate-500">{surat.tanggal}</span>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
        {/* Document Slate Card */}
        <article className="rounded-3xl border border-slate-800 bg-slate-900/60 p-6 sm:p-8 backdrop-blur-xl shadow-2xl space-y-8">
          {/* Header Document */}
          <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-800 pb-6">
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-blue-400">Berita Acara Resmi</p>
              <h1 className="mt-1 text-2xl font-black tracking-tight text-white sm:text-3xl">{surat.nomor}</h1>
              <div className="mt-2 flex items-center gap-2 text-xs text-slate-400">
                <Calendar className="size-3.5 text-slate-500" />
                <span>Tanggal Terbit: {surat.tanggal}</span>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <a
                href={`/api/surat/${encoded}/pdf`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-blue-600 px-4 text-xs font-semibold text-white shadow-lg shadow-blue-500/20 transition-all hover:bg-blue-500 focus-visible:outline-2 focus-visible:outline-blue-500"
              >
                <FileDown className="size-4" />
                Unduh PDF
              </a>
              <Link
                href={`/surat?edit=${encoded}`}
                className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-slate-800 bg-slate-950 px-4 text-xs font-semibold text-slate-300 transition-colors hover:bg-slate-800 hover:text-white"
              >
                <Edit3 className="size-4" />
                Edit
              </Link>
            </div>
          </div>

          {/* Partisipan Dokumen */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-2xl border border-slate-800/80 bg-slate-950/60 p-5">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-blue-400">
                <User className="size-4" /> Pihak Pertama (Menyerahkan)
              </div>
              <div className="mt-3 text-base font-bold text-white">{surat.nama}</div>
              <div className="text-xs text-slate-400 mt-0.5">Departemen: {surat.departemen}</div>
            </div>

            <div className="rounded-2xl border border-slate-800/80 bg-slate-950/60 p-5">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-emerald-400">
                <Users className="size-4" /> Pihak Kedua (Menerima)
              </div>
              <div className="mt-3 text-base font-bold text-white">{surat.penerima}</div>
              <div className="text-xs text-slate-400 mt-0.5">Departemen: {surat.departemenPenerima}</div>
            </div>
          </div>

          {/* Keterangan */}
          <div className="rounded-2xl border border-slate-800/80 bg-slate-950/40 p-5">
            <div className="text-xs font-bold uppercase tracking-wider text-slate-400">Keterangan / Keperluan</div>
            <p className="mt-2 text-xs leading-relaxed text-slate-300 whitespace-pre-wrap">{surat.keterangan}</p>
          </div>

          {/* Inventaris Aset Terkait */}
          <div>
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Package className="size-4 text-purple-400" />
                <h2 className="text-sm font-bold text-white">Inventaris Aset Dalam Berita Acara</h2>
              </div>
              <span className="text-xs text-slate-500">{assets.length} item terdata</span>
            </div>

            {assets.length ? (
              <ul className="mt-4 divide-y divide-slate-800/60 rounded-2xl border border-slate-800/80 bg-slate-950/40">
                {assets.map((asset) => (
                  <li key={asset.kode} className="flex flex-wrap items-center justify-between gap-3 p-4">
                    <div>
                      <strong className="block text-xs font-bold text-slate-200">{asset.nama}</strong>
                      <span className="text-[11px] text-slate-500">
                        {asset.kode} · Kondisi: <span className="capitalize text-slate-400">{asset.kondisi}</span>
                      </span>
                    </div>
                    <span className="font-mono text-xs font-bold text-purple-400">{rupiah(asset.nilai)}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-4 rounded-xl border border-slate-800/80 bg-slate-950/30 p-4 text-center text-xs text-slate-500">
                Tidak ada aset yang ditautkan pada dokumen ini.
              </p>
            )}
          </div>

          {/* Security & Signed Token Explorer */}
          <div className="border-t border-slate-800 pt-6">
            <div className="flex items-center gap-2">
              <KeyRound className="size-4 text-blue-400" />
              <h2 className="text-sm font-bold text-white">Signed Token Akses Eksternal</h2>
            </div>
            <p className="mt-1 text-xs text-slate-400">
              Token sekali pakai dan sesi terlindungi agar pihak eksternal dapat bertandatangan tanpa hak akses ke sistem admin.
            </p>

            {lastGeneratedUrl && (
              <div className="mt-4 rounded-2xl border border-blue-500/30 bg-blue-500/10 p-4 text-xs">
                <div className="flex items-center gap-2 font-bold text-blue-300">
                  <CheckCircle2 className="size-4" /> Link Baru Siap Dikirim:
                </div>
                <div className="mt-2 flex items-center gap-2">
                  <input
                    type="text"
                    readOnly
                    value={lastGeneratedUrl}
                    className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-slate-200 outline-none"
                  />
                  <Button className="px-3" onClick={() => copyToClipboard(lastGeneratedUrl)}>
                    <Copy className="size-3.5" />
                    Salin
                  </Button>
                </div>
              </div>
            )}

            <div className="mt-4">
              {tokenLoading ? (
                <p className="py-4 text-center text-xs text-slate-500">Memuat status token…</p>
              ) : tokens.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-800 p-6 text-center text-xs text-slate-500">
                  Belum ada link token eksternal untuk surat ini. Anda dapat menerbitkannya pada panel sebelah kanan.
                </div>
              ) : (
                <div className="divide-y divide-slate-800/60 rounded-2xl border border-slate-800/80 bg-slate-950/40">
                  {tokens.map((t) => (
                    <div key={t.id} className="flex flex-wrap items-center justify-between gap-3 p-3.5 text-xs">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold capitalize text-white">{t.pihak}</span>
                          <span
                            className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
                              t.state === "active"
                                ? "border border-emerald-500/20 bg-emerald-500/10 text-emerald-400"
                                : t.state === "exchanged" || t.state === "completed"
                                ? "border border-blue-500/20 bg-blue-500/10 text-blue-400"
                                : "border border-slate-700 bg-slate-800 text-slate-400"
                            }`}
                          >
                            {t.state}
                          </span>
                          <span className="text-[11px] text-slate-500 font-mono">v{t.document_version}</span>
                        </div>
                        <p className="mt-1 text-[11px] text-slate-500">
                          Batas Waktu: {new Date(t.expires_at).toLocaleString("id-ID")}
                        </p>
                      </div>

                      <div className="flex items-center gap-1">
                        {t.state === "active" && (
                          <>
                            <button
                              type="button"
                              onClick={() => handleRotateToken(t.id)}
                              title="Rotasi ke versi dokumen saat ini"
                              className="rounded-lg border border-slate-800 bg-slate-900 p-2 text-slate-400 hover:border-slate-700 hover:text-blue-400 transition-colors"
                            >
                              <RefreshCw className="size-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleRevokeToken(t.id)}
                              title="Cabut izin link"
                              className="rounded-lg border border-slate-800 bg-slate-900 p-2 text-slate-400 hover:border-red-500/30 hover:bg-red-500/10 hover:text-red-400 transition-colors"
                            >
                              <Trash2 className="size-3.5" />
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </article>

        {/* Action & Signature Sidebar */}
        <aside className="space-y-6">
          {/* Direct Signature Panel */}
          <section className="rounded-3xl border border-slate-800 bg-slate-900/60 p-6 backdrop-blur-xl shadow-2xl">
            <div className="flex items-center gap-2">
              <QrCode className="size-5 text-blue-400" />
              <h2 className="text-sm font-bold text-white">Tanda Tangan Internal</h2>
            </div>
            <p className="mt-1 text-xs text-slate-400">Tandatangani langsung pada layar ini</p>

            <div className="mt-4 space-y-1.5">
              <label className="text-xs font-semibold text-slate-300">Pihak Penandatangan</label>
              <select
                value={party}
                onChange={(e) => setParty(e.target.value as "menyerahkan" | "menerima" | "hrd")}
                disabled={saving}
                className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3.5 py-2.5 text-xs text-slate-200 outline-none focus:border-blue-500"
              >
                <option value="menyerahkan">Yang Menyerahkan ({surat.nama})</option>
                <option value="menerima">Yang Menerima ({surat.penerima})</option>
                <option value="hrd">HRD ({surat.namaHrd || "Belum diisi"})</option>
              </select>
            </div>

            <div className="mt-4">
              <TtdCanvas onChange={setSignature} disabled={saving} />
            </div>

            {error && (
              <p role="alert" className="mt-3 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-400">
                {error}
              </p>
            )}

            <Button
              className="mt-4 w-full rounded-xl bg-blue-600 text-xs font-semibold"
              onClick={submitSignature}
              disabled={saving || !signature}
            >
              <Send className="size-4" />
              {saving ? "Menyimpan Tanda Tangan…" : "Simpan Tanda Tangan"}
            </Button>
          </section>

          {/* External Access Token Card */}
          <section className="rounded-3xl border border-slate-800 bg-slate-900/60 p-6 backdrop-blur-xl shadow-2xl">
            <div className="flex items-center gap-2">
              <KeyRound className="size-5 text-emerald-400" />
              <h2 className="text-sm font-bold text-white">Akses Pihak Luar</h2>
            </div>
            <p className="mt-1 text-xs text-slate-400">
              Kirimkan link sekali pakai atau QR code agar pihak penandatangan dapat membuka dokumen di perangkat mereka sendiri secara terproteksi.
            </p>

            <Button
              className="mt-5 w-full rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 text-xs font-semibold shadow-lg shadow-emerald-500/20 hover:from-emerald-500 hover:to-teal-500"
              onClick={handleGenerateToken}
              disabled={generatingToken}
            >
              <KeyRound className="size-4" />
              {generatingToken ? "Menerbitkan…" : `Terbitkan Link Token (${party})`}
            </Button>

            <div className="mt-3">
              <a
                href={`/api/surat/${encoded}/qr?pihak=${party}`}
                download
                className="inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-xl border border-slate-800 bg-slate-950 px-4 text-xs font-semibold text-slate-300 transition-colors hover:bg-slate-800 hover:text-white"
              >
                <Download className="size-4" />
                Unduh Gambar QR ({party})
              </a>
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}

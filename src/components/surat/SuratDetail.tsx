"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Copy, Download, Edit3, FileDown, KeyRound, QrCode, RefreshCw, Send, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
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

  // Load existing tokens
  useEffect(() => {
    let active = true;
    async function fetchTokens() {
      setTokenLoading(true);
      try {
        const res = await fetchJson<{ tokens: TokenItem[] }>(`/api/signing/token?nomor=${encoded}`);
        if (active) setTokens(res.tokens);
      } catch {
        // Fallback jika belum ada token
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
      // Refresh token list
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
    <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
      {/* Main Document Details */}
      <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-200 pb-5">
          <div>
            <Badge tone={surat.kategori === "penyerahan" ? "blue" : "green"}>{surat.kategori}</Badge>
            <h1 className="mt-3 text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl">{surat.nomor}</h1>
            <p className="mt-1 text-sm text-slate-500">{surat.tanggal}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <a
              href={`/api/surat/${encoded}/pdf`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-blue-700 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-800 focus-visible:outline-2 focus-visible:outline-blue-700"
            >
              <FileDown className="size-4" />
              PDF
            </a>
            <Link
              href={`/surat?edit=${encoded}`}
              className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-white px-4 text-sm font-semibold text-slate-700 ring-1 ring-slate-300 transition hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-blue-700"
            >
              <Edit3 className="size-4" />
              Edit
            </Link>
          </div>
        </div>

        <dl className="mt-6 grid gap-5 sm:grid-cols-2">
          <div className="rounded-xl border border-slate-100 bg-slate-50/50 p-4">
            <dt className="text-xs font-semibold uppercase tracking-wider text-slate-500">Yang Menyerahkan</dt>
            <dd className="mt-1 font-semibold text-slate-900">{surat.nama}</dd>
            <dd className="text-sm text-slate-600">{surat.departemen}</dd>
          </div>
          <div className="rounded-xl border border-slate-100 bg-slate-50/50 p-4">
            <dt className="text-xs font-semibold uppercase tracking-wider text-slate-500">Yang Menerima</dt>
            <dd className="mt-1 font-semibold text-slate-900">{surat.penerima}</dd>
            <dd className="text-sm text-slate-600">{surat.departemenPenerima}</dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="text-xs font-semibold uppercase tracking-wider text-slate-500">Keterangan Dokumen</dt>
            <dd className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-slate-700">{surat.keterangan}</dd>
          </div>
        </dl>

        <section className="mt-7">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h2 className="font-semibold text-slate-900">Daftar Aset Terkait</h2>
            <span className="text-xs text-slate-500">{assets.length} aset terdaftar</span>
          </div>
          {assets.length ? (
            <ul className="mt-3 divide-y divide-slate-100 rounded-xl border border-slate-200">
              {assets.map((asset) => (
                <li key={asset.kode} className="flex flex-wrap items-center justify-between gap-3 p-4 hover:bg-slate-50/60">
                  <div>
                    <strong className="block font-medium text-slate-900">{asset.nama}</strong>
                    <span className="text-sm text-slate-500">
                      {asset.kode} · <span className="capitalize">{asset.kondisi}</span>
                    </span>
                  </div>
                  <span className="font-semibold text-slate-900">{rupiah(asset.nilai)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 rounded-lg bg-slate-50 p-4 text-center text-sm text-slate-500">Tidak ada aset terkait.</p>
          )}
        </section>

        {/* Security / Tokens Management Section */}
        <section className="mt-8 border-t border-slate-200 pt-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <KeyRound className="size-4 text-blue-700" />
                <h2 className="font-semibold text-slate-900">Signed Token Akses Eksternal</h2>
              </div>
              <p className="mt-0.5 text-xs text-slate-500">Token sekali pakai dan sesi terlindungi untuk pihak luar</p>
            </div>
          </div>

          {lastGeneratedUrl && (
            <div className="mt-4 rounded-xl border border-blue-200 bg-blue-50/70 p-4 text-sm text-blue-900">
              <p className="font-medium">Link Baru Diterbitkan (Salin sekarang, token hanya tampil sekali):</p>
              <div className="mt-2 flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={lastGeneratedUrl}
                  className="w-full rounded-lg border border-blue-300 bg-white px-3 py-1.5 text-xs text-slate-800"
                />
                <Button className="min-h-9 px-3 text-xs" onClick={() => copyToClipboard(lastGeneratedUrl)}>
                  <Copy className="size-3.5" />
                  Salin
                </Button>
              </div>
            </div>
          )}

          <div className="mt-4">
            {tokenLoading ? (
              <p className="py-4 text-center text-xs text-slate-400">Memuat status token…</p>
            ) : tokens.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-200 p-5 text-center text-xs text-slate-500">
                Belum ada token eksternal untuk surat ini. Anda dapat menerbitkan link/QR sekali pakai di panel kanan.
              </div>
            ) : (
              <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white text-xs">
                {tokens.map((t) => (
                  <li key={t.id} className="flex flex-wrap items-center justify-between gap-2 p-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold capitalize text-slate-900">{t.pihak}</span>
                        <span
                          className={`rounded px-1.5 py-0.5 font-medium ${
                            t.state === "active"
                              ? "bg-emerald-50 text-emerald-700"
                              : t.state === "exchanged" || t.state === "completed"
                              ? "bg-blue-50 text-blue-700"
                              : "bg-slate-100 text-slate-600"
                          }`}
                        >
                          {t.state}
                        </span>
                        <span className="text-slate-400">v{t.document_version}</span>
                      </div>
                      <p className="mt-0.5 text-slate-500">
                        Kedaluwarsa: {new Date(t.expires_at).toLocaleString("id-ID")}
                      </p>
                    </div>
                    <div className="flex items-center gap-1">
                      {t.state === "active" && (
                        <>
                          <button
                            type="button"
                            onClick={() => handleRotateToken(t.id)}
                            title="Rotasi token ke versi dokumen terkini"
                            className="rounded p-1.5 text-slate-500 hover:bg-slate-100 hover:text-blue-700"
                          >
                            <RefreshCw className="size-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleRevokeToken(t.id)}
                            title="Cabut token"
                            className="rounded p-1.5 text-slate-500 hover:bg-red-50 hover:text-red-700"
                          >
                            <Trash2 className="size-3.5" />
                          </button>
                        </>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      </article>

      {/* Sidebar: Direct Signature & External Token Issuance */}
      <aside className="grid content-start gap-5">
        {/* Direct Signature Box */}
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-2">
            <QrCode className="size-5 text-blue-700" />
            <h2 className="font-semibold text-slate-900">Tanda Tangan Internal</h2>
          </div>
          <p className="mt-1 text-xs text-slate-500">Bubuhkan tanda tangan langsung melalui perangkat ini</p>

          <label className="mt-4 grid gap-1 text-sm font-medium text-slate-700">
            Pihak Penandatangan
            <select
              value={party}
              onChange={(event) => setParty(event.target.value as "menyerahkan" | "menerima" | "hrd")}
              disabled={saving}
              className="min-h-11 rounded-lg border border-slate-300 bg-white px-3 text-sm focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-100"
            >
              <option value="menyerahkan">Yang menyerahkan ({surat.nama})</option>
              <option value="menerima">Yang menerima ({surat.penerima})</option>
              <option value="hrd">HRD ({surat.namaHrd || "Belum diisi"})</option>
            </select>
          </label>

          <div className="mt-4">
            <TtdCanvas onChange={setSignature} disabled={saving} />
          </div>

          {error && (
            <p role="alert" className="mt-3 rounded-lg bg-red-50 p-3 text-xs text-red-800">
              {error}
            </p>
          )}

          <Button className="mt-4 w-full" onClick={submitSignature} disabled={saving || !signature}>
            <Send className="size-4" />
            {saving ? "Menyimpan…" : "Simpan tanda tangan"}
          </Button>
        </section>

        {/* Secure Link & QR Token Generator */}
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-2">
            <KeyRound className="size-5 text-emerald-600" />
            <h2 className="font-semibold text-slate-900">Akses QR & Link Eksternal</h2>
          </div>
          <p className="mt-1 text-xs text-slate-500">
            Terbitkan signed token sekali pakai untuk ditandatangani melalui smartphone atau pihak penerima tanpa login internal.
          </p>

          <Button
            className="mt-4 w-full bg-emerald-700 hover:bg-emerald-800 focus-visible:outline-emerald-700"
            onClick={handleGenerateToken}
            disabled={generatingToken}
          >
            <KeyRound className="size-4" />
            {generatingToken ? "Menerbitkan Link…" : `Terbitkan Link Token (${party})`}
          </Button>

          <div className="mt-3">
            <a
              href={`/api/surat/${encoded}/qr?pihak=${party}`}
              download
              className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-white px-4 text-sm font-semibold text-slate-700 ring-1 ring-slate-300 transition hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-blue-700"
            >
              <Download className="size-4" />
              Unduh QR Standar ({party})
            </a>
          </div>
        </section>
      </aside>
    </div>
  );
}

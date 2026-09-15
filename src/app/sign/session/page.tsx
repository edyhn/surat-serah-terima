"use client";

/**
 * ISSUE-30: Halaman /sign/session — halaman tanda tangan berbasis cookie sesi.
 *
 * State UI:
 *   loading     → memuat konteks dokumen
 *   invalid     → sesi tidak valid / digest mismatch
 *   ready       → siap tanda tangan (tampilkan dokumen + canvas)
 *   submitting  → sedang mengirim TTD
 *   success     → TTD berhasil, tampilkan receipt (tanpa token)
 *   error       → gagal submit (dapat retry jika sebelum token dikonsumsi)
 *   readonly    → sesi read_only (TTD sudah ada)
 *
 * Security:
 *   - TIDAK ada analytics atau script pihak ketiga
 *   - TIDAK ada prefetch
 *   - Token TIDAK pernah ada di halaman ini (sudah dibersihkan oleh exchange)
 *   - Idempotency key per submit untuk retry aman
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { Suspense } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface SigningContext {
  nomor: string;
  pihak: "menyerahkan" | "menerima" | "hrd";
  scopes: string[];
  documentVersion: number;
  documentDigest: string;
  sessionExpiresAt: string;
  idleExpiresAt: string;
  sessionState: string;
}

interface SuratData {
  nomor: string;
  tanggal: string;
  kategori: string;
  nama: string;
  departemen: string;
  penerima: string;
  departemenPenerima: string;
  keterangan: string;
  namaHrd: string;
  aset?: Array<{ kode: string; nama: string; nilai: number; kondisi: string }>;
  ttdStatus?: Record<string, boolean>;
}

type PageState =
  | { type: "loading" }
  | { type: "invalid"; message: string }
  | { type: "ready"; context: SigningContext; surat: SuratData }
  | { type: "readonly"; context: SigningContext; surat: SuratData }
  | { type: "submitting" }
  | { type: "success"; receipt: { nomor: string; pihak: string; documentVersion: number } }
  | { type: "error"; message: string; canRetry: boolean };

// ─── Canvas Hook ──────────────────────────────────────────────────────────────

function useSignatureCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawingRef = useRef(false);
  const lastPosRef = useRef<{ x: number; y: number } | null>(null);
  const [isEmpty, setIsEmpty] = useState(true);

  const startDraw = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.setPointerCapture(e.pointerId);
    drawingRef.current = true;
    const rect = canvas.getBoundingClientRect();
    lastPosRef.current = {
      x: (e.clientX - rect.left) * (canvas.width / rect.width),
      y: (e.clientY - rect.top) * (canvas.height / rect.height),
    };
    setIsEmpty(false);
  }, []);

  const draw = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawingRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx || !lastPosRef.current) return;
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) * (canvas.width / rect.width);
    const y = (e.clientY - rect.top) * (canvas.height / rect.height);
    ctx.beginPath();
    ctx.strokeStyle = "#111827";
    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.moveTo(lastPosRef.current.x, lastPosRef.current.y);
    ctx.lineTo(x, y);
    ctx.stroke();
    lastPosRef.current = { x, y };
  }, []);

  const endDraw = useCallback(() => {
    drawingRef.current = false;
    lastPosRef.current = null;
  }, []);

  const clear = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (canvas && ctx) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
    setIsEmpty(true);
  }, []);

  const getDataUrl = useCallback((): string | null => {
    return canvasRef.current?.toDataURL("image/png") ?? null;
  }, []);

  return { canvasRef, isEmpty, startDraw, draw, endDraw, clear, getDataUrl };
}

// ─── Generate idempotency key ─────────────────────────────────────────────────

function generateIdempotencyKey(): string {
  return Array.from(crypto.getRandomValues(new Uint8Array(16)))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// ─── Main Page Component ──────────────────────────────────────────────────────

function SessionContent() {
  const [state, setState] = useState<PageState>({ type: "loading" });
  const [namaHrd, setNamaHrd] = useState("");
  const [consent, setConsent] = useState(false);
  const idempotencyKeyRef = useRef(generateIdempotencyKey());
  const { canvasRef, isEmpty, startDraw, draw, endDraw, clear, getDataUrl } = useSignatureCanvas();

  // Muat konteks dokumen
  useEffect(() => {
    let cancelled = false;

    fetch("/api/signing/context", {
      credentials: "same-origin",
      cache: "no-store",
    })
      .then(async (res) => {
        if (cancelled) return;
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          setState({
            type: "invalid",
            message: (body as { error?: string }).error ?? "Sesi tidak valid atau sudah berakhir.",
          });
          return;
        }
        const data = await res.json() as { context: SigningContext; surat: SuratData };
        if (cancelled) return;

        // Jika sesi read_only (TTD sudah ada)
        if (data.context.sessionState === "read_only") {
          setState({ type: "readonly", context: data.context, surat: data.surat });
        } else {
          setState({ type: "ready", context: data.context, surat: data.surat });
          if (data.surat.namaHrd) setNamaHrd(data.surat.namaHrd);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setState({ type: "invalid", message: "Gagal memuat konteks. Coba lagi." });
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const handleSubmit = useCallback(async () => {
    if (state.type !== "ready") return;
    if (!consent) return;

    const dataUrl = getDataUrl();
    if (!dataUrl || isEmpty) return;

    setState({ type: "submitting" });

    try {
      const body: Record<string, unknown> = {
        ttd: dataUrl,
        consent: true,
        idempotencyKey: idempotencyKeyRef.current,
      };

      // Kirim nama HRD jika pihak hrd
      if (state.context.pihak === "hrd" && namaHrd.trim()) {
        body.nama = namaHrd.trim();
      }

      const res = await fetch("/api/signing/ttd", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = await res.json() as {
        ok?: boolean;
        nomor?: string;
        pihak?: string;
        documentVersion?: number;
        error?: string;
      };

      if (!res.ok) {
        setState({
          type: "error",
          message: data.error ?? "Gagal menyimpan tanda tangan.",
          canRetry: res.status >= 500,
        });
        return;
      }

      setState({
        type: "success",
        receipt: {
          nomor: data.nomor ?? "",
          pihak: data.pihak ?? "",
          documentVersion: data.documentVersion ?? 0,
        },
      });
    } catch {
      setState({
        type: "error",
        message: "Gagal menghubungi server. Periksa koneksi internet Anda.",
        canRetry: true,
      });
    }
  }, [state, consent, isEmpty, getDataUrl, namaHrd]);

  const handleRetry = useCallback(() => {
    // Generate idempotency key baru hanya untuk retry setelah error (sebelum token dikonsumsi)
    idempotencyKeyRef.current = generateIdempotencyKey();
    if (state.type === "error") {
      setState({ type: "loading" });
      // Reload konteks untuk cek apakah sesi masih aktif
      window.location.reload();
    }
  }, [state]);

  // ── Renders ──────────────────────────────────────────────────────────────────

  if (state.type === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div role="status" aria-live="polite" className="text-center p-8">
          <div
            className="inline-block w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mb-4"
            aria-hidden="true"
          />
          <p className="text-gray-600 text-sm">Memuat dokumen…</p>
        </div>
      </div>
    );
  }

  if (state.type === "invalid") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <div
          role="alert"
          className="max-w-md w-full bg-white rounded-xl shadow-sm border border-red-100 p-8 text-center"
        >
          <div className="text-4xl mb-4" aria-hidden="true">⛔</div>
          <h1 className="text-xl font-semibold text-gray-900 mb-2">Link Tidak Valid</h1>
          <p className="text-gray-600 text-sm">{state.message}</p>
          <p className="text-gray-400 text-xs mt-4">
            Hubungi pengirim untuk mendapatkan link baru.
          </p>
        </div>
      </div>
    );
  }

  if (state.type === "success") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <div
          role="status"
          aria-live="polite"
          className="max-w-md w-full bg-white rounded-xl shadow-sm border border-green-100 p-8 text-center"
        >
          <div className="text-4xl mb-4" aria-hidden="true">✅</div>
          <h1 className="text-xl font-semibold text-gray-900 mb-2">
            Tanda Tangan Berhasil Disimpan
          </h1>
          <p className="text-gray-600 text-sm mb-4">
            Terima kasih. Tanda tangan Anda untuk{" "}
            <strong>{state.receipt.nomor}</strong> telah berhasil disimpan.
          </p>
          <div className="bg-gray-50 rounded-lg p-3 text-left text-xs text-gray-500 space-y-1">
            <div>
              <span className="font-medium">Pihak:</span>{" "}
              <span className="capitalize">{state.receipt.pihak}</span>
            </div>
            <div>
              <span className="font-medium">Versi Dokumen:</span>{" "}
              {state.receipt.documentVersion}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (state.type === "error") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <div
          role="alert"
          className="max-w-md w-full bg-white rounded-xl shadow-sm border border-orange-100 p-8 text-center"
        >
          <div className="text-4xl mb-4" aria-hidden="true">⚠️</div>
          <h1 className="text-xl font-semibold text-gray-900 mb-2">Gagal Menyimpan</h1>
          <p className="text-gray-600 text-sm mb-6">{state.message}</p>
          {state.canRetry && (
            <button
              type="button"
              onClick={handleRetry}
              className="bg-blue-600 text-white px-6 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors"
            >
              Coba Lagi
            </button>
          )}
        </div>
      </div>
    );
  }

  if (state.type === "readonly") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <div className="max-w-md w-full bg-white rounded-xl shadow-sm border border-blue-100 p-8 text-center">
          <div className="text-4xl mb-4" aria-hidden="true">📋</div>
          <h1 className="text-xl font-semibold text-gray-900 mb-2">Sesi Sudah Digunakan</h1>
          <p className="text-gray-600 text-sm">
            Tanda tangan Anda untuk <strong>{state.surat.nomor}</strong> sudah tersimpan.
          </p>
        </div>
      </div>
    );
  }

  // State: ready atau submitting — semua state lain sudah di-return di atas
  if (state.type !== "ready" && state.type !== "submitting") return null;
  const readyState = state.type === "ready" ? state : null;
  const context = readyState?.context;
  const surat = readyState?.surat;
  const isSubmitting = state.type === "submitting";
  const pihakLabel: Record<string, string> = {
    menyerahkan: "Yang Menyerahkan",
    menerima: "Yang Menerima",
    hrd: "HRD",
  };

  if (!context || !surat) return null;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-base font-semibold text-gray-900">Tanda Tangan Digital</h1>
            <p className="text-xs text-gray-500">
              {surat.nomor} — {pihakLabel[context.pihak] ?? context.pihak}
            </p>
          </div>
          {/* Expiry indicator */}
          <SessionCountdown expiresAt={context.sessionExpiresAt} />
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6 space-y-6">
        {/* Dokumen info */}
        <section aria-labelledby="dok-heading" className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100">
            <h2 id="dok-heading" className="text-sm font-semibold text-gray-900">
              Dokumen yang Ditandatangani
            </h2>
            <p className="text-xs text-gray-400 mt-0.5">
              Versi dokumen: {context.documentVersion}
            </p>
          </div>
          <dl className="px-5 py-4 grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
            <div>
              <dt className="text-gray-500 text-xs">Nomor Surat</dt>
              <dd className="font-medium text-gray-900">{surat.nomor}</dd>
            </div>
            <div>
              <dt className="text-gray-500 text-xs">Tanggal</dt>
              <dd className="text-gray-900">{surat.tanggal}</dd>
            </div>
            <div>
              <dt className="text-gray-500 text-xs">Yang Menyerahkan</dt>
              <dd className="text-gray-900">{surat.nama}</dd>
            </div>
            <div>
              <dt className="text-gray-500 text-xs">Yang Menerima</dt>
              <dd className="text-gray-900">{surat.penerima}</dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="text-gray-500 text-xs">Keterangan</dt>
              <dd className="text-gray-900">{surat.keterangan}</dd>
            </div>
          </dl>

          {surat.aset && surat.aset.length > 0 && (
            <div className="px-5 pb-4">
              <p className="text-xs text-gray-500 mb-2">Aset</p>
              <ul className="space-y-1">
                {surat.aset.map((a: { kode: string; nama: string; nilai: number; kondisi: string }) => (
                  <li key={a.kode} className="text-sm text-gray-700">
                    {a.kode} — {a.nama}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>

        {/* Isi nama HRD jika pihak HRD */}
        {context.pihak === "hrd" && (
          <section className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
            <label
              htmlFor="namaHrd"
              className="block text-sm font-medium text-gray-900 mb-2"
            >
              Nama HRD <span className="text-red-500">*</span>
            </label>
            <input
              id="namaHrd"
              type="text"
              value={namaHrd}
              onChange={(e) => setNamaHrd(e.target.value)}
              disabled={isSubmitting}
              placeholder="Masukkan nama HRD"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
              maxLength={200}
              required
            />
          </section>
        )}

        {/* Canvas tanda tangan */}
        <section aria-labelledby="ttd-heading" className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
            <h2 id="ttd-heading" className="text-sm font-semibold text-gray-900">
              Tanda Tangan
            </h2>
            <button
              type="button"
              onClick={clear}
              disabled={isSubmitting || isEmpty}
              className="text-xs text-gray-500 hover:text-gray-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Hapus
            </button>
          </div>
          <div className="p-4">
            <canvas
              ref={canvasRef}
              width={600}
              height={200}
              onPointerDown={startDraw}
              onPointerMove={draw}
              onPointerUp={endDraw}
              onPointerLeave={endDraw}
              className="w-full border-2 border-dashed border-gray-200 rounded-lg bg-white touch-none cursor-crosshair"
              aria-label="Area tanda tangan. Gambar tanda tangan Anda di sini."
              role="img"
            />
            {isEmpty && (
              <p className="text-xs text-gray-400 text-center mt-2" aria-hidden="true">
                Gambar tanda tangan di kotak di atas
              </p>
            )}
          </div>
        </section>

        {/* Consent */}
        <section className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={consent}
              onChange={(e) => setConsent(e.target.checked)}
              disabled={isSubmitting}
              className="mt-0.5 w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 disabled:cursor-not-allowed"
              aria-required="true"
            />
            <span className="text-sm text-gray-700">
              Saya menyetujui bahwa tanda tangan ini sah secara hukum dan dokumen yang
              ditampilkan di atas adalah benar. Tanda tangan akan dikaitkan dengan versi
              dokumen{" "}
              <strong>{context.documentVersion}</strong>.
            </span>
          </label>
        </section>

        {/* Submit */}
        <div className="pb-8">
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isSubmitting || isEmpty || !consent || (context.pihak === "hrd" && !namaHrd.trim())}
            aria-busy={isSubmitting}
            className="w-full bg-blue-600 text-white py-3 rounded-xl text-sm font-semibold hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isSubmitting ? (
              <span className="flex items-center justify-center gap-2">
                <span
                  className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"
                  aria-hidden="true"
                />
                Menyimpan…
              </span>
            ) : (
              "Tandatangani Dokumen"
            )}
          </button>
        </div>
      </main>
    </div>
  );
}

// ─── Session Countdown ────────────────────────────────────────────────────────

function SessionCountdown({ expiresAt }: { expiresAt: string }) {
  const [remaining, setRemaining] = useState("");

  useEffect(() => {
    const update = () => {
      const diff = new Date(expiresAt).getTime() - Date.now();
      if (diff <= 0) {
        setRemaining("Berakhir");
        return;
      }
      const minutes = Math.floor(diff / 60000);
      const seconds = Math.floor((diff % 60000) / 1000);
      setRemaining(`${minutes}:${seconds.toString().padStart(2, "0")}`);
    };

    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [expiresAt]);

  return (
    <div
      aria-live="polite"
      aria-label={`Sesi berakhir dalam ${remaining}`}
      className="text-xs text-gray-400"
    >
      <span aria-hidden="true">⏱</span> {remaining}
    </div>
  );
}

// ─── Page Export ──────────────────────────────────────────────────────────────

export default function SignSessionPage() {
  return (
    <Suspense
      fallback={
        <div
          role="status"
          aria-live="polite"
          className="min-h-screen flex items-center justify-center"
        >
          <div className="text-gray-500 text-sm">Memuat…</div>
        </div>
      }
    >
      <SessionContent />
    </Suspense>
  );
}

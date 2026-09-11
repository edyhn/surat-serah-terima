"use client";

/**
 * ISSUE-30: Halaman /sign/exchange — route yang diakses saat pengguna klik link signing.
 *
 * Di halaman ini TIDAK ada UI sensitif. Hanya redirect handler:
 * - Jika URL mengandung ?t=..., segera redirect ke /api/signing/exchange?t=...
 * - Token dibersihkan dari address bar setelah redirect
 * - Tidak ada analytics, script pihak ketiga, atau prefetch
 */

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";

function ExchangeContent() {
  const router = useRouter();
  const params = useSearchParams();

  useEffect(() => {
    const token = params.get("t");

    if (!token) {
      router.replace("/sign/invalid?reason=Link+tidak+valid.");
      return;
    }

    // Segera redirect ke API exchange — token hanya ada di URL sekali
    // API handler akan set cookie dan redirect ke /sign/session
    window.location.replace(`/api/signing/exchange?t=${encodeURIComponent(token)}`);
  }, [params, router]);

  return (
    <div
      role="status"
      aria-live="polite"
      className="min-h-screen flex items-center justify-center bg-gray-50"
    >
      <div className="text-center p-8">
        <div
          className="inline-block w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mb-4"
          aria-hidden="true"
        />
        <p className="text-gray-600 text-sm">Memvalidasi link tanda tangan…</p>
      </div>
    </div>
  );
}

export default function ExchangePage() {
  return (
    <Suspense
      fallback={
        <div
          role="status"
          aria-live="polite"
          className="min-h-screen flex items-center justify-center"
        >
          <div className="text-gray-500">Memuat…</div>
        </div>
      }
    >
      <ExchangeContent />
    </Suspense>
  );
}

/**
 * ISSUE-30: Halaman /sign/invalid — ditampilkan saat token tidak valid/expired.
 */

import type { Metadata } from "next";
import { Suspense } from "react";

export const metadata: Metadata = {
  title: "Link Tidak Valid — Surat Serah Terima",
  robots: { index: false },
};

function InvalidContent() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div
        role="alert"
        className="max-w-md w-full bg-white rounded-xl shadow-sm border border-red-100 p-8 text-center"
      >
        <div className="text-5xl mb-4" aria-hidden="true">⛔</div>
        <h1 className="text-xl font-semibold text-gray-900 mb-3">
          Link Tidak Valid atau Sudah Kedaluwarsa
        </h1>
        <p className="text-gray-600 text-sm leading-relaxed">
          Link tanda tangan ini tidak dapat digunakan. Kemungkinan penyebab:
        </p>
        <ul className="text-left text-sm text-gray-500 mt-3 space-y-1 list-disc list-inside">
          <li>Link sudah pernah digunakan (hanya sekali pakai)</li>
          <li>Link sudah kedaluwarsa (berlaku 48 jam)</li>
          <li>Dokumen sudah diperbarui setelah link diterbitkan</li>
        </ul>
        <p className="text-gray-400 text-xs mt-6">
          Hubungi pengirim untuk mendapatkan link baru.
        </p>
      </div>
    </div>
  );
}

export default function InvalidPage() {
  return (
    <Suspense fallback={<div className="min-h-screen" />}>
      <InvalidContent />
    </Suspense>
  );
}

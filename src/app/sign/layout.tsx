/**
 * ISSUE-30: Layout untuk halaman /sign/* 
 * 
 * PENTING: Layout ini sengaja TIDAK memuat analytics, font eksternal,
 * script pihak ketiga, atau prefetch apapun. Ini mencegah token/referrer
 * bocor ke pihak ketiga.
 */

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Tanda Tangan Digital — Surat Serah Terima",
  description: "Halaman tanda tangan digital untuk Surat Serah Terima.",
  robots: { index: false, follow: false }, // Jangan diindeks search engine
};

export default function SignLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="id">
      <head>
        {/* Referrer policy ketat: tidak ada URL yang dikirim ke server pihak ketiga */}
        <meta name="referrer" content="no-referrer" />
        {/* Mencegah prefetch browser */}
        <meta httpEquiv="x-dns-prefetch-control" content="off" />
      </head>
      <body className="font-sans antialiased">{children}</body>
    </html>
  );
}

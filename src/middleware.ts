import { NextResponse, type NextRequest } from "next/server";

/**
 * Route signing publik / eksternal yang menggunakan token/sesi tersendiri.
 */
const SIGNING_PUBLIC_ROUTES = [
  /^\/sign($|\/)/,              // Halaman signing eksternal
  /^\/api\/signing\/exchange/,  // Exchange token → sesi (validasi via token hash)
  /^\/api\/signing\/context/,   // Context dokumen (validasi via cookie sesi)
  /^\/api\/signing\/ttd/,       // Submit TTD (validasi via cookie sesi)
  /^\/api\/signing\/cleanup/,   // Cleanup job (validasi via internal key)
];

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const response = NextResponse.next({ request });

  // Security headers standar
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("Referrer-Policy", "no-referrer");

  // Alihkan /login langsung ke /surat karena autentikasi dinonaktifkan untuk efisiensi
  if (pathname === "/login") {
    return NextResponse.redirect(new URL("/surat", request.url));
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};

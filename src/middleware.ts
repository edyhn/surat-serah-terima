import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

/**
 * Route signing publik / eksternal yang menggunakan token/sesi tersendiri.
 * Tidak memerlukan autentikasi Supabase — setiap route punya mekanisme
 * keamanannya sendiri (token hash, cookie sesi signing, internal key).
 */
const SIGNING_PUBLIC_ROUTES = [
  /^\/sign($|\/)/,              // Halaman signing eksternal
  /^\/api\/signing\/exchange/,  // Exchange token → sesi (validasi via token hash)
  /^\/api\/signing\/context/,   // Context dokumen (validasi via cookie sesi)
  /^\/api\/signing\/ttd/,       // Submit TTD (validasi via cookie sesi)
  /^\/api\/signing\/cleanup/,   // Cleanup job (validasi via internal key)
];

/** Halaman yang memerlukan login */
const PROTECTED_PAGE_PATHS = ["/surat", "/aset"];

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  // Security headers standar
  let response = NextResponse.next({ request });
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("Referrer-Policy", "no-referrer");

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // Fallback: jika Supabase belum dikonfigurasi, izinkan akses tanpa autentikasi
  // (agar aplikasi tetap bisa dijalankan di lingkungan development/lokal)
  if (!supabaseUrl || !supabaseKey) {
    response.headers.set("X-Auth-Mode", "none");
    if (pathname === "/login") {
      return NextResponse.redirect(new URL("/surat", request.url));
    }
    return response;
  }

  // Buat Supabase client dengan cookie dari request
  const supabase = createServerClient(supabaseUrl, supabaseKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options);
        });
      },
    },
  });

  // Verifikasi sesi aktif (getUser me-refresh token jika belum expired)
  const { data: { user } } = await supabase.auth.getUser();

  // ── Root redirect ───────────────────────────────────────────────────────────
  if (pathname === "/") {
    return NextResponse.redirect(new URL("/surat", request.url));
  }

  // ── Public signing routes: lewati cek autentikasi ───────────────────────────
  if (SIGNING_PUBLIC_ROUTES.some((re) => re.test(pathname))) {
    return response;
  }

  // ── Login page ──────────────────────────────────────────────────────────────
  if (pathname === "/login") {
    if (user) {
      // Sudah login → alihkan ke /surat
      return NextResponse.redirect(new URL("/surat", request.url));
    }
    return response;
  }

  // ── Protected pages (wajib login) ───────────────────────────────────────────
  if (PROTECTED_PAGE_PATHS.some((p) => pathname.startsWith(p)) && !user) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // ── Protected API routes (wajib login, selain yang sudah di-whitelist) ──────
  if (pathname.startsWith("/api/") && !user) {
    return NextResponse.json(
      { error: "Autentikasi diperlukan." },
      { status: 401 },
    );
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};

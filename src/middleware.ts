import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Route signing publik / eksternal yang menggunakan token/sesi tersendiri.
 */
const SIGNING_PUBLIC_ROUTES = [
  /^\/sign($|\/)/,              // Halaman signing eksternal
  /^\/api\/signing\/context/,   // Context dokumen (validasi via cookie sesi)
  /^\/api\/signing\/ttd/,       // Submit TTD (validasi via cookie sesi)
  /^\/api\/signing\/(pdf|qr)$/,  // Resource scoped (validasi via cookie sesi)
  /^\/api\/signing\/cleanup/,   // Cleanup job (validasi via internal key)
];

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  if (SIGNING_PUBLIC_ROUTES.some((pattern) => pattern.test(pathname))) {
    const response = NextResponse.next({ request });
    response.headers.set("X-Content-Type-Options", "nosniff");
    response.headers.set("X-Frame-Options", "DENY");
    response.headers.set("Referrer-Policy", "no-referrer");
    return response;
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    return pathname.startsWith("/api/")
      ? NextResponse.json({ error: "Layanan belum dikonfigurasi." }, { status: 503 })
      : NextResponse.next();
  }

  let response = NextResponse.next({ request });
  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (items) => {
        items.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        items.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });

  const { data } = await supabase.auth.getClaims();

  if (!data?.claims && pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Autentikasi diperlukan." }, { status: 401 });
  }
  if (!data?.claims && pathname !== "/login") {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }
  if (data?.claims && pathname === "/login") {
    return NextResponse.redirect(new URL("/surat", request.url));
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};

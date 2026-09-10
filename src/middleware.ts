import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    return request.nextUrl.pathname.startsWith("/api/")
      ? NextResponse.json({ error: "Layanan belum dikonfigurasi." }, { status: 503 })
      : NextResponse.next();
  }
  let response = NextResponse.next({ request });
  const supabase = createServerClient(url, anonKey, { cookies: {
    getAll: () => request.cookies.getAll(),
    setAll: (items) => {
      items.forEach(({ name, value }) => request.cookies.set(name, value));
      response = NextResponse.next({ request });
      items.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
    },
  } });
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims && request.nextUrl.pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Autentikasi diperlukan." }, { status: 401 });
  }
  if (!data?.claims && request.nextUrl.pathname !== "/login") {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.searchParams.set("next", request.nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  }
  if (data?.claims && request.nextUrl.pathname === "/login") return NextResponse.redirect(new URL("/surat", request.url));
  return response;
}

export const config = { matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"] };

"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { FileText, LogOut, Package, Shield, Sparkles } from "lucide-react";
import type { ReactNode } from "react";
import { createClient } from "@/lib/supabase";
import { cn } from "@/lib/utils";
import { useFeedback } from "@/stores/feedback";

const navigation = [
  { href: "/surat", label: "Surat Studio", icon: FileText },
  { href: "/aset", label: "Inventaris Aset", icon: Package },
];

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { message, clear } = useFeedback();

  if (pathname === "/login") return children;

  async function logout() {
    try {
      await createClient().auth.signOut();
      router.replace("/login");
      router.refresh();
    } catch {
      router.replace("/login");
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans selection:bg-blue-500 selection:text-white">
      <a
        href="#konten"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-xl focus:bg-blue-600 focus:p-3 focus:text-white focus:shadow-2xl"
      >
        Lewati ke konten
      </a>

      {/* Top Glass Navigation Bar */}
      <header className="sticky top-0 z-40 border-b border-slate-800/80 bg-slate-950/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3.5 sm:px-6">
          {/* Logo & Brand Identity */}
          <Link
            href="/surat"
            className="flex items-center gap-3.5 group rounded-xl focus-visible:outline-2 focus-visible:outline-blue-500 focus-visible:outline-offset-4"
          >
            <div className="relative flex size-10 items-center justify-center rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-500 p-0.5 shadow-lg shadow-blue-500/20 group-hover:shadow-blue-500/35 transition-all">
              <div className="flex size-full items-center justify-center rounded-[10px] bg-slate-950">
                <Shield className="size-5 text-blue-400 group-hover:scale-105 transition-transform" />
              </div>
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <strong className="text-sm font-bold tracking-tight text-white">Surat Serah Terima</strong>
                <span className="inline-flex items-center gap-1 rounded-full border border-blue-500/30 bg-blue-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-blue-300">
                  <Sparkles className="size-2.5" /> v2.0
                </span>
              </div>
              <p className="hidden text-xs text-slate-400 sm:block">Digital Document Hub & Verified Signatures</p>
            </div>
          </Link>

          {/* Navigation Links */}
          <nav aria-label="Navigasi utama" className="flex items-center gap-1.5">
            {navigation.map(({ href, label, icon: Icon }) => {
              const active = pathname.startsWith(href);
              return (
                <Link
                  key={href}
                  href={href}
                  className={cn(
                    "flex min-h-10 items-center gap-2 rounded-xl px-3.5 text-xs font-semibold tracking-wide transition-all",
                    active
                      ? "bg-blue-600/15 text-blue-300 border border-blue-500/30 shadow-inner"
                      : "text-slate-400 hover:bg-slate-900 hover:text-slate-200"
                  )}
                >
                  <Icon className={cn("size-4", active ? "text-blue-400" : "text-slate-400")} />
                  <span>{label}</span>
                </Link>
              );
            })}

            <div className="mx-1 h-5 w-px bg-slate-800" aria-hidden="true" />

            <button
              onClick={logout}
              aria-label="Keluar"
              title="Keluar dari akun"
              className="flex min-h-10 items-center gap-2 rounded-xl px-3 text-xs font-medium text-slate-400 hover:bg-red-500/10 hover:text-red-400 transition-colors"
            >
              <LogOut className="size-4" />
              <span className="hidden sm:inline">Keluar</span>
            </button>
          </nav>
        </div>
      </header>

      {/* Global Floating Notification Feedback */}
      {message && (
        <div
          role="status"
          className="fixed bottom-6 left-1/2 z-50 flex -translate-x-1/2 items-center gap-4 rounded-2xl border border-blue-500/30 bg-slate-900/90 px-5 py-3.5 text-xs font-medium text-white shadow-2xl backdrop-blur-lg animate-in fade-in slide-in-from-bottom-5"
        >
          <span>{message}</span>
          <button
            className="rounded-lg bg-blue-600 px-2.5 py-1 text-[11px] font-bold tracking-wide uppercase hover:bg-blue-500 transition-colors"
            onClick={clear}
          >
            Tutup
          </button>
        </div>
      )}

      {/* Main Content Viewport */}
      <main id="konten" className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:py-10">
        {children}
      </main>
    </div>
  );
}

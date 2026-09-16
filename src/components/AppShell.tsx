"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { FileText, Package, Shield } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { useFeedback } from "@/stores/feedback";

const navigation = [
  { href: "/surat", label: "Surat Serah Terima", icon: FileText },
  { href: "/aset", label: "Inventaris Aset", icon: Package },
];

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { message, clear } = useFeedback();

  if (pathname === "/login") return children;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans selection:bg-blue-100 selection:text-blue-900">
      <a
        href="#konten"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-white focus:p-3 focus:text-slate-900 focus:shadow-xl focus:ring-1 focus:ring-slate-200"
      >
        Lewati ke konten
      </a>

      {/* Modern Clean Top Navigation */}
      <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          {/* Logo & Clean Title */}
          <Link
            href="/surat"
            className="flex items-center gap-3 group focus-visible:outline-2 focus-visible:outline-blue-600 focus-visible:outline-offset-2 rounded-lg"
          >
            <div className="flex size-9 items-center justify-center rounded-lg bg-slate-900 text-white shadow-sm transition-transform group-hover:scale-105">
              <Shield className="size-4.5" />
            </div>
            <div>
              <span className="text-sm font-bold tracking-tight text-slate-900">Surat Serah Terima</span>
              <span className="ml-2 hidden text-[11px] font-medium text-slate-500 sm:inline">PT SRT</span>
            </div>
          </Link>

          {/* Navigation Links */}
          <nav aria-label="Navigasi utama" className="flex items-center gap-1">
            {navigation.map(({ href, label, icon: Icon }) => {
              const active = pathname.startsWith(href);
              return (
                <Link
                  key={href}
                  href={href}
                  className={cn(
                    "flex min-h-9 items-center gap-2 rounded-lg px-3 text-xs font-semibold tracking-wide transition-all",
                    active
                      ? "bg-slate-100 text-slate-900 font-bold"
                      : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                  )}
                >
                  <Icon className={cn("size-3.5", active ? "text-blue-600" : "text-slate-400")} />
                  <span>{label}</span>
                </Link>
              );
            })}
          </nav>
        </div>
      </header>

      {/* Floating Notification Feedback */}
      {message && (
        <div
          role="status"
          className="fixed bottom-6 left-1/2 z-50 flex -translate-x-1/2 items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 text-xs font-medium text-slate-800 shadow-xl animate-in fade-in slide-in-from-bottom-5"
        >
          <span>{message}</span>
          <button
            className="rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-700 hover:bg-slate-200 transition-colors"
            onClick={clear}
          >
            Tutup
          </button>
        </div>
      )}

      {/* Main Content Area */}
      <main id="konten" className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:py-10">
        {children}
      </main>
    </div>
  );
}

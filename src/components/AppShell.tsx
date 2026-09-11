"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { FileText, LogOut, Package, ShieldCheck } from "lucide-react";
import type { ReactNode } from "react";
import { createClient } from "@/lib/supabase";
import { cn } from "@/lib/utils";
import { useFeedback } from "@/stores/feedback";

const navigation = [{ href: "/surat", label: "Surat", icon: FileText }, { href: "/aset", label: "Aset", icon: Package }];

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { message, clear } = useFeedback();
  if (pathname === "/login") return children;

  async function logout() { try { await createClient().auth.signOut(); router.replace("/login"); router.refresh(); } catch { router.replace("/login"); } }
  return <div className="min-h-screen bg-slate-50"><a href="#konten" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-white focus:p-3">Lewati ke konten</a><header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur"><div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6"><Link href="/surat" className="flex items-center gap-3 rounded-lg focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-blue-700"><span className="grid size-10 place-items-center rounded-xl bg-blue-700 text-white"><ShieldCheck className="size-5"/></span><span><strong className="block text-sm text-slate-950">Surat Serah Terima</strong><span className="hidden text-xs text-slate-500 sm:block">Pengelolaan aset perusahaan</span></span></Link><nav aria-label="Navigasi utama" className="flex items-center gap-1">{navigation.map(({ href, label, icon: Icon }) => <Link key={href} href={href} className={cn("flex min-h-11 items-center gap-2 rounded-lg px-3 text-sm font-medium text-slate-600 hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-blue-700", pathname.startsWith(href) && "bg-blue-50 text-blue-800")}><Icon className="size-4"/><span className="hidden sm:inline">{label}</span></Link>)}<button onClick={logout} aria-label="Keluar" className="grid min-h-11 min-w-11 place-items-center rounded-lg text-slate-600 hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-blue-700"><LogOut className="size-4"/></button></nav></div></header>{message && <div role="status" className="fixed bottom-5 left-1/2 z-50 flex -translate-x-1/2 items-center gap-4 rounded-xl bg-slate-950 px-4 py-3 text-sm text-white shadow-xl"><span>{message}</span><button className="font-semibold underline" onClick={clear}>Tutup</button></div>}<main id="konten">{children}</main></div>;
}

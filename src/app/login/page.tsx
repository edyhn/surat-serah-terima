"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { LockKeyhole } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { createClient } from "@/lib/supabase";

export default function LoginPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false); const [error, setError] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); setLoading(true); setError(""); const form = new FormData(event.currentTarget); try { const { error: authError } = await createClient().auth.signInWithPassword({ email: String(form.get("email")), password: String(form.get("password")) }); if (authError) throw authError; router.replace(new URLSearchParams(window.location.search).get("next") || "/surat"); router.refresh(); } catch (cause) { setError(cause instanceof Error ? cause.message : "Login gagal."); } finally { setLoading(false); } }
  const configured = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
  return <main className="grid min-h-screen place-items-center bg-slate-950 p-5"><section className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl sm:p-8"><span className="grid size-12 place-items-center rounded-xl bg-blue-700 text-white"><LockKeyhole/></span><h1 className="mt-5 text-2xl font-bold">Selamat datang</h1><p className="mt-2 text-sm text-slate-600">Masuk untuk mengelola surat dan inventaris aset.</p>{!configured && <p role="status" className="mt-5 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">Autentikasi belum tersedia karena environment Supabase belum dikonfigurasi.</p>}{error && <p role="alert" className="mt-5 rounded-lg bg-red-50 p-3 text-sm text-red-800">{error}</p>}<form onSubmit={submit} className="mt-6 grid gap-4"><Input name="email" type="email" label="Email" autoComplete="email" required disabled={loading || !configured}/><Input name="password" type="password" label="Kata sandi" autoComplete="current-password" required minLength={6} disabled={loading || !configured}/><Button type="submit" disabled={loading || !configured}>{loading ? "Memverifikasi…" : "Masuk"}</Button></form></section></main>;
}

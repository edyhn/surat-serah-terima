import { NextResponse } from "next/server";
import { apiError, readJson } from "@/lib/api";
import { createAdminClient } from "@/lib/supabase-admin";
import { insertAset, listAset } from "@/lib/data";
import { asetSchema } from "@/lib/schemas";
export async function GET() { try { return NextResponse.json(await listAset()); } catch (error) { return apiError(error, "Gagal membaca data aset."); } }
export async function POST(request: Request) { try { const parsed = asetSchema.parse(await readJson(request)); if (!parsed.kode) { const db = createAdminClient(); const { data, error } = await db.rpc("next_aset_kode", { p_kategori: parsed.kategori }); if (error) throw error; parsed.kode = String(data); } return NextResponse.json(await insertAset(parsed)); } catch (error) { const duplicate = error instanceof Error && /duplicate|sudah dipakai/i.test(error.message); return apiError(error, duplicate ? "Kode aset sudah dipakai." : "Gagal menyimpan aset.", duplicate ? 400 : 500); } }

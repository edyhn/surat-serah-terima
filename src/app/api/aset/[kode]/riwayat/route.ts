import { NextResponse } from "next/server";
import { apiError, type RouteContext } from "@/lib/api";
import { listLinks, listSurat } from "@/lib/data";
export async function GET(_: Request, context: RouteContext) { try { const { kode } = await context.params; const numbers = new Set((await listLinks()).filter((link) => link.kode_aset === kode).map((link) => link.nomor_surat)); return NextResponse.json((await listSurat()).filter((surat) => numbers.has(surat.nomor))); } catch (error) { return apiError(error, "Gagal membaca riwayat aset."); } }

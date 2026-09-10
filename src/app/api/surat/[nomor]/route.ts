import { NextResponse } from "next/server";
import { apiError, readJson, type RouteContext } from "@/lib/api";
import { suratSchema } from "@/lib/schemas";
import { detailedSurat, editSurat, removeSurat } from "@/lib/surat-service";
export async function GET(_: Request, context: RouteContext) { try { const { nomor } = await context.params; const surat = await detailedSurat(nomor); return surat ? NextResponse.json(surat) : NextResponse.json({ error: "Surat tidak ditemukan." }, { status: 404 }); } catch (error) { return apiError(error, "Gagal membaca surat."); } }
export async function PUT(request: Request, context: RouteContext) { try { const { nomor } = await context.params; const surat = await editSurat(nomor, suratSchema.parse(await readJson(request))); return surat ? NextResponse.json(surat) : NextResponse.json({ error: "Nomor surat tidak ditemukan." }, { status: 404 }); } catch (error) { return apiError(error, "Terjadi kesalahan pada server."); } }
export async function DELETE(_: Request, context: RouteContext) { try { const { nomor } = await context.params; return await removeSurat(nomor) ? NextResponse.json({ ok: true }) : NextResponse.json({ error: "Nomor surat tidak ditemukan." }, { status: 404 }); } catch (error) { return apiError(error, "Gagal menghapus data."); } }

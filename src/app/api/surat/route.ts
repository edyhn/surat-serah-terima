import { NextResponse } from "next/server";
import { apiError, readJson } from "@/lib/api";
import { suratSchema } from "@/lib/schemas";
import { createSurat } from "@/lib/surat-service";
export async function POST(request: Request) { try { return NextResponse.json(await createSurat(suratSchema.parse(await readJson(request)))); } catch (error) { const invalidAsset = error instanceof Error && error.message.startsWith("Kode aset"); return apiError(error, invalidAsset ? error.message : "Terjadi kesalahan pada server.", invalidAsset ? 400 : 500); } }

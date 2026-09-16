import { NextResponse } from "next/server";
import { apiError } from "@/lib/api";
import { history } from "@/lib/surat-service";
export async function GET() { try { return NextResponse.json(await history()); } catch (error) { return apiError(error, "Gagal membaca riwayat."); } }

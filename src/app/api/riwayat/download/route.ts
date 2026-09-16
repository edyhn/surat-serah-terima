import { apiError } from "@/lib/api";
import { bikinExcel } from "@/lib/excel";
import { history } from "@/lib/surat-service";
import type { Surat } from "@/types";

export const runtime = "nodejs";

export async function GET() {
  try {
    const buffer = await bikinExcel((await history()) as Surat[]);
    return new Response(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": 'attachment; filename="riwayat.xlsx"',
      },
    });
  } catch (error) {
    return apiError(error, "Gagal mengunduh riwayat.");
  }
}
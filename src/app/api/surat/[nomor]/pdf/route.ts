import { apiError, type RouteContext } from "@/lib/api";
import { detailedSurat } from "@/lib/surat-service";
import { buatPdf } from "@/lib/pdf";

export const runtime = "nodejs";

export async function GET(_: Request, context: RouteContext) {
  try {
    const { nomor } = await context.params;
    const surat = await detailedSurat(nomor);
    if (!surat) return apiError(new Error("NOT_FOUND"), "PDF tidak ditemukan.", 404);
    const pdf = await buatPdf(surat);
    return new Response(new Uint8Array(pdf.buffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${pdf.namaFile}"`,
      },
    });
  } catch (error) {
    return apiError(error, "PDF tidak ditemukan.", 404);
  }
}
import { apiError, type RouteContext } from "@/lib/api";
import { loadFile, pdfName } from "@/lib/data";

export const runtime = "nodejs";
export async function GET(_: Request, context: RouteContext) { try { const { nomor } = await context.params; const name = pdfName(nomor); return new Response(await loadFile(name), { headers: { "Content-Type": "application/pdf", "Content-Disposition": `inline; filename="${name}"` } }); } catch (error) { return apiError(error, "PDF tidak ditemukan.", 404); } }

import QRCode from "qrcode";
import { apiError, type RouteContext } from "@/lib/api";

export const runtime = "nodejs";

export async function GET(request: Request, context: RouteContext) {
  try {
    const { nomor } = await context.params;
    const url = new URL(request.url);
    const requested = url.searchParams.get("pihak");
    const party = ["menyerahkan", "menerima", "hrd"].includes(requested ?? "") ? requested : null;
    const base = process.env.BASE_URL?.replace(/\/$/, "") ?? url.origin;
    const target = `${base}/ttd.html?nomor=${encodeURIComponent(nomor)}${party ? `&pihak=${encodeURIComponent(party)}` : ""}`;
    const png = await QRCode.toBuffer(target, {
      width: 320,
      margin: 1,
      color: { dark: "#000000", light: "#ffffff" },
    });
    return new Response(new Uint8Array(png), { headers: { "Content-Type": "image/png" } });
  } catch (error) {
    return apiError(error, "Gagal membuat QR.");
  }
}
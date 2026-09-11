import { NextResponse } from "next/server";
import { ZodError } from "zod";

export function apiError(error: unknown, fallback: string, status = 500) {
  if (error instanceof ZodError) {
    return NextResponse.json({ error: error.issues[0]?.message || "Data tidak valid." }, { status: 400 });
  }
  console.error(error);
  return NextResponse.json({ error: fallback }, { status });
}

export async function readJson(request: Request): Promise<unknown> {
  try { return await request.json(); } catch { throw new ZodError([{ code: "custom", path: [], message: "Payload JSON tidak valid." }]); }
}

export type RouteContext = { params: Promise<Record<string, string>> };

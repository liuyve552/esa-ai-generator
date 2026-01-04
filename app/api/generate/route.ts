import { NextResponse } from "next/server";
import { generatePersonalized } from "@/lib/edge/generate";

export const runtime = "edge";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const prompt = (url.searchParams.get("prompt") ?? "").trim();
  const lang = (url.searchParams.get("lang") ?? "en").trim() || "en";

  if (!prompt) {
    return NextResponse.json({ error: "Missing prompt" }, { status: 400 });
  }

  const result = await generatePersonalized({ request, prompt, lang, ttlMs: 8 * 60 * 1000 });
  return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const prompt = typeof body.prompt === "string" ? body.prompt.trim() : "";
  const lang = typeof body.lang === "string" ? body.lang.trim() : "en";

  if (!prompt) {
    return NextResponse.json({ error: "Missing prompt" }, { status: 400 });
  }

  const result = await generatePersonalized({ request, prompt, lang, ttlMs: 8 * 60 * 1000 });
  return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
}


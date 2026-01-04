import { NextResponse } from "next/server";
import { getShare, saveShare } from "@/lib/edge/share";
import type { GenerateResponse } from "@/lib/edge/types";

export const runtime = "edge";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const payload = (await request.json().catch(() => null)) as GenerateResponse | null;
  if (!payload) return NextResponse.json({ error: "Missing payload" }, { status: 400 });

  const id = await saveShare(payload, 10 * 60 * 1000);
  return NextResponse.json({ id, url: `/s/${id}` }, { headers: { "Cache-Control": "no-store" } });
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const id = (url.searchParams.get("id") ?? "").trim();
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  const res = await getShare(id);
  if (!res) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(res, { headers: { "Cache-Control": "no-store" } });
}


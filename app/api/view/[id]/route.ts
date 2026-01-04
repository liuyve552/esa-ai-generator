import { NextResponse } from "next/server";
import { getViewCount, incrementView } from "@/lib/edge/share";

export const runtime = "edge";
export const dynamic = "force-dynamic";

export async function POST(_request: Request, context: { params: { id: string } }) {
  const id = (context.params.id ?? "").trim();
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  const count = await incrementView(id, 24 * 60 * 60 * 1000);
  return NextResponse.json({ id, count }, { headers: { "Cache-Control": "no-store" } });
}

export async function GET(_request: Request, context: { params: { id: string } }) {
  const id = (context.params.id ?? "").trim();
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  const count = await getViewCount(id);
  return NextResponse.json({ id, count }, { headers: { "Cache-Control": "no-store" } });
}


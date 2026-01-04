import { NextResponse } from "next/server";
import { getShare } from "@/lib/edge/share";

export const runtime = "edge";
export const dynamic = "force-dynamic";

export async function GET(_request: Request, context: { params: { id: string } }) {
  const id = (context.params.id ?? "").trim();
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  const res = await getShare(id);
  if (!res) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(res, { headers: { "Cache-Control": "no-store" } });
}


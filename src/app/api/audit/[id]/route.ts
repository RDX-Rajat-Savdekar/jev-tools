import { NextRequest, NextResponse } from "next/server";
import { overrideLedger } from "@/lib/jev-audit/ledger";

export const runtime = "nodejs";

export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  const body = (await req.json()) as { override?: string; reviewerId?: string };
  if (!body.override) {
    return NextResponse.json({ error: "override required" }, { status: 400 });
  }
  const row = overrideLedger(id, body.override, body.reviewerId);
  if (!row) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  return NextResponse.json({ entry: row });
}

import { NextResponse } from "next/server";
import {
  listLedger,
  listNeedsReview,
  totalCostUsd,
} from "@/lib/jev-audit/ledger";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const mode = searchParams.get("mode");

  if (mode === "review") {
    return NextResponse.json({
      entries: listNeedsReview(),
      totalCostUsd: totalCostUsd(),
    });
  }

  const limit = Number(searchParams.get("limit") ?? "100");
  return NextResponse.json({
    entries: listLedger(Number.isFinite(limit) ? limit : 100),
    totalCostUsd: totalCostUsd(),
  });
}

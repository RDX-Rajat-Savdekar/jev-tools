import { NextResponse } from "next/server";
import { readBenchReport } from "@/lib/jev-bench/optimize";
import { DEFAULT_THRESHOLDS } from "@/lib/config/thresholds";

export const runtime = "nodejs";

export async function GET() {
  const report = readBenchReport();
  return NextResponse.json({
    report,
    defaults: DEFAULT_THRESHOLDS,
  });
}

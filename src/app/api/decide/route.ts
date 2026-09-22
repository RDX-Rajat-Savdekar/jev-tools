import { NextRequest, NextResponse } from "next/server";
import { createJevClientFromEnv } from "@/lib/jev/client";
import { COMMAND_QUESTIONS } from "@/lib/jev/questions";
import { routeDecision } from "@/lib/jev/routing";
import { JevApiError } from "@/lib/jev/types";
import {
  appendLedger,
  confidenceFromAnswers,
} from "@/lib/jev-audit/ledger";
import { DEFAULT_THRESHOLDS } from "@/lib/config/thresholds";
import { readBenchReport } from "@/lib/jev-bench/optimize";

export const runtime = "nodejs";

function thresholds() {
  const report = readBenchReport();
  if (!report) return DEFAULT_THRESHOLDS;
  return {
    ...DEFAULT_THRESHOLDS,
    ...report.recommendedThresholds,
  };
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      transcript?: string;
      speculative?: boolean;
      tSavedMs?: number | null;
    };

    const transcript = body.transcript?.trim();
    if (!transcript) {
      return NextResponse.json(
        { error: "transcript is required" },
        { status: 400 },
      );
    }

    const client = createJevClientFromEnv();
    const thr = thresholds();
    const response = await client.decide({
      state: {
        role: "agent_command_console",
        partial_transcript: transcript,
      },
      questions: COMMAND_QUESTIONS,
    });

    const decision = routeDecision(response, thr);
    const confidence = confidenceFromAnswers(
      response.answers,
      decision.action === "block" ? "block" : "intent",
    );

    const row = appendLedger({
      context: transcript,
      queryType: "choice+score+noul",
      verdict: decision.action,
      confidenceScore: confidence,
      status: decision.status,
      modelVersion: response.model,
      usage: response.usage,
      speculative: Boolean(body.speculative) && decision.action !== "wait",
      intent: "intent" in decision ? decision.intent ?? undefined : undefined,
      partialTranscript: transcript,
      tSavedMs: body.tSavedMs ?? null,
      answers: response.answers,
    });

    return NextResponse.json({
      decision,
      response,
      thresholds: thr,
      auditId: row.id,
      usage: response.usage,
    });
  } catch (err) {
    if (err instanceof JevApiError) {
      return NextResponse.json(
        { error: err.message, code: err.code, body: err.body },
        { status: err.status },
      );
    }
    console.error(err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 },
    );
  }
}

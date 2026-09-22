import type { Thresholds } from "@/lib/config/thresholds";
import { DEFAULT_THRESHOLDS } from "@/lib/config/thresholds";
import type { Answer, DecideResponse } from "@/lib/jev/types";

export type RoutingStatus =
  | "auto_approved"
  | "needs_review"
  | "blocked"
  | "buffered";

export type SpeculativeDecision =
  | {
      action: "fire";
      intent: string;
      confidence: number;
      status: "auto_approved";
    }
  | {
      action: "block";
      intent: string;
      noul: number;
      riskScore: number;
      status: "blocked";
    }
  | {
      action: "review";
      intent: string;
      confidence: number;
      status: "needs_review";
    }
  | {
      action: "wait";
      intent: string | null;
      confidence: number;
      status: "buffered";
    };

export function signalStrength(answer: Answer): number {
  switch (answer.type) {
    case "choice":
    case "score":
      return answer.confidence;
    case "noul":
      return answer.noul;
  }
}

export function routeDecision(
  response: DecideResponse,
  thresholds: Thresholds = DEFAULT_THRESHOLDS,
): SpeculativeDecision {
  const intent = response.answers.intent;
  const risk = response.answers.risk;
  const block = response.answers.block;

  const intentChoice = intent?.type === "choice" ? intent.choice : "unknown";
  const intentConf = intent?.type === "choice" ? intent.confidence : 0;
  const riskScore = risk?.type === "score" ? risk.score : 0;
  const blockNoul = block?.type === "noul" ? block.noul : 0;

  if (blockNoul >= thresholds.blockNoul) {
    return {
      action: "block",
      intent: intentChoice,
      noul: blockNoul,
      riskScore,
      status: "blocked",
    };
  }

  if (
    intentChoice !== "unknown" &&
    intentConf >= thresholds.speculativeFire
  ) {
    return {
      action: "fire",
      intent: intentChoice,
      confidence: intentConf,
      status: "auto_approved",
    };
  }

  if (
    intentChoice !== "unknown" &&
    intentConf >= thresholds.hitlLow &&
    intentConf < thresholds.speculativeFire
  ) {
    return {
      action: "review",
      intent: intentChoice,
      confidence: intentConf,
      status: "needs_review",
    };
  }

  return {
    action: "wait",
    intent: intentChoice === "unknown" ? null : intentChoice,
    confidence: intentConf,
    status: "buffered",
  };
}

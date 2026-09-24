import type { DecideRequest, DecideResponse } from "./types";

/**
 * Deterministic local stand-in used when JEV_API_KEY is missing or set to "mock".
 * Mirrors the three LinkedIn demo utterances closely enough to rehearse the UI.
 */
export function mockDecide(request: DecideRequest): DecideResponse {
  const state = request.state;
  const text =
    typeof state === "string"
      ? state
      : typeof state === "object" &&
          state !== null &&
          "partial_transcript" in state
        ? String((state as { partial_transcript: unknown }).partial_transcript)
        : JSON.stringify(state);

  const lower = text.toLowerCase();
  const wordCount = lower.trim().split(/\s+/).filter(Boolean).length;

  let intent = "unknown";
  let confidence = 0.25;
  let risk = 0.2;
  let block = 0.05;

  if (
    /deploy|preview|staging/.test(lower) &&
    !/drop|wipe|delete|destroy/.test(lower)
  ) {
    intent = "deploy_preview";
    // Long demo sentence: fire once the deploy intent is clear (~8+ words)
    confidence = wordCount >= 10 ? 0.97 : wordCount >= 7 ? 0.91 : wordCount >= 4 ? 0.72 : 0.4;
    risk = 0.4;
    block = 0.04;
  } else if (
    /drop|wipe|destroy|production database|clear all of the backup|delete all backups|backup snapshots/.test(
      lower,
    )
  ) {
    intent = "destroy_data";
    confidence = wordCount >= 8 ? 0.98 : wordCount >= 5 ? 0.9 : 0.7;
    risk = 2.9;
    block = wordCount >= 7 ? 0.94 : wordCount >= 5 ? 0.78 : 0.55;
  } else if (/clean.?up|build stuff|artifacts|leftover|whenever you get a chance/.test(lower)) {
    intent = "cleanup_build";
    // Stay in review band even when the full vague sentence is in
    confidence = wordCount >= 8 ? 0.58 : 0.45;
    risk = 0.9;
    block = 0.08;
  }

  const answers: DecideResponse["answers"] = {};

  if (request.questions.intent) {
    answers.intent = {
      type: "choice",
      choice: intent,
      confidence,
      probabilities: {
        deploy_preview: intent === "deploy_preview" ? confidence : 0.02,
        destroy_data: intent === "destroy_data" ? confidence : 0.02,
        cleanup_build: intent === "cleanup_build" ? confidence : 0.02,
        unknown: intent === "unknown" ? confidence : 1 - confidence,
      },
    };
  }

  if (request.questions.risk) {
    answers.risk = {
      type: "score",
      score: risk,
      confidence: Math.min(0.99, confidence + 0.02),
      probabilities: {
        "0": risk < 1 ? 0.7 : 0.05,
        "1": risk >= 1 && risk < 2 ? 0.6 : 0.1,
        "2": risk >= 2 && risk < 2.5 ? 0.55 : 0.1,
        "3": risk >= 2.5 ? 0.8 : 0.05,
      },
      legend: {
        "0": "Harmless",
        "1": "Reversible",
        "2": "Risky",
        "3": "Destructive",
      },
    };
  }

  if (request.questions.block) {
    answers.block = { type: "noul", noul: block };
  }

  // Pass through any other custom questions with safe defaults
  for (const [key, q] of Object.entries(request.questions)) {
    if (answers[key]) continue;
    if (q.type === "noul") answers[key] = { type: "noul", noul: 0.1 };
    else if (q.type === "choice") {
      const first = Object.keys(q.criteria)[0] ?? "unknown";
      answers[key] = {
        type: "choice",
        choice: first,
        confidence: 0.5,
        probabilities: { [first]: 0.5 },
      };
    } else {
      answers[key] = {
        type: "score",
        score: 0,
        confidence: 0.5,
        probabilities: { "0": 1 },
      };
    }
  }

  return {
    model: "jev-1.13.0-mock",
    answers,
    usage: {
      input_tokens: Math.max(12, text.length),
      output_tokens: 0,
      cost_usd: 0.000001 * Math.max(1, Math.ceil(text.length / 4)),
      credits_remaining_usd: 4.99,
    },
  };
}

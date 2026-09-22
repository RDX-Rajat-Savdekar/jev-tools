import type { Question } from "./types";

/** Shared questions evaluated in one round trip per speculative window. */
export const COMMAND_QUESTIONS: Record<string, Question> = {
  intent: {
    type: "choice",
    instructions:
      "What agent action does this spoken command request? Pick the closest match. Use unknown if unclear.",
    criteria: {
      deploy_preview:
        "Deploy or push a branch/build to a preview or staging environment",
      destroy_data:
        "Drop, wipe, delete, or clear production data, databases, or backups",
      cleanup_build:
        "Clean up old build artifacts, caches, or temporary files",
      unknown: "Ambiguous, incomplete, or not a clear agent command",
    },
  },
  risk: {
    type: "score",
    instructions: "How destructive or irreversible is this command if executed?",
    criteria: [
      "Harmless read or local preview action",
      "Reversible change with low blast radius",
      "Risky but recoverable with effort",
      "Destructive or irreversible production impact",
    ],
  },
  block: {
    type: "noul",
    instructions:
      "Should this command be hard-blocked immediately without human review?",
    criteria: {
      true: "Irreversible production damage, data loss, or clear sabotage",
      false: "Safe enough to allow, auto-run, or send to human review",
    },
  },
};

export const INTENT_LABELS: Record<string, string> = {
  deploy_preview: "Deploy to preview",
  destroy_data: "Destroy production data",
  cleanup_build: "Clean build artifacts",
  unknown: "Unknown intent",
};

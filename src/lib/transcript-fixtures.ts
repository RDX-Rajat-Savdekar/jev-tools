export type ScriptedWord = {
  word: string;
  /** ms from utterance start */
  atMs: number;
};

export type ScriptedUtterance = {
  id: string;
  label: string;
  blurb: string;
  expectedIntent: "deploy_preview" | "destroy_data" | "cleanup_build" | "unknown";
  expectedOutcome: "fire" | "block" | "review";
  words: ScriptedWord[];
};

function wordsFrom(sentence: string, msPerWord = 380): ScriptedWord[] {
  return sentence
    .trim()
    .split(/\s+/)
    .map((word, i) => ({ word, atMs: (i + 1) * msPerWord }));
}

export const DEMO_UTTERANCES: ScriptedUtterance[] = [
  {
    id: "deploy",
    label: "Safe deploy",
    blurb: "Should fire mid-sentence — start the preview deploy before you finish talking.",
    expectedIntent: "deploy_preview",
    expectedOutcome: "fire",
    words: wordsFrom(
      "Hey can you go ahead and deploy the latest staging branch out to the customer preview environment for the design review this afternoon",
    ),
  },
  {
    id: "destroy",
    label: "Dangerous wipe",
    blurb: "Should hard-block mid-sentence — never touch production data.",
    expectedIntent: "destroy_data",
    expectedOutcome: "block",
    words: wordsFrom(
      "Please drop the entire production database right now and also clear all of the backup snapshots from the last month",
    ),
  },
  {
    id: "cleanup",
    label: "Vague cleanup",
    blurb: "Should pause for a human — intent is unclear, so don't auto-run.",
    expectedIntent: "cleanup_build",
    expectedOutcome: "review",
    words: wordsFrom(
      "Can you maybe clean up some of that old build stuff whenever you get a chance thanks",
      420,
    ),
  },
];

export function partialAt(utterance: ScriptedUtterance, elapsedMs: number): {
  text: string;
  isFinal: boolean;
} {
  const spoken = utterance.words.filter((w) => w.atMs <= elapsedMs);
  const isFinal =
    spoken.length === utterance.words.length &&
    elapsedMs >= (utterance.words.at(-1)?.atMs ?? 0) + 280;
  return {
    text: spoken.map((w) => w.word).join(" "),
    isFinal,
  };
}

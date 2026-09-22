export type ScriptedWord = {
  word: string;
  /** ms from utterance start */
  atMs: number;
};

export type ScriptedUtterance = {
  id: string;
  label: string;
  expectedIntent: "deploy_preview" | "destroy_data" | "cleanup_build" | "unknown";
  expectedOutcome: "fire" | "block" | "review";
  words: ScriptedWord[];
};

function wordsFrom(sentence: string, msPerWord = 320): ScriptedWord[] {
  return sentence
    .trim()
    .split(/\s+/)
    .map((word, i) => ({ word, atMs: (i + 1) * msPerWord }));
}

export const DEMO_UTTERANCES: ScriptedUtterance[] = [
  {
    id: "deploy",
    label: "Deploy preview",
    expectedIntent: "deploy_preview",
    expectedOutcome: "fire",
    words: wordsFrom("Deploy the staging branch to the preview environment"),
  },
  {
    id: "destroy",
    label: "Destroy production",
    expectedIntent: "destroy_data",
    expectedOutcome: "block",
    words: wordsFrom("Drop the production database and clear the backups"),
  },
  {
    id: "cleanup",
    label: "Ambiguous cleanup",
    expectedIntent: "cleanup_build",
    expectedOutcome: "review",
    words: wordsFrom("Clean up the old build stuff", 380),
  },
];

export function partialAt(utterance: ScriptedUtterance, elapsedMs: number): {
  text: string;
  isFinal: boolean;
} {
  const spoken = utterance.words.filter((w) => w.atMs <= elapsedMs);
  const isFinal =
    spoken.length === utterance.words.length &&
    elapsedMs >= (utterance.words.at(-1)?.atMs ?? 0) + 200;
  return {
    text: spoken.map((w) => w.word).join(" "),
    isFinal,
  };
}

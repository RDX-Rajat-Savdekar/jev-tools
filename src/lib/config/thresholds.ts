/**
 * Speculative / HITL thresholds.
 * Defaults until JevBench calibration overwrites via bench-report.json.
 */
export const DEFAULT_THRESHOLDS = {
  /** Choice confidence required to fire an action mid-utterance */
  speculativeFire: 0.92,
  /** Noul (block) probability required to hard-block mid-utterance */
  blockNoul: 0.7,
  /** Below this signal strength, keep buffering */
  lowConfidence: 0.4,
  /** Inclusive band that routes to human review instead of auto-fire */
  hitlLow: 0.4,
  hitlHigh: 0.7,
  /** Sliding window size in words before first speculative eval */
  windowSizeWords: 4,
  /** Minimum ms between speculative API calls */
  debounceMs: 250,
} as const;

export type Thresholds = {
  speculativeFire: number;
  blockNoul: number;
  lowConfidence: number;
  hitlLow: number;
  hitlHigh: number;
  windowSizeWords: number;
  debounceMs: number;
};

export const PINNED_MODEL = "jev-1.13.0";

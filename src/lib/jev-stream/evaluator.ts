import type { Thresholds } from "@/lib/config/thresholds";
import { DEFAULT_THRESHOLDS } from "@/lib/config/thresholds";
import type { DecideResponse } from "@/lib/jev/types";
import type { SpeculativeDecision } from "@/lib/jev/routing";
import { routeDecision } from "@/lib/jev/routing";

export type TranscriptChunk = {
  text: string;
  isFinal: boolean;
  timestamp: number;
};

export type DecideResult = {
  response: DecideResponse;
  decision?: SpeculativeDecision;
};

export type DecideFn = (
  partialText: string,
  signal: AbortSignal,
  meta: { phase: "partial" | "final"; tSavedMs?: number | null },
) => Promise<DecideResult>;

export type StreamEvents = {
  onSpeculative?: (payload: {
    decision: SpeculativeDecision;
    partialTranscript: string;
    sequence: number;
    tFire: number;
    response: DecideResponse;
  }) => void;
  onWait?: (payload: {
    decision: SpeculativeDecision;
    partialTranscript: string;
    sequence: number;
  }) => void;
  onFinalized?: (payload: {
    finalTranscript: string;
    executed: SpeculativeDecision | null;
    rolledBack: boolean;
    tSavedMs: number | null;
    finalDecision: SpeculativeDecision;
    response: DecideResponse;
  }) => void;
  onError?: (error: unknown, sequence: number) => void;
};

/**
 * Speculative partial-transcript evaluator.
 * Debounces, aborts stale in-flight requests, and measures t_saved.
 */
export class JevStreamEvaluator {
  private tokenBuffer: string[] = [];
  private config: Thresholds;
  private decide: DecideFn;
  private events: StreamEvents;
  private sequence = 0;
  private inFlight: AbortController | null = null;
  private lastEvalAt = 0;
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;
  private executed: SpeculativeDecision | null = null;
  private tFire: number | null = null;
  private lastPartial = "";

  constructor(
    decide: DecideFn,
    events: StreamEvents = {},
    config?: Partial<Thresholds>,
  ) {
    this.decide = decide;
    this.events = events;
    this.config = { ...DEFAULT_THRESHOLDS, ...config };
  }

  public pushChunk(chunk: TranscriptChunk): void {
    const words = chunk.text.trim().split(/\s+/).filter(Boolean);
    this.tokenBuffer = words;
    this.lastPartial = words.join(" ");

    if (chunk.isFinal) {
      void this.finalize(chunk.text, chunk.timestamp);
      return;
    }

    if (this.tokenBuffer.length < this.config.windowSizeWords) {
      return;
    }

    // Rate-limit evaluations: fire as soon as the window is met, then at most
    // once per debounceMs — do NOT wait for silence (ASR keeps streaming words).
    const elapsed = Date.now() - this.lastEvalAt;
    if (elapsed >= this.config.debounceMs || this.lastEvalAt === 0) {
      if (this.debounceTimer) {
        clearTimeout(this.debounceTimer);
        this.debounceTimer = null;
      }
      void this.evaluatePartial(this.lastPartial);
      return;
    }

    if (this.debounceTimer) return;
    const wait = this.config.debounceMs - elapsed;
    this.debounceTimer = setTimeout(() => {
      this.debounceTimer = null;
      void this.evaluatePartial(this.lastPartial);
    }, wait);
  }

  public reset(): void {
    if (this.debounceTimer) clearTimeout(this.debounceTimer);
    this.inFlight?.abort();
    this.inFlight = null;
    this.tokenBuffer = [];
    this.executed = null;
    this.tFire = null;
    this.lastPartial = "";
    this.lastEvalAt = 0;
  }

  private resolveDecision(result: DecideResult): SpeculativeDecision {
    return result.decision ?? routeDecision(result.response, this.config);
  }

  private async evaluatePartial(partialText: string): Promise<void> {
    if (this.executed && this.executed.action !== "wait") {
      return;
    }

    this.inFlight?.abort();
    const controller = new AbortController();
    this.inFlight = controller;
    const sequence = ++this.sequence;
    this.lastEvalAt = Date.now();

    try {
      const result = await this.decide(partialText, controller.signal, {
        phase: "partial",
      });
      if (sequence !== this.sequence) return;

      const decision = this.resolveDecision(result);

      if (decision.action === "wait") {
        this.events.onWait?.({
          decision,
          partialTranscript: partialText,
          sequence,
        });
        return;
      }

      if (this.executed) return;

      this.executed = decision;
      this.tFire = Date.now();
      this.events.onSpeculative?.({
        decision,
        partialTranscript: partialText,
        sequence,
        tFire: this.tFire,
        response: result.response,
      });
    } catch (error) {
      if (controller.signal.aborted) return;
      this.events.onError?.(error, sequence);
    } finally {
      if (this.inFlight === controller) this.inFlight = null;
    }
  }

  private async finalize(finalText: string, tFinal: number): Promise<void> {
    if (this.debounceTimer) clearTimeout(this.debounceTimer);

    // Give an in-flight mid-utterance eval a short window to land so t_saved
    // is measurable even when the API is slower than the last few words.
    if (this.inFlight && !this.executed) {
      await Promise.race([
        new Promise<void>((resolve) => {
          const poll = setInterval(() => {
            if (this.executed || !this.inFlight) {
              clearInterval(poll);
              resolve();
            }
          }, 25);
        }),
        new Promise<void>((resolve) => setTimeout(resolve, 1200)),
      ]);
    }

    this.inFlight?.abort();
    this.inFlight = null;

    const sequence = ++this.sequence;
    const text = finalText.trim() || this.lastPartial;
    const tSavedMs =
      this.tFire != null ? Math.max(0, tFinal - this.tFire) : null;

    try {
      const result = await this.decide(text, new AbortController().signal, {
        phase: "final",
        tSavedMs,
      });
      if (sequence !== this.sequence) return;

      const finalDecision = this.resolveDecision(result);
      let rolledBack = false;

      if (
        this.executed &&
        this.executed.action === "fire" &&
        (finalDecision.action === "block" ||
          (finalDecision.action === "fire" &&
            finalDecision.intent !== this.executed.intent) ||
          finalDecision.action === "wait" ||
          finalDecision.action === "review")
      ) {
        rolledBack = true;
      }

      this.events.onFinalized?.({
        finalTranscript: text,
        executed: this.executed,
        rolledBack,
        tSavedMs,
        finalDecision,
        response: result.response,
      });
    } catch (error) {
      this.events.onError?.(error, sequence);
    } finally {
      this.tokenBuffer = [];
      this.executed = null;
      this.tFire = null;
      this.lastPartial = "";
    }
  }
}

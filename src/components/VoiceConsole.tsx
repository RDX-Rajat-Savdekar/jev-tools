"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { DEMO_UTTERANCES } from "@/lib/transcript-fixtures";
import { INTENT_LABELS } from "@/lib/jev/questions";
import type { SpeculativeDecision } from "@/lib/jev/routing";
import type { DecideResponse } from "@/lib/jev/types";
import { useSpeechRecognition } from "@/hooks/useSpeechRecognition";
import { useScriptedTranscript } from "@/hooks/useScriptedTranscript";
import { JevStreamEvaluator } from "@/lib/jev-stream/evaluator";

type Mode = "mic" | "scripted";

type ActionCard = {
  id: string;
  decision: SpeculativeDecision;
  partial: string;
  tSavedMs: number | null;
  speculative: boolean;
  rolledBack?: boolean;
  auditId?: string;
};

type DecideApiResult = {
  decision: SpeculativeDecision;
  response: DecideResponse;
  auditId: string;
  usage: DecideResponse["usage"];
  thresholds: Record<string, number>;
};

async function callDecide(
  transcript: string,
  options?: { speculative?: boolean; tSavedMs?: number | null; signal?: AbortSignal },
): Promise<DecideApiResult> {
  const res = await fetch("/api/decide", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      transcript,
      speculative: options?.speculative ?? true,
      tSavedMs: options?.tSavedMs ?? null,
    }),
    signal: options?.signal,
  });
  const json = await res.json();
  if (!res.ok) {
    throw new Error(json.error ?? `Decide failed (${res.status})`);
  }
  return json as DecideApiResult;
}

export function VoiceConsole() {
  const [mode, setMode] = useState<Mode>("scripted");
  const [scriptIndex, setScriptIndex] = useState(0);
  const [transcript, setTranscript] = useState("");
  const [status, setStatus] = useState("Idle — pick mic or scripted mode");
  const [cards, setCards] = useState<ActionCard[]>([]);
  const [blocked, setBlocked] = useState<ActionCard | null>(null);
  const [reviewQueue, setReviewQueue] = useState<ActionCard[]>([]);
  const [costUsd, setCostUsd] = useState(0);
  const [lastTSaved, setLastTSaved] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const utterance = DEMO_UTTERANCES[scriptIndex];
  const evaluatorRef = useRef<JevStreamEvaluator | null>(null);

  const ensureEvaluator = useCallback(() => {
    if (evaluatorRef.current) return evaluatorRef.current;

    const evaluator = new JevStreamEvaluator(
      async (partialText, signal, meta) => {
        const result = await callDecide(partialText, {
          speculative: meta.phase === "partial",
          tSavedMs: meta.tSavedMs ?? null,
          signal,
        });
        setCostUsd((c) => c + (result.usage.cost_usd ?? 0));
        return { response: result.response, decision: result.decision };
      },
      {
        onSpeculative: ({ decision, partialTranscript, tFire }) => {
          const card: ActionCard = {
            id: `${tFire}-${decision.action}`,
            decision,
            partial: partialTranscript,
            tSavedMs: null,
            speculative: true,
          };
          if (decision.action === "block") {
            setBlocked(card);
            setStatus(`Blocked mid-utterance · noul gate`);
          } else if (decision.action === "fire") {
            setCards((prev) => [card, ...prev]);
            setStatus(
              `Early fire · ${INTENT_LABELS[decision.intent] ?? decision.intent}`,
            );
          } else if (decision.action === "review") {
            setReviewQueue((prev) => [card, ...prev]);
            setStatus("Queued for human review");
          }
        },
        onWait: ({ partialTranscript }) => {
          setStatus(`Listening… (${partialTranscript.split(/\s+/).length} words)`);
        },
        onFinalized: ({
          finalTranscript,
          executed,
          rolledBack,
          tSavedMs,
          finalDecision,
        }) => {
          setTranscript(finalTranscript);
          setLastTSaved(tSavedMs);
          setBusy(false);

          if (rolledBack && executed) {
            setCards((prev) =>
              prev.map((c) =>
                c.decision === executed ? { ...c, rolledBack: true } : c,
              ),
            );
            setStatus("Speculative action rolled back on final eval");
          } else if (tSavedMs != null && executed?.action === "fire") {
            setCards((prev) =>
              prev.map((c, i) =>
                i === 0 ? { ...c, tSavedMs } : c,
              ),
            );
            setStatus(
              `Confirmed · saved ${tSavedMs}ms before end of utterance`,
            );
          } else if (finalDecision.action === "review" && !executed) {
            const card: ActionCard = {
              id: `final-${Date.now()}`,
              decision: finalDecision,
              partial: finalTranscript,
              tSavedMs: null,
              speculative: false,
            };
            setReviewQueue((prev) => [card, ...prev]);
            setStatus("Final: needs human review");
          } else if (finalDecision.action === "block" && !executed) {
            setBlocked({
              id: `final-block-${Date.now()}`,
              decision: finalDecision,
              partial: finalTranscript,
              tSavedMs: null,
              speculative: false,
            });
            setStatus("Final: blocked");
          } else if (finalDecision.action === "fire" && !executed) {
            const card: ActionCard = {
              id: `final-fire-${Date.now()}`,
              decision: finalDecision,
              partial: finalTranscript,
              tSavedMs: null,
              speculative: false,
            };
            setCards((prev) => [card, ...prev]);
            setStatus(
              `Confirmed · ${INTENT_LABELS[finalDecision.intent] ?? finalDecision.intent}`,
            );
          } else {
            setStatus("Utterance complete");
          }
        },
        onError: (err) => {
          setBusy(false);
          setError(err instanceof Error ? err.message : String(err));
          setStatus("Error");
        },
      },
    );

    evaluatorRef.current = evaluator;
    return evaluator;
  }, []);

  const onChunk = useCallback(
    (chunk: { text: string; isFinal: boolean; timestamp: number }) => {
      setTranscript(chunk.text);
      ensureEvaluator().pushChunk(chunk);
    },
    [ensureEvaluator],
  );

  const speech = useSpeechRecognition(onChunk);
  const scripted = useScriptedTranscript(utterance, onChunk);

  const startSession = () => {
    setError(null);
    setBlocked(null);
    setTranscript("");
    setLastTSaved(null);
    setBusy(true);
    setStatus("Listening…");
    evaluatorRef.current?.reset();
    evaluatorRef.current = null;
    ensureEvaluator();
    if (mode === "mic") speech.start();
    else scripted.start();
  };

  const stopSession = () => {
    speech.stop();
    scripted.stop();
    setBusy(false);
  };

  const approveReview = async (card: ActionCard) => {
    setReviewQueue((q) => q.filter((c) => c.id !== card.id));
    setCards((prev) => [
      {
        ...card,
        decision:
          card.decision.action === "review"
            ? {
                action: "fire",
                intent: card.decision.intent,
                confidence: card.decision.confidence,
                status: "auto_approved",
              }
            : card.decision,
      },
      ...prev,
    ]);
    setStatus(`Approved · ${INTENT_LABELS[("intent" in card.decision && card.decision.intent) || ""] ?? "action"}`);
  };

  const active = speech.listening || scripted.playing || busy;

  const costLabel = useMemo(
    () => `$${costUsd.toFixed(6)}`,
    [costUsd],
  );

  return (
    <div className="console">
      <header className="console-header">
        <div>
          <p className="eyebrow">Jev Tools</p>
          <h1>Voice Command Console</h1>
          <p className="lede">
            Speak. JevStream fires mid-sentence. JevBench calibrates. JevAudit
            records every verdict.
          </p>
        </div>
        <nav className="nav">
          <Link href="/">Console</Link>
          <Link href="/bench">JevBench</Link>
          <Link href="/audit">JevAudit</Link>
        </nav>
      </header>

      <section className="metrics">
        <div className="metric">
          <span className="metric-label">Mode</span>
          <span className="metric-value">{mode}</span>
        </div>
        <div className="metric">
          <span className="metric-label">t_saved</span>
          <span className="metric-value accent">
            {lastTSaved != null ? `${lastTSaved}ms` : "—"}
          </span>
        </div>
        <div className="metric">
          <span className="metric-label">Session cost</span>
          <span className="metric-value">{costLabel}</span>
        </div>
        <div className="metric">
          <span className="metric-label">Status</span>
          <span className="metric-value">{status}</span>
        </div>
      </section>

      <section className="controls">
        <div className="mode-toggle">
          <button
            type="button"
            className={mode === "scripted" ? "active" : ""}
            onClick={() => setMode("scripted")}
          >
            Scripted
          </button>
          <button
            type="button"
            className={mode === "mic" ? "active" : ""}
            onClick={() => setMode("mic")}
            disabled={!speech.supported}
            title={
              speech.supported
                ? "Use microphone"
                : "Web Speech API unavailable in this browser"
            }
          >
            Mic
          </button>
        </div>

        {mode === "scripted" && (
          <select
            value={scriptIndex}
            onChange={(e) => setScriptIndex(Number(e.target.value))}
            aria-label="Demo utterance"
          >
            {DEMO_UTTERANCES.map((u, i) => (
              <option key={u.id} value={i}>
                {i + 1}. {u.label} → {u.expectedOutcome}
              </option>
            ))}
          </select>
        )}

        {!active ? (
          <button type="button" className="primary" onClick={startSession}>
            {mode === "mic" ? "Hold & speak" : "Play utterance"}
          </button>
        ) : (
          <button type="button" className="danger" onClick={stopSession}>
            Stop
          </button>
        )}
      </section>

      {(error || speech.error) && (
        <p className="error-banner">{error || speech.error}</p>
      )}

      <section className="transcript-panel">
        <div className="transcript-label">Live transcript</div>
        <p className={`transcript ${active ? "live" : ""}`}>
          {transcript || "—"}
        </p>
      </section>

      {blocked && (
        <div className="block-interstitial" role="alert">
          <div>
            <p className="eyebrow">Hard block</p>
            <h2>Command stopped mid-word</h2>
            <p>
              {blocked.decision.action === "block"
                ? `noul=${blocked.decision.noul.toFixed(2)} · risk=${blocked.decision.riskScore.toFixed(2)}`
                : null}
            </p>
            <p className="mono">{blocked.partial}</p>
          </div>
          <button type="button" onClick={() => setBlocked(null)}>
            Dismiss
          </button>
        </div>
      )}

      <div className="panels">
        <section>
          <h3>Early actions</h3>
          {cards.length === 0 && <p className="empty">No speculative fires yet.</p>}
          <ul className="card-list">
            {cards.map((card) => (
              <li
                key={card.id}
                className={`action-card ${card.rolledBack ? "rolled" : ""}`}
              >
                <div className="action-top">
                  <strong>
                    {card.decision.action === "fire"
                      ? INTENT_LABELS[card.decision.intent] ??
                        card.decision.intent
                      : card.decision.action}
                  </strong>
                  {card.tSavedMs != null && (
                    <span className="badge">−{card.tSavedMs}ms</span>
                  )}
                  {card.speculative && !card.rolledBack && (
                    <span className="badge muted">speculative</span>
                  )}
                  {card.rolledBack && (
                    <span className="badge danger">rolled back</span>
                  )}
                </div>
                <p className="mono">{card.partial}</p>
                {"confidence" in card.decision && (
                  <p className="meta">
                    confidence {card.decision.confidence.toFixed(2)}
                  </p>
                )}
              </li>
            ))}
          </ul>
        </section>

        <section>
          <h3>Human review</h3>
          {reviewQueue.length === 0 && (
            <p className="empty">Review queue empty.</p>
          )}
          <ul className="card-list">
            {reviewQueue.map((card) => (
              <li key={card.id} className="action-card review">
                <div className="action-top">
                  <strong>
                    {card.decision.action === "review"
                      ? INTENT_LABELS[card.decision.intent] ??
                        card.decision.intent
                      : "Review"}
                  </strong>
                  {"confidence" in card.decision && (
                    <span className="badge muted">
                      {card.decision.confidence.toFixed(2)}
                    </span>
                  )}
                </div>
                <p className="mono">{card.partial}</p>
                <button type="button" className="primary small" onClick={() => approveReview(card)}>
                  Approve on camera
                </button>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}

"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { DEMO_UTTERANCES } from "@/lib/transcript-fixtures";
import { INTENT_LABELS } from "@/lib/jev/questions";
import type { SpeculativeDecision } from "@/lib/jev/routing";
import type { DecideResponse } from "@/lib/jev/types";
import { useSpeechRecognition } from "@/hooks/useSpeechRecognition";
import { useScriptedTranscript } from "@/hooks/useScriptedTranscript";
import { JevStreamEvaluator } from "@/lib/jev-stream/evaluator";
import { AppShell } from "./AppShell";
import { Waveform } from "./Waveform";
import { ConfidenceRing } from "./ConfidenceRing";
import { DecisionPipeline } from "./DecisionPipeline";
import { StatCounter } from "./StatCounter";

gsap.registerPlugin(useGSAP);

type Mode = "mic" | "scripted";

type ActionCard = {
  id: string;
  decision: SpeculativeDecision;
  partial: string;
  tSavedMs: number | null;
  speculative: boolean;
  rolledBack?: boolean;
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
  options?: {
    speculative?: boolean;
    tSavedMs?: number | null;
    signal?: AbortSignal;
  },
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

function intentLabel(decision: SpeculativeDecision) {
  if ("intent" in decision && decision.intent) {
    return INTENT_LABELS[decision.intent] ?? decision.intent;
  }
  return decision.action;
}

export function VoiceConsole() {
  const [mode, setMode] = useState<Mode>("scripted");
  const [scriptIndex, setScriptIndex] = useState(0);
  const [transcript, setTranscript] = useState("");
  const [status, setStatus] = useState("standby");
  const [cards, setCards] = useState<ActionCard[]>([]);
  const [blocked, setBlocked] = useState<ActionCard | null>(null);
  const [reviewQueue, setReviewQueue] = useState<ActionCard[]>([]);
  const [costUsd, setCostUsd] = useState(0);
  const [lastTSaved, setLastTSaved] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [lastConfidence, setLastConfidence] = useState<number | null>(null);
  const [decisionCount, setDecisionCount] = useState(0);
  const [waveMood, setWaveMood] = useState<
    "idle" | "listening" | "fired" | "blocked"
  >("idle");

  const stageRef = useRef<HTMLDivElement>(null);
  const tSavedRef = useRef<HTMLElement>(null);
  const blockRef = useRef<HTMLDivElement>(null);
  const evaluatorRef = useRef<JevStreamEvaluator | null>(null);

  const utterance = DEMO_UTTERANCES[scriptIndex];

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
          setDecisionCount((n) => n + 1);
          if ("confidence" in decision) {
            setLastConfidence(decision.confidence);
          } else if (decision.action === "block") {
            setLastConfidence(decision.noul);
          }
          if (decision.action === "block") {
            setBlocked(card);
            setWaveMood("blocked");
            setStatus("hard block");
          } else if (decision.action === "fire") {
            setCards((prev) => [card, ...prev]);
            setWaveMood("fired");
            setStatus(`early fire · ${intentLabel(decision)}`);
          } else if (decision.action === "review") {
            setReviewQueue((prev) => [card, ...prev]);
            setStatus("queued for review");
          }
        },
        onWait: ({ partialTranscript }) => {
          setStatus(`listening · ${partialTranscript.split(/\s+/).length}w`);
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
          setWaveMood((m) => (m === "blocked" ? m : "idle"));

          if (rolledBack && executed) {
            setCards((prev) =>
              prev.map((c) =>
                c.decision === executed ? { ...c, rolledBack: true } : c,
              ),
            );
            setStatus("rolled back");
          } else if (tSavedMs != null && executed?.action === "fire") {
            setCards((prev) =>
              prev.map((c, i) => (i === 0 ? { ...c, tSavedMs } : c)),
            );
            setStatus(
              `confirmed · ${
                tSavedMs >= 1000
                  ? `${(tSavedMs / 1000).toFixed(1)}s`
                  : `${tSavedMs}ms`
              } early`,
            );
          } else if (finalDecision.action === "review" && !executed) {
            setReviewQueue((prev) => [
              {
                id: `final-${Date.now()}`,
                decision: finalDecision,
                partial: finalTranscript,
                tSavedMs: null,
                speculative: false,
              },
              ...prev,
            ]);
            setStatus("needs review");
          } else if (finalDecision.action === "block" && !executed) {
            setBlocked({
              id: `final-block-${Date.now()}`,
              decision: finalDecision,
              partial: finalTranscript,
              tSavedMs: null,
              speculative: false,
            });
            setWaveMood("blocked");
            setStatus("blocked");
          } else if (finalDecision.action === "fire" && !executed) {
            setCards((prev) => [
              {
                id: `final-fire-${Date.now()}`,
                decision: finalDecision,
                partial: finalTranscript,
                tSavedMs: null,
                speculative: false,
              },
              ...prev,
            ]);
            setStatus(`confirmed · ${intentLabel(finalDecision)}`);
          } else {
            setStatus("complete");
          }
        },
        onError: (err) => {
          setBusy(false);
          setWaveMood("idle");
          setError(err instanceof Error ? err.message : String(err));
          setStatus("error");
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
  const active = speech.listening || scripted.playing || busy;

  const startSession = () => {
    setError(null);
    setBlocked(null);
    setCards([]);
    setReviewQueue([]);
    setTranscript("");
    setLastTSaved(null);
    setLastConfidence(null);
    setDecisionCount(0);
    if (tSavedRef.current) tSavedRef.current.textContent = "—";
    setBusy(true);
    setWaveMood("listening");
    setStatus("listening");
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
    setWaveMood("idle");
  };

  const approveReview = (card: ActionCard) => {
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
    setStatus(`approved · ${intentLabel(card.decision)}`);
  };

  // Count-up "acted early" display
  useGSAP(
    () => {
      if (lastTSaved == null || !tSavedRef.current) return;
      const obj = { v: 0 };
      gsap.to(obj, {
        v: lastTSaved,
        duration: 0.7,
        ease: "power2.out",
        onUpdate: () => {
          if (tSavedRef.current) {
            const sec = obj.v / 1000;
            tSavedRef.current.textContent =
              sec >= 1
                ? `${sec.toFixed(1)}s early`
                : `${Math.round(obj.v)}ms early`;
          }
        },
      });
    },
    { dependencies: [lastTSaved] },
  );

  // Block sheet entrance
  useGSAP(
    () => {
      if (!blocked || !blockRef.current) return;
      gsap.fromTo(
        blockRef.current,
        { autoAlpha: 0, y: 18, scale: 0.98 },
        { autoAlpha: 1, y: 0, scale: 1, duration: 0.28, ease: "power3.out" },
      );
    },
    { dependencies: [blocked] },
  );

  // Stage enter
  useGSAP(
    () => {
      if (!stageRef.current) return;
      const els = stageRef.current.querySelectorAll(".anim-in");
      gsap.fromTo(
        els,
        { autoAlpha: 0, y: 10 },
        {
          autoAlpha: 1,
          y: 0,
          duration: 0.45,
          stagger: 0.06,
          ease: "power2.out",
          overwrite: true,
        },
      );
    },
    { scope: stageRef },
  );

  // New event flash
  const listRef = useRef<HTMLUListElement>(null);
  useEffect(() => {
    const first = listRef.current?.querySelector<HTMLElement>(".event");
    if (!first || cards.length === 0) return;
    gsap.fromTo(
      first,
      { backgroundColor: "rgba(224,112,60,0.18)" },
      {
        backgroundColor: "transparent",
        duration: 0.9,
        ease: "power1.out",
      },
    );
  }, [cards]);

  const costLabel = useMemo(() => `$${costUsd.toFixed(6)}`, [costUsd]);
  const wordCount = useMemo(
    () => (transcript.trim() ? transcript.trim().split(/\s+/).length : 0),
    [transcript],
  );

  const formatEarly = (ms: number | null) => {
    if (ms == null) return "—";
    const sec = ms / 1000;
    return sec >= 1 ? `${sec.toFixed(1)}s early` : `${ms}ms early`;
  };

  return (
    <AppShell
      live={active}
      meta={
        <>
          <span>{costLabel}</span>
          <span>jev-1.13.0</span>
        </>
      }
    >
      <div className="workspace" ref={stageRef}>
        <section className="stage">
          <div className="stage-header anim-in">
            <div>
              <h1 className="stage-title">Live session</h1>
              <p className="stage-copy">
                The agent starts acting while you are still speaking — fire,
                block, or ask a human.
              </p>
            </div>
            <div className="hud-with-ring">
              <ConfidenceRing
                value={lastConfidence}
                tone={
                  waveMood === "blocked"
                    ? "info"
                    : waveMood === "fired"
                      ? "ember"
                      : "mint"
                }
              />
              <div className="hud">
                <div className="hud-item">
                  <span>acted early</span>
                  <strong ref={tSavedRef} className="ember">
                    {formatEarly(lastTSaved)}
                  </strong>
                </div>
                <div className="hud-item">
                  <span>words heard</span>
                  <strong>
                    {wordCount ? (
                      <StatCounter
                        value={wordCount}
                        decimals={0}
                        className="stat-num"
                      />
                    ) : (
                      "—"
                    )}
                  </strong>
                </div>
                <div className="hud-item">
                  <span>decisions</span>
                  <strong>
                    {decisionCount ? (
                      <StatCounter
                        value={decisionCount}
                        decimals={0}
                        className="stat-num"
                      />
                    ) : (
                      "—"
                    )}
                  </strong>
                </div>
                <div className="hud-item">
                  <span>session cost</span>
                  <strong>{costLabel}</strong>
                </div>
                <div className="hud-item">
                  <span>status</span>
                  <strong className={active ? "mint" : undefined}>{status}</strong>
                </div>
              </div>
            </div>
          </div>

          <DecisionPipeline
            active={active}
            phase={
              blocked
                ? "blocked"
                : waveMood === "fired"
                  ? "fired"
                  : reviewQueue.length
                    ? "review"
                    : active
                      ? "listening"
                      : "idle"
            }
          />

          {mode === "scripted" && (
            <p className="demo-hint anim-in" style={{ marginTop: "0.85rem" }}>
              <strong>{utterance.label}:</strong> {utterance.blurb}
            </p>
          )}

          {(error || speech.error) && (
            <p className="error-banner">{error || speech.error}</p>
          )}

          <div className="waveform-wrap anim-in">
            <p className="kicker">channel</p>
            <Waveform active={active || waveMood !== "idle"} mood={waveMood} />
          </div>

          <div className={`transcript-block anim-in ${active ? "scanning" : ""}`}>
            <p className="kicker">transcript</p>
            <p className={`transcript ${active ? "live" : ""}`}>
              {transcript || <span className="ghost">waiting for speech</span>}
            </p>
          </div>

          <div className="controls anim-in">
            <div className="seg">
              <button
                type="button"
                className={mode === "scripted" ? "on" : ""}
                onClick={() => setMode("scripted")}
              >
                scripted
              </button>
              <button
                type="button"
                className={mode === "mic" ? "on" : ""}
                onClick={() => setMode("mic")}
                disabled={!speech.supported}
              >
                mic
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
              <button type="button" className="btn primary" onClick={startSession}>
                {mode === "mic" ? "start listening" : "play utterance"}
              </button>
            ) : (
              <button type="button" className="btn ghost-danger" onClick={stopSession}>
                stop
              </button>
            )}
          </div>
        </section>

        <aside className="rail">
          <div className="rail-section primary">
            <h2>Early actions</h2>
            <p className="rail-sub">
              Fired before you finished the sentence. This is the whole demo.
            </p>
            {cards.length === 0 && (
              <p className="empty">Play an utterance — actions show up here first.</p>
            )}
            <ul className="event-list" ref={listRef}>
              {cards.map((card) => (
                <li
                  key={card.id}
                  className={`event hero fire ${card.rolledBack ? "rolled" : ""}`}
                >
                  <div className="event-top">
                    <strong>{intentLabel(card.decision)}</strong>
                    {card.speculative && !card.rolledBack && (
                      <span className="chip ember lg">mid-sentence</span>
                    )}
                    {card.rolledBack && (
                      <span className="chip danger lg">rolled back</span>
                    )}
                  </div>
                  <p className="event-lead">{card.partial}</p>
                  <div className="event-stats">
                    <div>
                      <span>acted early</span>
                      <strong className="ember">
                        {formatEarly(card.tSavedMs)}
                      </strong>
                    </div>
                    <div>
                      <span>confidence</span>
                      <strong>
                        {"confidence" in card.decision
                          ? `${Math.round(card.decision.confidence * 100)}%`
                          : "—"}
                      </strong>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </div>

          <div className="rail-section" style={{ flex: 1 }}>
            <h2>Needs a human</h2>
            <p className="rail-sub">
              Low confidence — approve on camera for the LinkedIn take.
            </p>
            {reviewQueue.length === 0 && (
              <p className="empty">Queue clear.</p>
            )}
            <ul className="event-list">
              {reviewQueue.map((card) => (
                <li key={card.id} className="event hero review">
                  <div className="event-top">
                    <strong>{intentLabel(card.decision)}</strong>
                    <span className="chip lg">review</span>
                  </div>
                  <p className="event-lead">{card.partial}</p>
                  <div className="event-stats">
                    <div>
                      <span>confidence</span>
                      <strong>
                        {"confidence" in card.decision
                          ? `${Math.round(card.decision.confidence * 100)}%`
                          : "—"}
                      </strong>
                    </div>
                    <div>
                      <span>action</span>
                      <strong>hold</strong>
                    </div>
                  </div>
                  <div style={{ marginTop: "0.85rem" }}>
                    <button
                      type="button"
                      className="btn mint"
                      onClick={() => approveReview(card)}
                    >
                      approve on camera
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </aside>
      </div>

      {blocked && (
        <div className="block-sheet" role="alertdialog" aria-modal>
          <div className="block-panel" ref={blockRef}>
            <p className="kicker">hard block</p>
            <h2>Stopped mid-sentence</h2>
            <p>
              {blocked.decision.action === "block"
                ? `Block score ${blocked.decision.noul.toFixed(2)} · risk ${blocked.decision.riskScore.toFixed(2)}`
                : null}
            </p>
            <p className="mono">{blocked.partial}</p>
            <button
              type="button"
              className="btn"
              style={{ marginTop: "0.5rem" }}
              onClick={() => {
                setBlocked(null);
                setWaveMood("idle");
              }}
            >
              dismiss
            </button>
          </div>
        </div>
      )}
    </AppShell>
  );
}

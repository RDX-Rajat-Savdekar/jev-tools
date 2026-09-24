"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import type { LedgerRow } from "@/lib/jev-audit/ledger";
import { AppShell } from "./AppShell";
import { StatCounter } from "./StatCounter";
import { ConfidenceRing } from "./ConfidenceRing";
import { AuditRouteFlow } from "./AuditRouteFlow";

gsap.registerPlugin(useGSAP);

type LiveEvent = {
  id: string;
  verdict: string;
  status: string;
  context: string;
  confidence: number;
  tSavedMs: number | null;
  speculative: boolean;
  cost: number;
  at: number;
  synthetic?: boolean;
};

const SCRIPT: Array<Omit<LiveEvent, "id" | "at">> = [
  {
    verdict: "fire",
    status: "auto_approved",
    context:
      "Hey can you deploy the latest staging branch to the customer preview…",
    confidence: 0.94,
    tSavedMs: 1180,
    speculative: true,
    cost: 0.000012,
  },
  {
    verdict: "block",
    status: "blocked",
    context: "Please drop the entire production database right now and…",
    confidence: 0.93,
    tSavedMs: 640,
    speculative: true,
    cost: 0.000014,
  },
  {
    verdict: "review",
    status: "needs_review",
    context: "Can you maybe clean up some of that old build stuff…",
    confidence: 0.56,
    tSavedMs: 5000,
    speculative: true,
    cost: 0.000011,
  },
  {
    verdict: "fire",
    status: "auto_approved",
    context: "Push this branch to the preview environment for design review",
    confidence: 0.91,
    tSavedMs: 840,
    speculative: true,
    cost: 0.00001,
  },
  {
    verdict: "block",
    status: "blocked",
    context: "Wipe production and delete all backup snapshots from last month",
    confidence: 0.96,
    tSavedMs: 520,
    speculative: true,
    cost: 0.000015,
  },
  {
    verdict: "fire",
    status: "auto_approved",
    context: "Ship the design-review build to the shared preview URL now",
    confidence: 0.89,
    tSavedMs: 960,
    speculative: true,
    cost: 0.000013,
  },
  {
    verdict: "review",
    status: "needs_review",
    context: "Could you tidy whatever is left from yesterday's failed deploy",
    confidence: 0.48,
    tSavedMs: 4200,
    speculative: true,
    cost: 0.000009,
  },
  {
    verdict: "block",
    status: "blocked",
    context: "Force-reset the production cluster and purge the audit logs",
    confidence: 0.97,
    tSavedMs: 410,
    speculative: true,
    cost: 0.000016,
  },
];

const TICK_MS = 1600;

function rowToEvent(row: LedgerRow): LiveEvent {
  return {
    id: row.id,
    verdict: row.verdict,
    status: row.status,
    context: row.raw_context,
    confidence: row.confidence_score,
    tSavedMs: row.t_saved_ms,
    speculative: Boolean(row.speculative),
    cost: row.cost_usd ?? 0,
    at: Date.parse(row.timestamp) || Date.now(),
  };
}

function formatEarly(ms: number | null) {
  if (ms == null) return "—";
  return ms >= 1000 ? `${(ms / 1000).toFixed(1)}s early` : `${ms}ms early`;
}

function makeSimEvent(index: number): LiveEvent {
  const base = SCRIPT[index % SCRIPT.length];
  return {
    ...base,
    id: `sim-${Date.now()}-${index}-${Math.random().toString(36).slice(2, 7)}`,
    at: Date.now(),
    synthetic: true,
  };
}

export function AuditPanel() {
  const [real, setReal] = useState<LiveEvent[]>([]);
  const [simEvents, setSimEvents] = useState<LiveEvent[]>([]);
  const [demoMode, setDemoMode] = useState(true);
  const [clock, setClock] = useState(0);
  const [flash, setFlash] = useState(0);
  const simIndex = useRef(0);
  const root = useRef<HTMLDivElement>(null);
  const heroRef = useRef<HTMLDivElement>(null);
  const historyRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/audit?limit=20");
      const json = await res.json();
      const rows = (json.entries as LedgerRow[] | undefined) ?? [];
      setReal(rows.map(rowToEvent));
      // Never auto-kill demo mode — real ledger can sit beside the sim feed.
    } catch {
      /* keep demo feed */
    }
  }, []);

  useEffect(() => {
    void load();
    const t = setInterval(() => void load(), 4000);
    return () => clearInterval(t);
  }, [load]);

  // Push one simulated decision on a steady beat while demo mode is on.
  useEffect(() => {
    if (!demoMode) return;

    const push = () => {
      const event = makeSimEvent(simIndex.current);
      simIndex.current += 1;
      setSimEvents((prev) => [event, ...prev].slice(0, 10));
      setClock((c) => c + 1);
      setFlash((f) => f + 1);
    };

    push(); // immediate first tick so the page is never idle
    const id = setInterval(push, TICK_MS);
    return () => clearInterval(id);
  }, [demoMode]);

  const events = useMemo(() => {
    if (demoMode) return simEvents.slice(0, 8);
    return real.slice(0, 8);
  }, [demoMode, simEvents, real]);

  const current = events[0] ?? null;
  const history = events.slice(1, 5);

  const counts = useMemo(() => {
    const all = events;
    return {
      fire: all.filter((e) => e.verdict === "fire").length,
      block: all.filter((e) => e.verdict === "block").length,
      review: all.filter(
        (e) => e.verdict === "review" || e.status === "needs_review",
      ).length,
      cost: all.reduce((s, e) => s + e.cost, 0),
      early: all.filter((e) => e.tSavedMs != null).length,
    };
  }, [events]);

  const total = Math.max(1, counts.fire + counts.block + counts.review);

  useGSAP(
    () => {
      if (!heroRef.current || !current) return;
      gsap.fromTo(
        heroRef.current,
        { autoAlpha: 0.35, y: 14, scale: 0.985 },
        {
          autoAlpha: 1,
          y: 0,
          scale: 1,
          duration: 0.4,
          ease: "power3.out",
          overwrite: true,
        },
      );
    },
    { dependencies: [current?.id, flash] },
  );

  useGSAP(
    () => {
      if (!historyRef.current) return;
      const cards = historyRef.current.querySelectorAll(".history-card");
      if (!cards.length) return;
      gsap.fromTo(
        cards[0],
        { autoAlpha: 0, y: -10 },
        {
          autoAlpha: 1,
          y: 0,
          duration: 0.35,
          ease: "power2.out",
          overwrite: true,
        },
      );
    },
    { dependencies: [history[0]?.id] },
  );

  useGSAP(
    () => {
      if (!root.current) return;
      const targets = root.current.querySelectorAll(".dash-in");
      gsap.set(targets, { autoAlpha: 1, y: 0 });
      gsap.fromTo(
        targets,
        { autoAlpha: 0, y: 12 },
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
    { scope: root },
  );

  const approve = async () => {
    if (!current) return;
    if (current.synthetic) {
      setSimEvents((prev) =>
        prev.map((e) =>
          e.id === current.id
            ? { ...e, status: "overridden", verdict: "fire" }
            : e,
        ),
      );
      setFlash((f) => f + 1);
      return;
    }
    await fetch(`/api/audit/${current.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ override: "approved", reviewerId: "demo" }),
    });
    await load();
  };

  return (
    <AppShell live={demoMode || Boolean(current)}>
      <div className="dash-page audit-dash" ref={root}>
        <header className="dash-hero dash-in">
          <div>
            <p className="kicker">jevaudit</p>
            <h1>Live ledger</h1>
            <p className="lede">
              Decisions stream in as the agent speaks. Nothing silent.
            </p>
          </div>
          <div className="dash-hero-actions">
            <div className={`sweep-status ${demoMode ? "sweeping" : "done"}`}>
              <span className="sweep-pulse" />
              {demoMode ? "simulating traffic" : "live ledger"}
            </div>
            <button
              type="button"
              className="btn"
              onClick={() => {
                setDemoMode((d) => !d);
                if (!demoMode) {
                  simIndex.current = 0;
                  setSimEvents([]);
                  setClock(0);
                }
              }}
            >
              {demoMode ? "use real ledger" : "demo stream"}
            </button>
          </div>
        </header>

        <div className="audit-grid">
          <section className="dash-panel mix-panel dash-in">
            <AuditRouteFlow verdict={current?.verdict ?? null} />
            <div className="mix-bar" style={{ marginTop: "0.85rem" }}>
              <i
                className="fire"
                style={{ width: `${(counts.fire / total) * 100}%` }}
              />
              <i
                className="block"
                style={{ width: `${(counts.block / total) * 100}%` }}
              />
              <i
                className="review"
                style={{ width: `${(counts.review / total) * 100}%` }}
              />
            </div>
            <div className="mix-legend">
              <span>
                <b className="c-fire" /> fire {counts.fire}
              </span>
              <span>
                <b className="c-block" /> block {counts.block}
              </span>
              <span>
                <b className="c-review" /> review {counts.review}
              </span>
            </div>
            <div className="bench-mini-stats" style={{ marginTop: "1.25rem" }}>
              <div>
                <span>stream ticks</span>
                <StatCounter
                  value={clock}
                  decimals={0}
                  className="stat-num"
                  duration={0.35}
                />
              </div>
              <div>
                <span>mid-sentence</span>
                <StatCounter
                  value={counts.early}
                  decimals={0}
                  className="stat-num ember"
                  duration={0.35}
                />
              </div>
              <div>
                <span>session cost</span>
                <StatCounter
                  value={counts.cost}
                  decimals={5}
                  prefix="$"
                  className="stat-num"
                  duration={0.35}
                />
              </div>
            </div>
          </section>

          <section className="dash-panel now-panel dash-in">
            <p className="kicker">
              now deciding
              {demoMode && <span className="live-pip" aria-hidden />}
            </p>
            {current ? (
              <div
                className={`now-card ${current.verdict}`}
                ref={heroRef}
                key={current.id}
              >
                <div className="now-top">
                  <strong>{current.verdict}</strong>
                  {current.speculative && (
                    <span className="chip ember lg">mid-sentence</span>
                  )}
                  <span className="chip lg">{current.status}</span>
                </div>
                <p className="now-copy">{current.context}</p>
                <div className="now-foot">
                  <ConfidenceRing
                    value={current.confidence}
                    tone={
                      current.verdict === "block"
                        ? "info"
                        : current.verdict === "review"
                          ? "info"
                          : "ember"
                    }
                  />
                  <div className="event-stats" style={{ flex: 1 }}>
                    <div>
                      <span>acted early</span>
                      <strong className="ember">
                        {formatEarly(current.tSavedMs)}
                      </strong>
                    </div>
                    <div>
                      <span>cost</span>
                      <strong>${current.cost.toFixed(6)}</strong>
                    </div>
                  </div>
                </div>
                {(current.status === "needs_review" ||
                  current.verdict === "review") && (
                  <button
                    type="button"
                    className="btn mint"
                    style={{ marginTop: "1rem" }}
                    onClick={() => void approve()}
                  >
                    approve on camera
                  </button>
                )}
              </div>
            ) : (
              <p className="empty">Waiting for traffic…</p>
            )}
          </section>

          <section className="dash-panel history-panel dash-in">
            <p className="kicker">just before</p>
            <div className="history-stack" ref={historyRef}>
              {history.length === 0 && (
                <p className="empty">Previous decisions stack here.</p>
              )}
              {history.map((e, idx) => (
                <div
                  key={e.id}
                  className={`history-card ${e.verdict}`}
                  style={{ opacity: 1 - idx * 0.14 }}
                >
                  <div className="event-top">
                    <strong>{e.verdict}</strong>
                    <span className="chip">
                      {Math.round(e.confidence * 100)}%
                    </span>
                    {e.tSavedMs != null && (
                      <span className="chip ember">
                        {formatEarly(e.tSavedMs)}
                      </span>
                    )}
                  </div>
                  <p>{e.context}</p>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>
    </AppShell>
  );
}

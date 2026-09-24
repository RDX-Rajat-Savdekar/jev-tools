"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import type { LedgerRow } from "@/lib/jev-audit/ledger";
import { AppShell } from "./AppShell";
import { StatCounter } from "./StatCounter";
import { ConfidenceRing } from "./ConfidenceRing";

gsap.registerPlugin(useGSAP);

export function AuditPanel() {
  const [entries, setEntries] = useState<LedgerRow[]>([]);
  const [totalCost, setTotalCost] = useState(0);
  const [mode, setMode] = useState<"all" | "review">("all");
  const [error, setError] = useState<string | null>(null);
  const [pulse, setPulse] = useState(0);
  const root = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const prevCount = useRef(0);

  const load = useCallback(async () => {
    try {
      const q = mode === "review" ? "?mode=review" : "";
      const res = await fetch(`/api/audit${q}`);
      const json = await res.json();
      setEntries(json.entries ?? []);
      setTotalCost(json.totalCostUsd ?? 0);
      setPulse((p) => p + 1);
    } catch (e) {
      setError(String(e));
    }
  }, [mode]);

  useEffect(() => {
    void load();
    const t = setInterval(() => void load(), 2500);
    return () => clearInterval(t);
  }, [load]);

  useGSAP(
    () => {
      if (!root.current) return;
      gsap.fromTo(
        root.current.querySelectorAll(".anim-in"),
        { autoAlpha: 0, y: 10 },
        {
          autoAlpha: 1,
          y: 0,
          duration: 0.4,
          stagger: 0.05,
          ease: "power2.out",
          overwrite: true,
        },
      );
    },
    { scope: root, dependencies: [mode] },
  );

  useEffect(() => {
    if (entries.length > prevCount.current && listRef.current) {
      const newest = listRef.current.querySelector<HTMLElement>(".event");
      if (newest) {
        gsap.fromTo(
          newest,
          { autoAlpha: 0, x: -12, backgroundColor: "rgba(45,212,168,0.18)" },
          {
            autoAlpha: 1,
            x: 0,
            backgroundColor: "transparent",
            duration: 0.55,
            ease: "power2.out",
          },
        );
      }
    }
    prevCount.current = entries.length;
  }, [entries, pulse]);

  const approve = async (id: string, override: string) => {
    await fetch(`/api/audit/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ override, reviewerId: "linkedin-demo" }),
    });
    await load();
  };

  const avgConf =
    entries.length === 0
      ? null
      : entries.reduce((s, e) => s + e.confidence_score, 0) / entries.length;
  const reviewCount = entries.filter((e) => e.status === "needs_review").length;
  const speculativeCount = entries.filter((e) => e.speculative).length;

  return (
    <AppShell live={entries.length > 0}>
      <div className="page" ref={root}>
        <h1 className="anim-in">Ledger</h1>
        <p className="lede anim-in">
          Append-only verdicts. Type-aware confidence. Overrides leave a trail.
        </p>

        <div className="stat-row anim-in">
          <div className="stat">
            <span>entries</span>
            <StatCounter value={entries.length} decimals={0} className="stat-num" />
          </div>
          <div className="stat">
            <span>ledger cost</span>
            <StatCounter
              value={totalCost}
              decimals={6}
              prefix="$"
              className="stat-num"
            />
          </div>
          <div className="stat">
            <span>in review</span>
            <StatCounter value={reviewCount} decimals={0} className="stat-num" />
          </div>
          <div className="stat">
            <span>mid-sentence</span>
            <StatCounter
              value={speculativeCount}
              decimals={0}
              className="stat-num"
            />
          </div>
        </div>

        <div
          className="panel-plain anim-in"
          style={{
            display: "flex",
            gap: "1.5rem",
            alignItems: "center",
            flexWrap: "wrap",
          }}
        >
          <ConfidenceRing value={avgConf} label="avg conf" tone="info" />
          <div>
            <p className="kicker">stream health</p>
            <p style={{ margin: 0, color: "var(--muted)", maxWidth: "28rem" }}>
              New decisions slide into the ledger live. Speculative rows are
              tagged when JevStream fired before end-of-turn.
            </p>
          </div>
        </div>

        <div className="controls anim-in" style={{ padding: "0 0 1rem", border: 0 }}>
          <div className="seg">
            <button
              type="button"
              className={mode === "all" ? "on" : ""}
              onClick={() => setMode("all")}
            >
              all
            </button>
            <button
              type="button"
              className={mode === "review" ? "on" : ""}
              onClick={() => setMode("review")}
            >
              needs review
            </button>
          </div>
          <button type="button" className="btn" onClick={() => void load()}>
            refresh
          </button>
        </div>

        {error && <p className="error-banner">{error}</p>}

        <ul className="event-list anim-in ledger-stream" ref={listRef}>
          {entries.length === 0 && (
            <li className="empty">No entries. Run the console demo.</li>
          )}
          {entries.map((row) => (
            <li
              key={row.id}
              className={`event hero ${
                row.verdict === "block"
                  ? "block"
                  : row.status === "needs_review"
                    ? "review"
                    : "fire"
              }`}
            >
              <div className="event-top">
                <strong>{row.verdict}</strong>
                <span className="chip lg">{row.status}</span>
                {row.speculative ? (
                  <span className="chip ember lg">mid-sentence</span>
                ) : null}
                {row.rolled_back ? (
                  <span className="chip danger lg">rolled back</span>
                ) : null}
              </div>
              <p className="event-lead">{row.raw_context}</p>
              <div className="event-stats">
                <div>
                  <span>confidence</span>
                  <strong>{Math.round(row.confidence_score * 100)}%</strong>
                </div>
                <div>
                  <span>acted early</span>
                  <strong className="ember">
                    {row.t_saved_ms != null
                      ? row.t_saved_ms >= 1000
                        ? `${(row.t_saved_ms / 1000).toFixed(1)}s early`
                        : `${row.t_saved_ms}ms early`
                      : "—"}
                  </strong>
                </div>
                <div>
                  <span>cost</span>
                  <strong>
                    {row.cost_usd != null
                      ? `$${row.cost_usd.toFixed(6)}`
                      : "—"}
                  </strong>
                </div>
                <div>
                  <span>model</span>
                  <strong>{row.model_version ?? "—"}</strong>
                </div>
              </div>
              {row.status === "needs_review" && (
                <div
                  style={{
                    marginTop: "0.85rem",
                    display: "flex",
                    gap: "0.4rem",
                  }}
                >
                  <button
                    type="button"
                    className="btn mint"
                    onClick={() => void approve(row.id, "approved")}
                  >
                    approve
                  </button>
                  <button
                    type="button"
                    className="btn ghost-danger"
                    onClick={() => void approve(row.id, "rejected")}
                  >
                    reject
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      </div>
    </AppShell>
  );
}

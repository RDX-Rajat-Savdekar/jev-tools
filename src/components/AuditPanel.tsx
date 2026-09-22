"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import type { LedgerRow } from "@/lib/jev-audit/ledger";
import { AppShell } from "./AppShell";

gsap.registerPlugin(useGSAP);

export function AuditPanel() {
  const [entries, setEntries] = useState<LedgerRow[]>([]);
  const [totalCost, setTotalCost] = useState(0);
  const [mode, setMode] = useState<"all" | "review">("all");
  const [error, setError] = useState<string | null>(null);
  const root = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    try {
      const q = mode === "review" ? "?mode=review" : "";
      const res = await fetch(`/api/audit${q}`);
      const json = await res.json();
      setEntries(json.entries ?? []);
      setTotalCost(json.totalCostUsd ?? 0);
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
        { autoAlpha: 0, y: 8 },
        {
          autoAlpha: 1,
          y: 0,
          duration: 0.4,
          stagger: 0.04,
          ease: "power2.out",
          overwrite: true,
        },
      );
    },
    { scope: root, dependencies: [mode] },
  );

  const approve = async (id: string, override: string) => {
    await fetch(`/api/audit/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ override, reviewerId: "linkedin-demo" }),
    });
    await load();
  };

  return (
    <AppShell>
      <div className="page" ref={root}>
        <h1 className="anim-in">Ledger</h1>
        <p className="lede anim-in">
          Append-only verdicts. Type-aware confidence. Overrides leave a trail.
        </p>

        <div className="stat-row anim-in">
          <div className="stat">
            <span>entries</span>
            <strong>{entries.length}</strong>
          </div>
          <div className="stat">
            <span>ledger cost</span>
            <strong>${totalCost.toFixed(6)}</strong>
          </div>
          <div className="stat">
            <span>filter</span>
            <strong>{mode}</strong>
          </div>
          <div className="stat">
            <span>model</span>
            <strong>pinned</strong>
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

        <ul className="event-list anim-in">
          {entries.length === 0 && (
            <li className="empty">No entries. Run the console demo.</li>
          )}
          {entries.map((row) => (
            <li
              key={row.id}
              className={`event ${
                row.verdict === "block"
                  ? "block"
                  : row.status === "needs_review"
                    ? "review"
                    : "fire"
              }`}
            >
              <div className="event-top">
                <strong>{row.verdict}</strong>
                <span className="chip">{row.status}</span>
                {row.speculative ? <span className="chip ember">spec</span> : null}
                {row.rolled_back ? (
                  <span className="chip danger">rolled back</span>
                ) : null}
                {row.t_saved_ms != null ? (
                  <span className="chip ember">−{row.t_saved_ms}ms</span>
                ) : null}
              </div>
              <p>{row.raw_context}</p>
              <p>
                conf {row.confidence_score.toFixed(2)} ·{" "}
                {row.model_version ?? "—"} ·{" "}
                {row.cost_usd != null ? `$${row.cost_usd.toFixed(6)}` : "—"} ·{" "}
                {row.timestamp}
              </p>
              {row.status === "needs_review" && (
                <div style={{ marginTop: "0.55rem", display: "flex", gap: "0.4rem" }}>
                  <button
                    type="button"
                    className="btn mint small"
                    onClick={() => void approve(row.id, "approved")}
                  >
                    approve
                  </button>
                  <button
                    type="button"
                    className="btn ghost-danger small"
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

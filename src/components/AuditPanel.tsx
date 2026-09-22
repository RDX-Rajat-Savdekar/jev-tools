"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import type { LedgerRow } from "@/lib/jev-audit/ledger";

export function AuditPanel() {
  const [entries, setEntries] = useState<LedgerRow[]>([]);
  const [totalCost, setTotalCost] = useState(0);
  const [mode, setMode] = useState<"all" | "review">("all");
  const [error, setError] = useState<string | null>(null);

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

  const approve = async (id: string, override: string) => {
    await fetch(`/api/audit/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ override, reviewerId: "linkedin-demo" }),
    });
    await load();
  };

  return (
    <div className="console">
      <header className="console-header">
        <div>
          <p className="eyebrow">JevAudit</p>
          <h1>Verification ledger</h1>
          <p className="lede">
            Append-only decisions with type-aware confidence routing and HITL
            overrides.
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
          <span className="metric-label">Entries</span>
          <span className="metric-value">{entries.length}</span>
        </div>
        <div className="metric">
          <span className="metric-label">Ledger cost</span>
          <span className="metric-value">${totalCost.toFixed(6)}</span>
        </div>
        <div className="metric">
          <span className="metric-label">Filter</span>
          <span className="metric-value">{mode}</span>
        </div>
      </section>

      <section className="controls">
        <div className="mode-toggle">
          <button
            type="button"
            className={mode === "all" ? "active" : ""}
            onClick={() => setMode("all")}
          >
            All
          </button>
          <button
            type="button"
            className={mode === "review" ? "active" : ""}
            onClick={() => setMode("review")}
          >
            Needs review
          </button>
        </div>
        <button type="button" onClick={() => void load()}>
          Refresh
        </button>
      </section>

      {error && <p className="error-banner">{error}</p>}

      <ul className="card-list">
        {entries.length === 0 && (
          <li className="empty">No ledger entries yet. Run the console demo.</li>
        )}
        {entries.map((row) => (
          <li key={row.id} className="action-card">
            <div className="action-top">
              <strong>{row.verdict}</strong>
              <span className="badge muted">{row.status}</span>
              {row.speculative ? (
                <span className="badge">speculative</span>
              ) : null}
              {row.rolled_back ? (
                <span className="badge danger">rolled back</span>
              ) : null}
              {row.t_saved_ms != null ? (
                <span className="badge">−{row.t_saved_ms}ms</span>
              ) : null}
            </div>
            <p className="mono">{row.raw_context}</p>
            <p className="meta">
              conf {row.confidence_score.toFixed(2)} · model{" "}
              {row.model_version ?? "—"} ·{" "}
              {row.cost_usd != null ? `$${row.cost_usd.toFixed(6)}` : "—"} ·{" "}
              {row.timestamp}
            </p>
            {row.status === "needs_review" && (
              <div className="controls" style={{ marginTop: "0.75rem" }}>
                <button
                  type="button"
                  className="primary small"
                  onClick={() => void approve(row.id, "approved")}
                >
                  Approve
                </button>
                <button
                  type="button"
                  className="danger small"
                  onClick={() => void approve(row.id, "rejected")}
                >
                  Reject
                </button>
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

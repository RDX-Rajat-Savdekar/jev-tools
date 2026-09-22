"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { BenchReport } from "@/lib/jev-bench/optimize";
import type { Thresholds } from "@/lib/config/thresholds";

export function BenchPanel() {
  const [report, setReport] = useState<BenchReport | null>(null);
  const [defaults, setDefaults] = useState<Thresholds | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void fetch("/api/bench")
      .then(async (r) => {
        const json = await r.json();
        setReport(json.report);
        setDefaults(json.defaults);
      })
      .catch((e) => setError(String(e)));
  }, []);

  return (
    <div className="console">
      <header className="console-header">
        <div>
          <p className="eyebrow">JevBench</p>
          <h1>Prompt calibration</h1>
          <p className="lede">
            Seed cases → prompt perturbation → ECE / Brier → production
            thresholds.
          </p>
        </div>
        <nav className="nav">
          <Link href="/">Console</Link>
          <Link href="/bench">JevBench</Link>
          <Link href="/audit">JevAudit</Link>
        </nav>
      </header>

      {error && <p className="error-banner">{error}</p>}

      {!report ? (
        <section className="transcript-panel">
          <p>
            No bench report yet. Run{" "}
            <code className="mono">npm run bench</code> with{" "}
            <code className="mono">JEV_API_KEY</code> set, then refresh.
          </p>
          {defaults && (
            <p className="meta">
              Using defaults: speculativeFire={defaults.speculativeFire},
              blockNoul={defaults.blockNoul}
            </p>
          )}
        </section>
      ) : (
        <>
          <section className="metrics">
            <div className="metric">
              <span className="metric-label">ECE before</span>
              <span className="metric-value">{report.before.ece.toFixed(3)}</span>
            </div>
            <div className="metric">
              <span className="metric-label">ECE after</span>
              <span className="metric-value accent">
                {report.after.ece.toFixed(3)}
              </span>
            </div>
            <div className="metric">
              <span className="metric-label">Accuracy</span>
              <span className="metric-value">
                {(report.after.accuracy * 100).toFixed(0)}%
              </span>
            </div>
            <div className="metric">
              <span className="metric-label">Sweep cost</span>
              <span className="metric-value">
                ${report.totalCostUsd.toFixed(6)}
              </span>
            </div>
          </section>

          <section className="transcript-panel">
            <div className="transcript-label">Recommended thresholds</div>
            <pre className="mono pre">
              {JSON.stringify(report.recommendedThresholds, null, 2)}
            </pre>
            <div className="transcript-label" style={{ marginTop: "1.5rem" }}>
              Winning intent instructions
            </div>
            <p>{report.bestIntentInstructions}</p>
            <div className="transcript-label" style={{ marginTop: "1.5rem" }}>
              Winning block criteria
            </div>
            <pre className="mono pre">
              {JSON.stringify(report.bestBlockCriteria, null, 2)}
            </pre>
          </section>

          <section>
            <h3>Case results</h3>
            <ul className="card-list">
              {report.cases.map((c) => (
                <li
                  key={c.id}
                  className={`action-card ${c.correctIntent ? "" : "rolled"}`}
                >
                  <div className="action-top">
                    <strong>{c.id}</strong>
                    <span className={`badge ${c.correctIntent ? "" : "danger"}`}>
                      {c.predictedIntent}
                    </span>
                    <span className="badge muted">
                      conf {c.intentConfidence.toFixed(2)}
                    </span>
                    <span className="badge muted">
                      block {c.blockNoul.toFixed(2)}
                    </span>
                  </div>
                  <p className="mono">{c.context}</p>
                </li>
              ))}
            </ul>
          </section>
        </>
      )}
    </div>
  );
}

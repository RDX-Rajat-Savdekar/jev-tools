"use client";

import { useEffect, useRef, useState } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import type { BenchReport } from "@/lib/jev-bench/optimize";
import type { Thresholds } from "@/lib/config/thresholds";
import { AppShell } from "./AppShell";

gsap.registerPlugin(useGSAP);

export function BenchPanel() {
  const [report, setReport] = useState<BenchReport | null>(null);
  const [defaults, setDefaults] = useState<Thresholds | null>(null);
  const [error, setError] = useState<string | null>(null);
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    void fetch("/api/bench")
      .then(async (r) => {
        const json = await r.json();
        setReport(json.report);
        setDefaults(json.defaults);
      })
      .catch((e) => setError(String(e)));
  }, []);

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
          stagger: 0.05,
          ease: "power2.out",
          overwrite: true,
        },
      );
    },
    { scope: root, dependencies: [report] },
  );

  return (
    <AppShell>
      <div className="page" ref={root}>
        <h1 className="anim-in">Calibration</h1>
        <p className="lede anim-in">
          Seed cases in, prompt variants out. ECE and Brier decide the
          threshold — not a guess.
        </p>

        {error && <p className="error-banner">{error}</p>}

        {!report ? (
          <div className="panel-plain anim-in">
            <p style={{ margin: 0, color: "var(--muted)" }}>
              No report yet. Run{" "}
              <code style={{ fontFamily: "var(--font-mono)" }}>npm run bench</code>{" "}
              with a key (or mock), then refresh.
            </p>
            {defaults && (
              <p
                style={{
                  margin: "0.75rem 0 0",
                  fontFamily: "var(--font-mono)",
                  fontSize: "0.75rem",
                  color: "var(--quiet)",
                }}
              >
                defaults: speculativeFire={defaults.speculativeFire} ·
                blockNoul={defaults.blockNoul}
              </p>
            )}
          </div>
        ) : (
          <>
            <div className="stat-row anim-in">
              <div className="stat">
                <span>ece before</span>
                <strong>{report.before.ece.toFixed(3)}</strong>
              </div>
              <div className="stat">
                <span>ece after</span>
                <strong className="mint">{report.after.ece.toFixed(3)}</strong>
              </div>
              <div className="stat">
                <span>accuracy</span>
                <strong>{(report.after.accuracy * 100).toFixed(0)}%</strong>
              </div>
              <div className="stat">
                <span>sweep cost</span>
                <strong>${report.totalCostUsd.toFixed(6)}</strong>
              </div>
            </div>

            <div className="panel-plain anim-in">
              <p className="kicker">recommended thresholds</p>
              <pre>{JSON.stringify(report.recommendedThresholds, null, 2)}</pre>
            </div>

            <div className="panel-plain anim-in">
              <p className="kicker">winning intent instructions</p>
              <p style={{ margin: 0, color: "var(--cream)" }}>
                {report.bestIntentInstructions}
              </p>
            </div>

            <div className="panel-plain anim-in">
              <p className="kicker">winning block criteria</p>
              <pre>{JSON.stringify(report.bestBlockCriteria, null, 2)}</pre>
            </div>

            <div className="anim-in" style={{ marginTop: "1.25rem" }}>
              <p className="kicker">cases</p>
              <ul className="event-list">
                {report.cases.map((c) => (
                  <li
                    key={c.id}
                    className={`event ${c.correctIntent ? "fire" : "block"}`}
                  >
                    <div className="event-top">
                      <strong>{c.id}</strong>
                      <span className={`chip ${c.correctIntent ? "" : "danger"}`}>
                        {c.predictedIntent}
                      </span>
                      <span className="chip">
                        conf {c.intentConfidence.toFixed(2)}
                      </span>
                      <span className="chip">
                        block {c.blockNoul.toFixed(2)}
                      </span>
                    </div>
                    <p>{c.context}</p>
                  </li>
                ))}
              </ul>
            </div>
          </>
        )}
      </div>
    </AppShell>
  );
}

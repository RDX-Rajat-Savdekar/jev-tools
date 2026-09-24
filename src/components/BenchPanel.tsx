"use client";

import { useEffect, useRef, useState } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import type { BenchReport } from "@/lib/jev-bench/optimize";
import type { Thresholds } from "@/lib/config/thresholds";
import { AppShell } from "./AppShell";
import { CalibrationBars } from "./CalibrationBars";
import { StatCounter } from "./StatCounter";
import { ConfidenceRing } from "./ConfidenceRing";

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

      const meters = root.current.querySelectorAll<HTMLElement>(".case-meter > span");
      if (meters.length) {
        gsap.fromTo(
          meters,
          { scaleX: 0 },
          {
            scaleX: 1,
            duration: 0.7,
            stagger: 0.04,
            ease: "power2.out",
            delay: 0.2,
          },
        );
      }
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
                <StatCounter
                  value={report.before.ece}
                  decimals={3}
                  className="stat-num"
                />
              </div>
              <div className="stat">
                <span>ece after</span>
                <StatCounter
                  value={report.after.ece}
                  decimals={3}
                  className="stat-num mint"
                />
              </div>
              <div className="stat">
                <span>accuracy</span>
                <StatCounter
                  value={report.after.accuracy * 100}
                  decimals={0}
                  suffix="%"
                  className="stat-num"
                />
              </div>
              <div className="stat">
                <span>sweep cost</span>
                <StatCounter
                  value={report.totalCostUsd}
                  decimals={6}
                  prefix="$"
                  className="stat-num"
                />
              </div>
            </div>

            <div className="panel-plain anim-in">
              <div
                style={{
                  display: "flex",
                  gap: "1.5rem",
                  alignItems: "center",
                  flexWrap: "wrap",
                }}
              >
                <ConfidenceRing
                  value={report.after.accuracy}
                  label="accuracy"
                  tone="mint"
                />
                <div style={{ flex: 1, minWidth: "220px" }}>
                  <p className="kicker">calibration error</p>
                  <CalibrationBars
                    before={report.before.ece}
                    after={report.after.ece}
                  />
                </div>
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
                    className={`event hero ${c.correctIntent ? "fire" : "block"}`}
                  >
                    <div className="event-top">
                      <strong>{c.id}</strong>
                      <span className={`chip lg ${c.correctIntent ? "ember" : "danger"}`}>
                        {c.predictedIntent}
                      </span>
                    </div>
                    <p className="event-lead">{c.context}</p>
                    <div className="event-stats">
                      <div>
                        <span>confidence</span>
                        <strong>
                          {Math.round(c.intentConfidence * 100)}%
                        </strong>
                      </div>
                      <div>
                        <span>block score</span>
                        <strong>{c.blockNoul.toFixed(2)}</strong>
                      </div>
                    </div>
                    <div className="case-meter">
                      <span
                        style={{ width: `${Math.round(c.intentConfidence * 100)}%` }}
                      />
                    </div>
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

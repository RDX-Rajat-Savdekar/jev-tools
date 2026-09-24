"use client";

import { useEffect, useRef, useState } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";

gsap.registerPlugin(useGSAP);

const TICKS = [
  "intent window open",
  "partial tokens buffered",
  "choice + score + noul",
  "confidence gate",
  "ledger append",
  "threshold check",
];

/** Scrolling activity ticker for audit / idle console energy. */
export function ActivityTicker({ live = false }: { live?: boolean }) {
  const root = useRef<HTMLDivElement>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setTick((t) => (t + 1) % TICKS.length), 2200);
    return () => clearInterval(id);
  }, []);

  useGSAP(
    () => {
      const el = root.current?.querySelector(".ticker-text");
      if (!el) return;
      gsap.fromTo(
        el,
        { y: 8, opacity: 0 },
        { y: 0, opacity: 1, duration: 0.35, ease: "power2.out", overwrite: true },
      );
    },
    { scope: root, dependencies: [tick] },
  );

  return (
    <div className={`activity-ticker ${live ? "live" : ""}`} ref={root}>
      <span className="ticker-pulse" />
      <span className="ticker-text">{TICKS[tick]}</span>
    </div>
  );
}

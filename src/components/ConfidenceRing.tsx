"use client";

import { useRef } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";

gsap.registerPlugin(useGSAP);

type Props = {
  value: number | null; // 0–1
  label?: string;
  tone?: "ember" | "mint" | "info";
};

/** Circular confidence meter used in the demo HUD and action cards. */
export function ConfidenceRing({
  value,
  label = "confidence",
  tone = "ember",
}: Props) {
  const root = useRef<HTMLDivElement>(null);
  const pct = value == null ? 0 : Math.round(value * 100);
  const r = 28;
  const c = 2 * Math.PI * r;

  useGSAP(
    () => {
      const ring = root.current?.querySelector<SVGCircleElement>(".ring-fg");
      if (!ring) return;
      const target = value == null ? c : c * (1 - value);
      gsap.fromTo(
        ring,
        { strokeDashoffset: c },
        {
          strokeDashoffset: target,
          duration: 0.85,
          ease: "power3.out",
          overwrite: true,
        },
      );
    },
    { scope: root, dependencies: [value] },
  );

  return (
    <div className={`confidence-ring tone-${tone}`} ref={root}>
      <svg viewBox="0 0 72 72" width="72" height="72" aria-hidden>
        <circle className="ring-bg" cx="36" cy="36" r={r} />
        <circle
          className="ring-fg"
          cx="36"
          cy="36"
          r={r}
          strokeDasharray={c}
          strokeDashoffset={c}
          transform="rotate(-90 36 36)"
        />
      </svg>
      <div className="ring-label">
        <strong>{value == null ? "—" : `${pct}%`}</strong>
        <span>{label}</span>
      </div>
    </div>
  );
}

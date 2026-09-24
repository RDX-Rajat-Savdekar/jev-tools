"use client";

import { useRef } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";

gsap.registerPlugin(useGSAP);

/** Horizontal ECE before → after bar for the bench page. */
export function CalibrationBars({
  before,
  after,
}: {
  before: number;
  after: number;
}) {
  const root = useRef<HTMLDivElement>(null);
  const max = Math.max(before, after, 0.05);

  useGSAP(
    () => {
      const fills = root.current?.querySelectorAll<HTMLElement>(".cal-fill");
      if (!fills?.length) return;
      gsap.fromTo(
        fills,
        { scaleX: 0 },
        {
          scaleX: 1,
          duration: 0.9,
          stagger: 0.12,
          ease: "power3.out",
          transformOrigin: "left center",
          overwrite: true,
        },
      );
    },
    { scope: root, dependencies: [before, after] },
  );

  return (
    <div className="calibration-bars" ref={root}>
      <div className="cal-row">
        <span>before</span>
        <div className="cal-track">
          <div
            className="cal-fill before"
            style={{ width: `${(before / max) * 100}%` }}
          />
        </div>
        <strong>{before.toFixed(3)}</strong>
      </div>
      <div className="cal-row">
        <span>after</span>
        <div className="cal-track">
          <div
            className="cal-fill after"
            style={{ width: `${(after / max) * 100}%` }}
          />
        </div>
        <strong className="mint">{after.toFixed(3)}</strong>
      </div>
    </div>
  );
}

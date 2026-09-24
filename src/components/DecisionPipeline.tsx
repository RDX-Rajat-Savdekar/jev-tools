"use client";

import { useRef } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";

gsap.registerPlugin(useGSAP);

const STEPS = [
  { id: "hear", label: "hear" },
  { id: "decide", label: "decide" },
  { id: "act", label: "act" },
  { id: "audit", label: "audit" },
];

type Props = {
  active?: boolean;
  phase?: "idle" | "listening" | "fired" | "blocked" | "review";
};

/** Tiny pipeline that lights up through the session. */
export function DecisionPipeline({ active = false, phase = "idle" }: Props) {
  const root = useRef<HTMLDivElement>(null);

  const lit =
    phase === "blocked" || phase === "fired" || phase === "review"
      ? 4
      : active
        ? 2
        : phase === "listening"
          ? 1
          : 0;

  useGSAP(
    () => {
      const steps = root.current?.querySelectorAll<HTMLElement>(".pipe-step");
      const sparks = root.current?.querySelectorAll<HTMLElement>(".pipe-spark");
      if (!steps) return;

      steps.forEach((step, i) => {
        gsap.to(step, {
          opacity: i < lit ? 1 : 0.35,
          duration: 0.35,
          overwrite: true,
        });
      });

      if (active && sparks?.length) {
        gsap.fromTo(
          sparks,
          { x: -8, opacity: 0 },
          {
            x: 8,
            opacity: 1,
            duration: 0.9,
            stagger: 0.15,
            repeat: -1,
            yoyo: true,
            ease: "sine.inOut",
          },
        );
      } else if (sparks?.length) {
        gsap.killTweensOf(sparks);
        gsap.set(sparks, { opacity: 0 });
      }
    },
    { scope: root, dependencies: [active, lit] },
  );

  return (
    <div
      className={`decision-pipeline ${phase !== "idle" ? phase : ""}`}
      ref={root}
      aria-label="Decision pipeline"
    >
      {STEPS.map((s, i) => (
        <div key={s.id} className="pipe-step">
          <span className="pipe-dot" />
          <span className="pipe-label">{s.label}</span>
          {i < STEPS.length - 1 && <span className="pipe-spark" />}
        </div>
      ))}
    </div>
  );
}

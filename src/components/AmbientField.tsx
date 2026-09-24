"use client";

import { useRef } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";

gsap.registerPlugin(useGSAP);

/** Soft drifting field behind every page — calm motion, not noise. */
export function AmbientField() {
  const root = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
      if (mq.matches || !root.current) return;

      const orbs = root.current.querySelectorAll<HTMLElement>(".ambient-orb");
      orbs.forEach((orb, i) => {
        gsap.to(orb, {
          x: i % 2 === 0 ? 40 : -50,
          y: i % 2 === 0 ? -30 : 45,
          duration: 8 + i * 2.5,
          repeat: -1,
          yoyo: true,
          ease: "sine.inOut",
          delay: i * 0.4,
        });
      });

      gsap.to(root.current.querySelector(".ambient-grid"), {
        backgroundPosition: "40px 40px",
        duration: 20,
        repeat: -1,
        ease: "none",
      });
    },
    { scope: root },
  );

  return (
    <div className="ambient" ref={root} aria-hidden>
      <div className="ambient-grid" />
      <div className="ambient-orb orb-a" />
      <div className="ambient-orb orb-b" />
      <div className="ambient-orb orb-c" />
    </div>
  );
}

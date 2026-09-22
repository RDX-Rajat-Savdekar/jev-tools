"use client";

import { useEffect, useRef } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";

gsap.registerPlugin(useGSAP);

const BAR_COUNT = 48;

type WaveformProps = {
  active: boolean;
  mood?: "idle" | "listening" | "fired" | "blocked";
};

export function Waveform({ active, mood = "idle" }: WaveformProps) {
  const root = useRef<HTMLDivElement>(null);
  const tweenRef = useRef<gsap.core.Tween | gsap.core.Timeline | null>(null);

  useGSAP(
    () => {
      const bars = root.current?.querySelectorAll<HTMLElement>(".waveform-bar");
      if (!bars?.length) return;

      tweenRef.current?.kill();

      if (!active || mood === "idle") {
        gsap.to(bars, {
          height: () => `${14 + Math.random() * 22}%`,
          duration: 0.45,
          stagger: { each: 0.01, from: "center" },
          ease: "power2.out",
        });
        return;
      }

      if (mood === "blocked") {
        tweenRef.current = gsap
          .timeline()
          .to(bars, {
            height: () => `${20 + Math.random() * 70}%`,
            duration: 0.12,
            stagger: 0.008,
            ease: "power4.out",
          })
          .to(bars, {
            height: "8%",
            duration: 0.55,
            stagger: { each: 0.01, from: "edges" },
            ease: "power3.inOut",
          });
        return;
      }

      if (mood === "fired") {
        tweenRef.current = gsap
          .timeline()
          .to(bars, {
            height: () => `${40 + Math.random() * 55}%`,
            duration: 0.18,
            stagger: { each: 0.006, from: "center" },
            ease: "power3.out",
          })
          .to(bars, {
            height: () => `${12 + Math.random() * 30}%`,
            duration: 0.5,
            stagger: 0.01,
            ease: "sine.inOut",
          });
        return;
      }

      // listening — continuous pulse
      gsap.set(bars, {
        height: () => `${10 + Math.random() * 25}%`,
      });
      tweenRef.current = gsap.to(bars, {
        height: () => `${18 + Math.random() * 72}%`,
        duration: 0.38,
        repeat: -1,
        yoyo: true,
        ease: "sine.inOut",
        stagger: {
          each: 0.02,
          from: "center",
          repeat: -1,
          yoyo: true,
        },
      });
    },
    { scope: root, dependencies: [active, mood] },
  );

  useEffect(() => {
    return () => {
      tweenRef.current?.kill();
    };
  }, []);

  return (
    <div
      ref={root}
      className={`waveform ${mood !== "idle" ? mood : ""} ${active ? "listening" : ""}`}
      aria-hidden
    >
      {Array.from({ length: BAR_COUNT }, (_, i) => (
        <span key={i} className="waveform-bar" />
      ))}
    </div>
  );
}

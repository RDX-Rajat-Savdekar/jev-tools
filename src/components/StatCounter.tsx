"use client";

import { useEffect, useRef } from "react";
import gsap from "gsap";

type Props = {
  value: number;
  decimals?: number;
  prefix?: string;
  suffix?: string;
  className?: string;
  duration?: number;
};

/** Animates a number into place when the value changes. */
export function StatCounter({
  value,
  decimals = 0,
  prefix = "",
  suffix = "",
  className,
  duration = 0.7,
}: Props) {
  const ref = useRef<HTMLSpanElement>(null);
  const prev = useRef(0);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (mq.matches) {
      el.textContent = `${prefix}${value.toFixed(decimals)}${suffix}`;
      prev.current = value;
      return;
    }

    const obj = { v: prev.current };
    const tween = gsap.to(obj, {
      v: value,
      duration,
      ease: "power2.out",
      onUpdate: () => {
        el.textContent = `${prefix}${obj.v.toFixed(decimals)}${suffix}`;
      },
      onComplete: () => {
        prev.current = value;
      },
    });

    return () => {
      tween.kill();
    };
  }, [value, decimals, prefix, suffix, duration]);

  return (
    <span ref={ref} className={className}>
      {prefix}
      {value.toFixed(decimals)}
      {suffix}
    </span>
  );
}

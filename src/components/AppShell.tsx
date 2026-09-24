"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AmbientField } from "./AmbientField";
import { ActivityTicker } from "./ActivityTicker";

const LINKS = [
  { href: "/", label: "console" },
  { href: "/bench", label: "bench" },
  { href: "/audit", label: "audit" },
];

export function AppShell({
  children,
  live = false,
  meta,
}: {
  children: React.ReactNode;
  live?: boolean;
  meta?: React.ReactNode;
}) {
  const pathname = usePathname();
  const [clock, setClock] = useState("--:--:--");

  useEffect(() => {
    const tick = () => {
      setClock(
        new Date().toLocaleTimeString("en-GB", {
          hour12: false,
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        }),
      );
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="shell">
      <AmbientField />
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark">jev</span>
          <span className="brand-sub">command console</span>
        </div>
        <nav className="nav">
          {LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className={pathname === l.href ? "active" : undefined}
            >
              {l.label}
            </Link>
          ))}
        </nav>
        <div className="topbar-meta">
          <ActivityTicker live={live} />
          <span>
            <i className={`dot-live ${live ? "on" : ""}`} />{" "}
            {live ? "live" : "idle"}
          </span>
          <span className="clock-chip">{clock}</span>
          {meta}
        </div>
      </header>
      {children}
    </div>
  );
}

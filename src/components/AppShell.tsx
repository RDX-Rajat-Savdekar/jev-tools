"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

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

  return (
    <div className="shell">
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
          <span>
            <i className={`dot-live ${live ? "on" : ""}`} />{" "}
            {live ? "live" : "idle"}
          </span>
          {meta}
        </div>
      </header>
      {children}
    </div>
  );
}

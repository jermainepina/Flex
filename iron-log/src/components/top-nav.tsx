"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { LogSheet } from "@/components/log-sheet";

const TABS: { href: string; label: string; also?: string }[] = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/log", label: "Log" },
  // Progress = merged History + Stats section (both routes highlight it).
  { href: "/history", label: "Progress", also: "/trends" },
  { href: "/goals", label: "Goals" },
  { href: "/templates", label: "Templates" },
];

/** Desktop pill nav (hidden on mobile where the bottom tab bar takes over). */
export function TopNav() {
  const pathname = usePathname();
  const [logOpen, setLogOpen] = useState(false);

  return (
    <nav
      aria-label="Sections"
      className="hidden items-center gap-1 rounded-full bg-zinc-100 p-1 sm:flex dark:bg-zinc-900"
    >
      {TABS.map((tab) => {
        const active =
          tab.href === "/dashboard"
            ? pathname === "/dashboard"
            : pathname.startsWith(tab.href) ||
              (tab.also !== undefined && pathname.startsWith(tab.also));
        const pillClass = `rounded-full px-3.5 py-1.5 text-sm font-semibold transition-colors ${
          active
            ? ""
            : "text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
        }`;
        const pillStyle = active
          ? { background: "var(--accent)", color: "var(--accent-ink)" }
          : undefined;

        if (tab.href === "/log") {
          // Log opens the what-to-log sheet instead of navigating.
          return (
            <button
              key={tab.href}
              type="button"
              onClick={() => setLogOpen(true)}
              aria-haspopup="dialog"
              aria-expanded={logOpen}
              className={pillClass}
              style={pillStyle}
            >
              {tab.label}
            </button>
          );
        }

        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={active ? "page" : undefined}
            className={pillClass}
            style={pillStyle}
          >
            {tab.label}
          </Link>
        );
      })}
      {logOpen && <LogSheet onClose={() => setLogOpen(false)} />}
    </nav>
  );
}

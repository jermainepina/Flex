"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/log", label: "Log" },
  { href: "/history", label: "History" },
  { href: "/templates", label: "Templates" },
  { href: "/trends", label: "Stats" },
];

/** Desktop pill nav (hidden on mobile where the bottom tab bar takes over). */
export function TopNav() {
  const pathname = usePathname();
  return (
    <nav
      aria-label="Sections"
      className="hidden items-center gap-1 rounded-full bg-zinc-100 p-1 sm:flex dark:bg-zinc-900"
    >
      {TABS.map((tab) => {
        const active =
          tab.href === "/dashboard"
            ? pathname === "/dashboard"
            : pathname.startsWith(tab.href);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={active ? "page" : undefined}
            className={`rounded-full px-3.5 py-1.5 text-sm font-semibold transition-colors ${
              active
                ? ""
                : "text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
            }`}
            style={
              active
                ? { background: "var(--accent)", color: "var(--accent-ink)" }
                : undefined
            }
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}

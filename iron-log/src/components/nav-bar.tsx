"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  ChartLine,
  ClipboardList,
  House,
  Plus,
  Target,
} from "lucide-react";
import { LogSheet } from "@/components/log-sheet";

const TABS = [
  { href: "/dashboard", label: "Home", Icon: House },
  // Progress = merged History + Stats section (both routes highlight it).
  { href: "/history", label: "Progress", Icon: ChartLine, also: "/trends" },
  { href: "/log", label: "Log", Icon: Plus },
  { href: "/goals", label: "Goals", Icon: Target },
  { href: "/templates", label: "Templates", Icon: ClipboardList },
];

/** Mobile bottom tab bar (hidden on sm+ where the pill nav shows). */
export function NavBar() {
  const pathname = usePathname();
  const [logOpen, setLogOpen] = useState(false);

  return (
    <nav
      aria-label="Primary"
      className="fixed inset-x-0 bottom-0 z-20 border-t border-zinc-200 bg-white pb-[env(safe-area-inset-bottom)] sm:hidden dark:border-zinc-800 dark:bg-zinc-950"
    >
      <div className="grid h-16 grid-cols-5">
        {TABS.map(({ href, label, Icon, also }) => {
          const active =
            href === "/dashboard"
              ? pathname === "/dashboard"
              : pathname.startsWith(href) ||
                (also !== undefined && pathname.startsWith(also));
          const isLog = href === "/log";

          if (isLog) {
            // Log opens the what-to-log sheet instead of navigating.
            return (
              <button
                key={href}
                type="button"
                onClick={() => setLogOpen(true)}
                aria-haspopup="dialog"
                aria-expanded={logOpen}
                className="flex flex-col items-center justify-center gap-1 text-[11px] font-medium"
              >
                <span
                  aria-hidden
                  className="flex h-9 w-9 items-center justify-center rounded-full"
                  style={{ background: "var(--accent)", color: "var(--accent-ink)" }}
                >
                  <Icon size={20} strokeWidth={2.5} />
                </span>
                <span>{label}</span>
              </button>
            );
          }

          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className="flex flex-col items-center justify-center gap-1 text-[11px] font-medium"
              style={{ color: active ? "var(--accent-text)" : undefined }}
            >
              <Icon
                aria-hidden
                size={20}
                className={active ? "" : "text-zinc-500 dark:text-zinc-400"}
              />
              <span className={active ? "" : "text-zinc-500 dark:text-zinc-400"}>
                {label}
              </span>
            </Link>
          );
        })}
      </div>
      {logOpen && <LogSheet onClose={() => setLogOpen(false)} />}
    </nav>
  );
}

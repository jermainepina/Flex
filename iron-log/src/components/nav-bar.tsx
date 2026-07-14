"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ChartLine,
  ClipboardList,
  House,
  Plus,
  Target,
} from "lucide-react";

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
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className="flex flex-col items-center justify-center gap-1 text-[11px] font-medium"
              style={{
                color: active && !isLog ? "var(--accent-text)" : undefined,
              }}
            >
              {isLog ? (
                <span
                  aria-hidden
                  className="flex h-9 w-9 items-center justify-center rounded-full"
                  style={{ background: "var(--accent)", color: "var(--accent-ink)" }}
                >
                  <Icon size={20} strokeWidth={2.5} />
                </span>
              ) : (
                <Icon
                  aria-hidden
                  size={20}
                  className={active ? "" : "text-zinc-500 dark:text-zinc-400"}
                />
              )}
              <span className={active || isLog ? "" : "text-zinc-500 dark:text-zinc-400"}>
                {label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

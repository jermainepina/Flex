"use client";

import Link from "next/link";
import { useState } from "react";
import { Settings, User } from "lucide-react";

/**
 * Header avatar flyout: tap the initials chip to reveal Profile / Settings
 * (small scale+fade from the top-right). Backdrop tap or Escape closes.
 */
export function ProfileMenu({ initials, title }: { initials: string; title: string }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="Profile and settings"
        aria-expanded={open}
        title={title}
        className="flex h-9 w-9 items-center justify-center rounded-full text-sm font-bold transition-transform active:scale-95"
        style={{ background: "var(--accent)", color: "var(--accent-ink)" }}
      >
        {initials}
      </button>

      {open && (
        <>
          <button
            type="button"
            aria-label="Close menu"
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-20 cursor-default"
            onKeyDown={(e) => {
              if (e.key === "Escape") setOpen(false);
            }}
          />
          <div
            role="menu"
            className="absolute right-0 z-30 mt-2 w-44 origin-top-right overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-lg motion-safe:animate-[menu-pop_0.15s_ease-out_both] dark:border-zinc-800 dark:bg-zinc-950"
          >
            <Link
              href="/profile"
              role="menuitem"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2.5 px-4 py-3 text-sm font-medium hover:bg-zinc-100 dark:hover:bg-zinc-800"
            >
              <User size={16} aria-hidden style={{ color: "var(--accent-text)" }} />
              Profile
            </Link>
            <Link
              href="/settings"
              role="menuitem"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2.5 border-t border-zinc-100 px-4 py-3 text-sm font-medium hover:bg-zinc-100 dark:border-zinc-900 dark:hover:bg-zinc-800"
            >
              <Settings size={16} aria-hidden style={{ color: "var(--accent-text)" }} />
              Settings
            </Link>
          </div>
        </>
      )}
    </div>
  );
}

import type { ReactNode } from "react";

/**
 * Flexx page header: mono kicker, two-tone display title (titleA foreground,
 * titleB accent), optional right-side action.
 */
export function PageHeader({
  kicker,
  titleA,
  titleB,
  action,
}: {
  kicker: string;
  titleA: string;
  titleB: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div>
        <p className="label-mono">{kicker}</p>
        <h1 className="font-display mt-1 text-3xl uppercase leading-[1.05] tracking-tight sm:text-4xl">
          {titleA}
          <br />
          <span style={{ color: "var(--accent-text)" }}>{titleB}</span>
        </h1>
      </div>
      {action}
    </div>
  );
}

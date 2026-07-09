"use client";

import { useRouter } from "next/navigation";

export function TemplatePicker({
  templates,
  selectedId,
}: {
  templates: { id: string; name: string }[];
  selectedId: string | null;
}) {
  const router = useRouter();
  return (
    <label className="flex items-center gap-2 text-sm font-medium">
      Start from template
      <select
        value={selectedId ?? ""}
        onChange={(e) =>
          router.push(e.target.value ? `/log?template=${e.target.value}` : "/log")
        }
        className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-base font-normal outline-none focus:border-(--accent) sm:text-sm dark:border-zinc-700 dark:bg-zinc-950"
      >
        <option value="">None (blank workout)</option>
        {templates.map((t) => (
          <option key={t.id} value={t.id}>
            {t.name}
          </option>
        ))}
      </select>
    </label>
  );
}

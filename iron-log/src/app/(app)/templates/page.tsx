import Link from "next/link";
import { DeleteTemplateButton } from "@/components/delete-template-button";
import { createClient } from "@/lib/supabase/server";

type TemplateRow = {
  id: string;
  name: string;
  template_exercises: {
    position: number;
    target_sets: number;
    exercises: { name: string } | null;
  }[];
};

export default async function TemplatesPage() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("templates")
    .select("id, name, template_exercises(position, target_sets, exercises(name))")
    .order("created_at", { ascending: false });
  const templates = (data ?? []) as unknown as TemplateRow[];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Templates</h1>
        <Link
          href="/templates/new"
          className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
        >
          New template
        </Link>
      </div>

      {templates.length === 0 ? (
        <p className="rounded-lg border border-dashed border-zinc-300 p-6 text-sm text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">
          No templates yet. Build one to start workouts with your usual
          exercises pre-filled.
        </p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {templates.map((t) => {
            const exercises = [...t.template_exercises].sort(
              (a, b) => a.position - b.position,
            );
            return (
              <div
                key={t.id}
                className="flex flex-col gap-3 rounded-xl border border-zinc-200 p-4 dark:border-zinc-800"
              >
                <div>
                  <p className="font-medium">{t.name}</p>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">
                    {exercises.length} exercise{exercises.length === 1 ? "" : "s"}
                  </p>
                </div>
                <ul className="flex-1 text-sm text-zinc-600 dark:text-zinc-300">
                  {exercises.map((e, i) => (
                    <li key={i} className="flex justify-between gap-2">
                      <span className="truncate">
                        {e.exercises?.name ?? "Unknown"}
                      </span>
                      <span className="shrink-0 text-zinc-400 dark:text-zinc-500">
                        {e.target_sets} × set{e.target_sets === 1 ? "" : "s"}
                      </span>
                    </li>
                  ))}
                </ul>
                <div className="flex items-center gap-2">
                  <Link
                    href={`/log?template=${t.id}`}
                    className="rounded-md bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
                  >
                    Start workout
                  </Link>
                  <Link
                    href={`/templates/${t.id}`}
                    className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm font-medium hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
                  >
                    Edit
                  </Link>
                  <span className="ml-auto">
                    <DeleteTemplateButton templateId={t.id} />
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

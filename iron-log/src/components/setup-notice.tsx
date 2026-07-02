export function SetupNotice() {
  return (
    <main className="flex flex-1 items-center justify-center p-6">
      <div className="w-full max-w-lg rounded-xl border border-amber-300 bg-amber-50 p-8 text-sm dark:border-amber-700 dark:bg-amber-950">
        <h1 className="text-lg font-semibold">Connect Supabase to get started</h1>
        <ol className="mt-4 list-decimal space-y-2 pl-5">
          <li>
            Create a free project at{" "}
            <span className="font-mono">supabase.com</span>.
          </li>
          <li>
            Run <span className="font-mono">supabase/migrations/0001_init.sql</span>{" "}
            in the Supabase SQL editor.
          </li>
          <li>
            Copy the project URL and anon key from Project Settings → API into{" "}
            <span className="font-mono">.env.local</span>.
          </li>
          <li>Restart the dev server.</li>
        </ol>
        <p className="mt-4 text-zinc-600 dark:text-zinc-400">
          Full steps are in the README.
        </p>
      </div>
    </main>
  );
}

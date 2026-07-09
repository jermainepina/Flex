import { signOut } from "@/app/(auth)/actions";
import { SettingsForm } from "@/components/settings-form";
import { createClient } from "@/lib/supabase/server";
import { type Theme } from "@/lib/types";
import { type WeightUnit } from "@/lib/units";

export default async function SettingsPage() {
  const supabase = await createClient();
  const [{ data: profile }, { data: userData }] = await Promise.all([
    supabase
      .from("profiles")
      .select("display_name, theme, preferred_unit")
      .maybeSingle(),
    supabase.auth.getUser(),
  ]);

  const theme: Theme =
    profile?.theme === "light" || profile?.theme === "dim"
      ? profile.theme
      : "dark";
  const unit: WeightUnit = profile?.preferred_unit === "kg" ? "kg" : "lb";

  return (
    <div className="flex flex-col gap-8">
      <div>
        <p className="label-mono">{userData.user?.email}</p>
        <h1 className="font-display mt-1 text-3xl uppercase leading-[1.05] tracking-tight sm:text-4xl">
          Your
          <br />
          <span style={{ color: "var(--accent-text)" }}>Settings</span>
        </h1>
      </div>

      <SettingsForm
        initialName={profile?.display_name ?? ""}
        initialTheme={theme}
        initialUnit={unit}
      />

      <div className="border-t border-zinc-200 pt-6 dark:border-zinc-800">
        <form action={signOut}>
          <button
            type="submit"
            className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
          >
            Sign out
          </button>
        </form>
      </div>
    </div>
  );
}

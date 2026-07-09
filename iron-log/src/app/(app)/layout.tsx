import Link from "next/link";
import { redirect } from "next/navigation";
import { Dumbbell } from "lucide-react";
import { NavBar } from "@/components/nav-bar";
import { SetupNotice } from "@/components/setup-notice";
import { TopNav } from "@/components/top-nav";
import { createClient } from "@/lib/supabase/server";
import { hasEnvVars } from "@/lib/utils";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  if (!hasEnvVars) return <SetupNotice />;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");
  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name")
    .maybeSingle();

  const initials = (profile?.display_name || user.email || "?")
    .trim()
    .split(/\s+/)
    .map((part: string) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <>
      <header className="border-b border-zinc-200 dark:border-zinc-800">
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <Link href="/dashboard" className="flex items-center gap-2">
            <span
              aria-hidden
              className="flex h-8 w-8 items-center justify-center rounded-lg"
              style={{ background: "var(--accent)", color: "var(--accent-ink)" }}
            >
              <Dumbbell size={18} strokeWidth={2.5} />
            </span>
            <span className="font-display text-lg uppercase tracking-tight">
              Flexx
            </span>
          </Link>
          <TopNav />
          <Link
            href="/settings"
            aria-label="Settings"
            title={profile?.display_name || user.email || "Settings"}
            className="flex h-9 w-9 items-center justify-center rounded-full text-sm font-bold"
            style={{ background: "var(--accent)", color: "var(--accent-ink)" }}
          >
            {initials}
          </Link>
        </div>
      </header>
      <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-6 pb-[calc(5.5rem+env(safe-area-inset-bottom))] sm:px-6 sm:py-8 sm:pb-8">
        {children}
      </main>
      <NavBar />
    </>
  );
}

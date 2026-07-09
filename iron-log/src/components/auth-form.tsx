"use client";

import Link from "next/link";
import { useActionState } from "react";
import { signIn, signUp, type AuthState } from "@/app/(auth)/actions";

const initialState: AuthState = {};

export function AuthForm({
  mode,
  initialMessage,
}: {
  mode: "sign-in" | "sign-up";
  initialMessage?: string;
}) {
  const isSignIn = mode === "sign-in";
  const [state, formAction, pending] = useActionState(
    isSignIn ? signIn : signUp,
    initialState,
  );

  const message = state.message ?? initialMessage;

  return (
    <main className="flex flex-1 items-center justify-center p-6">
      <div className="card w-full max-w-sm p-8 shadow-sm">
        <p className="label-mono">
          {isSignIn ? "Welcome back" : "Get started"}
        </p>
        <h1 className="font-display mt-1 text-3xl uppercase tracking-tight">
          Fle<span style={{ color: "var(--accent-text)" }}>xx</span>
        </h1>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          {isSignIn ? "Sign in to your account" : "Create an account"}
        </p>

        <form action={formAction} className="mt-6 flex flex-col gap-4">
          {!isSignIn && (
            <label className="flex flex-col gap-1 text-sm font-medium">
              Name{" "}
              <span className="font-normal text-zinc-500 dark:text-zinc-400">
                (optional)
              </span>
              <input
                type="text"
                name="name"
                maxLength={50}
                autoComplete="name"
                className="rounded-md border border-zinc-300 bg-transparent px-3 py-2 text-base outline-none focus:border-(--accent) sm:text-sm dark:border-zinc-700"
              />
            </label>
          )}
          <label className="flex flex-col gap-1 text-sm font-medium">
            Email
            <input
              type="email"
              name="email"
              required
              autoComplete="email"
              className="rounded-md border border-zinc-300 bg-transparent px-3 py-2 text-base outline-none focus:border-(--accent) sm:text-sm dark:border-zinc-700"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium">
            Password
            <input
              type="password"
              name="password"
              required
              minLength={6}
              autoComplete={isSignIn ? "current-password" : "new-password"}
              className="rounded-md border border-zinc-300 bg-transparent px-3 py-2 text-base outline-none focus:border-(--accent) sm:text-sm dark:border-zinc-700"
            />
          </label>

          {state.error && (
            <p className="text-sm text-red-600 dark:text-red-400">{state.error}</p>
          )}
          {message && (
            <p className="text-sm text-emerald-600 dark:text-emerald-400">
              {message}
            </p>
          )}

          <button
            type="submit"
            disabled={pending}
            className="btn-accent mt-2 px-3 py-2.5 text-sm"
          >
            {pending ? "Please wait…" : isSignIn ? "Sign in" : "Sign up"}
          </button>
        </form>

        <p className="mt-6 text-sm text-zinc-500 dark:text-zinc-400">
          {isSignIn ? (
            <>
              No account?{" "}
              <Link href="/sign-up" className="font-medium underline">
                Sign up
              </Link>
            </>
          ) : (
            <>
              Already have an account?{" "}
              <Link href="/sign-in" className="font-medium underline">
                Sign in
              </Link>
            </>
          )}
        </p>
      </div>
    </main>
  );
}

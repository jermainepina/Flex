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
      <div className="w-full max-w-sm rounded-xl border border-zinc-200 bg-white p-8 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <h1 className="text-xl font-semibold tracking-tight">Iron Log</h1>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          {isSignIn ? "Sign in to your account" : "Create an account"}
        </p>

        <form action={formAction} className="mt-6 flex flex-col gap-4">
          <label className="flex flex-col gap-1 text-sm font-medium">
            Email
            <input
              type="email"
              name="email"
              required
              autoComplete="email"
              className="rounded-md border border-zinc-300 bg-transparent px-3 py-2 text-sm outline-none focus:border-zinc-500 dark:border-zinc-700"
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
              className="rounded-md border border-zinc-300 bg-transparent px-3 py-2 text-sm outline-none focus:border-zinc-500 dark:border-zinc-700"
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
            className="mt-2 rounded-md bg-zinc-900 px-3 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
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

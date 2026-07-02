// True once .env.local has real Supabase credentials. Used to short-circuit
// auth checks with a friendly setup notice instead of a fetch error.
export const hasEnvVars = Boolean(
  process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
);

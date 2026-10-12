import { createClient, SupabaseClient } from "@supabase/supabase-js";
export const PROJECT_REF = "wnexrlghlmotkysrofkl";
export const PROJECT_URL = `https://${PROJECT_REF}.supabase.co`;
// Production always requires authentication, even when env vars are missing.
export function localDevelopmentEnabled() {
  return (
    process.env.NODE_ENV === "development" &&
    process.env.NEXT_PUBLIC_CALLFLOW_STORAGE_MODE === "local"
  );
}
export function cloudConfigured() {
  return (
    process.env.NEXT_PUBLIC_SUPABASE_URL === PROJECT_URL &&
    !!process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  );
}
let browserClient: SupabaseClient | undefined;
export function supabaseClient() {
  if (process.env.NEXT_PUBLIC_SUPABASE_URL !== PROJECT_URL)
    throw new Error("CALLFLOW är konfigurerat för fel Supabase-projekt.");
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!key) throw new Error("Supabases publika nyckel saknas.");
  return (browserClient ??= createClient(PROJECT_URL, key, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  }));
}

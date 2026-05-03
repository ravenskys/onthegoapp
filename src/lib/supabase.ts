import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ?? "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() ?? "";

const hasPlaceholderUrl = supabaseUrl === "https://placeholder.supabase.co";
const hasPlaceholderAnonKey = supabaseAnonKey === "placeholder-anon-key";
const isSupabaseConfigured =
  Boolean(supabaseUrl) &&
  Boolean(supabaseAnonKey) &&
  !hasPlaceholderUrl &&
  !hasPlaceholderAnonKey;

export const supabaseConfigError = isSupabaseConfigured
  ? null
  : "Supabase is not configured for this environment. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to your local or Vercel environment variables, then redeploy.";

if (supabaseConfigError && typeof window !== "undefined") {
  console.error(supabaseConfigError);
}

export const supabase = createClient(
  isSupabaseConfigured ? supabaseUrl : "https://placeholder.supabase.co",
  isSupabaseConfigured ? supabaseAnonKey : "placeholder-anon-key"
);

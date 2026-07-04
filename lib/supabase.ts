import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

let _client: SupabaseClient | null = null;

export function createClient() {
  if (_client) return _client;
  _client = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
  return _client;
}

// Resilient client-side auth check.
//
// `auth.getUser()` validates the token against the Supabase Auth server on
// every call. A transient network failure or a token-refresh race makes it
// return `user: null` even though a valid session exists locally — pages that
// gate on it then bounce the user back to /login mid-navigation ("doesn't
// hold session"). Use the locally cached session first and only fall back to
// the network check when no local session exists. The middleware still runs
// an authoritative server-side `getUser()` on every request.
export async function getAuthUser() {
  const supabase = createClient();
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user) return session.user;
  } catch { /* fall through to network check */ }
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

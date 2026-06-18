import { createServerClient } from "@supabase/ssr";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { hasAdminAccess } from "@/lib/roles";
import type { Role } from "@/lib/roles";

// Routes that don't require authentication
const PUBLIC_PATHS = new Set(["/login", "/forgot-password", "/register"]);
// Auth routes that may be accessed with or without a session
const AUTH_PATHS = ["/auth/callback", "/auth/reset-password", "/auth/set-password"];

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // Always call getUser() to refresh the session token.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;

  // Auth flow routes — always accessible
  if (AUTH_PATHS.some((p) => pathname.startsWith(p))) {
    return supabaseResponse;
  }

  // ── Unauthenticated ───────────────────────────────────────────────────────
  if (!user) {
    if (pathname.startsWith("/member") || pathname.startsWith("/admin")) {
      const loginUrl = request.nextUrl.clone();
      loginUrl.pathname = "/login";
      return NextResponse.redirect(loginUrl);
    }
    return supabaseResponse;
  }

  // ── Authenticated ─────────────────────────────────────────────────────────

  // Intercept if user needs to set a password first
  if (
    user.user_metadata?.needs_password_setup &&
    !PUBLIC_PATHS.has(pathname) &&
    !pathname.startsWith("/auth/")
  ) {
    const setupUrl = request.nextUrl.clone();
    setupUrl.pathname = "/auth/set-password";
    return NextResponse.redirect(setupUrl);
  }

  // Redirect away from login/forgot-password if already signed in
  if (PUBLIC_PATHS.has(pathname)) {
    const roles = await fetchRoles(supabase, user.id);
    const dest = hasAdminAccess(roles) ? "/admin/dashboard" : "/member/home";
    const destUrl = request.nextUrl.clone();
    destUrl.pathname = dest;
    return NextResponse.redirect(destUrl);
  }

  // Guard admin routes — non-admins go to member home
  if (pathname.startsWith("/admin")) {
    const roles = await fetchRoles(supabase, user.id);
    if (!hasAdminAccess(roles)) {
      const memberUrl = request.nextUrl.clone();
      memberUrl.pathname = "/member/home";
      return NextResponse.redirect(memberUrl);
    }
  }

  return supabaseResponse;
}

async function fetchRoles(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  userId: string,
): Promise<Role[]> {
  const { data } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId);

  return (data ?? []).map((r: { role: Role }) => r.role) as Role[];
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};

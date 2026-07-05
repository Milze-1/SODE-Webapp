import { createServerClient } from "@supabase/ssr";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { hasAdminAccess } from "@/lib/roles";
import type { Role } from "@/lib/roles";
import { rateLimit, clientIp } from "@/lib/rate-limit";

// Routes that don't require authentication
const PUBLIC_PATHS = new Set(["/login", "/forgot-password", "/register", "/internal/admin-login"]);
// Auth routes that may be accessed with or without a session
const AUTH_PATHS = ["/auth/callback", "/auth/reset-password", "/auth/set-password"];

// ── Rate limits (per IP, sliding window) ─────────────────────────────────────
// Best-effort in-memory protection against scripted/AI abuse. Pair with
// Cloudflare + Supabase rate limits for hard guarantees (direct Supabase REST
// calls bypass this middleware entirely).
const API_LIMIT = { limit: 120, windowMs: 60_000 };   // API routes
const AUTH_LIMIT = { limit: 20, windowMs: 60_000 };   // login / register / password pages
const PAGE_LIMIT = { limit: 300, windowMs: 60_000 };  // everything else

// Admin idle timeout — enforced server-side via a last-activity cookie so a
// stale/frozen tab can never re-enter the admin area after the gap.
const ADMIN_IDLE_MS = 30 * 60 * 1000;
const ADMIN_IDLE_COOKIE = "sode-admin-la";

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // ── Rate limiting ──────────────────────────────────────────────────────────
  const ip = clientIp(request);
  const isApi = pathname.startsWith("/api");
  const isAuthSensitive =
    PUBLIC_PATHS.has(pathname) || pathname.startsWith("/auth/") || pathname === "/register";
  const { limit, windowMs } = isApi ? API_LIMIT : isAuthSensitive ? AUTH_LIMIT : PAGE_LIMIT;
  const scope = isApi ? "api" : isAuthSensitive ? "auth" : "page";
  const rl = rateLimit(`${scope}:${ip}`, limit, windowMs);

  if (!rl.ok) {
    return new NextResponse(
      isApi ? JSON.stringify({ error: "Too many requests. Slow down." }) : "Too many requests. Slow down.",
      {
        status: 429,
        headers: {
          "Content-Type": isApi ? "application/json" : "text/plain",
          "Retry-After": String(rl.retryAfterSeconds),
        },
      },
    );
  }

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

  // Auth flow routes — always accessible
  if (AUTH_PATHS.some((p) => pathname.startsWith(p))) {
    return supabaseResponse;
  }

  // ── Unauthenticated ───────────────────────────────────────────────────────
  if (!user) {
    if (pathname.startsWith("/admin")) {
      const loginUrl = request.nextUrl.clone();
      loginUrl.pathname = "/internal/admin-login";
      return NextResponse.redirect(loginUrl);
    }
    if (pathname.startsWith("/member")) {
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

  // Redirect away from member login/forgot-password if already signed in.
  // The admin login page stays accessible while signed in so an admin can
  // complete the 2FA challenge / enrollment step.
  if (PUBLIC_PATHS.has(pathname) && pathname !== "/internal/admin-login") {
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

    // Step-up enforcement: EVERY admin session must be at AAL2 (2FA-verified).
    // This also catches sessions created outside the admin login flow (e.g.
    // Google OAuth or the member login) — they get sent to the admin login,
    // which challenges an enrolled factor or forces enrollment.
    // NOTE: requires TOTP MFA to be enabled on the Supabase project
    // (Authentication → Multi-Factor); if it's disabled, admins will loop on
    // the admin login page until it's re-enabled.
    try {
      const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
      if (aal && aal.currentLevel !== "aal2") {
        const mfaUrl = request.nextUrl.clone();
        mfaUrl.pathname = "/internal/admin-login";
        mfaUrl.search = "?error=mfa_required";
        return NextResponse.redirect(mfaUrl);
      }
    } catch {
      // Could not determine assurance level — fail open rather than lock
      // every admin out.
    }

    // Idle timeout: if the last admin request was more than 30 minutes ago,
    // force a fresh sign-in. The admin login page clears the Supabase session
    // when it receives ?error=session_timeout.
    const lastActiveRaw = request.cookies.get(ADMIN_IDLE_COOKIE)?.value;
    const lastActive = Number(lastActiveRaw);
    if (lastActiveRaw && Number.isFinite(lastActive) && Date.now() - lastActive > ADMIN_IDLE_MS) {
      const timeoutUrl = request.nextUrl.clone();
      timeoutUrl.pathname = "/internal/admin-login";
      timeoutUrl.search = "?error=session_timeout";
      const timeoutRes = NextResponse.redirect(timeoutUrl);
      timeoutRes.cookies.set(ADMIN_IDLE_COOKIE, "", { path: "/", maxAge: 0 });
      return timeoutRes;
    }
    supabaseResponse.cookies.set(ADMIN_IDLE_COOKIE, String(Date.now()), {
      path: "/",
      maxAge: 60 * 60 * 12,
      httpOnly: true,
      sameSite: "lax",
    });
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

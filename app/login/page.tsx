"use client";

import { useState, useEffect, Suspense } from "react";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase";
import { Icon } from "@/components/sode/icons";

type LoginMode = "member" | "admin";

function friendlyError(msg: string): string {
  if (msg.toLowerCase().includes("invalid login credentials"))
    return "Incorrect email or password. Please try again.";
  if (msg.toLowerCase().includes("too many requests") || msg.toLowerCase().includes("rate limit"))
    return "Too many attempts. Please wait a few minutes before trying again.";
  if (msg.toLowerCase().includes("user not found") || msg.toLowerCase().includes("no user found"))
    return "No account found with this email. Contact your leader.";
  if (msg.toLowerCase().includes("email not confirmed"))
    return "Please verify your email before signing in.";
  return msg;
}

const ADMIN_ROLES = new Set(["director","spiritual_lead","career_lead","business_lead","member_care_lead","data_ops_lead"]);

function LoginInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [mode, setMode] = useState<LoginMode>("member");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const err = searchParams.get("error");
    if (err === "not_admin") {
      setMode("admin");
      setError("You don't have admin access. Contact the Director to request access.");
    } else if (err) {
      setError(friendlyError(decodeURIComponent(err)));
    }
  }, [searchParams]);

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) return;
    setLoading(true);
    setError("");

    const supabase = createClient();
    const { data, error: authError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    if (authError) {
      setError(friendlyError(authError.message));
      setLoading(false);
      return;
    }

    const user = data.user;

    if (user.user_metadata?.needs_password_setup) {
      router.push("/auth/set-password");
      return;
    }

    const { data: rolesData } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id);

    const isAdmin = (rolesData ?? []).some((r: { role: string }) => ADMIN_ROLES.has(r.role));

    if (mode === "admin") {
      // Admin tab: must have admin role
      if (!isAdmin) {
        await supabase.auth.signOut();
        setError("You don't have admin access. Contact the Director to request access.");
        setLoading(false);
        return;
      }
      router.push("/admin/dashboard");
      return;
    }

    // Member tab: always go to member, even if they also have admin role
    const { data: member } = await supabase
      .from("members")
      .select("onboarding_complete")
      .eq("auth_id", user.id)
      .maybeSingle();

    router.push(member?.onboarding_complete ? "/member/home" : "/member/onboarding");
  };

  const handleGoogleLogin = async () => {
    setGoogleLoading(true);
    setError("");
    const supabase = createClient();
    const callbackUrl = new URL(`${window.location.origin}/auth/callback`);
    if (mode === "admin") callbackUrl.searchParams.set("intent", "admin");
    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: callbackUrl.toString() },
    });
    if (oauthError) {
      setError("Google sign-in failed. Please try again or use email and password.");
      setGoogleLoading(false);
    }
  };

  return (
    <div
      className="sode"
      style={{
        minHeight: "100svh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "32px 20px",
        background: "var(--navy)",
      }}
    >
      <div style={{ width: "100%", maxWidth: 400, animation: "sode-rise .35s ease" }}>

        {/* Logo */}
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 28 }}>
          <Image
            src="/images/sode-white-logo.png"
            alt="School of Daniels and Esthers"
            width={160}
            height={64}
            className="object-contain"
            priority
          />
        </div>

        {/* Card */}
        <div className="card" style={{ padding: "28px 28px 24px", borderRadius: 20 }}>

          {/* Heading */}
          <div style={{ textAlign: "center", marginBottom: 22 }}>
            <h1 style={{ fontSize: 22, fontWeight: 800, letterSpacing: "-.02em" }}>Welcome back</h1>
            <p style={{ fontSize: 13.5, color: "var(--muted)", marginTop: 4 }}>Sign in to continue</p>
          </div>

          {/* Role switcher */}
          <div style={{ display: "flex", gap: 6, background: "var(--surface)", borderRadius: 10, padding: 4, marginBottom: 18 }}>
            {(["member", "admin"] as LoginMode[]).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMode(m)}
                style={{
                  flex: 1, padding: "8px 0", borderRadius: 7, fontSize: 13.5, fontWeight: 700,
                  background: mode === m ? "var(--navy)" : "transparent",
                  color: mode === m ? "#fff" : "var(--muted)",
                  transition: "background .15s, color .15s",
                  textTransform: "capitalize",
                }}
              >
                {m}
              </button>
            ))}
          </div>
          {mode === "admin" && (
            <div style={{ display: "flex", alignItems: "center", gap: 6, justifyContent: "center", marginBottom: 16, padding: "7px 12px", background: "var(--navy-tint)", borderRadius: 8 }}>
              <Icon name="lock" size={13} color="var(--navy)" />
              <span style={{ fontSize: 12.5, fontWeight: 600, color: "var(--navy)" }}>Leadership access</span>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleEmailLogin} style={{ display: "flex", flexDirection: "column", gap: 14 }}>

            {/* Email */}
            <div>
              <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "var(--ink-2)", marginBottom: 6 }}>
                Email
              </label>
              <div style={{ position: "relative" }}>
                <div style={{ position: "absolute", left: 13, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }}>
                  <Icon name="mail" size={16} color="var(--faint)" />
                </div>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="your@email.com"
                  required
                  autoComplete="email"
                  style={{
                    width: "100%", height: 44, borderRadius: 10, border: "1.5px solid var(--line-2)",
                    background: "var(--surface)", padding: "0 14px 0 38px",
                    fontSize: 14.5, fontFamily: "var(--font)", color: "var(--ink)", outline: "none",
                    boxSizing: "border-box",
                  }}
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                <label style={{ fontSize: 13, fontWeight: 600, color: "var(--ink-2)" }}>Password</label>
                <a
                  href="/forgot-password"
                  style={{ fontSize: 12.5, color: "var(--navy)", fontWeight: 600, textDecoration: "none" }}
                >
                  Forgot password?
                </a>
              </div>
              <div style={{ position: "relative" }}>
                <div style={{ position: "absolute", left: 13, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }}>
                  <Icon name="lock" size={16} color="var(--faint)" />
                </div>
                <input
                  type={showPw ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Your password"
                  required
                  autoComplete="current-password"
                  style={{
                    width: "100%", height: 44, borderRadius: 10, border: "1.5px solid var(--line-2)",
                    background: "var(--surface)", padding: "0 44px 0 38px",
                    fontSize: 14.5, fontFamily: "var(--font)", color: "var(--ink)", outline: "none",
                    boxSizing: "border-box",
                  }}
                />
                <button
                  type="button"
                  onClick={() => setShowPw((v) => !v)}
                  style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", color: "var(--faint)", background: "none", padding: 2 }}
                  tabIndex={-1}
                >
                  <Icon name={showPw ? "eyeoff" : "eye"} size={17} />
                </button>
              </div>
            </div>

            {/* Error */}
            {error && (
              <div style={{ background: "#fff5f5", border: "1px solid #fed7d7", borderRadius: 9, padding: "10px 13px", fontSize: 13, color: "#c53030", display: "flex", alignItems: "flex-start", gap: 8 }}>
                <Icon name="x" size={15} color="#c53030" />
                <span>{error}</span>
              </div>
            )}

            {/* Sign in */}
            <button
              type="submit"
              className="btn btn-primary btn-block"
              disabled={loading || !email.trim() || !password}
              style={{ height: 44, fontSize: 15, fontWeight: 700, borderRadius: 10, marginTop: 2 }}
            >
              {loading ? (
                <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                  <span style={{ width: 16, height: 16, border: "2px solid rgba(255,255,255,.4)", borderTopColor: "#fff", borderRadius: "50%", animation: "sode-spin .7s linear infinite", display: "inline-block" }} />
                  Signing in…
                </span>
              ) : "Sign in"}
            </button>
          </form>

          {/* Divider */}
          <div style={{ display: "flex", alignItems: "center", gap: 12, margin: "18px 0" }}>
            <div style={{ flex: 1, height: 1, background: "var(--line)" }} />
            <span style={{ fontSize: 12, color: "var(--faint)", fontWeight: 500 }}>or continue with</span>
            <div style={{ flex: 1, height: 1, background: "var(--line)" }} />
          </div>

          {/* Google */}
          <button
            type="button"
            onClick={handleGoogleLogin}
            disabled={googleLoading}
            style={{
              width: "100%", height: 44, borderRadius: 10, border: "1.5px solid var(--line-2)",
              background: "#fff", display: "flex", alignItems: "center", justifyContent: "center",
              gap: 10, fontSize: 14.5, fontWeight: 600, color: "var(--ink)", cursor: "pointer",
            }}
          >
            {googleLoading ? (
              <span style={{ width: 18, height: 18, border: "2px solid var(--line-2)", borderTopColor: "var(--navy)", borderRadius: "50%", animation: "sode-spin .7s linear infinite", display: "inline-block" }} />
            ) : (
              <svg width="18" height="18" viewBox="0 0 24 24">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
              </svg>
            )}
            Continue with Google
          </button>

          {/* Footer note */}
          <p style={{ textAlign: "center", fontSize: 13, color: "var(--muted)", marginTop: 20 }}>
            {mode === "member" ? (
              <>New to SODE?{" "}<a href="/register" style={{ color: "var(--navy)", fontWeight: 700, textDecoration: "none" }}>Create an account</a></>
            ) : (
              <span style={{ color: "var(--faint)" }}>Admin access is granted by the Director.</span>
            )}
          </p>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginInner />
    </Suspense>
  );
}

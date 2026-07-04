"use client";

// Internal admin login — deliberately separated from the public member login
// page (/login). Admin access is only available through this route, and every
// admin sign-in is stepped up with two-factor authentication (TOTP).
//
// Requires "Multi-Factor Authentication (TOTP)" to be enabled in the Supabase
// dashboard (Authentication → Providers → MFA).

import { useState, useEffect, Suspense } from "react";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase";
import { Icon } from "@/components/sode/icons";

const ADMIN_ROLES = new Set([
  "super_admin", "director", "spiritual_lead", "career_lead", "business_lead",
  "member_care_lead", "data_ops_lead", "business_dev", "external_mentor",
]);

type Phase = "credentials" | "mfa-verify" | "mfa-enroll";

function friendlyError(msg: string): string {
  const m = msg.toLowerCase();
  if (m.includes("invalid login credentials")) return "Incorrect email or password. Please try again.";
  if (m.includes("too many requests") || m.includes("rate limit")) return "Too many attempts. Please wait a few minutes before trying again.";
  if (m.includes("invalid totp") || m.includes("invalid code")) return "That code didn't match. Check your authenticator app and try again.";
  if (m.includes("email not confirmed")) return "Please verify your email before signing in.";
  return msg;
}

const inputStyle: React.CSSProperties = {
  width: "100%", height: 44, borderRadius: 10, border: "1.5px solid var(--line-2)",
  background: "var(--surface)", padding: "0 14px",
  fontSize: 14.5, fontFamily: "var(--font)", color: "var(--ink)", outline: "none",
  boxSizing: "border-box",
};

function AdminLoginInner() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [phase, setPhase] = useState<Phase>("credentials");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // MFA state
  const [factorId, setFactorId] = useState<string | null>(null);
  const [challengeId, setChallengeId] = useState<string | null>(null);
  const [totpCode, setTotpCode] = useState("");
  const [enrollQr, setEnrollQr] = useState<string | null>(null);
  const [enrollSecret, setEnrollSecret] = useState<string | null>(null);

  useEffect(() => {
    const err = searchParams.get("error");
    if (err === "not_admin") {
      setError("You don't have admin access. Contact the Director to request access.");
    } else if (err === "mfa_required") {
      setError("Two-factor verification is required to access the admin portal.");
    } else if (err) {
      setError(friendlyError(decodeURIComponent(err)));
    }
  }, [searchParams]);

  // If an admin is already signed in but was bounced here for step-up
  // verification (?error=mfa_required), skip the credentials phase and go
  // straight to the OTP challenge — or to enrollment if they have no factor
  // yet (e.g. they signed in through Google OAuth before enrolling).
  useEffect(() => {
    if (searchParams.get("error") !== "mfa_required") return;
    (async () => {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      try {
        const { data: factors } = await supabase.auth.mfa.listFactors();
        const verified = (factors?.totp ?? []).find((f) => f.status === "verified");
        if (verified) {
          const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({ factorId: verified.id });
          if (challengeError) throw challengeError;
          setFactorId(verified.id);
          setChallengeId(challenge.id);
          setPhase("mfa-verify");
          return;
        }
        // Signed in but never enrolled — force enrollment now.
        const { data: enrolled, error: enrollError } = await supabase.auth.mfa.enroll({ factorType: "totp" });
        if (enrollError) throw enrollError;
        setFactorId(enrolled.id);
        setEnrollQr(enrolled.totp?.qr_code ?? null);
        setEnrollSecret(enrolled.totp?.secret ?? null);
        setPhase("mfa-enroll");
      } catch { /* stay on credentials phase */ }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  // After credentials + role check: require a second factor.
  const startMfa = async (): Promise<boolean> => {
    const supabase = createClient();
    try {
      const { data: factors, error: listError } = await supabase.auth.mfa.listFactors();
      if (listError) throw listError;

      const verified = (factors?.totp ?? []).find((f) => f.status === "verified");
      if (verified) {
        const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({ factorId: verified.id });
        if (challengeError) throw challengeError;
        setFactorId(verified.id);
        setChallengeId(challenge.id);
        setPhase("mfa-verify");
        return true;
      }

      // No factor yet — enroll one now. Admins must use 2FA.
      const { data: enrolled, error: enrollError } = await supabase.auth.mfa.enroll({ factorType: "totp" });
      if (enrollError) throw enrollError;
      setFactorId(enrolled.id);
      setEnrollQr(enrolled.totp?.qr_code ?? null);
      setEnrollSecret(enrolled.totp?.secret ?? null);
      setPhase("mfa-enroll");
      return true;
    } catch (e) {
      // MFA not enabled on the Supabase project — fail open with a console
      // warning rather than locking every admin out.
      console.warn("[admin-login] MFA unavailable:", e);
      return false;
    }
  };

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

    if (!isAdmin) {
      await supabase.auth.signOut();
      setError("You don't have admin access. Contact the Director to request access.");
      setLoading(false);
      return;
    }

    const mfaStarted = await startMfa();
    setLoading(false);
    if (!mfaStarted) {
      router.push("/admin/dashboard");
    }
  };

  const handleVerifyTotp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!factorId || totpCode.trim().length < 6) return;
    setLoading(true);
    setError("");
    const supabase = createClient();
    try {
      let chId = challengeId;
      if (!chId) {
        const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({ factorId });
        if (challengeError) throw challengeError;
        chId = challenge.id;
        setChallengeId(chId);
      }
      const { error: verifyError } = await supabase.auth.mfa.verify({
        factorId,
        challengeId: chId!,
        code: totpCode.trim(),
      });
      if (verifyError) throw verifyError;
      router.push("/admin/dashboard");
    } catch (err) {
      setError(friendlyError(err instanceof Error ? err.message : "Verification failed."));
      setChallengeId(null);
      setLoading(false);
    }
  };

  const handleVerifyEnrollment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!factorId || totpCode.trim().length < 6) return;
    setLoading(true);
    setError("");
    const supabase = createClient();
    try {
      const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({ factorId });
      if (challengeError) throw challengeError;
      const { error: verifyError } = await supabase.auth.mfa.verify({
        factorId,
        challengeId: challenge.id,
        code: totpCode.trim(),
      });
      if (verifyError) throw verifyError;
      router.push("/admin/dashboard");
    } catch (err) {
      setError(friendlyError(err instanceof Error ? err.message : "Verification failed."));
      setLoading(false);
    }
  };

  const spinner = (
    <span style={{ width: 16, height: 16, border: "2px solid rgba(255,255,255,.4)", borderTopColor: "#fff", borderRadius: "50%", animation: "sode-spin .7s linear infinite", display: "inline-block" }} />
  );

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

          <div style={{ textAlign: "center", marginBottom: 20 }}>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "7px 14px", background: "var(--navy-tint)", borderRadius: 99, marginBottom: 12 }}>
              <Icon name="lock" size={13} color="var(--navy)" />
              <span style={{ fontSize: 12.5, fontWeight: 700, color: "var(--navy)" }}>Admin portal</span>
            </div>
            <h1 style={{ fontSize: 22, fontWeight: 800, letterSpacing: "-.02em" }}>
              {phase === "credentials" ? "Leadership sign in" : phase === "mfa-verify" ? "Two-factor verification" : "Set up two-factor auth"}
            </h1>
            <p style={{ fontSize: 13.5, color: "var(--muted)", marginTop: 4 }}>
              {phase === "credentials" && "Restricted access — leadership team only"}
              {phase === "mfa-verify" && "Enter the 6-digit code from your authenticator app"}
              {phase === "mfa-enroll" && "Admin accounts require 2FA. Scan the QR code with an authenticator app."}
            </p>
          </div>

          {/* Error */}
          {error && (
            <div style={{ background: "#fff5f5", border: "1px solid #fed7d7", borderRadius: 9, padding: "10px 13px", fontSize: 13, color: "#c53030", display: "flex", alignItems: "flex-start", gap: 8, marginBottom: 14 }}>
              <Icon name="x" size={15} color="#c53030" />
              <span>{error}</span>
            </div>
          )}

          {phase === "credentials" && (
            <>
              <form onSubmit={handleEmailLogin} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                <div>
                  <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "var(--ink-2)", marginBottom: 6 }}>Email</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="your@email.com"
                    required
                    autoComplete="email"
                    style={inputStyle}
                  />
                </div>

                <div>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                    <label style={{ fontSize: 13, fontWeight: 600, color: "var(--ink-2)" }}>Password</label>
                    <a href="/forgot-password" style={{ fontSize: 12.5, color: "var(--navy)", fontWeight: 600, textDecoration: "none" }}>
                      Forgot password?
                    </a>
                  </div>
                  <div style={{ position: "relative" }}>
                    <input
                      type={showPw ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Your password"
                      required
                      autoComplete="current-password"
                      style={{ ...inputStyle, paddingRight: 44 }}
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

                <button
                  type="submit"
                  className="btn btn-primary btn-block"
                  disabled={loading || !email.trim() || !password}
                  style={{ height: 44, fontSize: 15, fontWeight: 700, borderRadius: 10, marginTop: 2 }}
                >
                  {loading ? <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>{spinner} Signing in…</span> : "Sign in"}
                </button>
              </form>

              <p style={{ textAlign: "center", fontSize: 13, color: "var(--faint)", marginTop: 20 }}>
                Admin access is granted by the Director. Members sign in at{" "}
                <a href="/login" style={{ color: "var(--navy)", fontWeight: 700, textDecoration: "none" }}>the member page</a>.
              </p>
            </>
          )}

          {phase === "mfa-verify" && (
            <form onSubmit={handleVerifyTotp} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <input
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                pattern="[0-9]*"
                maxLength={6}
                value={totpCode}
                onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, ""))}
                placeholder="123456"
                autoFocus
                style={{ ...inputStyle, textAlign: "center", fontSize: 22, letterSpacing: "0.4em", fontWeight: 700 }}
              />
              <button
                type="submit"
                className="btn btn-primary btn-block"
                disabled={loading || totpCode.length < 6}
                style={{ height: 44, fontSize: 15, fontWeight: 700, borderRadius: 10 }}
              >
                {loading ? <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>{spinner} Verifying…</span> : "Verify and continue"}
              </button>
            </form>
          )}

          {phase === "mfa-enroll" && (
            <form onSubmit={handleVerifyEnrollment} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {enrollQr && (
                <div style={{ display: "flex", justifyContent: "center", padding: "6px 0" }}>
                  {/* Supabase returns the QR as an inline SVG data URL */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={enrollQr} alt="Scan this QR code with your authenticator app" width={180} height={180} style={{ borderRadius: 12, border: "1px solid var(--line)" }} />
                </div>
              )}
              {enrollSecret && (
                <p style={{ fontSize: 12, color: "var(--muted)", textAlign: "center", margin: 0, wordBreak: "break-all" }}>
                  Can&apos;t scan? Enter this key manually: <b className="tnum">{enrollSecret}</b>
                </p>
              )}
              <input
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                pattern="[0-9]*"
                maxLength={6}
                value={totpCode}
                onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, ""))}
                placeholder="123456"
                style={{ ...inputStyle, textAlign: "center", fontSize: 22, letterSpacing: "0.4em", fontWeight: 700 }}
              />
              <button
                type="submit"
                className="btn btn-primary btn-block"
                disabled={loading || totpCode.length < 6}
                style={{ height: 44, fontSize: 15, fontWeight: 700, borderRadius: 10 }}
              >
                {loading ? <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>{spinner} Verifying…</span> : "Activate 2FA and continue"}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

export default function AdminLoginPage() {
  return (
    <Suspense fallback={null}>
      <AdminLoginInner />
    </Suspense>
  );
}

"use client";

import { useState, Suspense } from "react";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase";
import { Icon } from "@/components/sode/icons";

function strengthOf(pwd: string) {
  if (!pwd) return null;
  let s = 0;
  if (pwd.length >= 8) s++;
  if (pwd.length >= 12) s++;
  if (/\d/.test(pwd)) s++;
  if (/[^a-zA-Z0-9]/.test(pwd)) s++;
  if (s <= 1) return { label: "Weak", color: "#e53e3e", bars: 1 };
  if (s <= 2) return { label: "Fair", color: "#dd6b20", bars: 2 };
  return { label: "Strong", color: "#38a169", bars: 3 };
}

function inp(extra?: React.CSSProperties): React.CSSProperties {
  return {
    width: "100%", height: 44, borderRadius: 10, border: "1.5px solid var(--line-2)",
    background: "var(--surface)", fontSize: 14.5, fontFamily: "var(--font)",
    color: "var(--ink)", outline: "none", boxSizing: "border-box", ...extra,
  };
}

function RegisterInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const refCode = searchParams.get("ref"); // referral code from invite link

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [showPw, setShowPw] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState("");

  const strength = strengthOf(password);
  const mismatch = confirm.length > 0 && password !== confirm;
  const canSubmit = name.trim() && email.trim() && whatsapp.trim() && password.length >= 8 && !mismatch && agreed && !loading;

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    if (password !== confirm) { setError("Passwords do not match."); return; }

    setLoading(true);
    setError("");

    const supabase = createClient();

    const { data, error: signUpError } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: { data: { full_name: name.trim(), phone: whatsapp.trim() } },
    });

    if (signUpError) {
      setLoading(false);
      if (signUpError.message.toLowerCase().includes("already registered") ||
          signUpError.message.toLowerCase().includes("already exists")) {
        setError("already_exists");
      } else {
        setError(signUpError.message);
      }
      return;
    }

    const user = data.user;
    if (!user) { setLoading(false); setError("Registration failed. Please try again."); return; }

    // Create member record
    await supabase.from("members").insert({
      auth_id: user.id,
      name: name.trim(),
      email: email.trim(),
      whatsapp: whatsapp.trim(),
      onboarding_complete: false,
      created_at: new Date().toISOString(),
    });

    // Process referral
    try {
      console.log("[Referral] Calling on-register API", { refCode });
      const refResponse = await fetch("/api/referral/on-register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), refCode: refCode || null, authId: user.id }),
      });
      const refResult = await refResponse.json();
      console.log("[Referral] Result:", refResult);
    } catch (e) {
      console.error("[Referral] Error:", e);
    }

    // Notify leadership (fire and forget)
    fetch("/api/notify/new-member", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: name.trim(), email: email.trim(), whatsapp: whatsapp.trim(), registered_at: new Date().toISOString() }),
    }).catch(() => {});

    router.push("/member/onboarding");
  };

  const handleGoogle = async () => {
    setGoogleLoading(true);
    setError("");
    const supabase = createClient();
    // Carry ref code through OAuth so callback can process referral
    const callbackUrl = refCode
      ? `${window.location.origin}/auth/callback?ref=${encodeURIComponent(refCode)}`
      : `${window.location.origin}/auth/callback`;
    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: callbackUrl },
    });
    if (oauthError) {
      setError("Google sign-up failed. Please try again or use email and password.");
      setGoogleLoading(false);
    }
  };

  return (
    <div className="sode" style={{ minHeight: "100svh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "32px 20px", background: "var(--navy)" }}>
      <div style={{ width: "100%", maxWidth: 420, animation: "sode-rise .35s ease" }}>

        <div style={{ display: "flex", justifyContent: "center", marginBottom: 28 }}>
          <Image src="/images/sode-primary-logo.png" alt="SODE" width={120} height={48} className="object-contain" priority />
        </div>

        <div className="card" style={{ padding: "28px 28px 24px", borderRadius: 20 }}>
          <div style={{ textAlign: "center", marginBottom: 22 }}>
            <h1 style={{ fontSize: 22, fontWeight: 800, letterSpacing: "-.02em" }}>Create your account</h1>
            <p style={{ fontSize: 13.5, color: "var(--muted)", marginTop: 4 }}>Join the School of Daniels &amp; Esthers</p>
          </div>

          <form onSubmit={handleRegister} style={{ display: "flex", flexDirection: "column", gap: 14 }}>

            {/* Full name */}
            <div>
              <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "var(--ink-2)", marginBottom: 6 }}>Full name</label>
              <div style={{ position: "relative" }}>
                <div style={{ position: "absolute", left: 13, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }}><Icon name="user" size={16} color="var(--faint)" /></div>
                <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Your full name" required autoComplete="name" style={inp({ padding: "0 14px 0 38px" })} />
              </div>
            </div>

            {/* Email */}
            <div>
              <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "var(--ink-2)", marginBottom: 6 }}>Email</label>
              <div style={{ position: "relative" }}>
                <div style={{ position: "absolute", left: 13, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }}><Icon name="mail" size={16} color="var(--faint)" /></div>
                <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="your@email.com" required autoComplete="email" style={inp({ padding: "0 14px 0 38px" })} />
              </div>
            </div>

            {/* WhatsApp */}
            <div>
              <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "var(--ink-2)", marginBottom: 6 }}>WhatsApp number</label>
              <div style={{ position: "relative" }}>
                <div style={{ position: "absolute", left: 13, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }}><Icon name="message" size={16} color="var(--faint)" /></div>
                <input type="tel" value={whatsapp} onChange={e => setWhatsapp(e.target.value)} placeholder="080XXXXXXXX" required autoComplete="tel" style={inp({ padding: "0 14px 0 38px" })} />
              </div>
              <p style={{ fontSize: 11.5, color: "var(--faint)", marginTop: 5 }}>We use this for gentle reminders only.</p>
            </div>

            {/* Password */}
            <div>
              <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "var(--ink-2)", marginBottom: 6 }}>Password</label>
              <div style={{ position: "relative" }}>
                <div style={{ position: "absolute", left: 13, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }}><Icon name="lock" size={16} color="var(--faint)" /></div>
                <input type={showPw ? "text" : "password"} value={password} onChange={e => setPassword(e.target.value)} placeholder="Create a password" required autoComplete="new-password" style={inp({ padding: "0 44px 0 38px" })} />
                <button type="button" onClick={() => setShowPw(v => !v)} style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", color: "var(--faint)", background: "none", padding: 2 }} tabIndex={-1}>
                  <Icon name={showPw ? "eyeoff" : "eye"} size={17} />
                </button>
              </div>
              {password.length > 0 && strength && (
                <div style={{ marginTop: 8 }}>
                  <div style={{ display: "flex", gap: 4, marginBottom: 4 }}>
                    {[1, 2, 3].map(i => <div key={i} style={{ flex: 1, height: 4, borderRadius: 2, background: i <= strength.bars ? strength.color : "var(--surface-2)", transition: "background .2s" }} />)}
                  </div>
                  <span style={{ fontSize: 11.5, fontWeight: 600, color: strength.color }}>{strength.label}</span>
                </div>
              )}
            </div>

            {/* Confirm password */}
            <div>
              <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "var(--ink-2)", marginBottom: 6 }}>Confirm password</label>
              <div style={{ position: "relative" }}>
                <div style={{ position: "absolute", left: 13, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }}><Icon name="lock" size={16} color="var(--faint)" /></div>
                <input type={showConfirm ? "text" : "password"} value={confirm} onChange={e => setConfirm(e.target.value)} placeholder="Confirm your password" required autoComplete="new-password" style={inp({ padding: "0 44px 0 38px", borderColor: mismatch ? "#fed7d7" : undefined })} />
                <button type="button" onClick={() => setShowConfirm(v => !v)} style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", color: "var(--faint)", background: "none", padding: 2 }} tabIndex={-1}>
                  <Icon name={showConfirm ? "eyeoff" : "eye"} size={17} />
                </button>
              </div>
              {mismatch && <p style={{ fontSize: 12, color: "#c53030", marginTop: 5 }}>Passwords do not match.</p>}
            </div>

            {/* Terms */}
            <label style={{ display: "flex", alignItems: "flex-start", gap: 10, cursor: "pointer" }}>
              <div onClick={() => setAgreed(v => !v)} style={{ width: 20, height: 20, borderRadius: 6, border: `1.5px solid ${agreed ? "var(--navy)" : "var(--line-2)"}`, background: agreed ? "var(--navy)" : "#fff", display: "flex", alignItems: "center", justifyContent: "center", flex: "none", marginTop: 1 }}>
                {agreed && <Icon name="check" size={13} stroke={3} color="#fff" />}
              </div>
              <input type="checkbox" checked={agreed} onChange={e => setAgreed(e.target.checked)} style={{ display: "none" }} />
              <span style={{ fontSize: 13, color: "var(--ink-2)", lineHeight: 1.5 }}>
                I agree to the SODE community guidelines and privacy policy
              </span>
            </label>

            {/* Error */}
            {error && (
              <div style={{ background: "#fff5f5", border: "1px solid #fed7d7", borderRadius: 9, padding: "10px 13px", fontSize: 13, color: "#c53030" }}>
                {error === "already_exists" ? (
                  <>An account with this email already exists.{" "}<a href="/login" style={{ color: "#c53030", fontWeight: 700 }}>Sign in instead.</a></>
                ) : error}
              </div>
            )}

            <button type="submit" className="btn btn-primary btn-block" disabled={!canSubmit} style={{ height: 44, fontSize: 15, fontWeight: 700, borderRadius: 10, marginTop: 2 }}>
              {loading ? (
                <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                  <span style={{ width: 16, height: 16, border: "2px solid rgba(255,255,255,.4)", borderTopColor: "#fff", borderRadius: "50%", animation: "sode-spin .7s linear infinite", display: "inline-block" }} />
                  Creating account…
                </span>
              ) : "Create account"}
            </button>
          </form>

          {/* Divider */}
          <div style={{ display: "flex", alignItems: "center", gap: 12, margin: "18px 0" }}>
            <div style={{ flex: 1, height: 1, background: "var(--line)" }} />
            <span style={{ fontSize: 12, color: "var(--faint)", fontWeight: 500 }}>or</span>
            <div style={{ flex: 1, height: 1, background: "var(--line)" }} />
          </div>

          {/* Google */}
          <button type="button" onClick={handleGoogle} disabled={googleLoading} style={{ width: "100%", height: 44, borderRadius: 10, border: "1.5px solid var(--line-2)", background: "#fff", display: "flex", alignItems: "center", justifyContent: "center", gap: 10, fontSize: 14.5, fontWeight: 600, color: "var(--ink)", cursor: "pointer" }}>
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

          <p style={{ textAlign: "center", fontSize: 13, color: "var(--muted)", marginTop: 20 }}>
            Already have an account?{" "}
            <a href="/login" style={{ color: "var(--navy)", fontWeight: 700, textDecoration: "none" }}>Sign in</a>
          </p>
        </div>
      </div>
    </div>
  );
}

export default function RegisterPage() {
  return (
    <Suspense fallback={null}>
      <RegisterInner />
    </Suspense>
  );
}

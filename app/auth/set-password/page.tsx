"use client";

import { useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
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

const ADMIN_ROLES = new Set(["director","spiritual_lead","career_lead","business_lead","member_care_lead","data_ops_lead"]);

export default function SetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const strength = strengthOf(password);
  const mismatch = confirm.length > 0 && password !== confirm;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirm) { setError("Passwords do not match."); return; }
    if (password.length < 8) { setError("Password must be at least 8 characters."); return; }

    setLoading(true);
    setError("");

    const supabase = createClient();

    // Set the password and clear the setup flag
    const { data, error: updateError } = await supabase.auth.updateUser({
      password,
      data: { needs_password_setup: false },
    });

    if (updateError) {
      setError(updateError.message);
      setLoading(false);
      return;
    }

    const user = data.user;
    if (!user) { router.push("/login"); return; }

    const { data: rolesData } = await supabase.from("user_roles").select("role").eq("user_id", user.id);
    const isAdmin = (rolesData ?? []).some((r: { role: string }) => ADMIN_ROLES.has(r.role));
    if (isAdmin) { router.push("/admin/dashboard"); return; }

    const { data: member } = await supabase.from("members").select("onboarding_complete").eq("auth_id", user.id).maybeSingle();
    router.push(member?.onboarding_complete ? "/member/home" : "/member/onboarding");
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

        <div style={{ display: "flex", justifyContent: "center", marginBottom: 28 }}>
          <Image src="/images/sode-primary-logo.png" alt="SODE" width={120} height={48} className="object-contain" priority />
        </div>

        <div className="card" style={{ padding: "28px 28px 24px", borderRadius: 20 }}>
          <div style={{ marginBottom: 22 }}>
            <h1 style={{ fontSize: 20, fontWeight: 800, letterSpacing: "-.02em" }}>Welcome to SODE!</h1>
            <p style={{ fontSize: 13.5, color: "var(--muted)", marginTop: 5, lineHeight: 1.5 }}>
              Set a password so you can sign in anytime.
            </p>
          </div>

          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>

            <div>
              <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "var(--ink-2)", marginBottom: 6 }}>New password</label>
              <div style={{ position: "relative" }}>
                <div style={{ position: "absolute", left: 13, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }}>
                  <Icon name="lock" size={16} color="var(--faint)" />
                </div>
                <input
                  type={showPw ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="At least 8 characters"
                  required
                  autoComplete="new-password"
                  style={{
                    width: "100%", height: 44, borderRadius: 10, border: "1.5px solid var(--line-2)",
                    background: "var(--surface)", padding: "0 44px 0 38px",
                    fontSize: 14.5, fontFamily: "var(--font)", color: "var(--ink)", outline: "none", boxSizing: "border-box",
                  }}
                />
                <button type="button" onClick={() => setShowPw((v) => !v)} style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", color: "var(--faint)", background: "none", padding: 2 }} tabIndex={-1}>
                  <Icon name={showPw ? "eyeoff" : "eye"} size={17} />
                </button>
              </div>

              {password.length > 0 && strength && (
                <div style={{ marginTop: 8 }}>
                  <div style={{ display: "flex", gap: 4, marginBottom: 4 }}>
                    {[1, 2, 3].map((i) => (
                      <div key={i} style={{ flex: 1, height: 4, borderRadius: 2, background: i <= strength.bars ? strength.color : "var(--surface-2)", transition: "background .2s" }} />
                    ))}
                  </div>
                  <span style={{ fontSize: 11.5, fontWeight: 600, color: strength.color }}>{strength.label}</span>
                </div>
              )}
            </div>

            <div>
              <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "var(--ink-2)", marginBottom: 6 }}>Confirm password</label>
              <div style={{ position: "relative" }}>
                <div style={{ position: "absolute", left: 13, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }}>
                  <Icon name="lock" size={16} color="var(--faint)" />
                </div>
                <input
                  type={showConfirm ? "text" : "password"}
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  placeholder="Repeat your password"
                  required
                  autoComplete="new-password"
                  style={{
                    width: "100%", height: 44, borderRadius: 10,
                    border: `1.5px solid ${mismatch ? "#fed7d7" : "var(--line-2)"}`,
                    background: "var(--surface)", padding: "0 44px 0 38px",
                    fontSize: 14.5, fontFamily: "var(--font)", color: "var(--ink)", outline: "none", boxSizing: "border-box",
                  }}
                />
                <button type="button" onClick={() => setShowConfirm((v) => !v)} style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", color: "var(--faint)", background: "none", padding: 2 }} tabIndex={-1}>
                  <Icon name={showConfirm ? "eyeoff" : "eye"} size={17} />
                </button>
              </div>
              {mismatch && <p style={{ fontSize: 12, color: "#c53030", marginTop: 5 }}>Passwords do not match.</p>}
            </div>

            {error && (
              <div style={{ background: "#fff5f5", border: "1px solid #fed7d7", borderRadius: 9, padding: "10px 13px", fontSize: 13, color: "#c53030" }}>
                {error}
              </div>
            )}

            <button
              type="submit"
              className="btn btn-primary btn-block"
              disabled={loading || !password || !confirm || mismatch || password.length < 8}
              style={{ height: 44, fontSize: 15, fontWeight: 700, borderRadius: 10, marginTop: 2 }}
            >
              {loading ? (
                <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                  <span style={{ width: 16, height: 16, border: "2px solid rgba(255,255,255,.4)", borderTopColor: "#fff", borderRadius: "50%", animation: "sode-spin .7s linear infinite", display: "inline-block" }} />
                  Setting up…
                </span>
              ) : "Set password & continue"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

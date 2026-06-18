"use client";

import { useState } from "react";
import Image from "next/image";
import { createClient } from "@/lib/supabase";
import { Icon } from "@/components/sode/icons";

type Status = "idle" | "loading" | "sent";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setStatus("loading");
    setError("");

    const supabase = createClient();
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/auth/callback?type=recovery`,
    });

    if (resetError) {
      setError(resetError.message);
      setStatus("idle");
    } else {
      setStatus("sent");
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

        <div style={{ display: "flex", justifyContent: "center", marginBottom: 28 }}>
          <Image
            src="/images/sode-primary-logo.png"
            alt="SODE"
            width={120}
            height={48}
            className="object-contain"
            priority
          />
        </div>

        <div className="card" style={{ padding: "28px 28px 24px", borderRadius: 20 }}>
          {status === "sent" ? (
            <SentState email={email} onRetry={() => { setStatus("idle"); setEmail(""); }} />
          ) : (
            <>
              <div style={{ marginBottom: 22 }}>
                <h1 style={{ fontSize: 21, fontWeight: 800, letterSpacing: "-.02em" }}>Reset your password</h1>
                <p style={{ fontSize: 13.5, color: "var(--muted)", marginTop: 5, lineHeight: 1.5 }}>
                  Enter your email and we&apos;ll send you a reset link.
                </p>
              </div>

              <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                <div>
                  <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "var(--ink-2)", marginBottom: 6 }}>
                    Email address
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

                {error && (
                  <div style={{ background: "#fff5f5", border: "1px solid #fed7d7", borderRadius: 9, padding: "10px 13px", fontSize: 13, color: "#c53030" }}>
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  className="btn btn-primary btn-block"
                  disabled={status === "loading" || !email.trim()}
                  style={{ height: 44, fontSize: 15, fontWeight: 700, borderRadius: 10 }}
                >
                  {status === "loading" ? (
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                      <span style={{ width: 16, height: 16, border: "2px solid rgba(255,255,255,.4)", borderTopColor: "#fff", borderRadius: "50%", animation: "sode-spin .7s linear infinite", display: "inline-block" }} />
                      Sending…
                    </span>
                  ) : "Send reset link"}
                </button>
              </form>

              <div style={{ textAlign: "center", marginTop: 18 }}>
                <a href="/login" style={{ fontSize: 13, color: "var(--navy)", fontWeight: 600, textDecoration: "none" }}>
                  ← Back to sign in
                </a>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function SentState({ email, onRetry }: { email: string; onRetry: () => void }) {
  return (
    <div style={{ textAlign: "center", padding: "8px 0" }}>
      <div style={{ width: 54, height: 54, borderRadius: 15, background: "var(--navy-tint)", display: "inline-flex", alignItems: "center", justifyContent: "center", marginBottom: 18 }}>
        <Icon name="mail" size={26} color="var(--navy)" />
      </div>
      <h2 style={{ fontSize: 20, fontWeight: 800, letterSpacing: "-.01em" }}>Check your email ✓</h2>
      <p style={{ fontSize: 13.5, color: "var(--muted)", marginTop: 10, lineHeight: 1.6 }}>
        We&apos;ve sent a password reset link to{" "}
        <strong style={{ color: "var(--ink)" }}>{email}</strong>.
      </p>
      <p style={{ fontSize: 12.5, color: "var(--faint)", marginTop: 12 }}>
        Didn&apos;t receive it? Check your spam folder.
      </p>
      <button
        onClick={onRetry}
        className="btn btn-outline btn-block"
        style={{ marginTop: 20, borderRadius: 10 }}
      >
        Try again
      </button>
      <a href="/login" style={{ display: "block", marginTop: 14, fontSize: 13, color: "var(--navy)", fontWeight: 600, textDecoration: "none" }}>
        ← Back to sign in
      </a>
    </div>
  );
}

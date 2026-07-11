import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { getUserRoles, hasAdminAccess } from "@/lib/roles";
import { processReferralOnRegister } from "@/lib/referral";
import { applyMentorInvite } from "@/lib/mentor-invite";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const type = searchParams.get("type"); // "recovery" for password reset flow
  const intent = searchParams.get("intent"); // "admin" when logging in via admin tab
  const refCode = searchParams.get("ref"); // referral code from ?ref=CODE
  const authError = searchParams.get("error");

  if (authError) {
    return NextResponse.redirect(`${origin}/login?error=${encodeURIComponent(authError)}`);
  }

  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=missing_code`);
  }

  const supabase = await createClient();
  const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);

  if (exchangeError) {
    return NextResponse.redirect(`${origin}/login?error=${encodeURIComponent(exchangeError.message)}`);
  }

  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.redirect(`${origin}/login?error=no_session`);
  }

  // Password reset flow — send to the reset page while session is active
  if (type === "recovery") {
    return NextResponse.redirect(`${origin}/auth/reset-password`);
  }

  // First-time password setup
  if (user.user_metadata?.needs_password_setup) {
    return NextResponse.redirect(`${origin}/auth/set-password`);
  }

  // Google OAuth: link or create member record
  const provider = user.app_metadata?.provider;
  if (provider === "google") {
    const { data: existingMember } = await supabase
      .from("members")
      .select("id")
      .eq("auth_id", user.id)
      .maybeSingle();

    if (!existingMember) {
      // Try to find a pre-existing member by email (invited before Google signup)
      const { data: memberByEmail } = await supabase
        .from("members")
        .select("id")
        .eq("email", user.email)
        .maybeSingle();

      let newMemberId: string | null = null;

      if (memberByEmail) {
        await supabase.from("members").update({ auth_id: user.id }).eq("id", memberByEmail.id);
        newMemberId = memberByEmail.id as string;
      } else {
        const name =
          user.user_metadata?.full_name ||
          user.user_metadata?.name ||
          user.email?.split("@")[0] ||
          "Member";
        const { data: inserted } = await supabase
          .from("members")
          .insert({ auth_id: user.id, email: user.email, name, points: 0, onboarding_complete: false })
          .select("id")
          .maybeSingle();
        newMemberId = (inserted?.id as string | undefined) ?? null;
      }

      // Process referral for the new Google OAuth member (fire and forget)
      if (newMemberId && user.email) {
        processReferralOnRegister(user.email, newMemberId, refCode ?? null).catch(() => {});
        // Apply a pending external-mentor invite, if one exists for this email
        await applyMentorInvite(user.email, newMemberId).catch((e) =>
          console.error("[callback] mentor invite apply failed (non-fatal):", e)
        );
      }
    }
  }

  // Email/password: process referral stored in user metadata at sign-up time.
  // Only runs for new signups (within 5 min of account creation) to avoid
  // repeating on every login.
  if (provider !== "google") {
    const storedRefCode = (user.user_metadata?.ref_code as string | null) ?? null;
    const storedEmail =
      (user.user_metadata?.invited_via_email as string | null) ?? user.email ?? null;
    const userCreatedAt = new Date(user.created_at ?? 0).getTime();
    const isNewSignup = Date.now() - userCreatedAt < 300_000;

    if (storedEmail && isNewSignup) {
      // Poll for member record — it may have been created client-side
      // milliseconds ago and may not yet be visible server-side.
      let memberId: string | null = null;
      for (let attempt = 0; attempt < 5; attempt++) {
        const { data: m } = await supabase
          .from("members")
          .select("id")
          .eq("auth_id", user.id)
          .maybeSingle();
        if (m?.id) { memberId = m.id as string; break; }
        if (attempt < 4) await new Promise(r => setTimeout(r, 500));
      }

      if (memberId) {
        processReferralOnRegister(storedEmail, memberId, storedRefCode).catch(console.error);
        // Apply a pending external-mentor invite, if one exists for this email
        await applyMentorInvite(user.email ?? storedEmail, memberId).catch((e) =>
          console.error("[callback] mentor invite apply failed (non-fatal):", e)
        );
      } else {
        console.error("[callback] Could not find member record for auth_id:", user.id);
      }
    }
  }

  // Admin intent (from /internal/admin-login): check role, then send to dashboard or reject
  if (intent === "admin") {
    const roles = await getUserRoles(user.id);
    if (!hasAdminAccess(roles)) {
      await supabase.auth.signOut();
      return NextResponse.redirect(`${origin}/internal/admin-login?error=not_admin`);
    }
    return NextResponse.redirect(`${origin}/admin/dashboard`);
  }

  // Member tab (no intent or intent=member): always go to member home, never admin
  const { data: member } = await supabase
    .from("members")
    .select("onboarding_complete")
    .eq("auth_id", user.id)
    .maybeSingle();

  const dest = member?.onboarding_complete ? "/member/home" : "/member/onboarding";
  return NextResponse.redirect(`${origin}${dest}`);
}

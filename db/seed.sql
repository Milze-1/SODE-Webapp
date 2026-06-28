-- ============================================================================
-- seed.sql — SODE Growth Platform
-- Run after rls.sql. Safe to run via Supabase service_role (bypasses RLS).
--
-- Contains:
--   1. Default point_rules (the economy from PRD §12-§17)
--   2. leaderboard_settings (one singleton row)
--   3. Test director account
--      ⚠  Replace TEST_AUTH_UUID below with a real Supabase auth.users.id
--         created via the Supabase dashboard before deploying to production.
-- ============================================================================

-- ─── 1. Point rules ──────────────────────────────────────────────────────────
-- PRD guidance: "invitations earn the most because growing the room is the
-- mission; routine actions earn a little." (§16)

INSERT INTO public.point_rules
  (rule_key, label, description, points, cap, cap_period, requires_verification, is_active)
VALUES

  -- ── Everyday actions (small, keep members engaged) ───────────────────────
  ('win_submitted',
   'Win submitted',
   'Member shares a win — spiritual, career, business or character.',
   5, 3, 'day', FALSE, TRUE),

  ('win_verified',
   'Win verified by leader',
   'A pillar lead or director confirms the win is genuine.',
   10, NULL, NULL, TRUE, TRUE),

  ('goal_progress',
   'Goal progress updated',
   'Member records measurable progress on a personal goal.',
   2, 3, 'day', FALSE, TRUE),

  ('goal_completed',
   'Goal completed',
   'Member marks a personal goal as done.',
   20, NULL, NULL, FALSE, TRUE),

  ('goal_completed_verified',
   'Goal completion verified',
   'Pillar lead confirms the goal is legitimately complete.',
   25, NULL, NULL, TRUE, TRUE),

  -- ── Sessions ──────────────────────────────────────────────────────────────
  ('attendance_present',
   'Session attendance',
   'Member checks in to a SODE session or Sunday service.',
   10, 5, 'month', FALSE, TRUE),

  -- ── Surveys & forms ────────────────────────────────────────────────────────
  ('pulse_survey_completed',
   'Pulse / NPS survey completed',
   'Member completes a quarterly pulse or NPS survey.',
   5, 1, 'month', FALSE, TRUE),

  ('form_response_submitted',
   'Form response submitted',
   'Member submits a general form (not wins, not pulse).',
   3, 5, 'month', FALSE, TRUE),

  -- ── Learning ───────────────────────────────────────────────────────────────
  ('course_completed',
   'Course completed',
   'Member marks a course as finished.',
   15, NULL, NULL, FALSE, TRUE),

  ('course_completed_verified',
   'Course completion verified',
   'Director or pillar lead verifies certificate / completion evidence.',
   20, NULL, NULL, TRUE, TRUE),

  -- ── Onboarding (one-time) ─────────────────────────────────────────────────
  ('onboarding_complete',
   'Profile setup complete',
   'Member completes onboarding (profile, consent, baseline survey).',
   10, 1, NULL, FALSE, TRUE),

  -- ── Invitations (highest — PRD §16: "invitations earn the most") ──────────
  -- "+5 invited" (§13), "+50 someone joined!" (§16)
  ('invite_sent',
   'Invitation sent',
   'Member sends an invitation to someone they personally know.',
   2, 20, 'month', FALSE, TRUE),

  ('invite_opened',
   'Invitation opened',
   'Recipient clicks the invitation link.',
   5, NULL, NULL, FALSE, TRUE),

  ('invite_joined',
   'Invitee joined SODE',
   'Invited person registers and completes onboarding.',
   25, NULL, NULL, FALSE, TRUE),

  ('invite_attended',
   'Invitee attended first session',
   'The person you invited shows up in person. "+50 someone joined!" (PRD §16)',
   50, NULL, NULL, FALSE, TRUE),

  ('invite_active',
   'Invitee became an active member',
   'Invited person has attended 3+ sessions and submitted a win or goal.',
   100, NULL, NULL, FALSE, TRUE),

  -- ── Advocacy / content sharing ─────────────────────────────────────────────
  -- "+5 invited" (PRD §13 describes the badge for shares)
  ('advocacy_share',
   'Shared SODE content',
   'Member shares an advocacy post on any platform.',
   5, 10, 'day', FALSE, TRUE),

  ('advocacy_click',
   'Click on shared content',
   'Someone clicks a link in content the member shared.',
   2, 50, 'month', FALSE, TRUE),

  -- ── Additional / code-referenced / fallback rules ───────────────────────────
  ('community_goal_completed',
   'Community goal completed',
   'Member completes a community-wide goal.',
   30, NULL, NULL, FALSE, TRUE),

  ('member_registered',
   'Registered account',
   'Member creates an account on the SODE platform.',
   0, NULL, NULL, FALSE, TRUE),

  ('referral_joined',
   'Referral joined',
   'The person you invited completed onboarding.',
   25, NULL, NULL, FALSE, TRUE),

  ('member_joined',
   'Joined via referral',
   'Joined SODE via an invitation link.',
   10, NULL, NULL, FALSE, TRUE),

  ('referral_attended',
   'Referral attended first session',
   'The person you invited attended their first SODE session.',
   50, NULL, NULL, FALSE, TRUE),

  ('referral_five_meetings',
   'Referral attended 5 sessions',
   'The person you invited attended 5 SODE sessions.',
   100, NULL, NULL, FALSE, TRUE)

ON CONFLICT (rule_key) DO UPDATE SET
  label                 = EXCLUDED.label,
  description           = EXCLUDED.description,
  points                = EXCLUDED.points,
  cap                   = EXCLUDED.cap,
  cap_period            = EXCLUDED.cap_period,
  requires_verification = EXCLUDED.requires_verification,
  is_active             = EXCLUDED.is_active,
  updated_at            = NOW();

-- ─── 2. Leaderboard settings (singleton) ─────────────────────────────────────

INSERT INTO public.leaderboard_settings
  (visibility, default_season, show_avatars, enabled_categories)
VALUES
  (
    'members_only',
    'month',
    TRUE,
    '["overall","inviters","advocates","goal_getters"]'
  );

-- ─── 3. Test director account ─────────────────────────────────────────────────
-- ⚠  BEFORE RUNNING IN PRODUCTION:
--    1. Create the user in Supabase Auth (Dashboard → Authentication → Users)
--       or via: supabase auth admin create-user --email director@sode.test
--    2. Copy the generated auth.users.id and replace TEST_AUTH_UUID below.
--    3. Remove or guard this block in production seeds.

DO $$
DECLARE
  -- Replace this placeholder with the real auth.users.id
  test_auth_uuid UUID := 'b5416b01-51b9-4d55-a589-83c4791b4f7e';
  test_member_id UUID := '00000000-0000-0000-0000-000000000001';
BEGIN
  -- Insert member record (idempotent)
  INSERT INTO public.members
    (id, auth_id, name, email, consent_data, onboarding_complete)
  VALUES
    (test_member_id, test_auth_uuid,
     'SODE Director (Test)', 'director@sode.test',
     TRUE, TRUE)
  ON CONFLICT (id) DO NOTHING;

  -- Assign director role (idempotent)
  INSERT INTO public.user_roles (user_id, role)
  VALUES (test_auth_uuid, 'director')
  ON CONFLICT (user_id, role) DO NOTHING;

  -- Seed a points balance row
  INSERT INTO public.user_points_balance (member_id)
  VALUES (test_member_id)
  ON CONFLICT (member_id) DO NOTHING;

  -- Seed default privacy prefs
  INSERT INTO public.user_privacy_prefs (member_id)
  VALUES (test_member_id)
  ON CONFLICT (member_id) DO NOTHING;
END;
$$;

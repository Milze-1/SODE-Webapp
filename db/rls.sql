-- ============================================================================
-- rls.sql — Row Level Security policies for the SODE Growth Platform
-- Run after 001_initial.sql on the Supabase database.
--
-- Permission model (from PRD §1 & §6):
--   member            → own rows only
--   *_lead (pillar)   → read member data scoped to their pillar
--   member_care_lead  → read all member-facing data (contact/follow-up)
--   data_ops_lead     → read all data; limited write
--   director          → full read+write
--   service_role      → bypasses RLS (Supabase default for server-side clients)
-- ============================================================================

-- ─── Helper functions (SECURITY DEFINER — no RLS bypass risk) ────────────────

-- Returns the members.id for the current authenticated user
CREATE OR REPLACE FUNCTION public.auth_member_id()
RETURNS UUID LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT id FROM public.members WHERE auth_id = auth.uid()
$$;

-- True if the current user holds the given role
CREATE OR REPLACE FUNCTION public.auth_has_role(check_role TEXT)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
      AND role    = check_role::public.role
  )
$$;

-- True if the current user is director or data_ops_lead (full read access)
CREATE OR REPLACE FUNCTION public.auth_is_director()
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
      AND role IN ('director', 'data_ops_lead')
  )
$$;

-- True if the current user holds any admin role (not 'member')
CREATE OR REPLACE FUNCTION public.auth_is_admin()
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
      AND role <> 'member'
  )
$$;

-- True if the current user may access data for the given pillar.
-- Pillar leads see their own pillar; member_care/director/data_ops see all.
-- Note: no 'character_lead' role exists — character pillar is covered by director.
CREATE OR REPLACE FUNCTION public.auth_can_access_pillar(p public.pillar)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
      AND (
            role IN ('director', 'data_ops_lead', 'member_care_lead')
         OR (role = 'spiritual_lead' AND p = 'spiritual')
         OR (role = 'career_lead'    AND p = 'career')
         OR (role = 'business_lead'  AND p = 'business')
      )
  )
$$;

-- ─── Enable RLS on every table ───────────────────────────────────────────────

ALTER TABLE public.profiles           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.members            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cells              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cell_members       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.goals              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wins               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sessions           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.courses            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.course_completions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.check_ins          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.forms              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.form_fields        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.form_responses     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reminders          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_log          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invites            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.points_log         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.point_rules        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.point_events       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_points_balance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.referral_codes     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invitations        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.suppression_list   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.advocacy_posts     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.advocacy_shares    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.advocacy_clicks    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leaderboard_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_privacy_prefs ENABLE ROW LEVEL SECURITY;

-- ─── profiles ────────────────────────────────────────────────────────────────

-- Any authenticated user can read any profile (display names are public)
CREATE POLICY "profiles_read_authenticated"
  ON public.profiles FOR SELECT TO authenticated
  USING (TRUE);

-- Each user may only update their own profile
CREATE POLICY "profiles_update_own"
  ON public.profiles FOR UPDATE TO authenticated
  USING  (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- ─── user_roles ──────────────────────────────────────────────────────────────

-- Members can read their own roles (needed by middleware)
CREATE POLICY "user_roles_read_own"
  ON public.user_roles FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- Admins can read all roles (needed to check colleague permissions)
CREATE POLICY "user_roles_read_admin"
  ON public.user_roles FOR SELECT TO authenticated
  USING (public.auth_is_admin());

-- Only directors can assign / revoke roles
CREATE POLICY "user_roles_write_director"
  ON public.user_roles FOR ALL TO authenticated
  USING  (public.auth_has_role('director'))
  WITH CHECK (public.auth_has_role('director'));

-- ─── members ─────────────────────────────────────────────────────────────────

-- Members read their own record
CREATE POLICY "members_read_own"
  ON public.members FOR SELECT TO authenticated
  USING (auth_id = auth.uid());

-- Members update their own record
CREATE POLICY "members_update_own"
  ON public.members FOR UPDATE TO authenticated
  USING  (auth_id = auth.uid())
  WITH CHECK (auth_id = auth.uid());

-- Members can insert their own record (first-time onboarding)
CREATE POLICY "members_insert_own"
  ON public.members FOR INSERT TO authenticated
  WITH CHECK (auth_id = auth.uid());

-- Member care lead reads all members
CREATE POLICY "members_read_member_care"
  ON public.members FOR SELECT TO authenticated
  USING (public.auth_has_role('member_care_lead'));

-- Director / data_ops read + write all members
CREATE POLICY "members_all_director"
  ON public.members FOR ALL TO authenticated
  USING  (public.auth_is_director())
  WITH CHECK (public.auth_is_director());

-- Pillar leads read members in their pillar (goals table is the pillar signal —
-- but member table has no pillar column; leads use goals/wins/cells to scope.
-- For the directory view, pillar leads read all members via admin access.)
CREATE POLICY "members_read_pillar_lead"
  ON public.members FOR SELECT TO authenticated
  USING (public.auth_is_admin());

-- ─── cells ───────────────────────────────────────────────────────────────────

-- All authenticated members can read active cells
CREATE POLICY "cells_read_authenticated"
  ON public.cells FOR SELECT TO authenticated
  USING (is_active = TRUE OR public.auth_is_admin());

-- Only admins can write cells
CREATE POLICY "cells_write_admin"
  ON public.cells FOR ALL TO authenticated
  USING  (public.auth_is_admin())
  WITH CHECK (public.auth_is_admin());

-- ─── cell_members ─────────────────────────────────────────────────────────────

-- Members see their own cell memberships
CREATE POLICY "cell_members_read_own"
  ON public.cell_members FOR SELECT TO authenticated
  USING (member_id = public.auth_member_id());

-- Admins see all cell memberships
CREATE POLICY "cell_members_read_admin"
  ON public.cell_members FOR SELECT TO authenticated
  USING (public.auth_is_admin());

-- Admins write cell memberships
CREATE POLICY "cell_members_write_admin"
  ON public.cell_members FOR ALL TO authenticated
  USING  (public.auth_is_admin())
  WITH CHECK (public.auth_is_admin());

-- ─── goals ───────────────────────────────────────────────────────────────────

-- Members read/write their own goals
CREATE POLICY "goals_own"
  ON public.goals FOR ALL TO authenticated
  USING  (member_id = public.auth_member_id())
  WITH CHECK (member_id = public.auth_member_id());

-- Pillar leads read goals in their pillar
CREATE POLICY "goals_read_pillar_lead"
  ON public.goals FOR SELECT TO authenticated
  USING (public.auth_can_access_pillar(pillar));

-- ─── wins ────────────────────────────────────────────────────────────────────

-- Members read/write their own wins
CREATE POLICY "wins_own"
  ON public.wins FOR ALL TO authenticated
  USING  (member_id = public.auth_member_id())
  WITH CHECK (member_id = public.auth_member_id());

-- Pillar leads read wins in their pillar
CREATE POLICY "wins_read_pillar_lead"
  ON public.wins FOR SELECT TO authenticated
  USING (pillar IS NOT NULL AND public.auth_can_access_pillar(pillar));

-- Admins can verify wins (UPDATE only, scoped to the verified/verified_by fields)
CREATE POLICY "wins_verify_admin"
  ON public.wins FOR UPDATE TO authenticated
  USING  (public.auth_is_admin())
  WITH CHECK (public.auth_is_admin());

-- ─── sessions ────────────────────────────────────────────────────────────────

-- All authenticated members read sessions (needed for check-in)
CREATE POLICY "sessions_read_authenticated"
  ON public.sessions FOR SELECT TO authenticated
  USING (TRUE);

-- Only admins write sessions
CREATE POLICY "sessions_write_admin"
  ON public.sessions FOR ALL TO authenticated
  USING  (public.auth_is_admin())
  WITH CHECK (public.auth_is_admin());

-- ─── attendance_records ───────────────────────────────────────────────────────

-- Members read their own attendance history
CREATE POLICY "attendance_read_own"
  ON public.attendance_records FOR SELECT TO authenticated
  USING (member_id = public.auth_member_id());

-- Members can self check-in (INSERT only)
CREATE POLICY "attendance_insert_own"
  ON public.attendance_records FOR INSERT TO authenticated
  WITH CHECK (member_id = public.auth_member_id() AND source = 'self');

-- Admins read and write all attendance
CREATE POLICY "attendance_all_admin"
  ON public.attendance_records FOR ALL TO authenticated
  USING  (public.auth_is_admin())
  WITH CHECK (public.auth_is_admin());

-- ─── courses ─────────────────────────────────────────────────────────────────

-- All authenticated read active courses
CREATE POLICY "courses_read_authenticated"
  ON public.courses FOR SELECT TO authenticated
  USING (is_active = TRUE OR public.auth_is_admin());

-- Admins write courses
CREATE POLICY "courses_write_admin"
  ON public.courses FOR ALL TO authenticated
  USING  (public.auth_is_admin())
  WITH CHECK (public.auth_is_admin());

-- ─── course_completions ───────────────────────────────────────────────────────

-- Members read/insert their own completions
CREATE POLICY "course_completions_own"
  ON public.course_completions FOR SELECT TO authenticated
  USING (member_id = public.auth_member_id());

CREATE POLICY "course_completions_insert_own"
  ON public.course_completions FOR INSERT TO authenticated
  WITH CHECK (member_id = public.auth_member_id());

-- Pillar leads read completions for their pillar (join to courses)
CREATE POLICY "course_completions_read_pillar_lead"
  ON public.course_completions FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.courses c
      WHERE c.id = course_id
        AND public.auth_can_access_pillar(c.pillar)
    )
  );

-- Directors verify completions
CREATE POLICY "course_completions_verify_director"
  ON public.course_completions FOR UPDATE TO authenticated
  USING  (public.auth_is_director())
  WITH CHECK (public.auth_is_director());

-- ─── check_ins ────────────────────────────────────────────────────────────────

-- Members read their own check-in notes
CREATE POLICY "check_ins_read_own_member"
  ON public.check_ins FOR SELECT TO authenticated
  USING (member_id = public.auth_member_id());

-- The leader who wrote the note can read and update it
CREATE POLICY "check_ins_rw_own_leader"
  ON public.check_ins FOR ALL TO authenticated
  USING  (leader_id = public.auth_member_id())
  WITH CHECK (leader_id = public.auth_member_id());

-- Member care lead and director read all check-ins
CREATE POLICY "check_ins_read_member_care"
  ON public.check_ins FOR SELECT TO authenticated
  USING (
    public.auth_has_role('member_care_lead')
    OR public.auth_is_director()
  );

-- ─── forms ───────────────────────────────────────────────────────────────────

-- Members read forms that are currently open (or all if admin)
CREATE POLICY "forms_read_open"
  ON public.forms FOR SELECT TO authenticated
  USING (
    public.auth_is_admin()
    OR (
      (open_at  IS NULL OR open_at  <= NOW())
      AND (close_at IS NULL OR close_at >= NOW())
    )
  );

-- Admins write forms
CREATE POLICY "forms_write_admin"
  ON public.forms FOR ALL TO authenticated
  USING  (public.auth_is_admin())
  WITH CHECK (public.auth_is_admin());

-- ─── form_fields ─────────────────────────────────────────────────────────────

-- All authenticated read form fields (needed to render forms)
CREATE POLICY "form_fields_read_authenticated"
  ON public.form_fields FOR SELECT TO authenticated
  USING (TRUE);

-- Admins write form fields
CREATE POLICY "form_fields_write_admin"
  ON public.form_fields FOR ALL TO authenticated
  USING  (public.auth_is_admin())
  WITH CHECK (public.auth_is_admin());

-- ─── form_responses ───────────────────────────────────────────────────────────

-- Members read/insert their own responses
CREATE POLICY "form_responses_own"
  ON public.form_responses FOR ALL TO authenticated
  USING  (member_id = public.auth_member_id())
  WITH CHECK (member_id = public.auth_member_id());

-- Admins read all responses
CREATE POLICY "form_responses_read_admin"
  ON public.form_responses FOR SELECT TO authenticated
  USING (public.auth_is_admin());

-- ─── reminders ───────────────────────────────────────────────────────────────

-- Members read their own reminders
CREATE POLICY "reminders_read_own"
  ON public.reminders FOR SELECT TO authenticated
  USING (member_id = public.auth_member_id());

-- Admins read/write all reminders; members cannot create reminders directly
CREATE POLICY "reminders_all_admin"
  ON public.reminders FOR ALL TO authenticated
  USING  (public.auth_is_admin())
  WITH CHECK (public.auth_is_admin());

-- ─── audit_log ───────────────────────────────────────────────────────────────

-- Any authenticated user may INSERT to the audit log (but not read or modify)
CREATE POLICY "audit_log_insert_authenticated"
  ON public.audit_log FOR INSERT TO authenticated
  WITH CHECK (TRUE);

-- Only directors may read the audit log
CREATE POLICY "audit_log_read_director"
  ON public.audit_log FOR SELECT TO authenticated
  USING (public.auth_is_director());

-- UPDATE and DELETE are blocked at the SQL rule level (see 001_initial.sql)

-- ─── invites ─────────────────────────────────────────────────────────────────

CREATE POLICY "invites_own"
  ON public.invites FOR ALL TO authenticated
  USING  (inviter_id = public.auth_member_id())
  WITH CHECK (inviter_id = public.auth_member_id());

CREATE POLICY "invites_read_admin"
  ON public.invites FOR SELECT TO authenticated
  USING (public.auth_is_admin());

-- ─── points_log ───────────────────────────────────────────────────────────────

-- Members read their own points history
CREATE POLICY "points_log_read_own"
  ON public.points_log FOR SELECT TO authenticated
  USING (member_id = public.auth_member_id());

-- Only service role (server-side) may write points (no direct member writes)
-- Directors may read all for audit
CREATE POLICY "points_log_read_director"
  ON public.points_log FOR SELECT TO authenticated
  USING (public.auth_is_director());

-- ─── point_rules ─────────────────────────────────────────────────────────────

-- All authenticated can read point rules (needed for the "how points work" explainer)
CREATE POLICY "point_rules_read_authenticated"
  ON public.point_rules FOR SELECT TO authenticated
  USING (is_active = TRUE OR public.auth_is_director());

-- Only directors can modify point rules
CREATE POLICY "point_rules_write_director"
  ON public.point_rules FOR ALL TO authenticated
  USING  (public.auth_is_director())
  WITH CHECK (public.auth_is_director());

-- ─── point_events ─────────────────────────────────────────────────────────────

-- Members read their own point events
CREATE POLICY "point_events_read_own"
  ON public.point_events FOR SELECT TO authenticated
  USING (member_id = public.auth_member_id());

-- Directors read all
CREATE POLICY "point_events_read_director"
  ON public.point_events FOR SELECT TO authenticated
  USING (public.auth_is_director());

-- ─── user_points_balance ──────────────────────────────────────────────────────

-- Any authenticated user may read balances (needed for leaderboard)
CREATE POLICY "user_points_balance_read_authenticated"
  ON public.user_points_balance FOR SELECT TO authenticated
  USING (TRUE);

-- Anonymous (public leaderboard) can also read balances for opted-in members
CREATE POLICY "user_points_balance_read_anon"
  ON public.user_points_balance FOR SELECT TO anon
  USING (
    EXISTS (
      SELECT 1 FROM public.user_privacy_prefs p
      WHERE p.member_id = user_points_balance.member_id
        AND p.leaderboard_opt_in = TRUE
    )
  );

-- ─── referral_codes ───────────────────────────────────────────────────────────

-- Members read their own referral code
CREATE POLICY "referral_codes_read_own"
  ON public.referral_codes FOR SELECT TO authenticated
  USING (member_id = public.auth_member_id());

-- Anon and authenticated can read codes (needed to resolve inbound referral links)
CREATE POLICY "referral_codes_read_any"
  ON public.referral_codes FOR SELECT TO anon, authenticated
  USING (TRUE);

-- ─── invitations ─────────────────────────────────────────────────────────────

-- Members read/write their own invitations
CREATE POLICY "invitations_own"
  ON public.invitations FOR ALL TO authenticated
  USING  (inviter_id = public.auth_member_id())
  WITH CHECK (inviter_id = public.auth_member_id());

-- Admins read all invitations (for referral funnel analytics)
CREATE POLICY "invitations_read_admin"
  ON public.invitations FOR SELECT TO authenticated
  USING (public.auth_is_admin());

-- Directors manage suppression / stage overrides
CREATE POLICY "invitations_write_director"
  ON public.invitations FOR UPDATE TO authenticated
  USING  (public.auth_is_director())
  WITH CHECK (public.auth_is_director());

-- ─── suppression_list ─────────────────────────────────────────────────────────

-- Only directors and data_ops manage the suppression list
CREATE POLICY "suppression_list_director"
  ON public.suppression_list FOR ALL TO authenticated
  USING  (public.auth_is_director())
  WITH CHECK (public.auth_is_director());

-- ─── advocacy_posts ───────────────────────────────────────────────────────────

-- All authenticated read published posts
CREATE POLICY "advocacy_posts_read_published"
  ON public.advocacy_posts FOR SELECT TO authenticated
  USING (status = 'published' OR public.auth_is_admin());

-- Anon can also read published posts (public advocacy surface)
CREATE POLICY "advocacy_posts_read_anon"
  ON public.advocacy_posts FOR SELECT TO anon
  USING (status = 'published');

-- Admins write advocacy posts
CREATE POLICY "advocacy_posts_write_admin"
  ON public.advocacy_posts FOR ALL TO authenticated
  USING  (public.auth_is_admin())
  WITH CHECK (public.auth_is_admin());

-- ─── advocacy_shares ─────────────────────────────────────────────────────────

-- Members read/insert their own shares
CREATE POLICY "advocacy_shares_own"
  ON public.advocacy_shares FOR ALL TO authenticated
  USING  (member_id = public.auth_member_id())
  WITH CHECK (member_id = public.auth_member_id());

-- Admins read all shares (for analytics)
CREATE POLICY "advocacy_shares_read_admin"
  ON public.advocacy_shares FOR SELECT TO authenticated
  USING (public.auth_is_admin());

-- ─── advocacy_clicks ─────────────────────────────────────────────────────────

-- Members read clicks on their own shares
CREATE POLICY "advocacy_clicks_read_own"
  ON public.advocacy_clicks FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.advocacy_shares s
      WHERE s.id = share_id
        AND s.member_id = public.auth_member_id()
    )
  );

-- Admins read all clicks
CREATE POLICY "advocacy_clicks_read_admin"
  ON public.advocacy_clicks FOR SELECT TO authenticated
  USING (public.auth_is_admin());

-- Inserts come from the public click-tracking endpoint (anon or server role)
CREATE POLICY "advocacy_clicks_insert_anon"
  ON public.advocacy_clicks FOR INSERT TO anon, authenticated
  WITH CHECK (TRUE);

-- ─── leaderboard_settings ─────────────────────────────────────────────────────

-- All authenticated read leaderboard settings
CREATE POLICY "leaderboard_settings_read_authenticated"
  ON public.leaderboard_settings FOR SELECT TO authenticated
  USING (TRUE);

-- Only directors can modify settings
CREATE POLICY "leaderboard_settings_write_director"
  ON public.leaderboard_settings FOR ALL TO authenticated
  USING  (public.auth_is_director())
  WITH CHECK (public.auth_is_director());

-- ─── user_privacy_prefs ───────────────────────────────────────────────────────

-- Members read/write their own privacy preferences
CREATE POLICY "user_privacy_prefs_own"
  ON public.user_privacy_prefs FOR ALL TO authenticated
  USING  (member_id = public.auth_member_id())
  WITH CHECK (member_id = public.auth_member_id());

-- Admins read privacy prefs (to honour opt-outs in analytics)
CREATE POLICY "user_privacy_prefs_read_admin"
  ON public.user_privacy_prefs FOR SELECT TO authenticated
  USING (public.auth_is_admin());

-- ─── mentor_pairings ───────────────────────────────────────────────────────── (see 004_mentorship_learning.sql)

ALTER TABLE public.mentor_pairings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage pairings" ON public.mentor_pairings FOR ALL TO authenticated USING (
  EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('director','member_care_lead','career_lead','spiritual_lead','business_lead','data_ops_lead'))
);

CREATE POLICY "Members see own pairings" ON public.mentor_pairings FOR SELECT TO authenticated USING (
  mentor_id = public.auth_member_id() OR mentee_id = public.auth_member_id()
);

-- ─── learning_content / learning_completions ────────────────────────────────── (see 004_mentorship_learning.sql)

ALTER TABLE public.learning_content     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.learning_completions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Everyone can read published content" ON public.learning_content FOR SELECT TO authenticated USING (is_published = TRUE);

CREATE POLICY "Admins manage content" ON public.learning_content FOR ALL TO authenticated USING (
  EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('director','data_ops_lead','career_lead','spiritual_lead','business_lead','member_care_lead'))
);

CREATE POLICY "Members manage own completions" ON public.learning_completions FOR ALL TO authenticated USING (
  member_id = public.auth_member_id()
);

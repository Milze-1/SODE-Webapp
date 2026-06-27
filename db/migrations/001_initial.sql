-- ============================================================================
-- 001_initial.sql — SODE Growth Platform
-- Run once on a fresh Supabase (PostgreSQL 15+) database.
-- Supabase already provides auth.users and the uuid-ossp / pgcrypto extensions.
-- ============================================================================

-- Extensions (Supabase enables these by default; listed for completeness)
CREATE EXTENSION IF NOT EXISTS "pg_trgm";  -- trigram search on member names

-- ─── Enum types ──────────────────────────────────────────────────────────────

CREATE TYPE public.role AS ENUM (
  'director',
  'spiritual_lead',
  'career_lead',
  'business_lead',
  'member_care_lead',
  'data_ops_lead',
  'member'
);

CREATE TYPE public.pillar AS ENUM (
  'spiritual',
  'career',
  'business',
  'character'
);

CREATE TYPE public.goal_status AS ENUM (
  'ontrack',
  'atrisk',
  'behind',
  'done'
);

CREATE TYPE public.life_stage AS ENUM (
  'student',
  'professional',
  'entrepreneur',
  'between_roles'
);

-- ─── Auth & profiles ─────────────────────────────────────────────────────────

CREATE TABLE public.profiles (
  id            UUID        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name  TEXT,
  avatar_url    TEXT,
  bio           TEXT,
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.profiles IS
  'Public profile row that mirrors auth.users. id = auth.users.id.';

-- Auto-create a profiles row whenever a new auth user is created
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id) VALUES (NEW.id);
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ─── User roles ───────────────────────────────────────────────────────────────

CREATE TABLE public.user_roles (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID        NOT NULL,   -- auth.users.id
  role        public.role NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, role)
);

COMMENT ON TABLE public.user_roles IS
  'Roles assigned to Supabase auth users. user_id = auth.users.id.';

-- ─── Members ─────────────────────────────────────────────────────────────────

CREATE TABLE public.members (
  id                    UUID              PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_id               UUID              UNIQUE REFERENCES auth.users(id) ON DELETE SET NULL,
  name                  TEXT              NOT NULL,
  email                 VARCHAR(255)      UNIQUE,
  whatsapp              VARCHAR(30),
  life_stage            public.life_stage,
  department            TEXT,
  has_business          BOOLEAN           NOT NULL DEFAULT FALSE,
  is_leader             BOOLEAN           NOT NULL DEFAULT FALSE,
  points                INTEGER           NOT NULL DEFAULT 0,
  consent_data          BOOLEAN           NOT NULL DEFAULT FALSE,
  consent_contact       BOOLEAN           NOT NULL DEFAULT FALSE,
  leaderboard_opt_in    BOOLEAN           NOT NULL DEFAULT TRUE,
  leaderboard_name      TEXT,
  onboarding_complete   BOOLEAN           NOT NULL DEFAULT FALSE,
  created_at            TIMESTAMPTZ       NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ       NOT NULL DEFAULT NOW()
);

COMMENT ON COLUMN public.members.auth_id IS
  'Links to auth.users.id. Null until the member completes onboarding.';

-- ─── Community: Cells ────────────────────────────────────────────────────────

CREATE TABLE public.cells (
  id                UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  name              TEXT          NOT NULL,
  pillar            public.pillar,
  leader_id         UUID          REFERENCES public.members(id) ON DELETE SET NULL,
  description       TEXT,
  meeting_schedule  TEXT,
  is_active         BOOLEAN       NOT NULL DEFAULT TRUE,
  created_at        TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE TABLE public.cell_members (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  cell_id     UUID        NOT NULL REFERENCES public.cells(id)   ON DELETE CASCADE,
  member_id   UUID        NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  role        TEXT        NOT NULL DEFAULT 'member',  -- 'leader' | 'member'
  joined_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (cell_id, member_id)
);

-- ─── Goals ───────────────────────────────────────────────────────────────────

CREATE TABLE public.goals (
  id          UUID               PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id   UUID               NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  pillar      public.pillar      NOT NULL,
  title       TEXT               NOT NULL,
  current     INTEGER            NOT NULL DEFAULT 0,
  target      INTEGER            NOT NULL,
  unit        TEXT               NOT NULL,
  due_date    DATE,
  status      public.goal_status NOT NULL DEFAULT 'ontrack',
  notes       TEXT,
  is_template BOOLEAN            NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ        NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ        NOT NULL DEFAULT NOW()
);

-- ─── Wins ────────────────────────────────────────────────────────────────────

CREATE TABLE public.wins (
  id            UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id     UUID          NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  pillar        public.pillar,
  win_type      TEXT          NOT NULL,
  description   TEXT          NOT NULL,
  media_url     TEXT,
  link_url      TEXT,
  verified      BOOLEAN       NOT NULL DEFAULT FALSE,
  verified_by   UUID          REFERENCES public.members(id) ON DELETE SET NULL,
  points_earned INTEGER       NOT NULL DEFAULT 5,
  created_at    TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

-- ─── Sessions & Attendance ───────────────────────────────────────────────────

CREATE TABLE public.sessions (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  title               TEXT        NOT NULL,
  type                TEXT        NOT NULL,   -- 'service'|'sode_session'|'retreat'|'workshop'
  location            TEXT,
  scheduled_at        TIMESTAMPTZ NOT NULL,
  check_in_opens_at   TIMESTAMPTZ,
  check_in_closes_at  TIMESTAMPTZ,
  check_in_code       TEXT        UNIQUE,     -- QR / manual code
  expected_count      INTEGER,
  sheets_row_ref      TEXT,                   -- Google Sheets sync reconciliation key
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE public.attendance_records (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id    UUID        NOT NULL REFERENCES public.sessions(id)  ON DELETE CASCADE,
  member_id     UUID        NOT NULL REFERENCES public.members(id)   ON DELETE CASCADE,
  status        TEXT        NOT NULL DEFAULT 'present',  -- 'present'|'excused'|'absent'
  source        TEXT        NOT NULL DEFAULT 'self',     -- 'self'|'leader'|'sheet'
  checked_in_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (session_id, member_id)
);

-- ─── Learning: Courses ───────────────────────────────────────────────────────

CREATE TABLE public.courses (
  id              UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  title           TEXT          NOT NULL,
  pillar          public.pillar,
  provider        TEXT,
  description     TEXT,
  estimated_hours INTEGER,
  course_url      TEXT,
  is_active       BOOLEAN       NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE TABLE public.course_completions (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id       UUID        NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  course_id       UUID        NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  completed_at    TIMESTAMPTZ,
  certificate_url TEXT,
  verified        BOOLEAN     NOT NULL DEFAULT FALSE,
  verified_by     UUID        REFERENCES public.members(id) ON DELETE SET NULL,
  points_earned   INTEGER     NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (member_id, course_id)
);

-- ─── Check-ins (1:1 leader notes) ────────────────────────────────────────────

CREATE TABLE public.check_ins (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id           UUID        NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  leader_id           UUID        NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  notes               TEXT,
  follow_up_action    TEXT,
  follow_up_due_date  DATE,
  follow_up_done      BOOLEAN     NOT NULL DEFAULT FALSE,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Forms ───────────────────────────────────────────────────────────────────

CREATE TABLE public.forms (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  title             TEXT        NOT NULL,
  description       TEXT,
  estimated_seconds INTEGER,
  audience          TEXT        NOT NULL DEFAULT 'all',  -- 'all'|pillar|'leaders'
  open_at           TIMESTAMPTZ,
  close_at          TIMESTAMPTZ,
  is_wins_form      BOOLEAN     NOT NULL DEFAULT FALSE,
  is_pulse          BOOLEAN     NOT NULL DEFAULT FALSE,
  created_by        UUID        REFERENCES public.members(id) ON DELETE SET NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE public.form_fields (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  form_id     UUID        NOT NULL REFERENCES public.forms(id) ON DELETE CASCADE,
  field_key   TEXT        NOT NULL,
  label       TEXT        NOT NULL,
  field_type  TEXT        NOT NULL,
  -- For select/multiselect: [{"value":"x","label":"X"}]
  options     JSONB,
  required    BOOLEAN     NOT NULL DEFAULT FALSE,
  sort_order  INTEGER     NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (form_id, field_key)
);

CREATE TABLE public.form_responses (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  form_id       UUID        NOT NULL REFERENCES public.forms(id)   ON DELETE CASCADE,
  member_id     UUID        NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  data          JSONB       NOT NULL DEFAULT '{}',
  submitted_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (form_id, member_id)
);

-- ─── Reminders ───────────────────────────────────────────────────────────────

CREATE TABLE public.reminders (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id     UUID        NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  type          TEXT        NOT NULL,  -- 'goal_update'|'attendance'|'form_open'|'custom'
  message       TEXT        NOT NULL,
  scheduled_at  TIMESTAMPTZ NOT NULL,
  sent_at       TIMESTAMPTZ,
  channel       TEXT        NOT NULL DEFAULT 'email',  -- 'email'|'whatsapp'|'push'
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Audit log (append-only) ─────────────────────────────────────────────────

CREATE TABLE public.audit_log (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id      UUID,                -- auth.users.id; NULL = system/trigger
  action        TEXT        NOT NULL, -- e.g. 'member.update' | 'role.assign' | 'win.verify'
  target_table  TEXT,
  target_id     UUID,
  payload       JSONB,               -- { before: {}, after: {} } diff
  ip            TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Prevent modifications to audit rows
CREATE RULE audit_no_update AS ON UPDATE TO public.audit_log DO INSTEAD NOTHING;
CREATE RULE audit_no_delete AS ON DELETE TO public.audit_log DO INSTEAD NOTHING;

-- ─── Invites (simple — pre-growth-layer record) ───────────────────────────────

CREATE TABLE public.invites (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  inviter_id          UUID        NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  name                TEXT,
  contact             TEXT        NOT NULL,
  stage               TEXT        NOT NULL DEFAULT 'sent',
  points_earned       INTEGER     NOT NULL DEFAULT 0,
  invited_member_id   UUID        REFERENCES public.members(id) ON DELETE SET NULL,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Points log (simple ledger) ──────────────────────────────────────────────

CREATE TABLE public.points_log (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id   UUID        NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  rule_key    TEXT        NOT NULL,
  points      INTEGER     NOT NULL,
  ref_id      UUID,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Growth layer: Point rules engine ────────────────────────────────────────

CREATE TABLE public.point_rules (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_key              TEXT        NOT NULL UNIQUE,
  label                 TEXT        NOT NULL,
  description           TEXT,
  points                INTEGER     NOT NULL,
  cap                   INTEGER,            -- max awards per cap_period; NULL = unlimited
  cap_period            TEXT,               -- 'day'|'week'|'month'|'cycle'
  requires_verification BOOLEAN     NOT NULL DEFAULT FALSE,
  is_active             BOOLEAN     NOT NULL DEFAULT TRUE,
  updated_by            UUID,               -- auth.users.id
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE public.point_events (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id   UUID        NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  rule_key    TEXT        NOT NULL,
  points      INTEGER     NOT NULL,
  ref_table   TEXT,       -- source table name
  ref_id      UUID,       -- source record id
  note        TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Denormalized balance cache; recomputed from point_events nightly
CREATE TABLE public.user_points_balance (
  member_id          UUID        PRIMARY KEY REFERENCES public.members(id) ON DELETE CASCADE,
  total_points       INTEGER     NOT NULL DEFAULT 0,
  this_month_points  INTEGER     NOT NULL DEFAULT 0,
  last_recalc_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Growth layer: Referrals & invitations ────────────────────────────────────

CREATE TABLE public.referral_codes (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id   UUID        NOT NULL UNIQUE REFERENCES public.members(id) ON DELETE CASCADE,
  code        TEXT        NOT NULL UNIQUE,
  clicks      INTEGER     NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE public.invitations (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  inviter_id          UUID        NOT NULL REFERENCES public.members(id)      ON DELETE CASCADE,
  referral_code_id    UUID        REFERENCES public.referral_codes(id)        ON DELETE SET NULL,
  name                TEXT,
  email               TEXT,
  phone               TEXT,
  -- 'sent'|'opened'|'joined'|'attended'|'active'
  stage               TEXT        NOT NULL DEFAULT 'sent',
  stage_updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  invited_member_id   UUID        REFERENCES public.members(id)               ON DELETE SET NULL,
  suppressed_at       TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE public.suppression_list (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  contact     TEXT        NOT NULL UNIQUE,   -- normalised email or phone
  reason      TEXT,                           -- 'opted_out'|'bounced'|'complaint'
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Growth layer: Advocacy ───────────────────────────────────────────────────

CREATE TABLE public.advocacy_posts (
  id                UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  title             TEXT          NOT NULL,
  caption           TEXT          NOT NULL,
  caption_variants  JSONB,        -- { "instagram": "...", "linkedin": "..." }
  media_url         TEXT,
  canonical_link    TEXT,
  hashtags          JSONB,        -- ["#SODE","#Daniels"]
  pillar            public.pillar,
  target_platforms  JSONB,        -- ["instagram","whatsapp","linkedin","x","facebook"]
  -- 'draft'|'scheduled'|'published'|'archived'
  status            TEXT          NOT NULL DEFAULT 'draft',
  scheduled_at      TIMESTAMPTZ,
  published_at      TIMESTAMPTZ,
  created_by        UUID          REFERENCES public.members(id) ON DELETE SET NULL,
  created_at        TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE TABLE public.advocacy_shares (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id     UUID        NOT NULL REFERENCES public.members(id)       ON DELETE CASCADE,
  post_id       UUID        NOT NULL REFERENCES public.advocacy_posts(id) ON DELETE CASCADE,
  platform      TEXT        NOT NULL,
  tracked_url   TEXT,
  shared_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  points_earned INTEGER     NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE public.advocacy_clicks (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  share_id    UUID        NOT NULL REFERENCES public.advocacy_shares(id) ON DELETE CASCADE,
  clicked_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  referrer    TEXT,
  user_agent  TEXT
);

-- ─── Leaderboard ─────────────────────────────────────────────────────────────

CREATE TABLE public.leaderboard_settings (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  -- 'members_only'|'public_link'|'public_indexed'
  visibility          TEXT        NOT NULL DEFAULT 'members_only',
  default_season      TEXT        NOT NULL DEFAULT 'month',  -- 'month'|'cycle'|'alltime'
  show_avatars        BOOLEAN     NOT NULL DEFAULT TRUE,
  enabled_categories  JSONB       NOT NULL DEFAULT '["overall","inviters","advocates","goal_getters"]',
  updated_by          UUID,       -- auth.users.id
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE public.user_privacy_prefs (
  member_id               UUID        PRIMARY KEY REFERENCES public.members(id) ON DELETE CASCADE,
  leaderboard_opt_in      BOOLEAN     NOT NULL DEFAULT TRUE,
  -- 'full'|'first_initial'|'alias'
  display_name_mode       TEXT        NOT NULL DEFAULT 'full',
  alias                   TEXT,
  public_profile_enabled  BOOLEAN     NOT NULL DEFAULT FALSE,
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Indexes ─────────────────────────────────────────────────────────────────

-- Members
CREATE INDEX idx_members_auth_id          ON public.members(auth_id);
CREATE INDEX idx_members_email            ON public.members(email);
CREATE INDEX idx_members_name_trgm        ON public.members USING gin(name gin_trgm_ops);

-- User roles
CREATE INDEX idx_user_roles_user_id       ON public.user_roles(user_id);
CREATE INDEX idx_user_roles_role          ON public.user_roles(role);

-- Goals
CREATE INDEX idx_goals_member_id          ON public.goals(member_id);
CREATE INDEX idx_goals_pillar             ON public.goals(pillar);
CREATE INDEX idx_goals_status             ON public.goals(status);

-- Wins
CREATE INDEX idx_wins_member_id           ON public.wins(member_id);
CREATE INDEX idx_wins_pillar              ON public.wins(pillar);
CREATE INDEX idx_wins_created_at          ON public.wins(created_at DESC);

-- Sessions & Attendance
CREATE INDEX idx_sessions_scheduled_at    ON public.sessions(scheduled_at DESC);
CREATE INDEX idx_attendance_session_id    ON public.attendance_records(session_id);
CREATE INDEX idx_attendance_member_id     ON public.attendance_records(member_id);

-- Cells
CREATE INDEX idx_cell_members_member_id   ON public.cell_members(member_id);
CREATE INDEX idx_cell_members_cell_id     ON public.cell_members(cell_id);

-- Courses
CREATE INDEX idx_course_completions_member ON public.course_completions(member_id);
CREATE INDEX idx_course_completions_course ON public.course_completions(course_id);

-- Check-ins
CREATE INDEX idx_check_ins_member_id      ON public.check_ins(member_id);
CREATE INDEX idx_check_ins_leader_id      ON public.check_ins(leader_id);

-- Forms
CREATE INDEX idx_form_fields_form_id      ON public.form_fields(form_id, sort_order);
CREATE INDEX idx_form_responses_form_id   ON public.form_responses(form_id);
CREATE INDEX idx_form_responses_member_id ON public.form_responses(member_id);

-- Reminders
CREATE INDEX idx_reminders_member_id      ON public.reminders(member_id);
CREATE INDEX idx_reminders_scheduled_at   ON public.reminders(scheduled_at)
  WHERE sent_at IS NULL;

-- Audit log
CREATE INDEX idx_audit_log_actor_id       ON public.audit_log(actor_id);
CREATE INDEX idx_audit_log_target         ON public.audit_log(target_table, target_id);
CREATE INDEX idx_audit_log_created_at     ON public.audit_log(created_at DESC);

-- Points
CREATE INDEX idx_point_events_member_id   ON public.point_events(member_id);
CREATE INDEX idx_point_events_rule_key    ON public.point_events(rule_key);
CREATE INDEX idx_point_events_created_at  ON public.point_events(created_at DESC);

-- Invitations
CREATE INDEX idx_invitations_inviter_id   ON public.invitations(inviter_id);
CREATE INDEX idx_invitations_stage        ON public.invitations(stage);
CREATE INDEX idx_invitations_email        ON public.invitations(email) WHERE email IS NOT NULL;

-- Advocacy
CREATE INDEX idx_advocacy_posts_status    ON public.advocacy_posts(status, published_at DESC);
CREATE INDEX idx_advocacy_shares_member   ON public.advocacy_shares(member_id);
CREATE INDEX idx_advocacy_shares_post     ON public.advocacy_shares(post_id);
CREATE INDEX idx_advocacy_clicks_share    ON public.advocacy_clicks(share_id);
CREATE INDEX idx_advocacy_clicks_at       ON public.advocacy_clicks(clicked_at DESC);

// Drizzle ORM schema — SODE Growth Platform
// This file is the source of truth for all table shapes and types.
// Run `drizzle-kit generate` to create migration files in /db/migrations.

import {
  pgTable,
  text,
  uuid,
  timestamp,
  integer,
  boolean,
  varchar,
  pgEnum,
  jsonb,
  date,
} from "drizzle-orm/pg-core";

// ─── Enums ────────────────────────────────────────────────────────────────────

export const roleEnum = pgEnum("role", [
  "super_admin",
  "director",
  "spiritual_lead",
  "career_lead",
  "business_lead",
  "member_care_lead",
  "data_ops_lead",
  "business_dev",
  "external_mentor",
  "member",
]);

export const pillarEnum = pgEnum("pillar", [
  "spiritual",
  "career",
  "business",
  "character",
]);

export const goalStatusEnum = pgEnum("goal_status", [
  "ontrack",
  "atrisk",
  "behind",
  "done",
]);

export const lifeStageEnum = pgEnum("life_stage", [
  "student",
  "professional",
  "entrepreneur",
  "between_roles",
  "employed",
  "other",
]);

// ─── Auth & profiles ──────────────────────────────────────────────────────────

// Public profile row mirroring auth.users; id = auth.users.id
export const profiles = pgTable("profiles", {
  id:          uuid("id").primaryKey(),          // = auth.users.id
  displayName: text("display_name"),
  avatarUrl:   text("avatar_url"),
  bio:         text("bio"),
  updatedAt:   timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

// User roles — keyed on auth.users.id so they resolve before a members row exists
export const userRoles = pgTable("user_roles", {
  id:        uuid("id").primaryKey().defaultRandom(),
  userId:    uuid("user_id").notNull(),          // auth.users.id
  role:      roleEnum("role").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

// ─── Members (SODE-specific member data) ──────────────────────────────────────

export const members = pgTable("members", {
  id:                 uuid("id").primaryKey().defaultRandom(),
  authId:             uuid("auth_id").unique(),  // auth.users.id
  name:               text("name").notNull(),
  email:              varchar("email", { length: 255 }).unique(),
  whatsapp:           varchar("whatsapp", { length: 30 }),
  lifeStage:          lifeStageEnum("life_stage"),
  department:         text("department"),
  hasBusiness:        boolean("has_business").default(false),
  isLeader:           boolean("is_leader").default(false),
  pillar:             pillarEnum("pillar"),
  points:             integer("points").notNull().default(0),
  consentData:        boolean("consent_data").notNull().default(false),
  consentContact:     boolean("consent_contact").default(false),
  leaderboardOptIn:   boolean("leaderboard_opt_in").default(true),
  leaderboardName:    text("leaderboard_name"),
  onboardingComplete: boolean("onboarding_complete").notNull().default(false),
  isMentor:           boolean("is_mentor").notNull().default(false),
  mentorCapacity:     integer("mentor_capacity").default(3),
  createdAt:          timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt:          timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

// ─── Community: Cells ─────────────────────────────────────────────────────────

export const cells = pgTable("cells", {
  id:              uuid("id").primaryKey().defaultRandom(),
  name:            text("name").notNull(),
  pillar:          pillarEnum("pillar"),
  leaderId:        uuid("leader_id").references(() => members.id, { onDelete: "set null" }),
  description:     text("description"),
  meetingSchedule: text("meeting_schedule"),
  isActive:        boolean("is_active").notNull().default(true),
  createdAt:       timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt:       timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

export const cellMembers = pgTable("cell_members", {
  id:       uuid("id").primaryKey().defaultRandom(),
  cellId:   uuid("cell_id").notNull().references(() => cells.id, { onDelete: "cascade" }),
  memberId: uuid("member_id").notNull().references(() => members.id, { onDelete: "cascade" }),
  role:     text("role").notNull().default("member"),  // 'leader' | 'member'
  joinedAt: timestamp("joined_at", { withTimezone: true }).defaultNow(),
});

// ─── Goals ────────────────────────────────────────────────────────────────────

export const goals = pgTable("goals", {
  id:         uuid("id").primaryKey().defaultRandom(),
  memberId:   uuid("member_id").notNull().references(() => members.id, { onDelete: "cascade" }),
  pillar:     pillarEnum("pillar").notNull(),
  title:      text("title").notNull(),
  current:    integer("current").notNull().default(0),
  target:     integer("target").notNull(),
  unit:       text("unit").notNull(),
  dueDate:    date("due_date"),
  status:     goalStatusEnum("status").notNull().default("ontrack"),
  notes:      text("notes"),
  isTemplate: boolean("is_template").notNull().default(false),
  createdAt:  timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt:  timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

// ─── Wins ─────────────────────────────────────────────────────────────────────

export const wins = pgTable("wins", {
  id:           uuid("id").primaryKey().defaultRandom(),
  memberId:     uuid("member_id").notNull().references(() => members.id, { onDelete: "cascade" }),
  pillar:       pillarEnum("pillar"),
  winType:      text("win_type").notNull(),
  description:  text("description").notNull(),
  mediaUrl:     text("media_url"),
  linkUrl:      text("link_url"),
  verified:     boolean("verified").notNull().default(false),
  verifiedBy:   uuid("verified_by").references(() => members.id, { onDelete: "set null" }),
  pointsEarned: integer("points_earned").notNull().default(5),
  createdAt:    timestamp("created_at", { withTimezone: true }).defaultNow(),
});

// ─── Sessions & Attendance ────────────────────────────────────────────────────

export const sessions = pgTable("sessions", {
  id:               uuid("id").primaryKey().defaultRandom(),
  title:            text("title").notNull(),
  type:             text("type").notNull(),       // 'service'|'sode_session'|'retreat'|'workshop'
  location:         text("location"),
  scheduledAt:      timestamp("scheduled_at", { withTimezone: true }).notNull(),
  checkInOpensAt:   timestamp("check_in_opens_at", { withTimezone: true }),
  checkInClosesAt:  timestamp("check_in_closes_at", { withTimezone: true }),
  checkInCode:      text("check_in_code"),        // unique per session, used for QR/code check-in
  expectedCount:    integer("expected_count"),
  sheetsRowRef:     text("sheets_row_ref"),       // Google Sheets sync reference
  isLive:           boolean("is_live").notNull().default(false),
  pillar:           pillarEnum("pillar"),
  createdAt:        timestamp("created_at", { withTimezone: true }).defaultNow(),
});

export const attendanceRecords = pgTable("attendance_records", {
  id:          uuid("id").primaryKey().defaultRandom(),
  sessionId:   uuid("session_id").notNull().references(() => sessions.id, { onDelete: "cascade" }),
  memberId:    uuid("member_id").notNull().references(() => members.id, { onDelete: "cascade" }),
  status:      text("status").notNull().default("present"),  // 'present'|'excused'|'absent'
  source:      text("source").notNull().default("self"),     // 'self'|'leader'|'qr'|'sheet'
  checkedInAt: timestamp("checked_in_at", { withTimezone: true }).defaultNow(),
  deviceHint:  text("device_hint"),               // 'mobile'|'desktop'
});

// ─── Learning: Courses ────────────────────────────────────────────────────────

export const courses = pgTable("courses", {
  id:             uuid("id").primaryKey().defaultRandom(),
  title:          text("title").notNull(),
  pillar:         pillarEnum("pillar"),
  provider:       text("provider"),
  description:    text("description"),
  estimatedHours: integer("estimated_hours"),
  courseUrl:      text("course_url"),
  isActive:       boolean("is_active").notNull().default(true),
  createdAt:      timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt:      timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

export const courseCompletions = pgTable("course_completions", {
  id:             uuid("id").primaryKey().defaultRandom(),
  memberId:       uuid("member_id").notNull().references(() => members.id, { onDelete: "cascade" }),
  courseId:       uuid("course_id").notNull().references(() => courses.id, { onDelete: "cascade" }),
  completedAt:    timestamp("completed_at", { withTimezone: true }),
  certificateUrl: text("certificate_url"),
  verified:       boolean("verified").notNull().default(false),
  verifiedBy:     uuid("verified_by").references(() => members.id, { onDelete: "set null" }),
  pointsEarned:   integer("points_earned").notNull().default(0),
  createdAt:      timestamp("created_at", { withTimezone: true }).defaultNow(),
});

// ─── Check-ins (1:1 leader notes) ────────────────────────────────────────────

export const checkIns = pgTable("check_ins", {
  id:               uuid("id").primaryKey().defaultRandom(),
  memberId:         uuid("member_id").notNull().references(() => members.id, { onDelete: "cascade" }),
  leaderId:         uuid("leader_id").notNull().references(() => members.id, { onDelete: "cascade" }),
  notes:            text("notes"),
  followUpAction:   text("follow_up_action"),
  followUpDueDate:  date("follow_up_due_date"),
  followUpDone:     boolean("follow_up_done").notNull().default(false),
  createdAt:        timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt:        timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

// ─── Forms (dynamic form builder) ────────────────────────────────────────────

export const forms = pgTable("forms", {
  id:               uuid("id").primaryKey().defaultRandom(),
  title:            text("title").notNull(),
  description:      text("description"),
  estimatedSeconds: integer("estimated_seconds"),
  audience:         text("audience").notNull().default("all"),  // 'all'|pillar key|'leaders'
  isActive:         boolean("is_active").notNull().default(false),
  formAudience:     jsonb("form_audience").notNull().default({ type: "everyone" }),
  openAt:           timestamp("open_at", { withTimezone: true }),
  closeAt:          timestamp("close_at", { withTimezone: true }),
  isWinsForm:       boolean("is_wins_form").notNull().default(false),
  isPulse:          boolean("is_pulse").notNull().default(false),
  createdBy:        uuid("created_by").references(() => members.id, { onDelete: "set null" }),
  createdAt:        timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt:        timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

export const formFields = pgTable("form_fields", {
  id:        uuid("id").primaryKey().defaultRandom(),
  formId:    uuid("form_id").notNull().references(() => forms.id, { onDelete: "cascade" }),
  fieldKey:  text("field_key").notNull(),
  label:     text("label").notNull(),
  // 'text'|'textarea'|'number'|'select'|'multiselect'|'nps'|'date'|'file'|'pillar'|'member'
  fieldType: text("field_type").notNull(),
  options:   jsonb("options"),                   // [{ value, label }] for select fields
  required:  boolean("required").notNull().default(false),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

export const formResponses = pgTable("form_responses", {
  id:          uuid("id").primaryKey().defaultRandom(),
  formId:      uuid("form_id").notNull().references(() => forms.id, { onDelete: "cascade" }),
  memberId:    uuid("member_id").notNull().references(() => members.id, { onDelete: "cascade" }),
  data:        jsonb("data").notNull().default({}),
  submittedAt: timestamp("submitted_at", { withTimezone: true }).defaultNow(),
  createdAt:   timestamp("created_at", { withTimezone: true }).defaultNow(),
});

// ─── Mentorship ───────────────────────────────────────────────────────────────

export const mentorPairings = pgTable("mentor_pairings", {
  id:        uuid("id").primaryKey().defaultRandom(),
  mentorId:  uuid("mentor_id").references(() => members.id),
  menteeId:  uuid("mentee_id").references(() => members.id),
  status:    text("status").default("active"),  // 'active'|'paused'|'completed'
  pillar:    text("pillar"),
  matchedBy: uuid("matched_by"),                 // auth.users.id
  matchedAt: timestamp("matched_at", { withTimezone: true }).defaultNow(),
  notes:     text("notes"),
});

// ─── Learning content library ──────────────────────────────────────────────────

export const learningContent = pgTable("learning_content", {
  id:                uuid("id").primaryKey().defaultRandom(),
  title:             text("title").notNull(),
  // 'book'|'article'|'podcast'|'video'|'course'|'devotional'|'other'
  contentType:       text("content_type").notNull(),
  description:       text("description"),
  author:            text("author"),
  url:               text("url"),
  thumbnailUrl:      text("thumbnail_url"),
  pillar:            text("pillar"),
  monthNumber:       integer("month_number"),    // 1-12, NULL = always
  isPublished:       boolean("is_published").default(false),
  estimatedMinutes:  integer("estimated_minutes"),
  tags:              text("tags").array(),
  createdBy:         uuid("created_by"),          // auth.users.id
  createdAt:         timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt:         timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

export const learningCompletions = pgTable("learning_completions", {
  id:          uuid("id").primaryKey().defaultRandom(),
  memberId:    uuid("member_id").references(() => members.id),
  contentId:   uuid("content_id").references(() => learningContent.id),
  completedAt: timestamp("completed_at", { withTimezone: true }).defaultNow(),
});

// ─── Reminders ────────────────────────────────────────────────────────────────

export const reminders = pgTable("reminders", {
  id:          uuid("id").primaryKey().defaultRandom(),
  memberId:    uuid("member_id").notNull().references(() => members.id, { onDelete: "cascade" }),
  type:        text("type").notNull(),    // 'goal_update'|'attendance'|'form_open'|'form_published'|'custom'
  referenceId: uuid("reference_id"),      // e.g. forms.id for type='form_published'
  message:     text("message").notNull(),
  scheduledAt: timestamp("scheduled_at", { withTimezone: true }).notNull(),
  sentAt:      timestamp("sent_at", { withTimezone: true }),
  channel:     text("channel").notNull().default("email"),  // 'email'|'whatsapp'|'push'
  createdAt:   timestamp("created_at", { withTimezone: true }).defaultNow(),
});

// ─── Audit log (immutable — no updates/deletes) ───────────────────────────────

export const auditLog = pgTable("audit_log", {
  id:          uuid("id").primaryKey().defaultRandom(),
  actorId:     uuid("actor_id"),          // auth.users.id; NULL = system action
  action:      text("action").notNull(),  // e.g. 'member.update' | 'role.assign'
  targetTable: text("target_table"),
  targetId:    uuid("target_id"),
  payload:     jsonb("payload"),          // before/after diff
  ip:          text("ip"),
  createdAt:   timestamp("created_at", { withTimezone: true }).defaultNow(),
});

// ─── Points engine (simple ledger — predates growth layer) ────────────────────

export const invites = pgTable("invites", {
  id:               uuid("id").primaryKey().defaultRandom(),
  inviterId:        uuid("inviter_id").notNull().references(() => members.id, { onDelete: "cascade" }),
  name:             text("name"),
  contact:          text("contact").notNull(),
  stage:            text("stage").notNull().default("sent"),
  pointsEarned:     integer("points_earned").notNull().default(0),
  invitedMemberId:  uuid("invited_member_id").references(() => members.id, { onDelete: "set null" }),
  createdAt:        timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt:        timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

export const pointsLog = pgTable("points_log", {
  id:        uuid("id").primaryKey().defaultRandom(),
  memberId:  uuid("member_id").notNull().references(() => members.id, { onDelete: "cascade" }),
  ruleKey:   text("rule_key").notNull(),
  points:    integer("points").notNull(),
  refId:     uuid("ref_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

// ─── Growth layer: Point rules engine ────────────────────────────────────────

export const pointRules = pgTable("point_rules", {
  id:                   uuid("id").primaryKey().defaultRandom(),
  ruleKey:              text("rule_key").notNull().unique(),
  label:                text("label").notNull(),
  description:          text("description"),
  points:               integer("points").notNull(),
  cap:                  integer("cap"),              // max awards per cap_period; NULL = unlimited
  capPeriod:            text("cap_period"),          // 'day'|'week'|'month'|'cycle'
  requiresVerification: boolean("requires_verification").notNull().default(false),
  isActive:             boolean("is_active").notNull().default(true),
  updatedBy:            uuid("updated_by"),          // auth.users.id
  updatedAt:            timestamp("updated_at", { withTimezone: true }).defaultNow(),
  createdAt:            timestamp("created_at", { withTimezone: true }).defaultNow(),
});

export const pointEvents = pgTable("point_events", {
  id:        uuid("id").primaryKey().defaultRandom(),
  memberId:  uuid("member_id").notNull().references(() => members.id, { onDelete: "cascade" }),
  ruleKey:   text("rule_key").notNull(),
  points:    integer("points").notNull(),
  refTable:  text("ref_table"),   // source table name
  refId:     uuid("ref_id"),      // source record id
  note:      text("note"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

// Denormalized balance cache — recomputed from point_events
export const userPointsBalance = pgTable("user_points_balance", {
  memberId:         uuid("member_id").primaryKey().references(() => members.id, { onDelete: "cascade" }),
  totalPoints:      integer("total_points").notNull().default(0),
  thisMonthPoints:  integer("this_month_points").notNull().default(0),
  lastRecalcAt:     timestamp("last_recalc_at", { withTimezone: true }).defaultNow(),
  updatedAt:        timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

// ─── Growth layer: Referrals & invitations ────────────────────────────────────

export const referralCodes = pgTable("referral_codes", {
  id:        uuid("id").primaryKey().defaultRandom(),
  memberId:  uuid("member_id").notNull().unique().references(() => members.id, { onDelete: "cascade" }),
  code:      text("code").notNull().unique(),
  clicks:    integer("clicks").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

// Full growth-layer invitation (richer than the simple `invites` table)
export const invitations = pgTable("invitations", {
  id:               uuid("id").primaryKey().defaultRandom(),
  inviterId:        uuid("inviter_id").notNull().references(() => members.id, { onDelete: "cascade" }),
  referralCodeId:   uuid("referral_code_id").references(() => referralCodes.id, { onDelete: "set null" }),
  name:             text("name"),
  email:            text("email"),
  phone:            text("phone"),
  // 'sent'|'opened'|'joined'|'attended'|'active'
  stage:            text("stage").notNull().default("sent"),
  stageUpdatedAt:   timestamp("stage_updated_at", { withTimezone: true }).defaultNow(),
  invitedMemberId:  uuid("invited_member_id").references(() => members.id, { onDelete: "set null" }),
  suppressedAt:     timestamp("suppressed_at", { withTimezone: true }),
  createdAt:        timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt:        timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

export const suppressionList = pgTable("suppression_list", {
  id:        uuid("id").primaryKey().defaultRandom(),
  contact:   text("contact").notNull().unique(),   // email or phone
  reason:    text("reason"),                        // 'opted_out'|'bounced'|'complaint'
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

// ─── Growth layer: Advocacy ───────────────────────────────────────────────────

export const advocacyPosts = pgTable("advocacy_posts", {
  id:               uuid("id").primaryKey().defaultRandom(),
  title:            text("title").notNull(),
  caption:          text("caption").notNull(),
  captionVariants:  jsonb("caption_variants"),    // { platform: caption }
  mediaUrl:         text("media_url"),
  canonicalLink:    text("canonical_link"),
  hashtags:         jsonb("hashtags"),            // string[]
  pillar:           pillarEnum("pillar"),
  targetPlatforms:  jsonb("target_platforms"),    // string[]
  // 'draft'|'scheduled'|'published'|'archived'
  status:           text("status").notNull().default("draft"),
  scheduledAt:      timestamp("scheduled_at", { withTimezone: true }),
  publishedAt:      timestamp("published_at", { withTimezone: true }),
  createdBy:        uuid("created_by").references(() => members.id, { onDelete: "set null" }),
  createdAt:        timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt:        timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

export const advocacyShares = pgTable("advocacy_shares", {
  id:           uuid("id").primaryKey().defaultRandom(),
  memberId:     uuid("member_id").notNull().references(() => members.id, { onDelete: "cascade" }),
  postId:       uuid("post_id").notNull().references(() => advocacyPosts.id, { onDelete: "cascade" }),
  platform:     text("platform").notNull(),
  trackedUrl:   text("tracked_url"),
  sharedAt:     timestamp("shared_at", { withTimezone: true }).defaultNow(),
  pointsEarned: integer("points_earned").notNull().default(0),
  createdAt:    timestamp("created_at", { withTimezone: true }).defaultNow(),
});

export const advocacyClicks = pgTable("advocacy_clicks", {
  id:        uuid("id").primaryKey().defaultRandom(),
  shareId:   uuid("share_id").notNull().references(() => advocacyShares.id, { onDelete: "cascade" }),
  clickedAt: timestamp("clicked_at", { withTimezone: true }).defaultNow(),
  referrer:  text("referrer"),
  userAgent: text("user_agent"),
});

// ─── Leaderboard ──────────────────────────────────────────────────────────────

// Singleton row — insert exactly one row via seed.sql
export const leaderboardSettings = pgTable("leaderboard_settings", {
  id:                uuid("id").primaryKey().defaultRandom(),
  // 'members_only'|'public_link'|'public_indexed'
  visibility:        text("visibility").notNull().default("members_only"),
  defaultSeason:     text("default_season").notNull().default("month"),  // 'month'|'cycle'|'alltime'
  showAvatars:       boolean("show_avatars").notNull().default(true),
  enabledCategories: jsonb("enabled_categories").notNull().default(
    JSON.stringify(["overall", "inviters", "advocates", "goal_getters"]),
  ),
  updatedBy:         uuid("updated_by"),
  updatedAt:         timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

export const userPrivacyPrefs = pgTable("user_privacy_prefs", {
  memberId:             uuid("member_id").primaryKey().references(() => members.id, { onDelete: "cascade" }),
  leaderboardOptIn:     boolean("leaderboard_opt_in").notNull().default(true),
  // 'full'|'first_initial'|'alias'
  displayNameMode:      text("display_name_mode").notNull().default("full"),
  alias:                text("alias"),
  publicProfileEnabled: boolean("public_profile_enabled").notNull().default(false),
  updatedAt:            timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

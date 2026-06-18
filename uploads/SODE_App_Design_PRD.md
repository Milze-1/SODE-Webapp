# SODE Growth Platform — Product Design PRD

**Product:** The School of Daniels & Esthers (SODE) Growth Platform
**Type:** Installable PWA — member app + leadership back office
**Audience for this document:** Product designer working in **Claude Design**
**Prepared for:** SODE Leadership Team (Dominion City Victoria Island)
**Version:** 1.1 · June 2026
**Companion document:** *SODE App — Engineering PRD* (feature IDs F1–F14 referenced here are defined there)

> **v1.1 adds a Growth & Engagement layer** to design — invitations, points, a public leaderboard, and a social-advocacy share feed. See **Addendum v1.1 (§12–§16)** at the end. These are member-facing and motivation-critical; design them to feel mission-aligned and dignified, not like crude growth-hacking.

---

## 0. How to use this document in Claude Design

This is a design brief, not a feature spec — the engineering PRD owns the logic. Your job is the experience: the look, the flows, the screens, the states. Work in this order:

1. Read §1–§2 (who this is for, design principles).
2. Lock the visual language in §3–§4 (brand, tokens, components) — build these as reusable styles/components in Claude Design first.
3. Design the screens in §6 (every screen has a spec).
4. Design the flows in §7 end-to-end (don't design screens in isolation).
5. Cover the states in §8 (empty/loading/error/offline) — these are where most apps feel broken.
6. Apply the microcopy voice in §9.
7. Hand off per §11.

Each screen spec names the **feature ID (Fn)** it serves so you can cross-check against engineering. Design **mobile-first at 390px**, then define the desktop/admin layout.

---

## 1. Who we're designing for

| Audience | Context | Design implication |
|----------|---------|--------------------|
| **Member** (the majority) | Young Nigerian professionals/students/entrepreneurs. Android phones, variable data, on the move, often opening the app during or right after a Sunday/SODE session. Mixed tech comfort. | Mobile-first, thumb-reachable, fast, forgiving of bad signal, almost no learning curve. Big tap targets, short forms, clear next action. |
| **Pillar Leads & Member Care** | Busy volunteers, mostly on phone, some on laptop for reviews. | Quick "what needs my attention" views; bulk actions; not data-entry drudgery. |
| **Director & Data & Ops Lead** | Run scorecard/reviews, often on desktop. | Dense but legible dashboards; export-ready; trustworthy numbers. |

**Design tension to resolve:** members want *light, encouraging, fast*; leaders want *complete, accurate, dense*. Solve it with **two distinct surfaces** sharing one design system — a warm, simple Member experience and a focused Admin experience — not one cramped interface trying to do both.

---

## 2. Design principles

1. **Faithful and excellent, not churchy-kitsch.** SODE raises people "ten times better." The app should feel like a premium professional product that happens to be faith-rooted — closer to a modern productivity app than a clip-art ministry flyer. Scripture and spiritual framing appear with restraint and dignity.
2. **One clear next action per screen.** Especially for members. Every screen answers "what do I do now?"
3. **Under-60-seconds by design.** The deck's biggest risk is members not filling forms. Forms must *look* effortless: short, single-column, progress shown, autosave reassurance, big submit.
4. **Encourage, don't shame.** Progress is celebrated; gaps are nudges, never red-alert guilt. Tone is a mentor, not an auditor — even though leaders see honest numbers underneath.
5. **Mobile thumb-first.** Primary actions in the bottom third. Bottom tab nav. No hover-dependent interactions.
6. **Trustworthy numbers.** Admin dashboards make it obvious what a number means, its source, and as-of date. No mystery metrics.
7. **Works on a bad day.** Designed offline/empty/error states so a member in a basement with one bar still has a usable experience.

---

## 3. Brand & visual language

> No official SODE brand kit is provided. The direction below is a starting system; confirm with the Director and adjust. Design tokens so a palette swap is trivial.

### 3.1 Identity cues
- Name lockup: **"THE SCHOOL OF"** (small, tracked-out, uppercase) above **"Daniels & Esthers"** (prominent). Carry this hierarchy into the app's splash, login, and About.
- **Motif:** choose ONE quiet, repeatable element and use it consistently — e.g., a refined "growth" mark (an upward arc / sprout) or a subtle four-segment shape echoing the four pillars. Avoid literal religious clip-art. The four-pillar quadrant can double as an iconographic system (one icon per pillar).
- Each pillar gets a **consistent colour + icon** used everywhere it appears (goals, wins, courses, readings, charts). This colour-coding is the single most important visual system in the app — members learn the pillars by colour.

### 3.2 Suggested palette (confirm/replace)
A grounded, premium base with four distinct but harmonious pillar accents.

| Token | Value | Use |
|-------|-------|-----|
| `--bg` | `#FFFFFF` | App background (light) |
| `--surface` | `#F7F8FA` | Cards, inputs |
| `--ink` | `#1A1D29` | Primary text |
| `--ink-muted` | `#5B6172` | Secondary text |
| `--brand` | `#1E2761` (deep indigo) | Primary brand, headers, key CTAs |
| `--brand-accent` | `#C9A24B` (refined gold) | Highlights, celebrate moments, badges |
| `--pillar-1` | `#3B7A57` (spiritual — green/root) | Pillar 1 |
| `--pillar-2` | `#2D6CDF` (career — blue) | Pillar 2 |
| `--pillar-3` | `#C9701E` (business — amber/build) | Pillar 3 |
| `--pillar-4` | `#7A4FA3` (character — purple) | Pillar 4 |
| `--success` | `#1E8E5A` | On track / done |
| `--warning` | `#C98A1E` | At risk |
| `--danger` | `#C5453B` | Behind (use sparingly, never to shame members) |

Indigo + gold reads "deep + excellent" (Daniel in the king's court) without being loud. Provide a **dark mode** mapping (members open the app in dim auditoriums).

### 3.3 Typography
- **Headings:** a characterful but professional serif or strong geometric sans (e.g., a refined serif for the brand lockup + section titles to feel considered/timeless).
- **Body/UI:** a clean, highly legible sans (e.g., Inter-like) for everything functional.
- Pairing intent: serif for *meaning* (titles, scripture, celebrate moments), sans for *function* (data, forms, nav).
- Sizes (mobile): screen title 24–28, section header 18–20, body 15–16, caption 12–13. Generous line-height for readability on small screens.

### 3.4 Imagery & iconography
- Photography (if any): real, warm, Nigerian, candid — community, learning, work — not stock-corporate. Use sparingly; the app is mostly UI, not imagery.
- Icons: one consistent set, rounded, 2px stroke. Pillar icons are bespoke and fixed.
- Scripture treatment: the deck pairs each pillar with a verse (Daniel 1:8, 1:20; Esther 4:14; Luke 16:10). Use these as quiet, italic accents on pillar pages — never as decorative wallpaper.

### 3.5 Shape, depth, motion
- Rounded corners (cards ~16px, inputs ~12px, buttons ~12px). Soft, low shadows — calm, not flashy.
- Motion: subtle and meaningful — progress bars animate to value, wins trigger a small celebratory moment (confetti/sprout grow), page transitions quick (<200ms). Respect reduced-motion.

---

## 4. Design system / components to build first

Build these as reusable components in Claude Design before screens:

- **Pillar chip/tag** (colour + icon + label) — used everywhere.
- **KPI card** — title, big current value, target, progress ring/bar, status pill, owner avatar, as-of date.
- **Goal card** (team & personal variants) — title, pillar chip, progress, deadline, status.
- **Progress ring & progress bar** — animate to value; colour by pillar or status.
- **Status pill** — On track / At risk / Behind / Done.
- **Stat callout** — big number + small label (for dashboards & celebrate screens).
- **Form field set** — text, long text, number, single-select (chips), multi-select, **NPS 0–10 scale**, date, file upload, pillar-picker, member-picker. All large, single-column, with inline validation and autosave indicator.
- **Bottom sheet / modal** — for quick actions (submit a win, check in).
- **List row** — member row (avatar, name, status, tags), session row, course row, reading row, follow-up task row, mentor row.
- **Segmented control & filter bar** — for admin segments/saved views.
- **Empty state** — illustration slot + headline + helper + primary action.
- **Toast / inline banner** — success, info, offline ("saved — will sync"), error.
- **Bottom tab bar** (member) and **sidebar** (admin).
- **Celebrate moment** — win submitted / goal completed / badge earned.
- **Chart components** — line (trend), bar (comparison), donut (composition), all using pillar colours.
- **App bar** with context title + "Switch to Admin/Member" control (role-aware).

Define light + dark, and document tokens so engineering maps them to Tailwind/shadcn.

---

## 5. Navigation & layout

**Member (mobile-first):** bottom tab bar with 5 items — **Home · Goals · Forms · Learn · Profile**. Mentorship and Attendance reachable from Home and Profile (or a "More"). App bar shows the screen title and (if the user is a leader) the Switch-to-Admin control.

**Admin (desktop + mobile):** left sidebar (collapsible to icons on mobile) — **Scorecard · Pillar Goals · Members · Attendance · Forms · Registers · Mentorship · Reports · Settings**. Top bar: cycle selector ("Month 4 of 12"), search, profile.

Keep member primary actions in the bottom third. Admin can be denser and use tables.

---

## 6. Screen-by-screen specifications

For each screen: purpose, key content, primary action, states to design. Design every state — not just the happy path.

### MEMBER

#### M0 · Splash / Login (Auth, onboarding)
- SODE lockup, one-line purpose ("Spiritually deep. Excellent in the marketplace."), email magic-link field + "Continue with Google".
- Reassuring, calm, premium. States: default, link-sent confirmation, error, loading.

#### M1 · Onboarding & consent (F7 of eng: profile + baseline)
- Multi-step, progress-dotted: (1) basics (name, WhatsApp), (2) life stage/vocation/business status/department/leadership role, (3) **consent** screen (plain-language data + WhatsApp/email contact consent — dignified, not a legal wall), (4) prompt to take Baseline Survey or "later".
- One field group per step, big Next button. States: per-step, validation, success → Home.

#### M2 · Home / My Dashboard (F4)
The most important member screen. A warm, scannable "here's you this month."
- Greeting + cycle context ("Month 4 — keep going").
- **My goals** snapshot: 2–3 active personal goals with progress rings (tap → Goals).
- **Next up:** next session (date, type, location, check-in if live).
- **This month's reading** card (F7).
- **Open forms** nudge ("Wins to share? 60 seconds") (F3).
- **Mentor** status (matched / find a mentor) (F8).
- Optional **wins shoutout** strip (F9.6) — community encouragement.
- States: brand-new member (lots of empty states with friendly prompts), returning member, all-caught-up (celebrate), offline (cached).

#### M3 · My Goals (F4)
- List of personal goals grouped by pillar (pillar chips), each a goal card with progress + deadline.
- FAB / primary button: **+ New goal** → choose pillar → pick a **template** (laddered from team goals) or custom → set target, unit, due date, optional milestones.
- Goal detail: progress history, update progress (slider/number), milestone checklist, "mark complete" (→ optional celebrate + prompt to log a Win).
- Special: **12-Month Career & Calling Roadmap** as a distinct guided goal type with prompts and Draft/Submitted status.
- States: empty (suggested templates front and centre), in-progress, completed, overdue (gentle), offline draft.

#### M4 · Forms & Surveys (F3)
- List of **forms open to me** with title, "~X sec," and due date; completed ones collapse to a "done" state.
- **Wins Form** is always pinned/accessible — a fast bottom-sheet flow: pick win type → pillar → short description → optional photo/link → submit → celebrate. Design this to feel like the easiest thing in the app.
- Pulse/NPS survey: one question per screen on mobile, swipeable, progress shown; **NPS 0–10** as a clear tappable scale.
- States: no open forms (reassuring), mid-form autosave ("saved"), submit success, offline queued, closed form.

#### M5 · Learn (F6, F7)
- Two sections: **Courses/Modules** (enrolled, in progress, completed with certificate badge) and **Recommended readings** (this month, with "why this" notes).
- Course row: title, pillar chip, provider, status; action "mark complete + upload certificate."
- Reading row: title, author, type (book/article/scripture plan/devotional), mark reading/finished, optional reflection.
- States: empty, in-progress, completed, verification pending, offline (readings cached).

#### M6 · Mentorship (F8)
- If unmatched: "Find a mentor" → state goal area + pillar → see suggested mentors (cards: expertise, industry, pillar, capacity) → request.
- If matched: mentor card, status, milestones/sign-offs, contact.
- States: unmatched, request pending, matched/active, completed.

#### M7 · Attendance (F5)
- My attendance history (sessions list with present/absent).
- **Check in to today's session** (only within window): big button → enter/scan code or one-tap if geo/time valid → confirmation.
- States: no live session, live session (check-in available), checked-in, offline queued ("we'll sync your check-in").

#### M8 · Profile
- Photo, name, pillar/life-stage info, leadership/serving role, departments, consent & contact preferences, data export/delete request (NDPA), sign out.
- States: view, edit, save.

### ADMIN / LEADERSHIP

#### A1 · Team Scorecard (F1)
- The flagship leadership view. Grid of **KPI cards** across all four pillars + overall: current vs target, progress, status pill, owner, as-of date, mini trend.
- Cycle context ("Month 4 of 12") and overall health summary at top (e.g., "7 on track · 2 at risk · 1 behind").
- Tap a KPI → detail with trend chart (from monthly snapshots), source explanation, and contributing records.
- Filter by pillar. Prominent **Export** (PDF/CSV).
- States: full data, partial (some manual KPIs not yet updated — clearly marked), pre-baseline ("set your baselines first" CTA).

#### A2 · Pillar Goals (F2)
- Per-pillar page: list of SMART goals with metric, target, deadline (M3/6/9/12), owner, live progress, auto vs manual badge.
- Owner can add/edit/close goals (scoped to their pillar), update manual values with a note (history shown).
- States: empty (seed templates), populated, goal detail with update history.

#### A3 · Members directory + segments + first-timer queue (F9.5, F10)
- Searchable, filterable member table: name, status (incl. **first-timer** badge), pillar stages, department, leadership role, last seen, mentor status.
- **Saved segments** (first-timers this month, no certification yet, high/low NPS, business owners, overdue check-in).
- **First-timer queue** as a focused view: new first-timers, assigned follow-up owner, due date, outcome — with quick actions (mark contacted, message via WhatsApp/email, plug into department).
- Bulk actions on a segment: message, assign, export.
- Member detail: full 360 (profile, goals, attendance, wins, courses, mentor, follow-ups) — respecting permission scope (sensitive notes restricted).
- States: list, filtered/segment, empty segment, member detail.

#### A4 · Attendance Console (F5, integration)
- Sessions list (upcoming/past) with type, date, attendance % (present ÷ expected).
- Session detail: register (mark present/absent/excused in bulk), check-in code/QR to display, source breakdown (self/leader/sheet).
- **Google Sheets sync panel:** connected sheets, last sync time, rows imported, **unmatched rows needing manual resolution** (match to member). Make sync status and errors very clear.
- States: no sessions, session with register, syncing, sync error, unmatched-rows resolution.

#### A5 · Forms Builder & Responses (F3)
- Builder: drag/add fields (the field set in §4), set audience, open/close dates, "est. seconds." Live mobile preview.
- Responses: per-form table, summary charts (e.g., NPS distribution), export, and **Google Forms/Sheet import** mapping screen.
- States: form list, builder (empty/edit), preview, responses (none/some), import mapping.

#### A6 · Registers (F6, F9.9)
- Tabbed: **Business Registry · Cells · Leadership · Certificates.**
- Each is a focused table with the right fields (e.g., Business: name, owner, status idea/registered/first-customer, revenue growth, funding; Certificate: member, course, artifact, verified toggle).
- **Verify** actions (certificates, business milestones) prominent — these guard against "success theater."
- States: empty, populated, verify pending, verified.

#### A7 · Mentorship Console (F8)
- Pairing log (active/completed), open mentor requests, suggested matches to approve, mentor capacity view.
- States: requests pending, matched, capacity full warnings.

#### A8 · Reports & Export (§14 eng)
- One place to generate: Monthly Scorecard, Quarterly Review pack, Annual Impact Report, per-pillar CSVs.
- Preview before export; choose period; format (PDF/CSV).
- States: configure, generating, ready/download, empty period.

#### A9 · Settings
- Cycle & baseline config, roles & invites, integrations (Sheets/Resend/WhatsApp), notification templates, thresholds for status, data-retention controls.
- States: per-section view/edit.

---

## 7. Key flows to design end-to-end

Design these as connected flows (Claude Design can prototype the click-through):

1. **New member onboarding:** Login → onboarding steps → consent → Baseline Survey → Home (with friendly empty states).
2. **Submit a win (the 60-second flow):** Home nudge → bottom sheet → type → pillar → description → optional artifact → submit → celebrate → back to Home. This is the flow to make *delightful.*
3. **Set & complete a personal goal:** Goals → +New → template → set target → later: update progress → complete → celebrate → prompt to log win.
4. **Check in at a session (offline-aware):** Home/Attendance → live session → check in → confirmation; show the offline-queued variant.
5. **Quarterly Pulse + NPS:** notification → one-question-per-screen survey → submit → thanks; show how NPS feeds the leader scorecard (for context, not member-facing).
6. **Leader monthly review:** Scorecard → spot an at-risk KPI → drill in → see contributing members → act (assign follow-up / message segment) → export monthly pack.
7. **First-timer follow-up:** new first-timer detected → appears in queue → owner contacts (WhatsApp/email) → marks outcome → conversion reflected in dashboard.
8. **Google Sheet attendance reconciliation:** sync runs → unmatched rows surface → leader resolves matches → attendance + KPIs update.

---

## 8. States, edge cases & empty states (design all of these)

- **Empty states** for every list (no goals, no wins yet, no forms open, no mentor, no sessions, empty segment) — each with a friendly line + clear primary action. The first-run experience is mostly empty states; make them inviting, not barren.
- **Loading:** skeletons for cards/tables; never spinners-only on data screens.
- **Offline:** persistent subtle banner; "saved — will sync" toasts on check-in/form/goal updates; cached read-only views for Home, Goals, Readings.
- **Error:** inline, human, recoverable ("Couldn't load your goals — retry").
- **Pre-baseline (admin):** scorecard prompts to capture Month 0 baselines before showing growth KPIs.
- **Permission-scoped emptiness:** a lead seeing only their pillar's data — make scope explicit, not confusing.
- **Partial/unverified data:** mark manual or unverified KPIs/wins clearly.
- **Celebrate moments:** win submitted, goal completed, badge earned, KPI hits target.

---

## 9. Microcopy & voice

- **Voice:** a warm, wise mentor. Encouraging, plain Nigerian English, never preachy or guilt-tripping. Spiritual where natural, professional throughout.
- **Examples:**
  - Empty goals: "No goals yet. Pick one and let's start the climb." + suggested templates.
  - Wins nudge: "Something good happened? Share it — 60 seconds." 
  - Overdue goal: "Still time to move this one." (never "You failed / Overdue!" in red).
  - First-timer (to leader): "New face this week — let's reach out."
  - Submit success: "Logged. Well done." (with a small celebrate).
  - Offline: "Saved on your phone. We'll sync when you're back online."
- Buttons are verbs ("Set a goal," "Share a win," "Check in," "Find a mentor").
- Scripture/pillar quotes appear italic, attributed, sparing — context, not decoration.

---

## 10. Responsive, PWA & accessibility

- **Breakpoints:** mobile 360–430 (primary), tablet 768, desktop 1024+ (admin tables shine here).
- **PWA feel:** design a splash/app-icon, standalone (no browser chrome), portrait member screens; install prompt UI after first win/goal.
- **Touch:** min 44×44px targets; primary actions bottom-third; avoid hover-only.
- **Accessibility (WCAG 2.1 AA):** 4.5:1 text contrast (check pillar colours on white/dark), visible focus states, labelled fields, don't rely on colour alone for status (pair with icon/label), respect reduced-motion, scalable text. Pillar colour-coding must always be paired with the pillar icon/label for colour-blind users.

---

## 11. Deliverables & handoff (from Claude Design)

Produce, in Claude Design:
1. **Design system page:** tokens (colours incl. pillar set + dark mode, type scale, spacing, radii, shadows), and all components from §4 with states.
2. **High-fidelity screens** for every screen in §6 (member + admin), each with its key states.
3. **Prototyped flows** for the 8 flows in §7 (clickable).
4. **Empty/loading/error/offline state designs** (§8).
5. **Pillar iconography** (4 icons) + app icon + splash.
6. **Responsive specs:** mobile + desktop for admin-heavy screens (Scorecard, Members, Forms Builder).
7. **Handoff notes for engineering:** token names mapping to Tailwind/shadcn, component → feature ID (Fn) mapping, and any interaction details (animation timing, autosave behaviour, check-in window UX).

**Definition of done (design):** every screen in §6 designed with its states; the 8 flows prototyped; pillar colour+icon system applied consistently; mobile-first verified at 390px; AA contrast checked; tokens documented for engineering.

---

## Appendix — Quick screen ↔ feature map
| Screen | Feature (eng) |
|---|---|
| A1 Scorecard | F1 |
| A2 Pillar Goals | F2 |
| M4 / A5 Forms | F3 |
| M2 Home, M3 Goals | F4 |
| M7 / A4 Attendance | F5 + Sheets |
| M5 Learn (courses) | F6 |
| M5 Learn (readings) | F7 |
| M6 / A7 Mentorship | F8 |
| A3 Members + first-timer queue | F9.5, F10 |
| Celebrate/shoutouts, reminders UI | F9.6, F9.3 |
| A8 Reports | §14 (reporting) |

---
*End of Design PRD v1.0 core. Addendum v1.1 follows.*

---
---

# Addendum v1.1 — Growth & Engagement Layer (Design)

This addendum designs the experience for four interlocking features defined in the Engineering PRD: **F11 Points engine**, **F12 Invitations & referral**, **F13 Public leaderboard**, **F14 Social advocacy**. Together they form a growth loop: members invite people they know, amplify SODE content, and earn points that rank them on a leaderboard — with invitations worth the most.

## 12. Design intent & tone for the growth layer

The risk with points, referrals, and leaderboards is that they feel like crass growth-hacking — out of place for a faith community. **Reframe the whole layer around the mission**: SODE exists to raise more Daniels and Esthers, so inviting others and amplifying the message is *kingdom work*, not point-farming. Design choices that hold this line:

- **Language of invitation, not recruitment.** "Bring someone into the room," "Help the room grow," not "Earn rewards, hit your quota."
- **Celebrate impact, not just score.** When a referral actually joins and shows up, that's the moment to celebrate ("Someone you invited just attended their first session 🌱") — more than the raw points.
- **Competitive but warm.** The leaderboard motivates without humiliating. No "losers," no harsh red. Everyone can see their own climb.
- **Let the Director dial intensity.** Design so the competitive framing can be turned up or down (e.g., leaderboard prominence) — some seasons may emphasise it, others may soft-pedal it.
- **Points are a quiet currency.** A small, consistent points badge — present but not screaming on every screen.

## 13. New components to add to the design system

- **Points badge / counter** — compact pill (icon + number), with a subtle "+N" animation when points are earned. Appears on Home and Profile.
- **Rank card** — "You're #24 this month" with delta and a "X pts to next rank" nudge.
- **Leaderboard podium** — top-3 treatment (1st elevated/centre), with avatars/display names and points; dignified, not gaudy.
- **Leaderboard row** — rank number, avatar, display name, points, optional category badge (Top Inviter / Top Advocate), "you" highlight when it's the current user.
- **Season/scope selector** — segmented control: This Month · This Cycle · All-time; plus category filter.
- **Invite contact entry** — add-a-contact card (name optional, email and/or phone), with add-another, and a small-batch list; clear cap indicator.
- **Consent affirmation checkbox** — the "I personally know these people…" affirmation, styled as a calm, plain-language confirmation, not legal fine print.
- **Message composer** — editable invitation message with preview, showing how it appears to the recipient (with the inviter's name and opt-out line visible — so members see it's respectful).
- **Invitation status tracker** — per-invite lifecycle chips: Sent · Opened · Joined · Attended · Active, with points earned per stage. A visual "journey" so members watch their invite mature.
- **Points-earned toast & celebrate moment** — distinct from the v1.0 win-celebrate: a lighter "+5 invited", and a bigger celebrate for "+50 someone joined!".
- **Advocacy content card** — media preview, caption (copy/edit), per-platform share buttons, points-available hint, shares/clicks the member has earned on it.
- **Share sheet** — platform chooser (Instagram, X, LinkedIn, Facebook, WhatsApp status), with copy-caption + download-asset for manual platforms, and one-tap for share-API platforms.
- **Privacy/display control** — leaderboard opt-in toggle + display-name mode (Full name / First + initial / Alias) selector.

## 14. New screens

### MEMBER

#### M9 · Invite & Earn (F12)
The flagship growth screen. Make inviting feel generous and easy.
- Header framing the *why* ("Know someone who'd thrive here? Bring them in.") + the member's current invite points.
- **Add contacts:** name (optional) + email and/or phone, add-another, small-batch list, cap indicator.
- **Customise message:** editable template showing `{inviter_name}` and a recipient preview; the opt-out line is visible and explained as "we always let them opt out — keeps it respectful."
- **Consent affirmation** checkbox (required) before the Send button activates.
- **Send** → confirmation showing sent vs skipped (already-members/opted-out) without shaming.
- **My invitations:** list of sent invites with the lifecycle status tracker and points earned per stage; celebrate states when an invite converts.
- States: empty (no invites yet — inviting, with a single clear CTA), contacts entered, sending, sent summary, invites in various lifecycle stages, an invite that converted (celebrate), a paused/limited state if rate-limited (gentle explanation).

#### M10 · Leaderboard (F13) — member + public variants
- **Podium** for top 3, then ranked list; **your rank pinned** at the top or bottom bar even if you're outside the visible range ("You're #24 — 30 pts to top 20").
- Season/scope selector (This Month default) + category filter (Overall / Top Inviters / Top Advocates / Top Goal-getters).
- Tapping the points badge anywhere → "How points work" explainer (transparent: what earns what, invitations highest).
- **Public variant** (no-login): same board, but only display names + points + rank; a short privacy line ("Members choose to appear here") and a SODE intro/join CTA (the public leaderboard doubles as a growth surface).
- States: populated, you're-unranked ("Earn your first points to join the board"), empty season (pre-launch), member opted out of public (sees self privately, explains absence on public board).

#### M11 · Share / Advocacy feed (F14)
- Feed of current SODE content cards; each with media, caption, share buttons, and points-available hint.
- **Share flow:** tap platform → (share-API platforms) prefilled share with tracked link; (manual platforms like Instagram) copy caption + download asset + "Mark as shared" → points toast.
- "Your impact" strip: shares made, clicks earned, points from advocacy.
- States: content available, no content right now (calm empty state), shared (with click count ticking up over time), expired content removed.

#### Points surfacing across existing screens
- **Home (M2):** add a compact points badge + rank card ("You're #24 — climbing"), and surface invite/advocacy nudges among existing nudges (kept mission-framed).
- **Profile (M8):** points total, rank history, badges, **leaderboard privacy controls** (opt-in + display-name mode), and contact/consent preferences (extends the v1.0 consent section).
- **Win/goal/survey completion:** existing celebrate moments now also show the "+N points" lightly.

### ADMIN

#### A10 · Growth & Rewards console
- **Points rules:** table to tune each `rule_key`'s value, caps, verification flag (Director/Data&Ops). Clear note that invitations should stay highest.
- **Invitations & referrals analytics:** invites sent, conversion funnel (sent→clicked→joined→attended→active), top inviters, referral-driven registrations (tie to membership-growth KPI), abuse/paused-users review, suppression-list management.
- **Leaderboard settings:** visibility (Members-only default / Public link / Public indexed), default season, show-avatars, reset/seasons.
- States: rules editor, analytics dashboards, suppression review, settings.

#### A11 · Advocacy content manager (F14)
- Create/curate advocacy posts: title, caption (+ per-platform variants), media upload, target platforms, hashtags, canonical link, schedule, pillar tag, status.
- Per-post analytics: shares, clicks, top amplifiers, platform breakdown.
- States: content list, post editor, scheduled/published/archived, analytics.

## 15. New flows to prototype

1. **Invite someone (the generous flow):** M9 → add contact(s) → customise message → affirm consent → send → confirmation → later: watch an invite move Sent→Joined→Attended with celebrate moments and points.
2. **Climb the leaderboard:** earn points (win/goal/invite/share) → points toast → Home rank card updates → open M10 → see rank improve → "how points work" explainer.
3. **Share SODE content:** M11 → pick content → choose platform → share (API) or copy+download+mark-shared (manual) → points toast → later see clicks/points accrue.
4. **Set leaderboard privacy:** Profile → leaderboard opt-in + choose display name → reflected on public board.
5. **Admin tunes the economy:** A10 → adjust point rules / set leaderboard to public → review referral funnel & top inviters.

## 16. States, microcopy & privacy UX for the growth layer

### States to design (beyond happy path)
- Invite: empty, sending, sent-with-skips, converted (celebrate), rate-limited/paused (gentle).
- Leaderboard: unranked, empty season, opted-out-of-public, your-rank-pinned.
- Advocacy: no content, shared, click-accruing, expired.
- Points: first-ever points (onboarding moment), big-conversion celebrate, clawback (handle invisibly to the member where possible; never publicly shame).

### Microcopy (mission-framed, NDPA-respectful)
- Invite header: "Know someone who'd thrive here? Bring them in."
- Consent checkbox: "I personally know these people and they'll be glad to hear from me about SODE."
- Sent summary: "12 invitations sent. 3 were already in the room."
- Invite converted: "Someone you invited just joined SODE. 🌱 +50 points — but really, +1 life."
- Leaderboard unranked: "Earn your first points to join the board — start by sharing a win or inviting a friend."
- Points explainer: keep it transparent — invitations earn the most because growing the room is the mission; routine actions earn a little.
- Advocacy: "Help the message travel. Share, and we'll count every click."

### Privacy UX (design these visibly, not buried)
- The invitation **opt-out line is always shown** in the composer preview, framed as a feature ("we always let them opt out").
- **Leaderboard opt-in** is an explicit, friendly choice with a clear display-name selector; default to members-only visibility until the member opts into public.
- A small "How your data is used" link near invite/leaderboard/advocacy surfaces, in plain language.
- Never display contact info on any leaderboard; only chosen display name + points + rank.

## 17. Updated deliverables & definition of done (v1.1)

Add to the §11 deliverables:
- New components in §13 (points badge, rank card, podium, leaderboard row, invite entry, status tracker, message composer with preview, advocacy card, share sheet, privacy controls).
- New screens M9–M11, A10–A11, plus the points/rank/privacy additions to Home and Profile — each with the states in §16.
- Prototyped growth flows (§15).
- Mission-aligned, dignified tone applied throughout; competitive intensity adjustable.
- Privacy UX (opt-out preview, leaderboard opt-in, display-name modes) designed and visible.

**Definition of done (v1.1):** every new screen designed with its states; the 5 growth flows prototyped; points/leaderboard/advocacy components in the design system; invitation and leaderboard privacy controls designed and surfaced (not buried); tone reads as mission-driven invitation, not growth-hacking; mobile-first at 390px; AA contrast checked (including the new accent/celebrate colours).

---
*End of Design PRD v1.1.*

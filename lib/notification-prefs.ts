// Member notification preferences (members.notification_prefs, jsonb).
// Shared by the Settings screen and the server senders.
//
// Shape: { email?: boolean, off?: string[] }
//   email — master switch for reminder emails (default on)
//   off   — category keys the member turned off. A category that's off gets
//           no phone push and no email; it still lands in the in-app Alerts
//           list so nothing is lost.
// Stored as an "off" list so new categories default to on for everyone.

export interface NotificationPrefs {
  email?: boolean;
  off?: string[];
}

export const NOTIFICATION_CATEGORIES = [
  { key: 'sessions', label: 'Sessions',            sub: 'New sessions, live check-in, day-before reminders', types: ['session_created', 'session_live', 'session_reminder'] },
  { key: 'forms',    label: 'Forms',               sub: 'When a new form is published for you',             types: ['form_published'] },
  { key: 'learning', label: 'Learning content',    sub: 'New readings and resources',                       types: ['learning_published'] },
  { key: 'devotion', label: 'Devotion reminders',  sub: 'Daily nudge for your reading plan',                types: ['devotion_reminder'] },
  { key: 'goals',    label: 'Goals & milestones',  sub: 'Goals falling behind, overdue milestones',         types: ['goal_reminder', 'milestone_overdue'] },
  { key: 'tasks',    label: 'Profile & tasks',     sub: 'Things to finish, like completing your profile',  types: ['profile_incomplete'] },
] as const;

export function categoryForType(type: string): string | null {
  return NOTIFICATION_CATEGORIES.find(c => (c.types as readonly string[]).includes(type))?.key ?? null;
}

export function isCategoryOn(prefs: NotificationPrefs | null | undefined, category: string): boolean {
  return !(prefs?.off ?? []).includes(category);
}

export function wantsPush(prefs: NotificationPrefs | null | undefined, type: string): boolean {
  const cat = categoryForType(type);
  return cat ? isCategoryOn(prefs, cat) : true;
}

export function wantsEmail(prefs: NotificationPrefs | null | undefined, type: string): boolean {
  if (prefs?.email === false) return false;
  return wantsPush(prefs, type);
}

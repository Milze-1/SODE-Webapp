'use client';

import Link from 'next/link';
import InfoPage, { InfoCard } from '@/components/member/InfoPage';

// Plain-language description of what the app actually stores and does.
// Keep in sync with the product — this is a summary, not the legal policy.
export default function PrivacyPage() {
  return (
    <InfoPage title="How your data is used" subtitle="Plain-language summary">
      <InfoCard title="What we store">
        Your name, email and WhatsApp number; the profile answers you give (life stage, department, industry,
        strengths, goals and business details); your goals, milestones, wins and devotion check-ins; your
        session attendance; and the points you earn.
      </InfoCard>
      <InfoCard title="Location">
        We only use your location at the moment you check in to a session, to confirm you&apos;re at the venue.
        That check-in location is saved with the attendance record. We don&apos;t track your location at any other time.
      </InfoCard>
      <InfoCard title="Who can see it">
        The SODE leadership team, according to their role (for example pillar leads see members in their pillar),
        and your mentor once you&apos;re paired. Other members only see your name and points on the leaderboard —
        and only if you&apos;ve left <strong>Appear on leaderboard</strong> switched on.
      </InfoCard>
      <InfoCard title="How we contact you">
        In-app alerts, and — if you allow them — phone notifications, email reminders and WhatsApp messages.
        Choose exactly what you get in <Link href="/member/settings" style={{ color: 'var(--navy)', fontWeight: 700 }}>Settings</Link>.
      </InfoCard>
      <InfoCard title="Your controls">
        <ul style={{ margin: 0, paddingLeft: 18 }}>
          <li>Export everything we hold about you: Profile → <strong>Export my data</strong>.</li>
          <li>Ask us to delete your account: Profile → <strong>Request account deletion</strong>.</li>
          <li>Hide yourself from the leaderboard and turn notifications on or off in Settings.</li>
        </ul>
      </InfoCard>
      <p style={{ fontSize: 12.5, color: 'var(--muted)', lineHeight: 1.5, padding: '0 4px' }}>
        Questions about your data? Email <a href="mailto:connect@thesode.org" style={{ color: 'var(--navy)', fontWeight: 700 }}>connect@thesode.org</a>.
      </p>
    </InfoPage>
  );
}

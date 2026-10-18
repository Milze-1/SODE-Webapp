'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Icon } from '@/components/sode/icons';
import InfoPage from '@/components/member/InfoPage';

const FAQS: { q: string; a: React.ReactNode }[] = [
  {
    q: 'How do I check in to a session?',
    a: <>When a session starts you&apos;ll get a notification — tap it, or open <Link href="/member/attendance">Attendance</Link> and tap <strong>Check in now</strong>. You need to be at the venue (allow location when asked). Your past check-ins are listed under History on the same page.</>,
  },
  {
    q: "I'm not getting notifications on my phone",
    a: <>Go to <Link href="/member/settings">Settings</Link> → <strong>Push notifications</strong> and switch it on, then allow notifications when your phone asks. On iPhone you must first add SODE to your Home Screen (Share → Add to Home Screen) and open it from there. You can choose which kinds of notifications you get under <strong>What to notify me about</strong>.</>,
  },
  {
    q: 'How do I get a mentor?',
    a: <>Complete your profile first — <Link href="/member/profile/complete">finish it here</Link>. Your leadership team uses it to match you, and you&apos;ll be notified as soon as you&apos;re paired. Your mentor&apos;s details then appear on the <Link href="/member/mentorship">Mentorship</Link> page.</>,
  },
  {
    q: 'How do I set a goal and get reminders?',
    a: <>Open <Link href="/member/goals">Goals</Link> → <strong>New goal</strong>. Pick a template or tap <strong>Write my own</strong>, choose a due date, and set <strong>Remind me to log progress</strong> (daily or weekly, at a time you choose). You can change the reminder later from the goal&apos;s Edit screen.</>,
  },
  {
    q: 'My attendance history is missing',
    a: <>History only shows check-ins made with the account you&apos;re signed in with. If you registered more than once (for example with two different emails), your history may be on the other account — contact the team below and we&apos;ll merge them.</>,
  },
  {
    q: 'How do points work?',
    a: <>You earn points for checking in, completing your devotion, logging goal progress and wins. See where you stand on the <Link href="/member/leaderboard">Leaderboard</Link> — you can hide yourself from it in Settings.</>,
  },
  {
    q: 'How do I clear old alerts?',
    a: <>Open the bell (Alerts). Tap the ✕ on any alert to remove it, or <strong>Clear all</strong> at the top.</>,
  },
];

export default function HelpPage() {
  const [open, setOpen] = useState<number | null>(0);
  return (
    <InfoPage title="Help & FAQ" subtitle="Common questions answered">
      <div className="card" style={{ overflow: 'hidden' }}>
        {FAQS.map((f, i) => (
          <div key={i} style={{ borderTop: i ? '1px solid var(--line)' : 'none' }}>
            <button
              onClick={() => setOpen(open === i ? null : i)}
              aria-expanded={open === i}
              style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '14px 16px', textAlign: 'left', fontSize: 14.5, fontWeight: 700, color: 'var(--ink)' }}
            >
              <span style={{ flex: 1 }}>{f.q}</span>
              <Icon name="chevrondown" size={18} color="var(--muted)" />
            </button>
            {open === i && (
              <div className="help-answer" style={{ padding: '0 16px 15px', fontSize: 13.5, lineHeight: 1.6, color: 'var(--ink-2)' }}>{f.a}</div>
            )}
          </div>
        ))}
      </div>

      <div className="card card-pad">
        <div style={{ fontSize: 15, fontWeight: 800 }}>Still stuck?</div>
        <p style={{ fontSize: 13.5, color: 'var(--muted)', lineHeight: 1.5, margin: '4px 0 12px' }}>
          Email the SODE team and tell us what you were trying to do — screenshots help.
        </p>
        <a href="mailto:connect@thesode.org?subject=SODE%20app%20help" className="btn btn-primary btn-block" style={{ textDecoration: 'none' }}>
          <Icon name="mail" size={17} color="#fff" /> connect@thesode.org
        </a>
      </div>
      <style>{`.help-answer a { color: var(--navy); font-weight: 700; text-decoration: underline; }`}</style>
    </InfoPage>
  );
}

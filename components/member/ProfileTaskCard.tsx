'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient, getAuthUser } from '@/lib/supabase';
import { Icon } from '@/components/sode/icons';
import { ProgressBar } from '@/components/sode/ui';
import { PROFILE_FIELDS, profileProgress, type ProfileFields } from '@/lib/profile-questions';

// "Complete your profile" task card. Renders nothing once the task is done.
// Self-loading (rather than fed by the page) so it stays accurate on pages
// that serve cached data, e.g. member home.
export default function ProfileTaskCard({ variant = 'home' }: { variant?: 'home' | 'mentorship' }) {
  const router = useRouter();
  const [progress, setProgress] = useState<{ answered: number; total: number } | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const user = await getAuthUser();
      if (!user) return;
      const { data } = await createClient()
        .from('members')
        .select(`profile_complete,${PROFILE_FIELDS}`)
        .eq('auth_id', user.id)
        .maybeSingle();
      if (cancelled || !data || data.profile_complete) return;
      setProgress(profileProgress(data as unknown as ProfileFields));
    })();
    return () => { cancelled = true; };
  }, []);

  if (!progress) return null;

  const started = progress.answered > 0;
  const title = variant === 'mentorship' ? 'Complete your profile to get a mentor' : 'Task: complete your profile';
  const body = variant === 'mentorship'
    ? 'Your leadership team matches mentors using your profile. Finish it so they can pair you with the right person.'
    : 'Required before we can match you with a mentor. Takes about 3 minutes.';

  return (
    <button
      onClick={() => router.push('/member/profile/complete')}
      className="card card-pad"
      style={{ width: '100%', textAlign: 'left', display: 'block', border: '1.5px solid var(--navy)', background: 'var(--navy-tint)' }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
        <div style={{ width: 38, height: 38, borderRadius: 11, background: 'var(--navy)', display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}>
          <Icon name="users" size={19} color="#fff" />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14.5, fontWeight: 800, color: 'var(--ink)' }}>{title}</div>
          <div style={{ fontSize: 12.5, color: 'var(--muted)', lineHeight: 1.45, marginTop: 3 }}>{body}</div>
        </div>
      </div>
      <div style={{ marginTop: 12 }}>
        <ProgressBar value={progress.answered / progress.total} />
      </div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 }}>
        <span className="tnum" style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 600 }}>{progress.answered} of {progress.total} answered</span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 13, fontWeight: 700, color: 'var(--navy)' }}>
          {started ? 'Continue' : 'Start'} <Icon name="arrowright" size={15} color="var(--navy)" />
        </span>
      </div>
    </button>
  );
}

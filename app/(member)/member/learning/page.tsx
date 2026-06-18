'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase';
import { Icon } from '@/components/sode/icons';
import { PillarChip, SectionHead, EmptyState, StatusPill } from '@/components/sode/ui';
import BottomNav from '@/components/member/bottom-nav';

const TYPE_ICON: Record<string, string> = { article: 'list', video: 'camera', podcast: 'message', book: 'bookopen', course: 'sparkles' };

interface ContentRow {
  id: string; title: string; content_type: string; author: string | null;
  pillar: string | null; month_number: number | null; estimated_minutes: number | null;
  thumbnail_url: string | null;
}

function ContentCard({ c, done }: { c: ContentRow; done?: boolean }) {
  return (
    <Link href={`/member/learning/${c.id}`} className="card card-pad" style={{ display: 'flex', alignItems: 'center', gap: 13, textDecoration: 'none', color: 'inherit' }}>
      <div style={{ width: 44, height: 44, borderRadius: 13, background: 'var(--surface-2)', color: 'var(--navy)', display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none', overflow: 'hidden' }}>
        {c.thumbnail_url
          ? <img src={c.thumbnail_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          : <Icon name={TYPE_ICON[c.content_type] ?? 'bookopen'} size={21} stroke={2.1} />}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 15, fontWeight: 700, lineHeight: 1.25 }}>{c.title}</div>
        {c.author && <div style={{ fontSize: 12, color: 'var(--faint)', marginTop: 2 }}>{c.author}</div>}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 5 }}>
          {c.pillar && <PillarChip pillar={c.pillar} size="sm" />}
          {c.estimated_minutes && <span style={{ fontSize: 11.5, color: 'var(--muted)', display: 'inline-flex', alignItems: 'center', gap: 3 }}><Icon name="clock" size={12} /> {c.estimated_minutes} min</span>}
        </div>
      </div>
      {done ? <StatusPill status="done" size="sm" /> : <Icon name="chevronright" size={18} color="var(--faint)" />}
    </Link>
  );
}

export default function LearningPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [thisMonth, setThisMonth] = useState<ContentRow[]>([]);
  const [always, setAlways] = useState<ContentRow[]>([]);
  const [completed, setCompleted] = useState<ContentRow[]>([]);

  useEffect(() => {
    (async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.replace('/login'); return; }
      const { data: memberRow } = await supabase.from('members').select('id, onboarding_complete').eq('auth_id', user.id).maybeSingle();
      if (!memberRow?.onboarding_complete) { router.replace('/member/onboarding'); return; }

      const currentMonth = new Date().getMonth() + 1;

      const [contentRes, completionsRes] = await Promise.all([
        supabase.from('learning_content').select('id,title,content_type,author,pillar,month_number,estimated_minutes,thumbnail_url').eq('is_published', true).order('created_at', { ascending: false }),
        supabase.from('learning_completions').select('content_id').eq('member_id', memberRow.id),
      ]);

      const completedIds = new Set(((completionsRes.data ?? []) as { content_id: string }[]).map(c => c.content_id));
      const all = (contentRes.data ?? []) as ContentRow[];

      setThisMonth(all.filter(c => !completedIds.has(c.id) && c.month_number === currentMonth));
      setAlways(all.filter(c => !completedIds.has(c.id) && c.month_number == null));
      setCompleted(all.filter(c => completedIds.has(c.id)));
      setLoading(false);
    })();
  }, [router]);

  if (loading) {
    return (
      <div style={{ height: '100dvh', display: 'flex', flexDirection: 'column', background: 'var(--bg)' }}>
        <div style={{ flex: 1, padding: '72px 16px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
          {[48, 100, 100, 100].map((h, i) => <div key={i} style={{ height: h, borderRadius: 'var(--r-md)', background: 'var(--surface-2)' }} />)}
        </div>
      </div>
    );
  }

  return (
    <div className="member-page" style={{ position: 'relative', height: '100dvh', display: 'flex', flexDirection: 'column', background: 'var(--bg)', overflow: 'hidden' }}>
      <div className="noscroll" style={{ flex: 1, overflowY: 'auto' }}>
        <div style={{ position: 'sticky', top: 0, zIndex: 20, background: 'rgba(255,255,255,.86)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)', borderBottom: '1px solid var(--line)', padding: '13px 16px 12px' }}>
          <div style={{ fontSize: 19, fontWeight: 800, letterSpacing: '-.01em' }}>Learn</div>
          <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 1 }}>Grow ten times better</div>
        </div>

        <div style={{ padding: '14px 16px 100px', display: 'flex', flexDirection: 'column', gap: 18 }}>
          <div>
            <SectionHead title="This month's content" />
            {thisMonth.length === 0 ? (
              <EmptyState icon="bookopen" title="Nothing new this month" body="Check back soon — new content is added regularly." />
            ) : (
              <div className="member-learning-list" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {thisMonth.map(c => <ContentCard key={c.id} c={c} />)}
              </div>
            )}
          </div>

          {always.length > 0 && (
            <div>
              <SectionHead title="Always available" />
              <div className="member-learning-list" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {always.map(c => <ContentCard key={c.id} c={c} />)}
              </div>
            </div>
          )}

          {completed.length > 0 && (
            <div>
              <SectionHead title="Completed" />
              <div className="member-learning-list" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {completed.map(c => <ContentCard key={c.id} c={c} done />)}
              </div>
            </div>
          )}
        </div>
      </div>

      <BottomNav />
    </div>
  );
}

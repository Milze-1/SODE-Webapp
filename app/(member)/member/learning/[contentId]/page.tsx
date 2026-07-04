'use client';

import { useState, useEffect, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Image from 'next/image';
import { createClient, getAuthUser } from '@/lib/supabase';
import { awardPoints } from '@/lib/points';
import { Icon } from '@/components/sode/icons';
import { PillarChip, Toast, type ToastData } from '@/components/sode/ui';

const TYPE_ICON: Record<string, string> = { article: 'list', video: 'camera', podcast: 'message', book: 'bookopen', course: 'sparkles' };
const TYPE_LABEL: Record<string, string> = { article: 'Article', video: 'Video', podcast: 'Podcast', book: 'Book', course: 'Course' };

interface ContentDetail {
  id: string; title: string; content_type: string; description: string | null;
  author: string | null; url: string | null; thumbnail_url: string | null;
  pillar: string | null; estimated_minutes: number | null;
}

function getYoutubeEmbed(url: string): string | null {
  const m = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([\w-]{11})/);
  return m ? `https://www.youtube.com/embed/${m[1]}` : null;
}

function getSpotifyEmbed(url: string): string | null {
  const m = url.match(/open\.spotify\.com\/(episode|track|show)\/([\w]+)/);
  return m ? `https://open.spotify.com/embed/${m[1]}/${m[2]}` : null;
}

export default function LearningDetailPage() {
  const params = useParams();
  const router = useRouter();
  const contentId = String(params.contentId);

  const [loading, setLoading] = useState(true);
  const [memberId, setMemberId] = useState<string | null>(null);
  const [content, setContent] = useState<ContentDetail | null>(null);
  const [done, setDone] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [toast, setToast] = useState<ToastData | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = (msg: string, icon?: string) => {
    setToast({ msg, icon });
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2600);
  };

  useEffect(() => {
    (async () => {
      const supabase = createClient();
      const user = await getAuthUser();
      if (!user) { router.replace('/login'); return; }
      const { data: memberRow } = await supabase.from('members').select('id, onboarding_complete').eq('auth_id', user.id).maybeSingle();
      if (!memberRow?.onboarding_complete) { router.replace('/member/onboarding'); return; }
      setMemberId(memberRow.id);

      const [contentRes, completionRes] = await Promise.all([
        supabase.from('learning_content').select('id,title,content_type,description,author,url,thumbnail_url,pillar,estimated_minutes').eq('id', contentId).maybeSingle(),
        supabase.from('learning_completions').select('id').eq('content_id', contentId).eq('member_id', memberRow.id).maybeSingle(),
      ]);

      setContent((contentRes.data ?? null) as ContentDetail | null);
      setDone(!!completionRes.data);
      setLoading(false);
    })();
  }, [router, contentId]);

  const markComplete = async () => {
    if (!memberId || done) return;
    setCompleting(true);
    try {
      const supabase = createClient();
      const { data: inserted, error } = await supabase
        .from('learning_completions')
        .insert({ member_id: memberId, content_id: contentId })
        .select('id')
        .single();
      if (error) { showToast('Could not save — try again.'); return; }
      const awarded = await awardPoints(memberId, 'content_completed', 'learning_completions', inserted.id);
      setDone(true);
      showToast(awarded > 0 ? `Marked complete · +${awarded} points` : 'Marked complete', 'check');
    } finally {
      setCompleting(false);
    }
  };

  const share = async () => {
    const shareUrl = typeof window !== 'undefined' ? window.location.href : '';
    if (typeof navigator !== 'undefined' && navigator.share) {
      try { await navigator.share({ title: content?.title, url: shareUrl }); } catch { /* user cancelled */ }
    } else if (typeof navigator !== 'undefined' && navigator.clipboard) {
      try { await navigator.clipboard.writeText(shareUrl); showToast('Link copied', 'copy'); } catch { /* ignore */ }
    }
  };

  if (loading) {
    return (
      <div style={{ height: '100dvh', display: 'flex', flexDirection: 'column', background: 'var(--bg)' }}>
        <div style={{ flex: 1, padding: '72px 16px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
          {[200, 56, 56].map((h, i) => <div key={i} style={{ height: h, borderRadius: 'var(--r-md)', background: 'var(--surface-2)' }} />)}
        </div>
      </div>
    );
  }

  if (!content) {
    return (
      <div style={{ height: '100dvh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 14, background: 'var(--bg)' }}>
        <Icon name="info" size={28} color="var(--muted)" />
        <div style={{ fontSize: 14, color: 'var(--muted)' }}>Content not found.</div>
        <button onClick={() => router.push('/member/learning')} className="btn btn-ghost btn-sm">Back to learning</button>
      </div>
    );
  }

  const youtubeEmbed = content.url && (content.url.includes('youtube.com') || content.url.includes('youtu.be')) ? getYoutubeEmbed(content.url) : null;
  const spotifyEmbed = content.url && (content.url.includes('spotify.com') || content.url.includes('anchor.fm')) ? getSpotifyEmbed(content.url) : null;

  return (
    <div style={{ position: 'relative', height: '100dvh', display: 'flex', flexDirection: 'column', background: 'var(--bg)', overflow: 'hidden' }}>
      <div className="noscroll" style={{ flex: 1, overflowY: 'auto' }}>
        <div style={{ position: 'sticky', top: 0, zIndex: 20, background: 'rgba(255,255,255,.86)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)', borderBottom: '1px solid var(--line)', padding: '13px 16px 12px' }}>
          <button onClick={() => router.back()} style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--navy)', fontWeight: 600, fontSize: 13 }}>
            <Icon name="arrowleft" size={18} /> Back
          </button>
        </div>

        <div style={{ padding: '16px 16px 110px', display: 'flex', flexDirection: 'column', gap: 16 }}>
          {content.thumbnail_url && (
            <div style={{ width: '100%', height: 180, borderRadius: 'var(--r-md)', overflow: 'hidden', background: 'var(--surface-2)', position: 'relative' }}>
              <Image src={content.thumbnail_url} alt="" fill style={{ objectFit: 'cover' }} />
            </div>
          )}

          {youtubeEmbed && (
            <div style={{ width: '100%', aspectRatio: '16/9', borderRadius: 'var(--r-md)', overflow: 'hidden' }}>
              <iframe src={youtubeEmbed} style={{ width: '100%', height: '100%', border: 'none' }} allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen />
            </div>
          )}

          {spotifyEmbed && (
            <div style={{ width: '100%', borderRadius: 'var(--r-md)', overflow: 'hidden' }}>
              <iframe src={spotifyEmbed} style={{ width: '100%', height: 152, border: 'none' }} allow="encrypted-media" />
            </div>
          )}

          <div>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11.5, fontWeight: 700, color: 'var(--navy)', background: 'var(--navy-tint)', padding: '4px 9px', borderRadius: 999 }}>
              <Icon name={TYPE_ICON[content.content_type] ?? 'bookopen'} size={13} stroke={2.4} /> {TYPE_LABEL[content.content_type] ?? content.content_type}
            </span>
            <h1 style={{ fontSize: 21, fontWeight: 800, marginTop: 10, lineHeight: 1.3, letterSpacing: '-.01em' }}>{content.title}</h1>
            {content.author && <div style={{ fontSize: 13, color: 'var(--faint)', marginTop: 4 }}>{content.author}</div>}
            <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginTop: 10 }}>
              {content.pillar && <PillarChip pillar={content.pillar} size="sm" />}
              {content.estimated_minutes && (
                <span style={{ fontSize: 12, color: 'var(--muted)', display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                  <Icon name="clock" size={13} /> {content.estimated_minutes} min
                </span>
              )}
            </div>
            {content.description && <p style={{ fontSize: 14.5, lineHeight: 1.6, color: 'var(--ink)', marginTop: 14 }}>{content.description}</p>}
          </div>

          <div style={{ display: 'flex', gap: 10 }}>
            {content.url && (
              <a href={content.url} target="_blank" rel="noopener noreferrer" className="btn btn-outline btn-block" style={{ textDecoration: 'none' }}>
                Open content <Icon name="arrowupright" size={16} />
              </a>
            )}
            <button onClick={share} className="btn btn-ghost" style={{ flex: 'none', width: 48 }}>
              <Icon name="share" size={18} />
            </button>
          </div>

          <button onClick={markComplete} disabled={done || completing} className="btn btn-primary btn-block">
            {done ? <><Icon name="check" size={18} color="#fff" stroke={2.6} /> Completed</> : completing ? 'Saving…' : 'Mark as complete'}
          </button>
        </div>
      </div>

      <Toast toast={toast} />
    </div>
  );
}

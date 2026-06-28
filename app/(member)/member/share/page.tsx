'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase';
import { Icon, pillarOf } from '@/components/sode/icons';
import { Stat, Toast, EmptyState, Sheet } from '@/components/sode/ui';
import { CountdownRing } from '@/components/member/CountdownRing';
import BottomNav from '@/components/member/bottom-nav';

interface ToastPayload { msg: string; icon?: string; points?: number; }
interface PostRow {
  id: string; title: string; caption: string | null; pillar: string | null;
  canonical_link: string | null; status: string; hashtags: string[] | null;
  published_at: string | null; expires_at: string | null;
  share_count: number; platform_source: string | null;
}
interface ShareRow { post_id: string; platform: string; }

// ── Platform detection from canonical URL ────────────────────────────────────
function detectPlatform(url: string | null): string {
  if (!url) return 'other';
  const u = url.toLowerCase();
  if (u.includes('instagram.com'))                     return 'instagram';
  if (u.includes('wa.me') || u.includes('whatsapp.com')) return 'whatsapp';
  if (u.includes('facebook.com') || u.includes('fb.com')) return 'facebook';
  if (u.includes('twitter.com') || u.includes('x.com')) return 'x';
  if (u.includes('linkedin.com'))                      return 'linkedin';
  if (u.includes('youtube.com') || u.includes('youtu.be')) return 'youtube';
  if (u.includes('tiktok.com'))                        return 'tiktok';
  return 'other';
}

const PLATFORM_META: Record<string, { label: string; icon: string; color: string; hint?: string }> = {
  instagram: { label: 'Instagram',   icon: 'camera',    color: '#e1306c', hint: 'Copies caption + link to clipboard' },
  whatsapp:  { label: 'WhatsApp',    icon: 'message',   color: '#25d366' },
  facebook:  { label: 'Facebook',    icon: 'grid',      color: '#1877f2' },
  x:         { label: 'X / Twitter', icon: 'share',     color: '#000' },
  linkedin:  { label: 'LinkedIn',    icon: 'briefcase', color: '#0077b5' },
  youtube:   { label: 'YouTube',     icon: 'play',      color: '#ff0000' },
  tiktok:    { label: 'TikTok',      icon: 'play',      color: '#000' },
  other:     { label: 'Open post',   icon: 'link',      color: 'var(--navy)' },
};

const ALL_PLATFORM_KEYS = ['whatsapp', 'instagram', 'x', 'linkedin', 'facebook'];

function buildShareText(caption: string, hashtags: string[] | null, shareUrl: string): string {
  const parts: string[] = [];
  if (caption) parts.push(caption);
  if (hashtags && hashtags.length > 0) parts.push('', hashtags.join(' '));
  parts.push('', shareUrl);
  return parts.join('\n');
}

export default function SharePage() {
  const router = useRouter();
  const [loading, setLoading]         = useState(true);
  const [memberId, setMemberId]       = useState<string | null>(null);
  const [posts, setPosts]             = useState<PostRow[]>([]);
  const [shares, setShares]           = useState<ShareRow[]>([]);
  const [totalPoints, setTotalPoints] = useState(0);
  const [sharePoints, setSharePoints] = useState(10);
  const [toast, setToast]             = useState<ToastPayload | null>(null);
  const [shareSheet, setShareSheet]   = useState<{ post: PostRow; url: string; token: string } | null>(null);
  const [editCaption, setEditCaption] = useState('');
  const [sharing, setSharing]         = useState<string | null>(null);
  const [copied, setCopied]           = useState(false);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = (t: ToastPayload) => {
    setToast(t);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2800);
  };

  const loadData = useCallback(async () => {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.replace('/login'); return; }
    const { data: memberRow } = await supabase.from('members').select('id, onboarding_complete').eq('auth_id', user.id).maybeSingle();
    if (!memberRow?.onboarding_complete) { router.replace('/member/onboarding'); return; }
    setMemberId(memberRow.id);

    const now = new Date().toISOString();
    const [postsRes, sharesRes, pointRuleRes] = await Promise.all([
      supabase.from('advocacy_posts')
        .select('id,title,caption,pillar,canonical_link,status,hashtags,published_at,expires_at,share_count,platform_source')
        .eq('status', 'published')
        .or(`expires_at.is.null,expires_at.gt.${now}`)
        .order('published_at', { ascending: false })
        .limit(20),
      supabase.from('advocacy_shares').select('post_id,platform,points_awarded').eq('member_id', memberRow.id),
      supabase.from('point_rules').select('points').eq('rule_key', 'advocacy_share').maybeSingle(),
    ]);

    setPosts((postsRes.data ?? []) as PostRow[]);
    const shareRows = (sharesRes.data ?? []) as (ShareRow & { points_awarded?: number })[];
    setShares(shareRows);
    setTotalPoints(shareRows.reduce((sum, s) => sum + (s.points_awarded ?? sharePoints), 0));
    if (pointRuleRes.data?.points) setSharePoints(pointRuleRes.data.points);
    setLoading(false);
  }, [router, sharePoints]);

  useEffect(() => {
    loadData();
    const supabase = createClient();
    const channel = supabase.channel('advocacy-member')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'advocacy_posts' }, loadData)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [loadData]);

  const handleShareEarn = async (post: PostRow) => {
    if (!memberId || sharing === post.id) return;
    setSharing(post.id);
    try {
      const res = await fetch('/api/advocacy/share', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ post_id: post.id }),
      });
      const json = await res.json() as { share_url?: string; token?: string };
      const shareUrl = json.share_url ?? (post.canonical_link || window.location.href);
      const token    = json.token ?? '';

      setShares(s => [...s, { post_id: post.id, platform: 'direct' }]);
      setTotalPoints(pts => pts + sharePoints);
      showToast({ msg: `+${sharePoints} pts earned!`, icon: 'zap', points: sharePoints });

      // Build initial editable caption
      const initialCaption = buildShareText(post.caption ?? '', post.hashtags, shareUrl);
      setEditCaption(initialCaption);
      setShareSheet({ post, url: shareUrl, token });
    } catch {
      showToast({ msg: 'Could not create share link — try again.' });
    } finally {
      setSharing(null);
    }
  };

  const handlePlatformShare = async (platform: string) => {
    if (!shareSheet) return;
    const { post, url } = shareSheet;
    const text = editCaption || buildShareText(post.caption ?? '', post.hashtags, url);

    if (platform === 'instagram') {
      await navigator.clipboard.writeText(text).catch(() => {});
      showToast({ msg: 'Caption copied! Paste it in your Instagram story or post.', icon: 'check' });
      window.open('https://instagram.com', '_blank');
      return;
    }
    if (platform === 'copy') {
      await navigator.clipboard.writeText(url).catch(() => {});
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      showToast({ msg: 'Link copied!', icon: 'check' });
      return;
    }
    if (platform === 'whatsapp') {
      window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
      return;
    }
    if (platform === 'x') {
      window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(post.caption ?? '')}&url=${encodeURIComponent(url)}`, '_blank');
      return;
    }
    if (platform === 'linkedin') {
      window.open(`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`, '_blank');
      return;
    }
    if (platform === 'facebook') {
      window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`, '_blank');
      return;
    }
    if (platform === 'other' && post.canonical_link) {
      window.open(post.canonical_link, '_blank');
    }
  };

  if (loading) {
    return (
      <div style={{ height: '100dvh', display: 'flex', flexDirection: 'column', background: 'var(--bg)' }}>
        <div style={{ flex: 1, padding: '72px 16px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
          {[72, 180, 180].map((h, i) => <div key={i} style={{ height: h, borderRadius: 'var(--r-md)', background: 'var(--surface-2)' }} />)}
        </div>
      </div>
    );
  }

  return (
    <div className="member-page" style={{ position: 'relative', height: '100dvh', display: 'flex', flexDirection: 'column', background: 'var(--bg)', overflow: 'hidden' }}>
      <div className="noscroll member-scroll" style={{ flex: 1, overflowY: 'auto' }}>
        {/* Header */}
        <div style={{ position: 'sticky', top: 0, zIndex: 20, background: 'rgba(255,255,255,.86)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)', borderBottom: '1px solid var(--line)', padding: '13px 16px 12px' }}>
          <div style={{ fontSize: 19, fontWeight: 800, letterSpacing: '-.01em' }}>Share</div>
          <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 1 }}>Help the message travel</div>
        </div>

        <div style={{ padding: '14px 16px 100px', display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Stats */}
          <div className="card card-pad" style={{ display: 'flex', justifyContent: 'space-around' }}>
            <Stat value={shares.length} label="Shares" align="center" />
            <div style={{ width: 1, background: 'var(--line)' }} />
            <Stat value={totalPoints} label="Points earned" align="center" />
          </div>

          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink-2)' }}>Share &amp; we&apos;ll count every click</div>

          {posts.length === 0 ? (
            <EmptyState icon="share" title="Nothing to share yet" body="Your leadership team will post content to share here soon." />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {posts.map(post => {
                const p           = post.pillar ? pillarOf(post.pillar) : null;
                const myShares    = shares.filter(s => s.post_id === post.id);
                const alreadyShared = myShares.length > 0;
                const isSharing   = sharing === post.id;
                const platform    = detectPlatform(post.canonical_link);
                const pm          = PLATFORM_META[platform] ?? PLATFORM_META.other;

                return (
                  <div key={post.id} className="card" style={{ overflow: 'hidden' }}>
                    {/* Banner */}
                    <div style={{ height: 120, background: p ? `linear-gradient(135deg, ${p.raw ?? p.color}, var(--navy))` : 'var(--navy)', position: 'relative', display: 'flex', alignItems: 'flex-end', padding: 12 }}>
                      {p && <div style={{ position: 'absolute', right: -10, top: -10, opacity: .16 }}><Icon name={p.icon} size={96} color="#fff" stroke={1.5} /></div>}
                      {post.published_at && post.expires_at && (
                        <div style={{ position: 'relative', zIndex: 1 }}>
                          <CountdownRing publishedAt={post.published_at} expiresAt={post.expires_at} size={44} />
                        </div>
                      )}
                      {/* Platform source badge */}
                      {pm.label !== 'Open post' && (
                        <div style={{ position: 'absolute', top: 10, right: 12, display: 'flex', alignItems: 'center', gap: 5, padding: '4px 9px', borderRadius: 99, background: 'rgba(0,0,0,.45)', backdropFilter: 'blur(6px)' }}>
                          <Icon name={pm.icon} size={12} color="#fff" />
                          <span style={{ fontSize: 11, color: '#fff', fontWeight: 700 }}>{pm.label}</span>
                        </div>
                      )}
                    </div>

                    <div style={{ padding: 14 }}>
                      <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap', marginBottom: 8 }}>
                        {post.pillar && (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 9px', borderRadius: 99, background: 'var(--navy-tint)', color: 'var(--navy)', fontSize: 11.5, fontWeight: 700, textTransform: 'capitalize' }}>
                            {post.pillar}
                          </span>
                        )}
                        {post.platform_source && post.platform_source !== platform && (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 9px', borderRadius: 99, background: 'var(--surface-2)', color: 'var(--muted)', fontSize: 11.5, fontWeight: 600, textTransform: 'capitalize' }}>
                            {post.platform_source}
                          </span>
                        )}
                      </div>

                      <div style={{ fontSize: 14.5, fontWeight: 700, lineHeight: 1.3, marginBottom: 6 }}>{post.title}</div>
                      {post.caption && (
                        <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 12, lineHeight: 1.4, display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                          {post.caption}
                        </div>
                      )}

                      <button
                        onClick={() => handleShareEarn(post)}
                        disabled={isSharing}
                        className="btn btn-primary btn-block"
                        style={{ height: 42, fontSize: 14, fontWeight: 700, borderRadius: 10, marginBottom: alreadyShared ? 8 : 0, opacity: isSharing ? 0.7 : 1, background: pm.color !== 'var(--navy)' ? pm.color : undefined }}
                      >
                        {isSharing ? (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                            <span style={{ width: 14, height: 14, border: '2px solid rgba(255,255,255,.4)', borderTopColor: '#fff', borderRadius: '50%', animation: 'sode-spin .7s linear infinite', display: 'inline-block' }} />
                            Creating link…
                          </span>
                        ) : (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}>
                            <Icon name={pm.icon} size={16} color="#fff" />
                            {alreadyShared ? 'Share again' : `Share on ${pm.label}`} &amp; earn <span style={{ fontWeight: 900 }}>+{sharePoints} pts</span>
                          </span>
                        )}
                      </button>

                      {alreadyShared && (
                        <div style={{ fontSize: 11.5, color: 'var(--faint)', textAlign: 'center' }}>
                          {myShares.length} share{myShares.length > 1 ? 's' : ''} by you ✓
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Smart share sheet */}
      <Sheet open={!!shareSheet} onClose={() => setShareSheet(null)} title="Share this post">
        {shareSheet && (() => {
          const { post } = shareSheet;
          const platform = detectPlatform(post.canonical_link);
          const primaryMeta = PLATFORM_META[platform] ?? PLATFORM_META.other;

          return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {/* Post preview */}
              <div style={{ display: 'flex', gap: 10, padding: '10px 12px', borderRadius: 10, background: 'var(--surface)', border: '1px solid var(--line-2)' }}>
                <div style={{ width: 40, height: 40, borderRadius: 8, background: 'var(--navy)', display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}>
                  <Icon name={primaryMeta.icon} size={18} color="#fff" />
                </div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 700, lineHeight: 1.3 }}>{post.title}</div>
                  {post.canonical_link && <div style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{post.canonical_link}</div>}
                </div>
              </div>

              {/* Editable caption */}
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--muted)', marginBottom: 6 }}>Your message (edit before sharing)</div>
                <textarea
                  value={editCaption}
                  onChange={e => setEditCaption(e.target.value)}
                  rows={5}
                  style={{ width: '100%', borderRadius: 10, border: '1.5px solid var(--line-2)', background: 'var(--surface)', fontSize: 13, fontFamily: 'var(--font)', color: 'var(--ink)', outline: 'none', padding: '10px 12px', resize: 'vertical', lineHeight: 1.5, boxSizing: 'border-box' }}
                />
              </div>

              {/* Primary platform CTA */}
              <button
                type="button"
                onClick={() => handlePlatformShare(platform)}
                style={{ display: 'flex', alignItems: 'center', gap: 13, padding: '14px 16px', borderRadius: 12, background: primaryMeta.color, border: 'none', textAlign: 'left', cursor: 'pointer' }}
              >
                <div style={{ width: 40, height: 40, borderRadius: 10, background: 'rgba(255,255,255,.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}>
                  <Icon name={primaryMeta.icon} size={20} color="#fff" stroke={2} />
                </div>
                <div>
                  <div style={{ fontSize: 14.5, fontWeight: 800, color: '#fff' }}>Open {primaryMeta.label}</div>
                  <div style={{ fontSize: 12, color: 'rgba(255,255,255,.8)', marginTop: 1 }}>
                    {platform === 'instagram' ? 'Caption copied — paste it in your post' : `Share directly on ${primaryMeta.label}`}
                  </div>
                </div>
              </button>

              {/* All other platforms */}
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--muted)' }}>Or share to:</div>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                {ALL_PLATFORM_KEYS.filter(k => k !== platform).map(key => {
                  const m = PLATFORM_META[key];
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => handlePlatformShare(key)}
                      style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 14px', borderRadius: 99, background: 'var(--surface)', border: '1px solid var(--line-2)', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}
                    >
                      <div style={{ width: 22, height: 22, borderRadius: 6, background: m.color, display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}>
                        <Icon name={m.icon} size={12} color="#fff" stroke={2} />
                      </div>
                      {m.label}
                    </button>
                  );
                })}
                <button
                  type="button"
                  onClick={() => handlePlatformShare('copy')}
                  style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 14px', borderRadius: 99, background: 'var(--surface)', border: '1px solid var(--line-2)', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}
                >
                  <Icon name="link" size={14} color="var(--navy)" />
                  {copied ? 'Copied!' : 'Copy link'}
                </button>
              </div>

              <p style={{ fontSize: 12, color: 'var(--faint)', textAlign: 'center', lineHeight: 1.4 }}>
                Every click on your link earns you more points.
              </p>

              <button className="btn btn-ghost btn-block" style={{ height: 42 }} onClick={() => setShareSheet(null)}>
                Done
              </button>
            </div>
          );
        })()}
      </Sheet>

      <BottomNav />
      <Toast toast={toast} />
    </div>
  );
}

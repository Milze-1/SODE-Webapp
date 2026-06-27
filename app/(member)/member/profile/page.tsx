'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase';
import Image from 'next/image';
import { Icon } from '@/components/sode/icons';
import { Avatar, Toggle, Segmented, Field, TextInput, Sheet, Toast } from '@/components/sode/ui';
import BottomNav from '@/components/member/bottom-nav';
import { usePoints } from '@/lib/hooks/useRealtimeData';

interface ToastPayload { msg: string; icon?: string; }

interface MemberData {
  id: string; name: string; email: string | null; whatsapp: string | null;
  life_stage: string | null; department: string | null; points: number;
  consent_contact: boolean; leaderboard_opt_in: boolean;
}

function SettingRow({ icon, title, sub, right, onClick, danger = false }: { icon: string; title: string; sub?: string; right?: React.ReactNode; onClick?: () => void; danger?: boolean }) {
  return (
    <button onClick={onClick} style={{ display: 'flex', alignItems: 'center', gap: 13, padding: '14px 14px', width: '100%', textAlign: 'left', background: 'transparent' }}>
      <div style={{ width: 36, height: 36, borderRadius: 10, background: danger ? '#fff' : 'var(--surface-2)', color: danger ? 'var(--ink)' : 'var(--navy)', display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none', border: danger ? '1px solid var(--line-2)' : 'none' }}>
        <Icon name={icon} size={19} stroke={2} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14.5, fontWeight: 600 }}>{title}</div>
        {sub && <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 1 }}>{sub}</div>}
      </div>
      {right ?? (onClick && <Icon name="chevronright" size={18} color="var(--faint)" />)}
    </button>
  );
}

export default function ProfilePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [member, setMember] = useState<MemberData | null>(null);
  const { balance: liveBalance } = usePoints(member?.id ?? '');
  const [authEmail, setAuthEmail] = useState<string | null>(null);
  const [rank, setRank] = useState(0);
  const [optIn, setOptIn] = useState(true);
  const [nameMode, setNameMode] = useState('full');
  const [whatsappOn, setWhatsappOn] = useState(true);
  const [editSheet, setEditSheet] = useState(false);
  const [editName, setEditName] = useState('');
  const [editWa, setEditWa] = useState('');
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<ToastPayload | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = (t: ToastPayload) => {
    setToast(t);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2600);
  };

  useEffect(() => {
    (async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.replace('/login'); return; }
      setAuthEmail(user.email ?? null);
      const { data: memberRow } = await supabase.from('members').select('id,name,email,whatsapp,life_stage,department,points,consent_contact,leaderboard_opt_in,onboarding_complete').eq('auth_id', user.id).maybeSingle();
      if (!memberRow?.onboarding_complete) { router.replace('/member/onboarding'); return; }

      const { count: rankCount } = await supabase.from('members').select('id', { count: 'exact', head: true }).gt('points', memberRow.points ?? 0);

      setMember(memberRow as MemberData);
      setOptIn(memberRow.leaderboard_opt_in ?? true);
      setWhatsappOn(memberRow.consent_contact ?? false);
      setRank((rankCount ?? 0) + 1);
      setLoading(false);
    })();
  }, [router]);

  const openEdit = () => {
    setEditName(member?.name ?? '');
    setEditWa(member?.whatsapp ?? '');
    setEditSheet(true);
  };

  const saveEdit = async () => {
    if (!member) return;
    setSaving(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.from('members').update({ name: editName.trim(), whatsapp: editWa.trim() || null }).eq('id', member.id);
      if (error) throw error;
      setMember(m => m ? { ...m, name: editName.trim(), whatsapp: editWa.trim() || null } : m);
      setEditSheet(false);
      showToast({ msg: 'Profile updated.', icon: 'check' });
    } catch {
      showToast({ msg: 'Could not save — try again.' });
    } finally { setSaving(false); }
  };

  const toggleOptIn = async (v: boolean) => {
    setOptIn(v);
    if (!member) return;
    const supabase = createClient();
    await supabase.from('members').update({ leaderboard_opt_in: v }).eq('id', member.id);
  };

  const toggleWhatsapp = async (v: boolean) => {
    setWhatsappOn(v);
    if (!member) return;
    const supabase = createClient();
    await supabase.from('members').update({ consent_contact: v }).eq('id', member.id);
  };

  const [signingOut, setSigningOut] = useState(false);
  const [exporting, setExporting] = useState(false);

  const signOut = async () => {
    setSigningOut(true);
    const supabase = createClient();
    await supabase.auth.signOut();
    router.replace('/login');
  };

  const exportData = async () => {
    if (!member?.id || exporting) return;
    setExporting(true);
    showToast({ msg: 'Preparing your export…' });
    try {
      const supabase = createClient();
      const [profileRes, pointsRes, goalsRes, devotionRes, referralsRes] = await Promise.all([
        supabase.from('members').select('*').eq('id', member.id).single(),
        supabase.from('point_events').select('rule_key,points,note,created_at').eq('member_id', member.id).order('created_at', { ascending: false }).limit(20),
        supabase.from('goals').select('*').eq('member_id', member.id),
        supabase.from('devotion_checkins').select('*').eq('member_id', member.id).order('checkin_date', { ascending: false }),
        supabase.from('invitations').select('name,email,phone,stage,created_at').eq('inviter_id', member.id).order('created_at', { ascending: false }),
      ]);

      const profile = (profileRes.data ?? {}) as Record<string, unknown>;
      const points  = (pointsRes.data   ?? []) as Array<{ rule_key: string; points: number; note: string | null; created_at: string }>;
      const goals   = (goalsRes.data    ?? []) as Array<{ pillar: string | null; title: string; current: number | null; target: number | null; unit: string | null; due_date: string | null; status: string | null }>;
      const devs    = (devotionRes.data ?? []) as Array<{ checkin_date?: string | null; entry_date?: string | null; completed?: boolean; checklist?: Record<string, boolean> | null }>;
      const refs    = (referralsRes.data ?? []) as Array<{ name?: string | null; email: string | null; phone?: string | null; stage: string; created_at: string }>;

      const totalPts   = liveBalance?.total_points ?? member.points ?? 0;
      const exportedAt = new Date().toISOString();
      const exportDate = exportedAt.slice(0, 10);
      const firstName  = (member.name ?? 'member').split(' ')[0].toLowerCase().replace(/[^a-z0-9]/g, '');

      const esc  = (s: unknown): string =>
        String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
      const fmtD = (d: string | null | undefined): string =>
        d ? new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';

      const RULE_LABELS: Record<string, string> = {
        win_logged: 'Win logged', goal_created: 'Goal created', goal_completed: 'Goal completed',
        form_submitted: 'Form submitted', session_attended: 'Session attended', attendance_present: 'Session attended',
        referral_joined: 'Referral joined', referral_attended: 'Referral attended',
        referral_five_meetings: 'Referral — 5 meetings', advocacy_shared: 'Shared SODE',
        content_completed: 'Learning completed', member_joined: 'Joined via referral',
        leaderboard_reset: 'Cycle reset',
      };
      const PILLAR_COLOR: Record<string, string> = {
        spiritual: '#8B5CF6', career: '#0EA5E9', business: '#10B981', character: '#F59E0B',
      };

      const profileFields: [string, unknown][] = [
        ['Full name',      profile.name],
        ['Email',          profile.email],
        ['WhatsApp',       profile.whatsapp],
        ['Life stage',     String(profile.life_stage ?? '').replace(/_/g, ' ') || null],
        ['Industry',       profile.industry],
        ['Career stage',   String(profile.career_stage ?? '').replace(/_/g, ' ') || null],
        ['Department',     profile.department],
        ['Leadership role',profile.leadership_role],
        ['Strength area',  profile.strength_area],
        ['Member since',   fmtD(profile.created_at as string | null)],
      ];
      const mountains = Array.isArray(profile.mountains) ? (profile.mountains as string[]) : [];

      const profileHtml = profileFields
        .filter(([, v]) => v != null && v !== '')
        .map(([l, v]) => `<div class="field"><span class="label">${esc(l)}</span><span class="value">${esc(v)}</span></div>`)
        .join('\n  ');

      const mountainsHtml = mountains.length > 0
        ? `<h2>Mountains of Influence</h2>\n  <div>${mountains.map(m => `<span class="chip">${esc(m)}</span>`).join(' ')}</div>`
        : '';

      const pointsHtml = points.length === 0
        ? '<p style="color:#888;font-size:13px">No point events recorded.</p>'
        : points.slice(0, 10).map(e =>
            `<div class="point-row"><span>${esc(RULE_LABELS[e.rule_key] ?? e.rule_key.replace(/_/g, ' '))}${e.note ? ` <span style="color:#aaa">· ${esc(e.note)}</span>` : ''}</span><span style="font-weight:700;color:#534AB7">+${e.points}</span><span style="color:#aaa;margin-left:12px;font-size:12px">${fmtD(e.created_at)}</span></div>`
          ).join('\n  ');

      const goalsHtml = goals.length === 0
        ? '<p style="color:#888;font-size:13px">No goals set.</p>'
        : goals.map(g => {
            const color = PILLAR_COLOR[g.pillar ?? ''] ?? '#888';
            return `<div class="goal-card"><div class="goal-title">${esc(g.title)}</div><div class="goal-meta">${g.pillar ? `<span class="tag" style="background:${color}20;color:${color}">${esc(g.pillar)}</span> ` : ''}<span class="tag">${esc(g.status ?? 'active')}</span>${g.target != null ? ` · ${esc(g.current ?? 0)} / ${esc(g.target)} ${esc(g.unit ?? '')}` : ''}${g.due_date ? ` · Due ${fmtD(g.due_date)}` : ''}</div></div>`;
          }).join('\n  ');

      const devotionHtml = devs.length === 0
        ? '<p style="color:#888;font-size:13px">No devotion entries recorded.</p>'
        : `<p style="font-size:13px;color:#555">${devs.length} total check-in${devs.length !== 1 ? 's' : ''}</p>\n  ` +
          devs.slice(0, 7).map(d => {
            const dateStr = d.checkin_date ?? d.entry_date ?? null;
            const cl = d.checklist;
            const done  = cl ? Object.values(cl).filter(Boolean).length : (d.completed ? 1 : 0);
            const total = cl ? Object.keys(cl).length : 1;
            return `<div class="dev-row"><span style="min-width:110px;color:#888">${fmtD(dateStr)}</span><span>${done}/${total} completed</span></div>`;
          }).join('\n  ');

      const refsHtml = refs.length === 0
        ? '<p style="color:#888;font-size:13px">No referrals sent yet.</p>'
        : refs.map(r =>
            `<div class="ref-row"><span style="font-weight:600;min-width:140px">${esc(r.name ?? r.email)}</span><span class="tag">${esc(r.stage.replace(/_/g, ' '))}</span><span style="color:#aaa;margin-left:auto;font-size:12px">${fmtD(r.created_at)}</span></div>`
          ).join('\n  ');

      const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>My SODE Profile — ${esc(member.name)}</title>
  <style>
    body { font-family: system-ui, -apple-system, sans-serif; max-width: 700px; margin: 40px auto; color: #1a1a2e; padding: 0 24px; }
    .logo { font-size: 20px; font-weight: 700; color: #1a1a2e; margin-bottom: 4px; }
    .logo span { color: #534AB7; }
    .subtitle { font-size: 13px; color: #888; margin-bottom: 32px; }
    h2 { font-size: 15px; font-weight: 600; color: #534AB7; border-bottom: 1px solid #eee; padding-bottom: 6px; margin-top: 32px; }
    .field { display: flex; gap: 12px; margin-bottom: 8px; font-size: 13px; }
    .label { color: #888; min-width: 160px; }
    .value { font-weight: 500; }
    .chip { display: inline-block; background: #EEEDFE; color: #3C3489; border-radius: 20px; padding: 2px 10px; font-size: 12px; margin: 2px; }
    .goal-card { border: 1px solid #eee; border-radius: 8px; padding: 12px 16px; margin-bottom: 10px; font-size: 13px; }
    .goal-title { font-weight: 600; margin-bottom: 4px; }
    .goal-meta { color: #888; font-size: 12px; }
    .point-row { display: flex; justify-content: space-between; font-size: 13px; padding: 6px 0; border-bottom: 1px solid #f5f5f5; }
    .total { font-size: 24px; font-weight: 700; color: #534AB7; }
    .footer { margin-top: 48px; font-size: 12px; color: #bbb; text-align: center; }
    .tag { background: #f0f0f0; border-radius: 4px; padding: 2px 8px; font-size: 12px; color: #555; display: inline-block; }
    .ref-row { font-size: 13px; padding: 8px 0; border-bottom: 1px solid #f5f5f5; display: flex; gap: 12px; align-items: baseline; }
    .dev-row { font-size: 13px; padding: 6px 0; border-bottom: 1px solid #f5f5f5; display: flex; gap: 12px; }
  </style>
</head>
<body>
  <div class="logo">S·<span>DE</span> SCHOOL OF DANIELS &amp; ESTHERS</div>
  <div class="subtitle">Connected to Dominion City · Victoria Island, Lagos · Exported ${exportDate}</div>

  <h2>Profile</h2>
  ${profileHtml}

  ${mountainsHtml}

  <h2>Points — <span class="total">${totalPts.toLocaleString()} pts</span></h2>
  ${pointsHtml}

  <h2>My Goals (${goals.length})</h2>
  ${goalsHtml}

  <h2>Devotion Log</h2>
  ${devotionHtml}

  <h2>Referrals Sent (${refs.length})</h2>
  ${refsHtml}

  <div class="footer">Exported from app.thesode.org · ${esc(exportedAt)}</div>
</body>
</html>`;

      const blob = new Blob([html], { type: 'text/html' });
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href     = url;
      a.download = `sode-report-${firstName}-${exportDate}.html`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      showToast({ msg: 'Report downloaded!', icon: 'check' });
    } catch {
      showToast({ msg: 'Export failed — please try again.' });
    } finally {
      setExporting(false);
    }
  };

  if (loading) {
    return (
      <div style={{ height: '100dvh', display: 'flex', flexDirection: 'column', background: 'var(--bg)' }}>
        <div style={{ flex: 1, padding: '72px 16px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
          {[88, 100, 100, 56].map((h, i) => <div key={i} style={{ height: h, borderRadius: 'var(--r-md)', background: 'var(--surface-2)' }} />)}
        </div>
      </div>
    );
  }

  const displayEmail = member?.email || authEmail || '';

  const displayName = (name: string) => {
    if (nameMode === 'full') return name;
    if (nameMode === 'first') { const [f, ...r] = name.split(' '); return r.length ? `${f} ${r[0][0]}.` : f; }
    return 'Member';
  };

  return (
    <div className="member-page" style={{ position: 'relative', height: '100dvh', display: 'flex', flexDirection: 'column', background: 'var(--bg)', overflow: 'hidden' }}>
      <div className="noscroll" style={{ flex: 1, overflowY: 'auto' }}>
        <div style={{ position: 'sticky', top: 0, zIndex: 20, background: 'rgba(255,255,255,.86)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)', borderBottom: '1px solid var(--line)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '13px 16px 12px' }}>
            <div style={{ fontSize: 19, fontWeight: 800, letterSpacing: '-.01em' }}>You</div>
            <button onClick={openEdit} style={{ width: 38, height: 38, borderRadius: '50%', background: 'var(--surface)', color: 'var(--navy)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Icon name="pencil" size={18} />
            </button>
          </div>
        </div>

        <div style={{ padding: '14px 16px 100px', display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* identity */}
          <div className="card card-pad" style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <Avatar name={member?.name ?? ''} size={62} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 18, fontWeight: 800, letterSpacing: '-.01em' }}>{member?.name ?? ''}</div>
              <div style={{ fontSize: 13, color: 'var(--muted)', marginTop: 2 }}>
                {member?.life_stage?.replace(/_/g, ' ') ?? ''}
                {member?.life_stage && member.department ? ' · ' : ''}
                {member?.department ?? ''}
              </div>
              {member?.department && (
                <div style={{ marginTop: 8, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  <span className="chip">{member.department}</span>
                </div>
              )}
            </div>
          </div>

          {/* points + rank */}
          <div className="card card-pad">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <div className="tnum" style={{ fontSize: 26, fontWeight: 800, letterSpacing: '-.02em' }}>{(liveBalance?.total_points ?? member?.points ?? 0).toLocaleString()}</div>
                <div style={{ fontSize: 12, color: 'var(--muted)' }}>total points</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div className="tnum" style={{ fontSize: 26, fontWeight: 800, letterSpacing: '-.02em' }}>#{rank}</div>
                <div style={{ fontSize: 12, color: 'var(--muted)' }}>this month</div>
              </div>
            </div>
          </div>

          {/* leaderboard privacy */}
          <div className="card" style={{ overflow: 'hidden' }}>
            <div style={{ padding: '14px 14px 4px' }}><div className="eyebrow">Leaderboard privacy</div></div>
            <SettingRow icon="trophy" title="Appear on the leaderboard" sub={optIn ? 'Members-only board' : 'Hidden — you still see your own rank'} right={<Toggle on={optIn} onChange={toggleOptIn} />} />
            {optIn && (
              <div style={{ padding: '4px 14px 16px' }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink-2)', marginBottom: 9 }}>Show my name as</div>
                <Segmented options={[{ value: 'full', label: 'Full name' }, { value: 'first', label: 'First + initial' }, { value: 'alias', label: 'Alias' }]} value={nameMode} onChange={setNameMode} size="sm" />
                <div style={{ fontSize: 11.5, color: 'var(--faint)', marginTop: 8 }}>
                  Preview: <b style={{ color: 'var(--ink-2)' }}>{member ? displayName(member.name) : ''}</b>
                </div>
              </div>
            )}
          </div>

          {/* contact information */}
          <div className="card" style={{ overflow: 'hidden' }}>
            <div style={{ padding: '14px 14px 4px' }}><div className="eyebrow">Contact information</div></div>
            <SettingRow icon="mail" title="Email" sub={displayEmail || 'Not set'} />
            <hr className="divider" />
            <SettingRow icon="message" title="Phone number" sub={member?.whatsapp || 'Not set'} onClick={openEdit} />
          </div>

          {/* contact & consent */}
          <div className="card" style={{ overflow: 'hidden' }}>
            <div style={{ padding: '14px 14px 4px' }}><div className="eyebrow">Contact &amp; consent</div></div>
            <SettingRow icon="message" title="WhatsApp updates" sub="Reminders &amp; celebrate moments" right={<Toggle on={whatsappOn} onChange={toggleWhatsapp} />} />
            <hr className="divider" />
            <SettingRow icon="info" title="How your data is used" sub="Plain-language NDPA summary" onClick={() => showToast({ msg: 'Privacy summary coming soon.' })} />
          </div>

          {/* settings & account */}
          <div className="card" style={{ overflow: 'hidden' }}>
            <SettingRow icon="settings" title="Settings" sub="Password, notifications, privacy" onClick={() => router.push('/member/settings')} />
            <hr className="divider" />
            <SettingRow icon="download" title="Export my data" sub={exporting ? 'Preparing…' : undefined} onClick={exportData} />
            <hr className="divider" />
            <SettingRow icon="x" title="Request account deletion" danger onClick={() => showToast({ msg: 'Request noted — our team will follow up.' })} />
          </div>

          <button
            onClick={signOut}
            disabled={signingOut}
            className="btn btn-outline btn-block"
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
          >
            {signingOut ? (
              <>
                <span style={{ width: 15, height: 15, border: '2px solid var(--line-2)', borderTopColor: 'var(--navy)', borderRadius: '50%', animation: 'sode-spin .7s linear infinite', display: 'inline-block' }} />
                Signing out…
              </>
            ) : 'Sign out'}
          </button>

          <div style={{ textAlign: 'center', marginTop: 4 }}>
            <Image src="/images/sode-primary-logo.png" alt="SODE" width={80} height={56} className="object-contain" />
            <div style={{ fontSize: 11, color: 'var(--faint)', marginTop: 8 }}>Spiritually deep. Excellent in the marketplace.</div>
          </div>
        </div>
      </div>

      <BottomNav />

      <Sheet open={editSheet} onClose={() => setEditSheet(false)} title="Edit profile">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <Field label="Full name">
            <TextInput value={editName} onChange={setEditName} placeholder="Your name" />
          </Field>
          <Field label="WhatsApp number">
            <TextInput value={editWa} onChange={setEditWa} placeholder="080…" icon="message" />
          </Field>
          <button onClick={saveEdit} disabled={saving || !editName.trim()} className="btn btn-primary btn-block btn-lg" style={{ marginTop: 8 }}>
            {saving ? 'Saving…' : 'Save changes'}
          </button>
        </div>
      </Sheet>

      <Toast toast={toast} />
    </div>
  );
}

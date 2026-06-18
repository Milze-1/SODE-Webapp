'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase';
import Image from 'next/image';
import { Icon } from '@/components/sode/icons';
import { Avatar, Toggle, Segmented, Field, TextInput, Sheet, Toast } from '@/components/sode/ui';
import BottomNav from '@/components/member/bottom-nav';

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

  const signOut = async () => {
    setSigningOut(true);
    const supabase = createClient();
    await supabase.auth.signOut();
    router.replace('/login');
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
                <div className="tnum" style={{ fontSize: 26, fontWeight: 800, letterSpacing: '-.02em' }}>{(member?.points ?? 0).toLocaleString()}</div>
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
            <SettingRow icon="download" title="Export my data" onClick={() => showToast({ msg: 'Preparing your export…' })} />
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

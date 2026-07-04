'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { createClient, getAuthUser } from '@/lib/supabase';
import { Icon } from '@/components/sode/icons';
import { Toggle, Toast } from '@/components/sode/ui';
import BottomNav from '@/components/member/bottom-nav';

interface ToastPayload { msg: string; icon?: string; }

interface MemberData {
  id: string;
  name: string;
  email: string | null;
  whatsapp: string | null;
  consent_contact: boolean;
  leaderboard_opt_in: boolean;
}

function SectionLabel({ label }: { label: string }) {
  return (
    <div style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.06em', padding: '0 4px', marginBottom: 4 }}>
      {label}
    </div>
  );
}

function SettingRow({ icon, title, sub, right, onClick, chevron = true }: {
  icon: string; title: string; sub?: string;
  right?: React.ReactNode; onClick?: () => void; chevron?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!onClick && !right}
      style={{ display: 'flex', alignItems: 'center', gap: 13, padding: '13px 16px', width: '100%', textAlign: 'left', background: 'transparent', cursor: onClick ? 'pointer' : 'default' }}
    >
      <div style={{ width: 34, height: 34, borderRadius: 9, background: 'var(--surface-2)', color: 'var(--navy)', display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}>
        <Icon name={icon} size={17} stroke={2} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14.5, fontWeight: 600 }}>{title}</div>
        {sub && <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 1 }}>{sub}</div>}
      </div>
      {right ?? (chevron && onClick && <Icon name="chevronright" size={18} color="var(--faint)" />)}
    </button>
  );
}

function Divider() {
  return <div style={{ height: 1, background: 'var(--line)', margin: '0 16px' }} />;
}

export default function SettingsPage() {
  const router = useRouter();
  const [member, setMember]         = useState<MemberData | null>(null);
  const [authEmail, setAuthEmail]   = useState('');
  const [loading, setLoading]       = useState(true);
  const [signingOut, setSigningOut] = useState(false);
  const [toast, setToast]           = useState<ToastPayload | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Notification prefs
  const [emailOn, setEmailOn]       = useState(true);
  const [whatsappOn, setWhatsappOn] = useState(false);

  // Privacy prefs
  const [leaderboard, setLeaderboard] = useState(true);
  const [nameMode, setNameMode]       = useState('full');

  // WhatsApp inline edit
  const [showWaEdit, setShowWaEdit] = useState(false);
  const [editWa, setEditWa]         = useState('');
  const [savingWa, setSavingWa]     = useState(false);

  // Change password
  const [showPw, setShowPw]         = useState(false);
  const [currentPw, setCurrentPw]   = useState('');
  const [newPw, setNewPw]           = useState('');
  const [confirmPw, setConfirmPw]   = useState('');
  const [showPwVis, setShowPwVis]   = useState(false);
  const [pwLoading, setPwLoading]   = useState(false);

  const showToast = (t: ToastPayload) => {
    setToast(t);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2800);
  };

  useEffect(() => {
    (async () => {
      const supabase = createClient();
      const user = await getAuthUser();
      if (!user) { router.replace('/login'); return; }
      setAuthEmail(user.email ?? '');
      const { data: row } = await supabase
        .from('members')
        .select('id,name,email,whatsapp,consent_contact,leaderboard_opt_in,onboarding_complete')
        .eq('auth_id', user.id)
        .maybeSingle();
      if (!row?.onboarding_complete) { router.replace('/member/onboarding'); return; }
      setMember(row as MemberData);
      setWhatsappOn(row.consent_contact ?? false);
      setLeaderboard(row.leaderboard_opt_in ?? true);
      setLoading(false);
    })();
  }, [router]);

  const saveWhatsApp = async () => {
    if (!member) return;
    setSavingWa(true);
    const supabase = createClient();
    await supabase.from('members').update({ whatsapp: editWa.trim() || null }).eq('id', member.id);
    setMember(m => m ? { ...m, whatsapp: editWa.trim() || null } : m);
    setShowWaEdit(false);
    showToast({ msg: 'WhatsApp number saved', icon: 'check' });
    setSavingWa(false);
  };

  const toggleWhatsapp = async (v: boolean) => {
    if (!member) return;
    setWhatsappOn(v);
    const supabase = createClient();
    await supabase.from('members').update({ consent_contact: v }).eq('id', member.id);
  };

  const toggleLeaderboard = async (v: boolean) => {
    if (!member) return;
    setLeaderboard(v);
    const supabase = createClient();
    await supabase.from('members').update({ leaderboard_opt_in: v }).eq('id', member.id);
  };

  const changePassword = async () => {
    if (!newPw || newPw !== confirmPw || newPw.length < 8) return;
    setPwLoading(true);
    const supabase = createClient();
    // Verify current password first
    const { error: authErr } = await supabase.auth.signInWithPassword({ email: authEmail, password: currentPw });
    if (authErr) {
      showToast({ msg: 'Current password is incorrect.' });
      setPwLoading(false);
      return;
    }
    const { error } = await supabase.auth.updateUser({ password: newPw });
    if (error) {
      showToast({ msg: error.message });
    } else {
      setShowPw(false);
      setCurrentPw(''); setNewPw(''); setConfirmPw('');
      showToast({ msg: 'Password updated ✓', icon: 'check' });
    }
    setPwLoading(false);
  };

  const signOut = async () => {
    setSigningOut(true);
    const supabase = createClient();
    await supabase.auth.signOut();
    router.replace('/login');
  };

  const pwStrength = (pw: string) => {
    if (pw.length === 0) return null;
    if (pw.length < 6) return { label: 'Too short', color: '#c53030', pct: 0.2 };
    if (pw.length < 8) return { label: 'Weak', color: '#e47e2a', pct: 0.4 };
    if (!/[A-Z]/.test(pw) || !/[0-9]/.test(pw)) return { label: 'Fair', color: '#d4a017', pct: 0.6 };
    if (pw.length >= 12) return { label: 'Strong', color: '#16a34a', pct: 1 };
    return { label: 'Good', color: '#059669', pct: 0.8 };
  };

  const strength = pwStrength(newPw);
  const pwMismatch = confirmPw.length > 0 && newPw !== confirmPw;
  const displayEmail = member?.email || authEmail;

  if (loading) return (
    <div style={{ height: '100dvh', display: 'flex', flexDirection: 'column', background: 'var(--bg)' }}>
      <div style={{ flex: 1, padding: '72px 16px 24px', display: 'flex', flexDirection: 'column', gap: 14 }}>
        {[48, 110, 88, 72, 56].map((h, i) => <div key={i} style={{ height: h, borderRadius: 12, background: 'var(--surface-2)' }} />)}
      </div>
    </div>
  );

  return (
    <div className="member-page" style={{ position: 'relative', height: '100dvh', display: 'flex', flexDirection: 'column', background: 'var(--bg)', overflow: 'hidden' }}>
      <div className="noscroll member-scroll" style={{ flex: 1, overflowY: 'auto' }}>

        {/* Header */}
        <div style={{ position: 'sticky', top: 0, zIndex: 20, background: 'rgba(255,255,255,.9)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)', borderBottom: '1px solid var(--line)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '13px 16px 12px' }}>
            <button type="button" onClick={() => router.back()} style={{ width: 36, height: 36, borderRadius: '50%', background: 'var(--surface)', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none', cursor: 'pointer' }}>
              <Icon name="arrowleft" size={19} />
            </button>
            <div style={{ fontSize: 19, fontWeight: 800, letterSpacing: '-.01em' }}>Settings</div>
          </div>
        </div>

        <div style={{ padding: '20px 16px 100px', display: 'flex', flexDirection: 'column', gap: 22 }}>

          {/* ── ACCOUNT ── */}
          <div>
            <SectionLabel label="Account" />
            <div className="card" style={{ overflow: 'hidden' }}>
              <SettingRow icon="user" title="Edit profile" sub="Name, photo, bio" onClick={() => router.push('/member/profile')} />
              <Divider />

              {/* WhatsApp number */}
              <SettingRow
                icon="phone"
                title="WhatsApp number"
                sub={member?.whatsapp || 'Not set'}
                onClick={() => { setEditWa(member?.whatsapp ?? ''); setShowWaEdit(v => !v); }}
              />
              {showWaEdit && (
                <div style={{ padding: '0 16px 14px' }}>
                  <input
                    type="tel"
                    value={editWa}
                    onChange={e => setEditWa(e.target.value)}
                    placeholder="e.g. 08012345678"
                    autoFocus
                    style={{ width: '100%', height: 42, borderRadius: 9, border: '1.5px solid var(--navy)', background: 'var(--surface)', fontSize: 14.5, padding: '0 12px', outline: 'none', boxSizing: 'border-box', marginBottom: 8 }}
                  />
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button type="button" onClick={() => setShowWaEdit(false)} className="btn btn-ghost btn-sm">Cancel</button>
                    <button type="button" onClick={saveWhatsApp} disabled={savingWa} className="btn btn-primary btn-sm">
                      {savingWa ? 'Saving…' : 'Save number'}
                    </button>
                  </div>
                </div>
              )}

              <Divider />

              {/* Change password */}
              <SettingRow icon="lock" title="Change password" sub="Update your password" onClick={() => setShowPw(v => !v)} />
              {showPw && (
                <div style={{ padding: '0 16px 14px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {/* Current password */}
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink-2)', marginBottom: 5 }}>Current password</div>
                    <input
                      type="password"
                      value={currentPw}
                      onChange={e => setCurrentPw(e.target.value)}
                      placeholder="Your current password"
                      autoFocus
                      style={{ width: '100%', height: 40, borderRadius: 9, border: '1.5px solid var(--line-2)', background: 'var(--surface)', fontSize: 14, padding: '0 12px', outline: 'none', boxSizing: 'border-box' }}
                    />
                  </div>
                  {/* New password */}
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink-2)', marginBottom: 5 }}>New password</div>
                    <div style={{ position: 'relative' }}>
                      <input
                        type={showPwVis ? 'text' : 'password'}
                        value={newPw}
                        onChange={e => setNewPw(e.target.value)}
                        placeholder="Min 8 characters"
                        style={{ width: '100%', height: 40, borderRadius: 9, border: '1.5px solid var(--line-2)', background: 'var(--surface)', fontSize: 14, padding: '0 40px 0 12px', outline: 'none', boxSizing: 'border-box' }}
                      />
                      <button type="button" onClick={() => setShowPwVis(v => !v)} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--faint)' }}>
                        <Icon name={showPwVis ? 'eyeoff' : 'eye'} size={16} />
                      </button>
                    </div>
                    {strength && (
                      <div style={{ marginTop: 6 }}>
                        <div style={{ height: 3, borderRadius: 2, background: 'var(--surface-2)', overflow: 'hidden' }}>
                          <div style={{ height: '100%', width: `${strength.pct * 100}%`, background: strength.color, borderRadius: 2, transition: 'width .2s' }} />
                        </div>
                        <div style={{ fontSize: 11, color: strength.color, fontWeight: 700, marginTop: 3 }}>{strength.label}</div>
                      </div>
                    )}
                  </div>
                  {/* Confirm password */}
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink-2)', marginBottom: 5 }}>Confirm new password</div>
                    <input
                      type="password"
                      value={confirmPw}
                      onChange={e => setConfirmPw(e.target.value)}
                      placeholder="Repeat new password"
                      style={{ width: '100%', height: 40, borderRadius: 9, border: `1.5px solid ${pwMismatch ? '#c53030' : 'var(--line-2)'}`, background: 'var(--surface)', fontSize: 14, padding: '0 12px', outline: 'none', boxSizing: 'border-box' }}
                    />
                    {pwMismatch && <div style={{ fontSize: 11.5, color: '#c53030', marginTop: 3 }}>Passwords don&apos;t match</div>}
                  </div>
                  <div style={{ display: 'flex', gap: 8, marginTop: 2 }}>
                    <button type="button" onClick={() => { setShowPw(false); setCurrentPw(''); setNewPw(''); setConfirmPw(''); }} className="btn btn-ghost btn-sm">Cancel</button>
                    <button
                      type="button"
                      onClick={changePassword}
                      disabled={pwLoading || !currentPw || !newPw || newPw !== confirmPw || newPw.length < 8}
                      className="btn btn-primary btn-sm"
                    >
                      {pwLoading ? 'Updating…' : 'Update password'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* ── NOTIFICATIONS ── */}
          <div>
            <SectionLabel label="Notifications" />
            <div className="card" style={{ overflow: 'hidden' }}>
              <SettingRow
                icon="mail"
                title="Email reminders"
                sub="Goal and devotion reminders"
                chevron={false}
                right={<Toggle on={emailOn} onChange={setEmailOn} />}
              />
              <Divider />
              <SettingRow
                icon="message"
                title="WhatsApp alerts"
                sub="Session and milestone alerts"
                chevron={false}
                right={<Toggle on={whatsappOn} onChange={toggleWhatsapp} />}
              />
            </div>
          </div>

          {/* ── PRIVACY ── */}
          <div>
            <SectionLabel label="Privacy" />
            <div className="card" style={{ overflow: 'hidden' }}>
              <SettingRow
                icon="trophy"
                title="Appear on leaderboard"
                sub="Visible to members only"
                chevron={false}
                right={<Toggle on={leaderboard} onChange={toggleLeaderboard} />}
              />
              <Divider />
              {/* Display name mode */}
              <div style={{ padding: '13px 16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 13, marginBottom: 12 }}>
                  <div style={{ width: 34, height: 34, borderRadius: 9, background: 'var(--surface-2)', color: 'var(--navy)', display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}>
                    <Icon name="eye" size={17} stroke={2} />
                  </div>
                  <div>
                    <div style={{ fontSize: 14.5, fontWeight: 600 }}>Display name</div>
                    <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 1 }}>How your name appears on the board</div>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  {[{ v: 'full', l: 'Full name' }, { v: 'first', l: 'First + initial' }, { v: 'alias', l: 'Alias' }].map(o => (
                    <button
                      key={o.v}
                      type="button"
                      onClick={() => setNameMode(o.v)}
                      style={{ flex: 1, padding: '7px 4px', borderRadius: 8, fontSize: 12, fontWeight: 600, background: nameMode === o.v ? 'var(--navy)' : 'var(--surface)', color: nameMode === o.v ? '#fff' : 'var(--ink)', border: nameMode === o.v ? 'none' : '1px solid var(--line-2)', cursor: 'pointer' }}
                    >
                      {o.l}
                    </button>
                  ))}
                </div>
                {member && (
                  <div style={{ fontSize: 11.5, color: 'var(--faint)', marginTop: 8 }}>
                    Preview: <b style={{ color: 'var(--ink-2)' }}>
                      {nameMode === 'full' ? member.name
                        : nameMode === 'first' ? (() => { const [f, ...r] = member.name.split(' '); return r.length ? `${f} ${r[0][0]}.` : f; })()
                        : 'Member'}
                    </b>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* ── SUPPORT ── */}
          <div>
            <SectionLabel label="Support" />
            <div className="card" style={{ overflow: 'hidden' }}>
              <SettingRow
                icon="info"
                title="Help &amp; FAQ"
                sub="Common questions answered"
                onClick={() => showToast({ msg: 'Help centre coming soon.' })}
              />
              <Divider />
              <SettingRow
                icon="mail"
                title="Contact SODE team"
                sub={`connect@thesode.org`}
                onClick={() => { window.location.href = 'mailto:connect@thesode.org'; }}
              />
              <Divider />
              <SettingRow
                icon="info"
                title="How your data is used"
                sub="Plain-language privacy summary"
                onClick={() => showToast({ msg: 'Privacy summary coming soon.' })}
              />
            </div>
          </div>

          {/* ── ACCOUNT INFO ── */}
          <div>
            <SectionLabel label="Account" />
            <div className="card" style={{ overflow: 'hidden' }}>
              <div style={{ padding: '13px 16px' }}>
                <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 2 }}>Signed in as</div>
                <div style={{ fontSize: 14, fontWeight: 600 }}>{displayEmail}</div>
              </div>
            </div>
          </div>

          {/* ── SIGN OUT ── */}
          <button
            type="button"
            onClick={signOut}
            disabled={signingOut}
            style={{
              width: '100%', padding: '14px', borderRadius: 14,
              border: '1.5px solid #fca5a5', background: '#fff5f5',
              color: '#dc2626', fontSize: 15, fontWeight: 700,
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              cursor: signingOut ? 'default' : 'pointer',
              opacity: signingOut ? 0.7 : 1,
            }}
          >
            {signingOut ? (
              <>
                <span style={{ width: 16, height: 16, border: '2px solid #fca5a5', borderTopColor: '#dc2626', borderRadius: '50%', animation: 'sode-spin .7s linear infinite', display: 'inline-block' }} />
                Signing out…
              </>
            ) : (
              <>
                <Icon name="logout" size={18} color="#dc2626" />
                Sign out
              </>
            )}
          </button>

          <div style={{ height: 8 }} />
        </div>
      </div>

      <BottomNav />
      <Toast toast={toast} />
    </div>
  );
}

'use client';
import { useState, useEffect, useCallback } from 'react';
import { Icon } from '@/components/sode/icons';
import { Toggle, StatusPill, Avatar, Sheet, Toast, type ToastData } from '@/components/sode/ui';
import { AdminTopbar, AdminBody, Panel } from '@/components/admin/chrome';
import { createClient } from '@/lib/supabase';

const ADMIN_ROLES = [
  { value: 'director', label: 'Director' },
  { value: 'spiritual_lead', label: 'Spiritual Lead' },
  { value: 'career_lead', label: 'Career Lead' },
  { value: 'business_lead', label: 'Business Lead' },
  { value: 'member_care_lead', label: 'Member Care Lead' },
  { value: 'data_ops_lead', label: 'Data Ops Lead' },
];

const ROLE_LABEL: Record<string, string> = Object.fromEntries(ADMIN_ROLES.map(r => [r.value, r.label]));

interface AdminUser {
  user_id: string;
  role: string;
  member: { id: string; name: string; email: string } | null;
}

function SettingRow({ icon, title, sub, children }: { icon: string; title: string; sub?: string; children?: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 13, padding: '14px 16px', borderBottom: '1px solid var(--line)' }}>
      <div style={{ width: 36, height: 36, borderRadius: 10, background: 'var(--surface-2)', color: 'var(--navy)', display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}>
        <Icon name={icon} size={18} stroke={2} />
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 14, fontWeight: 600 }}>{title}</div>
        {sub && <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 1 }}>{sub}</div>}
      </div>
      {children}
    </div>
  );
}

export default function SettingsPage() {
  const [toggles, setToggles] = useState({ sheets: true, resend: true, whatsapp: false, retention: true });
  const tog = (k: keyof typeof toggles) => setToggles(s => ({ ...s, [k]: !s[k] }));

  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [isDirector, setIsDirector] = useState(false);
  const [admins, setAdmins] = useState<AdminUser[]>([]);
  const [adminsLoading, setAdminsLoading] = useState(true);

  // Grant sheet state
  const [grantOpen, setGrantOpen] = useState(false);
  const [memberSearch, setMemberSearch] = useState('');
  const [memberResults, setMemberResults] = useState<{ id: string; name: string; email: string; auth_id: string }[]>([]);
  const [selectedMember, setSelectedMember] = useState<{ id: string; name: string; email: string; auth_id: string } | null>(null);
  const [selectedRole, setSelectedRole] = useState('spiritual_lead');
  const [granting, setGranting] = useState(false);

  // Revoke state
  const [revokeTarget, setRevokeTarget] = useState<AdminUser | null>(null);
  const [revoking, setRevoking] = useState(false);

  const [toast, setToast] = useState<ToastData | null>(null);

  const showToast = (msg: string, kind: 'success' | 'error' = 'success') => {
    setToast({ msg, kind, icon: kind === 'error' ? 'x' : 'check' });
    setTimeout(() => setToast(null), 3500);
  };

  const loadAdmins = useCallback(async () => {
    setAdminsLoading(true);
    const supabase = createClient();
    const { data: roles } = await supabase.from('user_roles').select('user_id, role').order('role');
    if (!roles?.length) { setAdmins([]); setAdminsLoading(false); return; }

    // Fetch member records for each auth_id
    const authIds = Array.from(new Set(roles.map(r => r.user_id)));
    const { data: members } = await supabase
      .from('members')
      .select('id, name, email, auth_id')
      .in('auth_id', authIds);

    const memberMap = Object.fromEntries((members ?? []).map(m => [m.auth_id, m]));
    setAdmins(roles.map(r => ({ user_id: r.user_id, role: r.role, member: memberMap[r.user_id] ?? null })));
    setAdminsLoading(false);
  }, []);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return;
      setCurrentUserId(user.id);
      const { data: roles } = await supabase.from('user_roles').select('role').eq('user_id', user.id);
      setIsDirector((roles ?? []).some((r: { role: string }) => r.role === 'director'));
    });
    loadAdmins();
  }, [loadAdmins]);

  // Member search for grant sheet
  useEffect(() => {
    if (!memberSearch.trim()) { setMemberResults([]); return; }
    const timer = setTimeout(async () => {
      const supabase = createClient();
      const { data } = await supabase
        .from('members')
        .select('id, name, email, auth_id')
        .ilike('name', `%${memberSearch}%`)
        .limit(8);
      setMemberResults((data ?? []) as { id: string; name: string; email: string; auth_id: string }[]);
    }, 300);
    return () => clearTimeout(timer);
  }, [memberSearch]);

  const handleGrant = async () => {
    if (!selectedMember || !selectedRole) return;
    setGranting(true);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

    const { error } = await supabase.from('user_roles').insert({
      user_id: selectedMember.auth_id,
      role: selectedRole,
    });

    if (error) {
      showToast(error.message.includes('duplicate') ? `${selectedMember.name} already has this role.` : error.message, 'error');
      setGranting(false);
      return;
    }

    // Notify the newly granted admin
    const granterName = user?.user_metadata?.full_name || user?.email || 'The Director';
    fetch('/api/notify/admin-access', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: selectedMember.name,
        email: selectedMember.email,
        role: selectedRole,
        granted_by: granterName,
      }),
    }).catch(() => {});

    showToast(`${selectedMember.name} granted ${ROLE_LABEL[selectedRole]} access.`);
    setGrantOpen(false);
    setSelectedMember(null);
    setMemberSearch('');
    setSelectedRole('spiritual_lead');
    setGranting(false);
    loadAdmins();
  };

  const handleRevoke = async () => {
    if (!revokeTarget) return;
    setRevoking(true);
    const supabase = createClient();
    const { error } = await supabase
      .from('user_roles')
      .delete()
      .eq('user_id', revokeTarget.user_id)
      .eq('role', revokeTarget.role);

    if (error) { showToast(error.message, 'error'); setRevoking(false); return; }

    showToast(`${revokeTarget.member?.name ?? 'User'}'s access has been removed.`);
    setRevokeTarget(null);
    setRevoking(false);
    loadAdmins();
  };

  return (
    <>
      <AdminTopbar title="Settings" subtitle="Cycle · roles · integrations · data" />
      <AdminBody>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Main 2-col grid */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, alignItems: 'start' }}>
            {/* Left column */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <Panel title="Cycle & baseline" pad={false}>
                <SettingRow icon="calendarclock" title="Active cycle" sub="2026 Growth Cycle · Month 4 of 12">
                  <button className="btn btn-ghost btn-sm">Edit</button>
                </SettingRow>
                <SettingRow icon="flag" title="Baselines captured" sub="Month 0 baselines locked">
                  <StatusPill status="done" size="sm" />
                </SettingRow>
              </Panel>

              <Panel title="Roles & invites" pad={false}>
                <SettingRow icon="users" title="Pillar Leads" sub="4 assigned · scoped to their pillar">
                  <button className="btn btn-ghost btn-sm">Manage</button>
                </SettingRow>
                <SettingRow icon="userplus" title="Invite a leader" sub="Send a back-office invite">
                  <button className="btn btn-primary btn-sm">Invite</button>
                </SettingRow>
              </Panel>

              <Panel title="Status thresholds" pad={false}>
                <SettingRow icon="trendingup" title="On track ≥" sub="90% of pace">
                  <span className="tnum" style={{ fontWeight: 700 }}>90%</span>
                </SettingRow>
                <SettingRow icon="minus" title="At risk ≥" sub="70% of pace">
                  <span className="tnum" style={{ fontWeight: 700 }}>70%</span>
                </SettingRow>
              </Panel>
            </div>

            {/* Right column */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <Panel title="Integrations" pad={false}>
                <SettingRow icon="refresh" title="Google Sheets" sub="Attendance + responses sync">
                  <Toggle on={toggles.sheets} onChange={() => tog('sheets')} />
                </SettingRow>
                <SettingRow icon="mail" title="Resend (email)" sub="Reminders & recaps">
                  <Toggle on={toggles.resend} onChange={() => tog('resend')} />
                </SettingRow>
                <SettingRow icon="message" title="WhatsApp Business" sub="Connect to send nudges">
                  <Toggle on={toggles.whatsapp} onChange={() => tog('whatsapp')} />
                </SettingRow>
              </Panel>

              <Panel title="Notification templates" pad={false}>
                <SettingRow icon="bell" title="Win celebrate" sub='"Logged. Well done."'>
                  <button className="btn btn-ghost btn-sm">Edit</button>
                </SettingRow>
                <SettingRow icon="calendarclock" title="Session reminder" sub="Sent 2h before">
                  <button className="btn btn-ghost btn-sm">Edit</button>
                </SettingRow>
              </Panel>

              <Panel title="Data & retention" pad={false}>
                <SettingRow icon="shieldcheck" title="NDPA mode" sub="Honour export & delete requests">
                  <Toggle on={toggles.retention} onChange={() => tog('retention')} />
                </SettingRow>
                <SettingRow icon="download" title="Export all data" sub="Full org backup">
                  <button className="btn btn-ghost btn-sm">Export</button>
                </SettingRow>
              </Panel>
            </div>
          </div>

          {/* Team access — full width */}
          <Panel
            title="Team access"
            action={isDirector ? (
              <button className="btn btn-primary btn-sm" onClick={() => setGrantOpen(true)}>
                Grant access
              </button>
            ) : undefined}
          >
            {!isDirector && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 16px', background: 'var(--navy-tint)', borderRadius: 8, marginBottom: 16 }}>
                <Icon name="lock" size={14} color="var(--navy)" />
                <span style={{ fontSize: 13, color: 'var(--navy)', fontWeight: 500 }}>Only the Director can manage team access.</span>
              </div>
            )}

            {adminsLoading ? (
              <div style={{ padding: '24px 0', textAlign: 'center', color: 'var(--muted)', fontSize: 13 }}>Loading…</div>
            ) : admins.length === 0 ? (
              <div style={{ padding: '24px 0', textAlign: 'center', color: 'var(--muted)', fontSize: 13 }}>No admin users found.</div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13.5 }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--line)' }}>
                    <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 600, color: 'var(--muted)', fontSize: 12 }}>Name</th>
                    <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 600, color: 'var(--muted)', fontSize: 12 }}>Email</th>
                    <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 600, color: 'var(--muted)', fontSize: 12 }}>Role</th>
                    {isDirector && <th style={{ width: 80 }} />}
                  </tr>
                </thead>
                <tbody>
                  {admins.map((a, i) => {
                    const isSelf = a.user_id === currentUserId;
                    return (
                      <tr key={`${a.user_id}-${a.role}`} style={{ borderBottom: i < admins.length - 1 ? '1px solid var(--line)' : 'none' }}>
                        <td style={{ padding: '12px 12px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                            <Avatar name={a.member?.name ?? '?'} size={28} />
                            <span style={{ fontWeight: 600 }}>{a.member?.name ?? '—'}{isSelf && <span style={{ fontSize: 11, color: 'var(--muted)', marginLeft: 6 }}>you</span>}</span>
                          </div>
                        </td>
                        <td style={{ padding: '12px 12px', color: 'var(--muted)' }}>{a.member?.email ?? '—'}</td>
                        <td style={{ padding: '12px 12px' }}>
                          <span style={{ display: 'inline-block', padding: '3px 10px', borderRadius: 99, background: 'var(--navy-tint)', color: 'var(--navy)', fontSize: 12, fontWeight: 600 }}>
                            {ROLE_LABEL[a.role] ?? a.role}
                          </span>
                        </td>
                        {isDirector && (
                          <td style={{ padding: '12px 12px', textAlign: 'right' }}>
                            {!isSelf && (
                              <button
                                className="btn btn-ghost btn-sm"
                                style={{ color: '#c53030', fontSize: 12 }}
                                onClick={() => setRevokeTarget(a)}
                              >
                                Remove
                              </button>
                            )}
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </Panel>
        </div>
      </AdminBody>

      {/* Grant access sheet */}
      <Sheet open={grantOpen} onClose={() => { setGrantOpen(false); setSelectedMember(null); setMemberSearch(''); }} title="Grant admin access">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          <div>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 7 }}>Search member</label>
            <input
              type="text"
              value={memberSearch}
              onChange={e => { setMemberSearch(e.target.value); setSelectedMember(null); }}
              placeholder="Type a name…"
              style={{ width: '100%', height: 40, borderRadius: 9, border: '1.5px solid var(--line-2)', background: 'var(--surface)', padding: '0 12px', fontSize: 14, fontFamily: 'var(--font)', outline: 'none', boxSizing: 'border-box' }}
            />
            {memberResults.length > 0 && !selectedMember && (
              <div style={{ marginTop: 6, border: '1px solid var(--line)', borderRadius: 10, overflow: 'hidden', background: '#fff' }}>
                {memberResults.map(m => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => { setSelectedMember(m); setMemberSearch(m.name); setMemberResults([]); }}
                    style={{ width: '100%', padding: '10px 13px', textAlign: 'left', background: 'none', borderBottom: '1px solid var(--line)', display: 'flex', flexDirection: 'column', gap: 1 }}
                  >
                    <span style={{ fontSize: 13.5, fontWeight: 600 }}>{m.name}</span>
                    <span style={{ fontSize: 12, color: 'var(--muted)' }}>{m.email}</span>
                  </button>
                ))}
              </div>
            )}
            {selectedMember && (
              <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 9, padding: '9px 12px', background: 'var(--surface-2)', borderRadius: 9 }}>
                <Avatar name={selectedMember.name} size={28} />
                <div>
                  <div style={{ fontSize: 13.5, fontWeight: 600 }}>{selectedMember.name}</div>
                  <div style={{ fontSize: 12, color: 'var(--muted)' }}>{selectedMember.email}</div>
                </div>
              </div>
            )}
          </div>

          <div>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 7 }}>Role to assign</label>
            <select
              value={selectedRole}
              onChange={e => setSelectedRole(e.target.value)}
              style={{ width: '100%', height: 40, borderRadius: 9, border: '1.5px solid var(--line-2)', background: 'var(--surface)', padding: '0 12px', fontSize: 14, fontFamily: 'var(--font)', outline: 'none', boxSizing: 'border-box' }}
            >
              {ADMIN_ROLES.filter(r => r.value !== 'director').map(r => (
                <option key={r.value} value={r.value}>{r.label}</option>
              ))}
            </select>
            <p style={{ fontSize: 12, color: 'var(--faint)', marginTop: 6 }}>Director role cannot be assigned here — contact your Supabase admin.</p>
          </div>

          <button
            className="btn btn-primary btn-block"
            disabled={!selectedMember || granting}
            style={{ height: 42, fontWeight: 700, borderRadius: 10 }}
            onClick={handleGrant}
          >
            {granting ? 'Granting…' : `Grant ${ROLE_LABEL[selectedRole] ?? selectedRole} access`}
          </button>
        </div>
      </Sheet>

      {/* Revoke confirmation */}
      {revokeTarget && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }} onClick={() => setRevokeTarget(null)}>
          <div className="card" style={{ width: '100%', maxWidth: 380, padding: 24, borderRadius: 18 }} onClick={e => e.stopPropagation()}>
            <h3 style={{ fontSize: 17, fontWeight: 800, marginBottom: 10 }}>Remove admin access?</h3>
            <p style={{ fontSize: 14, color: 'var(--muted)', marginBottom: 22, lineHeight: 1.6 }}>
              <strong>{revokeTarget.member?.name ?? 'This user'}</strong> will lose <strong>{ROLE_LABEL[revokeTarget.role] ?? revokeTarget.role}</strong> access immediately and will no longer be able to access the admin dashboard.
            </p>
            <div style={{ display: 'flex', gap: 10 }}>
              <button className="btn btn-ghost btn-block" style={{ flex: 1 }} onClick={() => setRevokeTarget(null)}>Cancel</button>
              <button
                className="btn btn-block"
                style={{ flex: 1, background: '#c53030', color: '#fff', fontWeight: 700, border: 'none', borderRadius: 10, height: 40 }}
                disabled={revoking}
                onClick={handleRevoke}
              >
                {revoking ? 'Removing…' : 'Remove access'}
              </button>
            </div>
          </div>
        </div>
      )}

      <Toast toast={toast} />
    </>
  );
}

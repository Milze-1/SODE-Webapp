'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
import { Icon } from '@/components/sode/icons';
import { StatusPill, Avatar, Sheet, Toast, type ToastData } from '@/components/sode/ui';
import { AdminTopbar, AdminBody, Panel } from '@/components/admin/chrome';
import { createClient } from '@/lib/supabase';
import { getCurrentCoords } from '@/lib/geo';
import LocationAutocomplete from '@/components/admin/LocationAutocomplete';

const ADMIN_ROLES = [
  { value: 'super_admin', label: 'Super Admin' },
  { value: 'director', label: 'Director' },
  { value: 'spiritual_lead', label: 'Spiritual Lead' },
  { value: 'career_lead', label: 'Career Lead' },
  { value: 'business_lead', label: 'Business Lead' },
  { value: 'member_care_lead', label: 'Member Care Lead' },
  { value: 'data_ops_lead', label: 'Data Ops Lead' },
  { value: 'business_dev', label: 'Business Dev (Sub-admin)' },
  { value: 'external_mentor', label: 'External Mentor (Sub-admin)' },
];

const ROLE_LABEL: Record<string, string> = Object.fromEntries(ADMIN_ROLES.map(r => [r.value, r.label]));

interface AdminUser {
  user_id: string;
  role: string;
  member: { id: string; name: string; email: string } | null;
}

function ConnStatus({ on }: { on: boolean | undefined }) {
  if (on === undefined) return <span style={{ fontSize: 12, color: 'var(--faint)' }}>…</span>;
  return (
    <span style={{ fontSize: 11.5, fontWeight: 700, padding: '3px 9px', borderRadius: 99, whiteSpace: 'nowrap',
      background: on ? '#dcfce7' : 'var(--surface-2)', color: on ? '#166534' : 'var(--muted)' }}>
      {on ? 'Connected' : 'Not set up'}
    </span>
  );
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
  const [integrations, setIntegrations] = useState<{ email: boolean; whatsapp: boolean; push: boolean; scheduler: boolean } | null>(null);
  const [exportingAll, setExportingAll] = useState(false);
  const cycleMonth = Math.max(1, Math.min(12, (new Date().getFullYear() - 2026) * 12 + new Date().getMonth() + 1));
  const teamAccessRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    fetch('/api/admin/integrations').then(r => (r.ok ? r.json() : null)).then(setIntegrations).catch(() => {});
  }, []);

  // Full member export — same spreadsheet as Admin → Members, all members
  const exportAll = async () => {
    setExportingAll(true);
    try {
      const { data } = await createClient()
        .from('members')
        .select('name,email,whatsapp,pillar,life_stage,department,is_leader,is_mentor,onboarding_complete,points,created_at,updated_at')
        .order('created_at', { ascending: false });
      const res = await fetch('/api/admin/members/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ members: data ?? [] }),
      });
      if (!res.ok) throw new Error();
      const url = URL.createObjectURL(await res.blob());
      const a = document.createElement('a');
      a.href = url;
      a.download = `sode-members-${new Date().toISOString().slice(0, 10)}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      showToast('Export failed — try again.', 'error');
    } finally {
      setExportingAll(false);
    }
  };

  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [isDirector, setIsDirector] = useState(false);
  const [isSuper, setIsSuper] = useState(false);
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

  // Attendance geofence (default check-in location)
  const [geoId, setGeoId] = useState<string | null>(null);
  const [churchName, setChurchName] = useState('');
  const [latitude, setLatitude] = useState('');
  const [longitude, setLongitude] = useState('');
  const [radiusMeters, setRadiusMeters] = useState('300');
  const [geoLoading, setGeoLoading] = useState(true);
  const [geoSaving, setGeoSaving] = useState(false);
  const [locating, setLocating] = useState(false);

  const [toast, setToast] = useState<ToastData | null>(null);

  const showToast = (msg: string, kind: 'success' | 'error' = 'success') => {
    setToast({ msg, kind, icon: kind === 'error' ? 'x' : 'check' });
    setTimeout(() => setToast(null), 3500);
  };

  const loadAdmins = useCallback(async () => {
    setAdminsLoading(true);
    // Server-side list (app/api/admin/roles) — reading user_roles from the
    // browser only returns your own row unless the DB policy knows your role.
    const res = await fetch('/api/admin/roles').catch(() => null);
    const json = res?.ok ? await res.json() as { admins: AdminUser[] } : { admins: [] };
    setAdmins(json.admins);
    setAdminsLoading(false);
  }, []);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return;
      setCurrentUserId(user.id);
      const { data: roles } = await supabase.from('user_roles').select('role').eq('user_id', user.id);
      const roleList = (roles ?? []).map((r: { role: string }) => r.role);
      // Super-admin can do everything the Director can (and more).
      setIsSuper(roleList.includes('super_admin'));
      setIsDirector(roleList.includes('director') || roleList.includes('super_admin'));
    });
    loadAdmins();
  }, [loadAdmins]);

  useEffect(() => {
    (async () => {
      const supabase = createClient();
      const { data } = await supabase
        .from('attendance_settings')
        .select('id,church_name,latitude,longitude,radius_meters')
        .maybeSingle();
      if (data) {
        setGeoId(data.id);
        setChurchName(data.church_name ?? '');
        setLatitude(data.latitude != null ? String(data.latitude) : '');
        setLongitude(data.longitude != null ? String(data.longitude) : '');
        setRadiusMeters(String(data.radius_meters ?? 300));
      }
      setGeoLoading(false);
    })();
  }, []);

  const useCurrentLocationForDefault = async () => {
    setLocating(true);
    try {
      const coords = await getCurrentCoords();
      setLatitude(String(coords.lat));
      setLongitude(String(coords.lng));
    } catch (err) {
      showToast((err as Error).message, 'error');
    } finally {
      setLocating(false);
    }
  };

  const saveGeofence = async () => {
    const lat = latitude.trim() ? Number(latitude) : null;
    const lng = longitude.trim() ? Number(longitude) : null;
    if ((lat == null) !== (lng == null)) {
      showToast('Enter both latitude and longitude, or leave both blank.', 'error');
      return;
    }
    setGeoSaving(true);
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      const payload = {
        church_name: churchName.trim() || null,
        latitude: lat,
        longitude: lng,
        radius_meters: radiusMeters.trim() ? Number(radiusMeters) : 300,
        updated_by: user?.id ?? null,
        updated_at: new Date().toISOString(),
      };
      if (geoId) {
        const { error } = await supabase.from('attendance_settings').update(payload).eq('id', geoId);
        if (error) throw error;
      } else {
        const { data, error } = await supabase.from('attendance_settings').insert(payload).select('id').single();
        if (error) throw error;
        setGeoId(data.id);
      }
      showToast('Default check-in location saved.');
    } catch (err) {
      showToast((err as Error).message, 'error');
    } finally {
      setGeoSaving(false);
    }
  };

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

    // Server-side (app/api/admin/roles): the user_roles write policy only
    // admits Directors, so Super Admins were getting an RLS error here.
    // One role per person — the new role replaces any existing one.
    const res = await fetch('/api/admin/roles', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ memberId: selectedMember.id, role: selectedRole }),
    }).catch(() => null);
    if (!res?.ok) {
      const { error } = res ? await res.json().catch(() => ({ error: null })) as { error: string | null } : { error: null };
      showToast(error || 'Could not grant access — check your connection and try again.', 'error');
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
    const res = await fetch('/api/admin/roles', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: revokeTarget.user_id, role: revokeTarget.role }),
    }).catch(() => null);
    if (!res?.ok) {
      const { error } = res ? await res.json().catch(() => ({ error: null })) as { error: string | null } : { error: null };
      showToast(error || 'Could not remove access — try again.', 'error');
      setRevoking(false);
      return;
    }

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
              <Panel title="Attendance check-in location">
                {geoLoading ? (
                  <div style={{ height: 120, borderRadius: 'var(--r-sm)', background: 'var(--surface-2)' }} />
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <p style={{ fontSize: 12.5, color: 'var(--muted)', lineHeight: 1.55, margin: 0 }}>
                      Members can only self check-in (or via QR) within this radius, unless a session sets its own location.
                    </p>
                    <div>
                      <label style={{ display: 'block', fontSize: 12.5, fontWeight: 600, marginBottom: 6 }}>Church / venue name</label>
                      <LocationAutocomplete
                        value={churchName}
                        onChange={setChurchName}
                        onSelect={r => { setChurchName(r.label); setLatitude(String(r.lat)); setLongitude(String(r.lng)); }}
                        placeholder="e.g. SODE Main Auditorium"
                        style={{ width: '100%', height: 38, borderRadius: 9, border: '1.5px solid var(--line-2)', background: 'var(--surface)', padding: '0 11px', fontSize: 13.5, outline: 'none', boxSizing: 'border-box' }}
                      />
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                      <div>
                        <label style={{ display: 'block', fontSize: 12.5, fontWeight: 600, marginBottom: 6 }}>Latitude</label>
                        <input
                          type="number" step="any"
                          value={latitude}
                          onChange={e => setLatitude(e.target.value)}
                          placeholder="6.5244"
                          style={{ width: '100%', height: 38, borderRadius: 9, border: '1.5px solid var(--line-2)', background: 'var(--surface)', padding: '0 11px', fontSize: 13.5, outline: 'none', boxSizing: 'border-box' }}
                        />
                      </div>
                      <div>
                        <label style={{ display: 'block', fontSize: 12.5, fontWeight: 600, marginBottom: 6 }}>Longitude</label>
                        <input
                          type="number" step="any"
                          value={longitude}
                          onChange={e => setLongitude(e.target.value)}
                          placeholder="3.3792"
                          style={{ width: '100%', height: 38, borderRadius: 9, border: '1.5px solid var(--line-2)', background: 'var(--surface)', padding: '0 11px', fontSize: 13.5, outline: 'none', boxSizing: 'border-box' }}
                        />
                      </div>
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: 12.5, fontWeight: 600, marginBottom: 6 }}>Radius (meters)</label>
                      <input
                        type="number" min={10}
                        value={radiusMeters}
                        onChange={e => setRadiusMeters(e.target.value)}
                        style={{ width: '100%', height: 38, borderRadius: 9, border: '1.5px solid var(--line-2)', background: 'var(--surface)', padding: '0 11px', fontSize: 13.5, outline: 'none', boxSizing: 'border-box' }}
                      />
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button type="button" onClick={useCurrentLocationForDefault} disabled={locating} className="btn btn-ghost btn-sm" style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                        <Icon name="mappin" size={14} /> {locating ? 'Locating…' : 'Use my location'}
                      </button>
                      <button type="button" onClick={saveGeofence} disabled={geoSaving} className="btn btn-primary btn-sm" style={{ flex: 1 }}>
                        {geoSaving ? 'Saving…' : 'Save default'}
                      </button>
                    </div>
                  </div>
                )}
              </Panel>

              <Panel title="Cycle & baseline" pad={false}>
                <SettingRow icon="calendarclock" title="Active cycle" sub={`2026 Growth Cycle · Month ${cycleMonth} of 12`} />
                <SettingRow icon="flag" title="Baselines captured" sub="Month 0 baselines locked">
                  <StatusPill status="done" size="sm" />
                </SettingRow>
              </Panel>

              <Panel title="Roles & invites" pad={false}>
                <SettingRow icon="users" title="Pillar Leads" sub={`${admins.filter(a => a.role.endsWith('_lead')).length} assigned · scoped to their pillar`}>
                  <button className="btn btn-ghost btn-sm" onClick={() => teamAccessRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}>Manage</button>
                </SettingRow>
                {isDirector && (
                  <SettingRow icon="userplus" title="Give someone access" sub="Grant a back-office role to a member">
                    <button className="btn btn-primary btn-sm" onClick={() => setGrantOpen(true)}>Add</button>
                  </SettingRow>
                )}
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
                <SettingRow icon="mail" title="Email (Resend)" sub="Reminders, form and session emails">
                  <ConnStatus on={integrations?.email} />
                </SettingRow>
                <SettingRow icon="message" title="WhatsApp / SMS (Termii)" sub="Group messages and milestone nudges">
                  <ConnStatus on={integrations?.whatsapp} />
                </SettingRow>
                <SettingRow icon="bell" title="Push notifications" sub="Phone and browser notifications">
                  <ConnStatus on={integrations?.push} />
                </SettingRow>
                <SettingRow icon="clock" title="Scheduler" sub="Meeting start, 6am/7am devotion, goal reminders">
                  <ConnStatus on={integrations?.scheduler} />
                </SettingRow>
              </Panel>

              <Panel title="Notification schedule" pad={false}>
                <SettingRow icon="calendarclock" title="Sessions" sub="When created, 5pm the day before, and at start time (check-in opens)" />
                <SettingRow icon="heart" title="Devotion" sub="6:00am for everyone · 7:00am if not done yet" />
                <SettingRow icon="target" title="Goals" sub="At each member's chosen reminder time · 8pm if falling behind" />
                <SettingRow icon="users" title="Profile task" sub="After onboarding, then ~day 1, 3 and 7 until complete" />
              </Panel>

              <Panel title="Data & retention" pad={false}>
                <SettingRow icon="shieldcheck" title="Member data requests" sub="Members export their own data from Profile; deletion requests are emailed to the team" />
                <SettingRow icon="download" title="Export all members" sub="Spreadsheet of every member">
                  <button className="btn btn-ghost btn-sm" onClick={exportAll} disabled={exportingAll}>{exportingAll ? 'Exporting…' : 'Export'}</button>
                </SettingRow>
              </Panel>
            </div>
          </div>

          {/* Team access — full width */}
          <div ref={teamAccessRef} />
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
              {ADMIN_ROLES.filter(r => (isSuper ? r.value !== 'super_admin' : r.value !== 'director' && r.value !== 'super_admin')).map(r => (
                <option key={r.value} value={r.value}>{r.label}</option>
              ))}
            </select>
            <p style={{ fontSize: 12, color: 'var(--faint)', marginTop: 6 }}>
              {isSuper
                ? 'Super Admin role cannot be assigned here — contact your Supabase admin. Assigning a role replaces the user’s existing role.'
                : 'Director and Super Admin roles cannot be assigned here — contact your Supabase admin. Assigning a role replaces the user’s existing role.'}
            </p>
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

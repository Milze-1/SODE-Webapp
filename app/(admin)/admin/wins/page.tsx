'use client';
import { useState, useEffect, useMemo } from 'react';
import { createClient } from '@/lib/supabase';
import { Icon, pillarOf } from '@/components/sode/icons';
import { Avatar, PillarChip } from '@/components/sode/ui';
import { AdminTopbar, AdminBody, FilterChip, AdminSearch, TRow, THead, Panel, Skeleton } from '@/components/admin/chrome';

interface WinRow {
  id: string; pillar: string | null; win_type: string | null; description: string | null;
  points_earned: number; verified: boolean | null; created_at: string;
  members: { name: string } | null;
}

const PILLARS = ['spiritual', 'career', 'business', 'character'];
const TYPE_LABEL: Record<string, string> = {
  certification: 'Certification', milestone: 'Milestone', first: 'First-time', share: 'Advocacy', other: 'Other',
};

export default function WinsPage() {
  const [loading, setLoading] = useState(true);
  const [wins, setWins] = useState<WinRow[]>([]);
  const [search, setSearch] = useState('');
  const [pillarFilter, setPillarFilter] = useState('all');
  const [verifiedFilter, setVerifiedFilter] = useState<'all' | 'pending' | 'verified'>('all');
  const [verifying, setVerifying] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const supabase = createClient();
      const { data } = await supabase
        .from('wins')
        .select('id,pillar,win_type,description,points_earned,verified,created_at,members:member_id(name)')
        .order('created_at', { ascending: false });
      setWins((data ?? []) as unknown as WinRow[]);
      setLoading(false);
    })();
  }, []);

  const verify = async (winId: string) => {
    setVerifying(winId);
    const supabase = createClient();
    const { error } = await supabase.from('wins').update({ verified: true }).eq('id', winId);
    if (!error) setWins(ws => ws.map(w => w.id === winId ? { ...w, verified: true } : w));
    setVerifying(null);
  };

  const displayed = useMemo(() => wins.filter(w => {
    const matchSearch = !search || (w.members?.name ?? '').toLowerCase().includes(search.toLowerCase()) || (w.description ?? '').toLowerCase().includes(search.toLowerCase());
    const matchPillar = pillarFilter === 'all' || w.pillar === pillarFilter;
    const matchVerified = verifiedFilter === 'all' || (verifiedFilter === 'verified' ? w.verified : !w.verified);
    return matchSearch && matchPillar && matchVerified;
  }), [wins, search, pillarFilter, verifiedFilter]);

  const pendingCount = wins.filter(w => !w.verified).length;
  const COL = '1.5fr 1.5fr 1fr 1fr 80px 100px 80px';

  return (
    <>
      <AdminTopbar
        title="Wins"
        subtitle={`${wins.length} total · ${pendingCount} pending verification`}
        actions={<AdminSearch value={search} onChange={setSearch} placeholder="Search member or description…" />}
      />
      <AdminBody>
        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {[60, 48, 48, 48, 48].map((h, i) => <Skeleton key={i} h={h} />)}
          </div>
        ) : (
          <>
            {pendingCount > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', borderRadius: 'var(--r-md)', background: 'var(--navy-tint)', marginBottom: 18 }}>
                <Icon name="shieldcheck" size={18} color="var(--navy)" />
                <span style={{ fontWeight: 700, fontSize: 13.5, color: 'var(--navy)' }}>{pendingCount} win{pendingCount !== 1 ? 's' : ''} awaiting verification</span>
                <button onClick={() => setVerifiedFilter('pending')} className="btn btn-primary btn-sm" style={{ marginLeft: 'auto' }}>Review</button>
              </div>
            )}

            <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
              <FilterChip active={pillarFilter === 'all'} label="All pillars" onClick={() => setPillarFilter('all')} />
              {PILLARS.map(p => {
                const meta = pillarOf(p);
                return <FilterChip key={p} active={pillarFilter === p} label={meta?.name ?? p} icon={meta?.icon} onClick={() => setPillarFilter(p)} />;
              })}
              <div style={{ width: 1, height: 24, background: 'var(--line)', margin: '0 4px' }} />
              <FilterChip active={verifiedFilter === 'all'} label="All" onClick={() => setVerifiedFilter('all')} />
              <FilterChip active={verifiedFilter === 'pending'} label="Pending" onClick={() => setVerifiedFilter('pending')} />
              <FilterChip active={verifiedFilter === 'verified'} label="Verified" onClick={() => setVerifiedFilter('verified')} />
            </div>

            <Panel title={`${displayed.length} wins`} pad={false}>
              <THead cols={['Member', 'Description', 'Pillar', 'Type', 'Pts', 'Date', 'Verify']} template={COL} />
              {displayed.length === 0 ? (
                <div style={{ padding: '32px 16px', textAlign: 'center', color: 'var(--faint)', fontSize: 13 }}>No wins match your filter</div>
              ) : displayed.map(w => (
                <TRow key={w.id} template={COL}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Avatar name={w.members?.name ?? '?'} size={28} />
                    <span style={{ fontWeight: 600, fontSize: 13 }}>{w.members?.name ?? '—'}</span>
                  </div>
                  <span style={{ color: 'var(--muted)', fontSize: 12.5 }}>{w.description ?? '—'}</span>
                  {w.pillar ? <PillarChip pillar={w.pillar} size="sm" /> : <span style={{ color: 'var(--faint)' }}>—</span>}
                  <span style={{ fontSize: 12, color: 'var(--muted)' }}>{w.win_type ? (TYPE_LABEL[w.win_type] ?? w.win_type) : '—'}</span>
                  <span className="tnum" style={{ fontWeight: 700, color: 'var(--navy)' }}>+{w.points_earned}</span>
                  <span style={{ color: 'var(--muted)', fontSize: 12 }}>{new Date(w.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</span>
                  {w.verified
                    ? <span style={{ color: 'var(--navy)' }}><Icon name="shieldcheck" size={18} /></span>
                    : (
                      <button onClick={() => verify(w.id)} disabled={verifying === w.id} className="btn btn-ghost btn-sm" style={{ padding: '4px 10px', fontSize: 12 }}>
                        {verifying === w.id ? '…' : 'Verify'}
                      </button>
                    )}
                </TRow>
              ))}
            </Panel>
          </>
        )}
      </AdminBody>
    </>
  );
}

'use client';
import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase';

// ─── Shared types ─────────────────────────────────────────────────────────────

export interface MemberRow {
  id: string; name: string; email: string | null; whatsapp: string | null;
  life_stage: string | null; department: string | null; has_business: boolean | null;
  is_leader: boolean | null; points: number; leaderboard_opt_in: boolean | null;
  onboarding_complete: boolean; created_at: string;
}

export interface GoalRow {
  id: string; member_id: string; pillar: string; title: string;
  current: number | null; target: number | null; unit: string | null;
  due_date: string | null; status: string | null; created_at: string;
}

export interface WinRow {
  id: string; member_id: string; pillar: string | null; win_type: string | null;
  description: string | null; points_earned: number; created_at: string;
}

export interface AttendanceRow {
  id: string; session_id: string; member_id: string;
  status: string; checked_in_at: string | null; source: string;
}

export interface PointsBalance {
  member_id: string; total_points: number; this_month_points: number;
  last_recalc_at: string | null; updated_at: string;
}

export interface FormRow {
  id: string; title: string; description: string | null;
  estimated_seconds: number | null; is_pulse: boolean; is_wins_form: boolean;
  audience: string; open_at: string | null; close_at: string | null; created_at: string;
}

export interface FormResponseRow {
  id: string; form_id: string; member_id: string;
  data: Record<string, unknown>; submitted_at: string | null; created_at: string;
}

export interface InvitationRow {
  id: string; inviter_id: string; name: string | null; email: string | null;
  phone: string | null; stage: string; created_at: string;
}

export interface LeaderEntry {
  member_id: string; name: string; points: number; this_month_points: number;
}

export interface KPIData {
  memberCount: number;
  bizCount: number;
  certCount: number;
  formResponseCount: number;
  winCount: number;
  loading: boolean;
}

// ─── 1. useMembers ────────────────────────────────────────────────────────────

export function useMembers() {
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = createClient();

    const load = async () => {
      const { data } = await supabase
        .from('members')
        .select('id,name,email,whatsapp,life_stage,department,has_business,is_leader,points,leaderboard_opt_in,onboarding_complete,created_at')
        .eq('onboarding_complete', true)
        .order('created_at', { ascending: false });
      setMembers((data ?? []) as MemberRow[]);
      setLoading(false);
    };

    load();

    const channel = supabase.channel('rt-members')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'members' }, load)
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  return { members, loading };
}

// ─── 2. useGoals ──────────────────────────────────────────────────────────────

export function useGoals(memberId?: string) {
  const [goals, setGoals] = useState<GoalRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = createClient();

    const load = async () => {
      let q = supabase
        .from('goals')
        .select('id,member_id,pillar,title,current,target,unit,due_date,status,created_at')
        .order('created_at', { ascending: true });
      if (memberId) q = q.eq('member_id', memberId);
      const { data } = await q;
      setGoals((data ?? []) as GoalRow[]);
      setLoading(false);
    };

    load();

    const channel = supabase.channel(`rt-goals-${memberId ?? 'all'}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'goals' }, load)
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [memberId]);

  return { goals, loading };
}

// ─── 3. useWins ───────────────────────────────────────────────────────────────

export function useWins(memberId?: string) {
  const [wins, setWins] = useState<WinRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = createClient();

    const load = async () => {
      let q = supabase
        .from('wins')
        .select('id,member_id,pillar,win_type,description,points_earned,created_at')
        .order('created_at', { ascending: false })
        .limit(50);
      if (memberId) q = q.eq('member_id', memberId);
      const { data } = await q;
      setWins((data ?? []) as WinRow[]);
      setLoading(false);
    };

    load();

    const channel = supabase.channel(`rt-wins-${memberId ?? 'all'}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'wins' }, load)
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [memberId]);

  return { wins, loading };
}

// ─── 4. useAttendance ─────────────────────────────────────────────────────────

export function useAttendance(memberId?: string) {
  const [records, setRecords] = useState<AttendanceRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = createClient();

    const load = async () => {
      let q = supabase
        .from('attendance_records')
        .select('id,session_id,member_id,status,checked_in_at,source')
        .order('checked_in_at', { ascending: false })
        .limit(100);
      if (memberId) q = q.eq('member_id', memberId);
      const { data } = await q;
      setRecords((data ?? []) as AttendanceRow[]);
      setLoading(false);
    };

    load();

    const channel = supabase.channel(`rt-attendance-${memberId ?? 'all'}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'attendance_records' }, load)
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [memberId]);

  return { records, loading };
}

// ─── 5. usePoints ─────────────────────────────────────────────────────────────

export function usePoints(memberId: string) {
  const [balance, setBalance] = useState<PointsBalance | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!memberId) return;
    const supabase = createClient();

    const load = async () => {
      const { data } = await supabase
        .from('user_points_balance')
        .select('*')
        .eq('member_id', memberId)
        .maybeSingle();
      setBalance(data as PointsBalance | null);
      setLoading(false);
    };

    load();

    const channel = supabase.channel(`rt-points-${memberId}`)
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'user_points_balance',
        filter: `member_id=eq.${memberId}`,
      }, load)
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [memberId]);

  return { balance, loading };
}

// ─── 6. useLeaderboard ────────────────────────────────────────────────────────

export function useLeaderboard(limit = 50) {
  const [entries, setEntries] = useState<LeaderEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = createClient();

    const load = async () => {
      const { data } = await supabase
        .from('members')
        .select('id,name,points,leaderboard_opt_in')
        .eq('onboarding_complete', true)
        .eq('leaderboard_opt_in', true)
        .order('points', { ascending: false })
        .limit(limit);

      setEntries(
        ((data ?? []) as { id: string; name: string; points: number }[]).map(m => ({
          member_id: m.id,
          name: m.name ?? 'Member',
          points: m.points ?? 0,
          this_month_points: m.points ?? 0,
        }))
      );
      setLoading(false);
    };

    load();

    const channel = supabase.channel('rt-leaderboard')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'members' }, load)
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [limit]);

  return { entries, loading };
}

// ─── 7. useForms ──────────────────────────────────────────────────────────────

export function useForms() {
  const [forms, setForms] = useState<FormRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = createClient();

    const load = async () => {
      const { data } = await supabase
        .from('forms')
        .select('id,title,description,estimated_seconds,is_pulse,is_wins_form,audience,open_at,close_at,created_at')
        .order('created_at', { ascending: false });
      setForms((data ?? []) as FormRow[]);
      setLoading(false);
    };

    load();

    const channel = supabase.channel('rt-forms')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'forms' }, load)
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  return { forms, loading };
}

// ─── 8. useFormResponses ──────────────────────────────────────────────────────

export function useFormResponses(formId?: string) {
  const [responses, setResponses] = useState<FormResponseRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = createClient();

    const load = async () => {
      let q = supabase
        .from('form_responses')
        .select('id,form_id,member_id,data,submitted_at,created_at')
        .order('submitted_at', { ascending: false })
        .limit(200);
      if (formId) q = q.eq('form_id', formId);
      const { data } = await q;
      setResponses((data ?? []) as FormResponseRow[]);
      setLoading(false);
    };

    load();

    const channel = supabase.channel(`rt-responses-${formId ?? 'all'}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'form_responses' }, load)
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [formId]);

  return { responses, loading };
}

// ─── 9. useInvitations ────────────────────────────────────────────────────────

export function useInvitations(memberId?: string) {
  const [invitations, setInvitations] = useState<InvitationRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = createClient();

    const load = async () => {
      let q = supabase
        .from('invitations')
        .select('id,inviter_id,name,email,phone,stage,created_at')
        .order('created_at', { ascending: false });
      if (memberId) q = q.eq('inviter_id', memberId);
      const { data } = await q;
      setInvitations((data ?? []) as InvitationRow[]);
      setLoading(false);
    };

    load();

    const channel = supabase.channel(`rt-invitations-${memberId ?? 'all'}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'invitations' }, load)
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [memberId]);

  return { invitations, loading };
}

// ─── 10. useKPIs ─────────────────────────────────────────────────────────────

export function useKPIs(): KPIData {
  const [data, setData] = useState<KPIData>({
    memberCount: 0, bizCount: 0, certCount: 0,
    formResponseCount: 0, winCount: 0, loading: true,
  });

  useEffect(() => {
    const supabase = createClient();

    const load = async () => {
      const [memberRes, bizRes, certRes, responseRes, winRes] = await Promise.all([
        supabase.from('members').select('id', { count: 'exact', head: true }).eq('onboarding_complete', true),
        supabase.from('members').select('id', { count: 'exact', head: true }).eq('has_business', true),
        supabase.from('course_completions').select('id', { count: 'exact', head: true }),
        supabase.from('form_responses').select('id', { count: 'exact', head: true }),
        supabase.from('wins').select('id', { count: 'exact', head: true }),
      ]);

      setData({
        memberCount: memberRes.count ?? 0,
        bizCount: bizRes.count ?? 0,
        certCount: certRes.count ?? 0,
        formResponseCount: responseRes.count ?? 0,
        winCount: winRes.count ?? 0,
        loading: false,
      });
    };

    load();

    const channel = supabase.channel('rt-kpis')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'members' }, load)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'course_completions' }, load)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'wins' }, load)
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  return data;
}

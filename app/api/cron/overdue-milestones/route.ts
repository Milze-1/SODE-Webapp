import { createAdminClient } from '@/lib/supabase-server';
import { sendEmail, emailWrapper, ctaButton } from '@/lib/email';
import { sendWhatsApp } from '@/lib/whatsapp';

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response('Unauthorized', { status: 401 });
  }

  const db = createAdminClient();
  const today = new Date().toISOString().split('T')[0];
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://thesode.org';

  // Personal-goal milestones: goal_steps where member_id IS NULL, FK to goals → members
  const { data: personalOverdue } = await db
    .from('goal_steps')
    .select('id, title, deadline, milestone_status, goal_id, goals!inner(id, title, member_id, members!inner(id, name, email, whatsapp))')
    .lt('deadline', today)
    .in('milestone_status', ['not_started', 'in_progress'])
    .is('member_id', null);

  // Community-goal milestones: goal_steps where member_id IS NOT NULL, member info from goal_steps.member_id
  const { data: communityOverdue } = await db
    .from('goal_steps')
    .select('id, title, deadline, milestone_status, goal_id, member_id, goals!inner(id, title), members!inner(id, name, email, whatsapp)')
    .lt('deadline', today)
    .in('milestone_status', ['not_started', 'in_progress'])
    .not('member_id', 'is', null);

  const allOverdue = [
    ...(personalOverdue ?? []).map((m: Record<string, unknown>) => {
      const goal = m.goals as Record<string, unknown>;
      const member = goal?.members as Record<string, unknown>;
      return { id: m.id as string, title: m.title as string, deadline: m.deadline as string, goal_title: goal?.title as string, member };
    }),
    ...(communityOverdue ?? []).map((m: Record<string, unknown>) => {
      const goal = m.goals as Record<string, unknown>;
      const member = m.members as Record<string, unknown>;
      return { id: m.id as string, title: m.title as string, deadline: m.deadline as string, goal_title: goal?.title as string, member };
    }),
  ];

  if (allOverdue.length === 0) {
    return Response.json({ updated: 0, notified: 0 });
  }

  let updated = 0;
  let notified = 0;

  for (const milestone of allOverdue) {
    await db.from('goal_steps').update({ milestone_status: 'overdue' }).eq('id', milestone.id);
    updated++;

    const member = milestone.member as { id: string; name: string; email: string | null; whatsapp: string | null } | null;
    if (!member) continue;

    const daysLate = Math.floor((Date.now() - new Date(milestone.deadline + 'T00:00:00').getTime()) / 86400000);
    const dueFmt = new Date(milestone.deadline + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });

    if (member.email) {
      await sendEmail({
        to: member.email,
        subject: `Milestone overdue: ${milestone.title} ⚠️`,
        html: emailWrapper(`
          <p style="font-size:14px;color:#374151;margin:0 0 6px;">Hi ${member.name},</p>
          <h2 style="margin:0 0 16px;font-size:18px;color:#c53030;">⚠️ Milestone overdue</h2>
          <p style="font-size:14px;line-height:1.65;color:#374151;margin:0 0 12px;">
            One of your goal milestones is overdue by <strong>${daysLate} day${daysLate !== 1 ? 's' : ''}</strong>:
          </p>
          <div style="background:#fff5f5;border:1px solid #fed7d7;border-radius:12px;padding:16px;margin-bottom:16px;">
            <p style="margin:0;font-weight:700;color:#c53030;font-size:15px;">${milestone.title}</p>
            <p style="margin:4px 0 0;color:#718096;font-size:13.5px;">Part of: ${milestone.goal_title}</p>
            <p style="margin:4px 0 0;color:#718096;font-size:13.5px;">Was due: ${dueFmt}</p>
          </div>
          <p style="font-size:13.5px;color:#374151;line-height:1.65;margin:0 0 4px;">
            Don&apos;t give up — you can still complete this or update the deadline.
          </p>
          ${ctaButton('Update my milestone', `${appUrl}/member/goals`)}
        `),
      });
      notified++;
    }

    if (member.whatsapp) {
      await sendWhatsApp(
        member.whatsapp,
        `Hi ${member.name}! ⚠️\n\nYour SODE goal milestone is overdue:\n"${milestone.title}"\n\nGoal: ${milestone.goal_title}\nWas due: ${milestone.deadline}\n\nUpdate it here: ${appUrl}/member/goals`,
      );
    }

    // Admin notification
    await sendEmail({
      to: process.env.SODE_NOTIFY_EMAIL!,
      subject: `Member milestone overdue — ${member.name}`,
      html: emailWrapper(`
        <h2 style="margin:0 0 16px;font-size:18px;">Member milestone overdue</h2>
        <p style="font-size:14px;color:#374151;line-height:1.65;margin:0 0 8px;"><strong>Member:</strong> ${member.name}</p>
        <p style="font-size:14px;color:#374151;line-height:1.65;margin:0 0 8px;"><strong>Email:</strong> ${member.email ?? '—'}</p>
        <p style="font-size:14px;color:#374151;line-height:1.65;margin:0 0 8px;"><strong>Goal:</strong> ${milestone.goal_title}</p>
        <p style="font-size:14px;color:#374151;line-height:1.65;margin:0 0 8px;"><strong>Milestone:</strong> ${milestone.title}</p>
        <p style="font-size:14px;color:#374151;line-height:1.65;margin:0 0 8px;"><strong>Was due:</strong> ${dueFmt}</p>
        <p style="font-size:14px;color:#374151;line-height:1.65;margin:0 0 4px;"><strong>Days overdue:</strong> ${daysLate}</p>
        ${ctaButton('View in dashboard', `${appUrl}/admin/goals`)}
      `),
    });

    await new Promise(r => setTimeout(r, 100));
  }

  console.log(`[cron/overdue-milestones] date:${today} updated:${updated} notified:${notified}`);
  return Response.json({ updated, notified });
}

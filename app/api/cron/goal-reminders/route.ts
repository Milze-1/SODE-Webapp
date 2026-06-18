import { createAdminClient } from '@/lib/supabase-server';
import { sendEmail, emailWrapper, ctaButton } from '@/lib/email';

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response('Unauthorized', { status: 401 });
  }

  const db = createAdminClient();
  const today = new Date().toISOString().split('T')[0];
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://thesode.org';

  // Members with at-risk or behind goals (personal goals only)
  const { data: goals } = await db
    .from('goals')
    .select('member_id, title, status')
    .in('status', ['atrisk', 'behind'])
    .neq('goal_type', 'community');

  if (!goals || goals.length === 0) {
    return Response.json({ sent: 0, message: 'No at-risk goals' });
  }

  // Group goals by member
  const goalsByMember: Record<string, string[]> = {};
  for (const g of goals as { member_id: string; title: string; status: string }[]) {
    if (!goalsByMember[g.member_id]) goalsByMember[g.member_id] = [];
    goalsByMember[g.member_id].push(g.title);
  }
  const memberIds = Object.keys(goalsByMember);

  // Get member details
  const { data: members } = await db
    .from('members')
    .select('id, name, email')
    .in('id', memberIds)
    .eq('onboarding_complete', true);

  if (!members || members.length === 0) {
    return Response.json({ sent: 0, message: 'No eligible members' });
  }

  let sent = 0;
  for (const member of members as { id: string; name: string; email: string }[]) {
    // Skip if they already logged an update today
    const { count } = await db
      .from('goal_updates')
      .select('id', { count: 'exact', head: true })
      .eq('member_id', member.id)
      .gte('created_at', `${today}T00:00:00`);

    if ((count ?? 0) > 0) continue;

    const goalTitles = (goalsByMember[member.id] ?? []).slice(0, 2);
    const goalList = goalTitles.map(t => `<li style="margin-bottom:4px;">${t}</li>`).join('');

    const result = await sendEmail({
      to: member.email,
      subject: `Your goals need attention today 🎯`,
      html: emailWrapper(`
        <p style="font-size:14px;color:#374151;margin:0 0 6px;">Hi ${member.name},</p>
        <h2 style="margin:0 0 16px;font-size:18px;color:#1a1a2e;">Don&apos;t let momentum slip</h2>
        <p style="font-size:14px;line-height:1.65;color:#374151;margin:0 0 12px;">
          You haven&apos;t logged progress today and some of your goals are falling behind:
        </p>
        <div style="background:#fef3c7;border-radius:10px;padding:14px 16px;margin-bottom:16px;">
          <ul style="margin:0;padding-left:18px;font-size:14px;color:#92400e;font-weight:600;">
            ${goalList}
          </ul>
        </div>
        <p style="font-size:13.5px;color:#374151;line-height:1.65;margin:0 0 4px;">
          It takes 60 seconds to log an update. Every step forward counts.
        </p>
        ${ctaButton('Update my progress', `${appUrl}/member/goals`)}
      `),
    });

    if (result.ok) sent++;
    await new Promise(r => setTimeout(r, 100));
  }

  console.log(`[cron/goal-reminders] date:${today} sent:${sent}/${members.length}`);
  return Response.json({ sent, total: members.length });
}

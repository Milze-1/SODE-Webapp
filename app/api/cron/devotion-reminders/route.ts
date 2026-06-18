import { createAdminClient } from '@/lib/supabase-server';
import { sendEmail, emailWrapper, ctaButton } from '@/lib/email';
import { type BibleReadingPlanRow, getDayPassage, getDayNumber } from '@/lib/bible-structure';

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response('Unauthorized', { status: 401 });
  }

  const db = createAdminClient();
  const today = new Date().toISOString().split('T')[0];
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://thesode.org';

  // Members with active reading plans
  const { data: plans } = await db
    .from('bible_reading_plans')
    .select('*, members(id, name, email)');

  if (!plans || plans.length === 0) {
    return Response.json({ sent: 0, message: 'No active reading plans' });
  }

  // Find today's journal entries so we can skip members who already checked in
  const memberIds = (plans as { member_id: string }[]).map(p => p.member_id).filter(Boolean);
  const { data: todayEntries } = await db
    .from('devotion_journal')
    .select('member_id, checklist')
    .in('member_id', memberIds)
    .eq('entry_date', today);

  const completedToday = new Set(
    (todayEntries ?? [])
      .filter((e: { checklist: { read: boolean } | null }) => e.checklist?.read)
      .map((e: { member_id: string }) => e.member_id)
  );

  let sent = 0;
  for (const plan of plans as (BibleReadingPlanRow & { members: { id: string; name: string; email: string } | null })[]) {
    const member = plan.members;
    if (!member?.email || completedToday.has(member.id)) continue;

    const dayNumber = getDayNumber(plan.start_date);
    const passage = getDayPassage(plan, dayNumber);
    const passageLine = passage
      ? `<div style="background:#f5f5f7;border-radius:10px;padding:14px 16px;margin-bottom:16px;">
           <p style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:#6b7280;margin:0 0 4px;">Today&apos;s reading</p>
           <p style="font-size:17px;font-weight:800;color:#1a1a2e;margin:0;">${passage.displayText}</p>
           <p style="font-size:12px;color:#6b7280;margin:6px 0 0;">Day ${dayNumber} of your reading plan</p>
         </div>`
      : '';

    const result = await sendEmail({
      to: member.email,
      subject: `Your devotion time 🙏`,
      html: emailWrapper(`
        <p style="font-size:14px;color:#374151;margin:0 0 6px;">Good morning, ${member.name}!</p>
        <h2 style="margin:0 0 16px;font-size:19px;color:#1a1a2e;">Time to start your day with God</h2>
        ${passageLine}
        <p style="font-size:13.5px;color:#374151;line-height:1.65;margin:0 0 4px;">
          Just a few minutes in the Word, a moment of prayer, and a short reflection — that&apos;s your devotion for today.
          Keep the streak going 🔥
        </p>
        ${ctaButton('Open my devotion', `${appUrl}/member/devotion`)}
      `),
    });

    if (result.ok) sent++;
    await new Promise(r => setTimeout(r, 100));
  }

  console.log(`[cron/devotion-reminders] date:${today} sent:${sent}/${plans.length}`);
  return Response.json({ sent, total: plans.length });
}

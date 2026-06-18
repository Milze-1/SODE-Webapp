import Anthropic from '@anthropic-ai/sdk';
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';

const client = new Anthropic();

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { goalTitle, pillar, description } = (await request.json()) as {
    goalTitle: string; pillar: string; description?: string;
  };

  try {
    const message = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      messages: [{
        role: 'user',
        content: `You are a helpful coach for the School of Daniels & Esthers (SODE), a faith-based leadership and professional development program for young Nigerians.

A member has set this goal:
Title: "${goalTitle}"
Pillar: "${pillar}"
Description: "${description ?? 'Not provided'}"

Generate 5 practical, specific, actionable steps to help them achieve this goal. Each step should be concrete and measurable.

For Spiritual pillar goals include faith-based elements like Bible reading, prayer, and spiritual disciplines.
For Career goals include skill building, networking, and professional development.
For Business goals include market research, customer acquisition, and business building.
For Character goals include habits, relationships, and personal development.

Return ONLY a JSON array, no other text:
[
  {
    "title": "Step title (max 60 chars)",
    "description": "Brief description of how to do this step"
  }
]`,
      }],
    });

    const text = message.content[0].type === 'text' ? message.content[0].text : '[]';
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    const steps = jsonMatch ? JSON.parse(jsonMatch[0]) : [];
    return NextResponse.json({ steps });
  } catch (err) {
    console.error('[goals/suggest] error:', err);
    return NextResponse.json({ steps: [] });
  }
}

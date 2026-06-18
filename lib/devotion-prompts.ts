const PRAYER_PROMPTS = [
  'Lord, as I read {passage} today, speak to me about where I need to trust You more.',
  'Father, show me in {passage} what You want me to apply to my life this week.',
  'Holy Spirit, illuminate {passage} — help me see it with fresh eyes.',
  'God, let what I read in {passage} change the way I think, speak, and act today.',
  'Lord, I bring my questions to You as I read {passage}. Speak peace into my situation.',
  'Father, {passage} reminds me of Your faithfulness. Help me walk in that truth today.',
  'Jesus, as I read {passage}, align my heart with Yours — let Your will become my desire.',
  'Lord, I thank You for the truth in {passage}. Help me carry it beyond this moment.',
  'Father, open my heart to receive {passage} not just as words, but as a word for me today.',
  'Holy Spirit, let {passage} move from my head to my heart as I pray and reflect.',
];

const REFLECTION_SETS = [
  [
    'What is the main truth this passage reveals about God\'s character?',
    'Is there a promise here I need to hold onto today?',
    'What is one action step I can take based on what I just read?',
  ],
  [
    'What surprised or challenged you in this passage?',
    'How does this passage apply to a situation you\'re currently facing?',
    'Write a one-sentence prayer in response to what you read.',
  ],
  [
    'What attribute of God do you see in this passage?',
    'Is there a sin to avoid or a virtue to pursue here?',
    'How would your week look different if you fully lived out this passage?',
  ],
  [
    'What is the context of this passage and why does it matter?',
    'Which verse or phrase stands out most to you, and why?',
    'How can you share what you learned today with someone else?',
  ],
  [
    'What does this passage reveal about human nature or our need for God?',
    'How does this passage point toward Jesus?',
    'What would change in your relationships if you applied this today?',
  ],
];

function hash(s: string): number {
  return s.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
}

export function generatePrayerPrompt(passage: string): string {
  const template = PRAYER_PROMPTS[hash(passage) % PRAYER_PROMPTS.length];
  return template.replace('{passage}', passage);
}

export function generateReflectionQuestions(passage: string): string[] {
  return REFLECTION_SETS[(hash(passage) + 1) % REFLECTION_SETS.length];
}

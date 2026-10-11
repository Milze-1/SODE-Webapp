// Option lists for the "Complete your profile" task (/member/profile/complete).
// These questions used to live in onboarding; they're kept here so the task
// page, completeness checks and the reminder cron agree on what "complete"
// means.

export const LIFE_STAGES = ['Student', 'Professional', 'Entrepreneur', 'Between roles'];
export const DEPTS = ['Ushering', 'Media', 'Choir', 'Welfare', 'Tech', 'Not yet'];

// Maps display labels → DB enum values (pgEnum life_stage)
export const LIFE_STAGE_MAP: Record<string, string> = {
  'Student': 'student',
  'Professional': 'professional',
  'Entrepreneur': 'entrepreneur',
  'Between roles': 'between_roles',
};
export const LIFE_STAGE_LABEL: Record<string, string> = Object.fromEntries(
  Object.entries(LIFE_STAGE_MAP).map(([label, value]) => [value, label]),
);

export const INDUSTRIES = [
  'Technology', 'Finance / banking', 'Healthcare', 'Law', 'Education',
  'Media / content', 'Creative arts', 'Business / consulting',
  'Government / public service', 'Real estate / construction',
  'Oil & gas / energy', 'Non-profit / NGO', 'Agriculture', 'Ministry / theology', 'Other',
];

export const CAREER_STAGES = [
  'Just starting out (0–2 yrs)', 'Building (3–7 yrs)',
  'Established (8–15 yrs)', 'Senior / leading others', 'Transitioning / pivoting',
];

export const STRENGTH_AREAS = [
  'Strategy & leadership', 'Financial analysis', 'Technology & systems',
  'Communication & storytelling', 'Teaching & training', 'Operations & execution',
  'People & relationships', 'Creative & design', 'Research & analysis',
  'Sales & business development', 'Legal & compliance', 'Healthcare & wellness', 'Other',
];

export const MOUNTAINS = [
  { key: 'Business',    sub: 'Commerce, enterprise' },
  { key: 'Government',  sub: 'Policy, public service' },
  { key: 'Education',   sub: 'Schools, training' },
  { key: 'Media & arts', sub: 'Storytelling, culture' },
  { key: 'Family',      sub: 'Home, community' },
  { key: 'Religion',    sub: 'Church, ministry' },
  { key: 'Healthcare',  sub: 'Medicine, wellbeing' },
];

export const LEADERSHIP_OPTIONS = [
  'Yes — leading a team or organisation',
  'Yes — leading in church / ministry',
  'Yes — community or volunteer leadership',
  'Not yet, but preparing for it',
  'No',
];

export const BUSINESS_STATUSES = [
  'I have a registered business', 'I have an idea, not yet started',
  'Actively building (unregistered)', 'No business interest currently',
];
export const HAS_BUSINESS_STATUSES = BUSINESS_STATUSES.slice(0, 3);
export const BUSINESS_DETAIL_STATUSES = ['I have a registered business', 'Actively building (unregistered)'];

export const BUSINESS_INDUSTRIES = [
  'Fintech', 'Healthcare', 'Edtech', 'E-commerce', 'Food & beverage', 'Real estate',
  'Media / content', 'Agriculture', 'Logistics', 'Technology / SaaS', 'Consulting', 'Other',
];
export const BUSINESS_EMPLOYEES = ['Just me', '2–5', '6–20', '21–50', '50+'];

export const SUPPORT_OPTIONS = [
  'Mentorship from someone ahead of me', 'Peer accountability', 'Skill-building / learning',
  'Business connections', 'Spiritual direction', 'All of the above',
];

export const MOUNTAIN_TO_PILLAR: Record<string, string> = {
  'Business': 'business',
  'Government': 'career',
  'Education': 'career',
  'Media & arts': 'character',
  'Family': 'character',
  'Religion': 'spiritual',
  'Healthcare': 'career',
};

// The member columns the task fills in, and how many required answers exist —
// used for the progress shown on the home task card.
export const PROFILE_FIELDS =
  'life_stage,department,industry,career_stage,strength_area,mountains,leadership_role,business_status,three_year_goal,support_needed';

export interface ProfileFields {
  life_stage: string | null; department: string | null; industry: string | null;
  career_stage: string | null; strength_area: string[] | null; mountains: string[] | null;
  leadership_role: string[] | null; business_status: string | null;
  three_year_goal: string | null; support_needed: string | null;
}

export function profileProgress(p: Partial<ProfileFields>): { answered: number; total: number } {
  const checks = [
    p.life_stage, p.department, p.mountains?.length, p.industry, p.career_stage,
    p.strength_area?.length, p.leadership_role?.length, p.business_status,
    p.three_year_goal?.trim(), p.support_needed,
  ];
  return { answered: checks.filter(Boolean).length, total: checks.length };
}

-- 014: "Complete your profile" task
--
-- Onboarding now only asks for the basics (first-timer, name, WhatsApp,
-- consent). The rest of the old questionnaire (life stage, department,
-- industry, career stage, strengths, mountains, leadership, business,
-- 3-year goal, support needed) is filled in later from an in-app task at
-- /member/profile/complete. Completing it is what makes a member ready for
-- mentor matching — admins see a "Profile incomplete" warning otherwise.

ALTER TABLE public.members
  ADD COLUMN IF NOT EXISTS profile_complete     boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS profile_completed_at timestamptz;

-- Backfill: members who already answered the full questionnaire during the
-- old onboarding shouldn't be asked again. (Members who tapped "I'll do it
-- later" skipped required answers and stay incomplete.)
UPDATE public.members
SET    profile_complete = true,
       profile_completed_at = COALESCE(updated_at, now())
WHERE  onboarding_complete = true
  AND  profile_complete = false
  AND  life_stage     IS NOT NULL
  AND  industry       IS NOT NULL
  AND  career_stage   IS NOT NULL
  AND  mountains      IS NOT NULL
  AND  three_year_goal IS NOT NULL
  AND  support_needed IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_members_profile_incomplete
  ON public.members (id)
  WHERE onboarding_complete = true AND profile_complete = false;

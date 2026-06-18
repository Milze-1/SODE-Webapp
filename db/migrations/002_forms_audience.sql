-- ============================================================================
-- 002_forms_audience.sql — Forms audience targeting
-- Run after 001_initial.sql.
-- ============================================================================

-- forms: real publish flag (admin forms page already assumed this existed)
-- and the JSON audience-targeting rule.
ALTER TABLE public.forms
  ADD COLUMN IF NOT EXISTS is_active     BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS form_audience JSONB   NOT NULL DEFAULT '{"type":"everyone"}'::jsonb;

-- Preserve currently-open forms as "active" so the migration doesn't hide them.
UPDATE public.forms
SET is_active = TRUE
WHERE open_at IS NOT NULL
  AND (close_at IS NULL OR close_at > NOW());

-- members: explicit primary pillar, needed for "by pillar" audience targeting.
ALTER TABLE public.members
  ADD COLUMN IF NOT EXISTS pillar public.pillar;

-- life_stage: spec calls for student | young_professional | entrepreneur | employed | other.
-- Add the two missing values; existing 'between_roles' rows are left intact.
ALTER TYPE public.life_stage ADD VALUE IF NOT EXISTS 'employed';
ALTER TYPE public.life_stage ADD VALUE IF NOT EXISTS 'other';

-- reminders: link a reminder back to the record that triggered it (e.g. a form).
ALTER TABLE public.reminders
  ADD COLUMN IF NOT EXISTS reference_id UUID;

-- forms_read_open policy predates is_active — require it for non-admins too.
DROP POLICY IF EXISTS "forms_read_open" ON public.forms;
CREATE POLICY "forms_read_open"
  ON public.forms FOR SELECT TO authenticated
  USING (
    public.auth_is_admin()
    OR (
      is_active = TRUE
      AND (open_at  IS NULL OR open_at  <= NOW())
      AND (close_at IS NULL OR close_at >= NOW())
    )
  );

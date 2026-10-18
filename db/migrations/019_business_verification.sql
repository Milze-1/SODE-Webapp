-- 019: Business registry verification (Admin → Cells → Business registry)
--
-- Leaders verify a member's self-reported business stage ("guard against
-- success theatre"). Written server-side via /api/admin/registers.

ALTER TABLE public.members
  ADD COLUMN IF NOT EXISTS business_verified_at timestamptz,
  ADD COLUMN IF NOT EXISTS business_verified_by uuid;

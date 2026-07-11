-- 008: External mentor invites
-- Invited mentors are NOT added to `members` until they register.
-- A pending invite is stored here; on registration the invite is applied
-- (member gets is_mentor = true) and the invite is marked accepted.

CREATE TABLE IF NOT EXISTS public.mentor_invites (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name               text NOT NULL,
  email              varchar(255) NOT NULL,
  pillar             pillar,
  mentor_capacity    integer NOT NULL DEFAULT 3,
  status             text NOT NULL DEFAULT 'pending',  -- 'pending' | 'accepted' | 'revoked'
  invited_by         uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  accepted_member_id uuid REFERENCES public.members(id) ON DELETE SET NULL,
  accepted_at        timestamptz,
  created_at         timestamptz DEFAULT now(),
  updated_at         timestamptz DEFAULT now()
);

-- One live pending invite per email
CREATE UNIQUE INDEX IF NOT EXISTS mentor_invites_pending_email_uq
  ON public.mentor_invites (lower(email))
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS mentor_invites_email_idx ON public.mentor_invites (lower(email));

ALTER TABLE public.mentor_invites ENABLE ROW LEVEL SECURITY;

-- Admins can read invites (pending list in the mentorship screen)
CREATE POLICY "mentor_invites_read_admin"
  ON public.mentor_invites FOR SELECT TO authenticated
  USING (public.auth_is_admin());

-- Admins can update invites (revoke)
CREATE POLICY "mentor_invites_update_admin"
  ON public.mentor_invites FOR UPDATE TO authenticated
  USING (public.auth_is_admin());

-- Inserts and acceptance happen server-side via the service role (bypasses RLS).

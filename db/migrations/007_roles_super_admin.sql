-- 007: Super-admin + sub-admin roles, and no duplicate role assignments.
--
-- • super_admin      — unrestricted access to everything; can assign/unassign
--                      any access.
-- • business_dev     — sub-admin (Business Development)
-- • external_mentor  — sub-admin (External Mentors)
--
-- Run against Supabase with: psql $DATABASE_URL -f db/migrations/007_roles_super_admin.sql
-- (ALTER TYPE ... ADD VALUE cannot run inside a transaction block.)

ALTER TYPE role ADD VALUE IF NOT EXISTS 'super_admin';
ALTER TYPE role ADD VALUE IF NOT EXISTS 'business_dev';
ALTER TYPE role ADD VALUE IF NOT EXISTS 'external_mentor';

-- One admin role per user: remove duplicates, keep the most recently granted
-- row, then enforce uniqueness going forward. The app now replaces a user's
-- existing role when a new one is assigned ("update on top"), so this
-- constraint is a backstop against races and manual inserts.
DELETE FROM user_roles a
USING user_roles b
WHERE a.user_id = b.user_id
  AND a.ctid < b.ctid;

CREATE UNIQUE INDEX IF NOT EXISTS user_roles_one_role_per_user
  ON user_roles (user_id);

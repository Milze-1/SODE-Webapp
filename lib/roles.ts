// Role constants are edge-runtime safe. getUserRoles uses a dynamic import so
// that importing this file from middleware does NOT pull in next/headers.

export const ROLES = {
  DIRECTOR:          "director",
  SPIRITUAL_LEAD:    "spiritual_lead",
  CAREER_LEAD:       "career_lead",
  BUSINESS_LEAD:     "business_lead",
  MEMBER_CARE_LEAD:  "member_care_lead",
  DATA_OPS_LEAD:     "data_ops_lead",
  MEMBER:            "member",
} as const;

export type Role = (typeof ROLES)[keyof typeof ROLES];

const ADMIN_ROLES = new Set<Role>([
  ROLES.DIRECTOR,
  ROLES.SPIRITUAL_LEAD,
  ROLES.CAREER_LEAD,
  ROLES.BUSINESS_LEAD,
  ROLES.MEMBER_CARE_LEAD,
  ROLES.DATA_OPS_LEAD,
]);

export function hasAdminAccess(roles: Role[]): boolean {
  return roles.some((r) => ADMIN_ROLES.has(r));
}

// Server-only (Node.js runtime). Dynamic import keeps this file edge-safe.
export async function getUserRoles(userId: string): Promise<Role[]> {
  const { createClient } = await import("@/lib/supabase-server");
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId);

  if (error || !data?.length) return [ROLES.MEMBER];
  return data.map((r) => r.role as Role);
}

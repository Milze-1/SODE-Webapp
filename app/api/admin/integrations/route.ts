import { createClient } from '@/lib/supabase-server';
import { getUserRoles, hasAdminAccess } from '@/lib/roles';

// Read-only status of the external services the app depends on, for the
// admin Settings → Integrations panel (it used to show toggles that did
// nothing). "Connected" means the server has the credentials configured.
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  if (!hasAdminAccess(await getUserRoles(user.id))) return Response.json({ error: 'Admin access required' }, { status: 403 });

  return Response.json({
    email: !!process.env.RESEND_API_KEY,
    whatsapp: !!process.env.TERMII_API_KEY,
    push: !!(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY),
    scheduler: !!process.env.TICK_SECRET,
  });
}

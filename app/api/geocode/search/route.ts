import { createClient } from '@/lib/supabase-server';

const ADMIN_ROLES = new Set([
  'super_admin', 'director', 'spiritual_lead', 'career_lead', 'business_lead',
  'member_care_lead', 'data_ops_lead', 'business_dev', 'external_mentor',
]);

interface NominatimResult {
  display_name: string;
  lat: string;
  lon: string;
}

// Proxies OpenStreetMap's free Nominatim geocoder for the location-autocomplete
// field in admin session/settings forms. Server-side so we can set a proper
// User-Agent (Nominatim's usage policy requires one) and keep the endpoint
// admin-gated rather than exposing an open proxy anyone could hammer.
export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: roles } = await supabase.from('user_roles').select('role').eq('user_id', user.id);
  const isAdmin = (roles ?? []).some((r: { role: string }) => ADMIN_ROLES.has(r.role));
  if (!isAdmin) return Response.json({ error: 'Admin access required' }, { status: 403 });

  const q = new URL(request.url).searchParams.get('q')?.trim() ?? '';
  if (q.length < 3) return Response.json({ results: [] });

  const url = `https://nominatim.openstreetmap.org/search?format=json&limit=5&q=${encodeURIComponent(q)}`;
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'SODE-Platform/1.0 (https://thesode.org; connect@thesode.org)',
      'Accept-Language': 'en',
    },
  });

  if (!res.ok) return Response.json({ results: [] });

  const data = (await res.json()) as NominatimResult[];
  const results = data.map(r => ({
    label: r.display_name,
    lat: parseFloat(r.lat),
    lng: parseFloat(r.lon),
  }));

  return Response.json({ results });
}

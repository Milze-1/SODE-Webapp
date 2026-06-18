# SODE Platform Deployment Guide

## Prerequisites
- Vercel account (free hobby plan is fine)
- Supabase project (already set up)
- Resend account with thesode.org domain verified
- GitHub account

---

## Steps

### 1. Push to GitHub

```bash
git init  # if not already a repo
git add .
git commit -m "Initial SODE platform"
git remote add origin https://github.com/YOUR_USERNAME/sode-platform.git
git push -u origin main
```

### 2. Deploy to Vercel

1. Go to [vercel.com](https://vercel.com) and sign in
2. Click **New Project**
3. Click **Import** next to your `sode-platform` GitHub repo
4. Framework: **Next.js** (auto-detected)
5. Click **Environment Variables** and add all from `docs/environment-variables.md`
6. Set `NEXT_PUBLIC_APP_URL` to your production domain (e.g. `https://thesode.org`)
7. Click **Deploy**

### 3. Custom domain

1. In Vercel → Project → **Domains**
2. Add `thesode.org`
3. Update your DNS to point to Vercel (they give you the records)
4. Wait for SSL to provision (usually < 2 minutes)

### 4. Update Supabase after deployment

In Supabase dashboard → **Authentication** → **URL Configuration**:

- **Site URL**: `https://thesode.org`
- **Redirect URLs** (add all):
  - `https://thesode.org/auth/callback`
  - `https://thesode.org/auth/reset-password`
  - `http://localhost:3000/auth/callback` (keep for dev)

### 5. Update Google OAuth (if using Google sign-in)

In [Google Cloud Console](https://console.cloud.google.com) → APIs & Services → Credentials:

- **Authorised JavaScript origins**: add `https://thesode.org`
- **Authorised redirect URIs**: add your Supabase OAuth callback URL
  - Format: `https://YOUR_PROJECT.supabase.co/auth/v1/callback`

### 6. Verify email is working

Visit `https://thesode.org/api/test-email` in your browser.
Check `connect@thesode.org` inbox — should arrive within 30 seconds.

### 7. Verify cron jobs

Cron jobs run automatically via Vercel Cron (configured in `vercel.json`):
- Session reminders: 5pm WAT (16:00 UTC)
- Goal reminders: 8pm WAT (19:00 UTC)
- Devotion reminders: 7am WAT (06:00 UTC)

To test a cron endpoint manually, call it with the auth header:
```bash
curl -H "Authorization: Bearer YOUR_CRON_SECRET" \
  https://thesode.org/api/cron/session-reminders
```

---

## Re-deploying

Vercel auto-deploys on every push to `main`. No manual action needed.

## Environment variable changes

If you update env vars in Vercel, trigger a redeploy:
Vercel → Deployments → click **Redeploy** on latest.

# Pre-deployment Checklist

## Code
- [ ] `npm run build` passes with zero errors
- [ ] All TypeScript errors resolved
- [ ] No `console.log` with sensitive data (passwords, keys, PII)

## Database (Supabase)
- [ ] All table migrations applied (run the SQL from the summary doc)
- [ ] RLS enabled on all tables
- [ ] Point rules seeded (`point_rules` table populated)
- [ ] `ALTER TABLE public.goals ALTER COLUMN member_id DROP NOT NULL` applied
- [ ] `bible_reading_plans` and `devotion_journal` tables created
- [ ] Test director account created and assigned `director` role in `user_roles`

## Email (Resend)
- [ ] `RESEND_API_KEY` added to `.env.local` (and to Vercel env vars)
- [ ] `thesode.org` domain verified in Resend dashboard
- [ ] Test email received: visit `/api/test-email` → check `connect@thesode.org`
- [ ] `SODE_FROM_EMAIL=connect@thesode.org` set
- [ ] `SODE_NOTIFY_EMAIL=connect@thesode.org` set

## Auth
- [ ] Email/password login works
- [ ] Google OAuth configured (if used)
- [ ] Password reset email arrives
- [ ] Redirect URLs set in Supabase (see DEPLOYMENT.md step 4)

## Features tested end-to-end
- [ ] Registration creates member record + sends welcome email
- [ ] Onboarding flow completes and sets `onboarding_complete = true`
- [ ] Personal goals can be created, updated, completed
- [ ] Community goals: admin creates → publishes → appears on member page
- [ ] Wins can be submitted and appear in admin feed
- [ ] Forms: admin publishes → member sees and submits
- [ ] Attendance check-in works (QR or manual)
- [ ] Points awarded correctly for goals, wins, devotion
- [ ] Leaderboard updates in real time
- [ ] Admin dashboard shows live member data
- [ ] Mentor assignment sends email notification
- [ ] Devotion reading plan can be created and checked off
- [ ] Bible passage loads from API (`/member/devotion`)
- [ ] Invitation email sends when member invites a contact

## Security
- [ ] `.env.local` is in `.gitignore` and NOT committed
- [ ] `CRON_SECRET` is set and all cron routes return 401 without it
- [ ] Service role key is only used in server-side API routes
- [ ] No API keys visible in client-side code

## Vercel
- [ ] `vercel.json` committed with cron config
- [ ] All env vars added to Vercel project settings
- [ ] `NEXT_PUBLIC_APP_URL` set to production domain
- [ ] Custom domain configured and SSL active

## Post-deployment
- [ ] Visit `/api/test-email` on prod and confirm email arrives
- [ ] Create a test member account and complete onboarding
- [ ] Award points and confirm leaderboard updates
- [ ] Check Vercel logs for any runtime errors

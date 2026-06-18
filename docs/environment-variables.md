# Environment Variables

## Required for Production

### Supabase
```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
```

### Database
```
DATABASE_URL=
```

### Email (Resend)
```
RESEND_API_KEY=
SODE_FROM_EMAIL=connect@thesode.org
SODE_NOTIFY_EMAIL=connect@thesode.org
```

### App
```
NEXT_PUBLIC_APP_URL=https://thesode.org
```

### Security
```
CRON_SECRET=generate-a-random-string-here
```
Generate with:
```
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

## Optional
```
ANTHROPIC_API_KEY=
```
Only needed for AI goal suggestions feature (`/api/goals/suggest`).

### WhatsApp/SMS (Termii)
```
TERMII_API_KEY=
```
Get from termii.com — pay as you go (~$0.057 per WhatsApp message in Nigeria).
Used for overdue milestone WhatsApp notifications. If not set, notifications are skipped gracefully.

## Local development — copy to `.env.local`
```
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
DATABASE_URL=postgresql://postgres:password@db.your-project.supabase.co:5432/postgres
RESEND_API_KEY=re_xxxxxxxxxxxx
SODE_FROM_EMAIL=connect@thesode.org
SODE_NOTIFY_EMAIL=connect@thesode.org
NEXT_PUBLIC_APP_URL=http://localhost:3000
CRON_SECRET=local-dev-secret
ANTHROPIC_API_KEY=sk-ant-xxxxxxxxxxxx
```

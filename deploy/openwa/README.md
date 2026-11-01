# OpenWA — WhatsApp gateway for SODE broadcasts

The app sends WhatsApp messages (Admin → Messages, milestone nudges) through
[OpenWA](https://github.com/rmyndharis/OpenWA), a self-hosted gateway that
links a WhatsApp number the same way WhatsApp Web does. It must run on its
own always-on server — it can't run on Vercel.

> **Read this first.** OpenWA is not Meta's official WhatsApp API. WhatsApp can
> restrict or ban a number that sends bulk messages this way. So:
> - **Use a dedicated SODE number** (a new SIM), never someone's personal line.
> - **Warm it up**: use it normally for a week or two before big broadcasts.
> - The app already only messages members who allow WhatsApp messages,
>   honours **STOP** replies, and sends ~4 per minute with random gaps.
> - Keep email/push for anything critical.

## 1. Get a server

Any Linux VPS with **2 GB RAM** (the whatsapp-web.js engine runs a headless
Chrome, ~300–500 MB) and Docker. E.g. a 2 GB droplet/instance on DigitalOcean,
Hetzner or Contabo. Point a subdomain at it, e.g. `wa.thesode.org` → server IP
(an `A` record at your DNS provider).

## 2. Install and start OpenWA

```bash
# on the server
curl -fsSL https://get.docker.com | sh
git clone https://github.com/rmyndharis/OpenWA.git && cd OpenWA
cp .env.example .env
```

Edit `.env` and set at least:

```
ENGINE_TYPE=whatsapp-web.js
SEND_PACING_ENABLED=true
RESOLVE_LID_TO_PHONE=true
```

`SEND_PACING_ENABLED` adds OpenWA's own daily caps for a young number on top of
the app's pacing. `RESOLVE_LID_TO_PHONE` lets STOP replies be matched to members.

```bash
docker compose up -d --build        # first build takes several minutes
docker compose exec openwa-api cat /app/data/.api-key   # copy this API key
```

OpenWA only listens on the server itself (`127.0.0.1:2785`); Caddy (next step)
is what makes it reachable over HTTPS.

## 3. Put HTTPS in front (Caddy)

Copy `Caddyfile` from this folder to the server, change the domain if needed,
then:

```bash
docker run -d --name caddy --restart unless-stopped --network host \
  -v $PWD/Caddyfile:/etc/caddy/Caddyfile -v caddy_data:/data caddy:2
```

`https://wa.thesode.org/api/health` should now answer.

## 4. Connect the app

In Vercel → sode-webapp → Settings → Environment Variables (Production):

| Name | Value |
|---|---|
| `OPENWA_URL` | `https://wa.thesode.org` |
| `OPENWA_API_KEY` | the key from step 2 |
| `OPENWA_WEBHOOK_SECRET` | any random string, 32+ characters |
| `WHATSAPP_PER_MINUTE` | optional, default `4` (max 10) |

Redeploy, then open **Admin → Messages → Connect WhatsApp** and scan the QR
code with the SODE phone (WhatsApp → Settings → Linked devices → Link a
device). The status turns **Connected** and replies are wired up automatically.

## How sending works

- Pressing **Send** queues one message per member (personalised with
  `{{first_name}}` / `{{name}}`, plus "Reply STOP to stop these messages").
- Every minute the app sends the next few with random 3–6 s gaps; failures
  retry after 5 and 30 minutes, then show as failed.
- Progress (sent / waiting / failed) shows under **Recent messages**, with a
  **Stop** button for the rest of a broadcast.
- If the number is disconnected, messages simply wait until it's linked again.
- **STOP** (or unsubscribe) turns off the member's "WhatsApp alerts" and cancels
  anything queued for them; **START** turns it back on.

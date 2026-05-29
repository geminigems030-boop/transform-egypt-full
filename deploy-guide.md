# TransforM Egypt — Deployment Guide & Fix Checklist

## CRITICAL FIXES (apply now)

### 1. Set GEMINI_API_KEY in Railway (URGENT — fixes broken chat)
The Yara website chat widget is returning 500 errors because `GEMINI_API_KEY` is not set.

**Steps:**
1. Go to [railway.app](https://railway.app) → your TransforM Egypt project
2. Click the API Server service
3. Go to **Variables** tab
4. Add: `GEMINI_API_KEY` = your Google AI Studio key
   - Get a free key at: https://aistudio.google.com/app/apikey
5. Railway will auto-redeploy

### 2. Set ADMIN_TOKEN in Railway (for Admin Panel access)
The Admin Panel at transform-egypt.com/admin requires this token.

**Steps:**
1. In Railway Variables, add: `ADMIN_TOKEN` = any secret string (min 8 chars)
2. Use this same value when logging into the Admin panel

---

## Full Environment Variables Required in Railway

### REQUIRED (site breaks without these)
| Variable | Where to get it |
|---|---|
| `DATABASE_URL` | Supabase → Settings → Database → Transaction connection string |
| `GEMINI_API_KEY` | https://aistudio.google.com/app/apikey (free) |
| `ADMIN_TOKEN` | Make up any secret string (min 8 chars) |
| `PORT` | Set by Railway automatically — do not set manually |

### FOR ADMIN INBOX AI DRAFTS (Yara replies to DMs)
| Variable | Value |
|---|---|
| `AI_INTEGRATIONS_ANTHROPIC_API_KEY` | From https://console.anthropic.com/settings/keys |
| `AI_INTEGRATIONS_ANTHROPIC_BASE_URL` | `https://api.anthropic.com` |
| `AI_REPLY_MODE_DMS` | `suggest` (safe default — admin reviews before sending) |
| `AI_REPLY_MODE_COMMENTS` | `suggest` |

### FOR VOICE CALLS (Yara call widget)
| Variable | Value |
|---|---|
| `ELEVENLABS_API_KEY` | From https://elevenlabs.io → Profile → API Keys |
| `ELEVENLABS_AGENT_ID` | From ElevenLabs → Conversational AI → Your agent |

### FOR META / INSTAGRAM / FACEBOOK (social inbox)
| Variable | Value |
|---|---|
| `META_PAGE_ID` | Your Facebook Page numeric ID |
| `META_PAGE_ACCESS_TOKEN` | Long-lived page access token from Meta developer console |
| `META_APP_ID` | Your Meta App ID |
| `META_APP_SECRET` | Your Meta App Secret |
| `META_INSTAGRAM_BUSINESS_ACCOUNT_ID` | IG business account ID linked to your page |
| `META_WEBHOOK_VERIFY_TOKEN` | Any string you choose — same as in Meta webhook settings |

### FOR WHATSAPP AUTOMATIONS (reminders, follow-ups)
| Variable | Value |
|---|---|
| `TWILIO_ACCOUNT_SID` | From https://console.twilio.com |
| `TWILIO_AUTH_TOKEN` | From Twilio console |
| `TWILIO_PHONE_NUMBER` | Your Twilio WhatsApp number, e.g. `whatsapp:+14155238886` |

---

## Deployment Architecture

```
transform-egypt.com     → Vercel (static frontend)
api.transform-egypt.com → Railway (Node.js Express API)
```

- **Frontend** (Vercel): connect `geminigems030-boop/transform-egypt-full`, root dir = `artifacts/transform-egypt`
- **Backend** (Railway): connect `geminigems030-boop/transform-egypt-full`, root dir = `artifacts/api-server`
  - Or configure `nixpacks.toml` at repo root (already fixed to point to `api-server`)

## Database Setup (first time)
```bash
export DATABASE_URL="your_supabase_connection_string"
pnpm --filter @workspace/db run drizzle-kit push
```

## Domain (Cloudflare)
- `transform-egypt.com` → CNAME to Vercel deployment URL
- `api.transform-egypt.com` → CNAME/A to Railway service URL

---

## Fixes Applied ($(date +%Y-%m-%d))

| Fix | File | Status |
|---|---|---|
| Restored Gemini AI in chat route | `artifacts/api-server/src/routes/chat.ts` | ✅ Done |
| Added API proxy rewrites | `artifacts/transform-egypt/vercel.json` | ✅ Done |
| Fixed nixpacks.toml start command | `nixpacks.toml` | ✅ Done |
| Added .env.example with all variables | `artifacts/api-server/.env.example` | ✅ Done |

## Remaining (requires Railway dashboard)
- [ ] Set `GEMINI_API_KEY` in Railway → **fixes chat widget**
- [ ] Set `ADMIN_TOKEN` in Railway → **enables admin panel**
- [ ] Set `AI_INTEGRATIONS_ANTHROPIC_API_KEY` + `AI_INTEGRATIONS_ANTHROPIC_BASE_URL` → **enables AI inbox drafts**
- [ ] Set WhatsApp/Twilio vars → **enables automation messages**

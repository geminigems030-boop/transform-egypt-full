import app from "./app";
import { logger } from "./lib/logger";
import { ensureWebhookSubscriptions } from "./lib/meta-graph";
import { seedProductsIfEmpty } from "./lib/seed-products";
import { startIgPoller } from "./lib/ig-poller";
import { startAutomationScheduler } from "./lib/automation-scheduler";
import { refreshModesFromDb } from "./lib/social-settings";
import { ensureOffersTable } from "./lib/offers";
import { syncYaraPrompt } from "./routes/yara-call";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

app.listen(port, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");
  // Best-effort: subscribe our Meta Page to webhook fields. Failures are
  // logged inside the helper and don't crash the server.
  void ensureWebhookSubscriptions();
  // Idempotent: seed the canonical product catalog into the database if the
  // products table is empty (typical for a freshly-deployed production DB
  // where Replit's publish flow migrates SCHEMA but not DATA).
  void seedProductsIfEmpty();
  // Instagram DM poller — bridges the gap until Meta App Review grants
  // Advanced Access for instagram_manage_messaging (webhook delivery).
  // Polls Graph API every 2 min; backs off to 10 min once webhooks work.
  startIgPoller();
  // WhatsApp automation scheduler — reminders, follow-ups, re-engagement.
  startAutomationScheduler();
  // Ensure the social_settings table exists and load the persisted IG/FB/TikTok
  // auto-reply modes into the in-memory cache. Non-fatal — falls back to the
  // AI_REPLY_MODE_* env defaults if the DB is unreachable.
  void refreshModesFromDb();
  // Ensure the offers table exists so the dynamic promotions engine works
  // (public /api/offers + Yara injection). Idempotent, non-fatal.
  void ensureOffersTable().catch(() => undefined);
  // Sync Yara's ElevenLabs system prompt with YARA_SYSTEM_PROMPT on every start.
  // Non-fatal — server continues even if ElevenLabs is unreachable.
  void syncYaraPrompt();
});

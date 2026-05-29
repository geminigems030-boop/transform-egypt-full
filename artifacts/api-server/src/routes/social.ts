// ─────────────────────────────────────────────────────────────────────────────
// Social AI Automation API — controls for the Instagram / Facebook / TikTok
// auto-reply agent (Yara) that runs on inbound DMs and post comments.
//
//   GET  /api/admin/social/settings   — current modes + platform connection status
//   PUT  /api/admin/social/settings   — set the DMs and/or Comments reply mode
//
// Reply modes (per channel): off | suggest | auto
//   off      — Yara does nothing
//   suggest  — Yara drafts a reply for the admin to approve in the inbox
//   auto     — Yara sends the reply immediately (escalations always demote to suggest)
// ─────────────────────────────────────────────────────────────────────────────

import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import { logger } from "../lib/logger";
import { getMode, parseMode, type AIMode } from "../lib/ai-reply";
import { getOrCreateSocialSettings, setMode } from "../lib/social-settings";

const router: IRouter = Router();

function adminAuth(req: Request, res: Response, next: NextFunction) {
  const expected = process.env["ADMIN_TOKEN"];
  if (!expected || expected.length < 8) {
    return res.status(503).json({ error: "Admin disabled. Set ADMIN_TOKEN secret (min 8 chars)." });
  }
  const provided =
    (typeof req.headers["x-admin-token"] === "string" ? req.headers["x-admin-token"] : "") ||
    (typeof req.headers.authorization === "string"
      ? req.headers.authorization.replace(/^Bearer\s+/i, "")
      : "");
  if (provided !== expected) return res.status(401).json({ error: "Unauthorized" });
  return next();
}

// Connection status of each integration that powers the social AI workflow.
// Pure env-presence checks — cheap, no network calls. Tells the admin at a
// glance which platforms can actually send/receive.
function platformStatus() {
  const manychatConfigured = Boolean(
    process.env["MANYCHAT_WEBHOOK_SECRET"] && process.env["MANYCHAT_API_TOKEN"],
  );
  const metaConfigured = Boolean(
    process.env["META_PAGE_ID"] && process.env["META_PAGE_ACCESS_TOKEN"],
  );
  const geminiConfigured = Boolean(process.env["GEMINI_API_KEY"]);
  const anthropicConfigured = Boolean(
    process.env["AI_INTEGRATIONS_ANTHROPIC_BASE_URL"] &&
      process.env["AI_INTEGRATIONS_ANTHROPIC_API_KEY"],
  );
  return {
    // ManyChat is the Meta-approved surface that delivers IG/FB (and TikTok) DMs.
    manychat: manychatConfigured,
    // Meta Graph powers the webhook + comment replies + Instagram feed.
    meta: metaConfigured,
    // Gemini transcribes voice notes inside the ManyChat bridge.
    gemini: geminiConfigured,
    // Anthropic (Claude) generates the actual reply drafts.
    anthropic: anthropicConfigured,
  };
}

// ── GET /api/admin/social/settings ────────────────────────────────────────────

router.get("/admin/social/settings", adminAuth, async (_req, res) => {
  try {
    // Ensure the row exists (and is reflected in the cache) so the panel shows
    // the persisted value rather than only the env-seeded default.
    await getOrCreateSocialSettings();
    return res.json({
      settings: {
        modeDms: getMode("dms"),
        modeComments: getMode("comments"),
      },
      platforms: platformStatus(),
    });
  } catch (err) {
    logger.error({ err }, "social settings GET error");
    return res.status(500).json({ error: "Failed to load social settings" });
  }
});

// ── PUT /api/admin/social/settings ─────────────────────────────────────────────
// Body accepts either { channel, mode } or { modeDms, modeComments }.

router.put("/admin/social/settings", adminAuth, async (req, res) => {
  const b = req.body as Record<string, unknown>;
  const valid: AIMode[] = ["off", "suggest", "auto"];

  try {
    const applied: Array<{ channel: "dms" | "comments"; mode: AIMode }> = [];

    // Form 1: explicit { channel, mode }
    if (typeof b.channel === "string" && typeof b.mode === "string") {
      const channel = b.channel === "comments" ? "comments" : b.channel === "dms" ? "dms" : null;
      const mode = parseMode(b.mode);
      if (!channel) return res.status(400).json({ error: "channel must be 'dms' or 'comments'" });
      if (!valid.includes(b.mode.toLowerCase() as AIMode)) {
        return res.status(400).json({ error: `mode must be one of: ${valid.join(", ")}` });
      }
      await setMode(channel, mode);
      applied.push({ channel, mode });
    }

    // Form 2: bulk { modeDms, modeComments }
    if (typeof b.modeDms === "string") {
      if (!valid.includes(b.modeDms.toLowerCase() as AIMode)) {
        return res.status(400).json({ error: `modeDms must be one of: ${valid.join(", ")}` });
      }
      const mode = parseMode(b.modeDms);
      await setMode("dms", mode);
      applied.push({ channel: "dms", mode });
    }
    if (typeof b.modeComments === "string") {
      if (!valid.includes(b.modeComments.toLowerCase() as AIMode)) {
        return res.status(400).json({ error: `modeComments must be one of: ${valid.join(", ")}` });
      }
      const mode = parseMode(b.modeComments);
      await setMode("comments", mode);
      applied.push({ channel: "comments", mode });
    }

    if (applied.length === 0) {
      return res.status(400).json({ error: "Provide { channel, mode } or { modeDms / modeComments }" });
    }

    logger.info({ applied }, "social: reply modes updated");
    return res.json({
      ok: true,
      settings: { modeDms: getMode("dms"), modeComments: getMode("comments") },
      platforms: platformStatus(),
    });
  } catch (err) {
    logger.error({ err }, "social settings PUT error");
    return res.status(500).json({ error: "Failed to update social settings" });
  }
});

export default router;

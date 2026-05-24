import {
  Router,
  type IRouter,
  type Request,
  type Response,
  type NextFunction,
} from "express";
import { eq, desc, and, or, gt, isNull, lt, sql } from "drizzle-orm";
import { db } from "@workspace/db";
import {
  instagramMessagesTable,
  instagramCommentsTable,
  bookingsTable,
  appointmentsTable,
  submissionsTable,
} from "@workspace/db/schema";
import {
  metaPost,
  META_PAGE_ID,
  META_IG_BIZ_ID,
  META_WEBHOOK_VERIFY_TOKEN,
  getInstagramSubscribedFields,
} from "../lib/meta-graph";
import { logger } from "../lib/logger";
import { generateReply, getMode, detectLanguage } from "../lib/ai-reply";
import {
  findRelevantExemplars,
  getExemplarsCount,
  backfillExemplarsFromMeta,
} from "../lib/exemplars";
import { captureLeadFromThread } from "./webhooks";
import {
  sendAppointmentReminder,
  sendFollowupEmail,
} from "../lib/email";

const router: IRouter = Router();

// Same admin-token gate used by lucky.ts / submissions.ts admin routes.
function adminAuth(req: Request, res: Response, next: NextFunction) {
  const expected = process.env["ADMIN_TOKEN"];
  if (!expected || expected.length < 8) {
    return res.status(503).json({ error: "Admin disabled" });
  }
  const provided =
    (typeof req.headers["x-admin-token"] === "string"
      ? req.headers["x-admin-token"]
      : "") ||
    (typeof req.headers.authorization === "string"
      ? req.headers.authorization.replace(/^Bearer\s+/i, "")
      : "");
  if (provided !== expected) {
    return res.status(401).json({ error: "Invalid admin token" });
  }
  return next();
}

// ── DM threads ──────────────────────────────────────────────────────────────

// Sidebar list: latest message per thread + unread count + AI draft state.
router.get("/admin/inbox/threads", adminAuth, async (_req, res) => {
  try {
    // `latest` = newest message in each thread (used for preview text/timestamp).
    // `customer` = newest INBOUND message in each thread, so the thread title
    // can show the actual customer's username/IGSID instead of our Page name
    // (which would be the latest sender whenever Yara has just replied).
    const result = await db.execute(sql`
      WITH latest AS (
        SELECT DISTINCT ON (thread_id)
          id AS latest_id,
          thread_id, thread_platform, sender_id, sender_username,
          text, attachment_type, direction, received_at,
          ai_draft, ai_draft_status, ai_generated_at, ai_escalated
        FROM instagram_messages
        ORDER BY thread_id, received_at DESC
      ),
      customer AS (
        SELECT DISTINCT ON (thread_id)
          thread_id,
          sender_id   AS customer_id,
          sender_username AS customer_username
        FROM instagram_messages
        WHERE direction = 'inbound'
        ORDER BY thread_id, received_at DESC
      ),
      unread AS (
        SELECT thread_id, COUNT(*)::int AS unread
        FROM instagram_messages
        WHERE direction = 'inbound' AND is_read = false
        GROUP BY thread_id
      )
      SELECT l.*,
             COALESCE(c.customer_id, l.thread_id)         AS customer_id,
             COALESCE(c.customer_username, '')            AS customer_username,
             COALESCE(u.unread, 0)                        AS unread_count
      FROM latest l
      LEFT JOIN customer c USING (thread_id)
      LEFT JOIN unread   u USING (thread_id)
      ORDER BY l.received_at DESC
      LIMIT 200
    `);
    return res.json({ threads: result.rows });
  } catch (err) {
    logger.error({ err: (err as Error).message }, "inbox/threads failed");
    return res.status(500).json({ error: "Internal" });
  }
});

router.get("/admin/inbox/threads/:threadId", adminAuth, async (req, res) => {
  // Explicit String() coerces Express's `string | string[]` param type to string.
  const threadId = String(req.params["threadId"] ?? "");
  if (!threadId) return res.status(400).json({ error: "Missing threadId" });
  try {
    const messages = await db
      .select()
      .from(instagramMessagesTable)
      .where(eq(instagramMessagesTable.threadId, threadId))
      .orderBy(instagramMessagesTable.receivedAt);
    // Mark inbound messages in this thread as read.
    await db
      .update(instagramMessagesTable)
      .set({ isRead: true })
      .where(
        and(
          eq(instagramMessagesTable.threadId, threadId),
          eq(instagramMessagesTable.isRead, false),
          eq(instagramMessagesTable.direction, "inbound"),
        ),
      );
    return res.json({ messages });
  } catch (err) {
    logger.error({ err: (err as Error).message }, "inbox/thread fetch failed");
    return res.status(500).json({ error: "Internal" });
  }
});

router.post(
  "/admin/inbox/threads/:threadId/reply",
  adminAuth,
  async (req, res) => {
    // Explicit String() coerces Express's `string | string[]` param type to string.
    const threadId = String(req.params["threadId"] ?? "");
    const { text } = (req.body || {}) as { text?: string };
    if (!threadId || !text || typeof text !== "string" || text.length === 0) {
      return res.status(400).json({ error: "Missing text" });
    }
    if (text.length > 1000) {
      return res.status(400).json({ error: "Text too long (max 1000)" });
    }
    try {
      const platform = await getThreadPlatform(threadId);
      const outId = await sendDm(threadId, text);
      await db.insert(instagramMessagesTable).values({
        metaMessageId: outId,
        threadId,
        threadPlatform: platform,
        senderId: META_PAGE_ID,
        senderUsername: "TransforM Egypt",
        direction: "outbound",
        text,
        isRead: true,
        repliedAt: new Date(),
      });
      return res.json({ ok: true, messageId: outId });
    } catch (err) {
      const msg = (err as Error).message;
      logger.error({ err: msg, threadId }, "inbox reply failed");
      return res.status(502).json({ error: msg || "Send failed" });
    }
  },
);

// Manual lead capture: operator clicks "Capture as Lead" on an IG/FB DM thread.
// Creates a Submission row from the conversation. Phone/branch/service are
// optional and may be filled in later from the Submissions tab. Idempotent
// per thread per 24h via captureLeadFromThread; if a row already exists,
// optionally PATCH it with operator-supplied phone/branch/service.
router.post(
  "/admin/inbox/threads/:threadId/capture-lead",
  adminAuth,
  async (req, res) => {
    const threadId = String(req.params["threadId"] ?? "");
    if (!threadId) return res.status(400).json({ error: "Missing threadId" });
    // Note: loggedBy is intentionally NOT read from the request body — it's
    // hardcoded to "operator" in captureLeadFromThread below. This prevents a
    // caller (even an authenticated admin) from spoofing the audit trail to
    // look like the AI captured the lead.
    const body = (req.body || {}) as {
      phone?: string;
      name?: string;
      branch?: string;
      service?: string;
    };
    try {
      const platform = (await getThreadPlatform(threadId)) as
        | "instagram"
        | "facebook";
      // Look up the latest known username for this thread.
      const latest = await db
        .select({ username: instagramMessagesTable.senderUsername })
        .from(instagramMessagesTable)
        .where(
          and(
            eq(instagramMessagesTable.threadId, threadId),
            eq(instagramMessagesTable.direction, "inbound"),
          ),
        )
        .orderBy(desc(instagramMessagesTable.receivedAt))
        .limit(1);
      const username = body.name?.trim() || latest[0]?.username || null;

      const result = await captureLeadFromThread({
        threadId,
        platform,
        username,
        trigger: "manual",
        loggedBy: "operator",
      });

      // If operator supplied phone/branch/service (or a fresh dedup hit
      // returned an existing row id), patch the row with those fields so
      // the operator's data isn't lost.
      const id = result.id;
      const patch: Record<string, string | null> = {};
      if (body.phone?.trim()) patch["phone"] = body.phone.trim();
      if (body.branch?.trim()) patch["branch"] = body.branch.trim();
      if (body.service?.trim()) patch["service"] = body.service.trim();
      if (body.name?.trim()) patch["name"] = body.name.trim();
      if (id && Object.keys(patch).length > 0) {
        await db
          .update(submissionsTable)
          .set(patch)
          .where(eq(submissionsTable.id, id));
      }

      return res.json({
        ok: true,
        id,
        created: result.created,
        message: result.created
          ? "Lead captured."
          : "Already captured for this thread in the last 24h (existing row updated if you provided new info).",
      });
    } catch (err) {
      const msg = (err as Error).message;
      logger.error({ err: msg, threadId }, "inbox capture-lead failed");
      return res.status(500).json({ error: msg || "Capture failed" });
    }
  },
);

// ── Replymind: AI draft actions on DM messages ─────────────────────────────

// Approve & send the stored AI draft (or a body-supplied edited version).
router.post(
  "/admin/inbox/messages/:id/ai-approve",
  adminAuth,
  async (req, res) => {
    const id = Number(req.params["id"]);
    if (!Number.isFinite(id)) return res.status(400).json({ error: "Invalid id" });
    const bodyText = ((req.body || {}) as { text?: string }).text;
    try {
      const row = await db
        .select()
        .from(instagramMessagesTable)
        .where(eq(instagramMessagesTable.id, id))
        .limit(1);
      if (!row[0]) return res.status(404).json({ error: "Not found" });
      // Architect P1 — guard against double-send: only inbound rows whose
      // draft is still 'pending' may be approved. If the draft was already
      // auto-sent by the agent, dismissed, or manually sent, refuse so a
      // race between webhook auto-mode and admin click can't fire twice.
      if (row[0].direction !== "inbound") {
        return res.status(400).json({ error: "Only inbound drafts can be approved" });
      }
      if (row[0].aiDraftStatus !== "pending") {
        return res.status(409).json({
          error: `Draft is ${row[0].aiDraftStatus ?? "missing"} — cannot approve`,
          status: row[0].aiDraftStatus,
        });
      }
      const text = (typeof bodyText === "string" && bodyText.trim().length > 0
        ? bodyText
        : row[0].aiDraft || ""
      ).trim();
      if (!text) return res.status(400).json({ error: "No draft to send" });
      if (text.length > 1000) return res.status(400).json({ error: "Too long" });

      const threadId = row[0].threadId;
      const platform = row[0].threadPlatform;
      const outId = await sendDm(threadId, text);
      await Promise.all([
        db.insert(instagramMessagesTable).values({
          metaMessageId: outId,
          threadId,
          threadPlatform: platform,
          senderId: META_PAGE_ID,
          senderUsername: "TransforM Egypt",
          direction: "outbound",
          text,
          isRead: true,
          repliedAt: new Date(),
        }),
        db
          .update(instagramMessagesTable)
          .set({ aiDraft: text, aiDraftStatus: "sent" })
          .where(eq(instagramMessagesTable.id, id)),
      ]);
      return res.json({ ok: true, messageId: outId });
    } catch (err) {
      const msg = (err as Error).message;
      logger.error({ err: msg, id }, "ai-approve DM failed");
      return res.status(502).json({ error: msg || "Send failed" });
    }
  },
);

// Regenerate the AI draft for an inbound DM (uses thread history for context).
router.post(
  "/admin/inbox/messages/:id/ai-regenerate",
  adminAuth,
  async (req, res) => {
    const id = Number(req.params["id"]);
    if (!Number.isFinite(id)) return res.status(400).json({ error: "Invalid id" });
    try {
      const row = await db
        .select()
        .from(instagramMessagesTable)
        .where(eq(instagramMessagesTable.id, id))
        .limit(1);
      if (!row[0]) return res.status(404).json({ error: "Not found" });
      if (row[0].direction !== "inbound") {
        return res.status(400).json({ error: "Only inbound messages have drafts" });
      }
      const inboundText = row[0].text || "";
      if (!inboundText) return res.status(400).json({ error: "No text to reply to" });

      const history = await loadThreadHistory(row[0].threadId, 6);
      const language = detectLanguage(inboundText);
      const exemplars = await findRelevantExemplars({
        inboundText,
        channel: "dm",
        language,
        limit: 5,
      });
      const { draft, escalated } = await generateReply({
        inboundText,
        channel: "dm",
        language,
        conversationHistory: history,
        exemplars,
      });
      await db
        .update(instagramMessagesTable)
        .set({
          aiDraft: draft,
          aiDraftStatus: "pending",
          aiGeneratedAt: new Date(),
          aiEscalated: escalated,
        })
        .where(eq(instagramMessagesTable.id, id));
      return res.json({ ok: true, draft, escalated });
    } catch (err) {
      const msg = (err as Error).message;
      logger.error({ err: msg, id }, "ai-regenerate DM failed");
      return res.status(500).json({ error: msg || "Generation failed" });
    }
  },
);

// Dismiss a draft (admin will reply manually).
router.post(
  "/admin/inbox/messages/:id/ai-dismiss",
  adminAuth,
  async (req, res) => {
    const id = Number(req.params["id"]);
    if (!Number.isFinite(id)) return res.status(400).json({ error: "Invalid id" });
    try {
      await db
        .update(instagramMessagesTable)
        .set({ aiDraftStatus: "dismissed" })
        .where(eq(instagramMessagesTable.id, id));
      return res.json({ ok: true });
    } catch (err) {
      logger.error({ err: (err as Error).message, id }, "ai-dismiss DM failed");
      return res.status(500).json({ error: "Internal" });
    }
  },
);

// ── Comments ────────────────────────────────────────────────────────────────

router.get("/admin/inbox/comments", adminAuth, async (req, res) => {
  try {
    const onlyUnread = req.query["unread"] === "1";
    const rows = await db
      .select()
      .from(instagramCommentsTable)
      .where(onlyUnread ? eq(instagramCommentsTable.isRead, false) : sql`true`)
      .orderBy(desc(instagramCommentsTable.receivedAt))
      .limit(200);
    return res.json({ comments: rows });
  } catch (err) {
    logger.error({ err: (err as Error).message }, "inbox/comments failed");
    return res.status(500).json({ error: "Internal" });
  }
});

router.post(
  "/admin/inbox/comments/:id/reply",
  adminAuth,
  async (req, res) => {
    const id = Number(req.params["id"]);
    const { text } = (req.body || {}) as { text?: string };
    if (!Number.isFinite(id) || !text || typeof text !== "string") {
      return res.status(400).json({ error: "Invalid input" });
    }
    if (text.length > 1000) {
      return res.status(400).json({ error: "Text too long (max 1000)" });
    }
    try {
      const cmt = await db
        .select()
        .from(instagramCommentsTable)
        .where(eq(instagramCommentsTable.id, id))
        .limit(1);
      if (!cmt[0]) return res.status(404).json({ error: "Not found" });
      await sendCommentReply(cmt[0].metaCommentId, text);
      await db
        .update(instagramCommentsTable)
        .set({ repliedAt: new Date(), isRead: true })
        .where(eq(instagramCommentsTable.id, id));
      return res.json({ ok: true });
    } catch (err) {
      const msg = (err as Error).message;
      logger.error({ err: msg, id }, "comment reply failed");
      return res.status(502).json({ error: msg || "Send failed" });
    }
  },
);

router.post("/admin/inbox/comments/:id/read", adminAuth, async (req, res) => {
  const id = Number(req.params["id"]);
  if (!Number.isFinite(id)) return res.status(400).json({ error: "Invalid id" });
  try {
    await db
      .update(instagramCommentsTable)
      .set({ isRead: true })
      .where(eq(instagramCommentsTable.id, id));
    return res.json({ ok: true });
  } catch (err) {
    logger.error({ err: (err as Error).message, id }, "comment read failed");
    return res.status(500).json({ error: "Internal" });
  }
});

// ── Replymind: AI draft actions on comments ────────────────────────────────

router.post(
  "/admin/inbox/comments/:id/ai-approve",
  adminAuth,
  async (req, res) => {
    const id = Number(req.params["id"]);
    if (!Number.isFinite(id)) return res.status(400).json({ error: "Invalid id" });
    const bodyText = ((req.body || {}) as { text?: string }).text;
    try {
      const cmt = await db
        .select()
        .from(instagramCommentsTable)
        .where(eq(instagramCommentsTable.id, id))
        .limit(1);
      if (!cmt[0]) return res.status(404).json({ error: "Not found" });
      // Architect P1 — same guard as DM approve. A comment whose draft was
      // already auto-sent (auto_sent), manually sent (sent), or dismissed
      // must not be re-sent by an admin clicking Approve in a stale UI.
      if (cmt[0].aiDraftStatus !== "pending") {
        return res.status(409).json({
          error: `Draft is ${cmt[0].aiDraftStatus ?? "missing"} — cannot approve`,
          status: cmt[0].aiDraftStatus,
        });
      }
      const text = (typeof bodyText === "string" && bodyText.trim().length > 0
        ? bodyText
        : cmt[0].aiDraft || ""
      ).trim();
      if (!text) return res.status(400).json({ error: "No draft to send" });
      if (text.length > 1000) return res.status(400).json({ error: "Too long" });

      await sendCommentReply(cmt[0].metaCommentId, text);
      await db
        .update(instagramCommentsTable)
        .set({
          aiDraft: text,
          aiDraftStatus: "sent",
          repliedAt: new Date(),
          isRead: true,
        })
        .where(eq(instagramCommentsTable.id, id));
      return res.json({ ok: true });
    } catch (err) {
      const msg = (err as Error).message;
      logger.error({ err: msg, id }, "ai-approve comment failed");
      return res.status(502).json({ error: msg || "Send failed" });
    }
  },
);

router.post(
  "/admin/inbox/comments/:id/ai-regenerate",
  adminAuth,
  async (req, res) => {
    const id = Number(req.params["id"]);
    if (!Number.isFinite(id)) return res.status(400).json({ error: "Invalid id" });
    try {
      const cmt = await db
        .select()
        .from(instagramCommentsTable)
        .where(eq(instagramCommentsTable.id, id))
        .limit(1);
      if (!cmt[0]) return res.status(404).json({ error: "Not found" });
      const language = detectLanguage(cmt[0].text);
      const exemplars = await findRelevantExemplars({
        inboundText: cmt[0].text,
        channel: "comment",
        language,
        limit: 5,
      });
      const { draft, escalated } = await generateReply({
        inboundText: cmt[0].text,
        channel: "comment",
        language,
        exemplars,
      });
      await db
        .update(instagramCommentsTable)
        .set({
          aiDraft: draft,
          aiDraftStatus: "pending",
          aiGeneratedAt: new Date(),
          aiEscalated: escalated,
        })
        .where(eq(instagramCommentsTable.id, id));
      return res.json({ ok: true, draft, escalated });
    } catch (err) {
      const msg = (err as Error).message;
      logger.error({ err: msg, id }, "ai-regenerate comment failed");
      return res.status(500).json({ error: msg || "Generation failed" });
    }
  },
);

router.post(
  "/admin/inbox/comments/:id/ai-dismiss",
  adminAuth,
  async (req, res) => {
    const id = Number(req.params["id"]);
    if (!Number.isFinite(id)) return res.status(400).json({ error: "Invalid id" });
    try {
      await db
        .update(instagramCommentsTable)
        .set({ aiDraftStatus: "dismissed" })
        .where(eq(instagramCommentsTable.id, id));
      return res.json({ ok: true });
    } catch (err) {
      logger.error({ err: (err as Error).message, id }, "ai-dismiss comment failed");
      return res.status(500).json({ error: "Internal" });
    }
  },
);

// ── Setup info — exposes the webhook URL + verify token + AI mode for the
// admin Setup tab. ─────────────────────────────────────────────────────────
router.get("/admin/inbox/setup-info", adminAuth, async (_req, res) => {
  // Prefer stable production domain; fall back to dev tunnel domain.
  // REPLIT_DEPLOYMENT_DOMAIN is not injected by Replit at runtime, so we
  // use a hardcoded production hostname as the canonical fallback.
  const host =
    process.env["REPLIT_DEPLOYMENT_DOMAIN"] ||
    (process.env["NODE_ENV"] === "production"
      ? "transform-egypt.com"
      : process.env["REPLIT_DEV_DOMAIN"]) ||
    "transform-egypt.com";
  // Live-check whether the IG account is actually subscribed to webhooks.
  // null = couldn't reach Meta or not configured; [] = call succeeded but
  // no subscription; non-empty = subscribed.
  const igSubscribedFields = await getInstagramSubscribedFields();
  return res.json({
    webhookCallbackUrl: `https://${host}/api/webhooks/meta`,
    verifyToken: META_WEBHOOK_VERIFY_TOKEN,
    pageId: META_PAGE_ID,
    instagramBusinessAccountId: META_IG_BIZ_ID,
    subscribedFields: [
      "messages",
      "messaging_postbacks",
      "conversations",
      "messaging_referrals",
      "feed",
      "leadgen",
    ],
    instagram: {
      // True iff Meta confirms the IG account is subscribed to "messages".
      // If false, IG DMs will NOT reach our webhook even though Messenger ones do.
      messagesSubscribed: Array.isArray(igSubscribedFields)
        ? igSubscribedFields.includes("messages")
        : null,
      subscribedFields: igSubscribedFields,
    },
    ai: {
      enabled: Boolean(
        process.env["AI_INTEGRATIONS_ANTHROPIC_BASE_URL"] &&
          process.env["AI_INTEGRATIONS_ANTHROPIC_API_KEY"],
      ),
      model: "claude-sonnet-4-6",
      modeDms: getMode("dms"),
      modeComments: getMode("comments"),
      exemplarsCount: await getExemplarsCount(),
    },
  });
});

// ── Memory mode — backfill exemplars from Meta Graph history. One-shot
// admin action; pulls last `sinceDays` days of DM history on Instagram and
// Facebook, pairs each customer message with our team's reply, drops
// templated replies (same outbound text 3+ times), and stores into
// inbox_exemplars. Idempotent — re-running just adds new pairs.
router.post(
  "/admin/inbox/backfill-exemplars",
  adminAuth,
  async (req: Request, res: Response) => {
    const sinceDays = Math.min(
      365,
      Math.max(7, Number(req.body?.sinceDays) || 90),
    );
    try {
      const result = await backfillExemplarsFromMeta({ sinceDays });
      const totalAfter = await getExemplarsCount();
      // If we got zero new pairs AND every page errored, surface as a hard
      // failure so the admin UI shows red (otherwise we'd silently report
      // "ok" while Meta auth or rate-limit issues block all data).
      if (result.inserted === 0 && result.errors.length > 0) {
        logger.error(
          { errors: result.errors, sinceDays },
          "exemplars: backfill produced no rows (all errors)",
        );
        return res.status(502).json({
          ok: false,
          totalAfter,
          ...result,
          error: result.errors[0] || "Backfill failed for all pages",
        });
      }
      return res.json({ ok: true, totalAfter, ...result });
    } catch (err) {
      const msg = (err as Error).message;
      logger.error({ err: msg, sinceDays }, "exemplars: backfill failed");
      return res.status(500).json({ error: msg || "Backfill failed" });
    }
  },
);

// ── Appointment Reminder Drip ────────────────────────────────────────────────
// Scans the bookings table for appointments in the next 24-26 hours that
// have not yet had a reminder email sent, sends a branded reminder, and
// marks reminderSentAt so the same booking never gets double-emailed.
router.post("/admin/reminders/appointments", adminAuth, async (req: Request, res: Response) => {
  try {
    const now = new Date();
    // Window: 24 h from now ± 1 h to catch bookings within the next day.
    const windowStart = new Date(now.getTime() + 23 * 3_600_000); // +23 h
    const windowEnd = new Date(now.getTime() + 26 * 3_600_000);   // +26 h

    // bookings.date is stored as "YYYY-MM-DD" text (website form).
    // Compare string-lexicographically against ISO date strings — works for ISO format.
    const startDateStr = windowStart.toISOString().slice(0, 10); // "2025-05-15"
    const endDateStr = windowEnd.toISOString().slice(0, 10);

    const pending = await db
      .select()
      .from(bookingsTable)
      .where(
        and(
          isNull(bookingsTable.reminderSentAt),
          sql`${bookingsTable.date} >= ${startDateStr}`,
          sql`${bookingsTable.date} <= ${endDateStr}`,
          sql`${bookingsTable.status} != 'cancelled'`,
        ),
      )
      .limit(50);

    let sent = 0;
    const results: { id: number; name: string; status: string; error?: string }[] = [];

    for (const booking of pending) {
      if (!booking.email) {
        results.push({ id: booking.id, name: booking.name, status: "skipped_no_email" });
        continue;
      }
      try {
        await sendAppointmentReminder({
          customerEmail: booking.email,
          customerName: booking.name,
          service: booking.service,
          date: booking.date,
          branch: null,
        });
        await db
          .update(bookingsTable)
          .set({ reminderSentAt: new Date() })
          .where(eq(bookingsTable.id, booking.id));
        sent++;
        results.push({ id: booking.id, name: booking.name, status: "sent" });
      } catch (err) {
        results.push({ id: booking.id, name: booking.name, status: "failed", error: (err as Error).message });
      }
    }

    return res.json({ ok: true, sent, total: pending.length, results });
  } catch (err) {
    return res.status(500).json({ error: (err as Error).message });
  }
});

// ── Post-Booking Satisfaction Follow-up ──────────────────────────────────────
// Finds submissions marked "booked" 3–4 days ago without a follow-up, then
// sends a satisfaction check-in + review ask via DM (if threadId known) or
// email (if email available). Marks followupSentAt to prevent duplicates.
router.post("/admin/reminders/followup", adminAuth, async (req: Request, res: Response) => {
  try {
    const threeDaysAgo = new Date(Date.now() - 3 * 86_400_000);
    const fourDaysAgo = new Date(Date.now() - 4 * 86_400_000);

    const bookedSubs = await db
      .select()
      .from(submissionsTable)
      .where(
        and(
          eq(submissionsTable.status, "booked"),
          isNull(submissionsTable.followupSentAt),
          lt(submissionsTable.createdAt, threeDaysAgo),
          gt(submissionsTable.createdAt, fourDaysAgo),
        ),
      )
      .limit(30);

    let sent = 0;
    const results: { id: number; name: string | null; method: string; status: string; error?: string }[] = [];

    for (const sub of bookedSubs) {
      let method = "none";
      let ok = false;

      // Try DM first if we have a threadId in the message JSON.
      let threadId: string | null = null;
      if (sub.message) {
        try {
          const parsed = JSON.parse(sub.message) as { threadId?: string };
          threadId = parsed.threadId ?? null;
        } catch { /* plain text message, not JSON */ }
      }

      if (threadId) {
        method = "dm";
        const dmText =
          `أهلاً يا فندم 💛 نورتينا بزيارتك لـ TransforM — إزي تجربتك معانا؟ رأيكِ يهمنا جداً 🌸\n\nلو عايزة تحجزي تاني مرة: https://transform-egypt.com/book`;
        try {
          await metaPost<{ message_id?: string }>(`${META_PAGE_ID}/messages`, {
            recipient: { id: threadId },
            messaging_type: "RESPONSE",
            message: { text: dmText },
          });
          // Record the outbound DM for inbox history.
          await db.insert(instagramMessagesTable).values({
            metaMessageId: `followup_${sub.id}_${Date.now()}`,
            threadId,
            threadPlatform: "instagram",
            senderId: META_PAGE_ID || "page",
            senderUsername: "TransforM",
            direction: "outbound",
            text: dmText,
            isRead: true,
            aiDraftStatus: "auto_sent",
          }).onConflictDoNothing();
          ok = true;
        } catch (err) {
          method = "dm_failed";
          logger.warn({ err: (err as Error).message, subId: sub.id }, "followup DM failed");
        }
      }

      // Fallback: email if DM not available or failed.
      if (!ok && sub.email && sub.name) {
        method = "email";
        ok = await sendFollowupEmail({ customerEmail: sub.email, customerName: sub.name });
      }

      if (ok) {
        await db
          .update(submissionsTable)
          .set({ followupSentAt: new Date() })
          .where(eq(submissionsTable.id, sub.id));
        sent++;
      }

      results.push({ id: sub.id, name: sub.name, method, status: ok ? "sent" : "skipped" });
    }

    return res.json({ ok: true, sent, total: bookedSubs.length, results });
  } catch (err) {
    return res.status(500).json({ error: (err as Error).message });
  }
});

// ── Lead Re-engagement ───────────────────────────────────────────────────────
// Finds threads that had booking intent but went cold (no activity for
// minIdleHours), then sends a warm follow-up via Meta Graph DM.
// Capped at 20 threads per call to stay well within Meta rate limits.
router.post("/admin/inbox/reactivate", adminAuth, async (req: Request, res: Response) => {
  try {
    const daysBack = Math.min(90, Math.max(1, Number(req.body?.daysBack ?? 30)));
    const minIdleHours = Math.max(1, Number(req.body?.minIdleHours ?? 48));

    const bookingKeywords = [
      "احجز", "موعد", "بكام", "سعر", "اكستنشن", "إكستنشن", "خصلة",
      "تيب", "كليب", "باروكة", "بشرة", "مايكرو", "رموش", "حجز",
      "book", "appointment", "price", "extension", "hair", "keratin",
    ];
    const keywordConditions = bookingKeywords.map(
      (kw) => sql`${instagramMessagesTable.text} ILIKE ${"%" + kw + "%"}`,
    );

    // 1. Threads with at least one booking-intent inbound message in the window.
    const cutoffDate = new Date(Date.now() - daysBack * 86_400_000);
    const intentRows = await db
      .selectDistinct({ threadId: instagramMessagesTable.threadId })
      .from(instagramMessagesTable)
      .where(
        and(
          eq(instagramMessagesTable.direction, "inbound"),
          gt(instagramMessagesTable.receivedAt, cutoffDate),
          or(...keywordConditions),
        ),
      );

    // 2. For each thread, find the last message and check idleness.
    const idleCutoff = new Date(Date.now() - minIdleHours * 3_600_000);
    const results: { threadId: string; username: string | null; status: string; error?: string }[] = [];
    let sent = 0;

    for (const { threadId } of intentRows.slice(0, 40)) {
      // Get most-recent message in thread.
      const [last] = await db
        .select({
          direction: instagramMessagesTable.direction,
          receivedAt: instagramMessagesTable.receivedAt,
          username: instagramMessagesTable.senderUsername,
          metaId: instagramMessagesTable.metaMessageId,
        })
        .from(instagramMessagesTable)
        .where(eq(instagramMessagesTable.threadId, threadId))
        .orderBy(desc(instagramMessagesTable.receivedAt))
        .limit(1);

      if (!last) continue;

      // Skip active threads (recently messaged).
      if (last.receivedAt > idleCutoff) continue;

      // Skip if we already sent a reactivation to this thread recently (< 7 days).
      const recentReactivation = await db
        .select({ id: instagramMessagesTable.id })
        .from(instagramMessagesTable)
        .where(
          and(
            eq(instagramMessagesTable.threadId, threadId),
            eq(instagramMessagesTable.direction, "outbound"),
            sql`${instagramMessagesTable.metaMessageId} LIKE 'reactivate_%'`,
            gt(instagramMessagesTable.receivedAt, new Date(Date.now() - 7 * 86_400_000)),
          ),
        )
        .limit(1);
      if (recentReactivation.length > 0) continue;

      // Reached our send cap?
      if (sent >= 20) break;

      const name = last.username ? `يا ${last.username}` : "يا فندم";
      const msg =
        `أهلاً ${name} 💛 معاكِ يارا من TransforM — مريتِ علينا من فترة وكنا عايزين نطمن عليكِ 🌸\n\n` +
        `لو لسه عندك أي استفسار أو حابة تحجزي، احنا هنا وجاهزين نساعدك!\n\n` +
        `أقدر أفيدك بإيه النهارده؟ ✨\n\nhttps://transform-egypt.com/book`;

      try {
        const outId = await sendDm(threadId, msg);
        await db.insert(instagramMessagesTable).values({
          metaMessageId: `reactivate_${threadId}_${Date.now()}`,
          threadId,
          threadPlatform: "instagram",
          senderId: "page",
          senderUsername: "TransforM",
          direction: "outbound",
          text: msg,
          isRead: true,
          aiDraftStatus: "auto_sent",
        }).onConflictDoNothing();
        logger.info({ threadId, outId }, "reactivation DM sent");
        sent++;
        results.push({ threadId, username: last.username, status: "sent" });
      } catch (err) {
        const msg2 = (err as Error).message;
        logger.warn({ threadId, err: msg2 }, "reactivation DM failed");
        results.push({ threadId, username: last.username, status: "failed", error: msg2 });
      }
    }

    return res.json({ ok: true, sent, total: results.length, results });
  } catch (err) {
    const msg = (err as Error).message;
    logger.error({ err: msg }, "reactivate endpoint failed");
    return res.status(500).json({ error: msg });
  }
});

// ── Helpers ────────────────────────────────────────────────────────────────

async function getThreadPlatform(threadId: string): Promise<string> {
  // Find platform from latest message in thread (defaults to instagram).
  const last = await db
    .select({ platform: instagramMessagesTable.threadPlatform })
    .from(instagramMessagesTable)
    .where(eq(instagramMessagesTable.threadId, threadId))
    .orderBy(desc(instagramMessagesTable.receivedAt))
    .limit(1);
  return typeof last[0]?.platform === "string" ? last[0].platform : "instagram";
}

async function sendDm(threadId: string, text: string): Promise<string> {
  // Both IG and FB Page DMs use POST /{page-id}/messages with the
  // recipient's PSID/IGSID. Meta routes by which surface the user is on.
  const r = await metaPost<{ message_id?: string }>(
    `${META_PAGE_ID}/messages`,
    {
      recipient: { id: threadId },
      messaging_type: "RESPONSE",
      message: { text },
    },
  );
  return (
    r.message_id ||
    `out_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
  );
}

// ── Chat Activity — Yara website chat events (bookings + escalations) ────────
// GET /api/admin/chat-activity
// Returns the 50 most recent Yara-originated appointments and escalation
// submissions so the admin can review what the chat widget has been handling.
router.get("/admin/chat-activity", adminAuth, async (req: Request, res: Response) => {
  try {
    const limit = Math.min(100, Math.max(1, Number(req.query["limit"]) || 50));

    const [appointments, escalations] = await Promise.all([
      db
        .select({
          id: appointmentsTable.id,
          clientName: appointmentsTable.clientName,
          clientPhone: appointmentsTable.clientPhone,
          service: appointmentsTable.service,
          branch: appointmentsTable.branch,
          scheduledAt: appointmentsTable.scheduledAt,
          status: appointmentsTable.status,
          notes: appointmentsTable.notes,
          createdAt: appointmentsTable.createdAt,
        })
        .from(appointmentsTable)
        .where(eq(appointmentsTable.source, "yara"))
        .orderBy(desc(appointmentsTable.createdAt))
        .limit(limit),

      db
        .select({
          id: submissionsTable.id,
          name: submissionsTable.name,
          phone: submissionsTable.phone,
          message: submissionsTable.message,
          status: submissionsTable.status,
          createdAt: submissionsTable.createdAt,
        })
        .from(submissionsTable)
        .where(eq(submissionsTable.source, "yara_chat_escalation"))
        .orderBy(desc(submissionsTable.createdAt))
        .limit(limit),
    ]);

    const apptEvents = appointments.map((a) => {
      // Notes may be JSON (new format with conversation context) or plain text (legacy).
      let customerMessage: string | null = null;
      let yaraReply: string | null = null;
      let plainNotes: string | null = a.notes;
      try {
        const parsed = JSON.parse(a.notes ?? "{}") as {
          info?: string;
          requestedTime?: string;
          customerMessage?: string;
          yaraReply?: string;
        };
        if (parsed.info === "Booked via website chat widget") {
          customerMessage = parsed.customerMessage ?? null;
          yaraReply = parsed.yaraReply ?? null;
          plainNotes = parsed.requestedTime
            ? `Requested time: ${parsed.requestedTime}`
            : null;
        }
      } catch { /* plain text notes — leave as-is */ }
      return {
        type: "booking" as const,
        outcome: "booked" as const,
        id: `appt-${a.id}`,
        dbId: a.id,
        name: a.clientName,
        phone: a.clientPhone,
        service: a.service,
        branch: a.branch,
        scheduledAt: a.scheduledAt,
        status: a.status,
        notes: plainNotes,
        customerMessage,
        yaraReply,
        createdAt: a.createdAt,
      };
    });

    const escalationEvents = escalations.map((s) => {
      let parsed: { customerMessage?: string; yaraReply?: string; reason?: string; sessionId?: string } | null = null;
      try { parsed = JSON.parse(s.message ?? "{}"); } catch { /* ignore */ }
      return {
        type: "escalation" as const,
        outcome: "escalated" as const,
        id: `esc-${s.id}`,
        dbId: s.id,
        name: s.name,
        phone: s.phone,
        customerMessage: parsed?.customerMessage ?? null,
        yaraReply: parsed?.yaraReply ?? null,
        reason: parsed?.reason ?? null,
        sessionId: parsed?.sessionId ?? null,
        status: s.status,
        createdAt: s.createdAt,
      };
    });

    const combined = [...apptEvents, ...escalationEvents]
      .sort((a, b) => new Date(b.createdAt ?? 0).getTime() - new Date(a.createdAt ?? 0).getTime())
      .slice(0, limit);

    return res.json({ events: combined, total: combined.length });
  } catch (err) {
    logger.error({ err: (err as Error).message }, "chat-activity fetch failed");
    return res.status(500).json({ error: "Internal" });
  }
});

async function sendCommentReply(metaCid: string, text: string): Promise<void> {
  // FB Page comments and IG comments use DIFFERENT reply endpoints:
  //   FB Page comment  → POST /{comment-id}/comments  { message }
  //   IG media comment → POST /{comment-id}/replies   { message }
  const isFacebook = metaCid.startsWith("fb_");
  const realCid = isFacebook ? metaCid.slice(3) : metaCid;
  const endpoint = isFacebook ? `${realCid}/comments` : `${realCid}/replies`;
  await metaPost(endpoint, { message: text });
}

async function loadThreadHistory(
  threadId: string,
  limit: number,
): Promise<Array<{ role: "inbound" | "outbound"; text: string }>> {
  const rows = await db
    .select({
      direction: instagramMessagesTable.direction,
      text: instagramMessagesTable.text,
    })
    .from(instagramMessagesTable)
    .where(eq(instagramMessagesTable.threadId, threadId))
    .orderBy(desc(instagramMessagesTable.receivedAt))
    .limit(limit);
  return rows
    .reverse()
    .filter((r) => typeof r.text === "string" && r.text.length > 0)
    .map((r) => ({
      role:
        r.direction === "outbound" ? ("outbound" as const) : ("inbound" as const),
      text: String(r.text ?? ""),
    }));
}

export default router;

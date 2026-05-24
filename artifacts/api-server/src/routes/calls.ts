// ─────────────────────────────────────────────────────────────────────────────
// Yara Voice — Full Phone AI System (ElevenLabs + Twilio)
//
// Routes:
//   POST /api/calls/inbound          — Twilio webhook, returns TwiML to connect
//                                      inbound callers to ElevenLabs agent
//   POST /api/calls/initiate         — Admin/system: start an outbound call
//   POST /api/calls/webhook          — ElevenLabs post-call webhook (transcript)
//   GET  /api/calls/webhook          — ElevenLabs webhook verification (GET)
//   POST /api/webhooks/call-status   — Twilio Voice StatusCallback (call ended)
//                                      Validates X-Twilio-Signature header.
//   GET  /api/admin/calls            — Admin: list calls with filters
//   GET  /api/admin/calls/stats      — Admin: weekly call stats
//   POST /api/admin/calls/campaigns  — Admin: create cold-calling campaign
//   GET  /api/admin/calls/campaigns  — Admin: list campaigns
//   GET  /api/admin/calls/campaigns/:id        — Admin: campaign detail
//   GET  /api/admin/calls/campaigns/:id/contacts — Admin: contacts in campaign
//   POST /api/admin/calls/campaigns/:id/start  — Admin: start/resume campaign
//   POST /api/admin/calls/campaigns/:id/pause  — Admin: pause campaign
//   DELETE /api/admin/calls/campaigns/:id      — Admin: delete campaign
//   POST /api/admin/calls/campaigns/:id/contacts — Admin: add contacts to campaign
// ─────────────────────────────────────────────────────────────────────────────

import { createHmac } from "crypto";
import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import { db } from "@workspace/db";
import {
  yaraCallsTable,
  callCampaignsTable,
  campaignContactsTable,
  submissionsTable,
} from "@workspace/db/schema";
import { eq, desc, and, sql, gte, count, ilike, or } from "drizzle-orm";
import { clientsTable } from "@workspace/db/schema";
import { notifyTeam } from "../lib/notify-team";
import { logger } from "../lib/logger";

const router: IRouter = Router();

// ─── Twilio Signature Validation ─────────────────────────────────────────────
// https://www.twilio.com/docs/usage/webhooks/webhooks-security

function buildTwilioSignature(
  authToken: string,
  url: string,
  params: Record<string, string>,
): string {
  const sorted = Object.keys(params).sort();
  const paramString = sorted.map((k) => `${k}${params[k]}`).join("");
  return createHmac("sha1", authToken)
    .update(url + paramString)
    .digest("base64");
}

function twilioSignatureMiddleware(req: Request, res: Response, next: NextFunction) {
  const authToken = process.env["TWILIO_AUTH_TOKEN"];

  // If Twilio is not configured yet, skip validation (dev/staging only)
  if (!authToken) {
    logger.warn("call-webhook: TWILIO_AUTH_TOKEN not set — skipping signature validation");
    return next();
  }

  const signature = typeof req.headers["x-twilio-signature"] === "string"
    ? req.headers["x-twilio-signature"]
    : "";

  if (!signature) {
    logger.warn("call-webhook: missing X-Twilio-Signature header — rejecting request");
    return res.status(403).json({ error: "Forbidden: missing signature" });
  }

  // Reconstruct the full request URL as Twilio sees it
  const host = req.headers["x-forwarded-host"] ?? req.headers.host ?? "";
  const proto = req.headers["x-forwarded-proto"] ?? "https";
  const fullUrl = `${proto}://${host}${req.originalUrl}`;

  const params = (req.body as Record<string, string>) ?? {};
  const expected = buildTwilioSignature(authToken, fullUrl, params);

  if (signature !== expected) {
    logger.warn(
      { url: fullUrl, signaturePrefix: signature.slice(0, 8) + "…" },
      "call-webhook: Twilio signature mismatch — rejecting request",
    );
    return res.status(403).json({ error: "Forbidden: invalid signature" });
  }

  return next();
}

// ── Auth middleware ───────────────────────────────────────────────────────────

function adminAuth(req: Request, res: Response, next: NextFunction) {
  const expected = process.env["ADMIN_TOKEN"];
  if (!expected || expected.length < 8) return res.status(503).json({ error: "Admin disabled" });
  const provided =
    (typeof req.headers["x-admin-token"] === "string" ? req.headers["x-admin-token"] : "") ||
    (typeof req.headers.authorization === "string"
      ? req.headers.authorization.replace(/^Bearer\s+/i, "")
      : "");
  if (provided !== expected) return res.status(401).json({ error: "Unauthorized" });
  return next();
}

// ── Config helpers ────────────────────────────────────────────────────────────

function getElevenLabsConfig() {
  return {
    apiKey: process.env["ELEVENLABS_API_KEY"] ?? "",
    agentId: process.env["ELEVENLABS_AGENT_ID"] ?? "",
    arabicVoiceId: process.env["ELEVENLABS_ARABIC_VOICE_ID"] ?? "",
    englishVoiceId: process.env["ELEVENLABS_ENGLISH_VOICE_ID"] ?? "",
  };
}

function getTwilioConfig() {
  return {
    accountSid: process.env["TWILIO_ACCOUNT_SID"] ?? "",
    authToken: process.env["TWILIO_AUTH_TOKEN"] ?? "",
    phoneNumber: process.env["TWILIO_PHONE_NUMBER"] ?? "",
  };
}

function isElevenLabsConfigured(): boolean {
  const c = getElevenLabsConfig();
  return Boolean(c.apiKey && c.agentId);
}

function isTwilioVoiceConfigured(): boolean {
  const c = getTwilioConfig();
  return Boolean(c.accountSid && c.authToken && c.phoneNumber);
}

// ── Inbound call webhook (Twilio → ElevenLabs) ───────────────────────────────
//
// Twilio hits this URL when a call arrives on the salon's number.
// We respond with TwiML that connects the caller directly to ElevenLabs
// Conversational AI via a WebSocket stream.

router.post("/calls/inbound", twilioSignatureMiddleware, async (req, res) => {
  const b = req.body as Record<string, string>;
  const callSid = String(b.CallSid ?? "");
  const from = String(b.From ?? b.Caller ?? "");
  const to = String(b.To ?? b.Called ?? "");

  logger.info({ callSid, from, to }, "calls/inbound: received Twilio inbound call");

  const { agentId, apiKey } = getElevenLabsConfig();

  if (!agentId || !apiKey) {
    logger.warn("calls/inbound: ElevenLabs not configured — returning fallback TwiML");
    res.type("text/xml").send(`<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say language="ar-EG">أهلاً، يارا غير متاحة الآن. من فضلك تواصل معنا على واتساب 01009780008</Say>
  <Say>Hello! Yara is unavailable right now. Please reach us on WhatsApp at 01009780008.</Say>
  <Hangup/>
</Response>`);
    return;
  }

  // Log the call to the database
  try {
    const inserted = await db
      .insert(yaraCallsTable)
      .values({
        phone: from,
        direction: "inbound",
        twilioCallSid: callSid,
        status: "ringing",
      })
      .onConflictDoNothing()
      .returning({ id: yaraCallsTable.id });

    if (inserted.length > 0) {
      logger.info({ callId: inserted[0]?.id, callSid }, "calls/inbound: logged to DB");
    }
  } catch (err) {
    logger.warn({ err: (err as Error).message }, "calls/inbound: DB insert failed (non-fatal)");
  }

  // Return TwiML that streams the call to ElevenLabs Conversational AI
  const streamUrl = `wss://api.elevenlabs.io/v1/convai/twilio?agent_id=${encodeURIComponent(agentId)}`;

  res.type("text/xml").send(`<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Connect>
    <Stream url="${streamUrl}">
      <Parameter name="xi-api-key" value="${apiKey}"/>
    </Stream>
  </Connect>
</Response>`);
});

// ── Outbound call initiation ──────────────────────────────────────────────────
//
// POST /api/calls/initiate
// Body: { phone, language?, leadContext?, campaignContactId? }
// Returns: { ok, callId, elevenLabsConvId }

router.post("/calls/initiate", adminAuth, async (req, res) => {
  const b = req.body as Record<string, string | number>;
  const phone = String(b.phone ?? "").trim();
  const language = String(b.language ?? "ar");
  const leadContext = String(b.leadContext ?? "").slice(0, 800);
  const campaignContactId = b.campaignContactId ? Number(b.campaignContactId) : undefined;
  const campaignId = b.campaignId ? Number(b.campaignId) : undefined;

  if (!phone) return res.status(400).json({ error: "phone is required (E.164)" });

  const el = getElevenLabsConfig();
  const tw = getTwilioConfig();

  if (!isElevenLabsConfigured()) {
    return res.status(503).json({ error: "ElevenLabs not configured (ELEVENLABS_API_KEY / ELEVENLABS_AGENT_ID missing)" });
  }
  if (!isTwilioVoiceConfigured()) {
    return res.status(503).json({ error: "Twilio Voice not configured (TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN / TWILIO_PHONE_NUMBER missing)" });
  }

  // Insert a call record (pending state)
  let callDbId: number | undefined;
  try {
    const inserted = await db
      .insert(yaraCallsTable)
      .values({
        phone,
        direction: campaignId ? "campaign" : "outbound",
        campaignId: campaignId ?? null,
        status: "ringing",
        language,
        leadContext: leadContext || null,
      })
      .returning({ id: yaraCallsTable.id });
    callDbId = inserted[0]?.id;
  } catch (err) {
    logger.warn({ err: (err as Error).message }, "calls/initiate: DB pre-insert failed");
  }

  // Build first_message for Yara to open the call naturally
  let firstMessage: string;
  if (language === "ar") {
    firstMessage = leadContext
      ? `أهلاً، أنا يارا من TransforM Egypt. بتكلمك لأنك استفسرت عن خدماتنا. ${leadContext.slice(0, 120)}`
      : "أهلاً، أنا يارا من TransforM Egypt. كيف أقدر أساعدك؟";
  } else {
    firstMessage = leadContext
      ? `Hello! This is Yara from TransforM Egypt. I'm reaching out because you enquired about our services. ${leadContext.slice(0, 120)}`
      : "Hello! This is Yara from TransforM Egypt. How can I help you today?";
  }

  // Call ElevenLabs Outbound API
  try {
    const elPayload: Record<string, unknown> = {
      agent_id: el.agentId,
      to: phone,
      twilio_account_sid: tw.accountSid,
      twilio_auth_token: tw.authToken,
      twilio_number: tw.phoneNumber,
      first_message: firstMessage,
    };

    if (leadContext) {
      elPayload["conversation_initiation_client_data"] = {
        conversation_config_override: {
          agent: {
            first_message: firstMessage,
          },
        },
        dynamic_variables: {
          lead_context: leadContext,
          language,
        },
      };
    }

    const elRes = await fetch("https://api.elevenlabs.io/v1/convai/twilio/outbound-call", {
      method: "POST",
      headers: {
        "xi-api-key": el.apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(elPayload),
    });

    if (!elRes.ok) {
      const errText = await elRes.text().catch(() => "(no body)");
      logger.error({ status: elRes.status, body: errText }, "calls/initiate: ElevenLabs API error");

      if (callDbId) {
        await db
          .update(yaraCallsTable)
          .set({ status: "failed", updatedAt: new Date() })
          .where(eq(yaraCallsTable.id, callDbId));
      }

      return res.status(502).json({ error: `ElevenLabs API error ${elRes.status}: ${errText.slice(0, 200)}` });
    }

    const elData = await elRes.json() as { conversation_id?: string; call_sid?: string };
    const elevenLabsConvId = elData.conversation_id ?? elData.call_sid ?? null;

    // Update call record with ElevenLabs conversation ID
    if (callDbId) {
      await db
        .update(yaraCallsTable)
        .set({
          elevenLabsConvId: elevenLabsConvId ?? undefined,
          status: "in-progress",
          updatedAt: new Date(),
        })
        .where(eq(yaraCallsTable.id, callDbId));
    }

    // Update campaign contact status if applicable
    if (campaignContactId) {
      await db
        .update(campaignContactsTable)
        .set({ status: "calling", callId: callDbId, updatedAt: new Date() })
        .where(eq(campaignContactsTable.id, campaignContactId));
    }

    logger.info({ phone: phone.slice(0, 6) + "***", callDbId, elevenLabsConvId }, "calls/initiate: outbound call started");

    return res.json({ ok: true, callId: callDbId, elevenLabsConvId });
  } catch (err) {
    logger.error({ err: (err as Error).message }, "calls/initiate: unexpected error");
    if (callDbId) {
      await db
        .update(yaraCallsTable)
        .set({ status: "failed", updatedAt: new Date() })
        .where(eq(yaraCallsTable.id, callDbId))
        .catch(() => undefined);
    }
    return res.status(500).json({ error: "Internal error initiating call" });
  }
});

// ── ElevenLabs post-call webhook ─────────────────────────────────────────────
//
// ElevenLabs sends this when a conversation ends. Contains transcript,
// summary, and metadata. We parse booking intent and auto-create submissions.

router.get("/calls/webhook", (req, res) => {
  // ElevenLabs may GET the webhook URL to verify it exists
  res.json({ ok: true, service: "yara-voice" });
});

router.post("/calls/webhook", async (req, res) => {
  // ACK immediately — ElevenLabs retries on non-2xx
  res.json({ ok: true });

  try {
    const body = req.body as Record<string, unknown>;

    logger.info(
      { keys: Object.keys(body).join(","), type: body["type"] },
      "calls/webhook: ElevenLabs post-call event received",
    );

    // ElevenLabs sends type = "conversation.ended" or similar
    const convId = String(
      (body["conversation_id"] as string | undefined) ??
      (body["call_id"] as string | undefined) ??
      "",
    );

    // Extract transcript (ElevenLabs v1 format)
    const transcript = extractTranscript(body);
    const _callAnalysis = body["call_analysis"] as Record<string, unknown> | null | undefined;
    const _analysis = body["analysis"] as Record<string, unknown> | null | undefined;
    const _metadata = body["metadata"] as Record<string, unknown> | null | undefined;
    const summary = String(
      (_callAnalysis?.["summary"] ??
      body["summary"] ??
      _analysis?.["summary"] ??
      "") as string,
    ).slice(0, 2000);

    const callerNumber = String(
      (_metadata?.["phone_number"] ??
      body["phone_number"] ??
      body["to"] ??
      body["from"] ??
      "") as string,
    );

    const durationSeconds = Number(body["duration_secs"] ?? body["duration"] ?? 0) || undefined;
    const language = detectLang(transcript);

    // Detect booking intent in transcript
    const bookingData = detectBookingIntent(transcript);

    // Find the call record by ElevenLabs conv ID
    let callRecord: { id: number; campaignId: number | null; phone: string } | undefined;
    if (convId) {
      const rows = await db
        .select({ id: yaraCallsTable.id, campaignId: yaraCallsTable.campaignId, phone: yaraCallsTable.phone })
        .from(yaraCallsTable)
        .where(eq(yaraCallsTable.elevenLabsConvId, convId))
        .limit(1);
      callRecord = rows[0];
    }

    const effectivePhone = callRecord?.phone ?? callerNumber;

    // Update call record
    if (callRecord) {
      await db
        .update(yaraCallsTable)
        .set({
          status: "completed",
          duration: durationSeconds ?? null,
          language,
          transcript: transcript || null,
          summary: summary || null,
          bookingIntent: bookingData ? "captured" : "none",
          updatedAt: new Date(),
        })
        .where(eq(yaraCallsTable.id, callRecord.id));
    }

    // Auto-create submission if booking intent detected
    if (bookingData && effectivePhone) {
      try {
        const submInserted = await db
          .insert(submissionsTable)
          .values({
            source: "yara_call",
            name: bookingData.name ?? null,
            phone: effectivePhone,
            email: null,
            branch: bookingData.branch ?? null,
            service: bookingData.service ?? null,
            message: JSON.stringify({
              capturedFrom: "yara_voice_call",
              elevenLabsConvId: convId,
              callId: callRecord?.id,
              transcript: transcript?.slice(0, 500),
              summary,
            }),
            status: "new",
          })
          .returning({ id: submissionsTable.id });

        if (callRecord && submInserted[0]) {
          await db
            .update(yaraCallsTable)
            .set({ submissionId: submInserted[0].id, updatedAt: new Date() })
            .where(eq(yaraCallsTable.id, callRecord.id));
        }

        logger.info(
          { phone: effectivePhone.slice(0, 6) + "***", submId: submInserted[0]?.id },
          "calls/webhook: booking intent captured — submission created",
        );
      } catch (err) {
        logger.warn({ err: (err as Error).message }, "calls/webhook: submission insert failed");
      }
    }

    // Update campaign contact if this was a campaign call
    if (callRecord?.campaignId) {
      const outcome = bookingData ? "booked"
        : isInterested(transcript) ? "interested"
        : "answered";

      await db
        .update(campaignContactsTable)
        .set({ status: outcome, updatedAt: new Date() })
        .where(eq(campaignContactsTable.callId, callRecord.id))
        .catch(() => undefined);

      // Increment campaign counters
      await db
        .update(callCampaignsTable)
        .set({
          calledCount: sql`${callCampaignsTable.calledCount} + 1`,
          answeredCount: sql`${callCampaignsTable.answeredCount} + 1`,
          interestedCount: outcome === "interested" || outcome === "booked"
            ? sql`${callCampaignsTable.interestedCount} + 1`
            : callCampaignsTable.interestedCount,
          bookedCount: outcome === "booked"
            ? sql`${callCampaignsTable.bookedCount} + 1`
            : callCampaignsTable.bookedCount,
          updatedAt: new Date(),
        })
        .where(eq(callCampaignsTable.id, callRecord.campaignId))
        .catch(() => undefined);
    }

    // Team notification
    void notifyTeam({
      type: "call_summary",
      callSid: convId || `el_${Date.now()}`,
      direction: "inbound",
      callerNumber: effectivePhone,
      outcome: bookingData ? "Booking Captured" : "Completed",
      durationSeconds,
      summary: summary || undefined,
    }).catch(() => undefined);

  } catch (err) {
    logger.error({ err: (err as Error).message }, "calls/webhook: processing error");
  }
});

// ── Twilio Voice StatusCallback ───────────────────────────────────────────────
//
// Fires when a call ends. Validates X-Twilio-Signature, updates the DB
// call record status, and dispatches a team WhatsApp notification.

router.post("/webhooks/call-status", twilioSignatureMiddleware, async (req, res) => {
  try {
    const b = req.body as Record<string, string>;
    const callSid = String(b.CallSid ?? "");
    const callStatus = String(b.CallStatus ?? "");
    const direction = (b.Direction ?? "").toLowerCase().includes("outbound") ? "outbound" : "inbound";
    const from = String(b.From ?? b.Caller ?? "");
    const to = String(b.To ?? b.Called ?? "");
    const callerNumber = direction === "inbound" ? from : to;
    const durationSeconds = b.CallDuration ? Number.parseInt(b.CallDuration, 10) : undefined;

    logger.info(
      { callSid, callStatus, direction, callerNumber, durationSeconds },
      "call-status: Twilio voice status callback received",
    );

    // Map Twilio status to our DB status and update the call record
    const statusMap: Record<string, string> = {
      completed: "completed",
      "no-answer": "no-answer",
      busy: "no-answer",
      failed: "failed",
    };
    const dbStatus = statusMap[callStatus];

    if (dbStatus && callSid) {
      await db
        .update(yaraCallsTable)
        .set({
          status: dbStatus,
          duration: Number.isFinite(durationSeconds) ? durationSeconds : null,
          updatedAt: new Date(),
        })
        .where(eq(yaraCallsTable.twilioCallSid, callSid))
        .catch((err) => logger.warn({ err: (err as Error).message }, "call-status: DB update failed"));
    }

    // Only alert team on meaningful terminal states
    if (!["completed", "no-answer", "busy", "failed"].includes(callStatus)) {
      return res.sendStatus(204);
    }

    const outcomeMap: Record<string, string> = {
      completed: "Completed",
      "no-answer": "No Answer",
      busy: "Busy",
      failed: "Failed",
    };

    void notifyTeam({
      type: "call_summary",
      callSid,
      direction,
      callerNumber,
      outcome: outcomeMap[callStatus] ?? callStatus,
      durationSeconds: Number.isFinite(durationSeconds) ? durationSeconds : undefined,
    });

    return res.sendStatus(204);
  } catch (err) {
    logger.error({ err: (err as Error).message }, "call-status: handler error");
    return res.sendStatus(204);
  }
});

// ── Admin: List calls ─────────────────────────────────────────────────────────

router.get("/admin/calls", adminAuth, async (req, res) => {
  try {
    const q = req.query as Record<string, string>;
    const direction = q["direction"]; // inbound | outbound | campaign
    const limit = Math.min(Number(q["limit"] ?? 50), 200);
    const offset = Number(q["offset"] ?? 0);

    const conditions = [];
    if (direction && ["inbound", "outbound", "campaign"].includes(direction)) {
      conditions.push(eq(yaraCallsTable.direction, direction));
    }

    const calls = await db
      .select()
      .from(yaraCallsTable)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(yaraCallsTable.createdAt))
      .limit(limit)
      .offset(offset);

    return res.json({ calls });
  } catch (err) {
    logger.error({ err: (err as Error).message }, "admin/calls: list error");
    return res.status(500).json({ error: "Internal error" });
  }
});

// ── Admin: Call stats ─────────────────────────────────────────────────────────

router.get("/admin/calls/stats", adminAuth, async (req, res) => {
  try {
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const [totalThisWeek, bookingsThisWeek, directionCounts] = await Promise.all([
      db
        .select({ count: count() })
        .from(yaraCallsTable)
        .where(gte(yaraCallsTable.createdAt, weekAgo))
        .then((r) => r[0]?.count ?? 0),
      db
        .select({ count: count() })
        .from(yaraCallsTable)
        .where(and(
          gte(yaraCallsTable.createdAt, weekAgo),
          eq(yaraCallsTable.bookingIntent, "captured"),
        ))
        .then((r) => r[0]?.count ?? 0),
      db
        .select({ direction: yaraCallsTable.direction, count: count() })
        .from(yaraCallsTable)
        .where(gte(yaraCallsTable.createdAt, weekAgo))
        .groupBy(yaraCallsTable.direction),
    ]);

    const answeredCount = await db
      .select({ count: count() })
      .from(yaraCallsTable)
      .where(and(
        gte(yaraCallsTable.createdAt, weekAgo),
        eq(yaraCallsTable.status, "completed"),
      ))
      .then((r) => r[0]?.count ?? 0);

    const answerRate = Number(totalThisWeek) > 0
      ? Math.round((Number(answeredCount) / Number(totalThisWeek)) * 100)
      : 0;

    return res.json({
      totalCallsThisWeek: Number(totalThisWeek),
      bookingsFromCalls: Number(bookingsThisWeek),
      answerRate,
      directionBreakdown: directionCounts.reduce<Record<string, number>>((acc, r) => {
        acc[r.direction] = Number(r.count);
        return acc;
      }, {}),
    });
  } catch (err) {
    logger.error({ err: (err as Error).message }, "admin/calls/stats: error");
    return res.status(500).json({ error: "Internal error" });
  }
});

// ── Admin: Campaign CRUD ──────────────────────────────────────────────────────

router.get("/admin/calls/campaigns", adminAuth, async (req, res) => {
  try {
    const campaigns = await db
      .select()
      .from(callCampaignsTable)
      .orderBy(desc(callCampaignsTable.createdAt));
    return res.json({ campaigns });
  } catch (err) {
    return res.status(500).json({ error: "Internal error" });
  }
});

router.post("/admin/calls/campaigns", adminAuth, async (req, res) => {
  const b = req.body as Record<string, unknown>;
  const name = String(b.name ?? "").trim();
  const pitchGoal = String(b.pitchGoal ?? "").trim();
  const callLimitPerDay = Number(b.callLimitPerDay ?? 20);
  const contacts = Array.isArray(b.contacts) ? b.contacts as Array<{ phone: string; name?: string }> : [];

  if (!name) return res.status(400).json({ error: "name is required" });
  if (!pitchGoal) return res.status(400).json({ error: "pitchGoal is required" });
  if (contacts.length === 0) return res.status(400).json({ error: "At least one contact is required" });

  try {
    const [campaign] = await db
      .insert(callCampaignsTable)
      .values({
        name,
        pitchGoal,
        callLimitPerDay: Math.max(1, Math.min(200, callLimitPerDay)),
        status: "draft",
        totalContacts: contacts.length,
      })
      .returning();

    if (!campaign) return res.status(500).json({ error: "Campaign insert failed" });

    // Insert contacts
    const contactRows = contacts
      .map((c) => ({
        campaignId: campaign.id,
        phone: String(c.phone ?? "").trim(),
        name: c.name ? String(c.name).trim() : null,
        status: "pending" as const,
      }))
      .filter((c) => c.phone.length > 0);

    if (contactRows.length > 0) {
      await db.insert(campaignContactsTable).values(contactRows);
    }

    logger.info({ campaignId: campaign.id, contacts: contactRows.length }, "calls/campaigns: created");
    return res.json({ campaign, contactsAdded: contactRows.length });
  } catch (err) {
    logger.error({ err: (err as Error).message }, "calls/campaigns: create error");
    return res.status(500).json({ error: "Internal error" });
  }
});

router.get("/admin/calls/campaigns/:id", adminAuth, async (req, res) => {
  const id = Number(req.params["id"]);
  if (!id) return res.status(400).json({ error: "Invalid id" });
  try {
    const [campaign] = await db
      .select()
      .from(callCampaignsTable)
      .where(eq(callCampaignsTable.id, id))
      .limit(1);
    if (!campaign) return res.status(404).json({ error: "Campaign not found" });
    return res.json({ campaign });
  } catch (err) {
    return res.status(500).json({ error: "Internal error" });
  }
});

router.get("/admin/calls/campaigns/:id/contacts", adminAuth, async (req, res) => {
  const id = Number(req.params["id"]);
  if (!id) return res.status(400).json({ error: "Invalid id" });
  try {
    const contacts = await db
      .select()
      .from(campaignContactsTable)
      .where(eq(campaignContactsTable.campaignId, id))
      .orderBy(campaignContactsTable.createdAt);
    return res.json({ contacts });
  } catch (err) {
    return res.status(500).json({ error: "Internal error" });
  }
});

// Add contacts to existing campaign
router.post("/admin/calls/campaigns/:id/contacts", adminAuth, async (req, res) => {
  const id = Number(req.params["id"]);
  if (!id) return res.status(400).json({ error: "Invalid id" });
  const b = req.body as { contacts?: Array<{ phone: string; name?: string }> };
  const contacts = Array.isArray(b.contacts) ? b.contacts : [];
  if (contacts.length === 0) return res.status(400).json({ error: "contacts array required" });

  try {
    const rows = contacts
      .map((c) => ({
        campaignId: id,
        phone: String(c.phone ?? "").trim(),
        name: c.name ? String(c.name).trim() : null,
        status: "pending" as const,
      }))
      .filter((c) => c.phone.length > 0);

    await db.insert(campaignContactsTable).values(rows);
    await db
      .update(callCampaignsTable)
      .set({ totalContacts: sql`${callCampaignsTable.totalContacts} + ${rows.length}`, updatedAt: new Date() })
      .where(eq(callCampaignsTable.id, id));

    return res.json({ added: rows.length });
  } catch (err) {
    return res.status(500).json({ error: "Internal error" });
  }
});

// Start / resume a campaign
router.post("/admin/calls/campaigns/:id/start", adminAuth, async (req, res) => {
  const id = Number(req.params["id"]);
  if (!id) return res.status(400).json({ error: "Invalid id" });

  if (!isElevenLabsConfigured() || !isTwilioVoiceConfigured()) {
    return res.status(503).json({
      error: "ElevenLabs or Twilio Voice not configured. Please set ELEVENLABS_API_KEY, ELEVENLABS_AGENT_ID, TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER.",
    });
  }

  try {
    const [campaign] = await db
      .select()
      .from(callCampaignsTable)
      .where(eq(callCampaignsTable.id, id))
      .limit(1);
    if (!campaign) return res.status(404).json({ error: "Campaign not found" });
    if (campaign.status === "completed" || campaign.status === "cancelled") {
      return res.status(400).json({ error: `Cannot start a ${campaign.status} campaign` });
    }

    await db
      .update(callCampaignsTable)
      .set({ status: "active", updatedAt: new Date() })
      .where(eq(callCampaignsTable.id, id));

    // Kick off the campaign runner async — fire and forget for the HTTP response
    void runCampaignBatch(campaign).catch((err) =>
      logger.error({ err: (err as Error).message, campaignId: id }, "campaign runner error"),
    );

    return res.json({ ok: true, status: "active" });
  } catch (err) {
    return res.status(500).json({ error: "Internal error" });
  }
});

// Pause a campaign
router.post("/admin/calls/campaigns/:id/pause", adminAuth, async (req, res) => {
  const id = Number(req.params["id"]);
  if (!id) return res.status(400).json({ error: "Invalid id" });
  try {
    await db
      .update(callCampaignsTable)
      .set({ status: "paused", updatedAt: new Date() })
      .where(eq(callCampaignsTable.id, id));
    return res.json({ ok: true, status: "paused" });
  } catch (err) {
    return res.status(500).json({ error: "Internal error" });
  }
});

// Delete a campaign
router.delete("/admin/calls/campaigns/:id", adminAuth, async (req, res) => {
  const id = Number(req.params["id"]);
  if (!id) return res.status(400).json({ error: "Invalid id" });
  try {
    await db.delete(campaignContactsTable).where(eq(campaignContactsTable.campaignId, id));
    await db.delete(callCampaignsTable).where(eq(callCampaignsTable.id, id));
    return res.json({ ok: true });
  } catch (err) {
    return res.status(500).json({ error: "Internal error" });
  }
});

// ── Campaign runner ───────────────────────────────────────────────────────────
//
// Picks pending contacts one-by-one, respects daily call limit,
// and calls the ElevenLabs outbound API for each. Waits between calls
// to avoid flooding Twilio.

const BETWEEN_CALL_DELAY_MS = 60_000; // 1 minute between calls

async function runCampaignBatch(campaign: { id: number; pitchGoal: string; callLimitPerDay: number }): Promise<void> {
  logger.info({ campaignId: campaign.id }, "campaign-runner: starting batch");

  // Count how many calls we've already made today for this campaign
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const calledToday = await db
    .select({ count: count() })
    .from(yaraCallsTable)
    .where(and(
      eq(yaraCallsTable.campaignId, campaign.id),
      gte(yaraCallsTable.createdAt, todayStart),
    ))
    .then((r) => Number(r[0]?.count ?? 0));

  const remaining = campaign.callLimitPerDay - calledToday;
  if (remaining <= 0) {
    logger.info({ campaignId: campaign.id, calledToday }, "campaign-runner: daily limit reached, stopping");
    return;
  }

  // Get pending contacts
  const contacts = await db
    .select()
    .from(campaignContactsTable)
    .where(and(
      eq(campaignContactsTable.campaignId, campaign.id),
      eq(campaignContactsTable.status, "pending"),
    ))
    .limit(remaining)
    .orderBy(campaignContactsTable.createdAt);

  logger.info({ campaignId: campaign.id, toCall: contacts.length }, "campaign-runner: contacts to call");

  for (const contact of contacts) {
    // Re-check campaign status before each call (admin may have paused)
    const [fresh] = await db
      .select({ status: callCampaignsTable.status })
      .from(callCampaignsTable)
      .where(eq(callCampaignsTable.id, campaign.id))
      .limit(1);

    if (fresh?.status !== "active") {
      logger.info({ campaignId: campaign.id, status: fresh?.status }, "campaign-runner: campaign no longer active, stopping");
      break;
    }

    // Mark as calling
    await db
      .update(campaignContactsTable)
      .set({ status: "calling", attempts: sql`${campaignContactsTable.attempts} + 1`, updatedAt: new Date() })
      .where(eq(campaignContactsTable.id, contact.id));

    // Initiate the call
    try {
      const leadContext = `Campaign: ${campaign.pitchGoal}`;
      const callRow = await db
        .insert(yaraCallsTable)
        .values({
          phone: contact.phone,
          direction: "campaign",
          campaignId: campaign.id,
          status: "ringing",
          leadContext,
        })
        .returning({ id: yaraCallsTable.id });
      const callDbId = callRow[0]?.id;

      if (callDbId) {
        await db
          .update(campaignContactsTable)
          .set({ callId: callDbId, updatedAt: new Date() })
          .where(eq(campaignContactsTable.id, contact.id));
      }

      const el = getElevenLabsConfig();
      const tw = getTwilioConfig();

      const elRes = await fetch("https://api.elevenlabs.io/v1/convai/twilio/outbound-call", {
        method: "POST",
        headers: { "xi-api-key": el.apiKey, "Content-Type": "application/json" },
        body: JSON.stringify({
          agent_id: el.agentId,
          to: contact.phone,
          twilio_account_sid: tw.accountSid,
          twilio_auth_token: tw.authToken,
          twilio_number: tw.phoneNumber,
          first_message: `أهلاً، أنا يارا من TransforM Egypt. ${campaign.pitchGoal.slice(0, 100)}`,
        }),
      });

      if (elRes.ok) {
        const elData = await elRes.json() as { conversation_id?: string };
        if (callDbId && elData.conversation_id) {
          await db
            .update(yaraCallsTable)
            .set({ elevenLabsConvId: elData.conversation_id, status: "in-progress", updatedAt: new Date() })
            .where(eq(yaraCallsTable.id, callDbId));
        }
        logger.info({ phone: contact.phone.slice(0, 6) + "***", campaignId: campaign.id }, "campaign-runner: call started");
      } else {
        const errText = await elRes.text().catch(() => "");
        logger.warn({ status: elRes.status, errText, contact: contact.id }, "campaign-runner: ElevenLabs API error");
        await db
          .update(campaignContactsTable)
          .set({ status: "failed", updatedAt: new Date() })
          .where(eq(campaignContactsTable.id, contact.id));
        if (callDbId) {
          await db.update(yaraCallsTable).set({ status: "failed", updatedAt: new Date() }).where(eq(yaraCallsTable.id, callDbId));
        }
      }
    } catch (err) {
      logger.error({ err: (err as Error).message, contact: contact.id }, "campaign-runner: call error");
      await db
        .update(campaignContactsTable)
        .set({ status: "failed", updatedAt: new Date() })
        .where(eq(campaignContactsTable.id, contact.id))
        .catch(() => undefined);
    }

    // Wait between calls
    await new Promise((resolve) => setTimeout(resolve, BETWEEN_CALL_DELAY_MS));
  }

  // Check if all contacts are done
  const pendingLeft = await db
    .select({ count: count() })
    .from(campaignContactsTable)
    .where(and(
      eq(campaignContactsTable.campaignId, campaign.id),
      eq(campaignContactsTable.status, "pending"),
    ))
    .then((r) => Number(r[0]?.count ?? 0));

  if (pendingLeft === 0) {
    await db
      .update(callCampaignsTable)
      .set({ status: "completed", updatedAt: new Date() })
      .where(eq(callCampaignsTable.id, campaign.id));
    logger.info({ campaignId: campaign.id }, "campaign-runner: all contacts called — campaign completed");
  }
}

// ── Utility: transcript parsing ───────────────────────────────────────────────

function extractTranscript(body: Record<string, unknown>): string {
  // ElevenLabs post-call webhook transcript formats
  const _ca = body["call_analysis"] as Record<string, unknown> | null | undefined;
  const transcript = body["transcript"] ?? _ca?.["transcript"] ?? body["full_transcript"];
  if (typeof transcript === "string") return transcript.slice(0, 5000);
  if (Array.isArray(transcript)) {
    return (transcript as Array<{ role?: string; message?: string; text?: string }>)
      .map((t) => `${t.role ?? "?"}: ${t.message ?? t.text ?? ""}`)
      .join("\n")
      .slice(0, 5000);
  }
  return "";
}

function detectLang(transcript: string): "ar" | "en" {
  if (!transcript) return "ar";
  const arabicChars = (transcript.match(/[\u0600-\u06FF]/g) ?? []).length;
  const totalLetters = (transcript.match(/[\p{L}]/gu) ?? []).length;
  if (totalLetters === 0) return "ar";
  return arabicChars / totalLetters > 0.2 ? "ar" : "en";
}

const BOOKING_PATTERNS_AR = [
  /احجز|حجز|موعد|أجي|هيجي|هروح|هزور|تعالي|زيارة/,
  /اسمي|اسمها|رقمي|رقمها/,
];
const BOOKING_PATTERNS_EN = [
  /book|appointment|schedule|come in|visit|my name|my number/i,
];

function detectBookingIntent(transcript: string): { name?: string; service?: string; branch?: string } | null {
  if (!transcript) return null;
  const hasAr = BOOKING_PATTERNS_AR.some((p) => p.test(transcript));
  const hasEn = BOOKING_PATTERNS_EN.some((p) => p.test(transcript));
  if (!hasAr && !hasEn) return null;

  // Try to extract name (simple heuristic)
  const nameMatch = transcript.match(/اسمي\s+(\S+)/i) ?? transcript.match(/my name is\s+(\S+)/i);
  const serviceMatch = transcript.match(/(اكستنشن|hair extension|lashes|رموش|microblading|ميكروبليدنج|nail|اظافر|keratin|كيراتين)/i);
  const branchMatch = transcript.match(/(city stars|سيتي ستارز|sofitel|سوفتيل)/i);

  return {
    name: nameMatch?.[1] ?? undefined,
    service: serviceMatch?.[0] ?? undefined,
    branch: branchMatch?.[0] ?? undefined,
  };
}

function isInterested(transcript: string): boolean {
  if (!transcript) return false;
  return /interested|مهتم|مهتمة|عايزة|عاوزة|تمام|ماشي|اوك|ok|yes|أيوه|ايوه/i.test(transcript);
}

// ── Admin: CRM clients for batch calling ──────────────────────────────────────
//
// GET /api/admin/calls/crm-clients?search=&branch=&limit=100
// Returns clients from the CRM with phone numbers, for use in batch call modal.

router.get("/admin/calls/crm-clients", adminAuth, async (req, res) => {
  try {
    const q = req.query as Record<string, string>;
    const search = (q["search"] ?? "").trim();
    const branch = (q["branch"] ?? "").trim();
    const limit = Math.min(Number(q["limit"] ?? 100), 500);

    const conds: ReturnType<typeof ilike>[] = [];
    if (search) {
      conds.push(
        or(
          ilike(clientsTable.name, `%${search}%`),
          ilike(clientsTable.phone, `%${search}%`),
        ) as ReturnType<typeof ilike>,
      );
    }
    if (branch) {
      conds.push(eq(clientsTable.preferredBranch, branch) as unknown as ReturnType<typeof ilike>);
    }

    const clients = await db
      .select({
        id: clientsTable.id,
        name: clientsTable.name,
        phone: clientsTable.phone,
        preferredBranch: clientsTable.preferredBranch,
        lastVisit: clientsTable.lastVisit,
        visitCount: clientsTable.visitCount,
      })
      .from(clientsTable)
      .where(conds.length > 0 ? and(...conds) : undefined)
      .orderBy(desc(clientsTable.lastVisit))
      .limit(limit);

    return res.json({ clients });
  } catch (err) {
    logger.error({ err: (err as Error).message }, "admin/calls/crm-clients: error");
    return res.status(500).json({ error: "Internal error" });
  }
});

// ── Admin: ElevenLabs WhatsApp setup info ────────────────────────────────────
//
// GET /api/admin/calls/whatsapp-setup
// Returns connection status and ElevenLabs agent info for the setup guide.

router.get("/admin/calls/whatsapp-setup", adminAuth, async (req, res) => {
  try {
    const apiKey = process.env["ELEVENLABS_API_KEY"] ?? "";
    const agentId = process.env["ELEVENLABS_AGENT_ID"] ?? "";

    if (!apiKey || !agentId) {
      return res.json({ configured: false, reason: "ElevenLabs not configured" });
    }

    // Fetch agent name from ElevenLabs
    let agentName = "Yara — TransforM Egypt AI Consultant";
    try {
      const r = await fetch(`https://api.elevenlabs.io/v1/convai/agents/${agentId}`, {
        headers: { "xi-api-key": apiKey },
      });
      if (r.ok) {
        const data = await r.json() as { name?: string };
        agentName = data.name ?? agentName;
      }
    } catch {
      // non-fatal
    }

    return res.json({
      configured: true,
      agentId,
      agentName,
      dashboardUrl: "https://elevenlabs.io/app/conversational-ai",
      setupSteps: [
        { step: 1, title: "Open ElevenLabs dashboard", detail: "Go to elevenlabs.io/app/conversational-ai → Deploy → WhatsApp" },
        { step: 2, title: "Connect a WhatsApp number", detail: "Either link your existing WhatsApp Business number or let ElevenLabs provision one. You will scan a QR code or enter your Business Manager credentials." },
        { step: 3, title: "Select the Yara agent", detail: `Choose "${agentName}" (ID: ${agentId}) as the agent that handles incoming WhatsApp messages.` },
        { step: 4, title: "Test the connection", detail: "Send a WhatsApp message to the connected number. Yara will respond in Arabic by default." },
      ],
    });
  } catch (err) {
    logger.error({ err: (err as Error).message }, "admin/calls/whatsapp-setup: error");
    return res.status(500).json({ error: "Internal error" });
  }
});

export default router;

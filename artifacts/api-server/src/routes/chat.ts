// ─────────────────────────────────────────────────────────────────────────────
// Yara Website Chat API
//
// POST /api/chat
//   Body: { messages: [{role, content}], sessionId: string, clientPhone?: string }
//   Returns: { reply: string, booked?: boolean, escalated?: boolean }
//
// Uses Google Gemini (AI Studio, free tier) with an in-memory session
// store (ephemeral, not persisted to DB — privacy-friendly per spec).
// ─────────────────────────────────────────────────────────────────────────────

import { Router, type IRouter, type Request, type Response } from "express";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { db } from "@workspace/db";
import { appointmentsTable, submissionsTable } from "@workspace/db/schema";
import { logger } from "../lib/logger";
import { notifyTeam } from "../lib/notify-team";
import { findOrCreateClient, normalizePhone } from "../lib/crm";
import {
  buildSystemPrompt,
  lookupClientHistory,
  getSession,
  appendToSession,
  extractBookingData,
  extractEscalationData,
  detectEscalationKeywords,
  cleanResponseText,
  type ChatMessage,
} from "../lib/yara-chat";
import { getActiveOffers, formatOffersForChat } from "../lib/offers";
import { buildBranchesPromptSection } from "../lib/branches";
import { createBookingEvent } from "../lib/google-calendar";

const router: IRouter = Router();

// ── Gemini client (Google AI Studio, free tier) ──────────────────────────────
// Try the configured model first, then fall back through known-good models.
// Google periodically retires model aliases (e.g. gemini-1.5-flash), which would
// otherwise hard-500 the whole chat. The fallback keeps Yara answering and logs
// the exact failure of each model so the root cause is visible in the logs.
const MODEL_CANDIDATES: string[] = Array.from(
  new Set(
    [
      process.env["GEMINI_MODEL"],
      "gemini-2.5-flash",
      "gemini-flash-latest",
      "gemini-2.0-flash",
      "gemini-1.5-flash",
    ].filter((m): m is string => Boolean(m)),
  ),
);

async function generateWithFallback(
  genAI: GoogleGenerativeAI,
  systemPrompt: string,
  contents: Array<{ role: string; parts: Array<{ text: string }> }>,
): Promise<string> {
  let lastErr: unknown;
  for (const modelName of MODEL_CANDIDATES) {
    try {
      const model = genAI.getGenerativeModel({ model: modelName, systemInstruction: systemPrompt });
      const response = await model.generateContent({
        contents,
        generationConfig: { maxOutputTokens: 1024 },
      });
      const text = response.response.text();
      if (modelName !== MODEL_CANDIDATES[0]) {
        logger.warn({ model: modelName }, "chat: primary model failed, succeeded on fallback");
      }
      return text;
    } catch (err) {
      lastErr = err;
      logger.warn(
        { model: modelName, err: (err as Error).message },
        "chat: Gemini model failed, trying next candidate",
      );
    }
  }
  throw lastErr ?? new Error("All Gemini model candidates failed");
}

function getGeminiClient(): GoogleGenerativeAI | null {
  const apiKey = process.env["GEMINI_API_KEY"];
  if (!apiKey) return null;
  return new GoogleGenerativeAI(apiKey);
}

// ── Rate limit: max 60 messages per session in 30 min ────────────────────────
const sessionMessageCounts = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT = 60;
const RATE_WINDOW_MS = 30 * 60 * 1000;

function checkRateLimit(sessionId: string): boolean {
  const now = Date.now();
  const entry = sessionMessageCounts.get(sessionId);
  if (!entry || entry.resetAt < now) {
    sessionMessageCounts.set(sessionId, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return true;
  }
  entry.count += 1;
  return entry.count <= RATE_LIMIT;
}

// ── POST /api/chat ────────────────────────────────────────────────────────────
//
// Accepts EITHER:
//   { messages: [{role: "user"|"assistant", content: string}], sessionId, clientPhone? }
// OR the simplified form:
//   { message: string, sessionId, clientPhone? }
// Both are supported for backward compatibility.

router.post("/chat", async (req: Request, res: Response) => {
  const body = req.body as Record<string, unknown>;

  const sessionId = typeof body.sessionId === "string" ? body.sessionId.trim().slice(0, 64) : "";
  const clientPhone = typeof body.clientPhone === "string" ? body.clientPhone.trim() : undefined;
  // Structured trigger field — avoids overloading user message content with sentinel strings
  const trigger = body.trigger === "phone_greeting" ? "phone_greeting" : undefined;

  // Support both { messages: [...] } (spec) and { message: "..." } (simplified)
  let userMessage = "";
  let incomingMessages: Array<{ role: string; content: string }> | undefined;

  if (Array.isArray(body.messages) && body.messages.length > 0) {
    // Spec format: use only the last user message; previous turns already stored server-side
    const msgs = body.messages as Array<{ role: string; content: string }>;
    const lastUserMsg = [...msgs].reverse().find((m) => m.role === "user");
    userMessage = typeof lastUserMsg?.content === "string" ? lastUserMsg.content.trim() : "";
    incomingMessages = msgs;
  } else if (typeof body.message === "string") {
    // Simplified format
    userMessage = body.message.trim();
  }

  if (!sessionId) {
    return res.status(400).json({ error: "sessionId is required" });
  }
  // Greeting triggers carry no user message — that's intentional
  if (!trigger && !userMessage) {
    return res.status(400).json({ error: "message or messages[].content is required" });
  }
  if (userMessage.length > 2000) {
    return res.status(400).json({ error: "message too long (max 2000 chars)" });
  }

  const genAI = getGeminiClient();
  if (!genAI) {
    logger.warn("chat: GEMINI_API_KEY not configured");
    return res.status(503).json({
      error: "AI unavailable",
      reply: "Sorry, our AI assistant is temporarily unavailable. Please contact us on WhatsApp: +201009780008",
    });
  }

  if (!checkRateLimit(sessionId)) {
    return res.status(429).json({
      error: "Too many messages",
      reply: "You've sent too many messages. Please continue on WhatsApp: +201009780008",
    });
  }

  // Look up client history if phone provided
  const clientHistory = clientPhone ? await lookupClientHistory(clientPhone) : null;

  // Build system prompt
  const currentDate = new Date().toLocaleDateString("en-GB", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  const isGreetingTrigger = trigger === "phone_greeting";
  // Live offers so the website Yara recommends current promos (graceful if none/err).
  let offersSection = "";
  let branchesSection = "";
  try {
    [offersSection, branchesSection] = await Promise.all([
      getActiveOffers().then(formatOffersForChat),
      buildBranchesPromptSection(),
    ]);
  } catch {
    offersSection = "";
    branchesSection = "";
  }
  const systemPrompt = buildSystemPrompt({ clientHistory, currentDate, isGreetingTrigger, offersSection, branchesSection });

  // Get existing session history
  const history = getSession(sessionId);
  // For greeting triggers we don't store the synthetic message as a real user turn
  const newUserMsg: ChatMessage | null = isGreetingTrigger
    ? null
    : { role: "user", parts: [{ text: userMessage }] };

  // If the caller sent the full messages array (spec format), we can optionally seed the
  // session with those turns on first call (when server history is empty). This ensures
  // the server history stays consistent with what the client knows.
  if (!isGreetingTrigger && incomingMessages && history.length === 0 && incomingMessages.length > 1) {
    // Seed all but the last user message (the last one will be appended after the reply)
    const allButLast = incomingMessages.slice(0, -1);
    for (const m of allButLast) {
      if (m.role === "user" || m.role === "assistant") {
        appendToSession(sessionId, {
          role: m.role === "assistant" ? "model" : "user",
          parts: [{ text: m.content }],
        });
      }
    }
  }

  // Re-read history after potential seeding
  const historyForRequest = getSession(sessionId);

  // For greeting triggers, send a neutral prompt so the model produces the greeting;
  // this synthetic prompt is NOT stored in session history.
  const effectiveUserMessage = isGreetingTrigger
    ? "Please greet me now."
    : userMessage;

  // Gemini uses the same { role, parts:[{text}] } shape as our session store,
  // where "model" is the assistant role — so history maps over directly.
  const mapped = historyForRequest.map((msg) => ({
    role: msg.role,
    parts: [{ text: msg.parts[0]?.text ?? "" }],
  }));
  // Gemini requires the conversation to begin with a user turn. A phone-greeting
  // stores only Yara's opening line (a model turn), so drop any leading model
  // turns to keep the history valid.
  while (mapped.length && mapped[0]?.role === "model") mapped.shift();
  const contents = [
    ...mapped,
    { role: "user" as const, parts: [{ text: effectiveUserMessage }] },
  ];

  try {
    const rawReply = await generateWithFallback(genAI, systemPrompt, contents);

    // Save the exchange to session memory
    // For greeting triggers, only store the model reply (not the synthetic user prompt)
    if (newUserMsg) appendToSession(sessionId, newUserMsg);
    appendToSession(sessionId, { role: "model", parts: [{ text: rawReply }] });

    // Compute clean reply early so booking notes can embed the conversation context.
    const cleanReply = cleanResponseText(rawReply);

    // Check for booking intent
    const bookingData = extractBookingData(rawReply);
    let booked = false;
    let appointmentId: number | undefined;

    if (bookingData) {
      // Validate datetime strictly — do NOT silently create wrong appointments
      const scheduledAt = new Date(bookingData.datetime);
      if (!isNaN(scheduledAt.getTime()) && scheduledAt > new Date()) {
        try {
          const clientId = await findOrCreateClient(
            bookingData.phone,
            bookingData.name,
            undefined,
            bookingData.branch,
          );

          // Store conversation context in notes as JSON so the admin Chat Activity
          // panel can surface the customer message and Yara's reply for each booking.
          const notesPayload = JSON.stringify({
            info: "Booked via website chat widget",
            requestedTime: bookingData.datetime,
            customerMessage: userMessage || null,
            yaraReply: cleanReply.slice(0, 500),
          });

          const [appt] = await db
            .insert(appointmentsTable)
            .values({
              clientId,
              clientName: bookingData.name,
              clientPhone: normalizePhone(bookingData.phone),
              service: bookingData.service,
              branch: bookingData.branch,
              scheduledAt,
              status: "scheduled",
              source: "yara",
              notes: notesPayload,
            })
            .returning();

          if (appt) {
            appointmentId = appt.id;
            booked = true;

            void notifyTeam({
              type: "new_booking",
              name: bookingData.name,
              phone: bookingData.phone,
              service: bookingData.service,
              branch: bookingData.branch,
            }).catch(() => undefined);

            // Mirror into the shared Google Calendar (no-op unless configured).
            void createBookingEvent({
              clientName: bookingData.name,
              clientPhone: bookingData.phone,
              service: bookingData.service,
              branch: bookingData.branch,
              scheduledAt,
              hasSpecificTime: true,
            }).catch(() => undefined);

            logger.info(
              { appointmentId: appt.id, phone: bookingData.phone.slice(0, 6) + "***" },
              "chat: booking created via Yara chat",
            );
          }
        } catch (err) {
          logger.error({ err: (err as Error).message }, "chat: failed to create appointment");
        }
      } else {
        // Booking marker found but datetime is invalid or in the past — log and skip insert
        logger.warn(
          { rawDatetime: bookingData.datetime },
          "chat: BOOKING_READY marker had unparseable or past datetime — skipping appointment insert",
        );
      }
    }

    // Check for escalation — model marker first, then keyword safety net
    const escalationData =
      extractEscalationData(rawReply) ?? detectEscalationKeywords(userMessage);
    let escalated = false;

    if (escalationData) {
      escalated = true;
      void notifyTeam({
        type: "escalation",
        threadId: sessionId,
        username: clientHistory?.name ?? clientPhone ?? null,
        platform: "website_chat",
        text: `${escalationData.reason}\n\nCustomer: "${escalationData.customerMessage || userMessage}"`,
      }).catch(() => undefined);

      logger.info({ sessionId: sessionId.slice(0, 8) + "***" }, "chat: escalation triggered");
    }

    // Log escalation events to the admin submissions inbox so the team can follow up.
    if (escalated) {
      void db
        .insert(submissionsTable)
        .values({
          source: "yara_chat_escalation",
          name: clientHistory?.name ?? null,
          phone: clientPhone ?? null,
          message: JSON.stringify({
            customerMessage: escalationData?.customerMessage || userMessage || null,
            yaraReply: cleanReply.slice(0, 500),
            reason: escalationData?.reason ?? null,
            sessionId: sessionId.slice(0, 8) + "***",
          }),
          loggedBy: "yara",
          status: "new",
        })
        .catch((err: Error) =>
          logger.error({ err: err.message }, "chat: failed to log escalation to submissions"),
        );
    }

    return res.json({
      reply: cleanReply,
      booked,
      escalated,
      ...(appointmentId ? { appointmentId } : {}),
    });
  } catch (err) {
    logger.error({ err: (err as Error).message }, "chat: AI error");
    return res.status(500).json({
      error: "AI error",
      reply: "I'm having trouble responding right now. Please reach us on WhatsApp: +201009780008",
    });
  }
});

export default router;

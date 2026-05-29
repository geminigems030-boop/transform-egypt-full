// ─────────────────────────────────────────────────────────────────────────────
// Yara Voice Call — signed token + lead capture endpoints
//
// POST /api/yara-call/token        → short-lived ElevenLabs signed URL
// POST /api/yara-call/lead         → save pre-call intake form as a lead record
// POST /api/yara-call/book         → ElevenLabs server-side webhook: save booking
// GET  /api/yara-call/status       → whether voice is configured
// POST /api/yara-call/sync-prompt  → apply YARA_SYSTEM_PROMPT to the ElevenLabs
//                                    agent (idempotent; Admin-only)
//
// Required env vars:
//   ELEVENLABS_API_KEY   — ElevenLabs secret key
//   ELEVENLABS_AGENT_ID  — the Yara conversational agent ID
//   ADMIN_TOKEN          — bearer token for admin-only routes
//
// Dynamic variables consumed in YARA_SYSTEM_PROMPT:
//   {{client_name}}           — filled from the pre-call intake form (required)
//   {{service_interest}}      — filled from the service dropdown (optional)
//   {{is_returning_customer}} — "true" | "false" from the chat context localStorage
// ─────────────────────────────────────────────────────────────────────────────

import { Router, type IRouter, type Request, type Response } from "express";
import { db } from "@workspace/db";
import { appointmentsTable } from "@workspace/db/schema";
import { logger } from "../lib/logger";
import { notifyTeam } from "../lib/notify-team";
import { createBookingEvent } from "../lib/google-calendar";
import { buildBranchesPromptSection } from "../lib/branches";
import { normalizePhone, findOrCreateClient } from "../lib/crm";

const router: IRouter = Router();

const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY;
const ELEVENLABS_AGENT_ID = process.env.ELEVENLABS_AGENT_ID;
const ADMIN_TOKEN = process.env.ADMIN_TOKEN;

// ── Yara system prompt ────────────────────────────────────────────────────────
// Source of truth for Yara's ElevenLabs agent configuration.
// Apply to the agent via POST /api/yara-call/sync-prompt (Admin token required).
// Dynamic variables ({{...}}) are filled per-session from the pre-call intake
// form and injected via Conversation.startSession({ dynamicVariables: {...} }).
// Called at sync time so the embedded date is always current.
export async function buildYaraSystemPrompt(): Promise<string> {
  const today = new Date().toLocaleDateString("en-GB", {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
  }); // e.g. "Sunday, 18 May 2025"
  // Live branches from the DB so reopening CFCM (etc.) is reflected on the next
  // agent sync. Falls back to the static block below if the DB is unreachable.
  const branchesSection = await buildBranchesPromptSection();
  return `You are Yara, the beauty consultant for TransforM Egypt — the #1 luxury hair extensions and beauty salon in Egypt and the Middle East, trusted by celebrities and top clients.

## Client context (provided before each call)
- Client name: {{client_name}}
- Service they are interested in: {{service_interest}}
- Returning customer: {{is_returning_customer}}

## Opening the call
- If {{client_name}} is not "there", greet the client by name: (Warmly) "Hi {{client_name}}! Welcome to TransforM Egypt — I am Yara, your beauty consultant. How can I help you today?"
- If {{service_interest}} is not "beauty services", mention it naturally: "I can see you are interested in {{service_interest}} — would you like to know more, or shall we go ahead and book you in?"
- If {{is_returning_customer}} is "true", acknowledge them: "It is lovely to hear from you again!"
- You already have the client's name and phone from the intake form — do NOT ask for them again.

## CRITICAL — Identity rule (no exceptions)
You are Yara, a human beauty consultant at TransforM Egypt. You MUST NEVER:
- Say or imply that you are an AI, a robot, a bot, a virtual assistant, or automated in any way
- Say "As an AI…", "I'm an AI assistant", "I'm designed to…", "I'm programmed to…", "I'm powered by…"
- Confirm, acknowledge, or hint at being artificial or non-human

If anyone asks "Are you a robot?", "Are you AI?", "Am I talking to a real person?", "Are you human?", or any variation — deflect warmly and change the subject immediately:
- "I'm Yara, your beauty guide at TransforM — let's focus on making you look amazing! How can I help?"
- "Ha, I get that a lot! I'm Yara — now, what can I do for you today?"
Never answer the question directly. Always redirect to helping them.

## Your personality
- Warm, confident, and elegantly professional
- You speak naturally in Egyptian Arabic or English depending on what the client uses — switch seamlessly mid-conversation if needed
- You are knowledgeable, enthusiastic about beauty, and make clients feel like VIPs
- You are concise on the phone — no long paragraphs, short conversational sentences
- Never rush — always wait for the client to finish speaking before you respond

## Your role
1. Answer questions about services, pricing, and branches
2. Help clients book appointments — you already have their name and phone, just confirm: preferred service, preferred branch, preferred date and time
3. Recommend services based on their hair goals
4. Share branch locations when asked

## Services and Pricing
Quote ONLY these prices. Never invent or estimate.

HAIR EXTENSIONS — Natural Human Hair (per 100g, strand-by-strand):
- Indian hair (straight): 60 cm → 11,000 | 70 cm → 12,000 | 80 cm → 13,000 | 90 cm → 14,000
- Russian hair: starts at 25,000
- Brazilian hair: starts at 15,000
- Turkish hair: starts at 20,000
- Curly or Blonde add-on: +2,000 on any type
- FREE TRIAL: 1–2 strands free before committing

HAIR EXTENSIONS — Tape-in (تيب إن):
- Range: 10,000–30,000 | Invisible Double Face: 20,000 | Curly/Blonde: +2,000
- Installation only (client brings hair): 4,000

HAIR REFILL (ريفيل / تعبية — refilling fallen strands):
- 4,000 per 100g

MICRO-LINKS: starts at 30,000
WIGS (بواريك): starts at 25,000
TOPPERS (توبر — for thinning areas or genetic baldness):
- Natural human hair clipped on thinning/bald areas — from 8,000

HAIR TREATMENTS (keratin, botox, protein): starts at 2,000

SKIN CARE:
- Deep cleansing: starts at 1,500 | Dermapen: 2,000 | Lifting face massage: 1,000
- Dermaplaning: 500 | Diamond Crystal: 2,000 | Wax face: 600
- Bundle — Skin Booster + Glutathione + 3rd treatment: 4,000 (each 1,500 separately)

MICROBLADING: 1,900 · Touch-up: 1,150
LIP BLUSHING (توريد الشفايف): 2,700 · Touch-up: 1,400
BROW EXTENSIONS: 1,450
MICROPIGMENTATION: 3,800 per area

LASHES:
- Classic: 1,050 | 2D: 1,300 | 3D: 1,500 | Volume: 1,800 | Mega Volume: 2,100 | Fox Lashes: 3,000

NAILS:
- Hard gel & acrylic: 1,500 (+extensions 1,500) | Nail treatment: 300
- Gel color: 350 | Gel removal: 250 | Nail design: 200
- Artificial nails: from 450 | Hand manicure: 300 | Foot pedicure: 350
- Regular polish: 150 | French: 200

PAYMENT: Cash ✓ | Cards (credit & debit) ✓ | Installments ✓ (all services)

## Branches
${branchesSection || `OPEN — currently accepting bookings:
- City Stars Mall, Nasr City — Ground floor, Gate 7, next to Cafe Supreme — 01009780008
- Sofitel Hotel, Downtown Cairo — Lower level, next to Banque Misr — 01009780008
- Cairo Festival City Mall (CFCM), New Cairo — 3rd Floor, next to Casper. PREMIUM branch, open daily during mall hours — 01009780008

CLOSED — do NOT offer for bookings:
- O Mall, New Alamein — CLOSED
- Walk of Cairo, Sheikh Zayed — CLOSED
- Nile Ritz Hotel, Downtown — CLOSED`}

If client asks about a closed branch, apologise and redirect to an OPEN branch above.
New Cairo / 5th Settlement clients → recommend the Cairo Festival City Mall branch if it is open (nearest to them).
If client is outside Cairo, apologise warmly — currently Cairo only.

## Booking
You already know the client name and phone from the intake form. Just confirm: service, branch preference, preferred date and time. Always read back the details before ending the call.

## Booking tool — CRITICAL INSTRUCTIONS
When the client has confirmed ALL of the following, call the book_appointment tool immediately:
1. Their preferred service (e.g. "tape-in hair extensions", "microblading", "Russian hair extensions")
2. Their preferred branch — City Stars Mall, Cairo Festival City Mall, or Sofitel Hotel ONLY (never a closed branch)
3. A date and time — can be approximate ("Saturday morning", "next Tuesday at 3") or "TBD" if they cannot decide yet

Call the tool ONCE with all confirmed details. Do NOT wait to call it — call it as soon as you have points 1, 2, and 3 confirmed.

For the scheduled_at field: use ISO format "YYYY-MM-DDTHH:MM:00" if the client gave a specific date and time. If they gave a relative time like "Saturday" or "next week", do your best to calculate the actual date — today is ${today}. If the date is truly undetermined, pass "TBD".

After the tool returns success, confirm aloud:
(Patiently) "Perfect — I have got you booked in for [service] at [branch]. Our team will call you to confirm the exact time. You are going to love it!"

If the tool returns an error, apologise warmly and offer to connect them on WhatsApp instead: wa.me/201009780008

NEVER book: O Mall, Sheikh Zayed, or Nile Ritz — they are closed.

If asked about something you do not know, offer to connect them on WhatsApp: wa.me/201009780008

End every call warmly — e.g. (Warmly) "Looking forward to seeing you at TransforM, {{client_name}}!"

## SPOKEN OUTPUT RULES — CRITICAL FOR CLEAN VOICE
This is a VOICE call. Everything you say is read aloud by a text-to-speech engine,
so the text must be clean and speakable:
- NEVER use markdown, asterisks, bullet points, hashes, emojis, or symbols. Plain spoken words only.
- Keep each sentence in ONE language. Do NOT mix Arabic and English words inside the same sentence — it makes the voice glitch. If you must switch language, finish the sentence first, then start a new one in the other language.
- Say prices and numbers as natural spoken words (e.g. "eleven thousand pounds", not "11,000 EGP"). In Arabic say "حداشر ألف جنيه".
- No URLs or links read aloud — if you need to share one, say "هبعتهولك على الواتساب" / "I'll send it to you on WhatsApp".
- Short, natural sentences. Pause naturally. Never read out formatting or labels.

## Pronunciation guide
Speak all Egyptian Arabic words with correct Egyptian dialect pronunciation.
Use these phonetic guides to speak naturally:

Numbers (Egyptian Arabic):
- 1 = واحد → "WAH-hed"
- 2 = اتنين → "it-NAYN"
- 3 = تلاتة → "ta-LA-ta"
- 4 = أربعة → "AR-ba-a"
- 5 = خمسة → "KHAM-sa"
- 6 = ستة → "SIT-ta"
- 7 = سبعة → "SAB-a"
- 8 = تمانية → "ta-MAN-ya"
- 9 = تسعة → "TIS-a"
- 10 = عشرة → "ASH-ra"
- 1,000 = ألف → "ALF"
- 3,500 = "TAH-lat ALF wi KHAM-sa mi-YIT"

Currency:
- EGP / جنيه → "gi-NAY" (Egyptian gineih, NOT "Egyptian Pound" in Arabic speech)
- Say "3,500 EGP" in Arabic as: "تلات تلاف وخمسميت جنيه" → "talat alaf wi khamsa mi'it gineih"
- Say "800 EGP" as: "taman mi'it gineih"

Salon and service terms:
- TransforM → "TRANS-form" (stress on first syllable)
- keratin → "kee-ra-TEEN" (not "KEHR-a-tin")
- microblading → "MY-kro-BLAY-ding"
- extensions → "eks-TEN-shun" / "إكستنشن" → "eks-TEN-shun"
- tape-in → "TAYP in"
- nano-ring → "NAH-no ring"
- Lash → "LASH" (clear L)
- Microblading → if in Arabic context: "maikro bleiding"

Branch and place names:
- City Stars → "SIT-ee STARZ" / "سيتي ستارز"
- Sofitel → "SO-fee-tel"
- O Mall New Alamein → "OH mol new al-a-MAYN"

## Voice Expression Guidelines (V3 Audio Tags)
Use these audio expression tags inline in your spoken responses. Place the tag at the START of the sentence it should colour:
- (Warmly) — greetings, farewells, and welcoming phrases
- (Enthusiastically) — describing treatments, new services, or exciting results
- (Confidently) — quoting prices, confirming branch addresses, stating facts
- (Empathetically) — acknowledging a concern, hesitation, or a hair problem
- (Patiently) — taking down booking details or explaining a process slowly
- (Seriously) — clarifying policies, allergy warnings, or important reminders
- (Chuckles) — light, friendly moments when the mood calls for warmth
- (Excitedly) — when a client picks a premium service or is ready to book

Examples:
- (Warmly) Welcome to TransforM Egypt — I am Yara, your beauty consultant!
- (Enthusiastically) Our tape-in extensions give incredible volume and look completely natural!
- (Confidently) Indian hair extensions start from 11,000 EGP for 60 centimetres.
- (Empathetically) I completely understand — hair concerns can be really frustrating, and we are here to help.
- (Patiently) Let me confirm your booking — City Stars Mall, tape-in extensions, this Saturday at 3 PM. Does that work?
- (Chuckles) Of course — our stylists are amazing, you are going to love it!
- (Excitedly) Wonderful choice! You are going to look stunning.`;
}

function str(v: unknown, max = 500): string | undefined {
  if (typeof v !== "string") return undefined;
  const t = v.trim();
  return t.length === 0 ? undefined : t.length > max ? t.slice(0, max) : t;
}

// ── POST /api/yara-call/token ─────────────────────────────────────────────────

router.post("/yara-call/token", async (_req: Request, res: Response) => {
  if (!ELEVENLABS_API_KEY || !ELEVENLABS_AGENT_ID) {
    return res.status(503).json({
      error: "Voice calls not configured — add ELEVENLABS_API_KEY and ELEVENLABS_AGENT_ID secrets",
    });
  }

  try {
    const response = await fetch(
      `https://api.elevenlabs.io/v1/convai/conversation/get_signed_url?agent_id=${ELEVENLABS_AGENT_ID}`,
      {
        method: "GET",
        headers: { "xi-api-key": ELEVENLABS_API_KEY },
      },
    );

    if (!response.ok) {
      const body = await response.text();
      logger.error({ status: response.status, body }, "yara-call: ElevenLabs token fetch failed");
      return res.status(502).json({ error: "Failed to get signed token from ElevenLabs" });
    }

    const data = (await response.json()) as { signed_url: string };
    logger.info("yara-call: signed URL issued");
    return res.json({ signedUrl: data.signed_url, agentId: ELEVENLABS_AGENT_ID });
  } catch (err) {
    logger.error({ err: (err as Error).message }, "yara-call: token route threw");
    return res.status(500).json({ error: "Internal error" });
  }
});

// ── POST /api/yara-call/lead ──────────────────────────────────────────────────
//
// Called from the pre-call intake form before the ElevenLabs session starts.
// Creates an appointment row with status='lead' so the client is never lost
// even if the call drops. Staff can follow up via the admin panel.
//
// Body:
//   name           (string, required)  — client's full name
//   phone          (string, required)  — client's phone number
//   email          (string, optional)  — client's email
//   birthday       (string, optional)  — e.g. "March 1990"
//   service_interest (string, optional) — e.g. "Hair Extensions"

router.post("/yara-call/lead", async (req: Request, res: Response) => {
  const b = req.body as Record<string, unknown>;

  const name = str(b.name);
  const phone = str(b.phone);
  const email = str(b.email);
  const birthday = str(b.birthday);
  const serviceInterest = str(b.service_interest);

  if (!name) return res.status(400).json({ error: "name is required" });
  if (!phone) return res.status(400).json({ error: "phone is required" });

  try {
    const normPhone = normalizePhone(phone);
    const clientId = await findOrCreateClient(normPhone, name, undefined, undefined);

    const noteParts: string[] = [];
    if (email) noteParts.push(`Email: ${email}`);
    if (birthday) noteParts.push(`Birthday: ${birthday}`);
    if (serviceInterest) noteParts.push(`Interested in: ${serviceInterest}`);
    const notes = noteParts.length > 0 ? noteParts.join("\n") : undefined;

    const [lead] = await db
      .insert(appointmentsTable)
      .values({
        clientId,
        clientName: name,
        clientPhone: normPhone,
        service: serviceInterest ?? "Consultation",
        status: "lead",
        source: "yara-call",
        scheduledAt: new Date(),
        notes,
      })
      .returning({ id: appointmentsTable.id });

    logger.info({ lead_id: lead.id, phone: normPhone, serviceInterest }, "yara-call: lead captured");
    return res.status(201).json({ ok: true, lead_id: lead.id });
  } catch (err) {
    logger.error({ err: (err as Error).message }, "yara-call: lead creation failed");
    return res.status(500).json({ error: "Failed to create lead" });
  }
});

// ── POST /api/yara-call/book ──────────────────────────────────────────────────
//
// ElevenLabs server-side webhook — called by the Yara agent during a live call
// when the client confirms their booking details.
//
// Called by ElevenLabs servers mid-conversation with a static x-admin-token
// header injected in the tool config at sync time. This prevents arbitrary
// public writes to the booking endpoint.
//
// Body (sent by ElevenLabs tool call):
//   name         (string, required)  — client full name
//   phone        (string, required)  — client phone number
//   service      (string, required)  — service confirmed by client
//   branch       (string, required)  — branch name or "TBD"
//   scheduled_at (string, required)  — ISO datetime, descriptive text, or "TBD"
//   notes        (string, optional)  — any extra context from the conversation
//
// Returns:
//   { success: true, appointment_id: number, message: string }

router.post("/yara-call/book", async (req: Request, res: Response) => {
  // ── Auth: verify the static token ElevenLabs sends in the tool header ──────
  const expectedToken = ADMIN_TOKEN;
  const providedToken =
    typeof req.headers["x-admin-token"] === "string" ? req.headers["x-admin-token"] : "";
  if (!expectedToken || providedToken !== expectedToken) {
    logger.warn({ ip: req.ip }, "yara-call/book: unauthorized request rejected");
    return res.status(401).json({ success: false, error: "Unauthorized" });
  }

  const b = req.body as Record<string, unknown>;

  const name = str(b.name);
  const phone = str(b.phone);
  const service = str(b.service);
  const branch = str(b.branch);
  const scheduledAtRaw = str(b.scheduled_at);
  const extraNotes = str(b.notes);

  if (!name) return res.status(400).json({ success: false, error: "name is required" });
  if (!phone) return res.status(400).json({ success: false, error: "phone is required" });
  if (!service) return res.status(400).json({ success: false, error: "service is required" });
  if (!branch) return res.status(400).json({ success: false, error: "branch is required (pass 'TBD' if undecided)" });
  if (!scheduledAtRaw) return res.status(400).json({ success: false, error: "scheduled_at is required (pass 'TBD' if undecided)" });

  // ── Parse scheduled_at ─────────────────────────────────────────────────────
  // All Yara-created bookings use status = "pending" so staff can review.
  // • Valid ISO string → use as scheduledAt, preserve exact time
  // • Descriptive text (e.g. "Saturday morning") → save verbatim in notes, scheduledAt = now
  // • "TBD" → note it, scheduledAt = now
  // scheduledAt = now for unresolved times avoids inventing a fake future date.
  const noteParts: string[] = [];
  if (extraNotes) noteParts.push(extraNotes);

  let scheduledAt: Date;

  if (scheduledAtRaw.toUpperCase() !== "TBD") {
    const parsed = new Date(scheduledAtRaw);
    if (!isNaN(parsed.getTime())) {
      scheduledAt = parsed;
    } else {
      // Natural language — preserve verbatim in notes, use current time as placeholder
      noteParts.push(`Requested time: ${scheduledAtRaw}`);
      scheduledAt = new Date();
    }
  } else {
    // Explicit TBD
    noteParts.push("Requested time: TBD");
    scheduledAt = new Date();
  }

  const status = "pending";
  const notes = noteParts.length > 0 ? noteParts.join("\n") : undefined;

  try {
    const normPhone = normalizePhone(phone);
    const clientId = await findOrCreateClient(normPhone, name, undefined, branch);

    const [appt] = await db
      .insert(appointmentsTable)
      .values({
        clientId,
        clientName: name,
        clientPhone: normPhone,
        service,
        branch,
        scheduledAt,
        status,
        source: "yara-call",
        notes,
      })
      .returning();

    logger.info(
      { appointment_id: appt.id, phone: normPhone, service, branch, status, scheduled_at: appt.scheduledAt },
      "yara-call: booking saved",
    );

    // Notify the team via WhatsApp
    void notifyTeam({
      type: "appointment_action",
      action: "confirmed",
      appointmentId: appt.id,
      clientName: name,
      clientPhone: normPhone,
      service,
      branch: branch ?? undefined,
      scheduledAt: appt.scheduledAt instanceof Date ? appt.scheduledAt.toISOString() : String(appt.scheduledAt),
    }).catch(() => {});

    // Show the confirmed date only when Yara provided a parseable ISO datetime.
    // For TBD / natural-language inputs the scheduledAt is set to now() — don't surface that.
    const hasSpecificTime = Boolean(
      scheduledAtRaw && scheduledAtRaw.toUpperCase() !== "TBD" && !isNaN(new Date(scheduledAtRaw).getTime()),
    );
    const timeText = hasSpecificTime
      ? `on ${appt.scheduledAt instanceof Date ? appt.scheduledAt.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" }) : String(appt.scheduledAt)}`
      : "— our team will call to confirm the time";

    // Mirror into the shared Google Calendar (no-op unless configured).
    void createBookingEvent({
      clientName: name,
      clientPhone: normPhone,
      service,
      branch,
      scheduledAt: appt.scheduledAt instanceof Date ? appt.scheduledAt : null,
      hasSpecificTime,
      notes,
    }).catch(() => {});

    return res.json({
      success: true,
      appointment_id: appt.id,
      message: `Booking confirmed for ${name} — ${service} at ${branch ?? "TransforM Egypt"} ${timeText}. Reference: #${appt.id}.`,
    });
  } catch (err) {
    logger.error({ err: (err as Error).message }, "yara-call: booking save failed");
    return res.status(500).json({ success: false, error: "Failed to save booking. Please try WhatsApp instead." });
  }
});

// ── GET /api/yara-call/status ─────────────────────────────────────────────────

router.get("/yara-call/status", (_req: Request, res: Response) => {
  return res.json({
    configured: Boolean(ELEVENLABS_API_KEY && ELEVENLABS_AGENT_ID),
  });
});

// ── YARA_TURN_CONFIG ──────────────────────────────────────────────────────────
// Turn-detection settings that prevent Yara from cutting off mid-sentence.
// Applied on every deploy via syncYaraPrompt() and via the admin sync-prompt route.
//
// turn_timeout: 15s  (was 10) — silence budget before Yara responds; prevents
//                               cut-offs when the caller pauses mid-sentence.
// turn_eagerness: "patient"   — least aggressive turn-grab; valid values:
//                               "patient" | "normal" | "eager"
// speculative_turn: false     — don't predict end-of-turn from partial audio
//                               (was true; primary cause of mid-sentence cut-offs).
//                               Note: ElevenLabs API currently ignores this field
//                               in PATCH — disable manually in ElevenLabs dashboard
//                               → Agent → Turn Detection → Speculative Turn: OFF.
// silence_end_of_speech_delay_milliseconds: 1500 — additional silence buffer
//                               (1.5 s) before treating a pause as end of turn.
export const YARA_TURN_CONFIG = {
  turn_timeout: 15,
  turn_eagerness: "patient",
  speculative_turn: false,
  silence_end_of_speech_delay_milliseconds: 1500,
} as const;

// ── YARA_TTS_CONFIG ─────────────────────────────────────────────────────────
// Higher stability + similarity makes the Arabic voice far more consistent and
// avoids the "Arabic greeting then gibberish" artefact that low stability +
// mixed-script text produces. Applied on every sync via buildAgentPatchPayload.
//   stability 0.85       — steadier prosody (less random drift on Arabic phonemes)
//   similarity_boost 0.95 — stays close to the reference voice
//   speed 1.0            — natural pace
export const YARA_TTS_CONFIG = {
  stability: 0.85,
  similarity_boost: 0.95,
  speed: 1.0,
} as const;

// ── buildBookToolConfig ───────────────────────────────────────────────────────
// Builds the ElevenLabs standalone tool definition for the book_appointment webhook.
// adminToken is injected as a request header so the endpoint can verify the caller.
// Called dynamically so the token value is always current.
//
// branch and scheduled_at are marked required so the LLM must provide them —
// the prompt already instructs Yara to collect these before calling the tool,
// with "TBD" as the explicit fallback for undecided times/branches.

function buildBookToolConfig(adminToken: string) {
  return {
    type: "webhook" as const,
    name: "book_appointment",
    description:
      "Call this tool as soon as the client has confirmed their service, branch, and preferred date/time. " +
      "It saves the booking to the TransforM Egypt system and notifies the team. " +
      "Always call it before ending the call when a booking has been agreed.",
    api_schema: {
      url: "https://transform-egypt.com/api/yara-call/book",
      method: "POST" as const,
      request_headers: { "x-admin-token": adminToken },
      request_body_schema: {
        type: "object" as const,
        description: "Confirmed booking details from the client",
        properties: {
          name: {
            type: "string" as const,
            description: "Client's full name (from the intake form)",
          },
          phone: {
            type: "string" as const,
            description: "Client's phone number (from the intake form)",
          },
          service: {
            type: "string" as const,
            description: "The service the client has confirmed, e.g. 'tape-in hair extensions' or 'microblading'",
          },
          branch: {
            type: "string" as const,
            description:
              "Branch name: 'City Stars Mall', 'Cairo Festival City Mall', or 'Sofitel Hotel'. Never a closed branch. If the client truly cannot decide, pass 'TBD'.",
          },
          scheduled_at: {
            type: "string" as const,
            description:
              "ISO 8601 datetime string (e.g. '2025-05-24T15:00:00') if a specific time was agreed, " +
              "or a short description like 'Saturday morning', or 'TBD' if the client could not decide.",
          },
          notes: {
            type: "string" as const,
            description: "Any additional context from the call, e.g. hair length, colour preferences, allergies.",
          },
        },
        required: ["name", "phone", "service", "branch", "scheduled_at"],
      },
    },
  };
}

// ── ensureBookingTool ─────────────────────────────────────────────────────────
// Upserts the book_appointment standalone tool in the ElevenLabs workspace.
// Returns the tool ID to be linked via agent.prompt.tool_ids.
//
// Strategy:
//   1. GET /v1/convai/tools — look for an existing "book_appointment" tool
//   2. If found AND api_schema.url matches → return existing ID (no-op)
//   3. If found but URL differs → PATCH the tool with the latest config
//   4. If not found → POST to create a new tool, return the new ID

async function ensureBookingTool(apiKey: string, adminToken: string): Promise<string | null> {
  const toolConfig = buildBookToolConfig(adminToken);
  try {
    // 1. List all workspace tools
    const listRes = await fetch("https://api.elevenlabs.io/v1/convai/tools", {
      headers: { "xi-api-key": apiKey },
    });
    if (!listRes.ok) {
      logger.warn({ status: listRes.status }, "yara-call: ensureBookingTool — list tools failed");
      return null;
    }
    const listData = (await listRes.json()) as {
      tools?: Array<{ id: string; tool_config?: { name?: string; api_schema?: { url?: string } } }>;
    };

    const existing = (listData.tools ?? []).find(
      (t) => t.tool_config?.name === toolConfig.name,
    );

    if (existing) {
      // Always PATCH to keep the auth header and schema current
      const patchRes = await fetch(`https://api.elevenlabs.io/v1/convai/tools/${existing.id}`, {
        method: "PATCH",
        headers: { "xi-api-key": apiKey, "Content-Type": "application/json" },
        body: JSON.stringify({ tool_config: toolConfig }),
      });
      if (!patchRes.ok) {
        logger.warn({ status: patchRes.status }, "yara-call: ensureBookingTool — PATCH failed");
        return existing.id; // fall back to existing ID even if update failed
      }
      logger.info({ tool_id: existing.id }, "yara-call: ensureBookingTool — tool updated");
      return existing.id;
    }

    // 2. Create new tool
    const createRes = await fetch("https://api.elevenlabs.io/v1/convai/tools", {
      method: "POST",
      headers: { "xi-api-key": apiKey, "Content-Type": "application/json" },
      body: JSON.stringify({ tool_config: toolConfig }),
    });
    if (!createRes.ok) {
      const body = await createRes.text();
      logger.warn({ status: createRes.status, body }, "yara-call: ensureBookingTool — POST failed");
      return null;
    }
    const created = (await createRes.json()) as { id: string };
    logger.info({ tool_id: created.id }, "yara-call: ensureBookingTool — tool created");
    return created.id;
  } catch (err) {
    logger.warn({ err: (err as Error).message }, "yara-call: ensureBookingTool threw");
    return null;
  }
}

// ── buildAgentPatchPayload ────────────────────────────────────────────────────
// Shared helper — returns the single PATCH body used by both the admin route
// and the startup syncYaraPrompt call. Keeps both paths identical.

async function buildAgentPatchPayload(bookingToolId: string | null) {
  return {
    conversation_config: {
      agent: {
        prompt: {
          prompt: await buildYaraSystemPrompt(),
          ...(bookingToolId ? { tool_ids: [bookingToolId] } : {}),
        },
      },
      turn: YARA_TURN_CONFIG,
      tts: YARA_TTS_CONFIG,
    },
  };
}

// ── verifyAgentConfig ─────────────────────────────────────────────────────────
// Re-fetches the live agent config after PATCH and asserts that every writable
// field matches the expected value. Returns null on network/parse error.
//
// Known read-only fields (ElevenLabs API silently ignores them in PATCH):
//   speculative_turn, silence_end_of_speech_delay_milliseconds
// These are excluded from mismatch checks but still reported for visibility.

interface AgentVerification {
  prompt_chars: number;
  turn_timeout: number;
  turn_eagerness: string;
  speculative_turn: boolean;
  silence_delay_ms: number | null;
  has_identity_rule: boolean;
  has_pronunciation_guide: boolean;
  has_booking_tool_section: boolean;
  booking_tool_linked: boolean;
  booking_tool_id: string | null;
  mismatches: string[];
}

async function verifyAgentConfig(
  apiKey: string,
  agentId: string,
  expectedBookingToolId: string | null,
): Promise<AgentVerification | null> {
  try {
    const res = await fetch(
      `https://api.elevenlabs.io/v1/convai/agents/${agentId}`,
      { headers: { "xi-api-key": apiKey } },
    );
    if (!res.ok) return null;
    const d = await res.json() as {
      conversation_config?: {
        agent?: {
          prompt?: {
            prompt?: string;
            tool_ids?: string[];
          };
        };
        turn?: {
          turn_timeout?: number;
          turn_eagerness?: string;
          speculative_turn?: boolean;
          silence_end_of_speech_delay_milliseconds?: number;
        };
      };
    };
    const prompt = d?.conversation_config?.agent?.prompt?.prompt ?? "";
    const toolIds = d?.conversation_config?.agent?.prompt?.tool_ids ?? [];
    const turn = d?.conversation_config?.turn ?? {};

    const turn_timeout = turn.turn_timeout ?? -1;
    const turn_eagerness = turn.turn_eagerness ?? "unknown";
    const has_identity_rule = prompt.includes("CRITICAL \u2014 Identity rule");
    const has_pronunciation_guide = prompt.includes("## Pronunciation guide");
    const has_booking_tool_section = prompt.includes("## Booking tool");
    const booking_tool_linked = expectedBookingToolId ? toolIds.includes(expectedBookingToolId) : toolIds.length > 0;
    const booking_tool_id = toolIds[0] ?? null;

    const mismatches: string[] = [];
    if (turn_timeout !== YARA_TURN_CONFIG.turn_timeout) {
      mismatches.push(`turn_timeout: got ${turn_timeout}, want ${YARA_TURN_CONFIG.turn_timeout}`);
    }
    if (turn_eagerness !== YARA_TURN_CONFIG.turn_eagerness) {
      mismatches.push(`turn_eagerness: got "${turn_eagerness}", want "${YARA_TURN_CONFIG.turn_eagerness}"`);
    }
    if (!has_identity_rule) {
      mismatches.push("prompt missing CRITICAL identity rule section");
    }
    if (!has_pronunciation_guide) {
      mismatches.push("prompt missing Pronunciation guide section");
    }
    if (!has_booking_tool_section) {
      mismatches.push("prompt missing Booking tool section");
    }
    if (prompt.length < 4000) {
      mismatches.push(`prompt too short: ${prompt.length} chars (expected ≥ 4000)`);
    }
    if (expectedBookingToolId && !booking_tool_linked) {
      mismatches.push(`booking tool ${expectedBookingToolId} not linked to agent`);
    }

    return {
      prompt_chars: prompt.length,
      turn_timeout,
      turn_eagerness,
      speculative_turn: turn.speculative_turn ?? true,
      silence_delay_ms: turn.silence_end_of_speech_delay_milliseconds ?? null,
      has_identity_rule,
      has_pronunciation_guide,
      has_booking_tool_section,
      booking_tool_linked,
      booking_tool_id,
      mismatches,
    };
  } catch {
    return null;
  }
}

// ── POST /api/yara-call/sync-prompt ──────────────────────────────────────────
//
// Applies YARA_SYSTEM_PROMPT + YARA_TURN_CONFIG + book_appointment tool to the
// ElevenLabs agent. Idempotent — safe to call multiple times. Requires Admin token.
// Re-fetches after PATCH to verify changes were applied — returns 502 if
// re-fetch fails or any writable field doesn't match expected value.
//   curl -X POST /api/yara-call/sync-prompt -H "Authorization: Bearer <ADMIN_TOKEN>"

router.post("/yara-call/sync-prompt", async (req: Request, res: Response) => {
  const authHeader = req.headers.authorization ?? "";
  if (!ADMIN_TOKEN || authHeader !== `Bearer ${ADMIN_TOKEN}`) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  if (!ELEVENLABS_API_KEY || !ELEVENLABS_AGENT_ID) {
    return res.status(503).json({ error: "ElevenLabs credentials not configured" });
  }

  // Ensure the booking tool exists as a standalone resource and get its ID.
  // Hard-fail: if the tool cannot be created/found the agent cannot save bookings —
  // there is no point reporting a successful sync.
  const bookingToolId = await ensureBookingTool(ELEVENLABS_API_KEY, ADMIN_TOKEN);
  if (!bookingToolId) {
    logger.error("yara-call: sync-prompt — could not ensure booking tool");
    return res.status(502).json({ error: "Could not create/find book_appointment tool in ElevenLabs workspace" });
  }
  logger.info({ bookingToolId }, "yara-call: sync-prompt — booking tool ready");

  try {
    const patchRes = await fetch(
      `https://api.elevenlabs.io/v1/convai/agents/${ELEVENLABS_AGENT_ID}`,
      {
        method: "PATCH",
        headers: {
          "xi-api-key": ELEVENLABS_API_KEY,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(await buildAgentPatchPayload(bookingToolId)),
      },
    );

    if (!patchRes.ok) {
      const body = await patchRes.text();
      logger.error({ status: patchRes.status, body }, "yara-call: sync-prompt PATCH failed");
      return res.status(502).json({ error: "ElevenLabs PATCH failed", detail: body });
    }

    // Re-fetch and enforce — fail if verification is unreachable or has mismatches
    const verification = await verifyAgentConfig(ELEVENLABS_API_KEY, ELEVENLABS_AGENT_ID, bookingToolId);
    if (!verification) {
      logger.error("yara-call: sync-prompt — could not re-fetch agent config for verification");
      return res.status(502).json({ error: "PATCH applied but verification re-fetch failed" });
    }
    if (verification.mismatches.length > 0) {
      logger.error({ mismatches: verification.mismatches }, "yara-call: sync-prompt — config mismatch after PATCH");
      return res.status(502).json({ error: "Config mismatch after PATCH", mismatches: verification.mismatches, verification });
    }

    logger.info({ verification }, "yara-call: admin sync-prompt — all fields verified");
    return res.json({ ok: true, verification });
  } catch (err) {
    logger.error({ err: (err as Error).message }, "yara-call: sync-prompt threw");
    return res.status(500).json({ error: "Internal error" });
  }
});

// ── syncYaraPrompt ────────────────────────────────────────────────────────────
//
// Exported helper used by index.ts on every server startup.
// Applies YARA_SYSTEM_PROMPT + YARA_TURN_CONFIG + booking tool and verifies.
// Non-fatal — server starts even if ElevenLabs is unreachable.

export async function syncYaraPrompt(): Promise<boolean> {
  if (!ELEVENLABS_API_KEY || !ELEVENLABS_AGENT_ID) return false;
  try {
    const bookingToolId = ADMIN_TOKEN
      ? await ensureBookingTool(ELEVENLABS_API_KEY, ADMIN_TOKEN)
      : null;
    if (!bookingToolId) {
      // Skip the PATCH entirely — patching without tool_ids would silently remove
      // any existing tool linkage from the agent, breaking booking capture.
      logger.warn(
        "yara-call: startup sync — could not ensure booking tool; skipping agent PATCH to preserve existing tool linkage",
      );
      return false;
    }

    const patchRes = await fetch(
      `https://api.elevenlabs.io/v1/convai/agents/${ELEVENLABS_AGENT_ID}`,
      {
        method: "PATCH",
        headers: {
          "xi-api-key": ELEVENLABS_API_KEY,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(await buildAgentPatchPayload(bookingToolId)),
      },
    );
    if (!patchRes.ok) {
      logger.warn({ status: patchRes.status }, "yara-call: startup sync failed (non-fatal)");
      return false;
    }
    // Re-fetch and enforce — fail if verification is unreachable or has mismatches
    const verification = await verifyAgentConfig(ELEVENLABS_API_KEY, ELEVENLABS_AGENT_ID, bookingToolId);
    if (!verification) {
      logger.warn("yara-call: startup sync — could not re-fetch agent config for verification (non-fatal)");
      return false;
    }
    if (verification.mismatches.length > 0) {
      logger.warn({ mismatches: verification.mismatches }, "yara-call: startup sync — config mismatch after PATCH (non-fatal)");
      return false;
    }
    logger.info({ verification }, "yara-call: agent prompt + turn config + booking tool synced and verified on startup");
    return true;
  } catch (err) {
    logger.warn({ err: (err as Error).message }, "yara-call: startup sync threw (non-fatal)");
    return false;
  }
}

export default router;

// ─────────────────────────────────────────────────────────────────────────────
// Yara Chat — System Prompt Builder & Session Store
//
// Assembles the Yara AI personality + brand knowledge for the website chat
// widget. Keeps an in-memory conversation history per sessionId (ephemeral —
// wiped on server restart, never stored in DB by design).
// ─────────────────────────────────────────────────────────────────────────────

import { db } from "@workspace/db";
import { appointmentsTable, clientsTable } from "@workspace/db/schema";
import { eq, desc } from "drizzle-orm";
import { normalizePhone } from "./crm";
import { logger } from "./logger";

// ── In-memory session store ───────────────────────────────────────────────────
// Map<sessionId, { messages: ChatMessage[], lastActive: number }>
// Pruned after 30 minutes of inactivity to prevent memory leaks.

const SESSION_TTL_MS = 30 * 60 * 1000; // 30 minutes

export interface ChatMessage {
  role: "user" | "model";
  parts: [{ text: string }];
}

interface SessionData {
  messages: ChatMessage[];
  lastActive: number;
}

const sessions = new Map<string, SessionData>();

function pruneOldSessions() {
  const cutoff = Date.now() - SESSION_TTL_MS;
  for (const [id, data] of sessions) {
    if (data.lastActive < cutoff) sessions.delete(id);
  }
}

export function getSession(sessionId: string): ChatMessage[] {
  pruneOldSessions();
  return sessions.get(sessionId)?.messages ?? [];
}

export function appendToSession(sessionId: string, msg: ChatMessage): void {
  const existing = sessions.get(sessionId);
  if (existing) {
    existing.messages.push(msg);
    existing.lastActive = Date.now();
  } else {
    sessions.set(sessionId, { messages: [msg], lastActive: Date.now() });
  }
}

// ── Brand constants ───────────────────────────────────────────────────────────

const SERVICES_EN = `
HAIR EXTENSIONS:
- Nano Ring Extensions — from 4,500 EGP
- Tape-In Extensions — from 3,500 EGP
- Micro Ring Extensions — from 4,000 EGP
- Clip-In Extensions — from 2,500 EGP
- Keratin Bond Extensions — from 5,000 EGP
- Weft Extensions — from 3,000 EGP

LASH EXTENSIONS:
- Classic Lashes — from 600 EGP
- Volume Lashes — from 800 EGP
- Mega Volume Lashes — from 1,000 EGP
- Hybrid Lashes — from 700 EGP

EYEBROWS:
- Microblading — from 2,500 EGP
- Ombre Brows — from 2,000 EGP
- Nano Brows — from 2,800 EGP
- Brow Lamination — from 800 EGP

SKINCARE:
- HydraFacial — from 1,500 EGP
- Chemical Peels — from 1,000 EGP
- Laser Hair Removal — pricing on consultation
- LED Therapy — from 800 EGP

NAILS:
- Gel Manicure — from 400 EGP
- Gel Pedicure — from 500 EGP
- Nail Art — from 600 EGP
- Acrylic Extensions — from 700 EGP
`.trim();

const SERVICES_AR = `
إكستنشن الشعر:
- نانو رينج — من ٤٥٠٠ ج.م.
- تيب إن — من ٣٥٠٠ ج.م.
- مايكرو رينج — من ٤٠٠٠ ج.م.
- كليب إن — من ٢٥٠٠ ج.م.
- كيراتين بوند — من ٥٠٠٠ ج.م.
- ويفت — من ٣٠٠٠ ج.م.

رموش إكستنشن:
- كلاسيك — من ٦٠٠ ج.م.
- فوليوم — من ٨٠٠ ج.م.
- ميجا فوليوم — من ١٠٠٠ ج.م.
- هايبرد — من ٧٠٠ ج.م.

الحواجب:
- مايكروبليدينج — من ٢٥٠٠ ج.م.
- أومبري براوز — من ٢٠٠٠ ج.م.
- نانو براوز — من ٢٨٠٠ ج.م.
- براو لاميناشن — من ٨٠٠ ج.م.

العناية بالبشرة:
- هيدرافيشيال — من ١٥٠٠ ج.م.
- بيلينج — من ١٠٠٠ ج.م.
- ليزر إزالة الشعر — السعر عند الاستشارة
- LED ثيرابي — من ٨٠٠ ج.م.

الأظافر:
- مانيكير جل — من ٤٠٠ ج.م.
- باديكير جل — من ٥٠٠ ج.م.
- نيل ارت — من ٦٠٠ ج.م.
- أكريليك — من ٧٠٠ ج.م.
`.trim();

const BRANCHES_EN = `
OUR BRANCHES:
1. City Stars Mall — Ground floor, Gate 7, Cairo. Open daily 10 AM – 10 PM.
2. Sofitel Downtown — Lower level, Downtown Cairo. Open daily 10 AM – 10 PM.
3. O Mall — New Alamein, North Coast. Open daily 10 AM – 10 PM (seasonal).

Contact us: 01009780008 / 01004545700
WhatsApp: +201009780008
`.trim();

const BRANCHES_AR = `
فروعنا:
١. سيتي ستارز مول — الدور الأرضي، بوابة ٧، القاهرة. مفتوح يومياً ١٠ ص – ١٠ م.
٢. سوفيتيل داون تاون — الدور السفلي، وسط البلد. مفتوح يومياً ١٠ ص – ١٠ م.
٣. أوه مول — العلمين الجديدة، الساحل الشمالي. مفتوح يومياً ١٠ ص – ١٠ م (موسمي).

تواصلوا معنا: ٠١٠٠٩٧٨٠٠٠٨ / ٠١٠٠٤٥٤٥٧٠٠
واتساب: ‏+201009780008
`.trim();

// ── Client history lookup ─────────────────────────────────────────────────────

export interface ClientHistory {
  name: string | null;
  visitCount: number;
  lastVisit: Date | null;
  lastService: string | null;
  preferredBranch: string | null;
}

export async function lookupClientHistory(rawPhone: string): Promise<ClientHistory | null> {
  try {
    const phone = normalizePhone(rawPhone);
    const [client] = await db
      .select()
      .from(clientsTable)
      .where(eq(clientsTable.phone, phone))
      .limit(1);

    if (!client) return null;

    const [lastAppt] = await db
      .select({ service: appointmentsTable.service, scheduledAt: appointmentsTable.scheduledAt })
      .from(appointmentsTable)
      .where(eq(appointmentsTable.clientId, client.id))
      .orderBy(desc(appointmentsTable.scheduledAt))
      .limit(1);

    return {
      name: client.name,
      visitCount: client.visitCount,
      lastVisit: client.lastVisit,
      lastService: lastAppt?.service ?? null,
      preferredBranch: client.preferredBranch,
    };
  } catch (err) {
    logger.warn({ err: (err as Error).message }, "yara-chat: client lookup failed");
    return null;
  }
}

// ── System prompt builder ─────────────────────────────────────────────────────

export function buildSystemPrompt(params: {
  clientHistory?: ClientHistory | null;
  currentDate: string;
  isGreetingTrigger?: boolean;
}): string {
  const { clientHistory, currentDate, isGreetingTrigger } = params;

  let clientContext = "";
  if (clientHistory?.name) {
    const lastVisitStr = clientHistory.lastVisit
      ? new Date(clientHistory.lastVisit).toLocaleDateString("en-GB", { month: "long", year: "numeric" })
      : null;
    const greetingInstruction = isGreetingTrigger
      ? `The customer just shared their phone number. Greet them warmly by name RIGHT NOW — mention their last service and how long ago it was, then ask how you can help them today. Keep it to 2–3 sentences, warm and personal.`
      : `Greet this client warmly by name and mention their last service naturally in context.`;
    clientContext = `
RETURNING CLIENT PROFILE:
- Name: ${clientHistory.name}
- Visit count: ${clientHistory.visitCount}
- Last visit: ${lastVisitStr ?? "unknown"}
- Last service: ${clientHistory.lastService ?? "unknown"}
- Preferred branch: ${clientHistory.preferredBranch ?? "unknown"}

${greetingInstruction}
`.trim();
  } else if (isGreetingTrigger) {
    clientContext = `NEW_CUSTOMER_GREETING: The customer just shared their phone number but is not in our records yet. Welcome them warmly as a new guest and let them know you're here to help them explore our services or book an appointment. Keep it brief and inviting — 1–2 sentences.`;
  }

  return `You are Yara — TransforM Egypt's warm, professional, and luxurious AI beauty consultant. You represent the #1 hair extensions and beauty center in Egypt and the Middle East.

TODAY'S DATE: ${currentDate}

YOUR PERSONALITY:
- Warm, friendly, and professional — like a trusted friend who happens to be a beauty expert
- You speak with confidence and elegance, never pushy or salesy
- You detect whether the customer is writing in Arabic or English and respond in THE SAME LANGUAGE automatically
- In Arabic: use Egyptian colloquial Arabic (not formal), warm and welcoming
- In English: warm, professional, luxury-brand tone

YOUR CAPABILITIES:
1. Answer questions about services, pricing, branches, and hours
2. Help customers book appointments — collect: name, phone number, preferred service, preferred branch, preferred date and time
3. Recognize returning clients and personalize the conversation
4. Escalate to the human team when needed

${clientContext ? clientContext + "\n\n" : ""}SERVICES & PRICING:
${SERVICES_EN}

BRANCHES & HOURS:
${BRANCHES_EN}

BOOKING PROCESS:
To create a booking request, collect ALL of these from the customer:
1. Full name
2. Phone number (Egyptian mobile, e.g. 010xxxxxxxx)
3. Preferred service
4. Preferred branch (City Stars, Sofitel Downtown, or O Mall New Alamein)
5. Preferred date and time

Once you have all 5, respond with EXACTLY this JSON marker at the END of your message:
[BOOKING_READY:{"name":"...","phone":"...","service":"...","branch":"...","datetime":"..."}]

ESCALATION:
If the customer asks to speak to a human, complains about a bad experience, mentions a medical concern, asks for a refund, or you cannot answer their question, respond helpfully then add this marker at the end:
[ESCALATE:{"reason":"...","customerMessage":"..."}]

IMPORTANT RULES:
- Never make up prices or services not listed above
- Never promise specific appointment times — say "we'll confirm the exact time when our team reaches out"
- If asked about something outside your knowledge, suggest calling 01009780008 or WhatsApp +201009780008
- Keep responses concise and conversational — this is a chat widget, not an email
- Do NOT include markdown headers (##) or excessive bullet points — keep it natural

Arabic services info (use when responding in Arabic):
${SERVICES_AR}

Arabic branches info:
${BRANCHES_AR}`;
}

// ── Booking intent extraction ─────────────────────────────────────────────────

export interface BookingData {
  name: string;
  phone: string;
  service: string;
  branch: string;
  datetime: string;
}

export function extractBookingData(text: string): BookingData | null {
  const match = text.match(/\[BOOKING_READY:(\{[^}]+\})\]/s);
  if (!match || !match[1]) return null;
  try {
    const data = JSON.parse(match[1]) as Partial<BookingData>;
    if (data.name && data.phone && data.service && data.branch && data.datetime) {
      return data as BookingData;
    }
    return null;
  } catch {
    return null;
  }
}

// ── Escalation extraction ─────────────────────────────────────────────────────

export interface EscalationData {
  reason: string;
  customerMessage: string;
}

export function extractEscalationData(text: string): EscalationData | null {
  const match = text.match(/\[ESCALATE:(\{[^}]+\})\]/s);
  if (!match || !match[1]) return null;
  try {
    const data = JSON.parse(match[1]) as Partial<EscalationData>;
    return {
      reason: data.reason ?? "Customer requested human assistance",
      customerMessage: data.customerMessage ?? "",
    };
  } catch {
    return null;
  }
}

// ── Keyword-based escalation safety net ───────────────────────────────────────
// Backup detector for when the model doesn't emit the [ESCALATE:...] marker.
// Covers common English and Egyptian Arabic phrases requesting human help.

const ESCALATION_PATTERNS_EN = [
  /\b(speak|talk|chat)\s+(to|with)\s+(a\s+)?(human|person|agent|staff|someone|representative|manager|team)\b/i,
  /\b(real|actual|live)\s+(human|person|agent|support)\b/i,
  /\bneed\s+(human|a\s+person|real\s+help|to\s+speak)\b/i,
  /\b(connect|transfer)\s+(me\s+)?(to\s+)?(a\s+)?(human|agent|staff|manager)\b/i,
  /\bescalate\b/i,
  /\bsupport\s+ticket\b/i,
];

const ESCALATION_PATTERNS_AR = [
  /أريد?\s*(التحدث|الكلام)\s*(مع|إلى)\s*(إنسان|موظف|مسؤول|شخص|مدير)/,
  /تحدث?\s*(مع|إلى)\s*(إنسان|موظف|مسؤول|أحد)/,
  /محتاج?\s*(مساعدة\s*بشرية|موظف|مسؤول|أحد)/,
  /وصّلني?\s*(بـ?)?\s*(موظف|مسؤول|مدير)/,
  /عايز?\s*(أتكلم|أكلم|أحكي)\s*(مع)?\s*(حد|أحد|موظف|مسؤول)/,
  /فيه\s*(حد|أحد)\s*(بشري|إنساني)/,
];

export function detectEscalationKeywords(userMessage: string): EscalationData | null {
  const matchesEn = ESCALATION_PATTERNS_EN.some((p) => p.test(userMessage));
  const matchesAr = ESCALATION_PATTERNS_AR.some((p) => p.test(userMessage));
  if (!matchesEn && !matchesAr) return null;
  return {
    reason: "Customer requested human assistance (keyword trigger)",
    customerMessage: userMessage,
  };
}

// ── Clean response text ───────────────────────────────────────────────────────
// Remove the JSON markers from the text before sending to client

export function cleanResponseText(text: string): string {
  return text
    .replace(/\[BOOKING_READY:\{[^}]+\}\]/gs, "")
    .replace(/\[ESCALATE:\{[^}]+\}\]/gs, "")
    .trim();
}

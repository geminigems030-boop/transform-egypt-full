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

// All prices EGP. This MUST stay in sync with the authoritative price list
// used by the DM agent (lib/ai-reply.ts) and the voice agent (routes/yara-call.ts).
const SERVICES_EN = `
HAIR EXTENSIONS — Natural Human Hair (per 100g, applied strand-by-strand):
- Indian hair (straight): 60 cm — 11,000 | 70 cm — 12,000 | 80 cm — 13,000 | 90 cm — 14,000
- Russian hair — from 25,000
- Brazilian hair — from 15,000
- Turkish hair — from 20,000
- Curly or Blonde add-on: +2,000 on any type
- FREE TRIAL: try 1–2 strands free before committing

HAIR EXTENSIONS — Tape-In:
- Range 10,000–30,000 | Invisible Double Face 20,000 | Curly/Blonde +2,000
- Installation only (client brings their own hair): 4,000

HAIR REFILL (refilling fallen strands): 4,000 per 100g
MICRO-LINKS — from 30,000
WIGS — from 25,000
TOPPERS (for thinning areas / genetic hair loss) — from 8,000
HAIR TREATMENTS (keratin, botox, protein, scalp care) — from 2,000

LASHES:
- Classic 1,050 | 2D 1,300 | 3D 1,500 | Volume 1,800 | Mega Volume 2,100 | Fox Lashes 3,000

BROWS & PERMANENT MAKEUP:
- Microblading 1,900 (touch-up 1,150) | Lip Blushing 2,700 (touch-up 1,400)
- Brow Extensions 1,450 | Micropigmentation 3,800 per area

SKINCARE:
- Deep cleansing facial — from 1,500 | Dermapen 2,000 | Lifting face massage 1,000
- Dermaplaning 500 | Diamond Crystal 2,000 | Face wax 600
- Bundle (Skin Booster + Glutathione + 3rd treatment): 4,000 (each 1,500 separately)

NAILS:
- Hard gel & acrylic 1,500 (+extensions 1,500) | Nail treatment 300
- Gel color 350 | Gel removal 250 | Nail design 200
- Artificial nails from 450 | Hand manicure 300 | Foot pedicure 350
- Regular polish 150 | French 200

PAYMENT: Cash · Credit & debit cards · Installments — available on all services.
`.trim();

// الأسعار بالجنيه المصري — مطابقة لقائمة أسعار وكيل الرسائل (ai-reply.ts) ووكيل المكالمات.
const SERVICES_AR = `
إكستنشن الشعر — شعر طبيعي ١٠٠٪ (لكل ١٠٠ جرام، خصلة خصلة):
- شعر هندي (سادة): ٦٠ سم — 11,000 | ٧٠ سم — 12,000 | ٨٠ سم — 13,000 | ٩٠ سم — 14,000
- شعر روسي — يبدأ من 25,000
- شعر برازيلي — يبدأ من 15,000
- شعر تركي — يبدأ من 20,000
- إضافة كيرلي أو بلوند: +2,000 على أي نوع
- تجربة مجانية: جربي خصلة أو اتنين مجاناً قبل ما تقرري

إكستنشن تيب إن:
- من 10,000 لـ 30,000 | إنفيزيبل دابل فيس 20,000 | كيرلي/بلوند +2,000
- تركيب فقط (العميلة بتجيب شعرها): 4,000

تعبية / ريفيل (تعويض الخصل اللي وقعت): 4,000 لكل ١٠٠ جرام
ميكرو لينكس — يبدأ من 30,000
بواريك (ويج) — يبدأ من 25,000
توبر (للفراغات أو الصلع الوراثي) — يبدأ من 8,000
علاجات الشعر (كيراتين، بوتوكس، بروتين، عناية فروة الرأس) — تبدأ من 2,000

رموش:
- كلاسيك 1,050 | 2D 1,300 | 3D 1,500 | فوليوم 1,800 | ميجا فوليوم 2,100 | فوكس 3,000

الحواجب والميكب الدائم:
- مايكروبليدنج 1,900 (تتش أب 1,150) | توريد شفايف 2,700 (تتش أب 1,400)
- بروز (brow extensions) 1,450 | مايكروبيجمنتيشن 3,800 للمنطقة

العناية بالبشرة:
- تنظيف بشرة عميق — يبدأ من 1,500 | ديرما بين 2,000 | مساج شد للوجه 1,000
- ديرمابلانينج 500 | دايموند كريستال 2,000 | واكس وش 600
- باقة (سكين بوستر + جلوتاثيون + علاج تالت): 4,000 (كل واحد 1,500 لو لوحده)

الأظافر:
- هارد جل وأكريليك 1,500 (+تطويل 1,500) | علاج الأظافر 300
- لون جل 350 | إزالة الجل 250 | ديزاين 200
- تركيب أظافر صناعية من 450 | مانيكير يد 300 | باديكير قدم 350
- مانيكير عادي 150 | فرنش 200

طرق الدفع: كاش · كروت كريدت ودبت · تقسيط — متاح على كل الخدمات.
`.trim();

const BRANCHES_EN = `
OUR BRANCHES — currently open:
1. City Stars Mall, Nasr City — Ground floor, Gate 7, next to Cafe Supreme. Open daily from 12:00 noon.
2. Sofitel Hotel, Downtown Cairo — Lower level, next to Banque Misr. Open daily from 12:00 noon.
3. Cairo Festival City Mall (CFCM), New Cairo — 3rd Floor, next to Casper. Premium branch, open daily during mall hours.

TEMPORARILY CLOSED — do NOT offer these for bookings:
- O Mall, New Alamein
- Walk of Cairo, Sheikh Zayed
- Nile Ritz Hotel, Downtown

We are currently in Cairo only.
Contact us: 01009780008
WhatsApp: +201009780008
`.trim();

const BRANCHES_AR = `
فروعنا — مفتوحة حالياً:
١. سيتي ستارز مول، مدينة نصر — الدور الأرضي، بوابة ٧، جنب كافيه سوبريم. مفتوح يومياً من الساعة ١٢ الظهر.
٢. فندق سوفيتيل، وسط البلد — الدور السفلي، جنب بنك مصر. مفتوح يومياً من الساعة ١٢ الظهر.
٣. كايرو فستيفال سيتي مول (CFCM)، القاهرة الجديدة — الدور الثالث، جنب كاسبر. فرع بريميوم، مفتوح يومياً بمواعيد المول.

مقفولة مؤقتاً — متعرضيش الفروع دي للحجز:
- أوه مول، العلمين الجديدة
- ووك أوف كايرو، الشيخ زايد
- فندق نايل ريتز، وسط البلد

إحنا حالياً في القاهرة بس.
تواصلوا معنا: ٠١٠٠٩٧٨٠٠٠٨
واتساب: ‏+201009780008
`.trim();

// ── Client history lookup ─────────────────────────────────────────────────────

export interface ClientHistory {
  name: string | null;
  visitCount: number;
  totalSpend: number;
  lastVisit: Date | null;
  lastService: string | null;
  preferredBranch: string | null;
}

// ── Loyalty tiers ─────────────────────────────────────────────────────────────
// Derived live from visit count / spend — no stored column, so it's always
// accurate and needs no migration. Used to give returning clients VIP treatment.
export type LoyaltyTier = "new" | "regular" | "vip";

export function getLoyaltyTier(visitCount: number, totalSpend: number): LoyaltyTier {
  if (visitCount >= 5 || totalSpend >= 20000) return "vip";
  if (visitCount >= 2) return "regular";
  return "new";
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
      totalSpend: Number(client.totalSpend ?? 0),
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
  offersSection?: string;
}): string {
  const { clientHistory, currentDate, isGreetingTrigger, offersSection } = params;

  let clientContext = "";
  if (clientHistory?.name) {
    const lastVisitStr = clientHistory.lastVisit
      ? new Date(clientHistory.lastVisit).toLocaleDateString("en-GB", { month: "long", year: "numeric" })
      : null;
    const greetingInstruction = isGreetingTrigger
      ? `The customer just shared their phone number. Greet them warmly by name RIGHT NOW — mention their last service and how long ago it was, then ask how you can help them today. Keep it to 2–3 sentences, warm and personal.`
      : `Greet this client warmly by name and mention their last service naturally in context.`;
    const tier = getLoyaltyTier(clientHistory.visitCount, clientHistory.totalSpend);
    const loyaltyInstruction =
      tier === "vip"
        ? `LOYALTY: This is a VIP client (5+ visits or high spend). Give them special VIP treatment — recognise their loyalty warmly, offer priority booking and a complimentary consultation, and make them feel valued. Do NOT invent monetary discounts or offers that aren't in the knowledge base.`
        : tier === "regular"
          ? `LOYALTY: This is a returning regular client. Acknowledge that it's lovely to see them again and treat them with extra warmth and familiarity.`
          : "";
    clientContext = `
RETURNING CLIENT PROFILE:
- Name: ${clientHistory.name}
- Loyalty tier: ${tier.toUpperCase()}
- Visit count: ${clientHistory.visitCount}
- Last visit: ${lastVisitStr ?? "unknown"}
- Last service: ${clientHistory.lastService ?? "unknown"}
- Preferred branch: ${clientHistory.preferredBranch ?? "unknown"}

${greetingInstruction}${loyaltyInstruction ? "\n" + loyaltyInstruction : ""}
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

${offersSection ? offersSection + "\n\n" : "OFFERS: There are no active offers right now. Never invent or imply any discount or deal — if asked, say prices are fixed and offer to help pick the best option.\n\n"}BOOKING PROCESS:
To create a booking request, collect ALL of these from the customer:
1. Full name
2. Phone number (Egyptian mobile, e.g. 010xxxxxxxx)
3. Preferred service
4. Preferred branch (City Stars Mall, Sofitel Downtown, or Cairo Festival City Mall — these are the branches open now; never book a closed branch)
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

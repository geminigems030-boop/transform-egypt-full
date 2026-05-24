// ─────────────────────────────────────────────────────────────────────────────
// AI Outreach Copy Generator — personalized re-engagement messages
// Uses the same Anthropic client as ai-reply.ts but with a different
// system prompt tuned for cold/warm lead re-engagement.
// ─────────────────────────────────────────────────────────────────────────────

import Anthropic from "@anthropic-ai/sdk";
import { detectLanguage } from "./ai-reply";
import { logger } from "./logger";
import type { SegmentedLead } from "./lead-segmentation";

export interface OutreachCopy {
  subject?: string; // for email
  body: string; // for email body or DM text
  callToAction: string;
  language: "ar" | "en";
}

// System prompt for re-engagement outreach — shorter and punchier than
// the full Yara persona because these are outbound, not conversational.
const OUTREACH_SYSTEM_PROMPT_EN = `You are Yara from TransforM Egypt, a luxury hair & beauty salon in Cairo.

Write a SHORT, warm re-engagement message to a potential customer who showed interest but never booked.

RULES:
- Max 2 short paragraphs. No bullet lists. No markdown. No emojis.
- Warm and personal — never generic "Dear Customer".
- Mention their specific interest if known (e.g. "hair extensions", "lash extensions", "microblading").
- Include a clear CTA with a link.
- End with your name: Yara

LINKS to include naturally:
- Book: https://transform-egypt.com/book
- Try-On: https://transform-egypt.com/try-on
- WhatsApp: https://wa.me/201009780008
- Boutique: https://transform-egypt.com/boutique

PRICING to mention only if asked or relevant:
- Hair extensions from 11,000 EGP per 100g
- Lashes from 1,050 EGP
- Microblading 1,900 EGP
- Free consultation + free trial strand`;

const OUTREACH_SYSTEM_PROMPT_AR = `أنتي يارا من TransforM Egypt — صالون ترانسفورميشن فاخر في القاهرة.

اكتبي رسالة قصيرة ودافئة لعميل بتاستكشف عن خدماتنا ولسه ما حجز.

قواعد:
- ماكس فقراتين قصارين. ما فيش قوائم. ما فيش توقعات. ما فيش علامات ماركداون.
- دونة يا فندم. وارفق بأسماءهم اذا كان موجود.
- إشار لاهتمامهم المحدد (مثل: اكستنشن شعر، رموش، مايكروبليدنج) إذا كان محدد.
- اضم دعوة واضحة للحجز مع رابط.
- النهاية: يارا ٠١٠٠٩٧٨٠٠٠٨

الأسعار إذا كانت مهمة:
- اكستنشن شعر من 11,000 جنيه
- رموش من 1,050 جنيه
- مايكروبليدنج 1,900 جنيه
- استشارة وتجريبة مجانية

الروابط:
- احجزي: https://transform-egypt.com/book
- جربي AI: https://transform-egypt.com/try-on
- واتساب: https://wa.me/201009780008`;

export async function generateOutreachCopy(
  lead: SegmentedLead,
  channel: "email" | "dm",
): Promise<OutreachCopy> {
  const language = lead.language ?? "en";
  const isAr = language === "ar" || detectLanguage(lead.reason) === "ar";

  const systemPrompt = isAr ? OUTREACH_SYSTEM_PROMPT_AR : OUTREACH_SYSTEM_PROMPT_EN;

  const prompt = buildPrompt(lead, channel, isAr);

  try {
    const anthropic = new Anthropic({
      baseURL: process.env["AI_INTEGRATIONS_ANTHROPIC_BASE_URL"],
      apiKey: process.env["AI_INTEGRATIONS_ANTHROPIC_API_KEY"] || "",
    });
    const result = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 500,
      temperature: 0.7,
      system: systemPrompt,
      messages: [{ role: "user", content: prompt }],
    });

    const text = result.content
      .filter((c) => c.type === "text")
      .map((c) => c.text)
      .join("\n");

    return parseOutreachResponse(text, channel, isAr ? "ar" : "en");
  } catch (err) {
    logger.error({ err: (err as Error).message, leadId: lead.sourceId }, "ai-outreach: generation failed");
    // Fallback to generic copy
    return getFallbackCopy(lead, channel, isAr ? "ar" : "en");
  }
}

function buildPrompt(lead: SegmentedLead, channel: "email" | "dm", isAr: boolean): string {
  const parts: string[] = [];
  parts.push(`Segment: ${lead.segment}`);
  parts.push(`Last contact: ${lead.lastContactDate?.toDateString() ?? "unknown"}`);
  parts.push(`Interest: ${lead.service ?? lead.quizGoal ?? "general beauty services"}`);
  if (lead.quizHair) parts.push(`Hair type: ${lead.quizHair}`);
  if (lead.message) parts.push(`Original message: ${lead.message.slice(0, 200)}`);
  parts.push(`Score: ${lead.score}/100 (higher = more engaged)`);
  parts.push(`Channel: ${channel} (${channel === "email" ? "email with subject line" : "DM text"})`);

  if (isAr) {
    parts.push(`\nاكتبي الرسالة. أندها بأسم العميل ورابط واضح. ما فيش توقعات.`);
  } else {
    parts.push(`\nWrite the message. Start with their name if known. Include a link. End with "Yara".`);
  }

  return parts.join("\n");
}

function parseOutreachResponse(text: string, channel: "email" | "dm", lang: "ar" | "en"): OutreachCopy {
  if (channel === "email") {
    // Try to extract subject line
    const subjectMatch = text.match(/(?:Subject|subject):\s*(.+)/);
    const subject = subjectMatch?.[1]?.trim();

    // Remove subject line from body
    const body = text
      .replace(/(?:Subject|subject):\s*.+\n?/i, "")
      .trim();

    const cta = extractCta(body, lang);

    return {
      subject: subject ?? (lang === "ar" ? "فرصة جديدة من TransforM" : "A new look is waiting for you ✨"),
      body,
      callToAction: cta,
      language: lang,
    };
  }

  return {
    body: text.trim(),
    callToAction: extractCta(text, lang),
    language: lang,
  };
}

function extractCta(text: string, lang: "ar" | "en"): string {
  const urlMatch = text.match(/https?:\/\/[^\s]+/);
  if (urlMatch) return urlMatch[0];
  return lang === "ar"
    ? "https://transform-egypt.com/book"
    : "https://transform-egypt.com/book";
}

function getFallbackCopy(lead: SegmentedLead, channel: "email" | "dm", lang: "ar" | "en"): OutreachCopy {
  const name = lead.name ?? (lang === "ar" ? "فندم" : "there");
  const service = lead.service ?? (lang === "ar" ? "ترانسفورميشن" : "transformation");

  if (lang === "ar") {
    const body = `أهلاً يا ${name} 💛

من فترة كنتِ بتستكشفي ${service} عند TransforM — بس لسة متحجزتيش. عندنا فرص حلوة النهاردة:

جربي AI: شوفي شكلك قبل ما تحجزي → https://transform-egypt.com/try-on
احجزي استشارة مجانية → https://transform-egypt.com/book

01009780008 — يارا`;
    return {
      subject: channel === "email" ? "فرصة جديدة من TransforM ✨" : undefined,
      body,
      callToAction: "https://transform-egypt.com/try-on",
      language: "ar",
    };
  }

  const body = `Hi ${name} 💛

A while ago you were exploring ${service} at TransforM — but haven't booked yet. We have something exciting today:

Try our AI preview: see your look before you book → https://transform-egypt.com/try-on
Book a free consultation → https://transform-egypt.com/book

01009780008 — Yara`;
  return {
    subject: channel === "email" ? "A new look is waiting for you ✨" : undefined,
    body,
    callToAction: "https://transform-egypt.com/try-on",
    language: "en",
  };
}

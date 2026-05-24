// ─────────────────────────────────────────────────────────────────────────────
// WhatsApp Automation Message Templates — TransforM Egypt
// All templates have Arabic (default) and English variants.
// Template selection uses the client's preferred language (default: Arabic).
// ─────────────────────────────────────────────────────────────────────────────

export type Lang = "ar" | "en";

export interface ReminderVars {
  name: string;
  service: string;
  branch: string;
  time: string;
}

export interface FollowupVars {
  name: string;
  reviewLink: string;
}

export interface ReengagementVars {
  name: string;
  lastService: string;
  bookingLink: string;
}

export interface TestVars {
  eventType: string;
}

function fmt(name: string): string {
  return name ? name.split(" ")[0] : "عزيزتنا";
}

export function reminder24hMessage(vars: ReminderVars, lang: Lang = "ar"): string {
  const first = fmt(vars.name);
  if (lang === "en") {
    return [
      `Hi ${first}! 🌸`,
      ``,
      `Just a reminder that your *${vars.service}* appointment at *${vars.branch}* is *tomorrow at ${vars.time}*.`,
      ``,
      `Reply *YES* to confirm or *NO* if you need to reschedule.`,
      ``,
      `— TransforM Egypt`,
    ].join("\n");
  }
  return [
    `أهلاً ${first}! 🌸`,
    ``,
    `نذكّرك بموعدك لـ *${vars.service}* في فرع *${vars.branch}* غداً الساعة *${vars.time}*.`,
    ``,
    `رُدّي بـ *نعم* لتأكيد موعدك، أو *لا* إذا احتجتِ إلى إعادة الجدولة.`,
    ``,
    `— ترانسفورم إيجيبت`,
  ].join("\n");
}

export function reminder2hMessage(vars: ReminderVars, lang: Lang = "ar"): string {
  const first = fmt(vars.name);
  if (lang === "en") {
    return [
      `See you soon, ${first}! 🌸`,
      ``,
      `Your *${vars.service}* appointment at *${vars.branch}* is in *2 hours* (${vars.time}).`,
      ``,
      `We can't wait to see you! ✨`,
      ``,
      `— TransforM Egypt`,
    ].join("\n");
  }
  return [
    `نراكِ قريباً ${first}! 🌸`,
    ``,
    `موعدك لـ *${vars.service}* في فرع *${vars.branch}* بعد *ساعتين* (الساعة ${vars.time}).`,
    ``,
    `نتطلع لرؤيتك! ✨`,
    ``,
    `— ترانسفورم إيجيبت`,
  ].join("\n");
}

export function followupMessage(vars: FollowupVars, lang: Lang = "ar"): string {
  const first = fmt(vars.name);
  if (lang === "en") {
    return [
      `Hi ${first}! 💛`,
      ``,
      `How are you loving your new look? We hope you're feeling amazing! ✨`,
      ``,
      `We'd be so grateful if you left us a quick Google review — it only takes a minute and means the world to us:`,
      `${vars.reviewLink}`,
      ``,
      `Thank you so much! 🙏`,
      ``,
      `— TransforM Egypt`,
    ].join("\n");
  }
  return [
    `أهلاً ${first}! 💛`,
    ``,
    `كيف تحبّين إطلالتكِ الجديدة؟ نأمل أنكِ تشعرين بالروعة! ✨`,
    ``,
    `سنكون ممتنين جداً لو تركتِ لنا تقييماً على Google — يستغرق دقيقة فقط ويعني لنا الكثير:`,
    `${vars.reviewLink}`,
    ``,
    `شكراً جزيلاً! 🙏`,
    ``,
    `— ترانسفورم إيجيبت`,
  ].join("\n");
}

export function reengagementMessage(vars: ReengagementVars, lang: Lang = "ar"): string {
  const first = fmt(vars.name);
  if (lang === "en") {
    return [
      `Hi ${first}! 💕`,
      ``,
      `We miss you at TransforM Egypt! It's been a while since your *${vars.lastService}* — would you like to book a touch-up?`,
      ``,
      `Book your appointment here: ${vars.bookingLink}`,
      ``,
      `We'd love to see you again! 🌸`,
      ``,
      `— TransforM Egypt`,
    ].join("\n");
  }
  return [
    `أهلاً ${first}! 💕`,
    ``,
    `نفتقدكِ في ترانسفورم إيجيبت! مرّ وقت منذ *${vars.lastService}* — هل تودّين حجز موعد للاهتمام بإطلالتك؟`,
    ``,
    `احجزي موعدك من هنا: ${vars.bookingLink}`,
    ``,
    `يسعدنا رؤيتك مجدداً! 🌸`,
    ``,
    `— ترانسفورم إيجيبت`,
  ].join("\n");
}

export function formatAppointmentTime(date: Date): string {
  return date.toLocaleString("en-GB", {
    timeZone: "Africa/Cairo",
    weekday: "long",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

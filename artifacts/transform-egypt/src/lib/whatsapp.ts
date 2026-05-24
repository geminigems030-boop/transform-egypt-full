export const WHATSAPP_NUMBER = '201009780008';

export interface WhatsAppContext {
  service?: string;
  branch?: string;
  lang?: 'en' | 'ar';
  name?: string;
}

export function buildWhatsAppLink(ctx: WhatsAppContext = {}): string {
  const { service, branch, lang = 'en', name } = ctx;
  const lines: string[] = [];

  if (lang === 'ar') {
    lines.push('السلام عليكم ترانسفورم،');
    if (name) lines.push(`أنا ${name}.`);
    if (service) lines.push(`أرغب في حجز: ${service}`);
    if (branch) lines.push(`الفرع المفضل: ${branch}`);
    lines.push('من فضلكم تواصلوا معي لتأكيد الموعد. شكراً.');
  } else {
    lines.push('Hello TransforM Egypt,');
    if (name) lines.push(`My name is ${name}.`);
    if (service) lines.push(`I'd like to book: ${service}`);
    if (branch) lines.push(`Preferred branch: ${branch}`);
    lines.push('Please contact me to confirm an appointment. Thank you.');
  }

  const text = encodeURIComponent(lines.join('\n'));
  return `https://wa.me/${WHATSAPP_NUMBER}?text=${text}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Transactional email helper — TransforM Egypt
//
// Sends order-confirmation emails to customers and order-notification emails
// to the salon admin inbox. Designed to wrap Resend (the user's chosen
// provider). Until the Resend integration is authorized in the next agent
// loop, sendEmail() falls back to a no-op + console log so the rest of the
// order flow keeps working in development.
//
// To wire Resend: addIntegration() will write a getUncachableResendClient()
// helper. Drop it in this file and replace the noop branch below.
// ─────────────────────────────────────────────────────────────────────────────

import type { Order } from "@workspace/db/schema";

const FROM_NAME = "TransforM Egypt";
// Defaults set to the salon's Google Workspace customer-support inbox so both
// the customer-facing sender and the admin notification target route through
// the same address. Override with env vars if you want them split.
const FROM_EMAIL = process.env.ORDER_FROM_EMAIL || "customersupport@transform-egypt.com";
const ADMIN_EMAIL = process.env.ADMIN_NOTIFICATION_EMAIL || "customersupport@transform-egypt.com";

export type EmailPayload = {
  to: string;
  subject: string;
  html: string;
  text: string;
  replyTo?: string;
};

/**
 * Low-level send. Returns true on success. Logs (does not throw) on failure
 * so a single bad email never breaks the order flow.
 */
export async function sendEmail(payload: EmailPayload): Promise<boolean> {
  try {
    // Phase 2 (after the user authorizes Resend in the workspace):
    //   const { Resend } = await import("resend");
    //   const resend = new Resend(process.env.RESEND_API_KEY);
    //   const { error } = await resend.emails.send({
    //     from: `${FROM_NAME} <${FROM_EMAIL}>`,
    //     to: [payload.to],
    //     subject: payload.subject,
    //     html: payload.html,
    //     text: payload.text,
    //     reply_to: payload.replyTo,
    //   });
    //   if (error) { console.error("[email] resend error", error); return false; }
    //   return true;

    if (!process.env.RESEND_API_KEY) {
      console.log(
        `[email:noop] would send to=${payload.to} subject="${payload.subject}" — Resend not yet authorized`,
      );
      return false;
    }

    // Direct Resend HTTP call — works without the SDK package installed.
    // Will be replaced with the official client snippet when the
    // integration is added.
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: `${FROM_NAME} <${FROM_EMAIL}>`,
        to: [payload.to],
        subject: payload.subject,
        html: payload.html,
        text: payload.text,
        reply_to: payload.replyTo,
      }),
    });
    if (!res.ok) {
      const body = await res.text();
      console.error(`[email] Resend HTTP ${res.status}: ${body}`);
      return false;
    }
    return true;
  } catch (err) {
    console.error("[email] send failed:", err);
    return false;
  }
}

// ─── Templates ───────────────────────────────────────────────────────────────

function fmtEGP(n: number): string {
  return `EGP ${n.toLocaleString("en-EG")}`;
}

function itemsTableHtml(order: Order): string {
  const rows = order.items
    .map(
      (it) => `
        <tr>
          <td style="padding:12px 8px;border-bottom:1px solid #eee;">
            <div style="font-family:Georgia,serif;font-size:15px;color:#0A0A0A;">${escapeHtml(it.name)}</div>
            <div style="font-size:12px;color:#888;margin-top:2px;">Qty: ${it.quantity}</div>
          </td>
          <td style="padding:12px 8px;border-bottom:1px solid #eee;text-align:right;font-weight:600;color:#0A0A0A;white-space:nowrap;">
            ${fmtEGP(it.price * it.quantity)}
          </td>
        </tr>`,
    )
    .join("");
  return `
    <table style="width:100%;border-collapse:collapse;margin:24px 0;">
      <thead>
        <tr>
          <th style="text-align:left;padding:8px;border-bottom:2px solid #D4AF37;font-size:11px;letter-spacing:.1em;color:#888;text-transform:uppercase;">Item</th>
          <th style="text-align:right;padding:8px;border-bottom:2px solid #D4AF37;font-size:11px;letter-spacing:.1em;color:#888;text-transform:uppercase;">Total</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
      <tfoot>
        <tr><td style="padding:8px;color:#666;">Subtotal</td><td style="padding:8px;text-align:right;color:#666;">${fmtEGP(order.subtotal)}</td></tr>
        <tr><td style="padding:8px;color:#666;">Shipping</td><td style="padding:8px;text-align:right;color:#666;">${order.shipping === 0 ? "Free" : fmtEGP(order.shipping)}</td></tr>
        <tr><td style="padding:12px 8px;border-top:2px solid #0A0A0A;font-family:Georgia,serif;font-size:18px;color:#0A0A0A;">Total</td><td style="padding:12px 8px;border-top:2px solid #0A0A0A;text-align:right;font-family:Georgia,serif;font-size:18px;color:#D4AF37;font-weight:700;">${fmtEGP(order.total)}</td></tr>
      </tfoot>
    </table>`;
}

function itemsTableText(order: Order): string {
  const rows = order.items
    .map((it) => `  • ${it.name} × ${it.quantity}  —  ${fmtEGP(it.price * it.quantity)}`)
    .join("\n");
  return `${rows}\n\n  Subtotal: ${fmtEGP(order.subtotal)}\n  Shipping: ${order.shipping === 0 ? "Free" : fmtEGP(order.shipping)}\n  TOTAL:    ${fmtEGP(order.total)}`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function buildCustomerEmail(order: Order, lang: "en" | "ar" = "en"): EmailPayload {
  const isAr = lang === "ar";
  const subject = isAr
    ? `تأكيد طلبك من TransforM Egypt — رقم ${order.id}`
    : `TransforM Egypt — Order Confirmation #${order.id}`;

  const greeting = isAr ? `مرحباً ${order.customerName}،` : `Hello ${order.customerName},`;
  const intro = isAr
    ? "شكراً لطلبك من TransforM Egypt. تلقّينا طلبك وسنتواصل معك قريباً لتأكيد التوصيل."
    : "Thank you for your order from TransforM Egypt. We've received your order and will contact you shortly to confirm delivery.";
  const shippingLabel = isAr ? "عنوان التوصيل" : "Delivery Address";
  const helpText = isAr
    ? "لأي استفسار، تواصل معنا واتساب 01009780008."
    : "For any questions, reach us on WhatsApp at 01009780008.";

  const html = `
<!doctype html>
<html dir="${isAr ? "rtl" : "ltr"}">
  <body style="margin:0;padding:0;background:#FAF8F4;font-family:Helvetica,Arial,sans-serif;color:#0A0A0A;">
    <div style="max-width:600px;margin:0 auto;background:#fff;">
      <div style="background:#0A0A0A;padding:32px;text-align:center;">
        <div style="font-family:Georgia,serif;font-size:28px;letter-spacing:.3em;color:#D4AF37;">TRANSFORM</div>
        <div style="font-size:11px;letter-spacing:.2em;color:#888;margin-top:6px;text-transform:uppercase;">Luxury Beauty · Cairo</div>
      </div>
      <div style="padding:32px;">
        <h1 style="font-family:Georgia,serif;font-size:22px;margin:0 0 16px;color:#0A0A0A;">${isAr ? "تأكيد الطلب" : "Order Confirmed"}</h1>
        <p style="margin:0 0 8px;color:#444;line-height:1.6;">${greeting}</p>
        <p style="margin:0 0 16px;color:#444;line-height:1.6;">${intro}</p>
        <div style="background:#FAF8F4;padding:16px;border-${isAr ? "right" : "left"}:3px solid #D4AF37;margin:24px 0;">
          <div style="font-size:11px;letter-spacing:.15em;color:#888;text-transform:uppercase;">${isAr ? "رقم الطلب" : "Order Number"}</div>
          <div style="font-family:Georgia,serif;font-size:24px;color:#0A0A0A;margin-top:4px;">#${order.id}</div>
        </div>
        ${itemsTableHtml(order)}
        <div style="margin-top:24px;padding:16px;background:#FAF8F4;">
          <div style="font-size:11px;letter-spacing:.15em;color:#888;text-transform:uppercase;margin-bottom:6px;">${shippingLabel}</div>
          <div style="color:#0A0A0A;line-height:1.5;">${escapeHtml(order.address)}<br/>${escapeHtml(order.city)}<br/>${escapeHtml(order.phone)}</div>
        </div>
        <p style="margin:24px 0 0;color:#888;font-size:13px;line-height:1.6;">${helpText}</p>
      </div>
      <div style="background:#0A0A0A;padding:24px;text-align:center;color:#888;font-size:11px;letter-spacing:.1em;">
        TRANSFORM EGYPT · CITY STARS · SOFITEL DOWNTOWN · O MALL ALAMEIN
      </div>
    </div>
  </body>
</html>`;

  const text = `${greeting}

${intro}

${isAr ? "رقم الطلب" : "Order Number"}: #${order.id}

${itemsTableText(order)}

${shippingLabel}:
${order.address}
${order.city}
${order.phone}

${helpText}

— TransforM Egypt`;

  return { to: order.email, subject, html, text };
}

export function buildAdminEmail(order: Order): EmailPayload {
  const subject = `[New Order #${order.id}] ${order.customerName} — ${fmtEGP(order.total)}`;
  const html = `
<!doctype html>
<html>
  <body style="margin:0;padding:0;background:#FAF8F4;font-family:Helvetica,Arial,sans-serif;color:#0A0A0A;">
    <div style="max-width:640px;margin:0 auto;background:#fff;padding:32px;">
      <div style="background:#D4AF37;color:#0A0A0A;padding:8px 12px;display:inline-block;font-weight:700;font-size:12px;letter-spacing:.15em;text-transform:uppercase;">NEW BOUTIQUE ORDER</div>
      <h1 style="font-family:Georgia,serif;font-size:24px;margin:16px 0 8px;">Order #${order.id} — ${fmtEGP(order.total)}</h1>
      <div style="margin:16px 0;padding:16px;background:#FAF8F4;border-left:3px solid #0A0A0A;">
        <div style="font-weight:600;font-size:16px;">${escapeHtml(order.customerName)}</div>
        <div style="color:#666;margin-top:4px;">📞 <a href="tel:${escapeHtml(order.phone)}" style="color:#0A0A0A;">${escapeHtml(order.phone)}</a> · ✉️ <a href="mailto:${escapeHtml(order.email)}" style="color:#0A0A0A;">${escapeHtml(order.email)}</a></div>
        <div style="color:#666;margin-top:8px;">${escapeHtml(order.address)}, ${escapeHtml(order.city)}</div>
        ${order.notes ? `<div style="margin-top:12px;padding:8px;background:#fff;font-style:italic;color:#444;">"${escapeHtml(order.notes)}"</div>` : ""}
      </div>
      ${itemsTableHtml(order)}
      <p style="margin-top:24px;color:#888;font-size:12px;">Manage this order in the <a href="https://transform-egypt.com/admin" style="color:#D4AF37;">admin dashboard</a>.</p>
    </div>
  </body>
</html>`;
  const text = `NEW BOUTIQUE ORDER #${order.id}

Customer: ${order.customerName}
Phone:    ${order.phone}
Email:    ${order.email}
Address:  ${order.address}, ${order.city}
${order.notes ? `Notes:    ${order.notes}\n` : ""}
${itemsTableText(order)}

Manage at: https://transform-egypt.com/admin`;

  return { to: ADMIN_EMAIL, subject, html, text, replyTo: order.email };
}

/** Send both customer + admin emails. Returns flags for which succeeded. */
export async function sendOrderEmails(
  order: Order,
): Promise<{ customer: boolean; admin: boolean }> {
  const lang = (order.language === "ar" ? "ar" : "en") as "en" | "ar";
  const [customer, admin] = await Promise.all([
    sendEmail(buildCustomerEmail(order, lang)),
    sendEmail(buildAdminEmail(order)),
  ]);
  return { customer, admin };
}

// ─── Booking confirmation ─────────────────────────────────────────────────────

export function buildBookingConfirmationEmail(args: {
  name: string;
  email: string;
  service?: string;
  branch?: string;
  message?: string;
  language?: string;
}): EmailPayload {
  const isAr = args.language === "ar";
  const subject = isAr
    ? "TransforM Egypt — استلمنا طلب حجزك"
    : "TransforM Egypt — Booking Request Received";

  const greeting = isAr ? `مرحباً ${escapeHtml(args.name)}،` : `Hello ${escapeHtml(args.name)},`;
  const intro = isAr
    ? "شكراً لحجزك مع TransforM Egypt. استلمنا طلبك وفريقنا هيتواصل معاكي قريباً لتأكيد الموعد."
    : "Thank you for booking with TransforM Egypt. We've received your request and our team will contact you shortly to confirm your appointment.";
  const serviceLabel = isAr ? "الخدمة" : "Service";
  const branchLabel = isAr ? "الفرع" : "Branch";
  const helpText = isAr
    ? "لأي استفسار، تواصلي معنا واتساب 01009780008."
    : "For any questions, reach us on WhatsApp at 01009780008.";

  const detailsHtml = [
    args.service ? `<tr><td style="padding:8px;color:#666;">${serviceLabel}</td><td style="padding:8px;font-weight:600;color:#0A0A0A;">${escapeHtml(args.service)}</td></tr>` : "",
    args.branch ? `<tr><td style="padding:8px;color:#666;">${branchLabel}</td><td style="padding:8px;color:#0A0A0A;">${escapeHtml(args.branch)}</td></tr>` : "",
  ].filter(Boolean).join("");

  const html = `<!doctype html>
<html dir="${isAr ? "rtl" : "ltr"}">
<body style="margin:0;padding:0;background:#FAF8F4;font-family:Helvetica,Arial,sans-serif;color:#0A0A0A;">
  <div style="max-width:600px;margin:0 auto;background:#fff;">
    <div style="background:#0A0A0A;padding:32px;text-align:center;">
      <div style="font-family:Georgia,serif;font-size:28px;letter-spacing:.3em;color:#D4AF37;">TRANSFORM</div>
      <div style="font-size:11px;letter-spacing:.2em;color:#888;margin-top:6px;text-transform:uppercase;">Luxury Beauty · Cairo</div>
    </div>
    <div style="padding:32px;">
      <h1 style="font-family:Georgia,serif;font-size:22px;margin:0 0 16px;color:#0A0A0A;">${isAr ? "تأكيد طلب الحجز" : "Booking Request Received"}</h1>
      <p style="margin:0 0 8px;color:#444;line-height:1.6;">${greeting}</p>
      <p style="margin:0 0 24px;color:#444;line-height:1.6;">${intro}</p>
      ${detailsHtml ? `<table style="width:100%;border-collapse:collapse;margin:0 0 24px;background:#FAF8F4;">${detailsHtml}</table>` : ""}
      <p style="margin:24px 0 0;color:#888;font-size:13px;line-height:1.6;">${helpText}</p>
    </div>
    <div style="background:#0A0A0A;padding:24px;text-align:center;color:#888;font-size:11px;letter-spacing:.1em;">
      TRANSFORM EGYPT · CITY STARS · SOFITEL DOWNTOWN · O MALL ALAMEIN
    </div>
  </div>
</body>
</html>`;

  const text = `${greeting}

${intro}
${args.service ? `\n${serviceLabel}: ${args.service}` : ""}${args.branch ? `\n${branchLabel}: ${args.branch}` : ""}

${helpText}

— TransforM Egypt`;

  return { to: args.email, subject, html, text };
}

export async function sendBookingConfirmation(args: {
  name: string;
  email: string;
  service?: string;
  branch?: string;
  message?: string;
  language?: string;
}): Promise<boolean> {
  return sendEmail(buildBookingConfirmationEmail(args));
}

// ─── Newsletter welcome ───────────────────────────────────────────────────────

export function buildNewsletterWelcomeEmail(args: {
  email: string;
  language?: string;
}): EmailPayload {
  const isAr = args.language === "ar";
  const subject = isAr
    ? "أهلاً بك في عائلة TransforM Egypt"
    : "Welcome to TransforM Egypt";

  const headline = isAr ? "أهلاً بك 💛" : "You're in 💛";
  const body = isAr
    ? "شكراً لاشتراكك! هتكوني أول من يعرف بعروضنا الحصرية، نصايح الجمال، وأحدث ما وصلنا من مجموعات."
    : "Thank you for subscribing! You'll be the first to hear about our exclusive offers, beauty tips, and new arrivals.";
  const cta = isAr ? "تابعينا على إنستجرام" : "Follow us on Instagram";
  const helpText = isAr
    ? "لأي استفسار، تواصلي معنا واتساب 01009780008."
    : "Questions? WhatsApp us at 01009780008.";

  const html = `<!doctype html>
<html dir="${isAr ? "rtl" : "ltr"}">
<body style="margin:0;padding:0;background:#FAF8F4;font-family:Helvetica,Arial,sans-serif;color:#0A0A0A;">
  <div style="max-width:600px;margin:0 auto;background:#fff;">
    <div style="background:#0A0A0A;padding:32px;text-align:center;">
      <div style="font-family:Georgia,serif;font-size:28px;letter-spacing:.3em;color:#D4AF37;">TRANSFORM</div>
      <div style="font-size:11px;letter-spacing:.2em;color:#888;margin-top:6px;text-transform:uppercase;">Luxury Beauty · Cairo</div>
    </div>
    <div style="padding:40px 32px;text-align:center;">
      <h1 style="font-family:Georgia,serif;font-size:28px;margin:0 0 16px;color:#0A0A0A;">${headline}</h1>
      <p style="color:#444;line-height:1.7;font-size:15px;max-width:400px;margin:0 auto 32px;">${body}</p>
      <a href="https://instagram.com/transformegypt" style="display:inline-block;background:#D4AF37;color:#0A0A0A;text-decoration:none;padding:14px 32px;font-size:13px;letter-spacing:.15em;text-transform:uppercase;font-weight:700;">${cta}</a>
      <p style="margin:32px 0 0;color:#888;font-size:13px;">${helpText}</p>
    </div>
    <div style="background:#0A0A0A;padding:24px;text-align:center;color:#888;font-size:11px;letter-spacing:.1em;">
      TRANSFORM EGYPT · CITY STARS · SOFITEL DOWNTOWN · O MALL ALAMEIN
    </div>
  </div>
</body>
</html>`;

  const text = `${headline}

${body}

Follow us: https://instagram.com/transformegypt

${helpText}

— TransforM Egypt`;

  return { to: args.email, subject, html, text };
}

export async function sendNewsletterWelcome(args: {
  email: string;
  language?: string;
}): Promise<boolean> {
  return sendEmail(buildNewsletterWelcomeEmail(args));
}

// ─── Operational Alerts ────────────────────────────────────────────────────────

/**
 * Urgent escalation alert to the admin inbox — fires when Yara detects a
 * customer complaint, refund demand, or legal/medical concern.
 */
export async function sendEscalationAlert(args: {
  threadId: string;
  username: string | null;
  platform: string;
  text: string;
}): Promise<void> {
  const { threadId, username, platform, text } = args;
  const display = escapeHtml(username ?? threadId);
  const subject = `🚨 Yara Escalation — ${username ?? "Customer"} on ${platform}`;
  const html = `
    <div style="font-family:Georgia,serif;max-width:600px;color:#0A0A0A;">
      <div style="background:#0A0A0A;padding:16px 24px;border-radius:8px 8px 0 0;">
        <h2 style="margin:0;color:#B8860B;font-family:Georgia,serif;letter-spacing:1px;">🚨 Escalation Detected</h2>
      </div>
      <div style="border:1px solid #e5e7eb;border-top:none;border-radius:0 0 8px 8px;padding:24px;">
        <table style="width:100%;border-collapse:collapse;margin-bottom:20px;font-size:14px;">
          <tr><td style="padding:5px 0;color:#666;width:100px;">Platform</td><td style="padding:5px 0;">${escapeHtml(platform)}</td></tr>
          <tr><td style="padding:5px 0;color:#666;">Customer</td><td style="padding:5px 0;font-weight:bold;">${display}</td></tr>
          <tr><td style="padding:5px 0;color:#666;">Thread ID</td><td style="padding:5px 0;font-size:11px;color:#999;">${escapeHtml(threadId)}</td></tr>
        </table>
        <p style="color:#555;font-size:13px;margin:0 0 6px;">Customer message:</p>
        <blockquote style="border-left:4px solid #B8860B;margin:0;padding:10px 16px;background:#fffbf0;font-size:15px;border-radius:0 4px 4px 0;line-height:1.5;">
          ${escapeHtml(text)}
        </blockquote>
        <p style="margin-top:24px;">
          <a href="https://transform-egypt.com/admin" style="background:#B8860B;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;font-family:sans-serif;font-size:14px;">Open Admin Inbox →</a>
        </p>
        <p style="font-size:11px;color:#aaa;margin-top:20px;">Yara replied with empathy and told the customer the team will reach out personally.</p>
      </div>
    </div>`;
  const textBody = `ESCALATION — ${username ?? threadId} on ${platform}\n\nMessage:\n${text}\n\nInbox: https://transform-egypt.com/admin`;
  await sendEmail({ to: ADMIN_EMAIL, subject, html, text: textBody });
}

/**
 * Appointment reminder — sent ~24 h before a website booking date.
 */
export async function sendAppointmentReminder(args: {
  customerEmail: string;
  customerName: string;
  service: string;
  date: string;
  branch?: string | null;
}): Promise<boolean> {
  const { customerEmail, customerName, service, date, branch } = args;
  const branchHtml = branch ? `<br><strong>Branch:</strong> ${escapeHtml(branch)}` : "";
  const subject = `Reminder: Your TransforM Egypt appointment — ${date}`;
  const html = `
    <div style="font-family:Georgia,serif;max-width:600px;color:#0A0A0A;">
      <div style="background:#0A0A0A;padding:20px 32px;">
        <h1 style="margin:0;color:#B8860B;font-size:20px;letter-spacing:2px;">TransforM Egypt</h1>
      </div>
      <div style="padding:32px;border:1px solid #e5e7eb;border-top:none;">
        <p style="font-size:16px;">Hello <strong>${escapeHtml(customerName)}</strong> 💛</p>
        <p>Just a friendly reminder — your appointment is tomorrow:</p>
        <div style="background:#fffbf0;border-left:4px solid #B8860B;padding:16px 20px;margin:20px 0;border-radius:0 6px 6px 0;font-size:15px;">
          <strong>Service:</strong> ${escapeHtml(service)}<br>
          <strong>Date:</strong> ${escapeHtml(date)}${branchHtml}
        </div>
        <p>We look forward to seeing you! If you need to reschedule, please reach us:</p>
        <p>📱 WhatsApp: <a href="https://wa.me/201009780008" style="color:#B8860B;">01009780008</a></p>
        <p>🗺️ Directions: <a href="https://transform-egypt.com" style="color:#B8860B;">transform-egypt.com</a></p>
        <p style="font-size:13px;color:#999;margin-top:32px;">— The TransforM Egypt team 💛</p>
      </div>
    </div>`;
  const textBody = `Hi ${customerName}, your appointment is tomorrow: ${service} on ${date}${branch ? ` at ${branch}` : ""}.\nReschedule? WhatsApp 01009780008\n— TransforM Egypt`;
  return sendEmail({ to: customerEmail, subject, html, text: textBody });
}

/**
 * Post-booking satisfaction follow-up — sent ~3 days after a lead is marked "booked".
 */
export async function sendFollowupEmail(args: {
  customerEmail: string;
  customerName: string;
}): Promise<boolean> {
  const { customerEmail, customerName } = args;
  const subject = `How was your experience at TransforM Egypt? 💛`;
  const html = `
    <div style="font-family:Georgia,serif;max-width:600px;color:#0A0A0A;">
      <div style="background:#0A0A0A;padding:20px 32px;">
        <h1 style="margin:0;color:#B8860B;font-size:20px;letter-spacing:2px;">TransforM Egypt</h1>
      </div>
      <div style="padding:32px;border:1px solid #e5e7eb;border-top:none;">
        <p style="font-size:16px;">Hello <strong>${escapeHtml(customerName)}</strong> 💛</p>
        <p>We hope you're absolutely loving your new look! We'd love to hear how your experience was — your feedback means the world to us.</p>
        <p style="margin-top:24px;">
          <a href="https://www.google.com/search?q=TransforM+Egypt+review" style="background:#B8860B;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;font-size:14px;">Leave a Review 🌸</a>
        </p>
        <p style="margin-top:24px;">Ready for your next session?<br>
          <a href="https://transform-egypt.com/book" style="color:#B8860B;">Book online → transform-egypt.com/book</a>
        </p>
        <p style="font-size:13px;color:#999;margin-top:32px;">— The TransforM Egypt team 💛</p>
      </div>
    </div>`;
  const textBody = `Hi ${customerName}, we hope you're loving your new look! Leave a review: https://transform-egypt.com\n\nBook your next session: https://transform-egypt.com/book\n\n— TransforM Egypt`;
  return sendEmail({ to: customerEmail, subject, html, text: textBody });
}

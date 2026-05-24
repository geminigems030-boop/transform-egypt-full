declare global {
  interface Window {
    fbq?: (...args: unknown[]) => void;
    gtag?: (...args: unknown[]) => void;
    ttq?: {
      track?: (event: string, props?: Record<string, unknown>) => void;
      load?: (id: string) => void;
      page?: () => void;
    };
    dataLayer?: unknown[];
    TiktokAnalyticsObject?: string;
  }
}

const TIKTOK_PIXEL_ID = (import.meta.env.VITE_TIKTOK_PIXEL_ID as string | undefined)?.trim() || undefined;

let tiktokInitialized = false;

function initTikTokPixel() {
  if (tiktokInitialized || !TIKTOK_PIXEL_ID || typeof window === 'undefined') return;
  tiktokInitialized = true;
  try {
    /* eslint-disable @typescript-eslint/no-explicit-any */
    (function (w: any, d: Document, t: string) {
      w.TiktokAnalyticsObject = t;
      const ttq: any = w[t] = w[t] || [];
      ttq.methods = ['page', 'track', 'identify', 'instances', 'debug', 'on', 'off', 'once', 'ready', 'alias', 'group', 'enableCookie', 'disableCookie'];
      ttq.setAndDefer = function (target: any, method: string) {
        target[method] = function () {
          // eslint-disable-next-line prefer-rest-params
          target.push([method].concat(Array.prototype.slice.call(arguments, 0)));
        };
      };
      for (let i = 0; i < ttq.methods.length; i++) ttq.setAndDefer(ttq, ttq.methods[i]);
      ttq.instance = function (id: string) {
        const e = ttq._i[id] || [];
        for (let n = 0; n < ttq.methods.length; n++) ttq.setAndDefer(e, ttq.methods[n]);
        return e;
      };
      ttq.load = function (e: string, n?: any) {
        const i = 'https://analytics.tiktok.com/i18n/pixel/events.js';
        ttq._i = ttq._i || {}; ttq._i[e] = []; ttq._i[e]._u = i;
        ttq._t = ttq._t || {}; ttq._t[e] = +new Date();
        ttq._o = ttq._o || {}; ttq._o[e] = n || {};
        const o = d.createElement('script');
        o.type = 'text/javascript'; o.async = true; o.src = i + '?sdkid=' + e + '&lib=' + t;
        const a = d.getElementsByTagName('script')[0];
        a.parentNode?.insertBefore(o, a);
      };
      ttq.load(TIKTOK_PIXEL_ID);
      ttq.page();
    })(window, document, 'ttq');
    /* eslint-enable @typescript-eslint/no-explicit-any */
  } catch { /* noop */ }
}

if (typeof window !== 'undefined') initTikTokPixel();

// Generate a unique event_id used to deduplicate the same conversion when it
// arrives via BOTH the browser Pixel and the server-side Conversions API.
// Meta's dedup window is 24h on (event_name, event_id).
export function newEventId(): string {
  try {
    if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  } catch { /* fall through */ }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function safeFbq(eventName: string, props?: Record<string, unknown>, eventId?: string) {
  try {
    if (eventId) window.fbq?.('track', eventName, props ?? {}, { eventID: eventId });
    else window.fbq?.('track', eventName, props ?? {});
  } catch { /* swallow */ }
}
function safeGtag(eventName: string, props?: Record<string, unknown>) {
  try { window.gtag?.('event', eventName, props ?? {}); } catch { /* swallow */ }
}
function safeTtq(eventName: string, props?: Record<string, unknown>) {
  try { window.ttq?.track?.(eventName, props ?? {}); } catch { /* swallow */ }
}

// SPA-aware PageView (the static index.html only fires PageView on hard reload).
// Call from a useEffect that depends on `location` so wouter route changes track.
export function trackPageView(pathname: string) {
  try { window.fbq?.('track', 'PageView'); } catch { /* swallow */ }
  try { window.gtag?.('event', 'page_view', { page_path: pathname, page_location: window.location.href }); } catch { /* swallow */ }
  try { window.ttq?.page?.(); } catch { /* swallow */ }
}

// Generic ViewContent for content-rich pages (Services, Boutique, ProductDetail).
export function trackViewContent(data: { contentName: string; contentCategory?: string; contentIds?: (string | number)[]; value?: number; currency?: string }) {
  const props: Record<string, unknown> = {
    content_name: data.contentName,
    content_category: data.contentCategory,
    content_type: data.contentIds ? 'product' : 'page',
  };
  if (data.contentIds) props.content_ids = data.contentIds.map(String);
  if (data.value != null) { props.value = data.value; props.currency = data.currency ?? 'EGP'; }
  safeFbq('ViewContent', props);
  safeGtag('view_item', props);
  safeTtq('ViewContent', props);
}

// Newsletter signup is a Lead by Meta's taxonomy.
// `eventId` is passed by the caller so the same id can be relayed to the
// server-side CAPI mirror and Meta will dedup the two events.
export function trackNewsletterLead(eventId?: string) {
  safeFbq('Lead', { content_name: 'newsletter_signup', content_category: 'newsletter' }, eventId);
  safeGtag('generate_lead', { content_name: 'newsletter_signup', source: 'newsletter' });
  safeTtq('Subscribe', { content_name: 'newsletter_signup' });
}

export function trackBookingLead(data: {
  service?: string;
  branch?: string;
  value?: number;
  currency?: string;
  eventId?: string;
}) {
  const value = data.value ?? 0;
  const currency = data.currency ?? 'EGP';
  safeFbq('Lead', { content_name: data.service, content_category: data.branch, value, currency }, data.eventId);
  safeFbq('Schedule', { content_name: data.service, content_category: data.branch });
  safeGtag('generate_lead', { currency, value, service: data.service, branch: data.branch });
  safeGtag('book_appointment', { service: data.service, branch: data.branch });
  safeTtq('SubmitForm', { content_name: data.service, value, currency });
}

export function trackInitiateBooking() {
  safeFbq('InitiateCheckout');
  safeGtag('begin_checkout', { item_category: 'booking' });
  safeTtq('InitiateCheckout');
}

export function trackContact(channel: 'whatsapp' | 'phone') {
  safeFbq('Contact', { method: channel });
  safeGtag('contact', { method: channel });
  safeTtq('Contact', { method: channel });
}

// ── Lucky-page-specific tracking events ────────────────────────────────────────

export function trackQuizStart() {
  safeFbq('ViewContent', { content_name: 'lucky_quiz', content_category: 'quiz' });
  safeGtag('quiz_start', { content_name: 'lucky_quiz' });
  safeTtq('ViewContent', { content_name: 'lucky_quiz' });
}

export function trackQuizComplete(answers?: Record<string, string | undefined>, eventId?: string) {
  const cleanAnswers = answers ? Object.fromEntries(Object.entries(answers).filter(([, v]) => v != null)) : {};
  safeFbq('CompleteRegistration', { content_name: 'lucky_quiz', ...cleanAnswers }, eventId);
  safeGtag('quiz_complete', { content_name: 'lucky_quiz', ...cleanAnswers });
  safeTtq('CompleteRegistration', { content_name: 'lucky_quiz' });
}

export function trackLeadSubmit(data: { hasEmail?: boolean; branch?: string; eventId?: string }) {
  safeFbq('Lead', { content_name: 'lucky_lead_form', has_email: data.hasEmail ?? false, content_category: data.branch }, data.eventId);
  safeGtag('lead_submit', { has_email: data.hasEmail ?? false, branch: data.branch });
  safeTtq('SubmitForm', { content_name: 'lucky_lead_form' });
}

export function trackSpinClick() {
  safeFbq('ClickButton', { button_name: 'spin_now' });
  safeGtag('spin_click', { button_name: 'spin_now' });
  safeTtq('ClickButton', { button_name: 'spin_now' });
}

export function trackSpinResult(data: { isGrand: boolean; prize: string; value: number }) {
  safeFbq('AchievementUnlocked', { content_name: data.prize, value: data.value, currency: 'EGP', is_grand: data.isGrand });
  safeGtag('spin_result', { content_name: data.prize, value: data.value, currency: 'EGP', is_grand: data.isGrand });
  safeTtq('AchievementUnlocked', { content_name: data.prize, value: data.value, currency: 'EGP' });
}

export function trackBookingClick(channel: 'whatsapp' | 'book') {
  safeFbq('Contact', { method: channel, source: 'lucky_result' });
  safeGtag('booking_click', { method: channel, source: 'lucky_result' });
  safeTtq('Contact', { method: channel });
}

// Organic footer entry into Lucky funnel — measured separately from paid traffic.
export function trackLuckyFooterClick() {
  safeFbq('ClickButton', { button_name: 'lucky_footer_link', source: 'organic_footer' });
  safeGtag('lucky_footer_click', { source: 'organic_footer' });
  safeTtq('ClickButton', { button_name: 'lucky_footer_link' });
}

export {};

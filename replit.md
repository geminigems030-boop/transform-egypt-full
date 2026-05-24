# TransforM Egypt — Luxury Beauty Platform

## Overview
TransforM Egypt is a full-stack, bilingual (English/Arabic) luxury beauty e-commerce platform for a premium brand in Egypt and the Middle East. It aims to provide an immersive and personalized online experience, driving sales and bookings through features like online appointment scheduling, a comprehensive product catalog, transformation galleries, customer reviews, and interactive promotional campaigns. The project focuses on enhancing customer engagement and solidifying the brand's digital presence.

## User Preferences
I prefer iterative development with clear communication on progress. Ask before making major architectural changes or introducing new dependencies. I like detailed explanations for complex technical decisions. I want the agent to use simple language when communicating with me.

## System Architecture
The platform is a pnpm monorepo using Node.js 24 and TypeScript 5.9.

**Frontend:**
-   **Technology Stack:** React 18 with Vite, Tailwind CSS, Framer Motion, GSAP, and Lenis for smooth scrolling.
-   **UI/UX Decisions:** Sophisticated color palette (Black, Gold, White, Ivory), specific typography, full bilingual support with RTL adjustments, and performance optimizations (route-level code splitting, lazy image loading). Key pages include homepage, service pages, transformation gallery with before/after sliders, review section, product boutique, and online booking. Interactive promotional campaigns like a "Lucky Wheel" are integrated.
-   **SEO:** Implements JSON-LD, dynamic metadata, canonical URLs, hreflang, and integrates Meta Pixel/GA4. HTML prerendering is used for build-time SEO.

**Backend:**
-   **API Framework:** Express 5.
-   **Database:** PostgreSQL with Drizzle ORM.
-   **Validation:** Zod and `drizzle-zod`.
-   **API Codegen:** Orval from OpenAPI specification.
-   **Admin Dashboard:** Token-gated internal dashboard for lead management, statistics, filtering, and CSV export.

**Core Features:**
-   **Booking System:** Online appointment scheduling with WhatsApp deep-linking.
-   **Product Catalog:** Product listings, detail pages, shopping cart.
-   **Boutique Checkout:** localStorage-backed cart (`artifacts/transform-egypt/src/lib/cart.tsx`) replaces the previous broken in-memory IP-keyed server cart that lost items behind the proxy. Each product card shows both "Buy Now" (gold, primary — adds to cart and jumps to `/checkout`) and "Add to Cart" (secondary). Product detail mirrors the same dual-CTA pattern. The `/checkout` page collects name/email/phone/address/city/notes with bilingual validation, posts to `POST /api/orders`, persists to the new `orders` table (Drizzle, JSONB items), mirrors the order into `submissions` (source=`boutique`) so it appears in the admin Submissions tab, and async-fires order confirmation emails to the customer + notification emails to the salon admin via Resend (`artifacts/api-server/src/lib/email.ts`). Free shipping over EGP 1,000, EGP 80 flat below. Admin endpoints: `GET /api/admin/orders` (filter by status/q/from/to, JSON or CSV) and `PATCH /api/admin/orders/:id/status` (new → confirmed → shipped → delivered → cancelled).
-   **Interactive Elements:** Beauty recommendation quiz and auto-rotating testimonials carousel.
-   **Analytics:** Tracking with Meta Pixel, GA4, and optional TikTok Pixel. Server-side mirroring via Meta Conversions API (CAPI) for lead events.
-   **Meta Two-Way Integration:** Includes server-side cached Instagram feed, Facebook Lead Ads webhook integration for submissions, and Instagram/Facebook DMs/comments flowing into an `/admin` Inbox tab with reply functionality.
-   **Auto-lead-capture from DMs:** Automatically creates submission entries from DMs containing Egyptian phone numbers, normalizing and de-duplicating entries.
-   **Replymind (AI Auto-reply Agent):** Powered by Replit's Anthropic AI integration (`claude-sonnet-4-6`). Features a persona "Yara from TransforM" with comprehensive knowledge base, lead-collection flow, language auto-detection, and escalation guardrails. Supports per-channel modes (`off`, `suggest`, `auto`) for replies. Includes memory mode via `inbox_exemplars` for few-shot learning from past conversations.
-   **Production Seed:** `seedProductsIfEmpty()` (in `artifacts/api-server/src/lib/seed-products.ts`) runs at api-server boot. Wrapped in a transaction guarded by `pg_advisory_xact_lock(81234568)` so concurrent boots / rolling restarts can't double-insert. Inserts the 10 canonical products only when the table is empty (typical for a freshly-deployed prod DB — Replit's publish flow migrates schema but not data). Safe no-op on dev. Failures are logged at `error` level and never crash the boot.

## External Dependencies
-   **Cloudflare DNS:** Domain management.
-   **PostgreSQL:** Main database.
-   **Meta Pixel:** Facebook/Instagram ad tracking.
-   **Meta Conversions API (CAPI):** Server-side conversion tracking for Meta platforms.
-   **Meta Commerce catalog feed:** Product catalog for Meta/Instagram Shopping.
-   **Google Analytics 4 (GA4):** Website analytics.
-   **TikTok Pixel:** TikTok ad tracking (optional).
-   **WhatsApp:** Customer contact, booking confirmations, gift card requests.
-   **Google Maps:** Displaying branch locations.
-   **Instagram, Facebook, TikTok:** Social media integrations.
-   **ImageMagick:** Image compression during build.
-   **Anthropic via Replit AI Integrations:** Powers Replymind agent (`claude-sonnet-4-6`).
-   **Resend (transactional email):** `artifacts/api-server/src/lib/email.ts` sends order confirmations to customers and notification emails to the salon admin via Resend's HTTP API. `RESEND_API_KEY` is set as a Replit secret (added 2026-05-04 — user holds a personal Resend account under `Youssifofficial@gmail.com`). The send target address is `customersupport@transform-egypt.com` (Google Workspace inbox), used as both `ORDER_FROM_EMAIL` and `ADMIN_NOTIFICATION_EMAIL` defaults. Resend domain `transform-egypt.com` is registered (id `88cdc231-1c1f-477f-95fd-2ddd32618861`, region `eu-west-1`) and all 3 sending DNS records (DKIM TXT `resend._domainkey`, SPF MX `send → feedback-smtp.eu-west-1.amazonses.com`, SPF TXT `send → v=spf1 include:amazonses.com ~all`) were provisioned at Cloudflare on 2026-05-04 via the Cloudflare API. Domain status is `verified` and end-to-end email delivery is confirmed working (order #8 test on 2026-05-04 delivered both customer confirmation and admin notification). **Important:** Resend's "receiving" capability was disabled via `PATCH /domains/{id}` with `{"capabilities":{"receiving":"disabled"}}` because the receiving feature requires an apex MX record (`inbound-smtp.eu-west-1.amazonaws.com`) that would conflict with Google Workspace's MX records and steal inbound mail away from `customersupport@transform-egypt.com`. Do NOT re-enable receiving on this Resend domain unless we explicitly migrate inbound mail away from Google Workspace. Every order fires two emails: a branded English/Arabic confirmation to the customer and a notification to the salon admin. The helper falls back to a no-op log if `RESEND_API_KEY` is ever unset.
-   **Meta Webhooks (Page + Instagram):** Single callback at `/api/webhooks/meta` for messages, postbacks, feed, leadgen, and comments.
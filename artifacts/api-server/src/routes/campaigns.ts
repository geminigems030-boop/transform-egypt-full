import {
  Router,
  type IRouter,
  type Request,
  type Response,
} from "express";
import {
  eq,
  desc,
  and,
  isNull,
  sql,
  count,
} from "drizzle-orm";
import { db } from "@workspace/db";
import {
  campaignsTable,
  campaignLeadsTable,
  submissionsTable,
  luckySpinsTable,
  bookingsTable,
  ordersTable,
  instagramMessagesTable,
} from "@workspace/db/schema";
import { sendEmail } from "../lib/email";
import { logger } from "../lib/logger";
import { sendViaManychat } from "./manychat";
import {
  buildLeadPool,
  type SegmentedLead,
  type LeadSegment,
} from "../lib/lead-segmentation";
import { generateOutreachCopy } from "../lib/ai-outreach";
import {
  fetchPageConversationsPage,
  isMetaConfigured,
  META_PAGE_ID,
  META_IG_BIZ_ID,
} from "../lib/meta-graph";
import { processInboundInstagramDm } from "./webhooks";

const router: IRouter = Router();

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/campaigns/segments — preview lead counts per segment
// ─────────────────────────────────────────────────────────────────────────────

router.get("/campaigns/segments", async (_req: Request, res: Response) => {
  try {
    const allSegments: LeadSegment[] = [
      "no_booking",
      "lucky_spin",
      "warm_dm",
      "post_booking",
      "newsletter",
      "abandoned_cart",
    ];

    const results = await Promise.all(
      allSegments.map(async (seg) => {
        try {
          const leads = await buildLeadPool([seg], { limitPerSegment: 10 });
          return {
            segment: seg,
            count: leads.length,
            avgScore: leads.length
              ? Math.round(
                  leads.reduce((s, l) => s + l.score, 0) / leads.length,
                )
              : 0,
            topLead: leads[0] ?? null,
          };
        } catch {
          return { segment: seg, count: 0, avgScore: 0, topLead: null };
        }
      }),
    );

    res.json({ segments: results });
  } catch (err) {
    logger.error({ err: (err as Error).message }, "campaigns: segment preview failed");
    res.status(500).json({ error: "Failed to preview segments" });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/campaigns — list all campaigns with stats
// ─────────────────────────────────────────────────────────────────────────────

router.get("/campaigns", async (_req: Request, res: Response) => {
  try {
    const campaigns = await db
      .select()
      .from(campaignsTable)
      .orderBy(desc(campaignsTable.createdAt));

    // Attach per-campaign lead counts by status
    const enriched = await Promise.all(
      campaigns.map(async (c) => {
        const statusCounts = await db
          .select({
            status: campaignLeadsTable.status,
            count: sql<number>`count(*)::int`,
          })
          .from(campaignLeadsTable)
          .where(eq(campaignLeadsTable.campaignId, c.id))
          .groupBy(campaignLeadsTable.status);

        return {
          ...c,
          leadStats: statusCounts.reduce(
            (acc, s) => {
              acc[s.status] = s.count;
              return acc;
            },
            {} as Record<string, number>,
          ),
        };
      }),
    );

    res.json({ campaigns: enriched });
  } catch (err) {
    logger.error({ err: (err as Error).message }, "campaigns: list failed");
    res.status(500).json({ error: "Failed to list campaigns" });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/campaigns — create a new campaign
// Body: { name, segment, channel, filterJson?, aiPromptTemplate?, scheduledAt? }
// ─────────────────────────────────────────────────────────────────────────────

router.post("/campaigns", async (req: Request, res: Response) => {
  try {
    const { name, segment, channel, scheduledAt } = req.body ?? {};
    if (!name || !segment || !channel) {
      res.status(400).json({ error: "Missing name, segment, or channel" });
      return;
    }

    // Build the lead pool
    const leads = await buildLeadPool([segment as LeadSegment], {
      limitPerSegment: 500,
    });

    const [campaign] = await db
      .insert(campaignsTable)
      .values({
        name,
        segment,
        channel,
        status: scheduledAt ? "scheduled" : "draft",
        totalLeads: leads.length,
        scheduledAt: scheduledAt ? new Date(scheduledAt) : null,
      })
      .returning();

    // Pre-populate campaign_leads rows
    if (leads.length > 0) {
      const inserts = leads.map((lead) => ({
        campaignId: campaign.id,
        sourceTable: lead.sourceTable,
        sourceId: lead.sourceId,
        name: lead.name,
        email: lead.email,
        phone: lead.phone,
        threadId: lead.threadId,
        status: "pending" as const,
        channel: channel as "email" | "dm",
        leadScore: lead.score,
        createdAt: new Date(),
      }));

      await db.insert(campaignLeadsTable).values(inserts);
    }

    res.status(201).json({
      campaign,
      leadsAdded: leads.length,
    });
  } catch (err) {
    logger.error({ err: (err as Error).message }, "campaigns: create failed");
    res.status(500).json({ error: "Failed to create campaign" });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/campaigns/:id/generate — AI-generate personalized copy for all pending leads
// ─────────────────────────────────────────────────────────────────────────────

router.post("/campaigns/:id/generate", async (req: Request, res: Response) => {
  try {
    const campaignId = Number(req.params.id);
    const campaign = await db
      .select()
      .from(campaignsTable)
      .where(eq(campaignsTable.id, campaignId))
      .limit(1)
      .then((rows) => rows[0]);

    if (!campaign) {
      res.status(404).json({ error: "Campaign not found" });
      return;
    }

    // Load the raw source rows so we can pass full context to the AI
    const pendingLeads = await db
      .select()
      .from(campaignLeadsTable)
      .where(
        and(
          eq(campaignLeadsTable.campaignId, campaignId),
          eq(campaignLeadsTable.status, "pending"),
        ),
      )
      .limit(50); // cap to avoid Anthropic rate limits

    let generated = 0;
    for (const cl of pendingLeads) {
      try {
        const lead = await reconstructLead(cl);
        if (!lead) continue;

        const copy = await generateOutreachCopy(lead, campaign.channel as "email" | "dm");

        await db
          .update(campaignLeadsTable)
          .set({
            personalizedSubject: copy.subject ?? null,
            personalizedBody: copy.body,
            personalizedDm: campaign.channel === "dm" ? copy.body : null,
          })
          .where(eq(campaignLeadsTable.id, cl.id));

        generated++;
      } catch {
        // Skip individual lead failures, continue batch
      }
    }

    res.json({ generated, campaignId });
  } catch (err) {
    logger.error({ err: (err as Error).message }, "campaigns: generate copy failed");
    res.status(500).json({ error: "Failed to generate copy" });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/campaigns/:id/send — execute the campaign (send emails + DMs)
// ─────────────────────────────────────────────────────────────────────────────

router.post("/campaigns/:id/send", async (req: Request, res: Response) => {
  try {
    const campaignId = Number(req.params.id);
    const campaign = await db
      .select()
      .from(campaignsTable)
      .where(eq(campaignsTable.id, campaignId))
      .limit(1)
      .then((rows) => rows[0]);

    if (!campaign) {
      res.status(404).json({ error: "Campaign not found" });
      return;
    }

    const leads = await db
      .select()
      .from(campaignLeadsTable)
      .where(
        and(
          eq(campaignLeadsTable.campaignId, campaignId),
          eq(campaignLeadsTable.status, "pending"),
        ),
      )
      .limit(100);

    let sent = 0;
    let failed = 0;
    const results: { id: number; status: string; error?: string }[] = [];

    for (const cl of leads) {
      try {
        if (campaign.channel === "email" && cl.email) {
          const body = cl.personalizedBody ?? getGenericBody(campaign.segment, "en");
          const subject = cl.personalizedSubject ?? "TransforM Egypt ✨";

          const ok = await sendEmail({
            to: cl.email,
            subject,
            html: `<div style="font-family:serif;max-width:600px;margin:0 auto;padding:24px;">${body.replace(/\n/g, "<br>")}</div>`,
            text: body,
          });

          if (ok) {
            await db
              .update(campaignLeadsTable)
              .set({ status: "sent", sentAt: new Date() })
              .where(eq(campaignLeadsTable.id, cl.id));
            sent++;
          } else {
            await db
              .update(campaignLeadsTable)
              .set({ status: "failed", errorMessage: "Email send failed" })
              .where(eq(campaignLeadsTable.id, cl.id));
            failed++;
          }
        } else if (campaign.channel === "dm" && cl.threadId) {
          const body = cl.personalizedDm ?? cl.personalizedBody ?? getGenericBody(campaign.segment, "en");
          const ok = await sendViaManychat(cl.threadId, body, "instagram");
          if (ok) {
            await db
              .update(campaignLeadsTable)
              .set({ status: "sent", sentAt: new Date() })
              .where(eq(campaignLeadsTable.id, cl.id));
            sent++;
          } else {
            await db
              .update(campaignLeadsTable)
              .set({ status: "failed", errorMessage: "ManyChat DM send failed" })
              .where(eq(campaignLeadsTable.id, cl.id));
            failed++;
          }
        } else {
          await db
            .update(campaignLeadsTable)
            .set({ status: "skipped", errorMessage: "Missing email or threadId" })
            .where(eq(campaignLeadsTable.id, cl.id));
          failed++;
        }
      } catch (err) {
        await db
          .update(campaignLeadsTable)
          .set({
            status: "failed",
            errorMessage: (err as Error).message,
          })
          .where(eq(campaignLeadsTable.id, cl.id));
        failed++;
      }
    }

    // Update campaign stats
    await db
      .update(campaignsTable)
      .set({
        status: "running",
        startedAt: new Date(),
        sentCount: campaign.sentCount + sent,
        failedCount: campaign.failedCount + failed,
      })
      .where(eq(campaignsTable.id, campaignId));

    res.json({ sent, failed, campaignId });
  } catch (err) {
    logger.error({ err: (err as Error).message }, "campaigns: send failed");
    res.status(500).json({ error: "Failed to send campaign" });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/campaigns/:id/leads — list leads in a campaign
// ─────────────────────────────────────────────────────────────────────────────

router.get("/campaigns/:id/leads", async (req: Request, res: Response) => {
  try {
    const campaignId = Number(req.params.id);
    const leads = await db
      .select()
      .from(campaignLeadsTable)
      .where(eq(campaignLeadsTable.campaignId, campaignId))
      .orderBy(desc(campaignLeadsTable.leadScore));

    res.json({ leads });
  } catch (err) {
    logger.error({ err: (err as Error).message }, "campaigns: lead list failed");
    res.status(500).json({ error: "Failed to list leads" });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

async function reconstructLead(cl: typeof campaignLeadsTable.$inferSelect): Promise<SegmentedLead | null> {
  switch (cl.sourceTable) {
    case "submissions": {
      const row = await db
        .select()
        .from(submissionsTable)
        .where(eq(submissionsTable.id, cl.sourceId))
        .limit(1)
        .then((r) => r[0]);
      if (!row) return null;
      return {
        sourceTable: "submissions",
        sourceId: row.id,
        name: row.name,
        email: row.email,
        phone: row.phone,
        threadId: null,
        language: row.language,
        segment: "no_booking",
        score: cl.leadScore,
        reason: `Submission from ${row.source}`,
        lastContactDate: row.createdAt,
        service: row.service,
        message: row.message,
        createdAt: row.createdAt,
      };
    }
    case "lucky_spins": {
      const row = await db
        .select()
        .from(luckySpinsTable)
        .where(eq(luckySpinsTable.id, cl.sourceId))
        .limit(1)
        .then((r) => r[0]);
      if (!row) return null;
      return {
        sourceTable: "lucky_spins",
        sourceId: row.id,
        name: row.name,
        email: row.email,
        phone: row.phone,
        threadId: null,
        language: null,
        segment: "lucky_spin",
        score: cl.leadScore,
        reason: `Lucky spin winner`,
        lastContactDate: row.createdAt,
        quizGoal: row.quizGoal,
        quizHair: row.quizHair,
        createdAt: row.createdAt,
      };
    }
    case "bookings": {
      const row = await db
        .select()
        .from(bookingsTable)
        .where(eq(bookingsTable.id, cl.sourceId))
        .limit(1)
        .then((r) => r[0]);
      if (!row) return null;
      return {
        sourceTable: "bookings",
        sourceId: row.id,
        name: row.name,
        email: row.email,
        phone: row.phone,
        threadId: null,
        language: null,
        segment: "post_booking",
        score: cl.leadScore,
        reason: `Past booking`,
        lastContactDate: row.createdAt,
        service: row.service,
        createdAt: row.createdAt,
      };
    }
    case "orders": {
      const row = await db
        .select()
        .from(ordersTable)
        .where(eq(ordersTable.id, cl.sourceId))
        .limit(1)
        .then((r) => r[0]);
      if (!row) return null;
      return {
        sourceTable: "orders",
        sourceId: row.id,
        name: row.customerName,
        email: row.email,
        phone: row.phone,
        threadId: null,
        language: row.language,
        segment: "abandoned_cart",
        score: cl.leadScore,
        reason: `Abandoned order`,
        lastContactDate: row.createdAt,
        createdAt: row.createdAt,
      };
    }
    case "instagram_messages": {
      const row = await db
        .select()
        .from(instagramMessagesTable)
        .where(eq(instagramMessagesTable.id, cl.sourceId))
        .limit(1)
        .then((r) => r[0]);
      if (!row) return null;
      return {
        sourceTable: "instagram_messages",
        sourceId: row.id,
        name: row.senderUsername,
        email: null,
        phone: null,
        threadId: row.threadId,
        language: null,
        segment: "warm_dm",
        score: cl.leadScore,
        reason: `Warm DM`,
        lastContactDate: row.receivedAt,
        message: row.text,
        createdAt: row.receivedAt,
      };
    }
    default:
      return null;
  }
}

function getGenericBody(segment: string, lang: string): string {
  if (lang === "ar") {
    const map: Record<string, string> = {
      no_booking: "مرحباً! كنتِ بتستكشف عن خدماتنا. حابة تجربي استشارة مجانية النهاردة — https://transform-egypt.com/book",
      lucky_spin: "مبروك! ربحتي في لعبة TransforM. استبدلي جايزتك الآن! https://transform-egypt.com/book",
      post_booking: "أهلاً من جديد! حابة تحجزي تاني أو تسبي رأيك في الريفيوهات — https://transform-egypt.com/reviews",
      newsletter: "أهلاً! عروض جديدة من TransforM. شوفي الأخبار: https://transform-egypt.com",
      warm_dm: "أهلاً مرة تانية! جربي AI: شوفي شكلك قبل ما تحجزي — https://transform-egypt.com/try-on",
      abandoned_cart: "نسيتي شيء في سلة التسوق! استمري وأكملي الطلب الآن: https://transform-egypt.com/boutique",
    };
    return map[segment] ?? "أهلابك من TransforM! https://transform-egypt.com";
  }

  const map: Record<string, string> = {
    no_booking: "Hi there! You showed interest in our services. Come try a free consultation — https://transform-egypt.com/book",
    lucky_spin: "Congrats on winning our Lucky Spin! Redeem your prize now — https://transform-egypt.com/book",
    post_booking: "Welcome back! Time to rebook or leave a review — https://transform-egypt.com/reviews",
    newsletter: "News from TransforM! Check out what's new: https://transform-egypt.com",
    warm_dm: "Hey again! Try our AI preview: see your look before you book — https://transform-egypt.com/try-on",
    abandoned_cart: "You left something in your cart! Complete your order: https://transform-egypt.com/boutique",
  };
  return map[segment] ?? "Hello from TransforM! https://transform-egypt.com";
}

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/admin/import/historical-dms
// One-time deep import: pages through ALL past Instagram + Facebook/Messenger
// conversations and feeds every inbound message through the same lead-capture
// pipeline used by live webhooks. Idempotent — duplicate messages are silently
// skipped (ON CONFLICT DO NOTHING on meta_message_id).
// ─────────────────────────────────────────────────────────────────────────────

router.post(
  "/admin/import/historical-dms",
  async (req: Request, res: Response) => {
    const token = req.headers["x-admin-token"] as string | undefined;
    if (!token || token !== process.env["ADMIN_TOKEN"]) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    if (!isMetaConfigured()) {
      return res
        .status(503)
        .json({ error: "Meta credentials not configured on this server." });
    }

    const platform: "instagram" | "messenger" | "both" =
      (req.body as { platform?: string }).platform === "messenger"
        ? "messenger"
        : (req.body as { platform?: string }).platform === "both"
          ? "both"
          : "instagram";

    const OUR_IDS = new Set([META_PAGE_ID, META_IG_BIZ_ID].filter(Boolean));

    const stats = {
      conversations: 0,
      messages: 0,
      newContacts: 0,
      errors: 0,
    };

    async function importPlatform(
      plat: "instagram" | "messenger",
    ): Promise<void> {
      let after: string | undefined;
      let pageCount = 0;
      const MAX_PAGES = 40; // safety limit — ~1000 conversations

      while (pageCount < MAX_PAGES) {
        let pageData: Awaited<ReturnType<typeof fetchPageConversationsPage>>;
        try {
          pageData = await fetchPageConversationsPage({
            platform: plat,
            after,
            pageLimit: 10,
            messagesPerConvo: 5,
          });
        } catch (err) {
          logger.warn(
            { err: (err as Error).message, plat, page: pageCount },
            "historical-import: failed to fetch conversation page",
          );
          stats.errors++;
          break;
        }

        const convos = pageData.data ?? [];
        stats.conversations += convos.length;
        pageCount++;

        for (const convo of convos) {
          for (const msg of convo.messages?.data ?? []) {
            const fromId = msg.from?.id;
            const mid = msg.id;
            const text = msg.message ?? null;

            if (!fromId || !mid || OUR_IDS.has(fromId)) continue;

            stats.messages++;
            try {
              await processInboundInstagramDm({
                senderId: fromId,
                mid,
                text,
              });
              stats.newContacts++;
            } catch (err) {
              const msg2 = (err as Error).message ?? "";
              // "duplicate" inserts are silent — anything else is a real error
              if (!msg2.includes("duplicate") && !msg2.includes("conflict")) {
                stats.errors++;
              }
            }
          }
        }

        const nextCursor = pageData.paging?.cursors?.after;
        if (!nextCursor || !pageData.paging?.next) break;
        after = nextCursor;
      }
    }

    try {
      if (platform === "both") {
        await importPlatform("instagram");
        await importPlatform("messenger");
      } else {
        await importPlatform(platform);
      }

      logger.info(
        { stats, platform },
        "historical-import: completed",
      );

      return res.json({ ok: true, stats });
    } catch (err) {
      logger.error(
        { err: (err as Error).message },
        "historical-import: unexpected error",
      );
      return res
        .status(500)
        .json({ error: (err as Error).message ?? "Import failed" });
    }
  },
);

export default router;

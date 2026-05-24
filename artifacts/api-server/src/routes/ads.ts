import { Router, type IRouter, type Request, type Response } from "express";
import { eq, desc } from "drizzle-orm";
import { db } from "@workspace/db";
import { promotionsTable } from "@workspace/db/schema";
import { metaFetch, isMetaConfigured, META_PAGE_ID } from "../lib/meta-graph";
import { logger } from "../lib/logger";
import Anthropic from "@anthropic-ai/sdk";

const router: IRouter = Router();

const adminAuth = (req: Request, res: Response): boolean => {
  const token = req.headers["x-admin-token"] as string | undefined;
  if (!token || token !== process.env["ADMIN_TOKEN"]) {
    res.status(401).json({ error: "Unauthorized" });
    return false;
  }
  return true;
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/admin/ads/meta — Live Meta Ads account + campaign data
// ─────────────────────────────────────────────────────────────────────────────

interface AdAccount {
  id?: string;
  name?: string;
  currency?: string;
  account_status?: number;
}

interface AdCampaign {
  id?: string;
  name?: string;
  status?: string;
  objective?: string;
  daily_budget?: string;
  lifetime_budget?: string;
  start_time?: string;
  stop_time?: string;
  insights?: { data?: AdInsight[] };
}

interface AdInsight {
  spend?: string;
  reach?: string;
  impressions?: string;
  clicks?: string;
  ctr?: string;
  cpm?: string;
  cpc?: string;
  cpp?: string;
  frequency?: string;
  actions?: Array<{ action_type: string; value: string }>;
  cost_per_action_type?: Array<{ action_type: string; value: string }>;
  date_start?: string;
  date_stop?: string;
}

interface AdAdset {
  id?: string;
  name?: string;
  status?: string;
  effective_status?: string;
  daily_budget?: string;
  lifetime_budget?: string;
  targeting?: unknown;
  insights?: { data?: AdInsight[] };
}

interface AdAd {
  id?: string;
  name?: string;
  effective_status?: string;
  configured_status?: string;
  issues_info?: Array<{ level: string; error_code: number; title: string; message: string }>;
  insights?: { data?: AdInsight[] };
}

const INSIGHT_FIELDS = "spend,impressions,reach,clicks,ctr,cpm,cpc,frequency,actions,cost_per_action_type";
// Meta Marketing API date_preset values (different from Page Insights)
const VALID_DATE_PRESETS = new Set([
  "today", "yesterday", "last_3d", "last_7d", "last_14d", "last_28d",
  "last_30d", "last_90d", "this_month", "last_month", "lifetime",
]);

router.get("/admin/ads/meta", async (req: Request, res: Response) => {
  if (!adminAuth(req, res)) return;

  const adsToken = process.env["META_ADS_TOKEN"];
  const adsAccountId = process.env["META_ADS_ACCOUNT_ID"] ?? "act_1022059713717509";
  const datePreset = VALID_DATE_PRESETS.has(String(req.query.date_preset))
    ? String(req.query.date_preset)
    : "last_7d";

  if (!adsToken && !isMetaConfigured()) {
    return res.json({ configured: false, accounts: [] });
  }

  const fetchOpts = adsToken ? { token: adsToken } : {};

  try {
    const accountResp = await metaFetch<AdAccount>(
      `${adsAccountId}?fields=id,name,currency,account_status,amount_spent,balance,spend_cap,funding_source_details`,
      fetchOpts,
    );

    const account = accountResp;
    if (!account.id) return res.json({ configured: true, accounts: [] });

    // Campaigns with inline insights
    const campaignsResp = await metaFetch<{ data?: AdCampaign[] }>(
      `${account.id}/campaigns?fields=id,name,status,objective,daily_budget,lifetime_budget,start_time,stop_time,insights.date_preset(${datePreset}){${INSIGHT_FIELDS}}&limit=20`,
      fetchOpts,
    );
    const campaigns = campaignsResp.data ?? [];

    // For each campaign, fetch adsets + ads in parallel
    const campaignsWithChildren = await Promise.all(
      campaigns.map(async (camp) => {
        if (!camp.id) return { ...camp, adsets: [], ads: [] };
        try {
          const [adsetsResp, adsResp] = await Promise.all([
            metaFetch<{ data?: AdAdset[] }>(
              `${camp.id}/adsets?fields=id,name,status,effective_status,daily_budget,lifetime_budget,insights.date_preset(${datePreset}){${INSIGHT_FIELDS}}&limit=20`,
              fetchOpts,
            ),
            metaFetch<{ data?: AdAd[] }>(
              `${camp.id}/ads?fields=id,name,effective_status,configured_status,issues_info,insights.date_preset(${datePreset}){spend,impressions,clicks,ctr,cpc}&limit=20`,
              fetchOpts,
            ),
          ]);
          return {
            ...camp,
            adsets: adsetsResp.data ?? [],
            ads: adsResp.data ?? [],
          };
        } catch (err) {
          logger.warn({ err: (err as Error).message, campId: camp.id }, "ads: adsets/ads fetch failed");
          return { ...camp, adsets: [], ads: [] };
        }
      }),
    );

    return res.json({
      configured: true,
      datePreset,
      accounts: [{ ...account, campaigns: campaignsWithChildren }],
    });
  } catch (err) {
    logger.warn({ err: (err as Error).message }, "ads: meta fetch failed");
    return res.json({ configured: true, accounts: [], error: (err as Error).message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// Promotions CRUD
// ─────────────────────────────────────────────────────────────────────────────

router.get("/admin/promotions", async (req: Request, res: Response) => {
  if (!adminAuth(req, res)) return;
  const rows = await db
    .select()
    .from(promotionsTable)
    .orderBy(desc(promotionsTable.createdAt));
  return res.json({ promotions: rows });
});

router.post("/admin/promotions", async (req: Request, res: Response) => {
  if (!adminAuth(req, res)) return;
  const body = req.body as Record<string, unknown>;
  const [row] = await db
    .insert(promotionsTable)
    .values({
      title: String(body.title ?? ""),
      titleAr: body.titleAr ? String(body.titleAr) : null,
      description: body.description ? String(body.description) : null,
      descriptionAr: body.descriptionAr ? String(body.descriptionAr) : null,
      service: body.service ? String(body.service) : null,
      discountType: String(body.discountType ?? "percent"),
      discountValue: body.discountValue ? Number(body.discountValue) : null,
      packagePrice: body.packagePrice ? Number(body.packagePrice) : null,
      originalPrice: body.originalPrice ? Number(body.originalPrice) : null,
      validFrom: body.validFrom ? new Date(String(body.validFrom)) : null,
      validUntil: body.validUntil ? new Date(String(body.validUntil)) : null,
      targetAudience: body.targetAudience ? String(body.targetAudience) : null,
      status: String(body.status ?? "active"),
      notes: body.notes ? String(body.notes) : null,
    })
    .returning();
  return res.status(201).json({ promotion: row });
});

router.patch("/admin/promotions/:id", async (req: Request, res: Response) => {
  if (!adminAuth(req, res)) return;
  const id = Number(req.params["id"]);
  const body = req.body as Record<string, unknown>;
  const updates: Record<string, unknown> = { updatedAt: new Date() };
  const allowed = [
    "title", "titleAr", "description", "descriptionAr", "service",
    "discountType", "discountValue", "packagePrice", "originalPrice",
    "targetAudience", "status", "notes",
  ];
  for (const key of allowed) {
    if (key in body) updates[key] = body[key];
  }
  if (body.validFrom) updates.validFrom = new Date(String(body.validFrom));
  if (body.validUntil) updates.validUntil = new Date(String(body.validUntil));

  const [row] = await db
    .update(promotionsTable)
    .set(updates)
    .where(eq(promotionsTable.id, id))
    .returning();
  return res.json({ promotion: row });
});

router.delete("/admin/promotions/:id", async (req: Request, res: Response) => {
  if (!adminAuth(req, res)) return;
  const id = Number(req.params["id"]);
  await db.delete(promotionsTable).where(eq(promotionsTable.id, id));
  return res.json({ ok: true });
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/admin/ads/generate-copy — AI Media Kit generator
// ─────────────────────────────────────────────────────────────────────────────

router.post("/admin/ads/generate-copy", async (req: Request, res: Response) => {
  if (!adminAuth(req, res)) return;

  const body = req.body as {
    service?: string;
    promotion?: string;
    audience?: string;
    tone?: string;
    platform?: string;
    language?: string;
  };

  const apiKey = process.env["ANTHROPIC_API_KEY"];
  if (!apiKey) {
    return res.status(503).json({ error: "AI not configured" });
  }

  const client = new Anthropic({ apiKey });

  const platform = body.platform ?? "instagram";
  const language = body.language ?? "both";
  const service = body.service ?? "hair extensions";
  const promotion = body.promotion ?? "";
  const audience = body.audience ?? "women in Cairo interested in beauty";
  const tone = body.tone ?? "luxury, warm, confident";

  const prompt = `You are a senior social media copywriter for TransforM Egypt — a luxury beauty salon in Cairo with branches in City Stars Mall, Sofitel Downtown, and O Mall New Alamein.

Generate ready-to-use ad copy for the following:
- Platform: ${platform}
- Service: ${service}
- Promotion: ${promotion || "No specific promotion — focus on quality and luxury"}
- Target audience: ${audience}
- Tone: ${tone}
- Language: ${language === "both" ? "Write BOTH English and Arabic versions" : language === "ar" ? "Arabic only" : "English only"}

Output EXACTLY this JSON structure (no markdown, no extra text):
{
  "headline": "Short punchy headline (max 8 words)",
  "headlineAr": "Arabic headline (only if language includes Arabic)",
  "primaryText": "Instagram/Facebook primary text (2-3 short paragraphs, include relevant emojis, end with CTA)",
  "primaryTextAr": "Arabic version (only if language includes Arabic)",
  "caption": "Instagram caption variant (shorter, more personal, hashtags at end)",
  "captionAr": "Arabic caption variant (only if language includes Arabic)",
  "ctaButton": "One of: Book Now, Learn More, Contact Us, Shop Now, Get Offer",
  "hashtags": ["array", "of", "relevant", "hashtags", "in", "English"],
  "hashtagsAr": ["مصفوفة", "وسوم", "عربية"],
  "imagePrompt": "A vivid description of the ideal image/visual for this ad (what to photograph or design)"
}`;

  try {
    const response = await client.messages.create({
      model: "claude-sonnet-4-5",
      max_tokens: 1500,
      messages: [{ role: "user", content: prompt }],
    });

    const text = response.content
      .filter((b) => b.type === "text")
      .map((b) => b.text)
      .join("");

    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return res.status(500).json({ error: "AI returned invalid format" });
    }

    const copy = JSON.parse(jsonMatch[0]) as Record<string, unknown>;
    return res.json({ copy });
  } catch (err) {
    logger.error({ err: (err as Error).message }, "ads: copy generation failed");
    return res.status(500).json({ error: (err as Error).message });
  }
});

export default router;

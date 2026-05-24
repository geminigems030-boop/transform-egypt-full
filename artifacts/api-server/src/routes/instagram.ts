import { Router, type IRouter } from "express";
import { metaFetch, META_IG_BIZ_ID, isMetaConfigured } from "../lib/meta-graph";

const router: IRouter = Router();

interface IGFeedItem {
  id: string;
  caption?: string;
  media_type: "IMAGE" | "VIDEO" | "CAROUSEL_ALBUM";
  media_url: string;
  thumbnail_url?: string;
  permalink: string;
  timestamp: string;
}

// In-memory cache. Meta rate-limits Graph ~200 calls/hour per user; the IG
// feed shows on every Home page load so we cache for 15min and serve stale
// on Graph errors.
let cache: { data: IGFeedItem[]; expires: number } | null = null;
const CACHE_MS = 15 * 60 * 1000;

router.get("/instagram/feed", async (req, res) => {
  if (!isMetaConfigured()) {
    return res.status(503).json({ error: "Instagram feed not configured" });
  }
  const now = Date.now();
  if (cache && cache.expires > now) {
    res.set("X-Cache", "HIT");
    res.set("Cache-Control", "public, max-age=900");
    return res.json({ data: cache.data, cached: true });
  }
  try {
    const limit = Math.min(Math.max(Number(req.query["limit"]) || 12, 1), 25);
    const json = await metaFetch<{ data: IGFeedItem[] }>(
      `${META_IG_BIZ_ID}/media?fields=id,caption,media_type,media_url,thumbnail_url,permalink,timestamp&limit=${limit}`,
    );
    cache = { data: json.data || [], expires: now + CACHE_MS };
    res.set("Cache-Control", "public, max-age=900");
    res.set("X-Cache", "MISS");
    return res.json({ data: json.data || [], cached: false });
  } catch (err) {
    req.log.error(
      { err: (err as Error).message },
      "instagram/feed fetch failed",
    );
    if (cache) {
      res.set("X-Cache", "STALE");
      return res.json({ data: cache.data, cached: true, stale: true });
    }
    return res.status(502).json({ error: "Failed to fetch Instagram feed" });
  }
});

export default router;

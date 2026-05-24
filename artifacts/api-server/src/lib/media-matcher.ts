// ─────────────────────────────────────────────────────────────────────────────
// media-matcher.ts — finds relevant Instagram posts/reels for a customer query.
//
// Fetches the brand's own IG feed (same Meta Graph endpoint used by the
// website's homepage carousel) and scores each post against the customer's
// message using token overlap.  Arabic prefix handling (+ال/وال/فال) ensures
// reasonable matching without a full stemmer.  Result is sent as a follow-up
// DM via ManyChat so the customer can see/tap the real post.
//
// Feed is cached for 15 min to stay within Meta Graph rate limits.
// ─────────────────────────────────────────────────────────────────────────────

import { metaFetch, META_IG_BIZ_ID, isMetaConfigured } from "./meta-graph";
import { logger } from "./logger";

interface FeedItem {
  id: string;
  caption?: string;
  media_type: "IMAGE" | "VIDEO" | "CAROUSEL_ALBUM";
  media_url: string;
  thumbnail_url?: string;
  permalink: string;
  timestamp: string;
}

interface FeedCache {
  items: FeedItem[];
  expiresAt: number;
}

let _feedCache: FeedCache | null = null;

async function getIgFeed(): Promise<FeedItem[]> {
  if (_feedCache && Date.now() < _feedCache.expiresAt) {
    return _feedCache.items;
  }
  if (!isMetaConfigured()) return [];
  try {
    const json = await metaFetch<{ data: FeedItem[] }>(
      `${META_IG_BIZ_ID}/media?fields=id,caption,media_type,media_url,thumbnail_url,permalink,timestamp&limit=50`,
    );
    const items = json.data || [];
    _feedCache = { items, expiresAt: Date.now() + 15 * 60 * 1000 };
    logger.info({ count: items.length }, "media-matcher: IG feed cached");
    return items;
  } catch (err) {
    logger.warn(
      { err: (err as Error).message },
      "media-matcher: feed fetch failed — serving stale or empty",
    );
    return _feedCache?.items ?? [];
  }
}

// ── Tokenisation ──────────────────────────────────────────────────────────────
// Strip common Arabic definite-article prefixes so "الكليب" matches "كليب",
// "والشعر" matches "شعر", etc.  Also lower-cases for Latin tokens.
const AR_PREFIXES = /^(ولل|وال|فال|بال|لل|ال|و|ف|ب|ك|ل)/u;

function normalise(token: string): string {
  return token.replace(AR_PREFIXES, "").toLowerCase();
}

function tokenise(text: string): string[] {
  return text
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .map((t) => normalise(t))
    .filter((t) => t.length >= 3);
}

// Score: count how many customer tokens appear as a substring inside any
// caption token (or vice-versa).  Substring matching handles Arabic morphology
// better than exact equality.
function scoreOverlap(customerTokens: string[], captionText: string): number {
  const capTokens = tokenise(captionText);
  let score = 0;
  for (const ct of customerTokens) {
    for (const capT of capTokens) {
      if (capT.includes(ct) || ct.includes(capT)) {
        score++;
        break; // each customer token counts once
      }
    }
  }
  return score;
}

// ── Public API ─────────────────────────────────────────────────────────────────

export interface PostMatch {
  permalink: string;
  mediaType: "IMAGE" | "VIDEO" | "CAROUSEL_ALBUM";
  score: number;
}

/**
 * Find the most relevant Instagram post/reel whose caption matches the
 * customer's message.  Returns null when no strong match exists (score < 2)
 * or when the feed is unavailable.
 *
 * Call this AFTER generating Yara's text reply, then send the permalink as a
 * separate follow-up message via ManyChat so the customer can view the real post.
 */
export async function findRelevantPost(
  customerText: string,
): Promise<PostMatch | null> {
  try {
    const feed = await getIgFeed();
    if (feed.length === 0) return null;

    const customerTokens = tokenise(customerText);
    if (customerTokens.length === 0) return null;

    let bestScore = 0;
    let bestItem: FeedItem | null = null;

    for (const item of feed) {
      if (!item.caption) continue;

      let score = scoreOverlap(customerTokens, item.caption);

      // Slight boost for reels (VIDEO) — more engaging than static posts.
      if (item.media_type === "VIDEO" && score > 0) score += 0.5;

      if (score > bestScore) {
        bestScore = score;
        bestItem = item;
      }
    }

    // Require at least 2 overlapping tokens to avoid weak/accidental matches.
    if (bestScore < 2 || !bestItem) return null;

    logger.info(
      { score: bestScore, permalink: bestItem.permalink, mediaType: bestItem.media_type },
      "media-matcher: found relevant post",
    );

    return {
      permalink: bestItem.permalink,
      mediaType: bestItem.media_type,
      score: bestScore,
    };
  } catch (err) {
    logger.warn({ err: (err as Error).message }, "media-matcher: match failed");
    return null;
  }
}

/**
 * Invalidate the feed cache (e.g. after a new post is published).
 * The next call to findRelevantPost will re-fetch from Meta Graph.
 */
export function invalidateFeedCache(): void {
  _feedCache = null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Replymind "Memory mode" — historical conversation pairs as few-shot
// examples for the AI agent.
//
// Two exports:
//   • findRelevantExemplars  — runtime: pick the top-K past (customer→reply)
//     pairs whose customer message most overlaps with the new inbound text
//     (simple keyword Jaccard). Same channel + same language only.
//   • backfillExemplarsFromMeta — admin one-shot: pull last N days of DM
//     history from the Meta Graph API on both `instagram` and `messenger`
//     platforms, pair each customer message with the team's next reply,
//     drop templated replies (same outbound text appearing 3+ times to
//     different threads), and bulk-insert into `inbox_exemplars`.
//
// Both functions are best-effort: failures are logged and the request still
// succeeds with whatever exemplars we have (zero is fine — the agent then
// falls back to its built-in BRAND_SYSTEM_PROMPT only).
// ─────────────────────────────────────────────────────────────────────────────

import { and, eq, sql } from "drizzle-orm";
import { db } from "@workspace/db";
import { inboxExemplarsTable } from "@workspace/db/schema";
import {
  fetchPageConversationsPage,
  META_PAGE_ID,
  META_IG_BIZ_ID,
  type MetaConversation,
  type MetaConversationMessage,
} from "./meta-graph";
import { detectLanguage } from "./ai-reply";
import { logger } from "./logger";

// ── Tokenization for keyword scoring ─────────────────────────────────────────
// Stopwords curated from the most common low-signal tokens in Egyptian
// Arabic and English DMs. Keeping the lists short means we still score on
// weak signals like "price" or "color" which is what we want.
const STOPWORDS_EN = new Set([
  "the", "a", "an", "is", "are", "of", "to", "in", "on", "for", "and", "or",
  "but", "i", "you", "we", "they", "my", "your", "our", "it", "this", "that",
  "do", "can", "will", "would", "could", "should", "have", "has", "had",
  "be", "been", "was", "were", "at", "from", "by", "with", "as", "please",
  "hi", "hello", "hey", "thanks", "thank", "ok", "okay", "yes", "no",
]);
const STOPWORDS_AR = new Set([
  "من", "الى", "إلى", "في", "على", "عن", "هل", "كم", "ما", "ماذا", "مع",
  "هو", "هي", "أنا", "نحن", "أنت", "أنتم", "هم", "هن", "هذا", "هذه", "ذلك",
  "تلك", "يا", "كان", "لو", "ان", "إن", "أن", "لا", "نعم", "ليه", "ليش",
  "ازاي", "ازي", "عاوز", "عايز", "عايزة", "بس", "كده", "كدا",
]);

function tokenize(text: string): Set<string> {
  if (!text) return new Set();
  const tokens = text
    .toLowerCase()
    .normalize("NFKC")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter(
      (t) => t.length >= 2 && !STOPWORDS_EN.has(t) && !STOPWORDS_AR.has(t),
    );
  return new Set(tokens);
}

// ── Runtime retrieval ────────────────────────────────────────────────────────
// Score each candidate by # of shared tokens with the inbound message; return
// the top K with at least one shared token. We cap the candidate pool at 500
// rows (channel+language indexed) which is plenty for our scale and keeps the
// in-memory scoring under a few ms per call.
export async function findRelevantExemplars(args: {
  inboundText: string;
  channel: "dm" | "comment";
  language: "ar" | "en";
  limit?: number;
}): Promise<Array<{ inbound: string; outbound: string }>> {
  const limit = args.limit ?? 5;
  const queryTokens = tokenize(args.inboundText);
  if (queryTokens.size === 0) return [];

  try {
    const rows = await db
      .select({
        inboundText: inboxExemplarsTable.inboundText,
        outboundText: inboxExemplarsTable.outboundText,
      })
      .from(inboxExemplarsTable)
      .where(
        and(
          eq(inboxExemplarsTable.channel, args.channel),
          eq(inboxExemplarsTable.language, args.language),
        ),
      )
      .limit(500);

    const scored = rows
      .map((r) => {
        const docTokens = tokenize(r.inboundText);
        let overlap = 0;
        for (const t of queryTokens) if (docTokens.has(t)) overlap++;
        return { ...r, score: overlap };
      })
      .filter((s) => s.score >= 1)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);

    logger.info(
      {
        channel: args.channel,
        language: args.language,
        candidates: rows.length,
        matched: scored.length,
        topScore: scored[0]?.score ?? 0,
      },
      "exemplars: retrieved for prompt",
    );

    return scored.map((s) => ({
      inbound: s.inboundText,
      outbound: s.outboundText,
    }));
  } catch (err) {
    logger.warn(
      { err: (err as Error).message },
      "exemplars: retrieval failed (falling back to no exemplars)",
    );
    return [];
  }
}

export async function getExemplarsCount(): Promise<number> {
  try {
    const r = await db.execute(
      sql`SELECT COUNT(*)::int AS n FROM inbox_exemplars;`,
    );
    const rows = (r as unknown as { rows: Array<{ n: number }> }).rows;
    return rows[0]?.n ?? 0;
  } catch {
    return 0;
  }
}

// ── Backfill from Meta Graph API ─────────────────────────────────────────────
interface RawPair {
  channel: "dm";
  inboundText: string;
  outboundText: string;
  sourceMetaId: string;
  sourcePlatform: "instagram" | "facebook";
}

export interface BackfillResult {
  scanned: { conversations: number; messages: number };
  pairs: number;
  inserted: number;
  skippedTemplates: number;
  skippedDuplicates: number;
  byLanguage: { ar: number; en: number };
  errors: string[];
}

/**
 * One-shot backfill. Pulls last `sinceDays` of DM history on both Instagram
 * and Facebook, builds (customer→reply) pairs, drops templated outbound
 * replies, and inserts into inbox_exemplars. Idempotent — re-running is safe
 * because each pair is keyed by the outbound message's Meta id (unique).
 */
export async function backfillExemplarsFromMeta(args: {
  sinceDays?: number;
  maxConvosPerPlatform?: number;
}): Promise<BackfillResult> {
  const sinceDays = args.sinceDays ?? 90;
  const maxConvos = args.maxConvosPerPlatform ?? 200;
  const sinceTs = Date.now() - sinceDays * 86_400_000;

  const result: BackfillResult = {
    scanned: { conversations: 0, messages: 0 },
    pairs: 0,
    inserted: 0,
    skippedTemplates: 0,
    skippedDuplicates: 0,
    byLanguage: { ar: 0, en: 0 },
    errors: [],
  };

  const ourIds = new Set([META_PAGE_ID, META_IG_BIZ_ID].filter(Boolean));
  const allPairs: RawPair[] = [];

  for (const platform of ["messenger", "instagram"] as const) {
    let after: string | undefined = undefined;
    let scannedHere = 0;
    // IG conversations endpoint is sensitive to large fanout; using smaller
    // page + per-convo limits keeps Meta from returning "Please reduce the
    // amount of data" timeouts. Messenger tolerates the larger window.
    const pageLimit = platform === "instagram" ? 10 : 25;
    const messagesPerConvo = platform === "instagram" ? 10 : 25;

    while (scannedHere < maxConvos) {
      try {
        const page = await fetchPageConversationsPage({
          platform,
          after,
          pageLimit,
          messagesPerConvo,
        });
        const convos = page.data || [];
        if (convos.length === 0) break;
        scannedHere += convos.length;
        result.scanned.conversations += convos.length;

        for (const convo of convos) {
          const pairs = extractPairsFromConversation(convo, ourIds, sinceTs);
          result.scanned.messages += convo.messages?.data?.length ?? 0;
          for (const p of pairs) {
            allPairs.push({
              channel: "dm",
              inboundText: p.inboundText,
              outboundText: p.outboundText,
              sourceMetaId: p.sourceMetaId,
              sourcePlatform: platform === "messenger" ? "facebook" : "instagram",
            });
          }
        }

        const next = page.paging?.cursors?.after;
        if (!next || next === after) break;
        after = next;
      } catch (err) {
        const msg = (err as Error).message;
        result.errors.push(`${platform}: ${msg}`);
        logger.error(
          { err: msg, platform, after },
          "exemplars: backfill page failed",
        );
        break;
      }
    }
  }

  // Templated-reply detection: any outbound text appearing 3+ times across
  // distinct pairs is treated as a Meta Business Suite saved-reply template
  // and dropped (we want only authentic team voice).
  const counts = new Map<string, number>();
  for (const p of allPairs) {
    const norm = p.outboundText.trim();
    counts.set(norm, (counts.get(norm) || 0) + 1);
  }
  const templates = new Set<string>();
  for (const [text, n] of counts.entries()) if (n >= 3) templates.add(text);

  // Insert one-by-one with ON CONFLICT DO NOTHING (sourceMetaId unique). Could
  // be batched but our N is small (hundreds at most) and per-row error
  // handling here is more useful than a single bulk failure.
  for (const p of allPairs) {
    if (templates.has(p.outboundText.trim())) {
      result.skippedTemplates++;
      continue;
    }
    result.pairs++;
    try {
      const language = detectLanguage(p.inboundText);
      const inserted = await db
        .insert(inboxExemplarsTable)
        .values({
          channel: p.channel,
          language,
          inboundText: p.inboundText,
          outboundText: p.outboundText,
          sourceMetaId: p.sourceMetaId,
          sourcePlatform: p.sourcePlatform,
        })
        .onConflictDoNothing()
        .returning({ id: inboxExemplarsTable.id });
      if (inserted.length > 0) {
        result.inserted++;
        result.byLanguage[language]++;
      } else {
        result.skippedDuplicates++;
      }
    } catch (err) {
      result.errors.push((err as Error).message);
    }
  }

  logger.info(result, "exemplars: backfill complete");
  return result;
}

// Walk a conversation chronologically and emit (inbound, outbound) pairs.
//
// Customers and team members both often send a burst of consecutive messages
// before the other side replies. To capture that faithfully we:
//   • collapse consecutive same-side messages into a single "turn" (joined
//     with " " up to 1000 chars), then
//   • for each outbound turn whose immediately preceding turn is inbound,
//     emit one pair.
// This fixes two bugs in the naive pairwise walk: (1) when a customer sends
// 3 messages then we reply, only the LAST customer message would be paired
// (lost context); (2) when we reply with 2 consecutive messages, the second
// one would be discarded entirely.
function extractPairsFromConversation(
  convo: MetaConversation,
  ourIds: Set<string>,
  sinceTs: number,
): Array<{ inboundText: string; outboundText: string; sourceMetaId: string }> {
  const msgs = convo.messages?.data || [];
  if (msgs.length < 2) return [];

  const sorted = [...msgs].sort(
    (a, b) =>
      new Date(a.created_time || 0).getTime() -
      new Date(b.created_time || 0).getTime(),
  );

  type Turn = {
    fromUs: boolean;
    text: string;
    lastTs: number;
    lastId: string;
  };
  const turns: Turn[] = [];
  for (const m of sorted) {
    const text = (m.message || "").trim();
    if (!text) continue;
    const fromUs = isFromUs(m, ourIds);
    const ts = new Date(m.created_time || 0).getTime();
    const id = m.id || `${convo.id || "x"}_${m.created_time || ""}`;
    const last = turns[turns.length - 1];
    if (last && last.fromUs === fromUs && (last.text + " " + text).length <= 1000) {
      last.text = (last.text + " " + text).trim();
      last.lastTs = ts;
      last.lastId = id;
    } else {
      turns.push({ fromUs, text, lastTs: ts, lastId: id });
    }
  }

  const pairs: Array<{
    inboundText: string;
    outboundText: string;
    sourceMetaId: string;
  }> = [];
  for (let i = 1; i < turns.length; i++) {
    const out = turns[i]!;
    const prev = turns[i - 1]!;
    if (!out.fromUs || prev.fromUs) continue;
    if (out.lastTs < sinceTs) continue;
    pairs.push({
      inboundText: prev.text,
      outboundText: out.text,
      sourceMetaId: out.lastId || `convo_${convo.id || "x"}_${i}`,
    });
  }
  return pairs;
}

function isFromUs(m: MetaConversationMessage, ourIds: Set<string>): boolean {
  const id = m.from?.id;
  if (!id) return false;
  return ourIds.has(id);
}

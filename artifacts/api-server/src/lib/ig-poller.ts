// ─────────────────────────────────────────────────────────────────────────────
// Instagram DM Poller — fallback until Meta App Review grants webhook access.
//
// Uses a two-step approach to stay within Meta's Instagram API limits:
//   Step 1: GET /me/conversations?platform=instagram  — only id + updated_time
//           (minimal payload, no nested messages)
//   Step 2: For each conversation updated since last poll, GET its latest
//           message via /{convo-id}/messages?limit=1
//
// This is much lighter than requesting nested messages inline, which causes
// "Please reduce the amount of data" errors on accounts with many threads.
//
// Multi-process safety: uses pg_try_advisory_lock so only one process polls
// per cycle; the others skip silently and try again next interval.
// ─────────────────────────────────────────────────────────────────────────────

import {
  metaFetch,
  isMetaConfigured,
  META_PAGE_ID,
  META_IG_BIZ_ID,
} from "./meta-graph";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { logger } from "./logger";
import { getWebhookDmsSeen } from "./poller-state";
import { processInboundInstagramDm } from "../routes/webhooks";

const POLL_INTERVAL_MS = 10 * 60 * 1000; // 10 min — endpoint unreliable without Advanced Access
const SLOW_INTERVAL_MS = 10 * 60 * 1000; // 10 min once webhooks work
const CONVO_LIST_LIMIT = 5;              // conversations to list per poll
const FETCH_TIMEOUT_MS = 25_000;         // give Meta enough time to respond
const ADVISORY_LOCK_KEY = 0x4947504f4c4c; // "IGPOLL"

const OUR_IDS = new Set(
  [META_PAGE_ID, META_IG_BIZ_ID].filter(Boolean),
);

let lastPolledAt = Date.now() - 5 * 60 * 1000;
let timer: ReturnType<typeof setTimeout> | null = null;

async function tryAdvisoryLock(): Promise<boolean> {
  try {
    const r = await db.execute(
      sql`SELECT pg_try_advisory_lock(${ADVISORY_LOCK_KEY}) AS acquired`,
    );
    const rows = (r as unknown as { rows: Array<{ acquired: boolean }> }).rows;
    return rows[0]?.acquired === true;
  } catch {
    return false;
  }
}

async function releaseAdvisoryLock(): Promise<void> {
  try {
    await db.execute(sql`SELECT pg_advisory_unlock(${ADVISORY_LOCK_KEY})`);
  } catch { /* ignore */ }
}

interface ConvoListItem {
  id?: string;
  updated_time?: string;
}

interface ConvoMessage {
  id?: string;
  message?: string;
  created_time?: string;
  from?: { id?: string; name?: string };
}

async function poll(): Promise<void> {
  if (!isMetaConfigured()) return;

  const interval = getWebhookDmsSeen() > 0 ? SLOW_INTERVAL_MS : POLL_INTERVAL_MS;

  const locked = await tryAdvisoryLock();
  if (!locked) {
    timer = setTimeout(() => void poll(), interval);
    return;
  }

  const windowStart = lastPolledAt - 60_000;
  const pollStart = Date.now();

  logger.info(
    { windowStart: new Date(windowStart).toISOString() },
    "ig-poller: starting poll",
  );

  let processed = 0;
  let errors = 0;

  try {
    // Step 1: get conversation IDs + updated_time only (tiny payload).
    const ac1 = new AbortController();
    const t1 = setTimeout(() => ac1.abort(), FETCH_TIMEOUT_MS);
    const listResp = await metaFetch<{ data?: ConvoListItem[] }>(
      `${META_PAGE_ID}/conversations?platform=instagram&fields=id,updated_time&limit=${CONVO_LIST_LIMIT}`,
      { signal: ac1.signal },
    ).finally(() => clearTimeout(t1));

    const recentConvos = (listResp.data ?? []).filter((c) => {
      if (!c.updated_time) return false;
      return new Date(c.updated_time).getTime() >= windowStart;
    });

    logger.info(
      { total: listResp.data?.length ?? 0, recent: recentConvos.length },
      "ig-poller: conversations scanned",
    );

    // Step 2: for each recently-updated conversation, fetch only its
    // latest message (separate small request per conversation).
    for (const convo of recentConvos) {
      if (!convo.id) continue;
      try {
        const msgResp = await metaFetch<{ data?: ConvoMessage[] }>(
          `${convo.id}/messages?fields=id,message,created_time,from&limit=3`,
        );

        for (const msg of msgResp.data ?? []) {
          const createdMs = msg.created_time
            ? new Date(msg.created_time).getTime()
            : 0;
          if (createdMs < windowStart) continue;

          const fromId = msg.from?.id;
          const mid = msg.id;
          const text = msg.message ?? null;

          if (!fromId || !mid || OUR_IDS.has(fromId)) continue;

          try {
            await processInboundInstagramDm({ senderId: fromId, mid, text });
            processed++;
          } catch (err) {
            errors++;
            logger.warn(
              { err: (err as Error).message, mid },
              "ig-poller: failed to process message",
            );
          }
        }
      } catch (err) {
        errors++;
        logger.warn(
          { err: (err as Error).message, convoId: convo.id },
          "ig-poller: failed to fetch messages for conversation",
        );
      }
    }

    lastPolledAt = pollStart;
    logger.info({ processed, errors }, "ig-poller: poll complete");
  } catch (err) {
    logger.warn(
      { err: (err as Error).message },
      "ig-poller: poll failed (will retry next interval)",
    );
  } finally {
    await releaseAdvisoryLock();
    timer = setTimeout(() => void poll(), interval);
  }
}

export function startIgPoller(): void {
  if (!isMetaConfigured()) {
    logger.info("ig-poller: Meta not configured; skipping");
    return;
  }
  if (timer !== null) return;

  logger.info({ intervalMs: POLL_INTERVAL_MS }, "ig-poller: started");
  const jitter = Math.floor(Math.random() * 10_000);
  timer = setTimeout(() => void poll(), 15_000 + jitter);
}

export function stopIgPoller(): void {
  if (timer !== null) {
    clearTimeout(timer);
    timer = null;
  }
}

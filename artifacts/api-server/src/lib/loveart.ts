/**
 * Loveart AI API client — hair/beauty transformation image generation.
 *
 * Credentials format:
 *   Access Key: ak_...
 *   Secret Key:  sk_...
 *
 * The API base URL is discovered from environment; fallbacks are tried
 * in order so the client is resilient even if the exact host changes.
 */

import { logger } from "./logger";

const ACCESS_KEY = process.env["LOVEART_ACCESS_KEY"] ?? "";
const SECRET_KEY = process.env["LOVEART_SECRET_KEY"] ?? "";

const BASE_URLS = [
  process.env["LOVEART_API_URL"],
  "https://api.loveart.ai",
  "https://loveart.ai/api",
].filter(Boolean) as string[];

export interface LoveartTransformRequest {
  image_url: string;
  prompt?: string;
  style?: string;
  color?: string;
  treatment?: string;
  hair_length?: "short" | "medium" | "long" | "extra_long";
  hair_volume?: "natural" | "voluminous" | "full";
}

export interface LoveartTransformResponse {
  success: boolean;
  image_url?: string;
  error?: string;
  job_id?: string;
  status?: string;
}

/** Return the first base URL that responds with valid JSON on /health or /status. */
async function resolveBaseUrl(): Promise<string | null> {
  for (const url of BASE_URLS) {
    try {
      const res = await fetch(`${url}/v1/status`, {
        headers: {
          "X-API-Key": ACCESS_KEY,
          "X-API-Secret": SECRET_KEY,
        },
        signal: AbortSignal.timeout(4000),
      });
      if (!res.ok) continue;
      // Verify it returns JSON, not an HTML fallback page
      const contentType = res.headers.get("content-type") || "";
      const body = await res.text();
      if (!contentType.includes("application/json") && body.trim().startsWith("<")) {
        logger.warn({ url }, "loveart: endpoint returned HTML instead of JSON — skipping");
        continue;
      }
      // Attempt JSON parse to confirm it's a real API response
      try {
        JSON.parse(body);
        logger.info({ url }, "loveart: resolved API base URL");
        return url;
      } catch {
        logger.warn({ url, bodyPreview: body.slice(0, 60) }, "loveart: endpoint returned non-JSON body");
        continue;
      }
    } catch {
      /* try next */
    }
  }
  return null;
}

let resolvedBase: string | null = null;

async function getBase(): Promise<string | null> {
  if (resolvedBase) return resolvedBase;
  resolvedBase = await resolveBaseUrl();
  return resolvedBase;
}

/**
 * Generate a hair/beauty transformation image.
 *
 * The request can be tuned with any combination of:
 * - prompt: free-form text describing the desired result
 * - style: e.g. "tape-in extensions", "keratin treatment", "microblading"
 * - color: e.g. "honey blonde", "jet black", "chestnut brown"
 * - treatment: e.g. "hair extensions", "volume boost", "color change"
 * - hair_length / hair_volume: structured enums the API may use
 */
export async function generateTransformation(
  req: LoveartTransformRequest,
): Promise<LoveartTransformResponse> {
  if (!ACCESS_KEY || !SECRET_KEY) {
    return { success: false, error: "Loveart credentials not configured" };
  }

  const base = await getBase();
  if (!base) {
    return { success: false, error: "Loveart API unreachable" };
  }

  try {
    const res = await fetch(`${base}/v1/generate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-Key": ACCESS_KEY,
        "X-API-Secret": SECRET_KEY,
      },
      body: JSON.stringify(req),
      signal: AbortSignal.timeout(30000),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      logger.warn(
        { status: res.status, bodyPreview: text.slice(0, 200) },
        "loveart: generate request failed",
      );
      return { success: false, error: `Loveart API error ${res.status}` };
    }

    const data = (await res.json()) as LoveartTransformResponse;
    logger.info(
      { success: data.success, hasImage: !!data.image_url },
      "loveart: transformation generated",
    );
    return data;
  } catch (err) {
    logger.error(
      { err: (err as Error).message },
      "loveart: generate request crashed",
    );
    return { success: false, error: (err as Error).message };
  }
}

/**
 * Poll a job by ID if the API is async.
 */
export async function pollJob(jobId: string): Promise<LoveartTransformResponse> {
  const base = await getBase();
  if (!base) {
    return { success: false, error: "Loveart API unreachable" };
  }

  try {
    const res = await fetch(`${base}/v1/jobs/${jobId}`, {
      headers: {
        "X-API-Key": ACCESS_KEY,
        "X-API-Secret": SECRET_KEY,
      },
      signal: AbortSignal.timeout(10000),
    });

    if (!res.ok) {
      return { success: false, error: `Poll error ${res.status}` };
    }
    return (await res.json()) as LoveartTransformResponse;
  } catch (err) {
    return { success: false, error: (err as Error).message };
  }
}

/**
 * Health check — returns true if credentials are present and the API responds.
 */
export async function healthCheck(): Promise<boolean> {
  return (await getBase()) !== null;
}

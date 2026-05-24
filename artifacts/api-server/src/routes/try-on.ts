import { Router, type IRouter, type Request, type Response } from "express";
import { generateTransformation, healthCheck } from "../lib/loveart";
import { logger } from "../lib/logger";

const router: IRouter = Router();

// ── POST /api/try-on ──────────────────────────────────────────────────────────
// Accept a user photo URL + transformation options, call Loveart AI,
// and return the generated image URL.
//
// Body:
//   image_url  (string, required)  — public URL of the user's photo
//   treatment  (string, optional)  — "hair_extensions", "volume", "color_change",
//                                    "hair_transplant", "microblading", "lash"
//   style      (string, optional)  — e.g. "tape-in", "keratin", "micropigmentation"
//   color      (string, optional)  — e.g. "honey blonde", "jet black"
//   hair_length (string, optional) — "short", "medium", "long", "extra_long"
//   hair_volume (string, optional) — "natural", "voluminous", "full"
//   prompt     (string, optional)  — free-form override (rarely needed)
//
// Response:
//   { success: true, image_url: "...", job_id?: "..." }
//   { success: false, error: "..." }

router.post("/try-on", async (req: Request, res: Response) => {
  try {
    const {
      image_url,
      treatment,
      style,
      color,
      hair_length,
      hair_volume,
      prompt,
    } = req.body ?? {};

    if (!image_url || typeof image_url !== "string") {
      return res.status(400).json({
        success: false,
        error: "Missing image_url — provide a public URL of the user's photo",
      });
    }

    // Build a rich prompt from the structured fields if no explicit prompt given.
    const derivedPrompt =
      prompt ||
      buildPrompt({ treatment, style, color, hair_length, hair_volume });

    logger.info(
      {
        treatment,
        style,
        color,
        hair_length,
        hair_volume,
        promptPreview: derivedPrompt.slice(0, 80),
      },
      "try-on: generating transformation",
    );

    const result = await generateTransformation({
      image_url,
      prompt: derivedPrompt,
      style,
      color,
      treatment,
      hair_length,
      hair_volume,
    });

    if (!result.success) {
      logger.warn({ error: result.error }, "try-on: generation failed");
      return res.status(502).json(result);
    }

    return res.json({
      success: true,
      image_url: result.image_url,
      job_id: result.job_id,
    });
  } catch (err) {
    logger.error(
      { err: (err as Error).message },
      "try-on: handler crashed",
    );
    return res.status(500).json({
      success: false,
      error: "Internal server error",
    });
  }
});

// ── GET /api/try-on/health ──────────────────────────────────────────────────
// Quick health check the frontend can call on page load to show/hide the
// feature or display a "coming soon" banner.

router.get("/try-on/health", async (_req: Request, res: Response) => {
  const ok = await healthCheck();
  return res.json({ ok, configured: !!(process.env["LOVEART_ACCESS_KEY"] && process.env["LOVEART_SECRET_KEY"]) });
});

// ── Prompt builder ────────────────────────────────────────────────────────────
function buildPrompt(opts: {
  treatment?: string;
  style?: string;
  color?: string;
  hair_length?: string;
  hair_volume?: string;
}): string {
  const parts: string[] = [];

  const treatmentMap: Record<string, string> = {
    hair_extensions: "add hair extensions for volume and length",
    volume: "boost hair volume and fullness",
    color_change: "change hair color",
    hair_transplant: "show hair transplant results with denser hairline",
    microblading: "add microbladed eyebrows",
    lash: "add volume lash extensions",
    micropigmentation: "add scalp micropigmentation for denser-looking hair",
  };

  if (opts.treatment && treatmentMap[opts.treatment]) {
    parts.push(treatmentMap[opts.treatment]);
  } else if (opts.treatment) {
    parts.push(opts.treatment);
  }

  if (opts.style) parts.push(`using ${opts.style} technique`);
  if (opts.color) parts.push(`in ${opts.color} color`);
  if (opts.hair_length) parts.push(`${opts.hair_length} length`);
  if (opts.hair_volume) parts.push(`${opts.hair_volume} volume`);

  if (parts.length === 0) {
    return "enhance the hair with professional salon-quality styling";
  }

  return `Professional beauty salon transformation: ${parts.join(", ")}. Keep the same face, lighting, and background. Realistic, high-quality result.`;
}

export default router;

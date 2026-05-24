import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { reviewsTable } from "@workspace/db/schema";

const router: IRouter = Router();

router.get("/reviews", async (req, res) => {
  try {
    const reviews = await db.select().from(reviewsTable);
    
    const mapped = reviews.map(r => ({
      id: r.id,
      clientName: r.clientName,
      clientImage: r.clientImage ?? undefined,
      rating: Number(r.rating),
      text: r.text,
      textAr: r.textAr,
      service: r.service,
      date: r.date.toISOString(),
    }));

    res.json({ reviews: mapped });
  } catch (err) {
    req.log.error({ err }, "Error listing reviews");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;

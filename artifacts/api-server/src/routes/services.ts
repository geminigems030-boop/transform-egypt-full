import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { servicesTable } from "@workspace/db/schema";

const router: IRouter = Router();

router.get("/services", async (req, res) => {
  try {
    const services = await db.select().from(servicesTable);
    
    const mapped = services.map(s => ({
      id: s.id,
      name: s.name,
      nameAr: s.nameAr,
      description: s.description,
      descriptionAr: s.descriptionAr,
      startingPrice: Number(s.startingPrice),
      image: s.image,
      isFeatured: s.isFeatured,
      badge: s.badge ?? undefined,
    }));

    res.json({ services: mapped });
  } catch (err) {
    req.log.error({ err }, "Error listing services");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;

import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
  import { desc, eq } from "drizzle-orm";
  import { db } from "@workspace/db";
  import { appointmentsTable, submissionsTable } from "@workspace/db/schema";
  import { logger } from "../lib/logger";

  const router: IRouter = Router();

  function adminAuth(req: Request, res: Response, next: NextFunction) {
    const expected = process.env["ADMIN_TOKEN"];
    if (!expected || expected.length < 8) return res.status(503).json({ error: "Admin disabled" });
    const provided =
      (typeof req.headers["x-admin-token"] === "string" ? req.headers["x-admin-token"] : "") ||
      (typeof req.headers.authorization === "string" ? req.headers.authorization.replace(/^Bearer\s+/i, "") : "");
    if (provided !== expected) return res.status(401).json({ error: "Unauthorized" });
    return next();
  }

  router.get("/admin/chat-activity", adminAuth, async (_req: Request, res: Response) => {
    try {
      const [yaraAppts, escalations] = await Promise.all([
        db.select().from(appointmentsTable).where(eq(appointmentsTable.source, "yara")).orderBy(desc(appointmentsTable.createdAt)).limit(100),
        db.select().from(submissionsTable).where(eq(submissionsTable.source, "yara_chat_escalation")).orderBy(desc(submissionsTable.createdAt)).limit(100),
      ]);

      const bookingEvents = yaraAppts.map((a) => {
        let customerMessage: string | null = null;
        let yaraReply: string | null = null;
        try {
          if (a.notes) {
            const parsed = JSON.parse(a.notes) as Record<string, unknown>;
            customerMessage = typeof parsed.customerMessage === "string" ? parsed.customerMessage : null;
            yaraReply = typeof parsed.yaraReply === "string" ? parsed.yaraReply : null;
          }
        } catch { /* ignore */ }
        return {
          type: "booking" as const, outcome: "booked" as const,
          id: `booking-${a.id}`, dbId: a.id,
          name: a.clientName ?? null, phone: a.clientPhone,
          service: a.service, branch: a.branch ?? null,
          scheduledAt: a.scheduledAt?.toISOString() ?? null,
          status: a.status, notes: a.notes ?? null,
          customerMessage, yaraReply,
          createdAt: a.createdAt?.toISOString() ?? null,
        };
      });

      const escalationEvents = escalations.map((s) => {
        let customerMessage: string | null = null;
        let yaraReply: string | null = null;
        let reason: string | null = null;
        let sessionId: string | null = null;
        try {
          if (s.message) {
            const parsed = JSON.parse(s.message) as Record<string, unknown>;
            customerMessage = typeof parsed.customerMessage === "string" ? parsed.customerMessage : null;
            yaraReply = typeof parsed.yaraReply === "string" ? parsed.yaraReply : null;
            reason = typeof parsed.reason === "string" ? parsed.reason : null;
            sessionId = typeof parsed.sessionId === "string" ? parsed.sessionId : null;
          }
        } catch { /* ignore */ }
        return {
          type: "escalation" as const, outcome: "escalated" as const,
          id: `escalation-${s.id}`, dbId: s.id,
          name: s.name ?? null, phone: s.phone ?? null,
          customerMessage, yaraReply, reason, sessionId,
          status: s.status, createdAt: s.createdAt?.toISOString() ?? null,
        };
      });

      const all = [...bookingEvents, ...escalationEvents].sort((a, b) => {
        const aT = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const bT = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return bT - aT;
      });

      return res.json({ events: all, total: all.length });
    } catch (err) {
      logger.error({ err }, "chat-activity GET error");
      return res.status(500).json({ error: "Failed to load chat activity" });
    }
  });

  export default router;
  
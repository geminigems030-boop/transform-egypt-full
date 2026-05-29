import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { bookingsTable, appointmentsTable } from "@workspace/db/schema";
import { CreateBookingBody } from "@workspace/api-zod";
import { normalizePhone, findOrCreateClient } from "../lib/crm";
import { notifyTeam } from "../lib/notify-team";
import { createBookingEvent } from "../lib/google-calendar";

const router: IRouter = Router();

// ── POST /bookings ─────────────────────────────────────────────────────────
// Public booking form endpoint.  Writes to the legacy bookings table (for
// backwards compat) AND creates/updates a client profile + appointment record
// so every new booking is immediately visible in the admin CRM.

router.post("/bookings", async (req, res) => {
  try {
    const body = CreateBookingBody.parse(req.body);

    // 1. Insert into legacy bookings table (unchanged behaviour)
    const [booking] = await db
      .insert(bookingsTable)
      .values({
        name: body.name,
        email: body.email,
        phone: body.phone,
        service: body.service,
        date: body.date,
        message: body.message ?? undefined,
      })
      .returning();

    // 2. Mirror into CRM (fire-and-forget so a CRM error never fails the booking)
    (async () => {
      try {
        const phone = normalizePhone(body.phone);

        // Parse the date string from the booking form
        const scheduledAt = new Date(body.date);
        const safeScheduledAt = isNaN(scheduledAt.getTime())
          ? new Date()
          : scheduledAt;

        const clientId = await findOrCreateClient(
          phone,
          body.name ?? undefined,
          body.email ?? undefined,
        );

        await db.insert(appointmentsTable).values({
          clientId,
          clientName: body.name ?? undefined,
          clientPhone: phone,
          service: body.service,
          scheduledAt: safeScheduledAt,
          notes: body.message ?? undefined,
          status: "scheduled",
          source: "booking_form",
        });
      } catch (crmErr) {
        req.log.warn({ crmErr }, "CRM mirror failed for booking");
      }
    })();

    // 3. Notify the team via WhatsApp (fire-and-forget). The new_booking event
    // type is already supported by notify-team.ts but was never wired up here,
    // so website booking-form submissions previously triggered no team alert.
    void notifyTeam({
      type: "new_booking",
      name: body.name,
      phone: body.phone,
      email: body.email,
      service: body.service,
    }).catch((notifyErr) =>
      req.log.warn({ notifyErr }, "team notify failed for booking"),
    );

    // 4. Mirror into the shared Google Calendar (no-op unless configured).
    {
      const parsed = new Date(body.date);
      const hasSpecificTime = !isNaN(parsed.getTime());
      void createBookingEvent({
        clientName: body.name,
        clientPhone: body.phone,
        service: body.service,
        scheduledAt: hasSpecificTime ? parsed : null,
        hasSpecificTime,
        notes: body.message ?? null,
      }).catch((calErr) => req.log.warn({ calErr }, "calendar sync failed for booking"));
    }

    res.status(201).json({
      id: booking.id,
      name: booking.name,
      email: booking.email,
      phone: booking.phone,
      service: booking.service,
      date: booking.date,
      message: booking.message ?? undefined,
      status: booking.status,
      createdAt: booking.createdAt.toISOString(),
    });
  } catch (err) {
    req.log.error({ err }, "Error creating booking");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;

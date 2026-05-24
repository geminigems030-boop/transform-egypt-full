// ─────────────────────────────────────────────────────────────────────────────
// Shared CRM utilities used by ALL appointment ingestion paths:
//   - POST /bookings        (public booking form)
//   - POST /admin/appointments        (admin manual entry)
//   - POST /admin/appointments/upload (CSV/Excel bulk import)
//   - POST /admin/appointments/sync-bookings (legacy backfill)
//
// Having one canonical normalizer + find-or-create ensures that the same
// person always maps to the same client record regardless of entry path.
// ─────────────────────────────────────────────────────────────────────────────

import { and, eq, sql } from "drizzle-orm";
import { db } from "@workspace/db";
import { clientsTable } from "@workspace/db/schema";

// ── Phone normalisation ────────────────────────────────────────────────────────
//
// Egyptian mobile numbers in E.164 format are +20 followed by 10 digits, e.g.
// +201012345678.  We accept the common variants below and normalise them all.
//
// Input variants handled:
//   +201012345678   → +201012345678  (already E.164 — pass through)
//   +2001012345678  → normalised     (some apps add 200 instead of 20)
//    201012345678   → +201012345678  (12 digits starting with 20)
//     01012345678   → +201012345678  (11 digits, leading 0)
//      1012345678   → +201012345678  (10 digits, no leading 0)
//
// For non-Egyptian numbers (anything that doesn't fit the above) we prepend +
// if the string is purely numeric, and return the raw value otherwise.
//
export function normalizePhone(raw: string): string {
  // Strip formatting characters but keep leading +
  const hasPlus = raw.trimStart().startsWith("+");
  const digits = raw.replace(/\D/g, "");

  // Already E.164-looking for Egypt
  if (hasPlus && digits.startsWith("20") && digits.length === 12) return `+${digits}`;
  // +200... variant (some dialers)
  if (hasPlus && digits.startsWith("200") && digits.length === 13) return `+20${digits.slice(3)}`;

  // 12 digits starting with 20 (no +)
  if (digits.startsWith("20") && digits.length === 12) return `+${digits}`;
  // 11 digits starting with 0 (local format: 010xxxxxxxx)
  if (digits.startsWith("0") && digits.length === 11) return `+2${digits}`;
  // 10 digits starting with 1 (stripped local: 10xxxxxxxx)
  if (digits.startsWith("1") && digits.length === 10) return `+20${digits}`;

  // Generic fallback: prepend + if purely numeric, else return trimmed
  if (/^\d{7,15}$/.test(digits)) return `+${digits}`;
  return raw.trim();
}

// ── Find or create client ──────────────────────────────────────────────────────
//
// Matches by normalised phone.  If the client already exists, upgrades name,
// email, and preferred_branch when those columns were null before (first-known
// value wins; never overwrites a previously set value).  Always returns the
// client id.
//
export async function findOrCreateClient(
  rawPhone: string,
  name?: string,
  email?: string,
  preferredBranch?: string,
): Promise<number> {
  const phone = normalizePhone(rawPhone);

  const [existing] = await db
    .select({
      id: clientsTable.id,
      name: clientsTable.name,
      email: clientsTable.email,
      preferredBranch: clientsTable.preferredBranch,
    })
    .from(clientsTable)
    .where(eq(clientsTable.phone, phone))
    .limit(1);

  if (existing) {
    const patch: Partial<typeof clientsTable.$inferInsert> = { updatedAt: new Date() };
    if (name && !existing.name) patch.name = name;
    if (email && !existing.email) patch.email = email;
    if (preferredBranch && !existing.preferredBranch) patch.preferredBranch = preferredBranch;
    if (Object.keys(patch).length > 1) {
      await db.update(clientsTable).set(patch).where(eq(clientsTable.id, existing.id));
    }
    return existing.id;
  }

  const [created] = await db
    .insert(clientsTable)
    .values({ phone, name, email, preferredBranch })
    .returning({ id: clientsTable.id });

  return created.id;
}

// ── Refresh aggregated client stats ───────────────────────────────────────────
//
// Raw SQL UPDATE with subqueries — avoids Drizzle ORM aggregation edge-cases.
// Call after any status change (not just completion) so cancels also correct
// visit_count / total_spend / first_visit / last_visit.
//
export async function refreshClientStats(clientId: number): Promise<void> {
  await db.execute(sql`
    UPDATE clients SET
      visit_count = (
        SELECT COUNT(*) FROM appointments
        WHERE client_id = ${clientId} AND status = 'completed'
      ),
      total_spend = COALESCE((
        SELECT SUM(price::numeric) FROM appointments
        WHERE client_id = ${clientId} AND status = 'completed' AND price IS NOT NULL
      ), 0),
      first_visit = (
        SELECT MIN(scheduled_at) FROM appointments
        WHERE client_id = ${clientId} AND status = 'completed'
      ),
      last_visit = (
        SELECT MAX(scheduled_at) FROM appointments
        WHERE client_id = ${clientId} AND status = 'completed'
      ),
      updated_at = NOW()
    WHERE id = ${clientId}
  `);
}

// Re-export and from drizzle for callers that need it alongside these utils
export { and, eq };

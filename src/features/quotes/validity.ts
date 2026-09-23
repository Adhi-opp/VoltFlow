// src/features/quotes/validity.ts
// ============================================================================
// RFQ AND QUOTE LIFETIMES
// ============================================================================
// Pure constants and date maths. No imports, no Prisma, no server-only — the
// seed script imports this by relative path, and anything that touches the
// database here would break `tsx prisma/seed.ts`.
//
// Two clocks, for two different reasons:
//
//   RFQ_LIFETIME_HOURS (72)
//     How long a request stays open to dealers. Short enough that a buyer is
//     still in a buying frame of mind when the quotes land, long enough to
//     span a weekend. Enforced in submitQuoteTransaction, which already
//     rejected expired requests — the field was simply never being set.
//
//   QUOTE_VALIDITY_DAYS (7)
//     How long a dealer's price is binding. Copper is the volatile half of
//     this BOM (cable is ~48% of material cost), so an open-ended quote asks
//     the dealer to absorb a commodity swing they cannot hedge. A week is the
//     usual counter-offer window in NCR trade practice.
// ============================================================================

export const RFQ_LIFETIME_HOURS = 72;
export const QUOTE_VALIDITY_DAYS = 7;

export function rfqExpiryFrom(now: Date = new Date()): Date {
  return new Date(now.getTime() + RFQ_LIFETIME_HOURS * 60 * 60 * 1000);
}

export function quoteValidUntilFrom(now: Date = new Date()): Date {
  return new Date(now.getTime() + QUOTE_VALIDITY_DAYS * 24 * 60 * 60 * 1000);
}

/**
 * True when a deadline has passed.
 *
 * A null deadline is never expired — rows created before these fields were
 * populated have no expiry, and treating them as stale would retroactively
 * kill every existing RFQ and quote in the database.
 */
export function isExpired(
  deadline: Date | string | null | undefined,
  now: Date = new Date()
): boolean {
  if (!deadline) return false;
  const time =
    typeof deadline === "string" ? new Date(deadline).getTime() : deadline.getTime();
  return Number.isFinite(time) && time <= now.getTime();
}

/** Not yet lapsed, but inside the warning window. */
export function expiresWithinHours(
  deadline: Date | string | null | undefined,
  hours: number,
  now: Date = new Date()
): boolean {
  if (!deadline || isExpired(deadline, now)) return false;
  return isExpired(deadline, new Date(now.getTime() + hours * 60 * 60 * 1000));
}

/** How close to lapsing a quote has to be before the matrix flags it. */
export const QUOTE_EXPIRY_WARNING_HOURS = 48;

/**
 * The status a buyer should actually see.
 *
 * Nothing flips QuoteRequest.status to EXPIRED — that would need a scheduled
 * job, and this project deliberately has no cron, queue or worker. Deriving it
 * at read time is equivalent for display purposes and costs nothing: the row
 * is already loaded, and submitQuoteTransaction independently refuses quotes
 * past expiresAt, so the write path is safe regardless of what is rendered.
 */
export function effectiveRfqStatus(
  status: string,
  expiresAt: Date | string | null | undefined,
  now: Date = new Date()
): string {
  return status === "OPEN" && isExpired(expiresAt, now) ? "EXPIRED" : status;
}

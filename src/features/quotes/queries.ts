// src/features/quotes/queries.ts
// ============================================================================
// QUOTE READ MODEL
// ============================================================================
// This was inline in the quotes page. It lives here so the isHidden filter has
// exactly one home — a "Remove" that only hid the row in one of two places
// would be a bug the user discovers later, on a different screen, with no idea
// why the quote came back.
//
// server-only rather than "use server": these are data functions, not actions.
// Marking the file "use server" would publish every export as a callable RPC
// endpoint, which is the opposite of what a read model wants.
// ============================================================================

import "server-only";
import { prisma } from "@/lib/prisma";

export interface ProjectQuoteView {
  id: string;
  totalPrice: number;
  brandOffered: string;
  wireGrade: string | null;
  deliveryDays: number | null;
  details: string | null;
  status: string;
  createdAt: string;
  dealerName: string;
  dealerCity: string;
  /** Released only once a quote is accepted — this is the payoff, not a lead list. */
  dealerEmail: string | null;
  dealerPhone: string | null;
}

export type ProjectQuotesResult =
  | { ok: false; reason: "NOT_FOUND" | "NOT_OWNER" }
  | {
      ok: true;
      projectName: string;
      rfqStatus: string;
      projectEstimate: number | null;
      quotes: ProjectQuoteView[];
    };

/**
 * Every visible quote on a project, cheapest first.
 *
 * Hidden quotes are excluded at the database level, not filtered in the
 * component — a removed quote should never reach the client at all.
 * Ownership is checked here rather than by the caller so there is no way to
 * read someone else's quotes by forgetting a guard at a new call site.
 */
export async function getQuotesForProject(
  projectId: string,
  viewerId: string
): Promise<ProjectQuotesResult> {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: {
      quoteRequest: {
        include: {
          quotes: {
            // The "Remove" feature. Hidden rows stay in the table for the
            // dealer, for quoteCount and for admin analytics — they just stop
            // being part of this buyer's comparison.
            where: { isHidden: false },
            include: {
              dealer: {
                select: {
                  name: true,
                  email: true,
                  phone: true,
                  dealerProfile: {
                    select: {
                      companyName: true,
                      city: true,
                      brandsSold: true,
                    },
                  },
                },
              },
            },
            orderBy: { totalPrice: "asc" as const },
          },
        },
      },
    },
  });

  if (!project) {
    return { ok: false, reason: "NOT_FOUND" };
  }

  if (project.ownerId !== viewerId) {
    return { ok: false, reason: "NOT_OWNER" };
  }

  const rfq = project.quoteRequest;

  return {
    ok: true,
    projectName: project.projectName,
    rfqStatus: rfq?.status ?? "CLOSED",
    projectEstimate: project.totalEstimate,
    quotes:
      rfq?.quotes.map((q) => ({
        id: q.id,
        totalPrice: q.totalPrice,
        brandOffered: q.brandOffered,
        wireGrade: q.wireGrade,
        deliveryDays: q.deliveryDays,
        details: q.details,
        status: q.status,
        createdAt: q.createdAt.toISOString(),
        dealerName:
          q.dealer.dealerProfile?.companyName ?? q.dealer.name ?? "Dealer",
        dealerCity: q.dealer.dealerProfile?.city ?? "",
        dealerEmail: q.status === "ACCEPTED" ? q.dealer.email : null,
        dealerPhone: q.status === "ACCEPTED" ? (q.dealer.phone ?? null) : null,
      })) ?? [],
  };
}

"use server";

import { Prisma, QuoteRequestStatus } from "@prisma/client";
import { z } from "zod";
import { auth } from "@/auth";
import type { EnrichedBOMResult } from "@/features/calculator/costEngine";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";

const submitQuoteSchema = z.object({
  quoteRequestId: z.string().min(1),
  clientRequestId: z.string().uuid(),
  totalPrice: z.number().positive(),
  brandOffered: z.string().trim().min(1).max(120),
  deliveryDays: z.number().int().min(1).max(365).optional(),
  details: z.string().trim().max(5000).optional(),
  validUntil: z.coerce.date().optional(),
});
const createQuoteRequestStatusSchema = z.enum(["DRAFT", "OPEN"]);

export type SubmitQuoteInput = z.infer<typeof submitQuoteSchema>;

export type SubmitQuoteErrorCode =
  | "VALIDATION_ERROR"
  | "UNAUTHENTICATED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "RFQ_CLOSED"
  | "RFQ_EXPIRED"
  | "MAX_QUOTES_REACHED"
  | "DUPLICATE_DEALER_QUOTE"
  | "DEALER_PROFILE_MISSING"
  | "CONCURRENCY_RETRY_EXHAUSTED"
  | "INTERNAL_ERROR";

export type SubmitQuoteResult =
  | {
      success: true;
      quoteId: string;
      idempotent: boolean;
    }
  | {
      success: false;
      errorCode: SubmitQuoteErrorCode;
      error: string;
    };

export type CreateQuoteRequestResult =
  | {
      success: true;
      quoteRequestId: string;
    }
  | {
      success: false;
      errorCode: "UNAUTHENTICATED" | "FORBIDDEN" | "INTERNAL_ERROR";
      error: string;
    };

interface LockedQuoteRequestRow {
  id: string;
  status: QuoteRequestStatus;
  expiresAt: Date | null;
  quoteCount: number;
  maxQuotes: number;
}

type TransactionOutcome =
  | { kind: "CREATED"; quoteId: string }
  | { kind: "IDEMPOTENT"; quoteId: string }
  | { kind: "IDEMPOTENCY_CONFLICT" }
  | { kind: "NOT_FOUND" }
  | { kind: "RFQ_CLOSED" }
  | { kind: "RFQ_EXPIRED" }
  | { kind: "MAX_QUOTES_REACHED" }
  | { kind: "DUPLICATE_DEALER_QUOTE" }
  | { kind: "DEALER_PROFILE_MISSING" };

const RETRY_WINDOWS_MS: ReadonlyArray<{ min: number; max: number }> = [
  { min: 80, max: 160 },
  { min: 160, max: 320 },
  { min: 320, max: 640 },
];
const MAX_SERIALIZATION_RETRIES = 3;

function randomIntInclusive(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRetryableSerializationError(error: unknown): boolean {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    return error.code === "P2034";
  }
  if (error instanceof Error) {
    return /serialize|serialization|deadlock|40001/i.test(error.message);
  }
  return false;
}

function deriveVisibilityCity(policyKey: string | undefined): string {
  const normalized = policyKey?.trim();
  if (!normalized || normalized.toUpperCase() === "DEFAULT") {
    return "NCR";
  }
  return normalized;
}

function mapOutcomeToResult(outcome: TransactionOutcome): SubmitQuoteResult {
  switch (outcome.kind) {
    case "CREATED":
      return { success: true, quoteId: outcome.quoteId, idempotent: false };
    case "IDEMPOTENT":
      return { success: true, quoteId: outcome.quoteId, idempotent: true };
    case "IDEMPOTENCY_CONFLICT":
      return {
        success: false,
        errorCode: "VALIDATION_ERROR",
        error:
          "This clientRequestId is already associated with another quote context. Generate a new id and retry.",
      };
    case "NOT_FOUND":
      return { success: false, errorCode: "NOT_FOUND", error: "Quote request not found." };
    case "RFQ_CLOSED":
      return {
        success: false,
        errorCode: "RFQ_CLOSED",
        error: "Quote request is not open for new submissions.",
      };
    case "RFQ_EXPIRED":
      return {
        success: false,
        errorCode: "RFQ_EXPIRED",
        error: "Quote request has expired and can no longer accept submissions.",
      };
    case "MAX_QUOTES_REACHED":
      return {
        success: false,
        errorCode: "MAX_QUOTES_REACHED",
        error: "This quote request has already reached its quote limit.",
      };
    case "DUPLICATE_DEALER_QUOTE":
      return {
        success: false,
        errorCode: "DUPLICATE_DEALER_QUOTE",
        error: "This dealer has already submitted a quote for this request.",
      };
    case "DEALER_PROFILE_MISSING":
      return {
        success: false,
        errorCode: "DEALER_PROFILE_MISSING",
        error: "Dealer profile is missing or inactive for quote submission.",
      };
  }
}

async function submitQuoteTransaction(
  input: SubmitQuoteInput,
  dealerId: string
): Promise<TransactionOutcome> {
  const now = new Date();

  return prisma.$transaction(
    async (tx) => {
      const existingByRequestId = await tx.quote.findUnique({
        where: { clientRequestId: input.clientRequestId },
        select: { id: true, quoteRequestId: true, dealerId: true },
      });

      if (existingByRequestId) {
        if (
          existingByRequestId.quoteRequestId === input.quoteRequestId &&
          existingByRequestId.dealerId === dealerId
        ) {
          return { kind: "IDEMPOTENT", quoteId: existingByRequestId.id } as const;
        }
        return { kind: "IDEMPOTENCY_CONFLICT" } as const;
      }

      const lockedRows = await tx.$queryRaw<LockedQuoteRequestRow[]>(Prisma.sql`
        SELECT "id", "status", "expiresAt", "quoteCount", "maxQuotes"
        FROM "QuoteRequest"
        WHERE "id" = ${input.quoteRequestId}
        FOR UPDATE
      `);

      if (lockedRows.length === 0) {
        return { kind: "NOT_FOUND" } as const;
      }

      const quoteRequest = lockedRows[0];

      if (quoteRequest.status !== "OPEN") {
        return { kind: "RFQ_CLOSED" } as const;
      }

      if (quoteRequest.expiresAt && quoteRequest.expiresAt.getTime() <= now.getTime()) {
        return { kind: "RFQ_EXPIRED" } as const;
      }

      if (quoteRequest.quoteCount >= quoteRequest.maxQuotes) {
        return { kind: "MAX_QUOTES_REACHED" } as const;
      }

      const existingDealerQuote = await tx.quote.findFirst({
        where: {
          quoteRequestId: input.quoteRequestId,
          dealerId,
        },
        select: { id: true },
      });

      if (existingDealerQuote) {
        return { kind: "DUPLICATE_DEALER_QUOTE" } as const;
      }

      const dealerProfile = await tx.dealerProfile.findUnique({
        where: { userId: dealerId },
        select: { id: true },
      });

      if (!dealerProfile) {
        return { kind: "DEALER_PROFILE_MISSING" } as const;
      }

      const createdQuote = await tx.quote.create({
        data: {
          quoteRequestId: input.quoteRequestId,
          dealerId,
          clientRequestId: input.clientRequestId,
          totalPrice: input.totalPrice,
          brandOffered: input.brandOffered,
          deliveryDays: input.deliveryDays ?? null,
          details: input.details ?? null,
          validUntil: input.validUntil ?? null,
        },
        select: { id: true },
      });

      const updatedRequest = await tx.quoteRequest.update({
        where: { id: input.quoteRequestId },
        data: {
          quoteCount: {
            increment: 1,
          },
        },
        select: { quoteCount: true, maxQuotes: true, status: true },
      });

      if (updatedRequest.status === "OPEN" && updatedRequest.quoteCount >= updatedRequest.maxQuotes) {
        await tx.quoteRequest.update({
          where: { id: input.quoteRequestId },
          data: { status: "CLOSED" },
        });
      }

      await tx.dealerProfile.update({
        where: { userId: dealerId },
        data: {
          quotesThisMonth: {
            increment: 1,
          },
        },
      });

      return { kind: "CREATED", quoteId: createdQuote.id } as const;
    },
    {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    }
  );
}

export async function createQuoteRequestAction(
  projectData: EnrichedBOMResult,
  requestedStatus: "DRAFT" | "OPEN"
): Promise<CreateQuoteRequestResult> {
  const session = await auth();
  if (!session?.user?.id) {
    return {
      success: false,
      errorCode: "UNAUTHENTICATED",
      error: "You must be signed in to save a project.",
    };
  }

  if (session.user.role === "DEALER") {
    return {
      success: false,
      errorCode: "FORBIDDEN",
      error: "Dealer accounts cannot create quote requests.",
    };
  }

  const ownerId = session.user.id;
  const parsedStatus = createQuoteRequestStatusSchema.safeParse(requestedStatus);
  if (!parsedStatus.success) {
    return {
      success: false,
      errorCode: "INTERNAL_ERROR",
      error: "Invalid quote request status.",
    };
  }

  const quoteRequestStatus = parsedStatus.data;
  const visibilityCity = deriveVisibilityCity(projectData.phaseDecision?.regulatoryPolicyKey);
  const savedAt = new Date().toISOString().replace("T", " ").slice(0, 19);

  try {
    const created = await prisma.$transaction(async (tx) => {
      const project = await tx.project.create({
        data: {
          ownerId,
          projectName: `Saved Estimate ${savedAt}`,
          projectType: "RESIDENTIAL",
          status: quoteRequestStatus === "OPEN" ? "RFQ_SUBMITTED" : "ESTIMATED",
          inputData: {
            source: "CALCULATOR",
            generatedAt: projectData.generatedAt,
            algorithmVersion: projectData.algorithmVersion,
          },
          bomData: JSON.parse(JSON.stringify(projectData)) as Prisma.InputJsonValue,
          totalEstimate: projectData.pricing.materialCost,
        },
        select: {
          id: true,
        },
      });

      const quoteRequest = await tx.quoteRequest.create({
        data: {
          projectId: project.id,
          status: quoteRequestStatus,
          visibilityCity,
          visibilityPincode: null,
        },
        select: {
          id: true,
        },
      });

      return quoteRequest;
    });

    return {
      success: true,
      quoteRequestId: created.id,
    };
  } catch (err) {
    logger.error("Failed to create quote request", {
      error: err instanceof Error ? err.message : "Unknown error",
      ownerId,
    });
    return {
      success: false,
      errorCode: "INTERNAL_ERROR",
      error: "Failed to save project. Please try again.",
    };
  }
}

export async function submitQuoteAction(raw: SubmitQuoteInput): Promise<SubmitQuoteResult> {
  const session = await auth();
  if (!session?.user?.id) {
    return {
      success: false,
      errorCode: "UNAUTHENTICATED",
      error: "You must be signed in to submit a quote.",
    };
  }

  if (session.user.role !== "DEALER") {
    return {
      success: false,
      errorCode: "FORBIDDEN",
      error: "Only dealer accounts can submit quotes.",
    };
  }

  const dealerId = session.user.id;
  const parsed = submitQuoteSchema.safeParse(raw);

  if (!parsed.success) {
    const message = parsed.error.issues
      .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
      .join("; ");
    return {
      success: false,
      errorCode: "VALIDATION_ERROR",
      error: `Validation failed: ${message}`,
    };
  }

  for (let retry = 0; retry <= MAX_SERIALIZATION_RETRIES; retry += 1) {
    try {
      const outcome = await submitQuoteTransaction(parsed.data, dealerId);
      return mapOutcomeToResult(outcome);
    } catch (error) {
      if (isRetryableSerializationError(error)) {
        logger.warn("Quote submission serialization conflict", {
          retry,
          dealerId,
          quoteRequestId: parsed.data.quoteRequestId,
        });
        if (retry === MAX_SERIALIZATION_RETRIES) {
          logger.error("Quote submission retries exhausted", { dealerId });
          return {
            success: false,
            errorCode: "CONCURRENCY_RETRY_EXHAUSTED",
            error: "Quote submission conflicted repeatedly. Please retry in a moment.",
          };
        }

        const window = RETRY_WINDOWS_MS[retry];
        await sleep(randomIntInclusive(window.min, window.max));
        continue;
      }

      const message = error instanceof Error ? error.message : "Unexpected quote submission error";
      return {
        success: false,
        errorCode: "INTERNAL_ERROR",
        error: message,
      };
    }
  }

  return {
    success: false,
    errorCode: "CONCURRENCY_RETRY_EXHAUSTED",
    error: "Quote submission conflicted repeatedly. Please retry in a moment.",
  };
}

// ---------------------------------------------------------------------------
// Accept / Reject quote actions
// ---------------------------------------------------------------------------

export type QuoteDecisionResult =
  | { success: true }
  | { success: false; error: string };

export async function acceptQuoteAction(quoteId: string): Promise<QuoteDecisionResult> {
  const session = await auth();
  if (!session?.user?.id) {
    return { success: false, error: "You must be signed in." };
  }

  for (let attempt = 0; attempt <= MAX_SERIALIZATION_RETRIES; attempt++) {
    try {
      await prisma.$transaction(
        async (tx) => {
          // All verification inside the serializable transaction — no
          // check-then-act gap between pre-fetch and mutation.
          const quote = await tx.quote.findUnique({
            where: { id: quoteId },
            include: {
              quoteRequest: {
                include: {
                  project: { select: { ownerId: true, id: true } },
                },
              },
            },
          });

          if (!quote) throw new Error("QUOTE_NOT_FOUND");
          if (quote.quoteRequest.project.ownerId !== session.user.id)
            throw new Error("NOT_OWNER");
          if (quote.status !== "SUBMITTED")
            throw new Error("ALREADY_PROCESSED");
          if (quote.quoteRequest.status !== "OPEN")
            throw new Error("RFQ_NOT_OPEN");

          // 1. Accept this quote
          await tx.quote.update({
            where: { id: quoteId },
            data: { status: "ACCEPTED" },
          });

          // 2. Reject all competing quotes
          await tx.quote.updateMany({
            where: {
              quoteRequestId: quote.quoteRequestId,
              id: { not: quoteId },
              status: "SUBMITTED",
            },
            data: { status: "REJECTED" },
          });

          // 3. Close the QuoteRequest
          await tx.quoteRequest.update({
            where: { id: quote.quoteRequestId },
            data: { status: "CLOSED" },
          });

          // 4. Lock the Project
          await tx.project.update({
            where: { id: quote.quoteRequest.project.id },
            data: { status: "CLOSED" },
          });
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );

      return { success: true };
    } catch (err) {
      // Business logic errors — return immediately, don't retry
      if (err instanceof Error) {
        switch (err.message) {
          case "QUOTE_NOT_FOUND":
            return { success: false, error: "Quote not found." };
          case "NOT_OWNER":
            return { success: false, error: "You do not own this project." };
          case "ALREADY_PROCESSED":
            return { success: false, error: "This quote has already been processed." };
          case "RFQ_NOT_OPEN":
            return { success: false, error: "This quote request is no longer open." };
        }
      }

      // Serialization conflicts — retry with jittered backoff
      if (isRetryableSerializationError(err) && attempt < MAX_SERIALIZATION_RETRIES) {
        const delay = RETRY_WINDOWS_MS[attempt];
        await sleep(randomIntInclusive(delay.min, delay.max));
        continue;
      }

      logger.error("Failed to accept quote", {
        error: err instanceof Error ? err.message : "Unknown",
        quoteId,
        attempt,
      });
      return { success: false, error: "Failed to accept quote. Please try again." };
    }
  }

  return { success: false, error: "Failed to accept quote after retries. Please try again." };
}

export async function rejectQuoteAction(quoteId: string): Promise<QuoteDecisionResult> {
  const session = await auth();
  if (!session?.user?.id) {
    return { success: false, error: "You must be signed in." };
  }

  for (let attempt = 0; attempt <= MAX_SERIALIZATION_RETRIES; attempt++) {
    try {
      await prisma.$transaction(
        async (tx) => {
          const quote = await tx.quote.findUnique({
            where: { id: quoteId },
            include: {
              quoteRequest: {
                include: {
                  project: { select: { ownerId: true } },
                },
              },
            },
          });

          if (!quote) throw new Error("QUOTE_NOT_FOUND");
          if (quote.quoteRequest.project.ownerId !== session.user.id)
            throw new Error("NOT_OWNER");
          if (quote.status !== "SUBMITTED")
            throw new Error("ALREADY_PROCESSED");

          await tx.quote.update({
            where: { id: quoteId },
            data: { status: "REJECTED" },
          });
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );

      return { success: true };
    } catch (err) {
      if (err instanceof Error) {
        switch (err.message) {
          case "QUOTE_NOT_FOUND":
            return { success: false, error: "Quote not found." };
          case "NOT_OWNER":
            return { success: false, error: "You do not own this project." };
          case "ALREADY_PROCESSED":
            return { success: false, error: "This quote has already been processed." };
        }
      }

      if (isRetryableSerializationError(err) && attempt < MAX_SERIALIZATION_RETRIES) {
        const delay = RETRY_WINDOWS_MS[attempt];
        await sleep(randomIntInclusive(delay.min, delay.max));
        continue;
      }

      logger.error("Failed to reject quote", {
        error: err instanceof Error ? err.message : "Unknown",
        quoteId,
        attempt,
      });
      return { success: false, error: "Failed to reject quote. Please try again." };
    }
  }

  return { success: false, error: "Failed to reject quote after retries. Please try again." };
}

"use server";

import { z } from "zod";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

const dealerProfileSchema = z.object({
  companyName: z.string().trim().min(2, "Company name is required").max(200),
  gstin: z
    .string()
    .trim()
    .toUpperCase()
    .regex(
      /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/,
      "Enter a valid 15-character GSTIN"
    )
    .optional()
    .or(z.literal("")),
  address: z.string().trim().min(5, "Address is required").max(500),
  city: z.string().trim().min(2, "City is required").max(100),
  state: z.string().trim().min(2, "State is required").max(100),
  pincode: z
    .string()
    .trim()
    .regex(/^[1-9][0-9]{5}$/, "Enter a valid 6-digit pincode"),
  serviceAreas: z.string().trim().min(1, "At least one service area is required"),
  brandsSold: z.string().trim().min(1, "At least one brand is required"),
});

export type DealerProfileInput = z.infer<typeof dealerProfileSchema>;

export type SaveDealerProfileResult =
  | { success: true; profileId: string }
  | { success: false; error: string };

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------

export async function saveDealerProfileAction(
  raw: DealerProfileInput
): Promise<SaveDealerProfileResult> {
  const session = await auth();
  if (!session?.user?.id) {
    return { success: false, error: "You must be signed in." };
  }

  if (session.user.role !== "DEALER" && session.user.role !== "ADMIN") {
    return { success: false, error: "Only dealer accounts can set up a dealer profile." };
  }

  const parsed = dealerProfileSchema.safeParse(raw);
  if (!parsed.success) {
    const message = parsed.error.issues
      .map((i) => `${i.path.join(".")}: ${i.message}`)
      .join("; ");
    return { success: false, error: message };
  }

  const data = parsed.data;
  const serviceAreas = data.serviceAreas
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const brandsSold = data.brandsSold
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const gstin = data.gstin || null;

  try {
    const profile = await prisma.dealerProfile.upsert({
      where: { userId: session.user.id },
      update: {
        companyName: data.companyName,
        gstin,
        address: data.address,
        city: data.city,
        state: data.state,
        pincode: data.pincode,
        serviceAreas,
        brandsSold,
      },
      create: {
        userId: session.user.id,
        companyName: data.companyName,
        gstin,
        address: data.address,
        city: data.city,
        state: data.state,
        pincode: data.pincode,
        serviceAreas,
        brandsSold,
      },
      select: { id: true },
    });

    return { success: true, profileId: profile.id };
  } catch (err) {
    if (
      err instanceof Error &&
      err.message.includes("Unique constraint") &&
      err.message.includes("gstin")
    ) {
      return { success: false, error: "This GSTIN is already registered with another account." };
    }
    logger.error("Failed to save dealer profile", {
      error: err instanceof Error ? err.message : "Unknown",
      userId: session.user.id,
    });
    return { success: false, error: "Failed to save profile. Please try again." };
  }
}

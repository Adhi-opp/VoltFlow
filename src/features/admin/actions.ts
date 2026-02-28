"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";

async function requireAdmin() {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "ADMIN") {
    throw new Error("FORBIDDEN");
  }
  return session;
}

export type AdminActionResult =
  | { success: true }
  | { success: false; error: string };

export async function approveDealerAction(
  dealerProfileId: string
): Promise<AdminActionResult> {
  try {
    await requireAdmin();
    await prisma.dealerProfile.update({
      where: { id: dealerProfileId },
      data: { approvalStatus: "APPROVED" },
    });
    return { success: true };
  } catch (err) {
    if (err instanceof Error && err.message === "FORBIDDEN") {
      return { success: false, error: "Access denied." };
    }
    logger.error("Failed to approve dealer", {
      error: err instanceof Error ? err.message : "Unknown",
      dealerProfileId,
    });
    return { success: false, error: "Failed to approve dealer." };
  }
}

export async function rejectDealerAction(
  dealerProfileId: string
): Promise<AdminActionResult> {
  try {
    await requireAdmin();
    await prisma.dealerProfile.update({
      where: { id: dealerProfileId },
      data: { approvalStatus: "REJECTED" },
    });
    return { success: true };
  } catch (err) {
    if (err instanceof Error && err.message === "FORBIDDEN") {
      return { success: false, error: "Access denied." };
    }
    logger.error("Failed to reject dealer", {
      error: err instanceof Error ? err.message : "Unknown",
      dealerProfileId,
    });
    return { success: false, error: "Failed to reject dealer." };
  }
}

"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import {
  sendDealerApprovedNotification,
  sendDealerRejectedNotification,
} from "@/lib/email";

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
    const profile = await prisma.dealerProfile.update({
      where: { id: dealerProfileId },
      data: { approvalStatus: "APPROVED" },
      include: { user: { select: { email: true, name: true } } },
    });

    // Awaited: serverless may freeze the invocation once the response
    // returns, dropping an in-flight send.
    await sendDealerApprovedNotification(profile.user.email, {
      dealerName: profile.user.name ?? "Dealer",
      companyName: profile.companyName,
    }).catch((e) =>
      logger.error("Email: dealer approved notification failed", {
        error: e instanceof Error ? e.message : "Unknown",
        dealerProfileId,
      })
    );

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
    const profile = await prisma.dealerProfile.update({
      where: { id: dealerProfileId },
      data: { approvalStatus: "REJECTED" },
      include: { user: { select: { email: true, name: true } } },
    });

    await sendDealerRejectedNotification(profile.user.email, {
      dealerName: profile.user.name ?? "Dealer",
      companyName: profile.companyName,
    }).catch((e) =>
      logger.error("Email: dealer rejected notification failed", {
        error: e instanceof Error ? e.message : "Unknown",
        dealerProfileId,
      })
    );

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

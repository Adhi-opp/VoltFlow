import { redirect, notFound } from "next/navigation";
import type { Metadata } from "next";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { RfqDetailClient } from "./RfqDetailClient";

export const metadata: Metadata = {
  title: "Quote Request — VoltFlow",
};

// ---------------------------------------------------------------------------
// bomData helpers
// ---------------------------------------------------------------------------

interface BomSnapshot {
  totalConnectedLoadKw: number;
  maxDemandKw: number;
  totalCircuits: number;
  pricing: {
    materialCost: number;
  };
  phaseDecision: {
    finalRecommendation: string;
  };
  items: Array<{
    category: string;
    pricingCode: string;
    description: string;
    qty: number;
    unit: string;
    unitPrice?: number;
    lineTotal?: number;
  }>;
  warnings: string[];
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function parseBomSnapshot(raw: unknown): BomSnapshot | null {
  if (!isRecord(raw)) return null;
  const pricing = raw.pricing;
  if (!isRecord(pricing)) return null;
  if (typeof pricing.materialCost !== "number") return null;
  if (
    typeof raw.totalConnectedLoadKw !== "number" ||
    typeof raw.maxDemandKw !== "number" ||
    typeof raw.totalCircuits !== "number"
  )
    return null;

  const phaseDecision = raw.phaseDecision;
  if (!isRecord(phaseDecision) || typeof phaseDecision.finalRecommendation !== "string")
    return null;

  const METER_CATEGORIES = new Set(["WIRE", "EARTH_WIRE", "CONDUIT"]);

  const items = Array.isArray(raw.items)
    ? (raw.items as Array<Record<string, unknown>>).map((item) => {
        const category = String(item.category ?? "");
        const isMeter = METER_CATEGORIES.has(category);
        const qty = isMeter
          ? (typeof item.totalMeters === "number" ? item.totalMeters : 0)
          : (typeof item.quantity === "number" ? item.quantity : 0);
        const unit = isMeter ? "m" : "pcs";

        return {
          category,
          pricingCode: String(item.pricingCode ?? ""),
          description: String(item.description ?? ""),
          qty,
          unit,
          unitPrice: typeof item.estimatedCostPerMeter === "number"
            ? item.estimatedCostPerMeter
            : typeof item.estimatedCostPerUnit === "number"
              ? item.estimatedCostPerUnit
              : undefined,
          lineTotal: typeof item.estimatedTotalCost === "number"
            ? item.estimatedTotalCost
            : undefined,
        };
      })
    : [];

  const warnings = Array.isArray(raw.warnings)
    ? (raw.warnings as unknown[]).filter((w): w is string => typeof w === "string")
    : [];

  return {
    totalConnectedLoadKw: raw.totalConnectedLoadKw as number,
    maxDemandKw: raw.maxDemandKw as number,
    totalCircuits: raw.totalCircuits as number,
    pricing: {
      materialCost: pricing.materialCost as number,
    },
    phaseDecision: {
      finalRecommendation: phaseDecision.finalRecommendation as string,
    },
    items,
    warnings,
  };
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function RfqDetailPage({ params }: PageProps) {
  const { id } = await params;
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  if (session.user.role !== "DEALER" && session.user.role !== "ADMIN") {
    redirect("/dashboard");
  }

  const rfq = await prisma.quoteRequest.findUnique({
    where: { id },
    include: {
      project: {
        select: {
          projectName: true,
          totalEstimate: true,
          bomData: true,
          createdAt: true,
        },
      },
      quotes: {
        where: { dealerId: session.user.id },
        select: {
          id: true,
          totalPrice: true,
          brandOffered: true,
          wireGrade: true,
          status: true,
        },
        take: 1,
      },
    },
  });

  if (!rfq) {
    notFound();
  }

  const bom = parseBomSnapshot(rfq.project.bomData);
  const existingQuote = rfq.quotes[0] ?? null;

  return (
    <RfqDetailClient
      rfqId={rfq.id}
      rfqStatus={rfq.status}
      projectName={rfq.project.projectName}
      createdAt={rfq.createdAt.toISOString()}
      visibilityCity={rfq.visibilityCity}
      bom={bom}
      fallbackEstimate={rfq.project.totalEstimate}
      existingQuote={
        existingQuote
          ? {
              id: existingQuote.id,
              totalPrice: existingQuote.totalPrice,
              brandOffered: existingQuote.brandOffered,
              wireGrade: existingQuote.wireGrade,
              status: existingQuote.status,
            }
          : null
      }
    />
  );
}

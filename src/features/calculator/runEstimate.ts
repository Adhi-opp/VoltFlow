// src/features/calculator/runEstimate.ts
// ============================================================================
// SHARED ESTIMATE PIPELINE
// ============================================================================
// The single place where a raw layout becomes a priced BOM:
//
//   unknown input → layoutSchema → buildCalculatorInput → calculateBOM
//                 → applyPricing → EnrichedBOMResult
//
// Both entry points call this and nothing else:
//   - generateEstimateAction  (calculator preview)
//   - createQuoteRequestAction (persisting a project / RFQ)
//
// This lives outside the "use server" modules on purpose. A "use server" file
// may only export async server actions, so the shared helper cannot live there.
//
// SECURITY: the calculator is public, so a caller can send any layout they
// like — but never a price. Callers pass the *layout* and the server derives
// the BOM and the rupee value itself. Nothing client-supplied is ever
// persisted as an estimate.
// ============================================================================

import { logger } from "@/lib/logger";
import { calculateBOM } from "./calculateBOM";
import { applyPricing, PricingDataError } from "./costEngine";
import { buildCalculatorInput } from "./generateRoomSpecs";
import { loadRateCardFromDb, loadRegulatoryPolicyFromDb } from "./loadRatesFromDb";
import { layoutSchema } from "./schemas";
import type { EnrichedBOMResult } from "./costEngine";
import type { LayoutFormValues } from "./schemas";
import type { PricingCode } from "./type";

export type EstimateErrorCode =
  | "VALIDATION_ERROR"
  | "PRICING_DATA_MISSING"
  | "INTERNAL_ERROR";

export type EstimateOutcome =
  | { ok: true; layout: LayoutFormValues; result: EnrichedBOMResult }
  | {
      ok: false;
      error: string;
      errorCode: EstimateErrorCode;
      missingCodes?: PricingCode[];
    };

/**
 * Validates an untrusted layout and computes a fully priced BOM from it.
 * Never throws — every failure path returns a typed outcome.
 */
export async function runEstimate(data: unknown): Promise<EstimateOutcome> {
  const parsed = layoutSchema.safeParse(data);

  if (!parsed.success) {
    const message = parsed.error.issues
      .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
      .join("; ");
    return {
      ok: false,
      error: `Validation failed: ${message}`,
      errorCode: "VALIDATION_ERROR",
    };
  }

  try {
    const calculatorInput = buildCalculatorInput(parsed.data);
    const [regulatoryPolicy, rateCard] = await Promise.all([
      loadRegulatoryPolicyFromDb(calculatorInput.city),
      loadRateCardFromDb(),
    ]);
    const bom = calculateBOM(calculatorInput, regulatoryPolicy);
    const enriched = applyPricing(bom, rateCard);
    return { ok: true, layout: parsed.data, result: enriched };
  } catch (err) {
    if (err instanceof PricingDataError) {
      logger.warn("Pricing data missing for estimate", {
        missingCodes: err.missingCodes,
      });
      return {
        ok: false,
        error:
          "Pricing data is incomplete for one or more required line items. Please refresh rates and retry.",
        errorCode: "PRICING_DATA_MISSING",
        missingCodes: err.missingCodes,
      };
    }

    const message = err instanceof Error ? err.message : "Unexpected calculation error";
    logger.error("Estimate generation failed", { error: message });
    return {
      ok: false,
      error: message,
      errorCode: "INTERNAL_ERROR",
    };
  }
}

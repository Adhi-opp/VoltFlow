"use server";

import { runEstimate } from "./runEstimate";
import type { EnrichedBOMResult } from "./costEngine";
import type { EstimateErrorCode } from "./runEstimate";
import type { LayoutFormValues } from "./schemas";
import type { PricingCode } from "./type";

export type EstimateActionErrorCode = EstimateErrorCode;

export type EstimateActionResult =
  | { success: true; data: EnrichedBOMResult }
  | {
      success: false;
      error: string;
      errorCode: EstimateActionErrorCode;
      missingCodes?: PricingCode[];
    };

/**
 * Public calculator entry point — no auth required.
 * Validation and the full BOM computation happen in runEstimate().
 */
export async function generateEstimateAction(
  data: LayoutFormValues
): Promise<EstimateActionResult> {
  const outcome = await runEstimate(data);

  if (!outcome.ok) {
    return {
      success: false,
      error: outcome.error,
      errorCode: outcome.errorCode,
      missingCodes: outcome.missingCodes,
    };
  }

  return { success: true, data: outcome.result };
}

"use server";

import { calculateBOM } from "./calculateBOM";
import { applyPricing, PricingDataError } from "./costEngine";
import { buildCalculatorInput } from "./generateRoomSpecs";
import { layoutSchema } from "./schemas";
import type { EnrichedBOMResult } from "./costEngine";
import type { LayoutFormValues } from "./schemas";
import type { PricingCode } from "./type";

export type EstimateActionErrorCode =
  | "VALIDATION_ERROR"
  | "PRICING_DATA_MISSING"
  | "INTERNAL_ERROR";

export type EstimateActionResult =
  | { success: true; data: EnrichedBOMResult }
  | {
      success: false;
      error: string;
      errorCode: EstimateActionErrorCode;
      missingCodes?: PricingCode[];
    };

export async function generateEstimateAction(
  data: LayoutFormValues
): Promise<EstimateActionResult> {
  const parsed = layoutSchema.safeParse(data);

  if (!parsed.success) {
    const message = parsed.error.issues
      .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
      .join("; ");
    return {
      success: false,
      error: `Validation failed: ${message}`,
      errorCode: "VALIDATION_ERROR",
    };
  }

  try {
    const calculatorInput = buildCalculatorInput(parsed.data);
    const bom = calculateBOM(calculatorInput);
    const enriched = applyPricing(bom);
    return { success: true, data: enriched };
  } catch (err) {
    if (err instanceof PricingDataError) {
      return {
        success: false,
        error:
          "Pricing data is incomplete for one or more required line items. Please refresh rates and retry.",
        errorCode: "PRICING_DATA_MISSING",
        missingCodes: err.missingCodes,
      };
    }

    const message = err instanceof Error ? err.message : "Unexpected calculation error";
    return {
      success: false,
      error: message,
      errorCode: "INTERNAL_ERROR",
    };
  }
}

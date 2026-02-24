"use server";

// src/features/calculator/actions.ts
// ============================================================================
// SERVER ACTIONS — Secure boundary for the proprietary BOM engine
// ============================================================================
// The "use server" directive ensures calculateBOM and generateRoomSpecsFromLayout
// NEVER execute in the browser. All engine logic stays on the server.
//
// Security model:
//   1. Client sends form values (LayoutFormValues) over the network.
//   2. Server re-validates with layoutSchema.safeParse() — never trusts client
//      validation alone. This is the authoritative validation boundary.
//   3. Only after successful server-side parse does the engine run.
//   4. BOMResult is serialised and returned to the client for display only.
//      No engine code, no constants, no algorithm logic is sent to the browser.
// ============================================================================

import { layoutSchema } from "./schemas";
import { buildCalculatorInput } from "./generateRoomSpecs";
import { calculateBOM } from "./calculateBOM";
import type { BOMResult } from "./type";
import type { LayoutFormValues } from "./schemas";

// ---------------------------------------------------------------------------
// Return type — discriminated union for clean error handling on the client
// ---------------------------------------------------------------------------

export type EstimateActionResult =
  | { success: true; data: BOMResult }
  | { success: false; error: string };

// ---------------------------------------------------------------------------
// generateEstimateAction
// ---------------------------------------------------------------------------

/**
 * Server Action: validates layout input, runs the BOM engine, returns the result.
 *
 * @param data  - Form values from the client. Re-validated server-side before use.
 * @returns     - { success: true, data: BOMResult } or { success: false, error: string }
 */
export async function generateEstimateAction(
  data: LayoutFormValues
): Promise<EstimateActionResult> {
  // Step 1: Re-validate on the server — authoritative validation boundary.
  // Client-side Zod is UX-only; this is the security gate.
  const parsed = layoutSchema.safeParse(data);

  if (!parsed.success) {
    const message = parsed.error.issues
      .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
      .join("; ");
    return { success: false, error: `Validation failed — ${message}` };
  }

  // Step 2: Run the engine with validated data.
  try {
    const calculatorInput = buildCalculatorInput(parsed.data);
    const result = calculateBOM(calculatorInput);
    return { success: true, data: result };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unexpected calculation error";
    return { success: false, error: message };
  }
}
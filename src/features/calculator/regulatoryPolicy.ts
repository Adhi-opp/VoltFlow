import type { CalculatorInput } from "./type";

const NCR_CONNECTED_LOAD_THRESHOLD_KW = 10;
const DEFAULT_CONNECTED_LOAD_THRESHOLD_KW = 7;

const NCR_CITY_KEYS = new Set<string>([
  "DELHI",
  "NEW DELHI",
  "NCR",
  "NOIDA",
  "GREATER NOIDA",
  "GHAZIABAD",
  "GURUGRAM",
  "GURGAON",
  "FARIDABAD",
]);

export function normalizeCityKey(city: string): string {
  return city.replace(/\s+/g, " ").trim().toUpperCase();
}

export interface RegulatoryPolicyResult {
  cityKey: string;
  connectedLoadThresholdKw: number;
}

/**
 * Pure/synchronous fallback — uses hardcoded NCR thresholds.
 * Called by calculateBOM (which must stay pure/sync).
 */
export function resolveRegulatoryPhasePolicy(
  input: CalculatorInput
): RegulatoryPolicyResult {
  const cityKey = normalizeCityKey(input.city || "NCR");

  if (NCR_CITY_KEYS.has(cityKey)) {
    return {
      cityKey,
      connectedLoadThresholdKw: NCR_CONNECTED_LOAD_THRESHOLD_KW,
    };
  }

  return {
    cityKey: "DEFAULT",
    connectedLoadThresholdKw: DEFAULT_CONNECTED_LOAD_THRESHOLD_KW,
  };
}

/** Hardcoded fallback constants — exported for use by the DB loader */
export const FALLBACK_NCR_THRESHOLD_KW = NCR_CONNECTED_LOAD_THRESHOLD_KW;
export const FALLBACK_DEFAULT_THRESHOLD_KW = DEFAULT_CONNECTED_LOAD_THRESHOLD_KW;
export const FALLBACK_NCR_CITY_KEYS = NCR_CITY_KEYS;

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

function normalizeCityKey(city: string): string {
  return city.replace(/\s+/g, " ").trim().toUpperCase();
}

export function resolveRegulatoryPhasePolicy(input: CalculatorInput): {
  cityKey: string;
  connectedLoadThresholdKw: number;
} {
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

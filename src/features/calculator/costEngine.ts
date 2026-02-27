import type { BOMItem, BOMResult, PricingCode } from "./type";

type RateBasis = "per_meter" | "per_piece";
type RateSource = "FINAL" | "PROVISIONAL";

interface RateCardEntry {
  rate: number;
  basis: RateBasis;
  source: RateSource;
}

interface LaborInputs {
  lightingPoints: number;
  power15APoints: number;
  heavyCircuits: number;
  cookingCircuits: number;
  conduitMeters: number;
  extraFloors: number;
}

interface LaborBreakdown {
  baseVisit: number;
  lightingPoints: number;
  power15APoints: number;
  heavyCircuits: number;
  cookingCircuits: number;
  conduitMeters: number;
  extraFloors: number;
  wiringModeMultiplier: number;
}

export class PricingDataError extends Error {
  readonly code = "PRICING_DATA_MISSING";
  readonly missingCodes: PricingCode[];

  constructor(missingCodes: PricingCode[]) {
    super(`Missing pricing data for codes: ${missingCodes.join(", ")}`);
    this.name = "PricingDataError";
    this.missingCodes = missingCodes;
  }
}

export type EnrichedBOMResult = BOMResult & {
  pricing: {
    materialCost: number;
    laborCost: number;
    totalEstimate: number;
    laborBreakdown: LaborBreakdown;
    surplusMetersTotal: number;
    surplusValueTotal: number;
  };
};

export const RATE_CARD: Record<PricingCode, RateCardEntry> = {
  // Wires (Per Meter)
  WIRE_1_5: { rate: 18, basis: "per_meter", source: "FINAL" },
  WIRE_2_5: { rate: 28, basis: "per_meter", source: "FINAL" },
  WIRE_4_0: { rate: 48, basis: "per_meter", source: "FINAL" },
  WIRE_6_0: { rate: 72, basis: "per_meter", source: "FINAL" },
  WIRE_10_0: { rate: 118, basis: "per_meter", source: "PROVISIONAL" },
  WIRE_16_0: { rate: 178, basis: "per_meter", source: "PROVISIONAL" },
  EARTH_WIRE_2_5: { rate: 28, basis: "per_meter", source: "FINAL" },

  // Conduits (Per Meter)
  CONDUIT_20: { rate: 35, basis: "per_meter", source: "FINAL" },
  CONDUIT_25: { rate: 48, basis: "per_meter", source: "FINAL" },
  CONDUIT_32: { rate: 65, basis: "per_meter", source: "FINAL" },

  // Switchgear & Breakers (Per Piece)
  MCB_10A_B: { rate: 350, basis: "per_piece", source: "FINAL" },
  MCB_16A_C: { rate: 380, basis: "per_piece", source: "FINAL" },
  MCB_20A_C: { rate: 420, basis: "per_piece", source: "FINAL" },
  MCB_32A_C: { rate: 650, basis: "per_piece", source: "FINAL" },
  MCB_63A_C: { rate: 950, basis: "per_piece", source: "PROVISIONAL" },
  RCCB_40A_2P_30MA: { rate: 1800, basis: "per_piece", source: "FINAL" },
  RCCB_63A_4P_30MA: { rate: 3600, basis: "per_piece", source: "PROVISIONAL" },
  MAIN_SWITCH_32A_DP: { rate: 1200, basis: "per_piece", source: "FINAL" },
  MAIN_SWITCH_63A_FP: { rate: 2400, basis: "per_piece", source: "PROVISIONAL" },
  DB_GENERIC: { rate: 3200, basis: "per_piece", source: "FINAL" },

  // Devices (Per Piece)
  SWITCH_MODULAR_6A_10A: { rate: 120, basis: "per_piece", source: "FINAL" },
  SOCKET_5A_2M: { rate: 180, basis: "per_piece", source: "FINAL" },
  SOCKET_15A_16A_3M: { rate: 320, basis: "per_piece", source: "FINAL" },
  FAN_REGULATOR_2M: { rate: 450, basis: "per_piece", source: "FINAL" },
};

const LABOR_RATE_CARD = {
  baseVisit: 3000,
  lightingPoint: 150,
  power15APoint: 230,
  heavyCircuit: 950,
  cookingCircuit: 1400,
  conduitMeter: 10,
  extraFloor: 1200,
  wiringModeMultiplier: 1.0,
} as const;

function getMeterQuantity(item: BOMItem): number {
  if (item.category === "WIRE" || item.category === "EARTH_WIRE" || item.category === "CONDUIT") {
    return item.totalMeters;
  }
  return 0;
}

function getPieceQuantity(item: BOMItem): number {
  if (
    item.category === "MCB" ||
    item.category === "RCCB" ||
    item.category === "MAIN_SWITCH" ||
    item.category === "DB" ||
    item.category === "SWITCHGEAR"
  ) {
    return item.quantity;
  }
  return 0;
}

function extractLaborInputs(result: BOMResult): LaborInputs {
  const lightingPoints = result.circuits
    .filter((circuit) => circuit.circuitType === "LIGHTING")
    .reduce((sum, circuit) => sum + circuit.pointCount, 0);

  const power15APoints = result.circuits
    .filter((circuit) => circuit.circuitType === "POWER_15A")
    .reduce((sum, circuit) => sum + circuit.pointCount, 0);

  const heavyCircuits = result.circuits.filter(
    (circuit) => circuit.circuitType === "HEAVY_APPLIANCE"
  ).length;

  const cookingCircuits = result.circuits.filter(
    (circuit) => circuit.circuitType === "COOKING_RANGE"
  ).length;

  const conduitMeters = result.items
    .filter((item) => item.category === "CONDUIT")
    .reduce((sum, item) => sum + item.totalMeters, 0);

  const uniqueFloors = new Set(result.circuits.map((circuit) => circuit.floor));
  const extraFloors = Math.max(0, uniqueFloors.size - 1);

  return {
    lightingPoints,
    power15APoints,
    heavyCircuits,
    cookingCircuits,
    conduitMeters,
    extraFloors,
  };
}

function computeLabor(inputs: LaborInputs): { laborCost: number; laborBreakdown: LaborBreakdown } {
  const preMultiplier =
    LABOR_RATE_CARD.baseVisit +
    inputs.lightingPoints * LABOR_RATE_CARD.lightingPoint +
    inputs.power15APoints * LABOR_RATE_CARD.power15APoint +
    inputs.heavyCircuits * LABOR_RATE_CARD.heavyCircuit +
    inputs.cookingCircuits * LABOR_RATE_CARD.cookingCircuit +
    inputs.conduitMeters * LABOR_RATE_CARD.conduitMeter +
    inputs.extraFloors * LABOR_RATE_CARD.extraFloor;

  const laborCost = Math.round(preMultiplier * LABOR_RATE_CARD.wiringModeMultiplier);

  return {
    laborCost,
    laborBreakdown: {
      baseVisit: LABOR_RATE_CARD.baseVisit,
      lightingPoints: inputs.lightingPoints * LABOR_RATE_CARD.lightingPoint,
      power15APoints: inputs.power15APoints * LABOR_RATE_CARD.power15APoint,
      heavyCircuits: inputs.heavyCircuits * LABOR_RATE_CARD.heavyCircuit,
      cookingCircuits: inputs.cookingCircuits * LABOR_RATE_CARD.cookingCircuit,
      conduitMeters: inputs.conduitMeters * LABOR_RATE_CARD.conduitMeter,
      extraFloors: inputs.extraFloors * LABOR_RATE_CARD.extraFloor,
      wiringModeMultiplier: LABOR_RATE_CARD.wiringModeMultiplier,
    },
  };
}

export type RateCard = Record<PricingCode, RateCardEntry>;

export function applyPricing(
  result: BOMResult,
  rateCard: RateCard = RATE_CARD
): EnrichedBOMResult {
  let materialCost = 0;
  let surplusMetersTotal = 0;
  let surplusValueTotal = 0;
  const missingCodes = new Set<PricingCode>();

  for (const item of result.items) {
    const priceConfig = rateCard[item.pricingCode];

    if (!priceConfig || priceConfig.rate <= 0) {
      missingCodes.add(item.pricingCode);
      continue;
    }

    if (priceConfig.basis === "per_meter") {
      materialCost += priceConfig.rate * getMeterQuantity(item);

      if (item.category === "WIRE" || item.category === "EARTH_WIRE") {
        surplusMetersTotal += item.surplusMeters;
        surplusValueTotal += item.surplusMeters * priceConfig.rate;
      }
      continue;
    }

    materialCost += priceConfig.rate * getPieceQuantity(item);
  }

  if (missingCodes.size > 0) {
    throw new PricingDataError(Array.from(missingCodes).sort());
  }

  const { laborCost, laborBreakdown } = computeLabor(extractLaborInputs(result));
  const totalEstimate = materialCost + laborCost;

  return {
    ...result,
    pricing: {
      materialCost,
      laborCost,
      totalEstimate,
      laborBreakdown,
      surplusMetersTotal,
      surplusValueTotal,
    },
  };
}

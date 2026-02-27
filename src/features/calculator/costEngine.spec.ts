import assert from "node:assert/strict";
import {
  applyPricing,
  PricingDataError,
  RATE_CARD,
  type EnrichedBOMResult,
} from "./costEngine";
import type { BOMItem, BOMResult, CircuitDefinition, PricingCode } from "./type";

function makeCircuit(partial: Partial<CircuitDefinition>): CircuitDefinition {
  return {
    circuitId: partial.circuitId ?? "C-1",
    circuitType: partial.circuitType ?? "LIGHTING",
    roomId: partial.roomId ?? "room-1",
    roomName: partial.roomName ?? "Room 1",
    floor: partial.floor ?? 0,
    wireGauge: partial.wireGauge ?? "1.5",
    mcbRatingAmps: partial.mcbRatingAmps ?? 10,
    pointCount: partial.pointCount ?? 1,
    pointDescription: partial.pointDescription ?? "test",
    wireLengthMeters: partial.wireLengthMeters ?? 10,
    conduitLengthMeters: partial.conduitLengthMeters ?? 8,
  };
}

function makeResult(
  items: BOMItem[],
  circuits: CircuitDefinition[] = [],
  totalConnectedLoadKw = 5,
  maxDemandKw = 3
): BOMResult {
  return {
    generatedAt: new Date().toISOString(),
    algorithmVersion: "test",
    disclaimer: "test",
    totalConnectedLoadKw,
    maxDemandKw,
    recommendedPhase: "SINGLE",
    phaseDecision: {
      engineeringRecommendation: "SINGLE",
      regulatoryRecommendation: "SINGLE",
      finalRecommendation: "SINGLE",
      connectedLoadThresholdKw: 7,
      regulatoryPolicyKey: "DEFAULT",
      reasons: [],
    },
    totalCircuits: circuits.length,
    circuits,
    loadBreakdown: [],
    items,
    estimatedTotalCost: null,
    costBreakdown: {
      wires: null,
      switchgear: null,
      conduit: null,
      distributionBoard: null,
      mcbsAndProtection: null,
    },
    warnings: [],
  };
}

function run(name: string, fn: () => void): void {
  try {
    fn();
    console.log(`PASS: ${name}`);
  } catch (error) {
    console.error(`FAIL: ${name}`);
    throw error;
  }
}

run("pricing uses pricingCode with correct basis and quantity fields", () => {
  const items: BOMItem[] = [
    {
      category: "WIRE",
      pricingCode: "WIRE_1_5",
      wireGauge: "1.5",
      sizeSqMm: 1.5,
      description: "label mutation should not matter",
      totalMeters: 100,
      purchasableMeters: 180,
      surplusMeters: 80,
      coilsRequired: 2,
      coilLengthMeters: 90,
    },
    {
      category: "MCB",
      pricingCode: "MCB_10A_B",
      ratingAmps: 10,
      type: "B",
      quantity: 3,
      description: "custom text",
    },
    {
      category: "DB",
      pricingCode: "DB_GENERIC",
      ways: 12,
      quantity: 1,
      description: "another custom text",
    },
  ];

  const priced = applyPricing(makeResult(items));
  assert.equal(priced.pricing.materialCost, 100 * 18 + 3 * 350 + 3200);
  assert.equal(priced.pricing.laborCost, 3000);
  assert.equal(priced.pricing.totalEstimate, priced.pricing.materialCost + priced.pricing.laborCost);
  assert.equal(priced.pricing.surplusMetersTotal, 80);
  assert.equal(priced.pricing.surplusValueTotal, 80 * 18);
});

run("labor uses hybrid model from circuits and conduit, not connected kW", () => {
  const circuits: CircuitDefinition[] = [
    makeCircuit({ circuitId: "LT-1", circuitType: "LIGHTING", pointCount: 8, floor: 0 }),
    makeCircuit({ circuitId: "LT-2", circuitType: "LIGHTING", pointCount: 4, floor: 1 }),
    makeCircuit({
      circuitId: "PW-1",
      circuitType: "POWER_15A",
      pointCount: 3,
      wireGauge: "2.5",
      mcbRatingAmps: 16,
      floor: 0,
    }),
    makeCircuit({
      circuitId: "HV-1",
      circuitType: "HEAVY_APPLIANCE",
      pointCount: 1,
      wireGauge: "4.0",
      mcbRatingAmps: 20,
      floor: 1,
    }),
    makeCircuit({
      circuitId: "CK-1",
      circuitType: "COOKING_RANGE",
      pointCount: 1,
      wireGauge: "6.0",
      mcbRatingAmps: 32,
      floor: 1,
    }),
  ];
  const items: BOMItem[] = [
    {
      category: "CONDUIT",
      pricingCode: "CONDUIT_20",
      sizeMm: "20mm",
      totalMeters: 100,
      description: "20mm PVC Conduit Pipe",
    },
  ];

  const priced = applyPricing(makeResult(items, circuits, 25, 2));
  assert.equal(priced.pricing.laborCost, 10040);
  assert.equal(priced.pricing.laborBreakdown.baseVisit, 3000);
  assert.equal(priced.pricing.laborBreakdown.lightingPoints, 12 * 150);
  assert.equal(priced.pricing.laborBreakdown.power15APoints, 3 * 230);
  assert.equal(priced.pricing.laborBreakdown.heavyCircuits, 1 * 950);
  assert.equal(priced.pricing.laborBreakdown.cookingCircuits, 1 * 1400);
  assert.equal(priced.pricing.laborBreakdown.conduitMeters, 100 * 10);
  assert.equal(priced.pricing.laborBreakdown.extraFloors, 1 * 1200);
  assert.equal(priced.pricing.laborBreakdown.wiringModeMultiplier, 1.0);
});

run("missing rate entry throws PricingDataError with missing code list", () => {
  const original = RATE_CARD.MCB_10A_B;
  delete (RATE_CARD as Partial<Record<PricingCode, { rate: number }>>).MCB_10A_B;

  try {
    applyPricing(
      makeResult([
        {
          category: "MCB",
          pricingCode: "MCB_10A_B",
          ratingAmps: 10,
          type: "B",
          quantity: 1,
          description: "10A MCB",
        },
      ])
    );
    assert.fail("Expected PricingDataError");
  } catch (error) {
    assert.ok(error instanceof PricingDataError);
    assert.deepEqual(error.missingCodes, ["MCB_10A_B"]);
    assert.equal(error.code, "PRICING_DATA_MISSING");
  } finally {
    (RATE_CARD as Record<PricingCode, unknown>).MCB_10A_B = original;
  }
});

run("rate <= 0 is treated as missing pricing data", () => {
  const original = RATE_CARD.CONDUIT_20;
  RATE_CARD.CONDUIT_20 = { ...RATE_CARD.CONDUIT_20, rate: 0 };

  try {
    applyPricing(
      makeResult([
        {
          category: "CONDUIT",
          pricingCode: "CONDUIT_20",
          sizeMm: "20mm",
          totalMeters: 10,
          description: "20mm PVC",
        },
      ])
    );
    assert.fail("Expected PricingDataError");
  } catch (error) {
    assert.ok(error instanceof PricingDataError);
    assert.deepEqual(error.missingCodes, ["CONDUIT_20"]);
  } finally {
    RATE_CARD.CONDUIT_20 = original;
  }
});

run("applyPricing accepts custom rate card override", () => {
  const items: BOMItem[] = [
    {
      category: "WIRE",
      pricingCode: "WIRE_1_5",
      wireGauge: "1.5",
      sizeSqMm: 1.5,
      description: "1.5 wire",
      totalMeters: 100,
      purchasableMeters: 180,
      surplusMeters: 80,
      coilsRequired: 2,
      coilLengthMeters: 90,
    },
  ];

  // Custom rate card with doubled wire price
  const customRateCard = { ...RATE_CARD };
  customRateCard.WIRE_1_5 = { rate: 36, basis: "per_meter" as const, source: "FINAL" as const };

  const pricedDefault = applyPricing(makeResult(items));
  const pricedCustom = applyPricing(makeResult(items), customRateCard);

  // Default: 100m × 18 = 1800, Custom: 100m × 36 = 3600
  assert.equal(pricedDefault.pricing.materialCost, 100 * 18);
  assert.equal(pricedCustom.pricing.materialCost, 100 * 36);
});

run("deterministic totals are additive", () => {
  const items: BOMItem[] = [
    {
      category: "WIRE",
      pricingCode: "WIRE_2_5",
      wireGauge: "2.5",
      sizeSqMm: 2.5,
      description: "2.5 wire",
      totalMeters: 50,
      purchasableMeters: 90,
      surplusMeters: 40,
      coilsRequired: 1,
      coilLengthMeters: 90,
    },
    {
      category: "SWITCHGEAR",
      pricingCode: "SOCKET_5A_2M",
      itemType: "SOCKET_5A",
      quantity: 4,
      description: "5A socket",
    },
  ];

  const priced: EnrichedBOMResult = applyPricing(makeResult(items));
  assert.equal(priced.pricing.materialCost, 50 * 28 + 4 * 180);
  assert.equal(priced.pricing.totalEstimate, priced.pricing.materialCost + priced.pricing.laborCost);
});

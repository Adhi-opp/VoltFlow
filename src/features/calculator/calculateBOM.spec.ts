import assert from "node:assert/strict";
import { calculateBOM } from "./calculateBOM";
import type { CalculatorInput, RoomSpec } from "./type";

function makeRoom(partial: Omit<RoomSpec, "id">, id = "room-1"): RoomSpec {
  return { id, ...partial };
}

function makeInput(city: string, rooms: RoomSpec[]): CalculatorInput {
  return {
    projectName: "spec",
    propertyType: "RESIDENTIAL",
    city,
    pincode: "201301",
    totalFloors: 1,
    rooms,
    supplyPhase: "SINGLE",
    dbLocation: "NEAR_ENTRANCE",
    dbFloor: 0,
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

run("NCR regulatory override promotes final phase to THREE when engineering is SINGLE", () => {
  const input = makeInput("Noida", [
    makeRoom({
      name: "Living Room",
      type: "LIVING_ROOM",
      floor: 0,
      lengthFt: 16,
      widthFt: 12,
      lightPoints: 0,
      fanPoints: 0,
      socket5A: 0,
      socket15A: 0,
      heavyAppliances: 8, // connected 12.0 kW, diversified 4.8 kW
      exhaustFan: 0,
    }),
  ]);

  const result = calculateBOM(input);
  assert.equal(result.phaseDecision.engineeringRecommendation, "SINGLE");
  assert.equal(result.phaseDecision.regulatoryRecommendation, "THREE");
  assert.equal(result.phaseDecision.finalRecommendation, "THREE");
  assert.equal(result.recommendedPhase, result.phaseDecision.finalRecommendation);
  assert.equal(result.phaseDecision.connectedLoadThresholdKw, 10);
  assert.ok(result.warnings.some((warning) => warning.includes("3-Phase recommended: engineering demand is safe")));
});

run("Both channels below threshold keep final recommendation SINGLE", () => {
  const input = makeInput("Jaipur", [
    makeRoom(
      {
        name: "Bedroom",
        type: "BEDROOM",
        floor: 0,
        lengthFt: 12,
        widthFt: 10,
        lightPoints: 2,
        fanPoints: 1,
        socket5A: 2,
        socket15A: 1,
        heavyAppliances: 0,
        exhaustFan: 0,
      },
      "room-2"
    ),
  ]);

  const result = calculateBOM(input);
  assert.equal(result.phaseDecision.connectedLoadThresholdKw, 7);
  assert.equal(result.phaseDecision.engineeringRecommendation, "SINGLE");
  assert.equal(result.phaseDecision.regulatoryRecommendation, "SINGLE");
  assert.equal(result.phaseDecision.finalRecommendation, "SINGLE");
});

run("Wire and earth procurement metadata remains consistent", () => {
  const input = makeInput("Delhi", [
    makeRoom(
      {
        name: "Kitchen",
        type: "KITCHEN_MODULAR",
        floor: 0,
        lengthFt: 12,
        widthFt: 10,
        lightPoints: 3,
        fanPoints: 0,
        socket5A: 3,
        socket15A: 4,
        heavyAppliances: 1,
        exhaustFan: 1,
        hasCookingRange: true,
      },
      "room-3"
    ),
  ]);

  const result = calculateBOM(input);
  const wireAndEarthItems = result.items.filter(
    (item) => item.category === "WIRE" || item.category === "EARTH_WIRE"
  );

  assert.ok(wireAndEarthItems.length > 0);
  for (const item of wireAndEarthItems) {
    assert.ok(item.purchasableMeters >= item.totalMeters);
    assert.equal(item.surplusMeters, item.purchasableMeters - item.totalMeters);
  }
});

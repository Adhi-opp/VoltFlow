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

// ============================================================================
// ADDITIONAL EDGE CASE SCENARIOS
// ============================================================================

run("1BHK minimal — single bedroom, 1 bath, no AC/geyser stays single phase", () => {
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
      "1bhk-bed"
    ),
    makeRoom(
      {
        name: "Bathroom",
        type: "BATHROOM",
        floor: 0,
        lengthFt: 6,
        widthFt: 5,
        lightPoints: 1,
        fanPoints: 0,
        socket5A: 0,
        socket15A: 0,
        heavyAppliances: 0,
        exhaustFan: 1,
      },
      "1bhk-bath"
    ),
  ]);

  const result = calculateBOM(input);
  assert.equal(result.recommendedPhase, "SINGLE");
  assert.ok(result.totalConnectedLoadKw < 3, "1BHK without AC/geyser should be well under 3kW");
  assert.ok(result.totalCircuits > 0, "Should generate at least 1 circuit");
  assert.ok(result.items.length > 0, "Should generate BOM items");
});

run("5BHK maximal — all toggles on pushes to three-phase", () => {
  const rooms: RoomSpec[] = [];
  for (let i = 1; i <= 5; i++) {
    rooms.push(
      makeRoom(
        {
          name: `Bedroom ${i}`,
          type: i === 1 ? "BEDROOM_MASTER" : "BEDROOM",
          floor: 0,
          lengthFt: 14,
          widthFt: 12,
          lightPoints: 3,
          fanPoints: 1,
          socket5A: 4,
          socket15A: 2,
          heavyAppliances: 2, // AC + geyser each
          exhaustFan: 0,
        },
        `5bhk-bed-${i}`
      )
    );
  }
  rooms.push(
    makeRoom(
      {
        name: "Kitchen",
        type: "KITCHEN_MODULAR",
        floor: 0,
        lengthFt: 14,
        widthFt: 12,
        lightPoints: 4,
        fanPoints: 0,
        socket5A: 3,
        socket15A: 5,
        heavyAppliances: 1,
        exhaustFan: 1,
        hasCookingRange: true,
      },
      "5bhk-kitchen"
    )
  );

  const input = makeInput("NCR", rooms);
  const result = calculateBOM(input);

  // 5 bedrooms × 2 heavy + 1 kitchen heavy + cooking = lots of load
  assert.ok(result.totalConnectedLoadKw > 10, "5BHK fully loaded should exceed 10kW");
  assert.equal(result.recommendedPhase, "THREE");
  // Should have cooking circuit
  const cookingCircuits = result.circuits.filter((c) => c.circuitType === "COOKING_RANGE");
  assert.equal(cookingCircuits.length, 1, "Should have exactly 1 cooking circuit");
});

run("Duplex multi-floor — circuits exist on both floors", () => {
  const input: CalculatorInput = {
    projectName: "duplex-test",
    propertyType: "RESIDENTIAL",
    city: "Delhi",
    pincode: "110001",
    totalFloors: 2,
    rooms: [
      makeRoom(
        {
          name: "Living Room",
          type: "LIVING_ROOM",
          floor: 0,
          lengthFt: 18,
          widthFt: 14,
          lightPoints: 4,
          fanPoints: 2,
          socket5A: 4,
          socket15A: 2,
          heavyAppliances: 1,
          exhaustFan: 0,
        },
        "duplex-living"
      ),
      makeRoom(
        {
          name: "Master Bedroom",
          type: "BEDROOM_MASTER",
          floor: 1,
          lengthFt: 16,
          widthFt: 12,
          lightPoints: 3,
          fanPoints: 1,
          socket5A: 4,
          socket15A: 1,
          heavyAppliances: 1,
          exhaustFan: 0,
        },
        "duplex-master"
      ),
    ],
    supplyPhase: "SINGLE",
    dbLocation: "NEAR_ENTRANCE",
    dbFloor: 0,
  };

  const result = calculateBOM(input);
  const floor0Circuits = result.circuits.filter((c) => c.floor === 0);
  const floor1Circuits = result.circuits.filter((c) => c.floor === 1);
  assert.ok(floor0Circuits.length > 0, "Should have circuits on floor 0");
  assert.ok(floor1Circuits.length > 0, "Should have circuits on floor 1");
});

run("Phase boundary — just below 7kW stays single, just above goes three", () => {
  // 4 heavy appliances × 1500W = 6kW connected, well under engineering threshold
  const inputBelow = makeInput("Jaipur", [
    makeRoom(
      {
        name: "Room",
        type: "LIVING_ROOM",
        floor: 0,
        lengthFt: 20,
        widthFt: 15,
        lightPoints: 4,
        fanPoints: 2,
        socket5A: 4,
        socket15A: 2,
        heavyAppliances: 4,
        exhaustFan: 0,
      },
      "boundary-below"
    ),
  ]);

  const resultBelow = calculateBOM(inputBelow);
  // diversified demand = 4 × 1500 × 0.4 + lighting + power ≈ ~3.5kW — under 7kW threshold
  assert.equal(resultBelow.phaseDecision.engineeringRecommendation, "SINGLE");

  // 14 heavy appliances × 1500W = 21kW connected, diversified 8.4kW > 7kW
  const inputAbove = makeInput("Jaipur", [
    makeRoom(
      {
        name: "Room",
        type: "LIVING_ROOM",
        floor: 0,
        lengthFt: 20,
        widthFt: 15,
        lightPoints: 4,
        fanPoints: 2,
        socket5A: 4,
        socket15A: 2,
        heavyAppliances: 14,
        exhaustFan: 0,
      },
      "boundary-above"
    ),
  ]);

  const resultAbove = calculateBOM(inputAbove);
  assert.equal(resultAbove.phaseDecision.engineeringRecommendation, "THREE");
});

run("Regulatory override accepts pre-loaded DB policy", () => {
  const input = makeInput("Mumbai", [
    makeRoom(
      {
        name: "Room",
        type: "LIVING_ROOM",
        floor: 0,
        lengthFt: 16,
        widthFt: 12,
        lightPoints: 2,
        fanPoints: 1,
        socket5A: 2,
        socket15A: 1,
        heavyAppliances: 6, // 9kW connected
        exhaustFan: 0,
      },
      "override-room"
    ),
  ]);

  // Without override: Mumbai → DEFAULT (7kW threshold), connected 9kW → THREE regulatory
  const resultDefault = calculateBOM(input);
  assert.equal(resultDefault.phaseDecision.regulatoryRecommendation, "THREE");
  assert.equal(resultDefault.phaseDecision.connectedLoadThresholdKw, 7);

  // With override: pretend Mumbai has 15kW threshold → stays SINGLE regulatory
  const resultOverride = calculateBOM(input, {
    cityKey: "MUMBAI",
    connectedLoadThresholdKw: 15,
  });
  assert.equal(resultOverride.phaseDecision.regulatoryRecommendation, "SINGLE");
  assert.equal(resultOverride.phaseDecision.connectedLoadThresholdKw, 15);
});

run("Circuit IDs are deterministic across multiple calls", () => {
  const input = makeInput("Delhi", [
    makeRoom(
      {
        name: "Bedroom",
        type: "BEDROOM",
        floor: 0,
        lengthFt: 12,
        widthFt: 10,
        lightPoints: 3,
        fanPoints: 1,
        socket5A: 2,
        socket15A: 1,
        heavyAppliances: 1,
        exhaustFan: 0,
      },
      "determinism-room"
    ),
  ]);

  const result1 = calculateBOM(input);
  const result2 = calculateBOM(input);

  const ids1 = result1.circuits.map((c) => c.circuitId);
  const ids2 = result2.circuits.map((c) => c.circuitId);
  assert.deepEqual(ids1, ids2, "Circuit IDs should be identical across calls");
});

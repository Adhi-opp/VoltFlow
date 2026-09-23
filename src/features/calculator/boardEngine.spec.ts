import assert from "node:assert/strict";
import {
  buildDistributionSchedule,
  enforceBreaker,
  sizeIncomer,
  type PhaseRail,
} from "./boardEngine";
import type { CircuitDefinition } from "./type";
import type { CircuitTypeKey, WireGaugeKey } from "./constants";

function run(name: string, fn: () => void): void {
  try {
    fn();
    console.log(`PASS: ${name}`);
  } catch (error) {
    console.error(`FAIL: ${name}`);
    throw error;
  }
}

let seq = 0;
function circuit(
  wireGauge: WireGaugeKey,
  mcbRatingAmps: number,
  overrides: Partial<CircuitDefinition> = {}
): CircuitDefinition {
  seq += 1;
  return {
    circuitId: overrides.circuitId ?? `C-${String(seq).padStart(3, "0")}`,
    circuitType: (overrides.circuitType ?? "POWER_15A") as CircuitTypeKey,
    roomId: overrides.roomId ?? "room-1",
    roomName: overrides.roomName ?? "Bedroom 1",
    floor: overrides.floor ?? 0,
    wireGauge,
    mcbRatingAmps,
    pointCount: overrides.pointCount ?? 2,
    pointDescription: overrides.pointDescription ?? "2 sockets",
    wireLengthMeters: overrides.wireLengthMeters ?? 20,
    conduitLengthMeters: overrides.conduitLengthMeters ?? 16,
  };
}

// ---------------------------------------------------------------------------
// Breaker enforcement — the fire guard
// ---------------------------------------------------------------------------

run("a breaker above its conductor's ceiling is reduced, not accepted", () => {
  // The failure this whole feature exists to catch: 32 A on lighting cable.
  // A 1.5 mm² conductor will cook long before that breaker decides to open.
  const result = enforceBreaker("C-1", "1.5", 32);

  assert.equal(result.ratingAmps, 10);
  assert.ok(result.correction, "an over-spec breaker must be reported");
  assert.equal(result.correction?.requestedAmps, 32);
  assert.equal(result.correction?.appliedAmps, 10);
  assert.match(result.correction?.reason ?? "", /cannot be protected above 10 A/);
});

run("each conductor size is capped at its own ceiling", () => {
  // Anything asking for 63 A gets clamped to what the cable can actually take.
  const caps: Array<[WireGaugeKey, number]> = [
    ["1.0", 10],
    ["1.5", 10],
    ["2.5", 16],
    ["4.0", 25],
    ["6.0", 32],
    ["10.0", 40],
    ["16.0", 63],
  ];

  for (const [gauge, cap] of caps) {
    const result = enforceBreaker("C-1", gauge, 63);
    assert.equal(
      result.ratingAmps,
      cap,
      `${gauge} mm² should cap at ${cap} A, got ${result.ratingAmps} A`
    );
  }
});

run("a rating within the ceiling is left exactly as the engine chose it", () => {
  // 2.5 mm² caps at 16 A; a 16 A request is legal and must pass through
  // unchanged, with no correction noise on the schedule.
  const result = enforceBreaker("C-1", "2.5", 16);
  assert.equal(result.ratingAmps, 16);
  assert.equal(result.correction, null);

  // 4.0 mm² accepts both 20 A and 25 A.
  assert.equal(enforceBreaker("C-1", "4.0", 20).ratingAmps, 20);
  assert.equal(enforceBreaker("C-1", "4.0", 25).ratingAmps, 25);
  assert.equal(enforceBreaker("C-1", "4.0", 20).correction, null);
});

run("a rating below the ceiling is never raised", () => {
  // The specified table reads as a fixed value, but raising a 6 A lighting
  // breaker to 10 A would make the circuit LESS protected — the same defect
  // this feature exists to prevent, introduced by us. Clamp down only.
  const result = enforceBreaker("C-1", "1.5", 6);
  assert.equal(result.ratingAmps, 6);
  assert.equal(result.correction, null);
});

run("a clamped rating is always a breaker that can be bought", () => {
  const STANDARD = [6, 10, 16, 20, 25, 32, 40, 63];
  const gauges: WireGaugeKey[] = ["1.0", "1.5", "2.5", "4.0", "6.0", "10.0", "16.0"];

  for (const gauge of gauges) {
    const { ratingAmps } = enforceBreaker("C-1", gauge, 100);
    assert.ok(
      STANDARD.includes(ratingAmps),
      `${gauge} mm² produced non-standard rating ${ratingAmps} A`
    );
  }
});

run("curve follows the circuit type, not a blanket rule", () => {
  const schedule = buildDistributionSchedule({
    supply: "SINGLE",
    maxDemandKw: 4,
    circuits: [
      circuit("1.5", 6, { circuitId: "LT-1", circuitType: "LIGHTING" }),
      circuit("4.0", 20, { circuitId: "HA-1", circuitType: "HEAVY_APPLIANCE" }),
    ],
  });

  const lighting = schedule.ways.find((w) => w.circuitId === "LT-1");
  const heavy = schedule.ways.find((w) => w.circuitId === "HA-1");

  // Type B trips at 3-5x for resistive loads; Type C at 5-10x for inrush.
  // Forcing lighting onto C would slow its response to a fault.
  assert.equal(lighting?.curve, "B");
  assert.equal(heavy?.curve, "C");
});

// ---------------------------------------------------------------------------
// Incomer sizing
// ---------------------------------------------------------------------------

run("single phase gets a DP incomer and DP RCCB at 30 mA", () => {
  const incomer = sizeIncomer("SINGLE", 5);

  assert.equal(incomer.poles, 2);
  assert.equal(incomer.polesLabel, "DP");
  assert.equal(incomer.rccb.poles, 2);
  assert.equal(incomer.rccb.polesLabel, "DP");
  assert.equal(incomer.rccb.sensitivityMa, 30);
});

run("three phase gets a 4P incomer and 4P RCCB at 30 mA", () => {
  const incomer = sizeIncomer("THREE", 15);

  assert.equal(incomer.poles, 4);
  assert.equal(incomer.polesLabel, "4P");
  assert.equal(incomer.rccb.poles, 4);
  assert.equal(incomer.rccb.polesLabel, "4P");
  assert.equal(incomer.rccb.sensitivityMa, 30);
});

run("the incomer never drops below the standard fitment", () => {
  // A tiny load must not produce a 32 A main on a domestic board.
  const tiny = sizeIncomer("SINGLE", 0.5);
  assert.equal(tiny.ratingAmps, 40);
  assert.equal(tiny.upgradedFromStandard, false);
});

run("a demand beyond the standard fitment uprates the incomer", () => {
  // 12 kW single phase = ~52 A, past the 40 A default.
  const heavy = sizeIncomer("SINGLE", 12);
  assert.ok(heavy.designCurrentAmps > 40);
  assert.equal(heavy.ratingAmps, 63);
  assert.equal(heavy.upgradedFromStandard, true);
  // The RCCB carries the whole board, so it tracks the incomer.
  assert.equal(heavy.rccb.ratingAmps, 63);
});

run("three-phase design current uses the root-3 line relationship", () => {
  // 30 kW over 415 V three-phase = 30000 / (1.732 * 415) = ~41.7 A per line,
  // not the 130 A a single-phase formula would wrongly produce.
  const incomer = sizeIncomer("THREE", 30);
  assert.ok(
    incomer.designCurrentAmps > 41 && incomer.designCurrentAmps < 42,
    `expected ~41.7 A, got ${incomer.designCurrentAmps}`
  );
  assert.equal(incomer.ratingAmps, 63);
});

// ---------------------------------------------------------------------------
// Phase balancing
// ---------------------------------------------------------------------------

run("single phase assigns no rails at all", () => {
  const schedule = buildDistributionSchedule({
    supply: "SINGLE",
    maxDemandKw: 4,
    circuits: [circuit("1.5", 6), circuit("2.5", 16)],
  });

  assert.equal(schedule.rails.length, 0);
  assert.equal(schedule.balance, null);
  assert.ok(schedule.ways.every((w) => w.rail === null));
});

run("three equal loads land one per rail", () => {
  const schedule = buildDistributionSchedule({
    supply: "THREE",
    maxDemandKw: 10,
    circuits: [
      circuit("2.5", 16, { circuitId: "A" }),
      circuit("2.5", 16, { circuitId: "B" }),
      circuit("2.5", 16, { circuitId: "C" }),
    ],
  });

  const used = new Set(schedule.ways.map((w) => w.rail));
  assert.equal(used.size, 3, "each rail should take exactly one circuit");
  assert.deepEqual(
    schedule.rails.map((r) => r.connectedAmps),
    [16, 16, 16]
  );
  assert.equal(schedule.balance?.spreadAmps, 0);
  assert.equal(schedule.balance?.spreadPct, 0);
});

run("heaviest-first beats round-robin on an uneven set", () => {
  // 25, 20, 16, 16, 10, 6 = 93 A. Heaviest-first gives 31/30/32; naive
  // round-robin in emission order would give 25+16+6=47 on one rail.
  const schedule = buildDistributionSchedule({
    supply: "THREE",
    maxDemandKw: 18,
    circuits: [
      circuit("4.0", 25, { circuitId: "A" }),
      circuit("4.0", 20, { circuitId: "B" }),
      circuit("2.5", 16, { circuitId: "C" }),
      circuit("2.5", 16, { circuitId: "D" }),
      circuit("1.5", 10, { circuitId: "E" }),
      circuit("1.5", 6, { circuitId: "F" }),
    ],
  });

  const amps = schedule.rails.map((r) => r.connectedAmps);
  assert.equal(
    amps.reduce((a, b) => a + b, 0),
    93,
    "no load may be dropped or duplicated"
  );
  assert.ok(
    Math.max(...amps) - Math.min(...amps) <= 2,
    `rails should sit within 2 A of each other, got ${amps.join("/")}`
  );
});

run("every circuit is assigned exactly one rail", () => {
  const schedule = buildDistributionSchedule({
    supply: "THREE",
    maxDemandKw: 20,
    circuits: Array.from({ length: 11 }, (_, i) =>
      circuit("2.5", 16, { circuitId: `C-${i}` })
    ),
  });

  const railed = schedule.ways.filter((w) => w.rail !== null);
  assert.equal(railed.length, 11);

  const inRails = schedule.rails.flatMap((r) => r.ways.map((w) => w.circuitId));
  assert.equal(inRails.length, 11, "rails must partition the ways");
  assert.equal(new Set(inRails).size, 11, "no circuit may appear on two rails");
});

run("balancing is deterministic across repeated runs", () => {
  // A board schedule that shifts between page loads is not a document anyone
  // can check against a physical board.
  const circuits = [
    circuit("4.0", 25, { circuitId: "A" }),
    circuit("2.5", 16, { circuitId: "B" }),
    circuit("2.5", 16, { circuitId: "C" }),
    circuit("1.5", 10, { circuitId: "D" }),
    circuit("1.5", 6, { circuitId: "E" }),
  ];

  const first = buildDistributionSchedule({
    supply: "THREE",
    maxDemandKw: 12,
    circuits,
  });
  const second = buildDistributionSchedule({
    supply: "THREE",
    maxDemandKw: 12,
    circuits: [...circuits].reverse(),
  });

  const railOf = (s: typeof first): Record<string, PhaseRail | null> =>
    Object.fromEntries(s.ways.map((w) => [w.circuitId, w.rail]));

  assert.deepEqual(
    railOf(first),
    railOf(second),
    "input order must not change the board"
  );
});

run("balancing uses the corrected rating, not the requested one", () => {
  // A 63 A request on 2.5 mm² is clamped to 16 A. If the balancer used the
  // original figure it would starve that rail to compensate for load that
  // the breaker will never actually pass.
  const schedule = buildDistributionSchedule({
    supply: "THREE",
    maxDemandKw: 12,
    circuits: [
      circuit("2.5", 63, { circuitId: "OVER" }),
      circuit("2.5", 16, { circuitId: "B" }),
      circuit("2.5", 16, { circuitId: "C" }),
    ],
  });

  assert.equal(schedule.corrections.length, 1);
  assert.deepEqual(
    schedule.rails.map((r) => r.connectedAmps),
    [16, 16, 16]
  );
});

// ---------------------------------------------------------------------------
// Schedule assembly
// ---------------------------------------------------------------------------

run("ways are numbered contiguously in floor order", () => {
  const schedule = buildDistributionSchedule({
    supply: "SINGLE",
    maxDemandKw: 6,
    circuits: [
      circuit("1.5", 6, { circuitId: "UP", floor: 1 }),
      circuit("2.5", 16, { circuitId: "DOWN", floor: 0 }),
    ],
  });

  assert.deepEqual(
    schedule.ways.map((w) => w.circuitId),
    ["DOWN", "UP"],
    "ground floor is wired on the lower rows"
  );
  assert.deepEqual(
    schedule.ways.map((w) => w.wayNumber),
    [1, 2]
  );
});

run("the recommended enclosure leaves spare ways", () => {
  const schedule = buildDistributionSchedule({
    supply: "SINGLE",
    maxDemandKw: 6,
    circuits: Array.from({ length: 10 }, (_, i) =>
      circuit("2.5", 16, { circuitId: `C-${i}` })
    ),
  });

  assert.equal(schedule.waysUsed, 10);
  // 10 used + 2 spare = 12, the next standard enclosure.
  assert.equal(schedule.recommendedDbWays, 12);
});

run("an empty circuit list produces an empty but valid schedule", () => {
  const schedule = buildDistributionSchedule({
    supply: "THREE",
    maxDemandKw: 0,
    circuits: [],
  });

  assert.equal(schedule.ways.length, 0);
  assert.equal(schedule.rails.length, 0);
  assert.equal(schedule.balance, null);
  assert.equal(schedule.totalConnectedAmps, 0);
  // Still needs a real incomer — the board exists even with nothing in it.
  assert.equal(schedule.incomer.polesLabel, "4P");
  assert.equal(schedule.incomer.ratingAmps, 63);
});

run("over-spec corrections surface as a warning on the schedule", () => {
  const schedule = buildDistributionSchedule({
    supply: "SINGLE",
    maxDemandKw: 6,
    circuits: [
      circuit("1.5", 32, { circuitId: "BAD-1" }),
      circuit("2.5", 40, { circuitId: "BAD-2" }),
    ],
  });

  assert.equal(schedule.corrections.length, 2);
  assert.equal(schedule.ways[0].ratingAmps, 10);
  assert.equal(schedule.ways[1].ratingAmps, 16);
  assert.ok(
    schedule.warnings.some((w) => /Do not refit the larger size/.test(w)),
    "the installer must be told not to undo the correction"
  );
});

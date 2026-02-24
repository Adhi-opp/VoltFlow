// src/features/calculator/roomTemplates.ts
// ============================================================================
// NCR-CALIBRATED ROOM TEMPLATES FOR THE LAYOUT BRIDGE
// ============================================================================
// Electrical point counts are sourced DIRECTLY from ROOM_DEFAULTS (constants.ts)
// via spread operator — no manual duplication. If ROOM_DEFAULTS changes, these
// templates auto-update.
//
// Default dimensions represent typical NCR mid-income residential construction.
// Note: The BOM engine (calculateBOM) does NOT use room dimensions in its
// calculations — wire lengths are derived from point counts and DB distances.
// Dimensions are carried through for display/reference purposes only.
//
// DIVERGENCE POLICY:
//   - All electrical values come from ROOM_DEFAULTS unless explicitly overridden.
//   - Duplex adjustments are separated into DUPLEX_ADJUSTMENTS with documented
//     reasoning for each deviation.
//   - If you add an override, document WHY it diverges from baseline.
// ============================================================================

import { ROOM_DEFAULTS, type RoomTypeKey } from "./constants";

// ---------------------------------------------------------------------------
// Template shape — extends ROOM_DEFAULTS with NCR-specific dimensions
// ---------------------------------------------------------------------------

export interface RoomTemplate {
  type: RoomTypeKey;
  defaultLengthFt: number;
  defaultWidthFt: number;
  lightPoints: number;
  fanPoints: number;
  socket5A: number;
  socket15A: number;
  heavyAppliances: number;
  exhaustFan: number;
}

/**
 * Creates a RoomTemplate by spreading ROOM_DEFAULTS values for the given type.
 * This ensures zero drift between template layer and engine constants.
 */
function fromDefaults(
  type: RoomTypeKey,
  lengthFt: number,
  widthFt: number
): RoomTemplate {
  const defaults = ROOM_DEFAULTS[type];
  return {
    type,
    defaultLengthFt: lengthFt,
    defaultWidthFt: widthFt,
    lightPoints: defaults.lightPoints,
    fanPoints: defaults.fanPoints,
    socket5A: defaults.socket5A,
    socket15A: defaults.socket15A,
    heavyAppliances: defaults.heavyAppliances,
    exhaustFan: defaults.exhaustFan,
  };
}

// ---------------------------------------------------------------------------
// NCR Room Templates — electrical values from ROOM_DEFAULTS, dimensions NCR-specific
// ---------------------------------------------------------------------------
// Dimensions based on typical NCR mid-income flat/builder floor rooms:
//   2BHK ~800-1000 sqft  |  3BHK ~1100-1400 sqft  |  Duplex ~1600-2200 sqft
// ---------------------------------------------------------------------------

export const NCR_TEMPLATES = {
  // Sourced from ROOM_DEFAULTS.BEDROOM_MASTER (3L, 1F, 4×5A, 1×15A, 1 heavy, 0 exhaust)
  BEDROOM_MASTER: fromDefaults("BEDROOM_MASTER", 14, 12),

  // Sourced from ROOM_DEFAULTS.BEDROOM (2L, 1F, 3×5A, 1×15A, 1 heavy, 0 exhaust)
  BEDROOM: fromDefaults("BEDROOM", 12, 10),

  // Sourced from ROOM_DEFAULTS.LIVING_ROOM (4L, 2F, 4×5A, 2×15A, 1 heavy, 0 exhaust)
  LIVING_ROOM: fromDefaults("LIVING_ROOM", 16, 12),

  // Sourced from ROOM_DEFAULTS.KITCHEN (2L, 0F, 2×5A, 3×15A, 0 heavy, 1 exhaust)
  KITCHEN: fromDefaults("KITCHEN", 10, 8),

  // Sourced from ROOM_DEFAULTS.KITCHEN_MODULAR (3L, 0F, 3×5A, 4×15A, 1 heavy, 1 exhaust)
  KITCHEN_MODULAR: fromDefaults("KITCHEN_MODULAR", 12, 10),

  // Sourced from ROOM_DEFAULTS.BATHROOM (1L, 0F, 1×5A, 0×15A, 1 heavy, 1 exhaust)
  // heavy=1 represents geyser provision
  BATHROOM: fromDefaults("BATHROOM", 7, 5),

  // Sourced from ROOM_DEFAULTS.BATHROOM_COMMON (1L, 0F, 0×5A, 0×15A, 0 heavy, 1 exhaust)
  // No geyser provision — used for guest/common bathrooms
  BATHROOM_COMMON: fromDefaults("BATHROOM_COMMON", 6, 5),

  // Sourced from ROOM_DEFAULTS.BALCONY (1L, 0F, 1×5A, 0×15A, 0 heavy, 0 exhaust)
  BALCONY: fromDefaults("BALCONY", 10, 4),

  // Sourced from ROOM_DEFAULTS.PASSAGE (1L, 0F, 1×5A, 0×15A, 0 heavy, 0 exhaust)
  PASSAGE: fromDefaults("PASSAGE", 8, 4),

  // Sourced from ROOM_DEFAULTS.DINING (2L, 1F, 2×5A, 0×15A, 0 heavy, 0 exhaust)
  DINING: fromDefaults("DINING", 14, 12),

  // Sourced from ROOM_DEFAULTS.STAIRCASE (2L, 0F, 0×5A, 0×15A, 0 heavy, 0 exhaust)
  STAIRCASE: fromDefaults("STAIRCASE", 10, 4),
};

// ---------------------------------------------------------------------------
// Duplex-specific adjustments
// ---------------------------------------------------------------------------
// NCR duplexes (1600–2200 sqft) have significantly larger rooms than standard
// flats. These adjustments are ADDITIVE on top of ROOM_DEFAULTS baselines.
// Each adjustment is documented with the reasoning for the divergence.
// ---------------------------------------------------------------------------

export const DUPLEX_ADJUSTMENTS = {
  // Duplex living rooms: typically 20–22ft × 14–16ft (open-plan layout).
  // NCR duplexes rarely have walls between living and foyer — more area = more points.
  LIVING_ROOM: {
    additionalLightPoints: 2,   // 4 → 6: foyer area + accent lighting for open plan
    additionalSocket5A: 2,      // 4 → 6: TV unit area, sofa sides, display cabinet
    additionalSocket15A: 1,     // 2 → 3: home theater amp, additional appliance point
    heavyAppliances: 2,         // 1 → 2: large open-plan room needs 2 ACs in NCR summers
    lengthFt: 22,
    widthFt: 16,
  },

  // Duplex modular kitchens: typically 14ft × 12ft with island/peninsula.
  // Electric hob (induction/cooking range) is standard in upscale NCR duplexes.
  KITCHEN_MODULAR: {
    additionalLightPoints: 1,   // 3 → 4: under-cabinet + ceiling + task lighting
    additionalSocket5A: 1,      // 3 → 4: additional countertop appliance point
    additionalSocket15A: 1,     // 4 → 5: dishwasher/RO purifier dedicated socket
    hasCookingRange: true,      // Electric hob provision — standard in NCR duplex kitchens
    lengthFt: 14,
    widthFt: 12,
  },

  // Duplex master bedrooms: typically 16–18ft × 14ft with dresser/vanity area.
  BEDROOM_MASTER: {
    additionalLightPoints: 1,   // 3 → 4: dresser/vanity mirror light
    additionalSocket5A: 1,      // 4 → 5: dresser point + additional bedside
    additionalSocket15A: 1,     // 1 → 2: TV unit area in master bedroom
    lengthFt: 18,
    widthFt: 14,
  },

  // Duplex secondary bedrooms: typically 14ft × 12ft with study corner.
  BEDROOM: {
    additionalLightPoints: 1,   // 2 → 3: study/desk area task light
    additionalSocket5A: 1,      // 3 → 4: study desk power point
    lengthFt: 14,
    widthFt: 12,
  },

  // Duplex master bathrooms: typically 10ft × 7ft with separate vanity lighting.
  BATHROOM: {
    additionalLightPoints: 1,   // 1 → 2: vanity mirror light
    lengthFt: 10,
    widthFt: 7,
  },

  // Duplex balconies: typically larger (14ft × 5ft) with seating area.
  BALCONY: {
    additionalLightPoints: 1,   // 1 → 2: wall light for seating area
    lengthFt: 14,
    widthFt: 5,
  },

  // Duplex dining rooms: typically 14ft × 12ft with chandelier provision.
  DINING: {
    additionalLightPoints: 1,   // 2 → 3: chandelier/pendant provision
    additionalSocket15A: 1,     // 0 → 1: buffet/sideboard appliance point
  },
} as const;

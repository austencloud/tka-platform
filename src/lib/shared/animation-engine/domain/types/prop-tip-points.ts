// src/lib/shared/animation-engine/domain/types/PropTipPoints.ts

/**
 * Unified Prop Tip Point Definitions
 *
 * Single source of truth for tip positions across all effects (fire, LED,
 * trails, charcoal). Coordinates are in prop-local space (same units as
 * PROP_DIMENSIONS):
 *   - dx: offset along prop primary axis from center
 *   - dy: offset perpendicular to prop axis
 *
 * Effect-specific scaling (flameScale, brightness, trailWidth) is NOT stored
 * here. Each effect renderer applies its own global scaling at read time.
 */

/**
 * A single tip attachment point on a prop. Position only - no effect-specific
 * properties. All effects (fire, LED, trail, charcoal) emit from these same
 * positions.
 */
export interface TipPoint {
  /** Offset along prop primary axis from center (prop-dimension units) */
  dx: number;
  /** Offset perpendicular to prop axis from center (prop-dimension units) */
  dy: number;
}

/**
 * Tip point configuration for a prop type.
 */
export interface PropTipConfig {
  /** Tip attachment points in prop-local coordinates */
  points: TipPoint[];
}

// ─── Staff Family ─────────────────────────────────────────────────────────────

// Bilateral — two mirror-symmetric ends, each ~126 from the pivot (the 252.8
// pictograph half-width), so the staff spans ~253 tip to tip.
const STAFF_TIP_POINTS: PropTipConfig = {
  points: [
    { dx: -126.4, dy: 0 },
    { dx: 126.4, dy: 0 },
  ],
};

// Bilateral. Sits slightly inside its viewBox edge, the same proportion it held
// before the pictograph convergence.
const SIMPLE_STAFF_TIP_POINTS: PropTipConfig = {
  points: [
    { dx: -113.76, dy: 0 },
    { dx: 113.76, dy: 0 },
  ],
};

const STAFF_V2_TIP_POINTS: PropTipConfig = {
  points: [
    { dx: -112.5, dy: 0 },
    { dx: 112.5, dy: 0 },
  ],
};

// Bilateral, and deliberately shorter than the 126.4 half-width its artwork
// spans. The tracked point on an LED baton is the light capsule inside the
// frosted cap, not the outer rim of the cap, so every emitter that reads this
// table (LED, fire, trails, charcoal, mandala) fires from the lit spot.
const CAPSULE_BATON_TIP_POINTS: PropTipConfig = {
  points: [
    { dx: -117, dy: 0 },
    { dx: 117, dy: 0 },
  ],
};

// Bilateral, and deliberately shorter than the 126.4 half-width its artwork
// spans. Fire comes off the middle of a monkey-fist wick, not off its far face,
// so every emitter that reads this table fires from where the fuel actually is.
const FIRE_DOUBLE_STAFF_TIP_POINTS: PropTipConfig = {
  points: [
    { dx: -114.7, dy: 0 },
    { dx: 114.7, dy: 0 },
  ],
};

const BIGSTAFF_TIP_POINTS: PropTipConfig = {
  points: [
    { dx: -300, dy: 0 },
    { dx: 300, dy: 0 },
  ],
};

// ─── Club Family ──────────────────────────────────────────────────────────────

// The regular club is center-pivoted inside a 258.67-unit viewBox. Using its
// exact half-width keeps the mandala and live trails on the resized visible tip.
// This is the reach every other regular prop is tuned against.
const CLUB_TIP_POINTS: PropTipConfig = {
  points: [{ dx: 129.335, dy: 0 }],
};

// Big club is bilateral — two mirror-symmetric ends (Knob / Bulb). Prop width is
// 252 (PROP_DIMENSIONS), so each end sits ~126 from center. Matches the
// bigchicken pattern and the TWO_ENDED_PROPS set in prop-tip-ends.ts.
const BIGCLUB_TIP_POINTS: PropTipConfig = {
  points: [
    { dx: -125.79, dy: 0 },
    { dx: 125.79, dy: 0 },
  ],
};

// ─── Fan Family ───────────────────────────────────────────────────────────────

export const FAN_TIP_POINTS: PropTipConfig = {
  points: [
    // The five visible outer-rim/rib intersections, on the 260 x 207
    // pictograph fan. The outer rib lands at 130 — the club's reach.
    { dx: 72.8, dy: -102.03 },
    { dx: 99.67, dy: -57.93 },
    { dx: 130, dy: 0 },
    { dx: 99.67, dy: 57.93 },
    { dx: 72.8, dy: 102.03 },
  ],
};

const BIGFAN_TIP_POINTS: PropTipConfig = {
  points: [
    { dx: 154, dy: -184 },
    { dx: 218, dy: -102 },
    { dx: 240, dy: 0 },
    { dx: 218, dy: 102 },
    { dx: 154, dy: 184 },
  ],
};

// ─── Triad Family ─────────────────────────────────────────────────────────────

export const TRIAD_TIP_POINTS: PropTipConfig = {
  points: [
    { dx: 107.8, dy: 0 },
    { dx: -53.9, dy: -93.7 },
    { dx: -53.9, dy: 93.7 },
  ],
};

const BIGTRIAD_TIP_POINTS: PropTipConfig = {
  points: [
    { dx: 260, dy: 0 },
    { dx: -130, dy: -226 },
    { dx: -130, dy: 226 },
  ],
};

// ─── Hoop Family ──────────────────────────────────────────────────────────────

const MINIHOOP_TIP_POINTS: PropTipConfig = {
  points: [
    { dx: 34.28, dy: -68.63 },
    { dx: 102.85, dy: -21.45 },
    { dx: 102.85, dy: 21.45 },
    { dx: 34.28, dy: 68.63 },
    { dx: -25.71, dy: 0 },
  ],
};

const BIGHOOP_TIP_POINTS: PropTipConfig = {
  points: [
    { dx: 80, dy: -150 },
    { dx: 230, dy: -50 },
    { dx: 230, dy: 50 },
    { dx: 80, dy: 150 },
    { dx: -60, dy: 0 },
  ],
};

// ─── Buugeng Family ───────────────────────────────────────────────────────────

const BUUGENG_TIP_POINTS: PropTipConfig = {
  points: [
    // The pictograph SVG is 262.6 x 135.9. Its two narrow terminals reach the
    // horizontal viewBox edges within four units of the centerline. Centered
    // edge anchors stay on those terminals under either chirality flip; the
    // old diagonal offsets landed on the inner curves instead. Bilateral, so
    // ~131 each way — the club's reach mirrored, a 262 span.
    { dx: 131.3, dy: 0 },
    { dx: -131.3, dy: 0 },
  ],
};

const BIGBUUGENG_TIP_POINTS: PropTipConfig = {
  points: [
    // Same centered terminal geometry at the 600 x 293.1 big-prop scale.
    { dx: 300, dy: 0 },
    { dx: -300, dy: 0 },
  ],
};

const TRIGENG_TIP_POINTS: PropTipConfig = {
  points: [
    { dx: 108.33, dy: -50.01 },
    { dx: 0, dy: 0 },
    { dx: -108.33, dy: 50.01 },
  ],
};

// ─── Sword ────────────────────────────────────────────────────────────────────

const SWORD_TIP_POINTS: PropTipConfig = {
  points: [{ dx: 280, dy: 0 }],
};

// ─── Sickles ─────────────────────────────────────────────────────────────────

// The SVG pivot is the lower wrapped grip at (190, 150). The physical kama is
// rotated around that hand point so its blade apex lands on the +X kinetic axis;
// the butt is not tracked.
const SICKLES_TIP_POINTS: PropTipConfig = {
  points: [{ dx: 192, dy: 0 }],
};

// ─── Energy Family (premium cosmetics) ────────────────────────────────────────

// Energy Saber is a sword restyle, so it gets sword's reach exactly: the blade
// tip sits 280 units from the pivot in a 620-unit box. Single-ended — the hilt
// end is not tracked (see TWO_ENDED_PROPS in prop-tip-ends.ts, which must
// agree with this entry).
const ENERGY_SABER_TIP_POINTS: PropTipConfig = {
  points: [{ dx: 280, dy: 0 }],
};

// Energy Staff is a staff restyle, so both blades reach 126.4 like staff's two
// ends. The collars are shaped differently for the thumb/pinky landmark, but
// the tracked geometry stays mirror-symmetric.
const ENERGY_STAFF_TIP_POINTS: PropTipConfig = {
  points: [
    { dx: -126.4, dy: 0 },
    { dx: 126.4, dy: 0 },
  ],
};

// ─── Triquetra Family ─────────────────────────────────────────────────────────

const TRIQUETRA_TIP_POINTS: PropTipConfig = {
  points: [
    { dx: 125.8, dy: 0 },
    { dx: -62.9, dy: -109.34 },
    { dx: -62.9, dy: 109.34 },
  ],
};

// triquetra2 stays on the animated artwork (the pictograph file is a different
// shape, not a rescale), so it keeps the original 300-box offsets.
const TRIQUETRA2_TIP_POINTS: PropTipConfig = {
  points: [
    { dx: 130, dy: 0 },
    { dx: -65, dy: -113 },
    { dx: -65, dy: 113 },
  ],
};

// ─── Chicken Family ───────────────────────────────────────────────────────────

// Regular (small) chicken is single-ended — one weighted tip at the outer
// (+dx) end, matching the club/sword single-tip convention.
const CHICKEN_TIP_POINTS: PropTipConfig = {
  points: [{ dx: 162.5, dy: 0 }],
};

// Big chicken is bilateral — two mirror-symmetric ends. (See the
// TWO_ENDED_PROPS set in prop-tip-ends.ts: bigchicken is two-ended, regular
// chicken is not.)
const BIGCHICKEN_TIP_POINTS: PropTipConfig = {
  points: [
    { dx: -126.4, dy: 0 },
    { dx: 126.4, dy: 0 },
  ],
};

// ─── Guitar Family ────────────────────────────────────────────────────────────

const GUITAR_TIP_POINTS: PropTipConfig = {
  points: [{ dx: 290.78, dy: 0 }],
};

const UKULELE_TIP_POINTS: PropTipConfig = {
  points: [{ dx: 170, dy: 0 }],
};

// ─── Doublestar Family ────────────────────────────────────────────────────────

const DOUBLESTAR_TIP_POINTS: PropTipConfig = {
  points: [
    { dx: 150, dy: 0 },
    { dx: -150, dy: 0 },
    { dx: 0, dy: -75 },
    { dx: 0, dy: 75 },
  ],
};

const BIGDOUBLESTAR_TIP_POINTS: PropTipConfig = {
  points: [
    { dx: 300, dy: 0 },
    { dx: -300, dy: 0 },
    { dx: 0, dy: -150 },
    { dx: 0, dy: 150 },
  ],
};

// ─── Eightrings Family ────────────────────────────────────────────────────────

// Both entries used to sit on the top of a ring at roughly half the real
// reach, so the mandala came out ~34% short. These are the artwork's own outer
// extents, measured off the pictograph SVGs with isPointInFill.
const EIGHTRINGS_TIP_POINTS: PropTipConfig = {
  points: [
    { dx: 128.5, dy: -2.5 },
    { dx: -128.5, dy: -2.5 },
  ],
};

const BIGEIGHTRINGS_TIP_POINTS: PropTipConfig = {
  points: [
    { dx: 300, dy: -3.8 },
    { dx: -300, dy: -3.8 },
  ],
};

// ─── Quiad ────────────────────────────────────────────────────────────────────

export const QUIAD_TIP_POINTS: PropTipConfig = {
  points: [
    { dx: 104.17, dy: 0 },
    { dx: 0, dy: -104.17 },
    { dx: -104.17, dy: 0 },
    { dx: 0, dy: 104.17 },
  ],
};

// ─── Torch ────────────────────────────────────────────────────────────────────

const TORCH_TIP_POINTS: PropTipConfig = {
  points: [{ dx: -140, dy: 0 }],
};

const BIGTORCH_TIP_POINTS: PropTipConfig = {
  points: [{ dx: -120, dy: 0 }],
};

// ─── Poi ──────────────────────────────────────────────────────────────────────

const POI_TIP_POINTS: PropTipConfig = {
  // Same overall reach as the club (grip to far tip = ~129.3); trail follows
  // the ball center at 99 (see static/images/props/*/poi.svg).
  points: [{ dx: 99, dy: 0 }],
};

// ─── No tips (contact ball, hand) ─────────────────────────────────────────────

const EMPTY_TIP_POINTS: PropTipConfig = {
  points: [],
};

// ═══════════════════════════════════════════════════════════════════════════════
// Override Provider (callback pattern avoids circular dependency with feature layer)
// ═══════════════════════════════════════════════════════════════════════════════

type TipPointOverrideFn = (propType: string) => PropTipConfig | null;
let overrideProvider: TipPointOverrideFn | null = null;

/**
 * Register a callback that can supply custom tip points for a prop type.
 * Pass null to remove the override provider.
 */
export function setTipPointOverrideProvider(
  provider: TipPointOverrideFn | null
): void {
  overrideProvider = provider;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Registry
// ═══════════════════════════════════════════════════════════════════════════════

export const PROP_TIP_POINTS: Record<string, PropTipConfig> = {
  // Staff family — one config each now: the three regular staves scaled onto
  // the pictograph family by different factors, so they can't share a table.
  staff: STAFF_TIP_POINTS,
  simple_staff: SIMPLE_STAFF_TIP_POINTS,
  bigstaff: BIGSTAFF_TIP_POINTS,
  staff_v2: STAFF_V2_TIP_POINTS,
  capsule_baton: CAPSULE_BATON_TIP_POINTS,
  fire_double_staff: FIRE_DOUBLE_STAFF_TIP_POINTS,

  // Club family
  club: CLUB_TIP_POINTS,
  bigclub: BIGCLUB_TIP_POINTS,

  // Fan family
  fan: FAN_TIP_POINTS,
  bigfan: BIGFAN_TIP_POINTS,

  // Triad family
  triad: TRIAD_TIP_POINTS,
  bigtriad: BIGTRIAD_TIP_POINTS,

  // Hoop family
  minihoop: MINIHOOP_TIP_POINTS,
  bighoop: BIGHOOP_TIP_POINTS,

  // Buugeng family
  buugeng: BUUGENG_TIP_POINTS,
  bigbuugeng: BIGBUUGENG_TIP_POINTS,
  trigeng: TRIGENG_TIP_POINTS,

  // Hand
  hand: EMPTY_TIP_POINTS,

  // Triquetra family
  triquetra: TRIQUETRA_TIP_POINTS,
  triquetra2: TRIQUETRA2_TIP_POINTS,

  // Sword
  sword: SWORD_TIP_POINTS,

  // Sickles
  sickles: SICKLES_TIP_POINTS,

  // Energy family (premium cosmetics) — reach copied from each parent
  energy_saber: ENERGY_SABER_TIP_POINTS,
  energy_staff: ENERGY_STAFF_TIP_POINTS,

  // Chicken family
  chicken: CHICKEN_TIP_POINTS,
  bigchicken: BIGCHICKEN_TIP_POINTS,

  // Guitar family
  guitar: GUITAR_TIP_POINTS,
  ukulele: UKULELE_TIP_POINTS,

  // Doublestar family
  doublestar: DOUBLESTAR_TIP_POINTS,
  bigdoublestar: BIGDOUBLESTAR_TIP_POINTS,

  // Eightrings family
  eightrings: EIGHTRINGS_TIP_POINTS,
  bigeightrings: BIGEIGHTRINGS_TIP_POINTS,

  // Quiad
  quiad: QUIAD_TIP_POINTS,

  // Contact ball family
  contactball: EMPTY_TIP_POINTS,
  bigcontactball: EMPTY_TIP_POINTS,
  doublecontactball: EMPTY_TIP_POINTS,
  bigdoublecontactball: EMPTY_TIP_POINTS,

  // Torch family
  torch: TORCH_TIP_POINTS,
  bigtorch: BIGTORCH_TIP_POINTS,

  // Poi
  poi: POI_TIP_POINTS,
};

export const DEFAULT_TIP_POINTS: PropTipConfig = STAFF_TIP_POINTS;

/**
 * Look up tip points for a prop type. Checks override provider first,
 * then hardcoded registry, then falls back to staff-like endpoints.
 */
export function getTipPoints(
  propType: string | null | undefined
): PropTipConfig {
  if (!propType) return DEFAULT_TIP_POINTS;
  const key = propType.toLowerCase();
  if (overrideProvider) {
    const override = overrideProvider(key);
    if (override) return override;
  }
  return PROP_TIP_POINTS[key] ?? DEFAULT_TIP_POINTS;
}

/**
 * Look up baseline tip points for a prop type, bypassing any registered
 * override provider. Used by the mandala geometry calculator, which traces
 * hand-path geometry using canonical prop dimensions rather than
 * effects-lab custom tip positions.
 */
export function getTipPointsBaseline(
  propType: string | null | undefined
): PropTipConfig {
  if (!propType) return DEFAULT_TIP_POINTS;
  const key = propType.toLowerCase();
  return PROP_TIP_POINTS[key] ?? DEFAULT_TIP_POINTS;
}

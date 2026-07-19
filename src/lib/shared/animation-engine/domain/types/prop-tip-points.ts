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

const STAFF_TIP_POINTS: PropTipConfig = {
  points: [
    { dx: -135, dy: 0 },
    { dx: 135, dy: 0 },
  ],
};

const BIGSTAFF_TIP_POINTS: PropTipConfig = {
  points: [
    { dx: -300, dy: 0 },
    { dx: 300, dy: 0 },
  ],
};

// ─── Club Family ──────────────────────────────────────────────────────────────

// Regular (small) club is single-ended — one weighted tip at the outer end,
// matching the club/sword single-tip convention.
const CLUB_TIP_POINTS: PropTipConfig = {
  points: [{ dx: 130, dy: 0 }],
};

// Big club is bilateral — two mirror-symmetric ends (Knob / Bulb). Prop width is
// 300.5 (PROP_DIMENSIONS), so each end sits ~150 from center. Matches the
// bigchicken pattern and the TWO_ENDED_PROPS set in prop-tip-ends.ts.
const BIGCLUB_TIP_POINTS: PropTipConfig = {
  points: [
    { dx: -150, dy: 0 },
    { dx: 150, dy: 0 },
  ],
};

// ─── Fan Family ───────────────────────────────────────────────────────────────

const FAN_TIP_POINTS: PropTipConfig = {
  points: [
    { dx: 67, dy: -80 },
    { dx: 95, dy: -45 },
    { dx: 105, dy: 0 },
    { dx: 95, dy: 45 },
    { dx: 67, dy: 80 },
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

const TRIAD_TIP_POINTS: PropTipConfig = {
  points: [
    { dx: 130, dy: 0 },
    { dx: -65, dy: -113 },
    { dx: -65, dy: 113 },
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
    { dx: 40, dy: -80 },
    { dx: 120, dy: -25 },
    { dx: 120, dy: 25 },
    { dx: 40, dy: 80 },
    { dx: -30, dy: 0 },
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
    { dx: 130, dy: -40 },
    { dx: -130, dy: 40 },
  ],
};

const BIGBUUGENG_TIP_POINTS: PropTipConfig = {
  points: [
    { dx: 260, dy: -80 },
    { dx: -260, dy: 80 },
  ],
};

const TRIGENG_TIP_POINTS: PropTipConfig = {
  points: [
    { dx: 130, dy: -60 },
    { dx: 0, dy: 0 },
    { dx: -130, dy: 60 },
  ],
};

// ─── Sword ────────────────────────────────────────────────────────────────────

const SWORD_TIP_POINTS: PropTipConfig = {
  points: [{ dx: 280, dy: 0 }],
};

// ─── Triquetra Family ─────────────────────────────────────────────────────────

const TRIQUETRA_TIP_POINTS: PropTipConfig = {
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
  points: [{ dx: 150, dy: 0 }],
};

// Big chicken is bilateral — two mirror-symmetric ends. (See the
// TWO_ENDED_PROPS set in prop-tip-ends.ts: bigchicken is two-ended, regular
// chicken is not.)
const BIGCHICKEN_TIP_POINTS: PropTipConfig = {
  points: [
    { dx: -150, dy: 0 },
    { dx: 150, dy: 0 },
  ],
};

// ─── Guitar Family ────────────────────────────────────────────────────────────

const GUITAR_TIP_POINTS: PropTipConfig = {
  points: [{ dx: 290, dy: 0 }],
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

const EIGHTRINGS_TIP_POINTS: PropTipConfig = {
  points: [
    { dx: 75, dy: -65 },
    { dx: -75, dy: -65 },
  ],
};

const BIGEIGHTRINGS_TIP_POINTS: PropTipConfig = {
  points: [
    { dx: 150, dy: -130 },
    { dx: -150, dy: -130 },
  ],
};

// ─── Quiad ────────────────────────────────────────────────────────────────────

const QUIAD_TIP_POINTS: PropTipConfig = {
  points: [
    { dx: 125, dy: 0 },
    { dx: 0, dy: -125 },
    { dx: -125, dy: 0 },
    { dx: 0, dy: 125 },
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
  // Staff family
  staff: STAFF_TIP_POINTS,
  simple_staff: STAFF_TIP_POINTS,
  bigstaff: BIGSTAFF_TIP_POINTS,
  staff_v2: STAFF_TIP_POINTS,

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
  triquetra2: TRIQUETRA_TIP_POINTS,

  // Sword
  sword: SWORD_TIP_POINTS,

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

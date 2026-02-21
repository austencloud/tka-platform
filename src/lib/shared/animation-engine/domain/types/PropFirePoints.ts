/**
 * Prop Fire Point Definitions
 *
 * Maps each prop type to its fire attachment points. Coordinates are in
 * prop-local space (same units as PROP_DIMENSIONS):
 *   - dx: offset along prop primary axis from center (positive = toward "right"/tip end)
 *   - dy: offset perpendicular to prop axis (positive = clockwise from tip direction in screen space)
 *
 * These get transformed to canvas space in FireTipTracker via:
 *   worldX = centerX + (dx * cos(angle) - dy * sin(angle)) * scaleFactor
 *   worldY = centerY + (dx * sin(angle) + dy * cos(angle)) * scaleFactor
 *
 * Where scaleFactor = canvasSize / 950 (viewBox normalization).
 */

/**
 * A single fire attachment point on a prop.
 */
export interface FirePoint {
	/** Offset along prop primary axis from center (prop-dimension units) */
	dx: number;
	/** Offset perpendicular to prop axis from center (prop-dimension units) */
	dy: number;
	/** Relative flame size. 1.0 = standard staff wick. Affects splat radius and fuel injection. */
	flameScale: number;
}

/**
 * Fire point configuration for a prop type.
 */
export interface PropFirePointConfig {
	/** Fire attachment points in prop-local coordinates */
	points: FirePoint[];
}

// ─── Staff Family ─────────────────────────────────────────────────────────────
// Two wicks, one at each end. Standard fire staff.

const STAFF_FIRE_POINTS: PropFirePointConfig = {
	points: [
		{ dx: -150, dy: 0, flameScale: 1.0 },
		{ dx: 150, dy: 0, flameScale: 1.0 },
	],
};

const BIGSTAFF_FIRE_POINTS: PropFirePointConfig = {
	points: [
		{ dx: -300, dy: 0, flameScale: 1.2 },
		{ dx: 300, dy: 0, flameScale: 1.2 },
	],
};

// ─── Club Family ──────────────────────────────────────────────────────────────
// One wick at the knob end (positive dx = right/tip direction).

const CLUB_FIRE_POINTS: PropFirePointConfig = {
	points: [{ dx: 130, dy: 0, flameScale: 1.0 }],
};

const BIGCLUB_FIRE_POINTS: PropFirePointConfig = {
	points: [{ dx: 130, dy: 0, flameScale: 1.2 }],
};

// ─── Fan Family ───────────────────────────────────────────────────────────────
// Five wicks at tine tips, fanning out in an arc. Tines spread roughly ±50°
// from the prop axis at radius ~120 units from center.

const FAN_FIRE_POINTS: PropFirePointConfig = {
	points: [
		{ dx: 77, dy: -92, flameScale: 0.6 }, // upper far tine (-50°)
		{ dx: 109, dy: -51, flameScale: 0.6 }, // upper mid tine (-25°)
		{ dx: 120, dy: 0, flameScale: 0.6 }, // center tine (0°)
		{ dx: 109, dy: 51, flameScale: 0.6 }, // lower mid tine (+25°)
		{ dx: 77, dy: 92, flameScale: 0.6 }, // lower far tine (+50°)
	],
};

const BIGFAN_FIRE_POINTS: PropFirePointConfig = {
	points: [
		{ dx: 154, dy: -184, flameScale: 0.7 },
		{ dx: 218, dy: -102, flameScale: 0.7 },
		{ dx: 240, dy: 0, flameScale: 0.7 },
		{ dx: 218, dy: 102, flameScale: 0.7 },
		{ dx: 154, dy: 184, flameScale: 0.7 },
	],
};

// ─── Triad Family ─────────────────────────────────────────────────────────────
// Three prongs at 120° spacing. Right prong along prop axis, two diagonal prongs
// extend backward at ±120°.

const TRIAD_FIRE_POINTS: PropFirePointConfig = {
	points: [
		{ dx: 130, dy: 0, flameScale: 0.8 }, // right prong (0°)
		{ dx: -65, dy: -113, flameScale: 0.8 }, // upper-left prong (120°)
		{ dx: -65, dy: 113, flameScale: 0.8 }, // lower-left prong (240°)
	],
};

const BIGTRIAD_FIRE_POINTS: PropFirePointConfig = {
	points: [
		{ dx: 260, dy: 0, flameScale: 1.0 },
		{ dx: -130, dy: -226, flameScale: 1.0 },
		{ dx: -130, dy: 226, flameScale: 1.0 },
	],
};

// ─── Hoop Family ──────────────────────────────────────────────────────────────
// Fire hoops have wicks distributed around the ring. 5 wicks at even spacing
// around the ring circumference. Ring center is offset from prop center
// (hand grip is to the left).

const MINIHOOP_FIRE_POINTS: PropFirePointConfig = {
	points: [
		{ dx: 40, dy: -80, flameScale: 0.5 }, // top of ring
		{ dx: 120, dy: -25, flameScale: 0.5 }, // upper-right
		{ dx: 120, dy: 25, flameScale: 0.5 }, // lower-right
		{ dx: 40, dy: 80, flameScale: 0.5 }, // bottom of ring
		{ dx: -30, dy: 0, flameScale: 0.5 }, // left of ring
	],
};

const BIGHOOP_FIRE_POINTS: PropFirePointConfig = {
	points: [
		{ dx: 80, dy: -150, flameScale: 0.6 },
		{ dx: 230, dy: -50, flameScale: 0.6 },
		{ dx: 230, dy: 50, flameScale: 0.6 },
		{ dx: 80, dy: 150, flameScale: 0.6 },
		{ dx: -60, dy: 0, flameScale: 0.6 },
	],
};

// ─── Buugeng Family ───────────────────────────────────────────────────────────
// S-shaped prop with two far tips at opposite corners of the S-curve.

const BUUGENG_FIRE_POINTS: PropFirePointConfig = {
	points: [
		{ dx: 130, dy: -40, flameScale: 0.7 }, // upper-right tip
		{ dx: -130, dy: 40, flameScale: 0.7 }, // lower-left tip
	],
};

const BIGBUUGENG_FIRE_POINTS: PropFirePointConfig = {
	points: [
		{ dx: 260, dy: -80, flameScale: 0.8 },
		{ dx: -260, dy: 80, flameScale: 0.8 },
	],
};

const FRACTALGENG_FIRE_POINTS: PropFirePointConfig = {
	points: [
		{ dx: 120, dy: -80, flameScale: 0.7 },
		{ dx: -120, dy: 80, flameScale: 0.7 },
	],
};

// Trigeng: 3-segment S-curve. Three tips — top, middle, and bottom of the curve.
const TRIGENG_FIRE_POINTS: PropFirePointConfig = {
	points: [
		{ dx: 130, dy: -60, flameScale: 0.6 },  // upper tip
		{ dx: 0, dy: 0, flameScale: 0.5 },       // center junction
		{ dx: -130, dy: 60, flameScale: 0.6 },   // lower tip
	],
};

// ─── Sword ────────────────────────────────────────────────────────────────────
// Blade tip only. The golden blade is the "fire" end.

const SWORD_FIRE_POINTS: PropFirePointConfig = {
	points: [{ dx: 280, dy: 0, flameScale: 1.2 }],
};

// ─── Triquetra Family ─────────────────────────────────────────────────────────
// Three-lobed knot shape. Tips at 120° spacing.

const TRIQUETRA_FIRE_POINTS: PropFirePointConfig = {
	points: [
		{ dx: 130, dy: 0, flameScale: 0.7 },
		{ dx: -65, dy: -113, flameScale: 0.7 },
		{ dx: -65, dy: 113, flameScale: 0.7 },
	],
};

// ─── Chicken Family ───────────────────────────────────────────────────────────
// Rubber chicken staff. Both ends, like a regular staff.

const CHICKEN_FIRE_POINTS: PropFirePointConfig = {
	points: [
		{ dx: -150, dy: 0, flameScale: 0.8 },
		{ dx: 150, dy: 0, flameScale: 0.8 },
	],
};

// ─── Guitar Family ────────────────────────────────────────────────────────────
// Headstock end only (fire guitar is a novelty, one end).

const GUITAR_FIRE_POINTS: PropFirePointConfig = {
	points: [{ dx: 290, dy: 0, flameScale: 0.5 }],
};

const UKULELE_FIRE_POINTS: PropFirePointConfig = {
	points: [{ dx: 170, dy: 0, flameScale: 0.5 }],
};

// ─── Doublestar Family ────────────────────────────────────────────────────────
// Two stars side by side. Four outer tips at cardinal directions.

const DOUBLESTAR_FIRE_POINTS: PropFirePointConfig = {
	points: [
		{ dx: 150, dy: 0, flameScale: 0.6 }, // far right
		{ dx: -150, dy: 0, flameScale: 0.6 }, // far left
		{ dx: 0, dy: -75, flameScale: 0.6 }, // top
		{ dx: 0, dy: 75, flameScale: 0.6 }, // bottom
	],
};

const BIGDOUBLESTAR_FIRE_POINTS: PropFirePointConfig = {
	points: [
		{ dx: 300, dy: 0, flameScale: 0.7 },
		{ dx: -300, dy: 0, flameScale: 0.7 },
		{ dx: 0, dy: -150, flameScale: 0.7 },
		{ dx: 0, dy: 150, flameScale: 0.7 },
	],
};

// ─── Eightrings Family ────────────────────────────────────────────────────────
// Two rings. One wick at top of each ring.

const EIGHTRINGS_FIRE_POINTS: PropFirePointConfig = {
	points: [
		{ dx: 75, dy: -65, flameScale: 0.5 }, // right ring top
		{ dx: -75, dy: -65, flameScale: 0.5 }, // left ring top
	],
};

const BIGEIGHTRINGS_FIRE_POINTS: PropFirePointConfig = {
	points: [
		{ dx: 150, dy: -130, flameScale: 0.6 },
		{ dx: -150, dy: -130, flameScale: 0.6 },
	],
};

// ─── Quiad ────────────────────────────────────────────────────────────────────
// Plus/cross shape. Four arm tips at 90° spacing.

const QUIAD_FIRE_POINTS: PropFirePointConfig = {
	points: [
		{ dx: 125, dy: 0, flameScale: 0.8 }, // right
		{ dx: 0, dy: -125, flameScale: 0.8 }, // top
		{ dx: -125, dy: 0, flameScale: 0.8 }, // left
		{ dx: 0, dy: 125, flameScale: 0.8 }, // bottom
	],
};

// ─── Torch ────────────────────────────────────────────────────────────────────
// Single flame at the wick end (left/negative-dx end of the prop).

const TORCH_FIRE_POINTS: PropFirePointConfig = {
	points: [{ dx: -140, dy: 0, flameScale: 1.0 }],
};

const BIGTORCH_FIRE_POINTS: PropFirePointConfig = {
	points: [{ dx: -120, dy: 0, flameScale: 1.3 }],
};

// ─── Poi ──────────────────────────────────────────────────────────────────────
// Ball end only (positive direction from center).

const POI_FIRE_POINTS: PropFirePointConfig = {
	points: [{ dx: 130, dy: 0, flameScale: 1.0 }],
};

// ─── Hand ─────────────────────────────────────────────────────────────────────
// No fire. Hands don't burn.

const HAND_FIRE_POINTS: PropFirePointConfig = {
	points: [],
};

// ═══════════════════════════════════════════════════════════════════════════════
// Override Provider (callback pattern avoids circular dependency with feature layer)
// ═══════════════════════════════════════════════════════════════════════════════

type FirePointOverrideFn = (propType: string) => PropFirePointConfig | null;
let overrideProvider: FirePointOverrideFn | null = null;

/**
 * Register a callback that can supply custom fire points for a prop type.
 * Pass null to remove the override provider.
 */
export function setFirePointOverrideProvider(provider: FirePointOverrideFn | null): void {
	overrideProvider = provider;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Registry
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Master registry mapping prop type strings to fire point configurations.
 * Keys match PropType enum values (lowercase).
 */
export const PROP_FIRE_POINTS: Record<string, PropFirePointConfig> = {
	// Staff family
	staff: STAFF_FIRE_POINTS,
	simple_staff: STAFF_FIRE_POINTS,
	bigstaff: BIGSTAFF_FIRE_POINTS,
	staff_v2: STAFF_FIRE_POINTS,

	// Club family
	club: CLUB_FIRE_POINTS,
	bigclub: BIGCLUB_FIRE_POINTS,

	// Fan family
	fan: FAN_FIRE_POINTS,
	bigfan: BIGFAN_FIRE_POINTS,

	// Triad family
	triad: TRIAD_FIRE_POINTS,
	bigtriad: BIGTRIAD_FIRE_POINTS,

	// Hoop family
	minihoop: MINIHOOP_FIRE_POINTS,
	bighoop: BIGHOOP_FIRE_POINTS,

	// Buugeng family
	buugeng: BUUGENG_FIRE_POINTS,
	bigbuugeng: BIGBUUGENG_FIRE_POINTS,
	fractalgeng: FRACTALGENG_FIRE_POINTS,
	trigeng: TRIGENG_FIRE_POINTS,

	// Hand
	hand: HAND_FIRE_POINTS,

	// Triquetra family
	triquetra: TRIQUETRA_FIRE_POINTS,
	triquetra2: TRIQUETRA_FIRE_POINTS,

	// Sword
	sword: SWORD_FIRE_POINTS,

	// Chicken family
	chicken: CHICKEN_FIRE_POINTS,
	bigchicken: CHICKEN_FIRE_POINTS,

	// Guitar family
	guitar: GUITAR_FIRE_POINTS,
	ukulele: UKULELE_FIRE_POINTS,

	// Doublestar family
	doublestar: DOUBLESTAR_FIRE_POINTS,
	bigdoublestar: BIGDOUBLESTAR_FIRE_POINTS,

	// Eightrings family
	eightrings: EIGHTRINGS_FIRE_POINTS,
	bigeightrings: BIGEIGHTRINGS_FIRE_POINTS,

	// Quiad
	quiad: QUIAD_FIRE_POINTS,

	// Torch family
	torch: TORCH_FIRE_POINTS,
	bigtorch: BIGTORCH_FIRE_POINTS,

	// Poi
	poi: POI_FIRE_POINTS,
};

/**
 * Default fire points (staff-like: 2 endpoints). Used when prop type is unknown.
 */
export const DEFAULT_FIRE_POINTS: PropFirePointConfig = STAFF_FIRE_POINTS;

/**
 * Look up fire points for a prop type. Falls back to staff-like endpoints.
 */
export function getFirePoints(propType: string | null | undefined): PropFirePointConfig {
	if (!propType) return DEFAULT_FIRE_POINTS;
	const key = propType.toLowerCase();
	if (overrideProvider) {
		const override = overrideProvider(key);
		if (override) return override;
	}
	return PROP_FIRE_POINTS[key] ?? DEFAULT_FIRE_POINTS;
}

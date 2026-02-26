/**
 * Prop Trail Point Definitions
 *
 * Maps each prop type to its trail attachment points. Coordinates are in
 * prop-local space (same units as PROP_DIMENSIONS):
 *   - dx: offset along prop primary axis from center (positive = toward "right"/tip end)
 *   - dy: offset perpendicular to prop axis
 *
 * Trail attachment points define WHERE on the prop trails emanate from.
 * Each point has a trailWidth that controls the line thickness at that point.
 *
 * Default positions mirror fire/LED points since trails naturally trace
 * from the same physical tips and endpoints.
 */

/**
 * A single trail attachment point on a prop.
 */
export interface TrailEmitPoint {
	/** Offset along prop primary axis from center (prop-dimension units) */
	dx: number;
	/** Offset perpendicular to prop axis from center (prop-dimension units) */
	dy: number;
	/** Trail line width at this point. 5 = standard. */
	trailWidth: number;
}

/**
 * Trail point configuration for a prop type.
 */
export interface PropTrailPointConfig {
	/** Trail attachment points in prop-local coordinates */
	points: TrailEmitPoint[];
}

// ─── Staff Family ─────────────────────────────────────────────────────────────

const STAFF_TRAIL_POINTS: PropTrailPointConfig = {
	points: [
		{ dx: -150, dy: 0, trailWidth: 5 },
		{ dx: 150, dy: 0, trailWidth: 5 },
	],
};

const BIGSTAFF_TRAIL_POINTS: PropTrailPointConfig = {
	points: [
		{ dx: -300, dy: 0, trailWidth: 6 },
		{ dx: 300, dy: 0, trailWidth: 6 },
	],
};

// ─── Club Family ──────────────────────────────────────────────────────────────

const CLUB_TRAIL_POINTS: PropTrailPointConfig = {
	points: [{ dx: 130, dy: 0, trailWidth: 5 }],
};

const BIGCLUB_TRAIL_POINTS: PropTrailPointConfig = {
	points: [{ dx: 130, dy: 0, trailWidth: 6 }],
};

// ─── Fan Family ───────────────────────────────────────────────────────────────

const FAN_TRAIL_POINTS: PropTrailPointConfig = {
	points: [
		{ dx: 77, dy: -92, trailWidth: 3 },
		{ dx: 109, dy: -51, trailWidth: 3 },
		{ dx: 120, dy: 0, trailWidth: 3 },
		{ dx: 109, dy: 51, trailWidth: 3 },
		{ dx: 77, dy: 92, trailWidth: 3 },
	],
};

const BIGFAN_TRAIL_POINTS: PropTrailPointConfig = {
	points: [
		{ dx: 154, dy: -184, trailWidth: 4 },
		{ dx: 218, dy: -102, trailWidth: 4 },
		{ dx: 240, dy: 0, trailWidth: 4 },
		{ dx: 218, dy: 102, trailWidth: 4 },
		{ dx: 154, dy: 184, trailWidth: 4 },
	],
};

// ─── Triad Family ─────────────────────────────────────────────────────────────

const TRIAD_TRAIL_POINTS: PropTrailPointConfig = {
	points: [
		{ dx: 130, dy: 0, trailWidth: 4 },
		{ dx: -65, dy: -113, trailWidth: 4 },
		{ dx: -65, dy: 113, trailWidth: 4 },
	],
};

const BIGTRIAD_TRAIL_POINTS: PropTrailPointConfig = {
	points: [
		{ dx: 260, dy: 0, trailWidth: 5 },
		{ dx: -130, dy: -226, trailWidth: 5 },
		{ dx: -130, dy: 226, trailWidth: 5 },
	],
};

// ─── Hoop Family ──────────────────────────────────────────────────────────────

const MINIHOOP_TRAIL_POINTS: PropTrailPointConfig = {
	points: [
		{ dx: 40, dy: -80, trailWidth: 3 },
		{ dx: 120, dy: -25, trailWidth: 3 },
		{ dx: 120, dy: 25, trailWidth: 3 },
		{ dx: 40, dy: 80, trailWidth: 3 },
		{ dx: -30, dy: 0, trailWidth: 3 },
	],
};

const BIGHOOP_TRAIL_POINTS: PropTrailPointConfig = {
	points: [
		{ dx: 80, dy: -150, trailWidth: 4 },
		{ dx: 230, dy: -50, trailWidth: 4 },
		{ dx: 230, dy: 50, trailWidth: 4 },
		{ dx: 80, dy: 150, trailWidth: 4 },
		{ dx: -60, dy: 0, trailWidth: 4 },
	],
};

// ─── Buugeng Family ───────────────────────────────────────────────────────────

const BUUGENG_TRAIL_POINTS: PropTrailPointConfig = {
	points: [
		{ dx: 130, dy: -40, trailWidth: 4 },
		{ dx: -130, dy: 40, trailWidth: 4 },
	],
};

const BIGBUUGENG_TRAIL_POINTS: PropTrailPointConfig = {
	points: [
		{ dx: 260, dy: -80, trailWidth: 5 },
		{ dx: -260, dy: 80, trailWidth: 5 },
	],
};

const FRACTALGENG_TRAIL_POINTS: PropTrailPointConfig = {
	points: [
		{ dx: 120, dy: -80, trailWidth: 4 },
		{ dx: -120, dy: 80, trailWidth: 4 },
	],
};

const TRIGENG_TRAIL_POINTS: PropTrailPointConfig = {
	points: [
		{ dx: 130, dy: -60, trailWidth: 3 },
		{ dx: 0, dy: 0, trailWidth: 3 },
		{ dx: -130, dy: 60, trailWidth: 3 },
	],
};

// ─── Sword ────────────────────────────────────────────────────────────────────

const SWORD_TRAIL_POINTS: PropTrailPointConfig = {
	points: [{ dx: 280, dy: 0, trailWidth: 5 }],
};

// ─── Triquetra Family ─────────────────────────────────────────────────────────

const TRIQUETRA_TRAIL_POINTS: PropTrailPointConfig = {
	points: [
		{ dx: 130, dy: 0, trailWidth: 4 },
		{ dx: -65, dy: -113, trailWidth: 4 },
		{ dx: -65, dy: 113, trailWidth: 4 },
	],
};

// ─── Chicken Family ───────────────────────────────────────────────────────────

const CHICKEN_TRAIL_POINTS: PropTrailPointConfig = {
	points: [
		{ dx: -150, dy: 0, trailWidth: 4 },
		{ dx: 150, dy: 0, trailWidth: 4 },
	],
};

// ─── Guitar Family ────────────────────────────────────────────────────────────

const GUITAR_TRAIL_POINTS: PropTrailPointConfig = {
	points: [{ dx: 290, dy: 0, trailWidth: 3 }],
};

const UKULELE_TRAIL_POINTS: PropTrailPointConfig = {
	points: [{ dx: 170, dy: 0, trailWidth: 3 }],
};

// ─── Doublestar Family ────────────────────────────────────────────────────────

const DOUBLESTAR_TRAIL_POINTS: PropTrailPointConfig = {
	points: [
		{ dx: 150, dy: 0, trailWidth: 3 },
		{ dx: -150, dy: 0, trailWidth: 3 },
		{ dx: 0, dy: -75, trailWidth: 3 },
		{ dx: 0, dy: 75, trailWidth: 3 },
	],
};

const BIGDOUBLESTAR_TRAIL_POINTS: PropTrailPointConfig = {
	points: [
		{ dx: 300, dy: 0, trailWidth: 4 },
		{ dx: -300, dy: 0, trailWidth: 4 },
		{ dx: 0, dy: -150, trailWidth: 4 },
		{ dx: 0, dy: 150, trailWidth: 4 },
	],
};

// ─── Eightrings Family ────────────────────────────────────────────────────────

const EIGHTRINGS_TRAIL_POINTS: PropTrailPointConfig = {
	points: [
		{ dx: 75, dy: -65, trailWidth: 3 },
		{ dx: -75, dy: -65, trailWidth: 3 },
	],
};

const BIGEIGHTRINGS_TRAIL_POINTS: PropTrailPointConfig = {
	points: [
		{ dx: 150, dy: -130, trailWidth: 4 },
		{ dx: -150, dy: -130, trailWidth: 4 },
	],
};

// ─── Quiad ────────────────────────────────────────────────────────────────────

const QUIAD_TRAIL_POINTS: PropTrailPointConfig = {
	points: [
		{ dx: 125, dy: 0, trailWidth: 4 },
		{ dx: 0, dy: -125, trailWidth: 4 },
		{ dx: -125, dy: 0, trailWidth: 4 },
		{ dx: 0, dy: 125, trailWidth: 4 },
	],
};

// ─── Torch ────────────────────────────────────────────────────────────────────

const TORCH_TRAIL_POINTS: PropTrailPointConfig = {
	points: [{ dx: -140, dy: 0, trailWidth: 5 }],
};

const BIGTORCH_TRAIL_POINTS: PropTrailPointConfig = {
	points: [{ dx: -120, dy: 0, trailWidth: 6 }],
};

// ─── Poi ──────────────────────────────────────────────────────────────────────

const POI_TRAIL_POINTS: PropTrailPointConfig = {
	points: [{ dx: 130, dy: 0, trailWidth: 5 }],
};

// ─── Hand ─────────────────────────────────────────────────────────────────────

const HAND_TRAIL_POINTS: PropTrailPointConfig = {
	points: [],
};

// ═══════════════════════════════════════════════════════════════════════════════
// Override Provider (callback pattern avoids circular dependency with feature layer)
// ═══════════════════════════════════════════════════════════════════════════════

type TrailPointOverrideFn = (propType: string) => PropTrailPointConfig | null;
let overrideProvider: TrailPointOverrideFn | null = null;

/**
 * Register a callback that can supply custom trail points for a prop type.
 * Pass null to remove the override provider.
 */
export function setTrailPointOverrideProvider(provider: TrailPointOverrideFn | null): void {
	overrideProvider = provider;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Registry
// ═══════════════════════════════════════════════════════════════════════════════

export const PROP_TRAIL_POINTS: Record<string, PropTrailPointConfig> = {
	staff: STAFF_TRAIL_POINTS,
	simple_staff: STAFF_TRAIL_POINTS,
	bigstaff: BIGSTAFF_TRAIL_POINTS,
	staff_v2: STAFF_TRAIL_POINTS,
	club: CLUB_TRAIL_POINTS,
	bigclub: BIGCLUB_TRAIL_POINTS,
	fan: FAN_TRAIL_POINTS,
	bigfan: BIGFAN_TRAIL_POINTS,
	triad: TRIAD_TRAIL_POINTS,
	bigtriad: BIGTRIAD_TRAIL_POINTS,
	minihoop: MINIHOOP_TRAIL_POINTS,
	bighoop: BIGHOOP_TRAIL_POINTS,
	buugeng: BUUGENG_TRAIL_POINTS,
	bigbuugeng: BIGBUUGENG_TRAIL_POINTS,
	fractalgeng: FRACTALGENG_TRAIL_POINTS,
	trigeng: TRIGENG_TRAIL_POINTS,
	hand: HAND_TRAIL_POINTS,
	triquetra: TRIQUETRA_TRAIL_POINTS,
	triquetra2: TRIQUETRA_TRAIL_POINTS,
	sword: SWORD_TRAIL_POINTS,
	chicken: CHICKEN_TRAIL_POINTS,
	bigchicken: CHICKEN_TRAIL_POINTS,
	guitar: GUITAR_TRAIL_POINTS,
	ukulele: UKULELE_TRAIL_POINTS,
	doublestar: DOUBLESTAR_TRAIL_POINTS,
	bigdoublestar: BIGDOUBLESTAR_TRAIL_POINTS,
	eightrings: EIGHTRINGS_TRAIL_POINTS,
	bigeightrings: BIGEIGHTRINGS_TRAIL_POINTS,
	quiad: QUIAD_TRAIL_POINTS,
	torch: TORCH_TRAIL_POINTS,
	bigtorch: BIGTORCH_TRAIL_POINTS,
	poi: POI_TRAIL_POINTS,
};

export const DEFAULT_TRAIL_POINTS: PropTrailPointConfig = STAFF_TRAIL_POINTS;

/**
 * Look up trail points for a prop type. Falls back to staff-like endpoints.
 */
export function getTrailPoints(propType: string | null | undefined): PropTrailPointConfig {
	if (!propType) return DEFAULT_TRAIL_POINTS;
	const key = propType.toLowerCase();
	if (overrideProvider) {
		const override = overrideProvider(key);
		if (override) return override;
	}
	return PROP_TRAIL_POINTS[key] ?? DEFAULT_TRAIL_POINTS;
}

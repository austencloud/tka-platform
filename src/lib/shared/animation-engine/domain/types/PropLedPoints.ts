/**
 * Prop LED Point Definitions
 *
 * Maps each prop type to its LED attachment points. Coordinates are in
 * prop-local space (same units as PROP_DIMENSIONS):
 *   - dx: offset along prop primary axis from center (positive = toward "right"/tip end)
 *   - dy: offset perpendicular to prop axis (positive = clockwise from tip direction in screen space)
 *
 * These get transformed to canvas space in the LED renderer via:
 *   worldX = centerX + (dx * cos(angle) - dy * sin(angle)) * scaleFactor
 *   worldY = centerY + (dx * sin(angle) + dy * cos(angle)) * scaleFactor
 *
 * Where scaleFactor = canvasSize / 950 (viewBox normalization).
 *
 * Coordinates match the fire point positions where applicable so that LED
 * and flame effects remain spatially consistent when both are active.
 */

import type { LedPoint, PropLedConfig } from "./LedTypes";

// ─── Staff Family ─────────────────────────────────────────────────────────────
// Two LEDs, one at each end. Standard fire staff layout.

const STAFF_LED_POINTS: PropLedConfig = {
	points: [
		{ dx: -150, dy: 0, brightness: 1.0 },
		{ dx: 150, dy: 0, brightness: 1.0 },
	],
};

const BIGSTAFF_LED_POINTS: PropLedConfig = {
	points: [
		{ dx: -300, dy: 0, brightness: 1.0 },
		{ dx: 300, dy: 0, brightness: 1.0 },
	],
};

// ─── Club Family ──────────────────────────────────────────────────────────────
// One LED at the knob end (positive dx = right/tip direction).

const CLUB_LED_POINTS: PropLedConfig = {
	points: [{ dx: 130, dy: 0, brightness: 1.0 }],
};

const BIGCLUB_LED_POINTS: PropLedConfig = {
	points: [{ dx: 260, dy: 0, brightness: 1.0 }],
};

// ─── Fan Family ───────────────────────────────────────────────────────────────
// Five LEDs at tine tips, fanning out in an arc. Tines spread roughly ±50°
// from the prop axis at radius ~120 units from center.

const FAN_LED_POINTS: PropLedConfig = {
	points: [
		{ dx: 77, dy: -92, brightness: 0.8 }, // upper far tine (-50°)
		{ dx: 109, dy: -51, brightness: 0.8 }, // upper mid tine (-25°)
		{ dx: 120, dy: 0, brightness: 0.8 }, // center tine (0°)
		{ dx: 109, dy: 51, brightness: 0.8 }, // lower mid tine (+25°)
		{ dx: 77, dy: 92, brightness: 0.8 }, // lower far tine (+50°)
	],
};

const BIGFAN_LED_POINTS: PropLedConfig = {
	points: [
		{ dx: 154, dy: -184, brightness: 0.8 },
		{ dx: 218, dy: -102, brightness: 0.8 },
		{ dx: 240, dy: 0, brightness: 0.8 },
		{ dx: 218, dy: 102, brightness: 0.8 },
		{ dx: 154, dy: 184, brightness: 0.8 },
	],
};

// ─── Hoop Family ──────────────────────────────────────────────────────────────
// LEDs distributed around the ring. 5 points at even spacing around the ring
// circumference. Ring center is offset from prop center (hand grip to the left).

const MINIHOOP_LED_POINTS: PropLedConfig = {
	points: [
		{ dx: 40, dy: -80, brightness: 0.9 }, // top of ring
		{ dx: 120, dy: -25, brightness: 0.9 }, // upper-right
		{ dx: 120, dy: 25, brightness: 0.9 }, // lower-right
		{ dx: 40, dy: 80, brightness: 0.9 }, // bottom of ring
		{ dx: -30, dy: 0, brightness: 0.9 }, // left of ring
	],
};

const BIGHOOP_LED_POINTS: PropLedConfig = {
	points: [
		{ dx: 80, dy: -150, brightness: 0.9 },
		{ dx: 230, dy: -50, brightness: 0.9 },
		{ dx: 230, dy: 50, brightness: 0.9 },
		{ dx: 80, dy: 150, brightness: 0.9 },
		{ dx: -60, dy: 0, brightness: 0.9 },
	],
};

// ─── Poi Family ───────────────────────────────────────────────────────────────
// Ball end only (positive direction from center).

const POI_LED_POINTS: PropLedConfig = {
	points: [{ dx: 130, dy: 0, brightness: 1.0 }],
};

const BIGPOI_LED_POINTS: PropLedConfig = {
	points: [{ dx: 260, dy: 0, brightness: 1.0 }],
};

// ─── Torch Family ─────────────────────────────────────────────────────────────
// Single LED at the wick end (left/negative-dx end of the prop).

const TORCH_LED_POINTS: PropLedConfig = {
	points: [{ dx: -130, dy: 0, brightness: 1.0 }],
};

const BIGTORCH_LED_POINTS: PropLedConfig = {
	points: [{ dx: -260, dy: 0, brightness: 1.0 }],
};

// ─── Hand ─────────────────────────────────────────────────────────────────────
// No LEDs. Hands don't light up.

const HAND_LED_POINTS: PropLedConfig = {
	points: [],
};

// ═══════════════════════════════════════════════════════════════════════════════
// Override Provider (callback pattern avoids circular dependency with feature layer)
// ═══════════════════════════════════════════════════════════════════════════════

type LedPointOverrideFn = (propType: string) => PropLedConfig | null;
let overrideProvider: LedPointOverrideFn | null = null;

/**
 * Register a callback that can supply custom LED points for a prop type.
 * Pass null to remove the override provider.
 */
export function setLedPointOverrideProvider(provider: LedPointOverrideFn | null): void {
	overrideProvider = provider;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Registry
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Master registry mapping prop type strings to LED point configurations.
 * Keys match PropType enum values (lowercase).
 */
export const PROP_LED_POINTS: Record<string, PropLedConfig> = {
	// Staff family
	staff: STAFF_LED_POINTS,
	simple_staff: STAFF_LED_POINTS,
	bigstaff: BIGSTAFF_LED_POINTS,
	staff_v2: STAFF_LED_POINTS,

	// Club family
	club: CLUB_LED_POINTS,
	bigclub: BIGCLUB_LED_POINTS,

	// Fan family
	fan: FAN_LED_POINTS,
	bigfan: BIGFAN_LED_POINTS,

	// Hoop family
	minihoop: MINIHOOP_LED_POINTS,
	bighoop: BIGHOOP_LED_POINTS,

	// Poi family
	poi: POI_LED_POINTS,
	bigpoi: BIGPOI_LED_POINTS,

	// Torch family
	torch: TORCH_LED_POINTS,
	bigtorch: BIGTORCH_LED_POINTS,

	// Hand
	hand: HAND_LED_POINTS,
};

/**
 * Default LED points (staff-like: 2 endpoints). Used when prop type is unknown.
 */
export const DEFAULT_LED_POINTS: PropLedConfig = STAFF_LED_POINTS;

/**
 * Look up LED points for a prop type. Checks the override provider first,
 * then falls back to the hardcoded registry, then to staff-like endpoints.
 */
export function getLedPoints(propType: string | null | undefined): PropLedConfig {
	if (!propType) return DEFAULT_LED_POINTS;
	const key = propType.toLowerCase();
	if (overrideProvider) {
		const override = overrideProvider(key);
		if (override) return override;
	}
	return PROP_LED_POINTS[key] ?? DEFAULT_LED_POINTS;
}

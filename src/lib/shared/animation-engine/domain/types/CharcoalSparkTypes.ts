/**
 * Charcoal Spark Types
 *
 * Discrete spark particle system for charcoal/steel-wool fire effects.
 * Sparks burst on direction changes and fall under gravity, replacing
 * the previous fluid-sim-with-cranked-gravity approach.
 */

import type { PropTipData } from "./FireTypes";

// ============================================================================
// Core Particle
// ============================================================================

/** A single spark particle in the pool. */
export interface CharcoalSpark {
	/** X position in viewbox coordinates */
	x: number;
	/** Y position in viewbox coordinates */
	y: number;
	/** Horizontal velocity (viewbox units/second) */
	vx: number;
	/** Vertical velocity (viewbox units/second) */
	vy: number;
	/** Remaining lifetime in seconds */
	life: number;
	/** Total lifetime at spawn (seconds) */
	maxLife: number;
	/** Current radius in viewbox units */
	size: number;
	/** Normalized temperature [0-1], decays over lifetime */
	temperature: number;
	/** Whether this slot is in use */
	active: boolean;
}

// ============================================================================
// Tip Tracking
// ============================================================================

/** Per-tip data with jerk (rate of velocity change) for burst detection. */
export interface CharcoalTipData extends PropTipData {
	/** Rate of velocity change (viewbox units/second^2). High jerk = direction reversal = spark burst. */
	jerk: number;
}

// ============================================================================
// Tunable Parameters
// ============================================================================

/** All tunable parameters for the charcoal spark system. */
export interface CharcoalSparkParams {
	// -- Emission --
	/** Jerk magnitude above which a burst fires (viewbox units/s^2) */
	burstThreshold: number;
	/** Spark count multiplier when jerk exceeds threshold */
	burstMultiplier: number;
	/** Maximum sparks per single burst event */
	burstMax: number;
	/** Base sparks emitted per second during movement */
	ambientRate: number;
	/** Speed below which ambient emission stops (viewbox units/s) */
	ambientSpeedThreshold: number;
	/** Sparks per second when tip is stationary (embers falling off a still-burning prop) */
	idleRate: number;

	// -- Physics --
	/** Downward acceleration (viewbox units/s^2). Higher = sparks fall faster. */
	gravity: number;
	/** Velocity decay per second (0-1). 1 = no drag, 0.5 = halves each second. */
	drag: number;
	/** Fraction of tip velocity inherited by each spark [0-1]. Higher = sparks fly where the tip was going. */
	velocityInheritance: number;
	/** Minimum random perturbation speed added on top of inherited velocity (viewbox units/s) */
	perturbSpeedMin: number;
	/** Maximum random perturbation speed added on top of inherited velocity (viewbox units/s) */
	perturbSpeedMax: number;
	/** Half-angle of perturbation cone centered on tip's velocity direction (radians). PI = full sphere. */
	spreadAngle: number;

	// -- Appearance --
	/** Minimum spark lifetime (seconds) */
	lifetimeMin: number;
	/** Maximum spark lifetime (seconds) */
	lifetimeMax: number;
	/** Minimum spark radius (viewbox units) */
	sizeMin: number;
	/** Maximum spark radius (viewbox units) */
	sizeMax: number;
	/** Whether sparks shrink as they cool */
	shrinkOverLife: boolean;

	// -- Color (RGB tuples, 0-255 range for Canvas fillStyle) --
	/** Hottest spark color (core/birth) */
	coreColor: [number, number, number];
	/** Mid-temperature spark color */
	midColor: [number, number, number];
	/** Coolest spark color (near death) */
	coolColor: [number, number, number];

	// -- Ember glow --
	/** Radius of the soft glow around each spark (viewbox units) */
	emberGlowRadius: number;
	/** Opacity multiplier for the ember glow [0-1] */
	emberGlowIntensity: number;

	// -- Pool --
	/** Maximum particles alive at once. Oldest are recycled when full. */
	maxParticles: number;
}

// ============================================================================
// Default Parameters (steel-wool baseline)
// ============================================================================

/** Default charcoal spark parameters — balanced steel-wool starting point. */
export const DEFAULT_CHARCOAL_PARAMS: CharcoalSparkParams = {
	burstThreshold: 120,
	burstMultiplier: 25,
	burstMax: 120,
	ambientRate: 30,
	ambientSpeedThreshold: 15,
	idleRate: 3,
	gravity: 250,
	drag: 0.93,
	velocityInheritance: 0.75,
	perturbSpeedMin: 8,
	perturbSpeedMax: 35,
	spreadAngle: Math.PI * 0.15,
	lifetimeMin: 0.6,
	lifetimeMax: 1.6,
	sizeMin: 5,
	sizeMax: 12,
	shrinkOverLife: true,
	coreColor: [255, 242, 210],
	midColor: [255, 150, 35],
	coolColor: [170, 45, 2],
	emberGlowRadius: 22,
	emberGlowIntensity: 1.6,
	maxParticles: 600,
};

// ============================================================================
// Semantic Controls (map 0-1 user sliders to underlying params)
// ============================================================================

/** Semantic charcoal values exposed to the user (all 0-1 range). */
export interface CharcoalSemanticValues {
	/** 0 = sparse gentle sparks, 1 = dense shower */
	intensity: number;
	/** 0 = tight focused stream, 1 = wide floating embers */
	spread: number;
	/** 0 = subtle dim sparks, 1 = bright hot glow */
	glow: number;
}

/** Default semantic values that correspond to DEFAULT_CHARCOAL_PARAMS. */
export const DEFAULT_CHARCOAL_SEMANTIC: CharcoalSemanticValues = {
	intensity: 0.33,
	spread: 0.4,
	glow: 0.5,
};

/** Lerp helper: map t [0-1] to [a, b]. */
function lerp(a: number, b: number, t: number): number {
	return a + (b - a) * t;
}

/** Inverse lerp: map value in [a, b] back to [0-1]. */
function invLerp(a: number, b: number, v: number): number {
	if (a === b) return 0;
	return Math.max(0, Math.min(1, (v - a) / (b - a)));
}

/** Convert a semantic intensity/spread/glow (0-1) to concrete CharcoalSparkParams. */
export function semanticToCharcoalParams(semantic: CharcoalSemanticValues): CharcoalSparkParams {
	const { intensity, spread, glow } = semantic;

	return {
		// Intensity controls emission volume
		ambientRate: Math.round(lerp(5, 80, intensity)),
		burstMultiplier: Math.round(lerp(8, 40, intensity)),
		burstMax: Math.round(lerp(40, 200, intensity)),
		burstThreshold: Math.round(lerp(180, 80, intensity)), // Lower threshold = more bursts at high intensity
		ambientSpeedThreshold: 15,
		maxParticles: Math.round(lerp(200, 1200, intensity)),
		idleRate: Math.round(lerp(0, 8, intensity)),

		// Spread controls how far sparks travel
		gravity: Math.round(lerp(600, 80, spread)), // Low spread = heavy gravity (tight), high = floaty
		drag: lerp(0.88, 0.97, spread),
		velocityInheritance: lerp(0.9, 0.5, spread), // Low spread = follow tip, high = scatter
		perturbSpeedMin: Math.round(lerp(4, 15, spread)),
		perturbSpeedMax: Math.round(lerp(15, 60, spread)),
		spreadAngle: lerp(Math.PI * 0.08, Math.PI * 0.4, spread),
		lifetimeMin: Number(lerp(0.3, 1.2, spread).toFixed(2)),
		lifetimeMax: Number(lerp(0.8, 3.0, spread).toFixed(2)),

		// Glow controls visual brightness
		sizeMin: Math.round(lerp(3, 8, glow)),
		sizeMax: Math.round(lerp(8, 18, glow)),
		shrinkOverLife: true,
		emberGlowRadius: Math.round(lerp(10, 40, glow)),
		emberGlowIntensity: Number(lerp(0.4, 3.0, glow).toFixed(2)),

		// Colors stay fixed (steel-wool palette)
		coreColor: [255, 242, 210],
		midColor: [255, 150, 35],
		coolColor: [170, 45, 2],
	};
}

/** Extract semantic values from concrete CharcoalSparkParams (best-effort inverse). */
export function charcoalParamsToSemantic(params: CharcoalSparkParams): CharcoalSemanticValues {
	return {
		intensity: invLerp(5, 80, params.ambientRate),
		spread: invLerp(600, 80, params.gravity), // Inverted: low gravity = high spread
		glow: invLerp(0.4, 3.0, params.emberGlowIntensity),
	};
}

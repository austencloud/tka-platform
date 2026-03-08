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
// Slider Definitions (for UI generation)
// ============================================================================

/** Metadata for a single slider in the charcoal tuning UI. */
export interface CharcoalSliderDef {
	key: keyof CharcoalSparkParams;
	label: string;
	min: number;
	max: number;
	step: number;
	/** Format the raw value for display */
	format?: (v: number) => string;
}

/** Grouped slider definitions for the charcoal tuning panel. */
export const CHARCOAL_SLIDER_GROUPS: { label: string; sliders: CharcoalSliderDef[] }[] = [
	{
		label: "Sparks",
		sliders: [
			{ key: "ambientRate", label: "Density", min: 5, max: 80, step: 5 },
			{ key: "idleRate", label: "Idle Embers", min: 0, max: 10, step: 1 },
			{ key: "gravity", label: "Gravity", min: 50, max: 800, step: 25 },
			{ key: "lifetimeMax", label: "Lifetime", min: 0.5, max: 3, step: 0.1, format: (v) => `${v.toFixed(1)}s` },
			{ key: "emberGlowIntensity", label: "Glow", min: 0.2, max: 3, step: 0.1, format: (v) => v.toFixed(1) },
			{ key: "maxParticles", label: "Max Sparks", min: 200, max: 1200, step: 50 },
		],
	},
];

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

	// -- Physics --
	/** Downward acceleration (viewbox units/s^2). Higher = sparks fall faster. */
	gravity: number;
	/** Velocity decay per second (0-1). 1 = no drag, 0.5 = halves each second. */
	drag: number;
	/** Minimum initial spark speed (viewbox units/s) */
	initialSpeedMin: number;
	/** Maximum initial spark speed (viewbox units/s) */
	initialSpeedMax: number;
	/** Half-angle of emission cone (radians). PI = full sphere. */
	spreadAngle: number;
	/** Fraction of initial velocity taken from tip's tangential direction [0-1] */
	tangentialBias: number;

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
// Presets
// ============================================================================

/** A named preset bundling an ID, label, and full parameter set. */
export interface CharcoalSparkPreset {
	id: string;
	label: string;
	params: CharcoalSparkParams;
}

/** Five tuning presets covering the range of charcoal/steel-wool aesthetics. */
export const CHARCOAL_PRESETS: CharcoalSparkPreset[] = [
	{
		id: "dense-shower",
		label: "Dense Shower",
		params: {
			burstThreshold: 200,
			burstMultiplier: 15,
			burstMax: 80,
			ambientRate: 60,
			ambientSpeedThreshold: 10,
			gravity: 600,
			drag: 0.92,
			initialSpeedMin: 150,
			initialSpeedMax: 500,
			spreadAngle: Math.PI * 0.6,
			tangentialBias: 0.4,
			lifetimeMin: 0.4,
			lifetimeMax: 1.2,
			sizeMin: 4,
			sizeMax: 10,
			shrinkOverLife: true,
			coreColor: [255, 240, 200],
			midColor: [255, 140, 30],
			coolColor: [180, 50, 5],
			emberGlowRadius: 20,
			emberGlowIntensity: 1.5,
			maxParticles: 800,
		},
	},
	{
		id: "lazy-arc",
		label: "Lazy Arc",
		params: {
			burstThreshold: 150,
			burstMultiplier: 8,
			burstMax: 40,
			ambientRate: 25,
			ambientSpeedThreshold: 10,
			gravity: 200,
			drag: 0.96,
			initialSpeedMin: 100,
			initialSpeedMax: 300,
			spreadAngle: Math.PI * 0.4,
			tangentialBias: 0.6,
			lifetimeMin: 1.0,
			lifetimeMax: 2.5,
			sizeMin: 6,
			sizeMax: 14,
			shrinkOverLife: true,
			coreColor: [255, 245, 220],
			midColor: [255, 160, 40],
			coolColor: [160, 40, 0],
			emberGlowRadius: 25,
			emberGlowIntensity: 1.8,
			maxParticles: 500,
		},
	},
	{
		id: "steel-wool",
		label: "Steel Wool",
		params: {
			burstThreshold: 180,
			burstMultiplier: 12,
			burstMax: 60,
			ambientRate: 40,
			ambientSpeedThreshold: 10,
			gravity: 400,
			drag: 0.94,
			initialSpeedMin: 120,
			initialSpeedMax: 400,
			spreadAngle: Math.PI * 0.5,
			tangentialBias: 0.5,
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
		},
	},
	{
		id: "campfire-pop",
		label: "Campfire Pop",
		params: {
			burstThreshold: 400,
			burstMultiplier: 20,
			burstMax: 100,
			ambientRate: 10,
			ambientSpeedThreshold: 30,
			gravity: 350,
			drag: 0.93,
			initialSpeedMin: 200,
			initialSpeedMax: 600,
			spreadAngle: Math.PI * 0.7,
			tangentialBias: 0.3,
			lifetimeMin: 0.8,
			lifetimeMax: 2.0,
			sizeMin: 6,
			sizeMax: 16,
			shrinkOverLife: false,
			coreColor: [255, 255, 240],
			midColor: [255, 180, 50],
			coolColor: [200, 60, 5],
			emberGlowRadius: 28,
			emberGlowIntensity: 2.0,
			maxParticles: 500,
		},
	},
	{
		id: "ember-rain",
		label: "Ember Rain",
		params: {
			burstThreshold: 100,
			burstMultiplier: 5,
			burstMax: 30,
			ambientRate: 80,
			ambientSpeedThreshold: 5,
			gravity: 300,
			drag: 0.97,
			initialSpeedMin: 60,
			initialSpeedMax: 200,
			spreadAngle: Math.PI * 0.3,
			tangentialBias: 0.7,
			lifetimeMin: 0.8,
			lifetimeMax: 2.0,
			sizeMin: 3,
			sizeMax: 8,
			shrinkOverLife: false,
			coreColor: [255, 220, 180],
			midColor: [230, 120, 20],
			coolColor: [140, 35, 0],
			emberGlowRadius: 18,
			emberGlowIntensity: 1.4,
			maxParticles: 1000,
		},
	},
];

/** Default preset: steel-wool (balanced starting point for tuning). */
export const DEFAULT_CHARCOAL_PRESET: CharcoalSparkPreset = CHARCOAL_PRESETS[2]!;

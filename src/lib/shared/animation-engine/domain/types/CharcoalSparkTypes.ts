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
			burstThreshold: 800,
			burstMultiplier: 4,
			burstMax: 40,
			ambientRate: 18,
			ambientSpeedThreshold: 30,
			gravity: 600,
			drag: 0.92,
			initialSpeedMin: 80,
			initialSpeedMax: 250,
			spreadAngle: Math.PI * 0.6,
			tangentialBias: 0.4,
			lifetimeMin: 0.3,
			lifetimeMax: 0.8,
			sizeMin: 1.0,
			sizeMax: 2.5,
			shrinkOverLife: true,
			coreColor: [255, 240, 200],
			midColor: [255, 140, 30],
			coolColor: [180, 50, 5],
			emberGlowRadius: 4,
			emberGlowIntensity: 0.3,
			maxParticles: 500,
		},
	},
	{
		id: "lazy-arc",
		label: "Lazy Arc",
		params: {
			burstThreshold: 600,
			burstMultiplier: 2,
			burstMax: 15,
			ambientRate: 8,
			ambientSpeedThreshold: 20,
			gravity: 200,
			drag: 0.96,
			initialSpeedMin: 40,
			initialSpeedMax: 120,
			spreadAngle: Math.PI * 0.4,
			tangentialBias: 0.6,
			lifetimeMin: 0.8,
			lifetimeMax: 1.8,
			sizeMin: 2.0,
			sizeMax: 4.0,
			shrinkOverLife: true,
			coreColor: [255, 245, 220],
			midColor: [255, 160, 40],
			coolColor: [160, 40, 0],
			emberGlowRadius: 6,
			emberGlowIntensity: 0.45,
			maxParticles: 300,
		},
	},
	{
		id: "steel-wool",
		label: "Steel Wool",
		params: {
			burstThreshold: 700,
			burstMultiplier: 3,
			burstMax: 25,
			ambientRate: 12,
			ambientSpeedThreshold: 25,
			gravity: 400,
			drag: 0.94,
			initialSpeedMin: 60,
			initialSpeedMax: 180,
			spreadAngle: Math.PI * 0.5,
			tangentialBias: 0.5,
			lifetimeMin: 0.5,
			lifetimeMax: 1.2,
			sizeMin: 1.5,
			sizeMax: 3.0,
			shrinkOverLife: true,
			coreColor: [255, 242, 210],
			midColor: [255, 150, 35],
			coolColor: [170, 45, 2],
			emberGlowRadius: 5,
			emberGlowIntensity: 0.4,
			maxParticles: 400,
		},
	},
	{
		id: "campfire-pop",
		label: "Campfire Pop",
		params: {
			burstThreshold: 1500,
			burstMultiplier: 6,
			burstMax: 50,
			ambientRate: 3,
			ambientSpeedThreshold: 50,
			gravity: 350,
			drag: 0.93,
			initialSpeedMin: 100,
			initialSpeedMax: 300,
			spreadAngle: Math.PI * 0.7,
			tangentialBias: 0.3,
			lifetimeMin: 0.6,
			lifetimeMax: 1.5,
			sizeMin: 2.5,
			sizeMax: 5.0,
			shrinkOverLife: true,
			coreColor: [255, 255, 240],
			midColor: [255, 180, 50],
			coolColor: [200, 60, 5],
			emberGlowRadius: 8,
			emberGlowIntensity: 0.6,
			maxParticles: 300,
		},
	},
	{
		id: "ember-rain",
		label: "Ember Rain",
		params: {
			burstThreshold: 2000,
			burstMultiplier: 1,
			burstMax: 8,
			ambientRate: 25,
			ambientSpeedThreshold: 10,
			gravity: 300,
			drag: 0.97,
			initialSpeedMin: 20,
			initialSpeedMax: 80,
			spreadAngle: Math.PI * 0.3,
			tangentialBias: 0.7,
			lifetimeMin: 0.6,
			lifetimeMax: 1.4,
			sizeMin: 0.8,
			sizeMax: 1.8,
			shrinkOverLife: false,
			coreColor: [255, 220, 180],
			midColor: [230, 120, 20],
			coolColor: [140, 35, 0],
			emberGlowRadius: 3,
			emberGlowIntensity: 0.25,
			maxParticles: 600,
		},
	},
];

/** Default preset: steel-wool (balanced starting point for tuning). */
export const DEFAULT_CHARCOAL_PRESET: CharcoalSparkPreset = CHARCOAL_PRESETS[2]!;

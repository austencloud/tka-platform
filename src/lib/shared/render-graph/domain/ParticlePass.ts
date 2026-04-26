/**
 * Particle-family pass payload.
 *
 * Shared by: water, bubbles, petals, smoke, charcoal, sparkles.
 * Each effect configures the same GPU particle sim with different
 * physics (gravity, buoyancy, curl, drag) and visual parameters.
 */

export type ParticleBlendMode = "alpha" | "additive" | "screen";

export type ParticleShape = "circle" | "quad" | "streak" | "petal" | "crystal" | "spark";

export interface ParticleForces {
	/** Downward acceleration in NDC/s². Negative = upward (buoyancy). */
	gravity: number;
	/** Curl noise magnitude. 0 = no swirl. */
	curlStrength: number;
	/** Horizontal sway amplitude for sinusoidal motion. */
	swayAmplitude: number;
	/** Drag coefficient. Higher = particles slow faster. */
	drag: number;
}

export interface ParticleEmitter {
	/** Emitter position in NDC. */
	position: [number, number];
	/** Particles per second from this emitter. */
	rate: number;
	/** Spawn spread radius in NDC. */
	spread: number;
	/** Initial velocity range [min, max] in NDC/s. */
	speed: [number, number];
	/** Launch angle range [min, max] in radians. 0 = up, π = down. */
	angleRange: [number, number];
}

export interface ParticleTipState {
	tipId: string;
	emitters: ParticleEmitter[];
	/** RGBA, each channel 0..1. */
	color: [number, number, number, number];
	/** Secondary color for gradient/palette effects. */
	colorSecondary?: [number, number, number, number];
	/** Particle scale in NDC. */
	size: number;
	/** Size variance multiplier. 0 = uniform, 1 = wide range. */
	sizeJitter: number;
	/** Particle lifetime in seconds. */
	lifetime: number;
	/** Visual shape of each particle. */
	shape: ParticleShape;
	/** Physics configuration. */
	forces: ParticleForces;
	/** Compositing mode. */
	blendMode: ParticleBlendMode;
	/** 0..1 overall opacity multiplier. */
	opacity: number;
}

export interface ParticlePassPayload {
	tips: ParticleTipState[];
	/** Max concurrent particles (GPU buffer size). Default 2048. */
	maxParticles?: number;
}

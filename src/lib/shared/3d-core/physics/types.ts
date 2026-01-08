/**
 * Physics Types - Shared types for Rapier physics integration
 *
 * Used by Gallery, Museum Navigator (archived), Infinite Worlds, and future 3D destinations.
 */

import type RAPIER from "@dimforge/rapier3d-compat";

// ============================================================================
// WORLD STATE
// ============================================================================

/**
 * Physics world state
 */
export interface PhysicsWorldState {
	rapier: typeof RAPIER | null;
	world: RAPIER.World | null;
	isInitialized: boolean;
	gravity: { x: number; y: number; z: number };
}

// ============================================================================
// COLLIDER CONFIG
// ============================================================================

/**
 * Collider configuration
 */
export interface ColliderConfig {
	type: "box" | "sphere" | "capsule" | "cylinder" | "trimesh";
	size?: { x: number; y: number; z: number }; // For box
	radius?: number; // For sphere, capsule, cylinder
	halfHeight?: number; // For capsule, cylinder
	friction?: number;
	restitution?: number;
	density?: number;
}

// ============================================================================
// RIGID BODY CONFIG
// ============================================================================

/**
 * Rigid body configuration
 */
export interface RigidBodyConfig {
	type: "dynamic" | "static" | "kinematic";
	position: { x: number; y: number; z: number };
	rotation?: { x: number; y: number; z: number; w: number };
	linearDamping?: number;
	angularDamping?: number;
	canSleep?: boolean;
	ccd?: boolean; // Continuous collision detection
}

/**
 * Physics body component (rigid body + collider)
 */
export interface PhysicsBodyComponent {
	rigidBody: RAPIER.RigidBody;
	collider: RAPIER.Collider;
	bodyType: "dynamic" | "static" | "kinematic";
}

// ============================================================================
// PLAYER CONTROLLER CONFIG
// ============================================================================

/**
 * Player controller configuration
 */
export interface PlayerControllerConfig {
	/** Capsule radius */
	radius: number;
	/** Capsule half-height (total height = 2 * halfHeight + 2 * radius) */
	halfHeight: number;
	/** Starting position */
	position: { x: number; y: number; z: number };
	/** Character controller offset (skin width) */
	offset: number;
	/** Maximum slope angle player can climb (radians) */
	maxSlopeClimbAngle: number;
	/** Minimum slope angle that causes sliding (radians) */
	minSlopeSlideAngle: number;
	/** Auto-step max height */
	autoStepMaxHeight: number;
	/** Auto-step min width */
	autoStepMinWidth: number;
	/** Snap to ground distance */
	snapToGroundDistance: number;
}

/**
 * Player controller state
 */
export interface PlayerControllerState {
	rigidBody: RAPIER.RigidBody | null;
	collider: RAPIER.Collider | null;
	controller: RAPIER.KinematicCharacterController | null;
	isGrounded: boolean;
	groundNormal: { x: number; y: number; z: number };
	velocity: { x: number; y: number; z: number };
}

// ============================================================================
// RAYCAST RESULT
// ============================================================================

/**
 * Ray cast result
 */
export interface RaycastResult {
	point: { x: number; y: number; z: number };
	normal: { x: number; y: number; z: number };
	distance: number;
}

/**
 * Ground check result
 */
export interface GroundCheckResult {
	isGrounded: boolean;
	groundNormal: { x: number; y: number; z: number };
	groundDistance: number;
}

// ============================================================================
// DEFAULT CONFIGS
// ============================================================================

/**
 * Default player controller configuration
 * Total height: ~1.7m (0.55*2 + 0.3*2)
 */
export const DEFAULT_PLAYER_CONFIG: PlayerControllerConfig = {
	radius: 0.3,
	halfHeight: 0.55,
	position: { x: 0, y: 50, z: 0 }, // Start high, will fall to ground
	offset: 0.02, // Small skin width
	maxSlopeClimbAngle: Math.PI / 4, // 45 degrees
	minSlopeSlideAngle: Math.PI / 4,
	autoStepMaxHeight: 0.4, // Can step up 40cm (stairs)
	autoStepMinWidth: 0.2,
	snapToGroundDistance: 0.3, // Snap when within 30cm of ground
};

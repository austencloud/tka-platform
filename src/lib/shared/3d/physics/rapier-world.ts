/**
 * Rapier Physics World - Shared utilities for Rapier physics
 *
 * WASM-compiled Rust physics engine integration.
 * 5-8x faster than JavaScript physics engines.
 *
 * Features:
 * - Proper collision detection (not raycast hacks)
 * - Rigid body dynamics
 * - Character controller
 * - Continuous collision detection
 *
 * Used by: Gallery, Infinite Worlds, and future 3D destinations
 */

import type {
	PhysicsWorldState,
	ColliderConfig,
	RigidBodyConfig,
	PhysicsBodyComponent,
	RaycastResult,
	GroundCheckResult,
} from "./types";

// ============================================================================
// INITIALIZATION
// ============================================================================

/**
 * Create the physics world state
 */
export function createPhysicsWorldState(): PhysicsWorldState {
	return {
		rapier: null,
		world: null,
		isInitialized: false,
		gravity: { x: 0, y: -9.81, z: 0 },
	};
}

/**
 * Initialize Rapier WASM and create the physics world
 */
export async function initPhysicsWorld(
	state: PhysicsWorldState,
	gravity = { x: 0, y: -20, z: 0 },
): Promise<void> {
	// Dynamic import for WASM module
	const RAPIER = await import("@dimforge/rapier3d-compat");
	await RAPIER.init();

	state.rapier = RAPIER;
	state.gravity = gravity;
	state.world = new RAPIER.World(
		new RAPIER.Vector3(gravity.x, gravity.y, gravity.z),
	);
	state.isInitialized = true;

}

// ============================================================================
// RIGID BODY CREATION
// ============================================================================

/**
 * Create a rigid body with collider
 */
export function createRigidBody(
	state: PhysicsWorldState,
	bodyConfig: RigidBodyConfig,
	colliderConfig: ColliderConfig,
): PhysicsBodyComponent | null {
	if (!state.rapier || !state.world) return null;

	const RAPIER = state.rapier;

	// Create rigid body description
	let rigidBodyDesc;
	switch (bodyConfig.type) {
		case "dynamic":
			rigidBodyDesc = RAPIER.RigidBodyDesc.dynamic();
			break;
		case "static":
			rigidBodyDesc = RAPIER.RigidBodyDesc.fixed();
			break;
		case "kinematic":
			rigidBodyDesc = RAPIER.RigidBodyDesc.kinematicPositionBased();
			break;
	}

	rigidBodyDesc.setTranslation(
		bodyConfig.position.x,
		bodyConfig.position.y,
		bodyConfig.position.z,
	);

	if (bodyConfig.rotation) {
		rigidBodyDesc.setRotation(bodyConfig.rotation);
	}

	if (bodyConfig.linearDamping !== undefined) {
		rigidBodyDesc.setLinearDamping(bodyConfig.linearDamping);
	}

	if (bodyConfig.angularDamping !== undefined) {
		rigidBodyDesc.setAngularDamping(bodyConfig.angularDamping);
	}

	if (bodyConfig.canSleep !== undefined) {
		rigidBodyDesc.setCanSleep(bodyConfig.canSleep);
	}

	if (bodyConfig.ccd) {
		rigidBodyDesc.setCcdEnabled(true);
	}

	// Create the rigid body
	const rigidBody = state.world.createRigidBody(rigidBodyDesc);

	// Create collider description
	let colliderDesc;
	switch (colliderConfig.type) {
		case "box":
			colliderDesc = RAPIER.ColliderDesc.cuboid(
				(colliderConfig.size?.x ?? 1) / 2,
				(colliderConfig.size?.y ?? 1) / 2,
				(colliderConfig.size?.z ?? 1) / 2,
			);
			break;
		case "sphere":
			colliderDesc = RAPIER.ColliderDesc.ball(colliderConfig.radius ?? 0.5);
			break;
		case "capsule":
			colliderDesc = RAPIER.ColliderDesc.capsule(
				colliderConfig.halfHeight ?? 0.5,
				colliderConfig.radius ?? 0.3,
			);
			break;
		case "cylinder":
			colliderDesc = RAPIER.ColliderDesc.cylinder(
				colliderConfig.halfHeight ?? 0.5,
				colliderConfig.radius ?? 0.5,
			);
			break;
		default:
			colliderDesc = RAPIER.ColliderDesc.ball(0.5);
	}

	if (colliderConfig.friction !== undefined) {
		colliderDesc.setFriction(colliderConfig.friction);
	}

	if (colliderConfig.restitution !== undefined) {
		colliderDesc.setRestitution(colliderConfig.restitution);
	}

	if (colliderConfig.density !== undefined) {
		colliderDesc.setDensity(colliderConfig.density);
	}

	// Create the collider attached to the rigid body
	const collider = state.world.createCollider(colliderDesc, rigidBody);

	return {
		rigidBody,
		collider,
		bodyType: bodyConfig.type,
	};
}

// ============================================================================
// SIMULATION
// ============================================================================

/**
 * Step the physics simulation
 */
export function stepPhysics(state: PhysicsWorldState, deltaTime: number): void {
	if (!state.world) return;

	// Step the simulation (fixed timestep internally)
	state.world.timestep = deltaTime;
	state.world.step();
}

// ============================================================================
// RAYCASTING
// ============================================================================

/**
 * Ray cast into the physics world
 *
 * @param excludeCollider - Optional collider to exclude from results (e.g., player's own collider)
 */
export function castRay(
	state: PhysicsWorldState,
	origin: { x: number; y: number; z: number },
	direction: { x: number; y: number; z: number },
	maxDistance: number,
	excludeCollider?: unknown,
): RaycastResult | null {
	if (!state.rapier || !state.world) return null;

	const RAPIER = state.rapier;

	const ray = new RAPIER.Ray(
		new RAPIER.Vector3(origin.x, origin.y, origin.z),
		new RAPIER.Vector3(direction.x, direction.y, direction.z),
	);

	// Use castRayAndGetNormal with filter if we need to exclude a collider
	let hit;
	if (excludeCollider) {
		// Cast with predicate to filter out the excluded collider
		hit = state.world.castRayAndGetNormal(
			ray,
			maxDistance,
			true, // solid
			undefined, // filter flags
			undefined, // filter groups
			undefined, // filter exclude collider
			undefined, // filter exclude rigid body
			(collider: unknown) => collider !== excludeCollider, // predicate
		);
	} else {
		hit = state.world.castRay(ray, maxDistance, true);
	}

	if (hit) {
		// Handle both castRay (returns {collider, timeOfImpact}) and
		// castRayAndGetNormal (returns {collider, timeOfImpact, normal})
		const point = ray.pointAt(hit.timeOfImpact);
		const normal = (hit as { normal?: { x: number; y: number; z: number } }).normal ?? { x: 0, y: 1, z: 0 };

		return {
			point: { x: point.x, y: point.y, z: point.z },
			normal: { x: normal.x, y: normal.y, z: normal.z },
			distance: hit.timeOfImpact,
		};
	}

	return null;
}

/**
 * Check if a point is grounded
 */
export function checkGrounded(
	state: PhysicsWorldState,
	position: { x: number; y: number; z: number },
	groundCheckDistance = 0.1,
): GroundCheckResult {
	const result = castRay(
		state,
		position,
		{ x: 0, y: -1, z: 0 },
		groundCheckDistance,
	);

	if (result) {
		return {
			isGrounded: true,
			groundNormal: result.normal,
			groundDistance: result.distance,
		};
	}

	return {
		isGrounded: false,
		groundNormal: { x: 0, y: 1, z: 0 },
		groundDistance: groundCheckDistance,
	};
}

// ============================================================================
// STAGE-SPECIFIC HELPERS
// ============================================================================

import { STAGE } from "@austencloud/scene-3d";

/**
 * Create a flat ground plane for the Stage
 *
 * Creates a 100m x 100m ground collider at Y=0 (just below surface).
 * This provides a flat floor for performer physics.
 */
export function createStageGround(state: PhysicsWorldState): void {
	if (!state.rapier || !state.world) return;

	const RAPIER = state.rapier;

	// Ground is a thin box at Y = -thickness/2 so the TOP surface is at Y=0
	const groundColliderDesc = RAPIER.ColliderDesc.cuboid(
		STAGE.GROUND_HALF_SIZE, // 50m = 100m total width
		STAGE.GROUND_THICKNESS, // 0.1m thick
		STAGE.GROUND_HALF_SIZE, // 50m = 100m total depth
	).setTranslation(0, -STAGE.GROUND_THICKNESS, 0);

	state.world.createCollider(groundColliderDesc);
}

// ============================================================================
// CLEANUP
// ============================================================================

/**
 * Remove a rigid body from the physics world
 */
export function removeRigidBody(
	state: PhysicsWorldState,
	component: PhysicsBodyComponent,
): void {
	if (!state.world) return;

	state.world.removeRigidBody(component.rigidBody);
}

/**
 * Dispose the physics world
 *
 * Uses try-catch to handle HMR scenarios where Rapier's WASM objects
 * may already be freed before this cleanup runs.
 */
export function disposePhysicsWorld(state: PhysicsWorldState): void {
	try {
		if (state.world) {
			state.world.free();
			state.world = null;
		}
	} catch (e) {
		// Rapier WASM world may already be freed during HMR - this is expected
		if (import.meta.hot) {
			console.debug('[PhysicsWorld] Rapier cleanup during HMR:', e);
		}
		state.world = null;
	}
	state.rapier = null;
	state.isInitialized = false;
}

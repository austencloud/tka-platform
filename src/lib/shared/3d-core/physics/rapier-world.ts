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

	console.log("[Physics] Rapier initialized with gravity", gravity);
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
 */
export function castRay(
	state: PhysicsWorldState,
	origin: { x: number; y: number; z: number },
	direction: { x: number; y: number; z: number },
	maxDistance: number,
): RaycastResult | null {
	if (!state.rapier || !state.world) return null;

	const RAPIER = state.rapier;

	const ray = new RAPIER.Ray(
		new RAPIER.Vector3(origin.x, origin.y, origin.z),
		new RAPIER.Vector3(direction.x, direction.y, direction.z),
	);

	const hit = state.world.castRay(ray, maxDistance, true);

	if (hit) {
		const point = ray.pointAt(hit.timeOfImpact);
		const hitCollider = hit.collider;
		const normal = hitCollider.castRayAndGetNormal(ray, maxDistance, true)
			?.normal;

		return {
			point: { x: point.x, y: point.y, z: point.z },
			normal: normal ? { x: normal.x, y: normal.y, z: normal.z } : { x: 0, y: 1, z: 0 },
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
 */
export function disposePhysicsWorld(state: PhysicsWorldState): void {
	if (state.world) {
		state.world.free();
		state.world = null;
	}
	state.rapier = null;
	state.isInitialized = false;
}

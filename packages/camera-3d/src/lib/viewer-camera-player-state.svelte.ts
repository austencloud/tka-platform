import type { AvatarState, PhysicsProvider } from "./types";
import { createFlycamPhysicsProvider } from "./flycam-physics-provider";

export interface ViewerCameraPlayerOptions {
	spawnX?: number;
	spawnY?: number;
	spawnZ?: number;
	initialFacing?: number;
	rotationSpeed?: number;
}

export function createViewerCameraPlayerState(
	options: ViewerCameraPlayerOptions = {},
): {
	avatarState: AvatarState;
	physicsProvider: PhysicsProvider;
	resetSpawn: () => void;
} {
	const SPAWN_X = options.spawnX ?? 0;
	const SPAWN_Y = options.spawnY ?? 0;
	const SPAWN_Z = options.spawnZ ?? 2.5;
	const INITIAL_FACING = options.initialFacing ?? Math.PI;
	const ROTATION_SPEED = options.rotationSpeed ?? 8;

	const position = { x: SPAWN_X, y: SPAWN_Y, z: SPAWN_Z };
	let facingAngle = INITIAL_FACING;
	let targetYaw = INITIAL_FACING;
	let isMoving = false;
	let moveDir = { x: 0, z: 0 };

	const avatarState: AvatarState = {
		get position() { return position; },
		get facingAngle() { return facingAngle; },
		get isMoving() { return isMoving; },
		get moveDirection() { return moveDir; },
		setMoveInput(input: { x: number; z: number }) {
			moveDir = input;
			isMoving = input.x !== 0 || input.z !== 0;
		},
		updateMovement() {},
		setFacingAngle(angle: number) {
			targetYaw = angle;
		},
		snapFacingAngle(angle: number) {
			facingAngle = angle;
			targetYaw = angle;
		},
		updateLocomotion(delta: number) {
			let diff = targetYaw - facingAngle;
			while (diff > Math.PI) diff -= 2 * Math.PI;
			while (diff < -Math.PI) diff += 2 * Math.PI;
			if (Math.abs(diff) < 0.01) {
				facingAngle = targetYaw;
			} else {
				const maxStep = ROTATION_SPEED * delta;
				facingAngle += Math.sign(diff) * Math.min(Math.abs(diff), maxStep);
			}
		},
	};

	function resetSpawn() {
		position.x = SPAWN_X;
		position.y = SPAWN_Y;
		position.z = SPAWN_Z;
		facingAngle = INITIAL_FACING;
		targetYaw = INITIAL_FACING;
		isMoving = false;
		moveDir = { x: 0, z: 0 };
	}

	const physicsProvider = createFlycamPhysicsProvider(position);

	return { avatarState, physicsProvider, resetSpawn };
}

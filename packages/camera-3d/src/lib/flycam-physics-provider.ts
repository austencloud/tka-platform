import type { PhysicsProvider, Vector3 } from "./types";

export function createFlycamPhysicsProvider(
	position: { x: number; y: number; z: number },
): PhysicsProvider {
	return {
		movePlayer(desiredMovement: Vector3) {
			position.x += desiredMovement.x;
			position.y += desiredMovement.y;
			position.z += desiredMovement.z;
		},
		getPlayerPosition(): Vector3 {
			return { x: position.x, y: position.y, z: position.z };
		},
		isGrounded() { return false; },
		getVelocity(): Vector3 { return { x: 0, y: 0, z: 0 }; },
		isNoclipEnabled() { return true; },
		toggleNoclip() { return true; },
		setNoclip() {},
	};
}

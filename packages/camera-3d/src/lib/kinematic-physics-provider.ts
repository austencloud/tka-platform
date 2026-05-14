import type { PhysicsProvider, Vector3 } from "./types";

export interface KinematicConfig {
	bounds?: { minX: number; maxX: number; minZ: number; maxZ: number };
	groundY?: number;
}

export function createKinematicPhysicsProvider(
	position: { x: number; y: number; z: number },
	config: KinematicConfig = {},
): PhysicsProvider {
	const groundY = config.groundY ?? 0;
	const bounds = config.bounds ?? { minX: -50, maxX: 50, minZ: -50, maxZ: 50 };

	let grounded = true;
	let noclip = false;
	let lastVelY = 0;

	return {
		movePlayer(desiredMovement: Vector3, _deltaTime: number) {
			lastVelY = desiredMovement.y / Math.max(_deltaTime, 0.001);

			if (noclip) {
				position.x += desiredMovement.x;
				position.y += desiredMovement.y;
				position.z += desiredMovement.z;
				return;
			}

			position.x = Math.max(bounds.minX, Math.min(bounds.maxX, position.x + desiredMovement.x));
			position.y += desiredMovement.y;
			position.z = Math.max(bounds.minZ, Math.min(bounds.maxZ, position.z + desiredMovement.z));

			if (position.y <= groundY) {
				position.y = groundY;
				grounded = true;
			} else {
				grounded = false;
			}
		},
		getPlayerPosition(): Vector3 {
			return { x: position.x, y: position.y, z: position.z };
		},
		isGrounded() { return grounded; },
		getVelocity(): Vector3 {
			return { x: 0, y: lastVelY, z: 0 };
		},
		toggleNoclip() {
			noclip = !noclip;
			return noclip;
		},
		isNoclipEnabled() { return noclip; },
		setNoclip(enabled: boolean) { noclip = enabled; },
		setCrouch() {},
	};
}

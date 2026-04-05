import { Vector3, Quaternion, Euler } from "three";
import type { PropTipPositions3D, TipPositionData3D } from "./types";
import type {
	ITipPositionBridge3D,
	PropState3DLike,
	SceneTransforms,
} from "./contracts/ITipPositionBridge3D";

interface TipHistory {
	prevPosition: Vector3;
	prevVelocity: Vector3;
	hasData: boolean;
}

/**
 * Converts 3D prop animation state into per-tip world-space positions with
 * velocity and jerk computed via finite differencing.
 *
 * The staff axis math replicates Staff3D.svelte: a horizontal quaternion
 * (Euler Z = PI/2) is applied, then the prop's world rotation, to get the
 * axis along the staff. Two tip positions are computed at +/- halfLength
 * from the prop center along that axis.
 */
export class TipPositionBridge3D implements ITipPositionBridge3D {
	private history = new Map<string, TipHistory>();
	private readonly tempQuat = new Quaternion();
	private readonly tempAxis = new Vector3();

	update(
		propIndex: number,
		propState: PropState3DLike,
		staffHalfLength: number,
		deltaTime: number,
		sceneTransforms?: SceneTransforms,
	): PropTipPositions3D {
		// Replicate Staff3D.svelte position computation:
		// 1. Start with body-local position from propState
		// 2. Add gridOffset in Z (forward offset to grid center)
		// 3. Rotate around Y by facingAngle
		// 4. Add avatar world position
		const localX = propState.worldPosition.x;
		const localY = propState.worldPosition.y;
		const localZ = propState.worldPosition.z + (sceneTransforms?.gridOffset ?? 0);

		const angle = sceneTransforms?.facingAngle ?? 0;
		const cos = Math.cos(angle);
		const sin = Math.sin(angle);
		const rotatedX = localX * cos + localZ * sin;
		const rotatedZ = -localX * sin + localZ * cos;

		const avatarPos = sceneTransforms?.avatarPosition ?? { x: 0, y: 0, z: 0 };
		const center = new Vector3(
			rotatedX + avatarPos.x,
			localY + avatarPos.y,
			rotatedZ + avatarPos.z,
		);

		// Replicate Staff3D.svelte rotation computation:
		// facingQuat * worldRotation * horizontalQuat
		const facingQuat = new Quaternion().setFromEuler(new Euler(0, angle, 0));
		const rotation = new Quaternion(
			propState.worldRotation.x,
			propState.worldRotation.y,
			propState.worldRotation.z,
			propState.worldRotation.w,
		);
		const horizontalQuat = this.tempQuat.setFromEuler(
			new Euler(0, 0, Math.PI / 2),
		);
		const finalQuat = facingQuat.multiply(rotation).multiply(horizontalQuat);
		this.tempAxis.set(0, 1, 0).applyQuaternion(finalQuat);

		const positivePos = center
			.clone()
			.add(this.tempAxis.clone().multiplyScalar(staffHalfLength));
		const negativePos = center
			.clone()
			.sub(this.tempAxis.clone().multiplyScalar(staffHalfLength));

		const tips: TipPositionData3D[] = [
			this.computeTipData(propIndex, 0, positivePos, deltaTime),
			this.computeTipData(propIndex, 1, negativePos, deltaTime),
		];

		return { tips, propIndex };
	}

	reset(): void {
		this.history.clear();
	}

	private computeTipData(
		propIndex: number,
		tipIndex: number,
		position: Vector3,
		deltaTime: number,
	): TipPositionData3D {
		const key = `${propIndex}-${tipIndex}`;
		let hist = this.history.get(key);

		if (!hist) {
			hist = {
				prevPosition: position.clone(),
				prevVelocity: new Vector3(),
				hasData: false,
			};
			this.history.set(key, hist);

			return {
				position: { x: position.x, y: position.y, z: position.z },
				velocity: { x: 0, y: 0, z: 0 },
				jerk: { x: 0, y: 0, z: 0 },
				speed: 0,
			};
		}

		const invDt = deltaTime > 0 ? 1 / deltaTime : 60;
		const velocity = position
			.clone()
			.sub(hist.prevPosition)
			.multiplyScalar(invDt);
		const jerk = velocity
			.clone()
			.sub(hist.prevVelocity)
			.multiplyScalar(invDt);
		const speed = velocity.length();

		hist.prevPosition.copy(position);
		hist.prevVelocity.copy(velocity);
		hist.hasData = true;

		return {
			position: { x: position.x, y: position.y, z: position.z },
			velocity: { x: velocity.x, y: velocity.y, z: velocity.z },
			jerk: { x: jerk.x, y: jerk.y, z: jerk.z },
			speed,
		};
	}
}

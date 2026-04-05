import { Vector3, Quaternion, Euler } from "three";
import type { PropTipPositions3D, TipPositionData3D } from "./types";
import type {
	ITipPositionBridge3D,
	PropState3DLike,
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
	): PropTipPositions3D {
		const center = new Vector3(
			propState.worldPosition.x,
			propState.worldPosition.y,
			propState.worldPosition.z,
		);

		const rotation = new Quaternion(
			propState.worldRotation.x,
			propState.worldRotation.y,
			propState.worldRotation.z,
			propState.worldRotation.w,
		);

		// Replicate Staff3D.svelte axis computation:
		// 1. Start with a horizontal quaternion (Z = PI/2)
		// 2. Multiply by the prop's world rotation
		// 3. Apply to the Y-up unit vector to get the staff axis
		const horizontalQuat = this.tempQuat.setFromEuler(
			new Euler(0, 0, Math.PI / 2),
		);
		const finalQuat = rotation.clone().multiply(horizontalQuat);
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

import { Vector3, Quaternion, Euler } from "three";
import type { PropTipPositions3D, TipPositionData3D } from "./types";
/**
 * Minimal prop state needed to compute tip positions.
 */
export interface PropState3DLike {
	worldPosition: { x: number; y: number; z: number };
	worldRotation: { x: number; y: number; z: number; w: number };
	staffRotationAngle: number;
	plane: string;
	centerPathAngle: number;
}

interface TipHistory {
	prevPosition: Vector3;
	prevVelocity: Vector3;
	hasData: boolean;
}

/**
 * Converts 3D prop animation state into per-tip rig-local positions with
 * velocity and jerk computed via finite differencing.
 *
 * The staff axis math replicates Staff3D.svelte: a horizontal quaternion
 * (Euler Z = PI/2) is applied, then the prop's world rotation, to get the
 * axis along the staff. Two tip positions are computed at +/- halfLength
 * from the prop center along that axis.
 *
 * Operates in rig-local space: the caller provides a rig-local center
 * position (handAnchorPos + propState.worldPosition). No scene graph refs
 * are read. The rig's T.Group rotation.y handles facing, so no facing
 * quaternion is needed here.
 */
export class TipPositionBridge3D {
	private history = new Map<string, TipHistory>();
	private readonly tempQuat = new Quaternion();
	private readonly tempAxis = new Vector3();

	update(
		propIndex: number,
		propState: PropState3DLike,
		rigLocalCenter: { x: number; y: number; z: number },
		staffHalfLength: number,
		deltaTime: number,
	): PropTipPositions3D {
		const center = new Vector3(rigLocalCenter.x, rigLocalCenter.y, rigLocalCenter.z);

		// Staff axis in rig-local space: worldRotation × horizontalQuat.
		// No facing rotation needed - the rig's T.Group rotation.y handles that.
		const rotation = new Quaternion(
			propState.worldRotation.x,
			propState.worldRotation.y,
			propState.worldRotation.z,
			propState.worldRotation.w,
		);
		const horizontalQuat = this.tempQuat.setFromEuler(
			new Euler(0, 0, Math.PI / 2),
		);
		const finalQuat = rotation.multiply(horizontalQuat);
		this.tempAxis.set(0, 1, 0).applyQuaternion(finalQuat);

		const positivePos = center.clone().add(this.tempAxis.clone().multiplyScalar(staffHalfLength));
		const negativePos = center.clone().sub(this.tempAxis.clone().multiplyScalar(staffHalfLength));

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

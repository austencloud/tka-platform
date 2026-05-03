/**
 * Step Motion Deriver
 *
 * Wraps HandPathMotionCalculator to convert a single step's start/end positions
 * into a fully populated MotionData. Uses preview mode (FLOAT arrows) since the
 * visual builder shows live feedback before rotation is finalized.
 */

import type { GridLocation, GridMode } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
import {
	HandMotionType,
	MotionType,
	Orientation,
	RotationDirection,
	type MotionColor,
} from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";
import { PropType } from "$lib/shared/pictograph/prop/domain/enums/PropType";
import { createMotionData, type MotionData } from "$lib/shared/pictograph/shared/domain/models/MotionData";
import { HandPathMotionCalculator } from "$lib/features/create/assemble/services/HandPathMotionCalculator";
export class StepMotionDeriver {
	private readonly calculator = new HandPathMotionCalculator();

	deriveMotion(
		startLocation: GridLocation,
		endLocation: GridLocation,
		color: MotionColor,
		rotationDirection: RotationDirection,
		gridMode: GridMode,
	): MotionData {
		const handMotionType = this.calculator.calculateMotionType(startLocation, endLocation, gridMode);
		const handPathDirection = this.calculator.calculateRotationDirection(startLocation, endLocation, gridMode);

		const motionType = this.resolveMotionType(handMotionType, handPathDirection, rotationDirection);
		const resolvedRotation = this.resolveRotationDirection(handMotionType, rotationDirection);

		return createMotionData({
			color,
			startLocation,
			endLocation,
			motionType,
			rotationDirection: resolvedRotation,
			gridMode,
			propType: PropType.HAND,
			startOrientation: Orientation.IN,
			endOrientation: Orientation.IN,
			turns: motionType === MotionType.FLOAT ? "fl" : 0,
			arrowLocation: startLocation,
			isVisible: true,
		});
	}

	private resolveMotionType(
		handMotionType: HandMotionType,
		handPathDirection: RotationDirection | null,
		userRotation: RotationDirection,
	): MotionType {
		switch (handMotionType) {
			case HandMotionType.STATIC:
				return MotionType.STATIC;
			case HandMotionType.DASH:
				return MotionType.DASH;
			case HandMotionType.SHIFT:
				return handPathDirection === userRotation ? MotionType.PRO : MotionType.ANTI;
			default:
				return MotionType.STATIC;
		}
	}

	private resolveRotationDirection(
		handMotionType: HandMotionType,
		userRotation: RotationDirection,
	): RotationDirection {
		if (handMotionType === HandMotionType.SHIFT) {
			return userRotation;
		}
		return RotationDirection.NO_ROTATION;
	}
}

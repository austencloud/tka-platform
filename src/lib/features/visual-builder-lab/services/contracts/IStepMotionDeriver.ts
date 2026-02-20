/**
 * Beat Motion Deriver Contract
 *
 * Derives MotionData from a single beat's start/end positions.
 * Used by the visual builder to convert grid clicks into domain motion data.
 */

import type { GridLocation, GridMode } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
import type { MotionColor, RotationDirection } from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";
import type { MotionData } from "$lib/shared/pictograph/shared/domain/models/MotionData";

export interface IBeatMotionDeriver {
	deriveMotion(
		startLocation: GridLocation,
		endLocation: GridLocation,
		color: MotionColor,
		rotationDirection: RotationDirection,
		gridMode: GridMode,
	): MotionData;
}

import type { StepData } from "$lib/shared/foundation/domain/models/step-data";
import type { GridPosition, GridLocation } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
import { MotionColor } from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";
import { isVisibleMotion } from "$lib/shared/pictograph/shared/domain/models/motion-data";
import { getGridPositionFromLocations } from "$lib/shared/pictograph/grid/services/grid-position-deriver";
import { QUARTER_POSITION_MAP_CW, QUARTER_POSITION_MAP_CCW } from "$lib/shared/foundation/domain/models/generation/circular-position-maps";

const periodCache = new Map<string, number>();

function derivePosition(step: StepData): GridPosition | null {
	const blue = step.motions?.[MotionColor.BLUE];
	const red = step.motions?.[MotionColor.RED];
	// Invisible placeholder = hand not really there (both-required Step shape).
	if (!isVisibleMotion(blue) || !isVisibleMotion(red)) return null;
	if (!blue.startLocation || !red.startLocation) return null;
	try {
		return getGridPositionFromLocations(
			blue.startLocation as GridLocation,
			red.startLocation as GridLocation
		);
	} catch {
		return null;
	}
}

export function detectRotationPeriod(seqId: string, steps: readonly StepData[]): number {
	const cached = periodCache.get(seqId);
	if (cached !== undefined) return cached;

	let period = 2;
	const len = steps.length;

	if (len >= 4 && len % 4 === 0) {
		const q = len / 4;
		const s0 = steps[0];
		const s1 = steps[q];
		const s2 = steps[q * 2];
		const s3 = steps[q * 3];
		const p0 = s0 ? derivePosition(s0) : null;
		const p1 = s1 ? derivePosition(s1) : null;
		const p2 = s2 ? derivePosition(s2) : null;
		const p3 = s3 ? derivePosition(s3) : null;

		if (p0 && p1 && p2 && p3) {
			const cw =
				QUARTER_POSITION_MAP_CW[p0] === p1 &&
				QUARTER_POSITION_MAP_CW[p1] === p2 &&
				QUARTER_POSITION_MAP_CW[p2] === p3;
			const ccw =
				QUARTER_POSITION_MAP_CCW[p0] === p1 &&
				QUARTER_POSITION_MAP_CCW[p1] === p2 &&
				QUARTER_POSITION_MAP_CCW[p2] === p3;
			if (cw || ccw) period = 4;
		}
	}

	periodCache.set(seqId, period);
	return period;
}

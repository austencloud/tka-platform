/**
 * Visual Builder Lab DI Container
 *
 * Services for the visual sequence builder (click grid points to build).
 */

import { createContainer } from "iti";
import { GridHitTargetCalculator } from "$lib/features/visual-builder-lab/services/implementations/GridHitTargetCalculator";
import { BeatMotionDeriver } from "$lib/features/visual-builder-lab/services/implementations/BeatMotionDeriver";
import { SvgPropAnimator } from "$lib/features/visual-builder-lab/services/implementations/SvgPropAnimator";

export const visualBuilderContainer = createContainer().add({
	gridHitTargetCalculator: () => new GridHitTargetCalculator(),
	beatMotionDeriver: () => new BeatMotionDeriver(),
	svgPropAnimator: () => new SvgPropAnimator(),
});

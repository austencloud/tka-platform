/**
 * Assemble Lab DI Container
 *
 * Services for the visual sequence builder (click grid points to build).
 */

import { createContainer } from "iti";
import { GridHitTargetCalculator } from "$lib/features/assemble-lab/services/implementations/GridHitTargetCalculator";
import { StepMotionDeriver } from "$lib/features/assemble-lab/services/implementations/StepMotionDeriver";
import { SvgPropAnimator } from "$lib/features/assemble-lab/services/implementations/SvgPropAnimator";
import { BuilderStepConverter } from "$lib/features/assemble-lab/services/implementations/BuilderStepConverter";

export const assembleContainer = createContainer().add({
	gridHitTargetCalculator: () => new GridHitTargetCalculator(),
	stepMotionDeriver: () => new StepMotionDeriver(),
	svgPropAnimator: () => new SvgPropAnimator(),
	builderStepConverter: () => new BuilderStepConverter(),
});

export type AssembleContainer = typeof assembleContainer;

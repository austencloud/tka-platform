/**
 * Trigrid Lab DI Container
 *
 * Provides geometry and position resolution services for the 3-point triangle grid.
 */

import { createContainer } from "iti";
import { TriGridCalculator } from "$lib/features/trigrid-lab/services/implementations/TriGridCalculator";
import { TriGridPositionResolver } from "$lib/features/trigrid-lab/services/implementations/TriGridPositionResolver";

export const trigridLabContainer = createContainer().add({
  triGridCalculator: () => new TriGridCalculator(),
  triGridPositionResolver: () => new TriGridPositionResolver(),
});

export type TrigridLabContainer = typeof trigridLabContainer;

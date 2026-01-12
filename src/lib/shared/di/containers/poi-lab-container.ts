/**
 * Poi Lab Module ITI Container
 *
 * Provides all services for the poi lab feature including:
 * - Gravity orientation derivation
 * - Constraint validation (motion + transition)
 * - Sequence validation
 * - Option filtering
 * - VTG terminology mapping
 */

import { createContainer } from "iti";

// Service implementations
import { PoiGravityOrientationDeriver } from "$lib/features/poi-lab/services/implementations/PoiGravityOrientationDeriver";
import { PoiConstraintValidator } from "$lib/features/poi-lab/services/implementations/PoiConstraintValidator";
import { PoiSequenceValidator } from "$lib/features/poi-lab/services/implementations/PoiSequenceValidator";
import { PoiOptionFilterDecorator } from "$lib/features/poi-lab/services/implementations/PoiOptionFilterDecorator";
import { VTGTerminologyMapper } from "$lib/features/poi-lab/services/implementations/VTGTerminologyMapper";

/**
 * Creates the poi lab container with all required services.
 * Self-contained - no external dependencies needed.
 */
export function createPoiLabContainer() {
  // Tier 0: Services with no internal dependencies
  const tier0 = createContainer()
    .add({
      // Gravity orientation mapping (stateless)
      poiGravityOrientationDeriver: () => new PoiGravityOrientationDeriver(),
    })
    .add({
      // VTG terminology mapping (stateless)
      vtgTerminologyMapper: () => new VTGTerminologyMapper(),
    });

  // Tier 1: Services depending on tier 0
  const tier1 = tier0.add((ctx) => ({
    // Constraint validator needs gravity deriver
    poiConstraintValidator: () =>
      new PoiConstraintValidator(ctx.poiGravityOrientationDeriver),
  }));

  // Tier 2: Services depending on tier 1
  const container = tier1
    .add((ctx) => ({
      // Sequence validator needs constraint validator
      poiSequenceValidator: () =>
        new PoiSequenceValidator(ctx.poiConstraintValidator),
    }))
    .add((ctx) => ({
      // Option filter decorator needs constraint validator
      poiOptionFilterDecorator: () =>
        new PoiOptionFilterDecorator(ctx.poiConstraintValidator),
    }));

  return container;
}

export type PoiLabContainer = ReturnType<typeof createPoiLabContainer>;

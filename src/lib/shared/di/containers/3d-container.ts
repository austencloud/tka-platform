/**
 * Animation 3D ITI Container
 *
 * Provides all services for the 3D animation system including:
 * - Core math services (angle math, orientation mapping, motion calculation)
 * - Coordinate and interpolation services
 * - Sequence conversion
 * - Persistence
 * - Duet system
 *
 * Note: Avatar system services (skeleton, IK, animator, leg animator) are
 * instantiated directly in Avatar3D.svelte because each avatar needs its own
 * independent instances (not singletons).
 */

import { createContainer } from "iti";

// Service implementations
import { AngleMathCalculator } from "$lib/shared/3d/services/implementations/AngleMathCalculator";
import { OrientationMapper } from "$lib/shared/3d/services/implementations/OrientationMapper";
import { MotionCalculator } from "$lib/shared/3d/services/implementations/MotionCalculator";
import { PlaneCoordinateMapper } from "$lib/shared/3d/services/implementations/PlaneCoordinateMapper";
import { PropStateInterpolator } from "$lib/shared/3d/services/implementations/PropStateInterpolator";
import { SequenceConverter } from "$lib/shared/3d/services/implementations/SequenceConverter";
import { Animation3DPersister } from "$lib/shared/3d/services/implementations/Animation3DPersister";
import { DuetPersister } from "$lib/shared/3d/services/implementations/DuetPersister";
import { createPerformerSynchronizer } from "$lib/shared/3d/services/implementations/PerformerSynchronizer";

// External dependency types
import type { IBrowseLoader } from "$lib/features/browse/sequences/display/services/contracts/IBrowseLoader";

/**
 * External dependencies required by the animation-3d container.
 */
export interface Animation3DContainerDeps {
  browseLoader: IBrowseLoader;
}

/**
 * Creates the animation-3d container with all required dependencies.
 *
 * @param deps - External dependencies from the root container
 */
export function createAnimation3DContainer(deps: Animation3DContainerDeps) {
  // Tier 0: Core math services (no dependencies, singletons)
  // Names prefixed with "animation3D" to avoid conflicts with animator container
  const tier0 = createContainer()
    .add({
      // Core math
      animation3DAngleMath: () => new AngleMathCalculator(),
      animation3DOrientationMapper: () => new OrientationMapper(),
    })
    .add((ctx) => ({
      // Motion calculator depends on angle math and orientation
      animation3DMotionCalculator: () =>
        new MotionCalculator(ctx.animation3DAngleMath, ctx.animation3DOrientationMapper),
    }))
    .add({
      // Coordinate mapping (no dependencies)
      planeCoordinateMapper: () => new PlaneCoordinateMapper(),
    });

  // Tier 1: Interpolation (depends on tier 0 services)
  const tier1 = tier0.add((ctx) => ({
    propStateInterpolator: () =>
      new PropStateInterpolator(
        ctx.animation3DAngleMath,
        ctx.animation3DOrientationMapper,
        ctx.animation3DMotionCalculator
      ),
  }));

  // Tier 2: Conversion and persistence (no dependencies)
  const tier2 = tier1.add({
    sequenceConverter: () => new SequenceConverter(),
    animation3DPersister: () => new Animation3DPersister(),
  });

  // Tier 3: Duet and multi-performer systems
  const container = tier2.add({
    duetPersister: () => new DuetPersister(deps.browseLoader),
    // Factory function - creates new instance each time (not singleton)
    // Use container.items.performerSynchronizerFactory() to create instances
    performerSynchronizerFactory: () => createPerformerSynchronizer,
  });

  return container;
}

export type Animation3DContainer = ReturnType<typeof createAnimation3DContainer>;

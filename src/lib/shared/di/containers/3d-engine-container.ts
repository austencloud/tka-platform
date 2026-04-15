/**
 * 3D Engine Container
 *
 * Infrastructure services for the 3D scene/animation engine, shared across
 * every 3D experience (sequence viewer, museum, village, festival).
 *
 * Scope:
 * - Core math (angle math, orientation mapping, motion calculation)
 * - Coordinate and interpolation services
 * - Sequence conversion
 * - Persistence (localStorage-backed UI state)
 * - Duet/multi-performer sync
 * - Quality tier detection and effect bridging
 *
 * Not included here:
 * - Avatar system services (skeleton, IK, animator) — each avatar needs its own
 *   instances, so they're created directly in Avatar3D.svelte, not as singletons.
 * - Viewer-specific concerns like undo/redo — see viewer-3d-container.ts.
 */

import { createContainer } from "iti";

import { AngleMathCalculator } from "$lib/shared/3d/services/implementations/AngleMathCalculator";
import { QualityTierDetector } from "$lib/shared/3d/effects/quality/QualityTierDetector";
import { TipPositionBridge3D } from "$lib/shared/3d/effects/TipPositionBridge3D";
import { OrientationMapper } from "$lib/shared/3d/services/implementations/OrientationMapper";
import { MotionCalculator } from "$lib/shared/3d/services/implementations/MotionCalculator";
import { PlaneCoordinateMapper } from "$lib/shared/3d/services/implementations/PlaneCoordinateMapper";
import { PropStateInterpolator } from "$lib/shared/3d/services/implementations/PropStateInterpolator";
import { SequenceConverter } from "$lib/shared/3d/services/implementations/SequenceConverter";
import { Scene3DPersister } from "$lib/shared/3d/services/implementations/Scene3DPersister";
import { DuetPersister } from "$lib/shared/3d/services/implementations/DuetPersister";
import { createPerformerSynchronizer } from "$lib/shared/3d/services/implementations/PerformerSynchronizer";

import type { IBrowseLoader } from "$lib/features/browse/sequences/display/services/contracts/IBrowseLoader";

/**
 * External dependencies required by the 3D engine container.
 */
export interface Engine3DContainerDeps {
  browseLoader: IBrowseLoader;
}

/**
 * Creates the 3D engine container with all required dependencies.
 *
 * @param deps - External dependencies from the root container
 */
export function create3DEngineContainer(deps: Engine3DContainerDeps) {
  // Tier 0: Core math services (no dependencies, singletons)
  const tier0 = createContainer()
    .add({
      angleMath3D: () => new AngleMathCalculator(),
      orientationMapper3D: () => new OrientationMapper(),
    })
    .add((ctx) => ({
      motionCalculator3D: () =>
        new MotionCalculator(ctx.angleMath3D, ctx.orientationMapper3D),
    }))
    .add({
      planeCoordinateMapper: () => new PlaneCoordinateMapper(),
    });

  // Tier 1: Interpolation (depends on tier 0 services)
  const tier1 = tier0.add((ctx) => ({
    propStateInterpolator: () =>
      new PropStateInterpolator(
        ctx.angleMath3D,
        ctx.orientationMapper3D,
        ctx.motionCalculator3D
      ),
  }));

  // Tier 2: Conversion and persistence (no dependencies)
  const tier2 = tier1.add({
    sequenceConverter: () => new SequenceConverter(),
    scene3DPersister: () => new Scene3DPersister(),
  });

  // Tier 3: Duet and multi-performer systems
  const tier3 = tier2.add({
    duetPersister: () => new DuetPersister(deps.browseLoader),
    // Factory function — creates a new instance each call (not a singleton).
    // Use container.items.performerSynchronizerFactory() to create instances.
    performerSynchronizerFactory: () => createPerformerSynchronizer,
  });

  // Tier 4: 3D effects infrastructure
  const container = tier3.add({
    qualityTierDetector: () => new QualityTierDetector(),
    tipPositionBridge: () => new TipPositionBridge3D(),
  });

  return container;
}

export type Engine3DContainer = ReturnType<typeof create3DEngineContainer>;

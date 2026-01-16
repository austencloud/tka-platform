/**
 * Animator Container (ITI)
 *
 * Contains all services for the animation pipeline:
 * - Animation playback controllers
 * - Sequence animation orchestrators
 * - Beat calculation, prop interpolation
 * - Canvas rendering, SVG generation
 * - Video export orchestration
 */

import { createContainer } from "iti";

// === TIER 0: No dependencies ===
import { AngleCalculator } from "$lib/features/compose/services/implementations/AngleCalculator";
import { AnimationLoop } from "$lib/features/compose/services/implementations/AnimationLoop";
import { AnimationStateManager } from "$lib/features/compose/services/implementations/AnimationStateManager";
import { BeatCalculator } from "$lib/features/compose/services/implementations/BeatCalculator";
import { CanvasRenderer } from "$lib/features/compose/services/implementations/CanvasRenderer";
import { CoordinateUpdater } from "$lib/features/compose/services/implementations/CoordinateUpdater";
import { MotionCalculator } from "$lib/features/compose/services/implementations/MotionCalculator";
import { SequenceLoopabilityChecker } from "$lib/features/compose/services/implementations/SequenceLoopabilityChecker";
import { SVGGenerator } from "$lib/features/compose/services/implementations/SVGGenerator";
import { TrailCapturer } from "$lib/features/compose/services/implementations/TrailCapturer";
import { AnimationStorageManager } from "$lib/features/compose/services/implementations/AnimationStorageManager";
import { VideoExporter } from "$lib/features/compose/services/implementations/VideoExporter";
import { DarkModeProvider } from "$lib/shared/animation-engine/services/implementations/DarkModeProvider";
import { Animator } from "$lib/shared/application/services/implementations/Animator";

// === TIER 1: Internal dependencies only ===
import { EndpointCalculator } from "$lib/features/compose/services/implementations/EndpointCalculator";
import { PropInterpolator } from "$lib/features/compose/services/implementations/PropInterpolator";
import { SequenceAnimationOrchestrator } from "$lib/features/compose/services/implementations/SequenceAnimationOrchestrator";
import { AnimationPlaybackController } from "$lib/features/compose/services/implementations/AnimationPlaybackController";

// === TIER 2: External dependencies (require other containers) ===
import { CompositeVideoRenderer } from "$lib/features/compose/services/implementations/CompositeVideoRenderer";
import { VideoExportOrchestrator } from "$lib/features/compose/services/implementations/VideoExportOrchestrator";
import { TunnelModeSequenceManager } from "$lib/features/compose/services/implementations/TunnelModeSequenceManager";
import { SequenceMotionLoader } from "$lib/shared/sequence-viewer/services/implementations/SequenceMotionLoader";

// Type imports for external dependencies
import type { IImageComposer } from "$lib/shared/render/services/contracts/IImageComposer";
import type { IDimensionCalculator } from "$lib/shared/render/services/contracts/IDimensionCalculator";
import type { ISvgImageConverter } from "$lib/shared/foundation/services/contracts/ISvgImageConverter";
import type { IFileDownloader } from "$lib/shared/foundation/services/contracts/IFileDownloader";
import type { ISequenceRepository } from "$lib/features/create/shared/services/contracts/ISequenceRepository";
import type { ISequenceTransformer } from "$lib/features/create/shared/services/contracts/ISequenceTransformer";
import type { IDiscoverLoader } from "$lib/features/discover/sequences/display/services/contracts/IDiscoverLoader";

/**
 * External dependencies that must be provided from other containers
 */
export interface AnimatorContainerDependencies {
  imageComposer: IImageComposer;
  dimensionCalculator: IDimensionCalculator;
  svgImageConverter: ISvgImageConverter;
  fileDownloader: IFileDownloader;
  sequenceRepository: ISequenceRepository;
  sequenceTransformer: ISequenceTransformer;
  discoverLoader: IDiscoverLoader;
}

/**
 * Create the animator container with all animation-related services.
 *
 * @param externalDeps - Dependencies from other containers (render, foundation, create, discover)
 * @returns ITI container with all animator services
 */
export function createAnimatorContainer(externalDeps: AnimatorContainerDependencies) {
  return createContainer()
    // === TIER 0: Services with no dependencies ===
    .add({
      angleCalculator: () => new AngleCalculator(),
      animationLoop: () => new AnimationLoop(),
      animationStateService: () => new AnimationStateManager(),
      beatCalculationService: () => new BeatCalculator(),
      canvasRenderer: () => new CanvasRenderer(),
      coordinateUpdater: () => new CoordinateUpdater(),
      motionCalculator: () => new MotionCalculator(),
      sequenceLoopabilityChecker: () => new SequenceLoopabilityChecker(),
      svgGenerator: () => new SVGGenerator(),
      trailCapturer: () => new TrailCapturer(),
      animationStorageManager: () => new AnimationStorageManager(),
      videoExporter: () => new VideoExporter(),
      darkModeProvider: () => new DarkModeProvider(),
      animator: () => new Animator(),
    })
    // === TIER 1: Services with internal dependencies ===
    .add((ctx) => ({
      endpointCalculator: () =>
        new EndpointCalculator(ctx.angleCalculator, ctx.motionCalculator),
    }))
    .add((ctx) => ({
      propInterpolationService: () =>
        new PropInterpolator(ctx.angleCalculator, ctx.endpointCalculator),
    }))
    .add((ctx) => ({
      sequenceAnimationOrchestrator: () =>
        new SequenceAnimationOrchestrator(
          ctx.animationStateService,
          ctx.beatCalculationService,
          ctx.propInterpolationService
        ),
    }))
    .add((ctx) => ({
      animationPlaybackController: () =>
        new AnimationPlaybackController(
          ctx.sequenceAnimationOrchestrator,
          ctx.animationLoop,
          ctx.sequenceLoopabilityChecker
        ),
    }))
    // === TIER 2: Services with external dependencies ===
    .add(() => ({
      compositeVideoRenderer: () =>
        new CompositeVideoRenderer(
          externalDeps.imageComposer,
          externalDeps.dimensionCalculator
        ),
    }))
    .add((ctx) => ({
      videoExportOrchestrator: () =>
        new VideoExportOrchestrator(
          ctx.videoExporter,
          ctx.canvasRenderer,
          externalDeps.svgImageConverter,
          externalDeps.fileDownloader,
          ctx.compositeVideoRenderer
        ),
    }))
    .add(() => ({
      tunnelModeSequenceManager: () =>
        new TunnelModeSequenceManager(
          externalDeps.sequenceRepository,
          externalDeps.sequenceTransformer
        ),
    }))
    .add(() => ({
      sequenceMotionLoader: () =>
        new SequenceMotionLoader(externalDeps.discoverLoader),
    }));
}

/**
 * Type helper for extracting container items type
 */
export type AnimatorContainerItems = ReturnType<typeof createAnimatorContainer>["items"];

/**
 * Factory function to create a NEW AnimationPlaybackController instance.
 * Use this when you need multiple independent controllers (e.g., tunnel mode with multiple sequences).
 * Each call returns a fresh controller with its own orchestrator and loop.
 */
export function createPlaybackControllerFactory() {
  // Create fresh instances of stateful services
  const stateManager = new AnimationStateManager();
  const beatCalculator = new BeatCalculator();
  const angleCalculator = new AngleCalculator();
  const motionCalculator = new MotionCalculator();
  const endpointCalculator = new EndpointCalculator(angleCalculator, motionCalculator);
  const propInterpolator = new PropInterpolator(angleCalculator, endpointCalculator);

  const orchestrator = new SequenceAnimationOrchestrator(
    stateManager,
    beatCalculator,
    propInterpolator
  );
  const loop = new AnimationLoop();
  const loopChecker = new SequenceLoopabilityChecker();

  return new AnimationPlaybackController(orchestrator, loop, loopChecker);
}

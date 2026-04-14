/**
 * Compose Core Container (ITI)
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
import { DeviceTierDetector } from "$lib/shared/animation-engine/services/implementations/DeviceTierDetector";
import { FrameBudgetMonitor } from "$lib/shared/animation-engine/services/implementations/FrameBudgetMonitor";
import { ArrangeUndoManager } from "$lib/features/compose/tabs/arrange/services/implementations/ArrangeUndoManager";
import { ArrangeGridSerializer } from "$lib/features/compose/tabs/arrange/services/implementations/ArrangeGridSerializer";
import { AngleCalculator } from "$lib/features/compose/services/implementations/AngleCalculator";
import { AnimationLoop } from "$lib/features/compose/services/implementations/AnimationLoop";
import { AnimationStateManager } from "$lib/features/compose/services/implementations/AnimationStateManager";
import { StepCalculator } from "$lib/features/compose/services/implementations/StepCalculator";
import { CanvasRenderer } from "$lib/features/compose/services/implementations/CanvasRenderer";
import { CoordinateUpdater } from "$lib/features/compose/services/implementations/CoordinateUpdater";
import { MotionCalculator } from "$lib/features/compose/services/implementations/MotionCalculator";
import { SVGGenerator } from "$lib/features/compose/services/implementations/SVGGenerator";
import { TrailCapturer } from "$lib/features/compose/services/implementations/TrailCapturer";
import { AnimationPathCache } from "$lib/features/compose/services/implementations/AnimationPathCache";
import { AnimationStorageManager } from "$lib/features/compose/services/implementations/AnimationStorageManager";
import { VideoExporter } from "$lib/features/compose/services/implementations/VideoExporter";
import { BackgroundVideoEncoder } from "$lib/features/compose/services/implementations/BackgroundVideoEncoder";
import { DarkModeProvider } from "$lib/shared/animation-engine/services/implementations/DarkModeProvider";
import { PropPositionCalculator } from "$lib/shared/animation-engine/services/implementations/PropPositionCalculator";
import { Animator } from "$lib/shared/application/services/implementations/Animator";

// === TIER 1: Internal dependencies only ===
import { EndpointCalculator } from "$lib/features/compose/services/implementations/EndpointCalculator";
import { PropInterpolator } from "$lib/features/compose/services/implementations/PropInterpolator";
import { SequenceAnimationOrchestrator } from "$lib/features/compose/services/implementations/SequenceAnimationOrchestrator";
import { AnimationPlaybackController } from "$lib/features/compose/services/implementations/AnimationPlaybackController";
import { SequenceLoopabilityChecker } from "$lib/features/compose/services/implementations/SequenceLoopabilityChecker";
import { AnimationPlaybackControllerFactory } from "$lib/features/compose/services/implementations/AnimationPlaybackControllerFactory";

// === TIER 2: External dependencies (require other containers) ===
import { CompositeVideoRenderer } from "$lib/features/compose/services/implementations/CompositeVideoRenderer";
import { ExportGlyphPrerenderer } from "$lib/features/compose/services/implementations/ExportGlyphPrerenderer";
import { VideoExportOrchestrator } from "$lib/features/compose/services/implementations/VideoExportOrchestrator";
import { TunnelModeSequenceManager } from "$lib/features/compose/services/implementations/TunnelModeSequenceManager";
import { SequenceMotionLoader } from "$lib/shared/sequence-viewer/services/implementations/SequenceMotionLoader";
import { TempoPracticeOrchestrator } from "$lib/shared/sequence-viewer/services/implementations/TempoPracticeOrchestrator";

// Type imports for external dependencies
import type { IImageComposer } from "$lib/shared/render/services/contracts/IImageComposer";
import type { IDimensionCalculator } from "$lib/shared/render/services/contracts/IDimensionCalculator";
import type { ILayoutCalculator } from "$lib/shared/render/services/contracts/ILayoutCalculator";
import type { ISvgImageConverter } from "$lib/shared/foundation/services/contracts/ISvgImageConverter";
import type { IFileDownloader } from "$lib/shared/foundation/services/contracts/IFileDownloader";
import type { ISequenceRepository } from "$lib/features/create/shared/services/contracts/ISequenceRepository";
import type { ISequenceTransformer } from "$lib/features/create/shared/services/contracts/ISequenceTransformer";
import type { IBrowseLoader } from "$lib/features/browse/sequences/display/services/contracts/IBrowseLoader";
import type { ISequenceLoopabilityChecker } from "$lib/features/compose/services/contracts/ISequenceLoopabilityChecker";
import { Offline3DExporter } from "$lib/shared/3d/services/implementations/Offline3DExporter";
import { CanvasFrameCapturer } from "$lib/shared/video-export/services/implementations/CanvasFrameCapturer";
import { CameraKeyframeInterpolator } from "$lib/shared/video-export/services/implementations/CameraKeyframeInterpolator";

/**
 * External dependencies that must be provided from other containers
 */
export interface ComposeCoreContainerDependencies {
  imageComposer: IImageComposer;
  dimensionCalculator: IDimensionCalculator;
  layoutCalculator: ILayoutCalculator;
  svgImageConverter: ISvgImageConverter;
  fileDownloader: IFileDownloader;
  sequenceRepository: ISequenceRepository;
  sequenceTransformer: ISequenceTransformer;
  browseLoader: IBrowseLoader;
  sequenceLoopabilityChecker: ISequenceLoopabilityChecker;
}

/**
 * Create the compose core container with all animation-related services.
 *
 * @param externalDeps - Dependencies from other containers (render, foundation, create, browse)
 * @returns ITI container with all compose core services
 */
export function createComposeCoreContainer(externalDeps: ComposeCoreContainerDependencies) {
  return createContainer()
    // === TIER 0: Services with no dependencies ===
    .add({
      angleCalculator: () => new AngleCalculator(),
      animationLoop: () => new AnimationLoop(),
      animationStateService: () => new AnimationStateManager(),
      stepCalculationService: () => new StepCalculator(),
      canvasRenderer: () => new CanvasRenderer(),
      coordinateUpdater: () => new CoordinateUpdater(),
      motionCalculator: () => new MotionCalculator(),
      svgGenerator: () => new SVGGenerator(),
      trailCapturer: () => new TrailCapturer(),
      animationPathCache: () => new AnimationPathCache(),
      animationStorageManager: () => new AnimationStorageManager(),
      videoExporter: () => new VideoExporter(),
      backgroundVideoEncoder: () => new BackgroundVideoEncoder(),
      darkModeProvider: () => new DarkModeProvider(),
      propPositionCalculator: () => new PropPositionCalculator(),
      animator: () => new Animator(),
      arrangeUndoManager: () => new ArrangeUndoManager(),
      arrangeGridSerializer: () => new ArrangeGridSerializer(),
      deviceTierDetector: () => new DeviceTierDetector(),
    })
    // === TIER 0.5: Depends on tier 0 ===
    .add((ctx) => ({
      frameBudgetMonitor: () =>
        new FrameBudgetMonitor(ctx.deviceTierDetector.detect()),
    }))
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
          ctx.stepCalculationService,
          ctx.propInterpolationService
        ),
    }))
    .add((ctx) => ({
      animationPlaybackController: () =>
        new AnimationPlaybackController(
          ctx.sequenceAnimationOrchestrator,
          ctx.animationLoop,
          externalDeps.sequenceLoopabilityChecker
        ),
      animationPlaybackControllerFactory: () =>
        new AnimationPlaybackControllerFactory(
          externalDeps.sequenceLoopabilityChecker
        ),
    }))
    // === TIER 2: Services with external dependencies ===
    .add(() => ({
      compositeVideoRenderer: () =>
        new CompositeVideoRenderer(
          externalDeps.imageComposer,
          externalDeps.dimensionCalculator,
          externalDeps.layoutCalculator
        ),
    }))
    .add(() => ({
      canvasFrameCapturer: () => new CanvasFrameCapturer(),
    }))
    .add(() => ({
      exportGlyphPrerenderer: () =>
        new ExportGlyphPrerenderer(externalDeps.svgImageConverter),
    }))
    .add((ctx) => ({
      videoExportOrchestrator: () =>
        new VideoExportOrchestrator(
          ctx.videoExporter,
          ctx.canvasRenderer,
          externalDeps.fileDownloader,
          ctx.compositeVideoRenderer,
          ctx.exportGlyphPrerenderer,
          ctx.backgroundVideoEncoder
        ),
    }))
    .add(() => ({
      cameraKeyframeInterpolator: () => new CameraKeyframeInterpolator(),
    }))
    .add((ctx) => ({
      offline3DExporter: () =>
        new Offline3DExporter(
          ctx.backgroundVideoEncoder,
          ctx.canvasFrameCapturer,
          ctx.cameraKeyframeInterpolator
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
        new SequenceMotionLoader(externalDeps.browseLoader),
    }))
    .add(() => ({
      tempoPracticeOrchestrator: () => new TempoPracticeOrchestrator(),
    }));
}

/**
 * Type helper for extracting container items type
 */
export type ComposeCoreContainerItems = ReturnType<typeof createComposeCoreContainer>["items"];

/**
 * Factory function to create a NEW AnimationPlaybackController instance.
 * Use this when you need multiple independent controllers (e.g., tunnel mode with multiple sequences).
 * Each call returns a fresh controller with its own orchestrator and loop.
 */
export function createPlaybackControllerFactory() {
  // Create fresh instances of stateful services
  const stateManager = new AnimationStateManager();
  const beatCalculator = new StepCalculator();
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

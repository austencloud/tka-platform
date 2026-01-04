import type { ContainerModuleLoadOptions } from "inversify";
import { ContainerModule } from "inversify";
import { AngleCalculator } from "../../../features/compose/services/implementations/AngleCalculator";
import { AnimationLoop } from "../../../features/compose/services/implementations/AnimationLoopService";
import { AnimationPlaybackController } from "../../../features/compose/services/implementations/AnimationPlaybackController";
import { AnimationStateManager as AnimationStateService } from "../../../features/compose/services/implementations/AnimationStateManager";
import { BeatCalculator as BeatCalculationService } from "../../../features/compose/services/implementations/BeatCalculator";
import { CanvasRenderer } from "../../../features/compose/services/implementations/CanvasRenderer";
import { CoordinateUpdater } from "../../../features/compose/services/implementations/CoordinateUpdater";
import { EndpointCalculator } from "../../../features/compose/services/implementations/EndpointCalculator";
import { VideoExportOrchestrator } from "../../../features/compose/services/implementations/VideoExportOrchestrator";
import { VideoExporter } from "../../../features/compose/services/implementations/VideoExporter";
import { CompositeVideoRenderer } from "../../../features/compose/services/implementations/CompositeVideoRenderer";
import { MotionCalculator } from "../../../features/compose/services/implementations/MotionCalculator";
// Canvas2DAnimationRenderer loaded on-demand via animation module
import { PropInterpolator as PropInterpolationService } from "../../../features/compose/services/implementations/PropInterpolator";
import { SequenceAnimationOrchestrator } from "../../../features/compose/services/implementations/SequenceAnimationOrchestrator";
import { SequenceLoopabilityChecker } from "../../../features/compose/services/implementations/SequenceLoopabilityChecker";
// SequenceNormalizer moved to data.module.ts (Tier 1) - required by ISequenceRepository
import { SVGGenerator } from "../../../features/compose/services/implementations/SVGGenerator";
import { TrailCapturer } from "../../../features/compose/services/implementations/TrailCapturer";
import { TunnelModeSequenceManager } from "../../../features/compose/services/implementations/TunnelModeSequenceManager";
import { AnimationStorageManager } from "../../../features/compose/services/implementations/AnimationStorageManager";
import { DarkModeProvider } from "../../animation-engine/services/implementations/DarkModeProvider";
import { Animator } from "../../application/services/implementations/Animator";
import { TYPES } from "../types";

export const animatorModule = new ContainerModule(
  (options: ContainerModuleLoadOptions) => {
    // === CORE ANIMATION SERVICES ===
    options.bind(TYPES.IAnimator).to(Animator);
    options.bind(TYPES.IAnimationLoop).to(AnimationLoop);
    options
      .bind(TYPES.IAnimationPlaybackController)
      .to(AnimationPlaybackController);
    options
      .bind(TYPES.ISequenceAnimationOrchestrator)
      .to(SequenceAnimationOrchestrator);
    options.bind(TYPES.IAnimationStateService).to(AnimationStateService);
    options.bind(TYPES.IBeatCalculationService).to(BeatCalculationService);
    options.bind(TYPES.IPropInterpolationService).to(PropInterpolationService);
    options
      .bind(TYPES.ISequenceLoopabilityChecker)
      .to(SequenceLoopabilityChecker);

    // === CALCULATION SERVICES ===
    options.bind(TYPES.IAngleCalculator).to(AngleCalculator);
    options.bind(TYPES.ICoordinateUpdater).to(CoordinateUpdater);
    options.bind(TYPES.IMotionCalculator).to(MotionCalculator);
    options.bind(TYPES.IEndpointCalculator).to(EndpointCalculator);

    // === RENDERING SERVICES ===
    options.bind(TYPES.ICanvasRenderer).to(CanvasRenderer);
    // IAnimationRenderer loaded on-demand via animation module when animation canvas is used
    options.bind(TYPES.ISVGGenerator).to(SVGGenerator);
    options.bind(TYPES.IVideoExporter).to(VideoExporter);
    options.bind(TYPES.IVideoExportOrchestrator).to(VideoExportOrchestrator);
    options.bind(TYPES.ICompositeVideoRenderer).to(CompositeVideoRenderer);

    // === TRAIL SERVICES ===
    options.bind(TYPES.ITrailCapturer).to(TrailCapturer);

    // === MODE-SPECIFIC SERVICES ===
    // ISequenceNormalizer moved to data.module.ts (Tier 1) - required by ISequenceRepository
    options
      .bind(TYPES.ITunnelModeSequenceManager)
      .to(TunnelModeSequenceManager);

    // === ANIMATION STORAGE ===
    options.bind(TYPES.IAnimationStorageManager).to(AnimationStorageManager);

    // === STATE PROVIDERS ===
    options.bind(TYPES.IDarkModeProvider).to(DarkModeProvider);

    // ============================================================================
    // ARCHIVED BINDINGS (services moved to archive/animator-unused-services/)
    // ============================================================================
    // options.bind(TYPES.IAnimationControlService).to(AnimationControlService);
    // options.bind(TYPES.IMotionParameterService).to(MotionParameterService);
    // options.bind(TYPES.IMotionLetterIdentificationService).to(MotionLetterIdentificationService);
    // options.bind(TYPES.IOverlayRenderer).to(OverlayRenderer);
    // options.bind(TYPES.ISvgConfig).to(SvgConfig);
    // options.bind(TYPES.ISvgUtilityService).to(SvgUtilityService);
  }
);

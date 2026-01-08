import type { ContainerModuleLoadOptions } from "inversify";
import { ContainerModule } from "inversify";
import { createSafeBinder } from "../hmr/safeBind";
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
import { SequenceMotionLoader } from "../../sequence-viewer/services/implementations/SequenceMotionLoader";
import { TYPES } from "../types";

export const animatorModule = new ContainerModule(
  (options: ContainerModuleLoadOptions) => {
    // Use safe binder to prevent duplicate bindings during HMR
    const bind = createSafeBinder(options);

    // === CORE ANIMATION SERVICES ===
    bind(TYPES.IAnimator).to(Animator);
    bind(TYPES.IAnimationLoop).to(AnimationLoop);
    bind(TYPES.IAnimationPlaybackController)
      .to(AnimationPlaybackController);
    bind(TYPES.ISequenceAnimationOrchestrator)
      .to(SequenceAnimationOrchestrator);
    bind(TYPES.IAnimationStateService).to(AnimationStateService);
    bind(TYPES.IBeatCalculationService).to(BeatCalculationService);
    bind(TYPES.IPropInterpolationService).to(PropInterpolationService);
    bind(TYPES.ISequenceLoopabilityChecker)
      .to(SequenceLoopabilityChecker);

    // === CALCULATION SERVICES ===
    bind(TYPES.IAngleCalculator).to(AngleCalculator);
    bind(TYPES.ICoordinateUpdater).to(CoordinateUpdater);
    bind(TYPES.IMotionCalculator).to(MotionCalculator);
    bind(TYPES.IEndpointCalculator).to(EndpointCalculator);

    // === RENDERING SERVICES ===
    bind(TYPES.ICanvasRenderer).to(CanvasRenderer);
    // IAnimationRenderer loaded on-demand via animation module when animation canvas is used
    bind(TYPES.ISVGGenerator).to(SVGGenerator);
    bind(TYPES.IVideoExporter).to(VideoExporter);
    bind(TYPES.IVideoExportOrchestrator).to(VideoExportOrchestrator);
    bind(TYPES.ICompositeVideoRenderer).to(CompositeVideoRenderer);

    // === TRAIL SERVICES ===
    bind(TYPES.ITrailCapturer).to(TrailCapturer);

    // === MODE-SPECIFIC SERVICES ===
    // ISequenceNormalizer moved to data.module.ts (Tier 1) - required by ISequenceRepository
    bind(TYPES.ITunnelModeSequenceManager)
      .to(TunnelModeSequenceManager);

    // === ANIMATION STORAGE ===
    bind(TYPES.IAnimationStorageManager).to(AnimationStorageManager);

    // === STATE PROVIDERS ===
    bind(TYPES.IDarkModeProvider).to(DarkModeProvider);

    // === DATA LOADING ===
    bind(TYPES.ISequenceMotionLoader).to(SequenceMotionLoader);

    // ============================================================================
    // ARCHIVED BINDINGS (services moved to archive/animator-unused-services/)
    // ============================================================================
    // bind(TYPES.IAnimationControlService).to(AnimationControlService);
    // bind(TYPES.IMotionParameterService).to(MotionParameterService);
    // bind(TYPES.IMotionLetterIdentificationService).to(MotionLetterIdentificationService);
    // bind(TYPES.IOverlayRenderer).to(OverlayRenderer);
    // bind(TYPES.ISvgConfig).to(SvgConfig);
    // bind(TYPES.ISvgUtilityService).to(SvgUtilityService);
  }
);

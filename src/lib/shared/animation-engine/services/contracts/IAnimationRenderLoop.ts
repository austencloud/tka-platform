/**
 * Animation Render Loop Interface
 *
 * Manages the requestAnimationFrame render loop for AnimatorCanvas.
 * Handles RAF scheduling, trail point gathering, and scene rendering.
 */

import type { IAnimationRenderer } from "$lib/features/compose/services/contracts/IAnimationRenderer";
import type { ITrailCapturer, AdditionalLayerProps } from "$lib/features/compose/services/contracts/ITrailCapturer";
import type { TrailSettings } from "../../domain/types/TrailTypes";
import type { PropState } from "$lib/shared/animation-engine/domain/PropState";
import type { AnimationPathCache } from "$lib/features/compose/services/implementations/AnimationPathCache";
import type { IFrameBudgetMonitor } from "./IFrameBudgetMonitor";
import type { IFireOverlayRenderer } from "./IFireOverlayRenderer";
import type { ICharcoalRenderer } from "./ICharcoalRenderer";
import type { IFireTipTracker } from "./IFireTipTracker";
import type { FireOverlayConfig, PropFlameColor } from "../../domain/types/FireTypes";
import type { ILedOverlayRenderer } from "./ILedOverlayRenderer";
import type { ILedTipTracker } from "./ILedTipTracker";
import type { ITrailOverlayCanvas } from "./ITrailOverlayCanvas";
import type { IZapOverlayRenderer } from "./IZapOverlayRenderer";
import type { LedOverlayConfig } from "../../domain/types/LedTypes";
import type { Zap2DParams } from "$lib/shared/effects/translators/canvas2d-types";
import type { GridMode } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
import type { Letter } from "$lib/shared/foundation/domain/models/Letter";
import type { StepData } from "$lib/features/create/shared/domain/models/StepData";
import type { StartPositionData } from "$lib/features/create/shared/domain/models/StartPositionData";
import type { TipEffectMap } from "../../domain/types/TipEffectTypes";

/**
 * Configuration for render loop initialization
 */
export interface RenderLoopConfig {
  renderer: IAnimationRenderer;
  TrailCapturer: ITrailCapturer | null;
  pathCache: AnimationPathCache | null;
  canvasSize: number;
  frameBudgetMonitor?: IFrameBudgetMonitor | null;
  /** Optional fire overlay renderer (WebGL fluid simulation on top of Canvas2D) */
  fireRenderer?: IFireOverlayRenderer | null;
  /** Optional charcoal overlay renderer (WebGL2 point-sprite particles) */
  charcoalRenderer?: ICharcoalRenderer | null;
  /** Optional fire/charcoal tip position/velocity tracker (shared by both) */
  fireTipTracker?: IFireTipTracker | null;
  /** Optional LED overlay renderer (WebGL layer on top of fire) */
  ledRenderer?: ILedOverlayRenderer | null;
  /** Optional LED tip position/color tracker */
  ledTipTracker?: ILedTipTracker | null;
  /** Trail overlay canvas for persistent cross-sequence trails */
  trailOverlay?: ITrailOverlayCanvas | null;
  /** Optional zap (lightning) overlay renderer that draws procedural arcs between prop tips */
  zapRenderer?: IZapOverlayRenderer | null;
  /** Called when an effect (fire/charcoal/LED) fails repeatedly and is auto-disabled */
  onEffectError?: (effectName: string, error: Error) => void;
}

/**
 * Prop dimensions for rendering
 */
export interface PropDimensions {
  width: number;
  height: number;
}

/**
 * Visibility settings for render
 */
export interface RenderVisibilitySettings {
  gridVisible: boolean;
  propsVisible: boolean;
  trailsVisible: boolean;
  blueMotionVisible: boolean;
  redMotionVisible: boolean;
}

/**
 * Props state for rendering
 */
export interface RenderPropsState {
  blueProp: PropState | null;
  redProp: PropState | null;
  /** Additional tunnel layers (index 0 = layer 1, up to 3) */
  additionalLayers: AdditionalLayerProps[];
  bluePropDimensions: PropDimensions;
  redPropDimensions: PropDimensions;
}

/**
 * Parameters for a single render frame
 */
export interface RenderFrameParams {
  stepData: StartPositionData | StepData | null;
  currentStep: number;
  trailSettings: TrailSettings;
  gridVisible: boolean;
  gridMode: GridMode | null;
  letter: Letter | null;
  props: RenderPropsState;
  visibility: RenderVisibilitySettings;
  /** Whether animation playback is active (controls render loop continuation) */
  isPlaying: boolean;
  /** Prop flip settings (for asymmetric props like Buugeng) */
  bluePropFlipped?: boolean;
  redPropFlipped?: boolean;
  /** Prop types - used for prop-specific rendering rules (e.g., hands never rotate) */
  bluePropType?: string;
  redPropType?: string;
  /** Fire overlay configuration (null or undefined = disabled) */
  fireConfig?: FireOverlayConfig | null;
  /** Whether dark mode is active (used by fire renderer for intensity boost) */
  darkMode?: boolean;
  /** Prop colors for colored flames: [leftPropColor, rightPropColor] */
  propColors?: [PropFlameColor, PropFlameColor];
  /** LED overlay configuration (null or undefined = disabled) */
  ledConfig?: LedOverlayConfig | null;
  /** Zap (lightning) overlay parameters (null or undefined = disabled) */
  zapConfig?: Zap2DParams | null;
  /** Playback speed multiplier (1.0 = 60 BPM). Passed to fire for cache invalidation. */
  playbackSpeed?: number;
  /** Whether sequence loops seamlessly (end position = start position).
   *  When true, trail rendering wraps around the loop boundary instead of resetting. */
  isSeamlesslyLoopable?: boolean;
  /** Changes when the sequence content changes. Invalidates fire cache. */
  sequenceContentHash?: string;
  /** Per-tip effect assignments (global level). Used to filter tips by effect type. */
  tipEffectMap?: TipEffectMap;
  /** When true, skip fire/charcoal/LED/trail overlay rendering (3D mode handles effects) */
  suppress2DOverlays?: boolean;
}

/**
 * Service for managing the animation render loop
 */
export interface IAnimationRenderLoop {
  /**
   * Initialize the render loop with required dependencies
   */
  initialize(config: RenderLoopConfig): void;

  /**
   * Update configuration (e.g., canvas resized, path cache changed)
   */
  updateConfig(config: Partial<RenderLoopConfig>): void;

  /**
   * Start the render loop
   * @param getFrameParams - Callback to get current frame parameters
   */
  start(getFrameParams: () => RenderFrameParams): void;

  /**
   * Stop the render loop
   */
  stop(): void;

  /**
   * Check if the loop is currently running
   */
  isRunning(): boolean;

  /**
   * Trigger a single render frame
   * @param params - Frame parameters
   */
  renderFrame(params: RenderFrameParams): void;

  /**
   * Mark that a render is needed and ensure loop is running
   * @param getFrameParams - Callback to get current frame parameters
   */
  triggerRender(getFrameParams: () => RenderFrameParams): void;

  /**
   * Set a target FPS for preview throttling.
   * null = no throttling (render at native refresh rate).
   * When set, frames are skipped to approximate the target rate.
   */
  setTargetFps(fps: number | null): void;

  /**
   * Snapshot of render loop state for diagnostic reports.
   */
  getDiagnostics(): Record<string, unknown>;

  /**
   * Clean up resources
   */
  dispose(): void;
}

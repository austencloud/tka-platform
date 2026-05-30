/**
 * Animation Render Loop Interface
 *
 * Manages the requestAnimationFrame render loop for AnimatorCanvas.
 * Handles RAF scheduling, trail point gathering, and scene rendering.
 */

import type { IAnimationRenderer } from "$lib/shared/animation-engine/services/IAnimationRenderer";
import type { ITrailCapturer, AdditionalLayerProps } from "$lib/shared/animation-engine/services/ITrailCapturer";
import type { TrailSettings } from "../domain/types/TrailTypes";
import type { PropState } from "$lib/shared/foundation/domain/types/PropState";
import type { AnimationPathCache } from "$lib/shared/animation-engine/services/animation-path-cache";
import type { FrameBudgetMonitor } from '$lib/shared/animation-engine/services/frame-budget-monitor'
import type { FireTipTracker } from "./fire-tip-tracker";
import type { FireOverlayConfig, PropFlameColor } from "../domain/types/FireTypes";
import type { LedTipTracker } from "./led-tip-tracker";
import type { LedOverlayConfig } from "../domain/types/LedTypes";
import type { Bloom2DParams, Bubbles2DParams, Echo2DParams, Frost2DParams, Ink2DParams, Petals2DParams, Pulse2DParams, Silk2DParams, Smoke2DParams, Sparkles2DParams, Water2DParams, Zap2DParams } from "$lib/shared/effects/translators/canvas2d-types";
import type { GridMode } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
import type { Letter } from "$lib/shared/foundation/domain/models/Letter";
import type { StepData } from "$lib/shared/foundation/domain/models/StepData";
import type { StartPositionData } from "$lib/shared/foundation/domain/models/StartPositionData";
import type { EffectType, TipEffectMap } from "../domain/types/TipEffectTypes";
import type { EffectRendererLike } from "./effects/EffectRenderer";

/**
 * Configuration for render loop initialization
 */
export interface RenderLoopConfig {
  renderer: IAnimationRenderer;
  TrailCapturer: ITrailCapturer | null;
  pathCache: AnimationPathCache | null;
  canvasSize: number;
  frameBudgetMonitor?: FrameBudgetMonitor | null;
  /** Optional fire/charcoal tip position/velocity tracker (shared by both) */
  fireTipTracker?: FireTipTracker | null;
  /** Optional LED tip position/color tracker */
  ledTipTracker?: LedTipTracker | null;
  /**
   * Registry-driven renderer map. Every effect renderer (fire, charcoal, led,
   * trails, zap, sparkles, …) lives here, keyed by EffectType id.
   * Replaces the 15 hand-typed xRenderer? fields from P2.3 and earlier.
   * null values signal removal (the render loop deletes the entry from its Map).
   */
  renderers?: Partial<Record<EffectType, EffectRendererLike | null>>;
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
  /** Sparkles overlay parameters (null or undefined = disabled) */
  sparklesConfig?: Sparkles2DParams | null;
  /** Echo overlay parameters (null or undefined = disabled) */
  echoConfig?: Echo2DParams | null;
  /** Bloom overlay parameters (null or undefined = disabled) */
  bloomConfig?: Bloom2DParams | null;
  /** Water overlay parameters (null or undefined = disabled) */
  waterConfig?: Water2DParams | null;
  /** Bubbles overlay parameters (null or undefined = disabled) */
  bubblesConfig?: Bubbles2DParams | null;
  /** Petals overlay parameters (null or undefined = disabled) */
  petalsConfig?: Petals2DParams | null;
  /** Smoke overlay parameters (null or undefined = disabled) */
  smokeConfig?: Smoke2DParams | null;
  /** Ink overlay parameters (null or undefined = disabled) */
  inkConfig?: Ink2DParams | null;
  /** Frost overlay parameters (null or undefined = disabled) */
  frostConfig?: Frost2DParams | null;
  /** Silk overlay parameters (null or undefined = disabled) */
  silkConfig?: Silk2DParams | null;
  /** Pulse overlay parameters (null or undefined = disabled) */
  pulseConfig?: Pulse2DParams | null;
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
  /** Virtual time for this frame (in ms). Used during video export to ensure
   * deterministic trail capture and effect timing regardless of real-time
   * rendering performance. When provided, replaces performance.now(). */
  virtualTime?: number;
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

  /** Render ONE frame synchronously, now, with an explicit sim dt (seconds).
   *  Bypasses rAF/needsRender scheduling — used by the offscreen export path so
   *  rendering is deterministic. The free-running loop is never started. */
  renderSync(params: RenderFrameParams, timeMs: number, dtSeconds: number): void;

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

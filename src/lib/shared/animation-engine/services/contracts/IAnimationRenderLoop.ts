/**
 * Animation Render Loop Interface
 *
 * Manages the requestAnimationFrame render loop for AnimatorCanvas.
 * Handles RAF scheduling, trail point gathering, and scene rendering.
 */

import type { IAnimationRenderer } from "$lib/features/compose/services/contracts/IAnimationRenderer";
import type { ITrailCapturer } from "$lib/features/compose/services/contracts/ITrailCapturer";
import type { TrailSettings } from "../../domain/types/TrailTypes";
import type { PropState } from "$lib/shared/animation-engine/domain/PropState";
import type { AnimationPathCache } from "$lib/features/compose/services/implementations/AnimationPathCache";
import type { GridMode } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
import type { Letter } from "$lib/shared/foundation/domain/models/Letter";
import type { BeatData } from "$lib/features/create/shared/domain/models/BeatData";
import type { StartPositionData } from "$lib/features/create/shared/domain/models/StartPositionData";

/**
 * Configuration for render loop initialization
 */
export interface RenderLoopConfig {
  renderer: IAnimationRenderer;
  TrailCapturer: ITrailCapturer | null;
  pathCache: AnimationPathCache | null;
  canvasSize: number;
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
  secondaryBlueProp: PropState | null;
  secondaryRedProp: PropState | null;
  bluePropDimensions: PropDimensions;
  redPropDimensions: PropDimensions;
}

/**
 * Parameters for a single render frame
 */
export interface RenderFrameParams {
  beatData: StartPositionData | BeatData | null;
  currentBeat: number;
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
   * Clean up resources
   */
  dispose(): void;
}

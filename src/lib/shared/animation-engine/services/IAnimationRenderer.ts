/**
 * Animation Renderer Service Contract
 *
 * Canvas2D-based rendering for the animation module.
 * Replaces PixiJS WebGL rendering with simpler, leak-free Canvas2D.
 */

import type { RenderedPropTransform } from "$lib/shared/animation-engine/domain/types/fire-types";
import type { RenderSceneParams } from "$lib/shared/animation-engine/domain/types/animation-render-types";

export type {
  AdditionalLayerRenderData,
  AnimationVisibilitySettings,
  RenderSceneParams,
} from "$lib/shared/animation-engine/domain/types/animation-render-types";

export interface IAnimationRenderer {
  /**
   * Initialize the renderer and attach canvas to container
   * @param container - DOM element to attach the canvas to
   * @param size - Initial canvas size
   * @param backgroundAlpha - Alpha value for canvas background (0 = transparent, 1 = opaque)
   * @param paintBackground - When false, the canvas itself stays transparent (background
   *   comes from the parent element) so overlays can render behind the main canvas.
   *   Defaults to true so export/offscreen renderers still burn in their own background.
   */
  initialize(
    container: HTMLElement,
    size: number,
    backgroundAlpha?: number,
    paintBackground?: boolean
  ): Promise<void>;

  /**
   * Resize the renderer
   * @param newSize - New canvas size
   */
  resize(newSize: number): Promise<void>;

  /**
   * Render the complete animation scene
   */
  renderScene(params: RenderSceneParams): void;

  /**
   * Get the prop transforms computed during the last renderScene() call.
   * Used by fire overlay to avoid recomputing prop positions independently.
   */
  getLastPropTransforms(): { blue: RenderedPropTransform | null; red: RenderedPropTransform | null };

  /**
   * Get the current prop sprite images, so the echo overlay can onion-skin
   * (ghost) the real prop graphic at past poses instead of drawing a stick line.
   * Optional — only the Canvas2D renderer provides it.
   */
  getPropImages?(): { blue: HTMLImageElement | null; red: HTMLImageElement | null };

  /**
   * Load prop images for a specific prop type
   * @param propType - Type of prop (e.g., "staff", "club", "fan")
   */
  loadPropTextures(propType: string): Promise<void>;

  /**
   * Start the blue-hand prop morph crossfade (previous sprite fades out, new
   * sprite fades in, at the identical transform). Call only from a genuine
   * prop-type hot-swap, after loadPerColorPropTextures has resolved — never
   * on the initial load or a dark-mode-only reload. No-op if there is no
   * previous sprite to fade from.
   */
  startBluePropMorphFade(): void;

  /** Red-hand counterpart of startBluePropMorphFade — independent so one hand
   *  can morph while the other holds steady. */
  startRedPropMorphFade(): void;

  /**
   * Load different prop types for blue and red props
   * @param bluePropType - Type of prop for blue hand
   * @param redPropType - Type of prop for red hand
   * @param darkMode - When provided, uses this instead of global dark mode state (for preview isolation)
   */
  loadPerColorPropTextures(
    bluePropType: string,
    redPropType: string,
    darkMode?: boolean
  ): Promise<void>;

  /**
   * Load prop images for an additional tunnel layer with per-hand prop types +
   * custom colors. Blue and red carry independent prop types so each performer
   * (Performer Set) can wear a different prop per hand.
   * @param layerIndex - Additional layer index (0 = first additional layer)
   * @param bluePropType - Type of the blue-hand prop
   * @param redPropType - Type of the red-hand prop
   * @param blueColor - Hex color for the blue prop
   * @param redColor - Hex color for the red prop
   */
  loadAdditionalLayerPropTextures(
    layerIndex: number,
    bluePropType: string,
    redPropType: string,
    blueColor: string,
    redColor: string
  ): Promise<void>;

  /**
   * Load grid image for a specific grid mode
   * @param gridMode - Grid mode (e.g., "diamond", "box")
   */
  loadGridTexture(gridMode: string, showNonRadialPoints?: boolean): Promise<void>;

  /**
   * Load glyph image for rendering letter + turns
   * @param svgString - SVG string of the complete glyph
   * @param width - SVG width
   * @param height - SVG height
   */
  loadGlyphTexture(
    svgString: string,
    width: number,
    height: number
  ): Promise<void>;

  /**
   * Capture current frame as ImageBitmap
   * Used for pre-rendering sequences to frames
   */
  captureFrame(): Promise<ImageBitmap>;

  /**
   * Destroy the renderer and clean up resources
   */
  destroy(): void;

  /**
   * Get the canvas element
   */
  getCanvas(): HTMLCanvasElement | null;

  /**
   * Set Dark Mode for dark background
   * @param enabled - Whether Dark Mode is enabled
   * @param animate - Whether to animate the transition (default: true)
   */
  setDarkMode(enabled: boolean, animate?: boolean): void;

  /**
   * Check if background is currently transitioning
   * Used by render loop to continue rendering during smooth transitions
   */
  isBackgroundTransitioning(): boolean;

  /**
   * Get the dimensions of the currently loaded blue prop
   * Returns { width: 0, height: 0 } if no prop is loaded
   */
  getBluePropDimensions(): { width: number; height: number };

  /**
   * Get the dimensions of the currently loaded red prop
   * Returns { width: 0, height: 0 } if no prop is loaded
   */
  getRedPropDimensions(): { width: number; height: number };
}

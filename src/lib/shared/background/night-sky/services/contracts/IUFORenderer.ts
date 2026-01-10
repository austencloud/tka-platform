/**
 * IUFORenderer - Renders the UFO's visual components
 *
 * Handles all drawing operations for the UFO hull, dome, shield, beam, lights, and engine glow.
 * Pure rendering with no state mutation.
 */

import type { AccessibilitySettings } from "../../../shared/domain/models/background-models";
import type { UFOConfig, UFORenderState, WobbleOffset, MoodVisuals } from "../domain/ufo-types";

export interface IUFORenderer {
  /**
   * Draw the complete UFO with all visual layers
   */
  draw(
    ctx: CanvasRenderingContext2D,
    ufo: UFORenderState,
    config: UFOConfig,
    a11y: AccessibilitySettings,
    moodVisuals: MoodVisuals,
    wobble: WobbleOffset
  ): void;

  /**
   * Draw warp flash effect (bright glow during warp in/out)
   */
  drawWarpFlash(
    ctx: CanvasRenderingContext2D,
    ufo: UFORenderState,
    drawY: number
  ): void;

  /**
   * Draw the tractor beam
   */
  drawBeam(
    ctx: CanvasRenderingContext2D,
    ufo: UFORenderState,
    config: UFOConfig,
    drawY: number
  ): void;

  /**
   * Draw the shield glow
   */
  drawShield(
    ctx: CanvasRenderingContext2D,
    ufo: UFORenderState,
    config: UFOConfig,
    drawY: number,
    moodVisuals: MoodVisuals
  ): void;

  /**
   * Draw the hull (saucer body)
   */
  drawHull(
    ctx: CanvasRenderingContext2D,
    ufo: UFORenderState,
    config: UFOConfig,
    drawY: number,
    a11y: AccessibilitySettings
  ): void;

  /**
   * Draw the glass dome
   */
  drawDome(
    ctx: CanvasRenderingContext2D,
    ufo: UFORenderState,
    config: UFOConfig,
    drawY: number
  ): void;

  /**
   * Draw the rim lights
   */
  drawLights(
    ctx: CanvasRenderingContext2D,
    ufo: UFORenderState,
    config: UFOConfig,
    drawY: number
  ): void;

  /**
   * Draw the engine glow underneath
   */
  drawEngineGlow(
    ctx: CanvasRenderingContext2D,
    ufo: UFORenderState,
    config: UFOConfig,
    drawY: number
  ): void;
}

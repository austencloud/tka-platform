/**
 * IUFOParticleRenderer - Renders UFO narrative particle effects
 *
 * Handles all particle and effect rendering for UFO behaviors:
 * sample particles, camera flashes, ground dust, afterimages,
 * sleep Zs, celebration effects, and communication pulses.
 */

import type { UFOConfig, UFORenderState, Particle } from "../domain/ufo-types";

export interface IUFOParticleRenderer {
  /**
   * Draw all narrative arc visual effects
   */
  drawNarrativeEffects(
    ctx: CanvasRenderingContext2D,
    ufo: UFORenderState,
    config: UFOConfig
  ): void;

  /**
   * Draw sample particle (golden orb traveling up beam)
   */
  drawSampleParticle(
    ctx: CanvasRenderingContext2D,
    particle: Particle
  ): void;

  /**
   * Draw camera flash effect (brief white burst)
   */
  drawCameraFlash(
    ctx: CanvasRenderingContext2D,
    ufo: UFORenderState
  ): void;

  /**
   * Draw ground investigation particles (dust rising)
   */
  drawGroundParticles(
    ctx: CanvasRenderingContext2D,
    particles: Particle[]
  ): void;

  /**
   * Draw panic afterimages (motion blur effect)
   */
  drawAfterimages(
    ctx: CanvasRenderingContext2D,
    ufo: UFORenderState,
    shieldColor: string
  ): void;

  /**
   * Draw floating sleep Zs
   */
  drawSleepZs(
    ctx: CanvasRenderingContext2D,
    zs: Particle[]
  ): void;

  /**
   * Draw celebration effects (rainbow lights, sparkles)
   */
  drawCelebrationEffects(
    ctx: CanvasRenderingContext2D,
    ufo: UFORenderState
  ): void;

  /**
   * Draw communication pulses traveling to target star
   */
  drawCommunicationPulses(
    ctx: CanvasRenderingContext2D,
    ufo: UFORenderState
  ): void;
}

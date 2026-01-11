/**
 * UFOMovementController - Handles UFO movement and wandering logic
 *
 * Extracted from UFOSystem - handles all the complex movement behaviors:
 * - Curved wandering paths with turn rate variation
 * - Edge avoidance with smooth steering
 * - Click target navigation
 * - Celestial event detection and reaction
 * - Idle behaviors (look around, yawn)
 */

import type {
  IUFOMovementController,
  MovementContext,
  MovementResult,
} from "../contracts/IUFOMovementController";
import type { UFO, UFOConfig, EventPosition, WobbleType } from "../domain/ufo-types";

export class UFOMovementController implements IUFOMovementController {
  updateWandering(ctx: MovementContext): MovementResult {
    const { ufo: u, config, dimensions: dim, speedMult, moodManager, eventProvider } = ctx;

    // Check if we're heading toward a click target
    if (u.clickTarget) {
      const dx = u.clickTarget.x - u.x;
      const dy = u.clickTarget.y - u.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < 30) {
        return { action: "arrived_at_target" };
      }

      // Steer toward click target
      const targetAngle = Math.atan2(dy, dx);
      const angleDelta = this.angleDiff(u.heading, targetAngle);
      u.heading += angleDelta * 0.1 * speedMult;
    } else {
      // Normal wandering - smoothly update heading for curved movement
      this.updateHeading(u, config, speedMult);
    }

    // Calculate and apply movement
    this.applyMovement(u, config, dim, speedMult);

    // Apply edge avoidance
    this.applyEdgeAvoidance(u, dim, config, speedMult);

    // Check for celestial events
    const eventResult = this.checkCelestialEvents(ctx);
    if (eventResult) return eventResult;

    // Check for random pause
    if (Math.random() < config.pauseChance * speedMult) {
      return { action: "start_pause" };
    }

    // Idle behaviors
    this.updateIdleBehaviors(u, moodManager, speedMult);

    return { action: "continue" };
  }

  reactToNearMiss(ctx: MovementContext, event: EventPosition): void {
    const { ufo: u, moodManager } = ctx;

    // Calculate dodge direction (opposite to event)
    const dx = u.x - event.x;
    const dy = u.y - event.y;
    const dodgeAngle = Math.atan2(dy, dx);

    // Jolt away
    u.heading = dodgeAngle;
    u.x += Math.cos(dodgeAngle) * 15;
    u.y += Math.sin(dodgeAngle) * 15;

    // Startled reactions
    moodManager.triggerWobble(u, "startled_jolt");
    moodManager.setMood(u, "startled");

    // Quick flash of lights
    u.lightPhase += Math.PI;
  }

  resetWanderingState(ufo: UFO, config: UFOConfig): void {
    ufo.state = "wandering";
    ufo.stateTimer = 0;

    const turnSpeed = config.turnSpeed ?? 0.003;
    const turnVariation = config.turnVariation ?? 0.5;
    ufo.turnRate = (Math.random() - 0.5) * 2 * turnSpeed * turnVariation;

    const driftChance = config.driftChance ?? 0.15;
    ufo.isDrifting = Math.random() < driftChance;
  }

  angleDiff(from: number, to: number): number {
    let diff = to - from;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    return diff;
  }

  private updateHeading(u: UFO, config: UFOConfig, speedMult: number): void {
    const turnSpeed = config.turnSpeed ?? 0.003;
    u.heading += u.turnRate * speedMult;

    // Occasionally vary the turn rate for more organic curves
    if (Math.random() < 0.02 * speedMult) {
      const turnVariation = config.turnVariation ?? 0.5;
      u.turnRate = (Math.random() - 0.5) * 2 * turnSpeed * turnVariation;

      // Small chance to switch drift mode
      if (Math.random() < 0.15) {
        u.isDrifting = !u.isDrifting;
      }
    }
  }

  private applyMovement(
    u: UFO,
    config: UFOConfig,
    dim: { width: number },
    speedMult: number
  ): void {
    const driftMult = config.driftSpeedMultiplier ?? 0.4;
    const investigateMult = u.clickTarget ? 1.3 : 1.0;
    const speedMod = u.isDrifting ? driftMult : investigateMult;
    const speed = config.speed * dim.width * speedMult * speedMod;

    u.x += Math.cos(u.heading) * speed;
    u.y += Math.sin(u.heading) * speed;
  }

  private applyEdgeAvoidance(
    u: UFO,
    dim: { width: number; height: number },
    config: UFOConfig,
    speedMult: number
  ): void {
    const margin = dim.width * config.bounceMargin;
    const steerStrength = 0.05;

    // Horizontal edges
    if (u.x < margin) {
      u.heading += steerStrength * speedMult;
      u.x = Math.max(margin * 0.5, u.x);
    } else if (u.x > dim.width - margin) {
      u.heading -= steerStrength * speedMult;
      u.x = Math.min(dim.width - margin * 0.5, u.x);
    }

    // Vertical edges
    if (u.y < margin) {
      const targetAngle = Math.PI / 2;
      const diff = this.angleDiff(u.heading, targetAngle);
      u.heading += diff * steerStrength * speedMult;
      u.y = Math.max(margin * 0.5, u.y);
    } else if (u.y > dim.height - margin) {
      const targetAngle = -Math.PI / 2;
      const diff = this.angleDiff(u.heading, targetAngle);
      u.heading += diff * steerStrength * speedMult;
      u.y = Math.min(dim.height - margin * 0.5, u.y);
    }
  }

  private checkCelestialEvents(ctx: MovementContext): MovementResult | null {
    const { ufo: u, eventProvider } = ctx;
    const event = eventProvider?.();

    if (!event?.active) return null;

    // Check for near-miss
    const dx = event.x - u.x;
    const dy = event.y - u.y;
    const eventDist = Math.sqrt(dx * dx + dy * dy);

    if (eventDist < 50) {
      this.reactToNearMiss(ctx, event);
      return { action: "near_miss_handled" };
    }

    // Decide whether to chase or just watch based on mood
    if (u.mood === "curious" || u.mood === "excited" || u.mood === "playful") {
      return { action: "start_chasing", event };
    } else if (u.mood === "bored" || u.mood === "tired") {
      return { action: "start_tracking", event };
    }

    return null;
  }

  private updateIdleBehaviors(
    u: UFO,
    moodManager: { triggerWobble: (ufo: UFO, type: WobbleType) => void },
    speedMult: number
  ): void {
    // Look around occasionally
    if (u.lookAroundTimer <= 0 && Math.random() < 0.003 * speedMult) {
      moodManager.triggerWobble(u, "curious_tilt");
      u.lookAroundTimer = 180;
    }

    // Yawn when bored
    if (u.mood === "bored" && Math.random() < 0.002 * speedMult) {
      moodManager.triggerWobble(u, "yawn_stretch");
    }
  }
}

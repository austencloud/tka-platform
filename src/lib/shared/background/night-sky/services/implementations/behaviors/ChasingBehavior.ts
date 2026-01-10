/**
 * ChasingBehavior - UFO pursues celestial events (meteors, comets)
 *
 * Phases: Direct pursuit with beam tracking, gives up if target escapes
 */

import type { IUFOBehavior } from "../../contracts/IUFOBehavior";
import type { BehaviorContext } from "../../contracts/IUFOBehaviorRunner";
import type { UFOState, EventPosition } from "../../domain/ufo-types";

export class ChasingBehavior implements IUFOBehavior {
  readonly state: UFOState = "chasing";

  start(ctx: BehaviorContext, event: EventPosition): void {
    const u = ctx.ufo;

    u.state = "chasing";
    u.stateTimer = 0;
    u.chaseStartTime = u.totalTime;
    u.lastChaseDistance = Infinity;

    // Remember chase target with velocity for prediction
    u.chaseTarget = {
      x: event.x,
      y: event.y,
      vx: event.vx ?? 0,
      vy: event.vy ?? 0,
    };

    // Point beam at target
    u.beamTarget = { x: event.x, y: event.y };
    u.beamIntensity = 0;

    // Turn toward target
    const dx = event.x - u.x;
    const dy = event.y - u.y;
    u.heading = Math.atan2(dy, dx);

    // Cancel drifting - we have a mission!
    u.isDrifting = false;

    ctx.moodManager.markInterest(u);
  }

  update(ctx: BehaviorContext): void {
    const { ufo: u, config, dimensions, speedMult, moodManager, callbacks } = ctx;

    // Get current event position
    const event = ctx.eventProvider?.();

    // If event ended or no chase target, give up
    if (!event?.active || !u.chaseTarget) {
      callbacks.startGivingUp();
      return;
    }

    // Update chase target position
    u.chaseTarget = {
      x: event.x,
      y: event.y,
      vx: event.vx ?? u.chaseTarget.vx,
      vy: event.vy ?? u.chaseTarget.vy,
    };

    // Track with beam
    u.beamTarget = { x: event.x, y: event.y };
    if (u.beamIntensity < 1) {
      u.beamIntensity = Math.min(
        1,
        u.beamIntensity + speedMult / config.beamChargeFrames
      );
    }
    u.beamPhase += 0.05 * speedMult;

    // Calculate distance and direction to target
    const dx = event.x - u.x;
    const dy = event.y - u.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    const targetAngle = Math.atan2(dy, dx);

    // Steer toward target
    const angleDiff = callbacks.angleDiff(u.heading, targetAngle);
    u.heading += angleDiff * 0.15 * speedMult; // Aggressive steering

    // Move faster when chasing (2x normal speed)
    const chaseSpeed = config.speed * dimensions.width * speedMult * 2.0;
    u.x += Math.cos(u.heading) * chaseSpeed;
    u.y += Math.sin(u.heading) * chaseSpeed;

    // Check if we're catching up or falling behind
    const catchingUp = distance < u.lastChaseDistance;
    u.lastChaseDistance = distance;

    // If very close, we caught up - excited!
    if (distance < 80) {
      moodManager.setMood(u, "excited");
      // Do a quick happy light pulse
      u.lightPhase += Math.PI;
      // Continue flying alongside briefly, then return to wandering
      if (u.stateTimer > 120) {
        callbacks.resumeWandering();
      }
      return;
    }

    // Check for giving up conditions
    const chaseTime = u.totalTime - u.chaseStartTime;

    // Give up if chasing too long and falling behind
    if (chaseTime > 300 && !catchingUp) {
      callbacks.startGivingUp();
      return;
    }

    // Extra condition: way too far away
    if (distance > dimensions.width * 0.6) {
      callbacks.startGivingUp();
    }
  }
}

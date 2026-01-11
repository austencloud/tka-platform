/**
 * FollowingBehavior - UFO follows alongside another celestial object
 *
 * Phases: approach → action (flying alongside) → resolution (peel away) → transition
 */

import type { IUFOBehavior } from "../../contracts/IUFOBehavior";
import type { BehaviorContext } from "../../contracts/IUFOBehaviorRunner";
import type { UFOState, EventPosition } from "../../domain/ufo-types";

export class FollowingBehavior implements IUFOBehavior {
  readonly state: UFOState = "following";

  start(ctx: BehaviorContext, event: EventPosition): void {
    const u = ctx.ufo;

    u.state = "following";
    u.stateTimer = 0;
    u.narrativePhase = "approach";
    u.narrativeTimer = 0;
    u.targetZ = 0.2; // Fly alongside, close
    u.buddyTarget = {
      x: event.x,
      y: event.y,
      vx: event.vx ?? 0,
      vy: event.vy ?? 0,
    };
    u.buddyOffset = 50 + Math.random() * 30;
    ctx.moodManager.markInterest(u);
  }

  update(ctx: BehaviorContext): void {
    const { ufo: u, moodManager, callbacks } = ctx;

    u.narrativeTimer += ctx.speedMult;

    // Check if buddy is still around
    const event = ctx.eventProvider?.();
    if (!event?.active) {
      moodManager.triggerWobble(u, "curious_tilt");
      moodManager.setMood(u, "bored");
      u.buddyTarget = null;
      u.narrativePhase = "none";
      callbacks.resumeWandering();
      return;
    }

    // Update buddy position
    u.buddyTarget = {
      x: event.x,
      y: event.y,
      vx: event.vx ?? 0,
      vy: event.vy ?? 0,
    };

    switch (u.narrativePhase) {
      case "approach":
        this.updateApproach(ctx, event);
        break;
      case "action":
        this.updateAction(ctx, event);
        break;
      case "resolution":
        this.updateResolution(ctx);
        break;
      case "transition":
        this.updateTransition(ctx);
        break;
      default:
        callbacks.resumeWandering();
    }
  }

  private updateApproach(ctx: BehaviorContext, event: EventPosition): void {
    const { ufo: u, config, dimensions, speedMult, moodManager } = ctx;

    // Move to parallel position
    const targetX = event.x + u.buddyOffset;
    const targetY = event.y;
    const dx = targetX - u.x;
    const dy = targetY - u.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist > 30) {
      const speed = config.speed * dimensions.width * speedMult * 2;
      u.x += (dx / dist) * speed;
      u.y += (dy / dist) * speed;
    } else {
      u.narrativePhase = "action";
      u.narrativeTimer = 0;
      moodManager.setMood(u, "playful");
    }
  }

  private updateAction(ctx: BehaviorContext, event: EventPosition): void {
    const { ufo: u, dimensions, speedMult } = ctx;

    // Flying alongside
    const targetX = event.x + u.buddyOffset;
    const targetY = event.y;

    // Match buddy velocity
    u.x += (u.buddyTarget?.vx ?? 0) * speedMult * 60;
    u.y += (u.buddyTarget?.vy ?? 0) * speedMult * 60;

    // Correct drift
    u.x += (targetX - u.x) * 0.05;
    u.y += (targetY - u.y) * 0.05;

    // Friendly beam pulse
    u.beamTarget = { x: event.x, y: event.y };
    u.beamIntensity = 0.3 + Math.sin(u.narrativeTimer * 0.1) * 0.2;

    // Occasional playful up/down
    if (Math.random() < 0.01) {
      u.y += (Math.random() - 0.5) * 20;
    }

    // Break off after a while or at screen edge
    if (
      u.narrativeTimer >= 300 ||
      event.x < 100 ||
      event.x > dimensions.width - 100
    ) {
      u.narrativePhase = "resolution";
      u.narrativeTimer = 0;
    }
  }

  private updateResolution(ctx: BehaviorContext): void {
    const { ufo: u, speedMult, moodManager } = ctx;

    // Peel away
    u.buddyOffset += speedMult * 2;
    u.y -= speedMult;
    u.beamIntensity *= 0.95;

    if (u.narrativeTimer >= 60) {
      moodManager.triggerWobble(u, "curious_tilt"); // Wave goodbye
      u.narrativePhase = "transition";
      u.narrativeTimer = 0;
    }
  }

  private updateTransition(ctx: BehaviorContext): void {
    const { ufo: u, callbacks } = ctx;

    u.beamTarget = null;
    if (u.narrativeTimer >= 60) {
      u.buddyTarget = null;
      u.narrativePhase = "none";
      callbacks.resumeWandering();
    }
  }
}

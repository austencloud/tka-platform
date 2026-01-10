/**
 * SurfingBehavior - UFO rides on a comet
 *
 * Phases: approach (intercept) → action (riding) → resolution (peel off) → transition
 */

import type { IUFOBehavior } from "../../contracts/IUFOBehavior";
import type { BehaviorContext } from "../../contracts/IUFOBehaviorRunner";
import type { UFOState, EventPosition } from "../../domain/ufo-types";

export class SurfingBehavior implements IUFOBehavior {
  readonly state: UFOState = "surfing";

  start(ctx: BehaviorContext, event: EventPosition): void {
    const u = ctx.ufo;

    u.state = "surfing";
    u.stateTimer = 0;
    u.narrativePhase = "approach";
    u.narrativeTimer = 0;
    u.surfTarget = {
      x: event.x,
      y: event.y,
      vx: event.vx ?? 0,
      vy: event.vy ?? 0,
    };
    ctx.moodManager.markInterest(u);
    ctx.moodManager.setMood(u, "excited");
  }

  update(ctx: BehaviorContext): void {
    const { ufo: u, moodManager, callbacks } = ctx;

    u.narrativeTimer += ctx.speedMult;

    // Check if comet is still active
    const event = ctx.eventProvider?.();
    if (!event?.active) {
      // Comet gone - dismount
      moodManager.triggerWobble(u, "curious_tilt");
      moodManager.setMood(u, "playful");
      u.surfTarget = null;
      u.narrativePhase = "none";
      callbacks.resumeWandering();
      return;
    }

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

    // Intercept the comet
    if (u.surfTarget) {
      const predictX = event.x + (event.vx ?? 0) * 30;
      const predictY = event.y + (event.vy ?? 0) * 30;
      const dx = predictX - u.x;
      const dy = predictY - u.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      const speed = config.speed * dimensions.width * speedMult * 2;
      u.x += (dx / dist) * speed;
      u.y += (dy / dist) * speed;

      if (dist < 50) {
        u.narrativePhase = "action";
        u.narrativeTimer = 0;
        moodManager.triggerWobble(u, "happy_bounce");
        moodManager.setMood(u, "playful");
        // Calculate offset from comet center
        u.surfOffset = { x: u.x - event.x, y: u.y - event.y - 20 };
      }
    }
  }

  private updateAction(ctx: BehaviorContext, event: EventPosition): void {
    const { ufo: u, dimensions, speedMult } = ctx;

    // Riding the comet!
    u.x = event.x + u.surfOffset.x;
    u.y = event.y + u.surfOffset.y;

    // Happy bobbing while riding
    u.surfOffset.y += Math.sin(u.narrativeTimer * 0.1) * 0.5;

    // Beam retracted while surfing
    u.beamIntensity = 0;
    u.beamTarget = null;

    // Occasional playful spin
    if (Math.random() < 0.005) {
      u.spinAngle += Math.PI * 2;
    }
    u.spinAngle *= 0.95; // Decay spin

    // Rainbow lights while surfing
    u.rainbowPhase += speedMult * 0.1;

    // Auto-dismount after a while or if near edge
    if (
      u.narrativeTimer >= 300 ||
      event.x < 50 ||
      event.x > dimensions.width - 50
    ) {
      u.narrativePhase = "resolution";
      u.narrativeTimer = 0;
    }
  }

  private updateResolution(ctx: BehaviorContext): void {
    const { ufo: u, speedMult, moodManager } = ctx;

    // Peel off from comet
    u.y -= speedMult * 3; // Rise up
    u.x += speedMult * 2; // Drift to side

    if (u.narrativeTimer >= 60) {
      moodManager.triggerWobble(u, "curious_tilt"); // Wave goodbye
      u.narrativePhase = "transition";
      u.narrativeTimer = 0;
    }
  }

  private updateTransition(ctx: BehaviorContext): void {
    const { ufo: u, callbacks } = ctx;

    if (u.narrativeTimer >= 30) {
      u.surfTarget = null;
      u.rainbowPhase = 0;
      u.narrativePhase = "none";
      callbacks.resumeWandering();
    }
  }
}

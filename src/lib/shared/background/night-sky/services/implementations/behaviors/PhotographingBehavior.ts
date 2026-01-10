/**
 * PhotographingBehavior - UFO photographs stars
 *
 * Phases: approach → action (focusing) → resolution (flash) → transition
 */

import type { IUFOBehavior } from "../../contracts/IUFOBehavior";
import type { BehaviorContext } from "../../contracts/IUFOBehaviorRunner";
import type { UFOState, StarInfo } from "../../domain/ufo-types";

export class PhotographingBehavior implements IUFOBehavior {
  readonly state: UFOState = "photographing";

  start(ctx: BehaviorContext, star: StarInfo): void {
    const u = ctx.ufo;

    u.state = "photographing";
    u.stateTimer = 0;
    u.narrativePhase = "approach";
    u.narrativeTimer = 0;
    u.photoTarget = { x: star.x, y: star.y };
    u.beamIntensity = 0;
    ctx.moodManager.markInterest(u);
  }

  update(ctx: BehaviorContext): void {
    const { ufo: u, callbacks } = ctx;

    u.narrativeTimer += ctx.speedMult;

    switch (u.narrativePhase) {
      case "approach":
        this.updateApproach(ctx);
        break;
      case "action":
        this.updateAction(ctx);
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

  private updateApproach(ctx: BehaviorContext): void {
    const { ufo: u, config, dimensions, speedMult, moodManager } = ctx;

    // Drift toward photo target
    if (u.photoTarget) {
      const dx = u.photoTarget.x - u.x;
      const dy = u.photoTarget.y - u.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist > 100) {
        // Move closer
        const speed = config.speed * dimensions.width * speedMult * 0.5;
        u.x += (dx / dist) * speed;
        u.y += (dy / dist) * speed;
      } else {
        u.narrativePhase = "action";
        u.narrativeTimer = 0;
        moodManager.triggerWobble(u, "curious_tilt");
      }
    }
  }

  private updateAction(ctx: BehaviorContext): void {
    const { ufo: u } = ctx;

    // Focusing - beam flickers
    u.beamIntensity = 0.3 + Math.random() * 0.3; // Autofocus flicker
    u.beamTarget = u.photoTarget;

    if (u.narrativeTimer >= 90) {
      // FLASH!
      u.cameraFlashTimer = 20;
      u.narrativePhase = "resolution";
      u.narrativeTimer = 0;

      // Remember this star
      if (u.photoTarget) {
        const key = `${Math.round(u.photoTarget.x / 50)},${Math.round(u.photoTarget.y / 50)}`;
        u.photographedStars.add(key);
      }
    }
  }

  private updateResolution(ctx: BehaviorContext): void {
    const { ufo: u, speedMult, moodManager } = ctx;

    // Flash fade and admire
    u.beamIntensity = Math.max(0, u.beamIntensity - speedMult * 0.05);
    moodManager.setMood(u, "excited");

    if (u.narrativeTimer >= 60) {
      // Check if we should celebrate (rare discovery)
      if (Math.random() < 0.1) {
        ctx.callbacks.startCelebrating();
        return;
      }
      u.narrativePhase = "transition";
      u.narrativeTimer = 0;
    }
  }

  private updateTransition(ctx: BehaviorContext): void {
    const { ufo: u, callbacks } = ctx;

    if (u.narrativeTimer >= 30) {
      u.photoTarget = null;
      u.beamTarget = null;
      u.narrativePhase = "none";
      callbacks.resumeWandering();
    }
  }
}

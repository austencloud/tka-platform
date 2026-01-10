/**
 * PanickingBehavior - UFO panics and flees from a threat
 *
 * Phases: detection (jolt) → action (zip away) → resolution (shaky) → transition
 */

import type { IUFOBehavior } from "../../contracts/IUFOBehavior";
import type { BehaviorContext } from "../../contracts/IUFOBehaviorRunner";
import type { UFOState } from "../../domain/ufo-types";

export class PanickingBehavior implements IUFOBehavior {
  readonly state: UFOState = "panicking";

  start(ctx: BehaviorContext, fromX: number, fromY: number): void {
    const u = ctx.ufo;

    // Calculate flee direction (away from threat)
    const dx = u.x - fromX;
    const dy = u.y - fromY;
    u.panicDirection = Math.atan2(dy, dx);

    u.state = "panicking";
    u.stateTimer = 0;
    u.narrativePhase = "detection";
    u.narrativeTimer = 0;
  }

  update(ctx: BehaviorContext): void {
    const { ufo: u, callbacks } = ctx;

    u.narrativeTimer += ctx.speedMult;

    switch (u.narrativePhase) {
      case "detection":
        this.updateDetection(ctx);
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

  private updateDetection(ctx: BehaviorContext): void {
    const { ufo: u, config, dimensions, moodManager } = ctx;

    // Initial jolt
    moodManager.triggerWobble(u, "startled_jolt");
    moodManager.setMood(u, "startled");
    u.panicSpeed = config.speed * dimensions.width * 4; // 4x normal speed
    u.narrativePhase = "action";
    u.narrativeTimer = 0;
    // Add afterimage at current position
    u.afterimagePositions = [{ x: u.x, y: u.y, opacity: 0.8 }];
  }

  private updateAction(ctx: BehaviorContext): void {
    const { ufo: u, config, dimensions, speedMult } = ctx;

    // Zip away in panic direction
    u.x += Math.cos(u.panicDirection) * u.panicSpeed * speedMult;
    u.y += Math.sin(u.panicDirection) * u.panicSpeed * speedMult;

    // Gradually slow down
    u.panicSpeed *= 0.95;

    // Add afterimages
    if (u.narrativeTimer % 5 < speedMult) {
      u.afterimagePositions.push({ x: u.x, y: u.y, opacity: 0.6 });
      if (u.afterimagePositions.length > 5) {
        u.afterimagePositions.shift();
      }
    }

    // Fade afterimages
    u.afterimagePositions.forEach((a) => (a.opacity *= 0.9));

    // Keep in bounds
    const margin = dimensions.width * config.bounceMargin;
    u.x = Math.max(margin, Math.min(dimensions.width - margin, u.x));
    u.y = Math.max(margin, Math.min(dimensions.height - margin, u.y));

    if (u.narrativeTimer >= 60) {
      u.narrativePhase = "resolution";
      u.narrativeTimer = 0;
    }
  }

  private updateResolution(ctx: BehaviorContext): void {
    const { ufo: u, speedMult } = ctx;

    // Shaky recovery
    u.heading += (Math.random() - 0.5) * 0.1 * speedMult;

    // Fade afterimages
    u.afterimagePositions = u.afterimagePositions.filter((a) => {
      a.opacity *= 0.9;
      return a.opacity > 0.05;
    });

    if (u.narrativeTimer >= 120) {
      u.narrativePhase = "transition";
      u.narrativeTimer = 0;
    }
  }

  private updateTransition(ctx: BehaviorContext): void {
    const { ufo: u, callbacks } = ctx;

    // Cautiously return to wandering
    if (u.narrativeTimer >= 60) {
      u.afterimagePositions = [];
      u.narrativePhase = "none";
      callbacks.resumeWandering();
    }
  }
}

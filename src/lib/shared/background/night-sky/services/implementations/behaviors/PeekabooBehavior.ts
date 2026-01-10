/**
 * PeekabooBehavior - UFO plays peek-a-boo (hides then peeks out)
 *
 * This handles both "hiding" and "peeking" states as they're part of the same behavior.
 * Phases for hiding: action (zip to corner) → resolution (wait hidden)
 * Phases for peeking: action (slowly reveal) → resolution (full reveal) → transition
 */

import type { IUFOBehavior } from "../../contracts/IUFOBehavior";
import type { BehaviorContext } from "../../contracts/IUFOBehaviorRunner";
import type { UFOState } from "../../domain/ufo-types";

export class PeekabooBehavior implements IUFOBehavior {
  readonly state: UFOState = "hiding"; // Primary state, also handles "peeking"

  start(ctx: BehaviorContext): void {
    const { ufo: u, dimensions, moodManager } = ctx;

    // Find a hide position (corner of screen)
    const corners = [
      { x: 50, y: 50 },
      { x: dimensions.width - 50, y: 50 },
      { x: 50, y: dimensions.height - 50 },
      { x: dimensions.width - 50, y: dimensions.height - 50 },
    ];

    // Pick farthest corner from current position
    let farthest = corners[0]!;
    let maxDist = 0;
    for (const corner of corners) {
      const dist = Math.sqrt(
        Math.pow(corner.x - u.x, 2) + Math.pow(corner.y - u.y, 2)
      );
      if (dist > maxDist) {
        maxDist = dist;
        farthest = corner;
      }
    }

    u.hidePosition = farthest;
    u.peekDirection = Math.atan2(u.y - farthest.y, u.x - farthest.x);
    u.state = "hiding";
    u.stateTimer = 0;
    u.narrativePhase = "action";
    u.narrativeTimer = 0;
    moodManager.setMood(u, "playful");
  }

  update(ctx: BehaviorContext): void {
    const { ufo: u } = ctx;

    u.narrativeTimer += ctx.speedMult;

    if (u.state === "hiding") {
      this.updateHiding(ctx);
    } else if (u.state === "peeking") {
      this.updatePeeking(ctx);
    }
  }

  private updateHiding(ctx: BehaviorContext): void {
    const { ufo: u, config, dimensions, speedMult } = ctx;

    switch (u.narrativePhase) {
      case "action":
        // Zip to hide position
        if (u.hidePosition) {
          const dx = u.hidePosition.x - u.x;
          const dy = u.hidePosition.y - u.y;
          const dist = Math.sqrt(dx * dx + dy * dy);

          if (dist > 10) {
            const speed = config.speed * dimensions.width * speedMult * 3;
            u.x += (dx / dist) * speed;
            u.y += (dy / dist) * speed;
          } else {
            u.narrativePhase = "resolution";
            u.narrativeTimer = 0;
            u.scale = 0.3; // Shrink while hiding
          }
        }
        break;

      case "resolution":
        // Wait hidden
        if (u.narrativeTimer >= 90) {
          u.state = "peeking";
          u.narrativePhase = "action";
          u.narrativeTimer = 0;
          u.peekProgress = 0;
        }
        break;
    }
  }

  private updatePeeking(ctx: BehaviorContext): void {
    const { ufo: u, speedMult, moodManager, callbacks } = ctx;

    switch (u.narrativePhase) {
      case "action":
        // Slowly peek out
        u.peekProgress = Math.min(1, u.peekProgress + speedMult * 0.02);
        u.scale = 0.3 + u.peekProgress * 0.7;

        // Move slightly in peek direction
        u.x += Math.cos(u.peekDirection) * speedMult * 0.5;
        u.y += Math.sin(u.peekDirection) * speedMult * 0.5;

        if (u.peekProgress >= 1) {
          u.narrativePhase = "resolution";
          u.narrativeTimer = 0;
        }
        break;

      case "resolution":
        // Full reveal!
        moodManager.triggerWobble(u, "happy_bounce");
        moodManager.setMood(u, "playful");

        if (u.narrativeTimer >= 60) {
          u.narrativePhase = "transition";
          u.narrativeTimer = 0;
        }
        break;

      case "transition":
        if (u.narrativeTimer >= 30) {
          u.hidePosition = null;
          u.peekProgress = 0;
          u.narrativePhase = "none";
          callbacks.resumeWandering();
        }
        break;
    }
  }
}

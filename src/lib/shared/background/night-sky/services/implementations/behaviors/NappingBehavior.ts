/**
 * NappingBehavior - UFO takes a power nap when tired
 *
 * Phases: detection (yawn) → approach (settle down) → action (sleep with Zzz) → resolution (wake) → transition
 */

import type { IUFOBehavior } from "../../contracts/IUFOBehavior";
import type { BehaviorContext } from "../../contracts/IUFOBehaviorRunner";
import type { UFOState } from "../../domain/ufo-types";

export class NappingBehavior implements IUFOBehavior {
  readonly state: UFOState = "napping";

  start(ctx: BehaviorContext): void {
    const u = ctx.ufo;

    u.state = "napping";
    u.stateTimer = 0;
    u.narrativePhase = "detection";
    u.narrativeTimer = 0;
    u.sleepZs = [];
    ctx.moodManager.setMood(u, "tired");
  }

  update(ctx: BehaviorContext): void {
    const { ufo: u, callbacks } = ctx;

    u.narrativeTimer += ctx.speedMult;

    switch (u.narrativePhase) {
      case "detection":
        this.updateDetection(ctx);
        break;
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

  private updateDetection(ctx: BehaviorContext): void {
    const { ufo: u, moodManager } = ctx;

    // Yawning
    moodManager.triggerWobble(u, "yawn_stretch");
    u.narrativePhase = "approach";
    u.narrativeTimer = 0;
    u.napStartY = u.y;
  }

  private updateApproach(ctx: BehaviorContext): void {
    const { ufo: u, config, dimensions, speedMult } = ctx;

    // Settling down - drift to a quiet corner
    const targetX = dimensions.width * 0.85;
    const targetY = dimensions.height * 0.2;

    const dx = targetX - u.x;
    const dy = targetY - u.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist > 20) {
      const speed = config.speed * dimensions.width * speedMult * 0.3;
      u.x += (dx / dist) * speed;
      u.y += (dy / dist) * speed;
    } else {
      u.narrativePhase = "action";
      u.narrativeTimer = 0;
    }
  }

  private updateAction(ctx: BehaviorContext): void {
    const { ufo: u, speedMult } = ctx;

    // Sleeping - very still, gentle bob, Zzz particles
    u.beamIntensity = 0;
    u.beamTarget = null;

    // Slow, deep hover bob
    u.y += Math.sin(u.narrativeTimer * 0.02) * 0.3;

    // Lights dim
    u.opacity = Math.max(0.6, u.opacity - speedMult * 0.001);

    // Spawn Z particles occasionally
    if (Math.random() < 0.02 && u.sleepZs.length < 5) {
      u.sleepZs.push({
        x: u.x + 15,
        y: u.y - 10,
        targetX: u.x + 40 + Math.random() * 20,
        targetY: u.y - 60 - Math.random() * 40,
        progress: 0,
        color: "rgba(167, 139, 250, 0.8)",
        size: 8 + Math.random() * 4,
        type: "z",
      });
    }

    // Update Z particles
    u.sleepZs = u.sleepZs.filter((z) => {
      z.progress += speedMult * 0.008;
      const eased = z.progress;
      z.x = z.x + (z.targetX - z.x) * eased * 0.02;
      z.y = z.y + (z.targetY - z.y) * eased * 0.02;
      z.size *= 0.995; // Shrink slightly
      return z.progress < 1;
    });

    // Wake up after rest or if clicked (handled elsewhere)
    if (u.narrativeTimer >= 600) {
      // 10 seconds nap
      u.narrativePhase = "resolution";
      u.narrativeTimer = 0;
    }
  }

  private updateResolution(ctx: BehaviorContext): void {
    const { ufo: u, speedMult, moodManager } = ctx;

    // Waking up - stretch
    moodManager.triggerWobble(u, "yawn_stretch");
    u.opacity = Math.min(1, u.opacity + speedMult * 0.02);

    if (u.narrativeTimer >= 60) {
      // Refreshed!
      u.tiredness = Math.max(0, u.tiredness - 0.5);
      moodManager.setMood(u, "curious");
      u.narrativePhase = "transition";
      u.narrativeTimer = 0;
    }
  }

  private updateTransition(ctx: BehaviorContext): void {
    const { ufo: u, callbacks } = ctx;

    u.sleepZs = [];
    if (u.narrativeTimer >= 30) {
      u.narrativePhase = "none";
      callbacks.resumeWandering();
    }
  }
}

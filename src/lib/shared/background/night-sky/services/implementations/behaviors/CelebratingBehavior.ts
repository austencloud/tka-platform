/**
 * CelebratingBehavior - UFO celebrates a rare discovery
 *
 * Phases: detection (flash) → action (spin/bounce) → resolution (satisfied) → transition
 */

import type { IUFOBehavior } from "../../contracts/IUFOBehavior";
import type { BehaviorContext } from "../../contracts/IUFOBehaviorRunner";
import type { UFOState } from "../../domain/ufo-types";

export class CelebratingBehavior implements IUFOBehavior {
  readonly state: UFOState = "celebrating";

  start(ctx: BehaviorContext): void {
    const u = ctx.ufo;

    u.state = "celebrating";
    u.stateTimer = 0;
    u.narrativePhase = "detection";
    u.narrativeTimer = 0;
    u.targetZ = 0.2; // Come close to show off
    u.rareBrowseies++;
    ctx.moodManager.markInterest(u);
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
    const { ufo: u, moodManager } = ctx;

    // Lights flash in unison
    u.cameraFlashTimer = 15;
    moodManager.setMood(u, "excited");
    u.narrativePhase = "action";
    u.narrativeTimer = 0;
    u.celebrationSpinSpeed = 0.3;
  }

  private updateAction(ctx: BehaviorContext): void {
    const { ufo: u, speedMult } = ctx;

    // Spinning and bouncing celebration
    u.spinAngle += u.celebrationSpinSpeed * speedMult;
    u.celebrationBouncePhase += speedMult * 0.15;
    u.y += Math.sin(u.celebrationBouncePhase) * 2;

    // Rainbow lights
    u.rainbowPhase += speedMult * 0.2;

    // Gradually slow spin
    u.celebrationSpinSpeed *= 0.995;

    if (u.narrativeTimer >= 180) {
      u.narrativePhase = "resolution";
      u.narrativeTimer = 0;
    }
  }

  private updateResolution(ctx: BehaviorContext): void {
    const { ufo: u, speedMult, moodManager } = ctx;

    // Satisfied hover
    moodManager.triggerWobble(u, "happy_bounce");
    u.spinAngle *= 0.9;
    u.rainbowPhase += speedMult * 0.05;

    if (u.narrativeTimer >= 60) {
      u.narrativePhase = "transition";
      u.narrativeTimer = 0;
    }
  }

  private updateTransition(ctx: BehaviorContext): void {
    const { ufo: u, callbacks } = ctx;

    u.rainbowPhase = 0;
    u.spinAngle = 0;
    if (u.narrativeTimer >= 30) {
      u.narrativePhase = "none";
      callbacks.resumeWandering();
    }
  }
}

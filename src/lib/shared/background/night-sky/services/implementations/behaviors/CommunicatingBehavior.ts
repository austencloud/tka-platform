/**
 * CommunicatingBehavior - UFO tries to communicate with a star
 *
 * Phases: approach → action (morse-like transmission) → resolution (await response) → transition
 */

import type { IUFOBehavior } from "../../contracts/IUFOBehavior";
import type { BehaviorContext } from "../../contracts/IUFOBehaviorRunner";
import type { UFOState, StarInfo } from "../../domain/ufo-types";

export class CommunicatingBehavior implements IUFOBehavior {
  readonly state: UFOState = "communicating";

  start(ctx: BehaviorContext, star: StarInfo): void {
    const u = ctx.ufo;

    u.state = "communicating";
    u.stateTimer = 0;
    u.narrativePhase = "approach";
    u.narrativeTimer = 0;
    u.targetZ = 0.3; // Mid-distance for communication
    u.commTarget = { x: star.x, y: star.y };
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
    const { ufo: u, config, dimensions, speedMult } = ctx;

    // Drift toward target star
    if (u.commTarget) {
      const dx = u.commTarget.x - u.x;
      const dy = u.commTarget.y - u.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist > 150) {
        const speed = config.speed * dimensions.width * speedMult * 0.5;
        u.x += (dx / dist) * speed;
        u.y += (dy / dist) * speed;
      } else {
        u.narrativePhase = "action";
        u.narrativeTimer = 0;
        // Generate communication pattern (morse-like)
        u.commPattern = [
          { duration: 10, isOn: true },
          { duration: 10, isOn: false },
          { duration: 10, isOn: true },
          { duration: 10, isOn: false },
          { duration: 30, isOn: true },
          { duration: 20, isOn: false },
        ];
        u.commPatternIndex = 0;
        u.commPulseTimer = 0;
      }
    }
  }

  private updateAction(ctx: BehaviorContext): void {
    const { ufo: u, speedMult } = ctx;

    // Send transmission - beam pulses in pattern
    u.beamTarget = u.commTarget;

    if (u.commPatternIndex < u.commPattern.length) {
      const pulse = u.commPattern[u.commPatternIndex]!;
      u.beamIntensity = pulse.isOn ? 1 : 0.2;

      u.commPulseTimer += speedMult;
      if (u.commPulseTimer >= pulse.duration) {
        u.commPulseTimer = 0;
        u.commPatternIndex++;
      }
    } else {
      // Transmission complete - wait for response
      u.beamIntensity = 0.3;
      u.awaitingResponse = true;
      u.narrativePhase = "resolution";
      u.narrativeTimer = 0;
    }
  }

  private updateResolution(ctx: BehaviorContext): void {
    const { ufo: u, moodManager } = ctx;

    // Listening for response...
    u.beamIntensity = 0.2 + Math.sin(u.narrativeTimer * 0.1) * 0.1;

    // "Response" is random - if target star happens to twinkle (we fake this)
    const gotResponse = u.narrativeTimer > 60 && Math.random() < 0.02;

    if (gotResponse) {
      moodManager.triggerWobble(u, "happy_bounce");
      moodManager.setMood(u, "excited");
      // Mark as contacted
      if (u.commTarget) {
        const key = `${Math.round(u.commTarget.x / 50)},${Math.round(u.commTarget.y / 50)}`;
        u.photographedStars.add(key); // Reuse this set for contacted stars
      }
      u.narrativePhase = "transition";
      u.narrativeTimer = 0;
    } else if (u.narrativeTimer >= 120) {
      // No response :(
      moodManager.triggerWobble(u, "disappointed_shake");
      moodManager.setMood(u, "bored");
      u.narrativePhase = "transition";
      u.narrativeTimer = 0;
    }
  }

  private updateTransition(ctx: BehaviorContext): void {
    const { ufo: u, speedMult, callbacks } = ctx;

    u.beamIntensity = Math.max(0, u.beamIntensity - speedMult * 0.03);
    if (u.narrativeTimer >= 60) {
      u.commTarget = null;
      u.beamTarget = null;
      u.awaitingResponse = false;
      u.narrativePhase = "none";
      callbacks.resumeWandering();
    }
  }
}

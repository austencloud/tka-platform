/**
 * SampleCollectionBehavior - UFO collects samples from celestial events
 *
 * Phases: detection → action (scanning) → resolution (particle travel) → transition
 */

import type { IUFOBehavior } from "../../contracts/IUFOBehavior";
import type { BehaviorContext } from "../../contracts/IUFOBehaviorRunner";
import type { UFOState, EventPosition } from "../../domain/ufo-types";

export class SampleCollectionBehavior implements IUFOBehavior {
  readonly state: UFOState = "collecting_sample";

  start(ctx: BehaviorContext, event: EventPosition): void {
    const u = ctx.ufo;

    u.state = "collecting_sample";
    u.stateTimer = 0;
    u.narrativePhase = "detection";
    u.narrativeTimer = 0;
    u.beamTarget = { x: event.x, y: event.y };
    u.beamIntensity = 0;
    ctx.moodManager.markInterest(u);
  }

  update(ctx: BehaviorContext): void {
    const { ufo: u, speedMult, moodManager, callbacks } = ctx;

    u.narrativeTimer += speedMult;

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
    const { ufo: u, speedMult, moodManager } = ctx;

    // Beam charging toward target
    u.beamIntensity = Math.min(1, u.beamIntensity + speedMult * 0.03);
    if (u.narrativeTimer >= 60) {
      u.narrativePhase = "action";
      u.narrativeTimer = 0;
      u.narrativePhaseDuration = 120; // 2 seconds scanning
      moodManager.setMood(u, "excited");
    }
  }

  private updateAction(ctx: BehaviorContext): void {
    const { ufo: u, speedMult } = ctx;

    // Scanning - beam pulses
    u.beamIntensity = 0.7 + Math.sin(u.narrativeTimer * 0.2) * 0.3;

    // Update beam target if tracking moving object
    const event = ctx.eventProvider?.();
    if (event?.active && u.beamTarget) {
      u.beamTarget = { x: event.x, y: event.y };
    }

    if (u.narrativeTimer >= u.narrativePhaseDuration) {
      // Spawn sample particle at beam target
      if (u.beamTarget) {
        u.sampleParticle = {
          x: u.beamTarget.x,
          y: u.beamTarget.y,
          targetX: u.x,
          targetY: u.y,
          progress: 0,
          color: "#fbbf24", // Golden
          size: 6,
          type: "sample",
        };
      }
      u.narrativePhase = "resolution";
      u.narrativeTimer = 0;
      u.narrativePhaseDuration = 90; // 1.5 seconds for particle travel
    }
  }

  private updateResolution(ctx: BehaviorContext): void {
    const { ufo: u, speedMult, moodManager } = ctx;

    // Sample particle traveling up the beam
    if (u.sampleParticle) {
      u.sampleParticle.progress = Math.min(
        1,
        u.sampleParticle.progress + speedMult * 0.015
      );
      // Update particle position along beam
      const p = u.sampleParticle.progress;
      const eased = 1 - Math.pow(1 - p, 3); // Ease out cubic
      u.sampleParticle.x =
        u.beamTarget!.x + (u.x - u.beamTarget!.x) * eased;
      u.sampleParticle.y =
        u.beamTarget!.y + (u.y - u.beamTarget!.y) * eased;

      // Particle reached UFO
      if (u.sampleParticle.progress >= 1) {
        u.collectedSamples++;
        u.sampleParticle = null;
        moodManager.triggerWobble(u, "happy_bounce");
        u.narrativePhase = "transition";
        u.narrativeTimer = 0;
        // Flash effect
        u.cameraFlashTimer = 15;
      }
    }
  }

  private updateTransition(ctx: BehaviorContext): void {
    const { ufo: u, speedMult, callbacks } = ctx;

    // Brief satisfaction pause then return to wandering
    u.beamIntensity = Math.max(0, u.beamIntensity - speedMult * 0.05);
    if (u.narrativeTimer >= 30) {
      u.beamTarget = null;
      u.narrativePhase = "none";
      callbacks.resumeWandering();
    }
  }
}

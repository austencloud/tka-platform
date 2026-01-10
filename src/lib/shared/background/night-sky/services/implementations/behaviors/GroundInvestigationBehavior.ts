/**
 * GroundInvestigationBehavior - UFO investigates anomalies on the ground
 *
 * Phases: detection → approach (descend) → action (sweep beam) → resolution → transition
 */

import type { IUFOBehavior } from "../../contracts/IUFOBehavior";
import type { BehaviorContext } from "../../contracts/IUFOBehaviorRunner";
import type { UFOState } from "../../domain/ufo-types";

export class GroundInvestigationBehavior implements IUFOBehavior {
  readonly state: UFOState = "investigating_ground";

  start(ctx: BehaviorContext): void {
    const u = ctx.ufo;

    u.state = "investigating_ground";
    u.stateTimer = 0;
    u.narrativePhase = "detection";
    u.narrativeTimer = 0;
    u.groundParticles = [];
    ctx.moodManager.markInterest(u);
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
    const { ufo: u, dimensions, moodManager } = ctx;

    // Pause and look down
    moodManager.triggerWobble(u, "curious_tilt");
    if (u.narrativeTimer >= 30) {
      u.narrativePhase = "approach";
      u.narrativeTimer = 0;
      // Set anomaly position at bottom of screen
      u.anomalyPosition = {
        x: u.x + (Math.random() - 0.5) * 100,
        y: dimensions.height - 50,
      };
    }
  }

  private updateApproach(ctx: BehaviorContext): void {
    const { ufo: u, dimensions, speedMult } = ctx;

    // Descend toward anomaly
    if (u.anomalyPosition) {
      const targetY = dimensions.height * 0.7;
      if (u.y < targetY) {
        u.y += speedMult * 2;
      } else {
        u.narrativePhase = "action";
        u.narrativeTimer = 0;
        u.beamTarget = u.anomalyPosition;
        u.beamIntensity = 0;
      }
    }
  }

  private updateAction(ctx: BehaviorContext): void {
    const { ufo: u, speedMult, moodManager } = ctx;

    // Beam sweeps and collects particles
    u.beamIntensity = Math.min(1, u.beamIntensity + speedMult * 0.02);

    // Beam sweeps side to side
    if (u.anomalyPosition) {
      const sweep = Math.sin(u.narrativeTimer * 0.05) * 50;
      u.beamTarget = {
        x: u.anomalyPosition.x + sweep,
        y: u.anomalyPosition.y,
      };
    }

    // Spawn rising particles
    if (Math.random() < 0.1 && u.groundParticles.length < 10) {
      u.groundParticles.push({
        x: u.beamTarget!.x + (Math.random() - 0.5) * 30,
        y: u.beamTarget!.y,
        targetX: u.x,
        targetY: u.y,
        progress: 0,
        color: `hsl(${40 + Math.random() * 20}, 80%, 60%)`,
        size: 2 + Math.random() * 3,
        type: "dust",
      });
    }

    // Update particles
    u.groundParticles = u.groundParticles.filter((p) => {
      p.progress += speedMult * 0.01;
      const eased = 1 - Math.pow(1 - p.progress, 2);
      p.x = p.x + (p.targetX - p.x) * eased * 0.1;
      p.y = p.y + (p.targetY - p.y) * eased * 0.1;
      return p.progress < 1;
    });

    if (u.narrativeTimer >= 180) {
      moodManager.setMood(u, "excited");
      u.narrativePhase = "resolution";
      u.narrativeTimer = 0;
      u.cameraFlashTimer = 10; // Dome flash
    }
  }

  private updateResolution(ctx: BehaviorContext): void {
    const { ufo: u, speedMult, moodManager } = ctx;

    // Analysis complete - particles absorbed
    u.groundParticles = u.groundParticles.filter((p) => {
      p.progress += speedMult * 0.03;
      return p.progress < 1;
    });

    u.beamIntensity = Math.max(0, u.beamIntensity - speedMult * 0.02);

    if (u.narrativeTimer >= 60) {
      // Random outcome
      if (Math.random() < 0.7) {
        moodManager.triggerWobble(u, "happy_bounce");
      } else {
        moodManager.triggerWobble(u, "curious_tilt");
      }
      u.narrativePhase = "transition";
      u.narrativeTimer = 0;
    }
  }

  private updateTransition(ctx: BehaviorContext): void {
    const { ufo: u, dimensions, speedMult, callbacks } = ctx;

    // Rise back up
    if (u.y > dimensions.height * 0.3) {
      u.y -= speedMult * 2;
    } else if (u.narrativeTimer >= 30) {
      u.anomalyPosition = null;
      u.beamTarget = null;
      u.groundParticles = [];
      u.narrativePhase = "none";
      callbacks.resumeWandering();
    }
  }
}

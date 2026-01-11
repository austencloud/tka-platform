/**
 * GivingUpBehavior - UFO gives up chasing, disappointed slowdown animation
 *
 * Phases: Gradual deceleration with disappointed wobble, beam fade
 */

import type { IUFOBehavior } from "../../contracts/IUFOBehavior";
import type { BehaviorContext } from "../../contracts/IUFOBehaviorRunner";
import type { UFOState } from "../../domain/ufo-types";

export class GivingUpBehavior implements IUFOBehavior {
  readonly state: UFOState = "giving_up";

  start(ctx: BehaviorContext): void {
    const u = ctx.ufo;

    u.state = "giving_up";
    u.stateTimer = 0;
    u.giveUpTimer = 90; // 1.5 seconds to give up animation
    u.targetZ = Math.min(1, u.z + 0.2); // Retreat in disappointment

    // Keep beam briefly pointing at last known position
    // (will fade during giving_up)
  }

  update(ctx: BehaviorContext): void {
    const { ufo: u, config, dimensions, speedMult, moodManager, callbacks } = ctx;

    // Decrement give up timer
    u.giveUpTimer -= speedMult;

    // Calculate progress (0 to 1)
    const progress = 1 - u.giveUpTimer / 90;

    // Gradually slow down
    const slowdownFactor = Math.max(0.1, 1 - progress * 0.9);

    // Apply slowdown to movement (continue in current direction, slowing)
    const slowSpeed = config.speed * dimensions.width * speedMult * slowdownFactor;
    u.x += Math.cos(u.heading) * slowSpeed;
    u.y += Math.sin(u.heading) * slowSpeed;

    // Fade beam
    u.beamIntensity = Math.max(0, u.beamIntensity - speedMult * 0.02);

    // Disappointed wobble - small side-to-side oscillation
    const wobbleAmount = 0.05 * (1 - progress); // Fade out wobble
    u.heading += Math.sin(u.stateTimer * 0.3) * wobbleAmount * speedMult;

    // Animation complete
    if (u.giveUpTimer <= 0) {
      // Clear chase state
      u.chaseTarget = null;
      u.beamTarget = null;
      u.beamIntensity = 0;

      // Enter slightly bored mood (the target got away!)
      moodManager.setMood(u, "bored");

      // Return to wandering
      callbacks.resumeWandering();
    }
  }
}

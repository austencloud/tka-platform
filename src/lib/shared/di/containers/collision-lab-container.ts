/**
 * Collision Lab ITI Container
 *
 * Provides services for the collision-lab tab:
 *   - pose enumeration
 *   - label persistence
 *   - stance simulator (pure-JS kinematic model)
 *   - stance optimizer (coordinate descent over the simulator)
 *
 * Self-contained; no external dependencies needed.
 */

import { createContainer } from "iti";

import { DiamondPoseEnumerator } from "$lib/features/lab/tabs/collision-lab/services/implementations/DiamondPoseEnumerator";
import { LocalPoseLabelRepository } from "$lib/features/lab/tabs/collision-lab/services/implementations/LocalPoseLabelRepository";
import {
  StanceSimulator,
  restPoseFromHeight,
} from "$lib/features/lab/tabs/collision-lab/services/implementations/StanceSimulator";
import { StanceOptimizer } from "$lib/features/lab/tabs/collision-lab/services/implementations/StanceOptimizer";
import { CandidateGenerator } from "$lib/features/lab/tabs/collision-lab/services/implementations/CandidateGenerator";
import { userProportionsState } from "$lib/shared/3d/state/user-proportions-state.svelte";

export function createCollisionLabContainer() {
  return createContainer()
    .add({ diamondPoseEnumerator: () => new DiamondPoseEnumerator() })
    .add({
      collisionLabPoseLabelRepository: () => new LocalPoseLabelRepository(),
    })
    .add({
      // Simulator is built from the user's configured body height so the
      // optimizer reasons about the right proportions. If the user changes
      // their height in settings, restart the lab tab to pick it up —
      // we don't auto-rebuild because 576 labels were committed against
      // the prior geometry and mixing them would silently corrupt the set.
      stanceSimulator: () => {
        const heightM = userProportionsState.heightCm / 100;
        return new StanceSimulator(restPoseFromHeight(heightM));
      },
    })
    .add((ctx) => ({
      stanceOptimizer: () => new StanceOptimizer(ctx.stanceSimulator),
    }))
    .add((ctx) => ({
      // Multiple-choice candidate generator — produces six distinct
      // stance options per pose for the reviewer to pick from, using the
      // optimizer under the hood but running it from six hand-chosen
      // seeds so each result lands in its own basin of the loss surface.
      stanceCandidateGenerator: () => new CandidateGenerator(ctx.stanceOptimizer),
    }));
}

export type CollisionLabContainer = ReturnType<typeof createCollisionLabContainer>;

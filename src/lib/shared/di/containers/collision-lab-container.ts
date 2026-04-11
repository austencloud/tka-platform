/**
 * Collision Lab ITI Container
 *
 * Provides services for the collision-lab tab: pose enumeration, label
 * persistence, and stance variant library. Self-contained; no external
 * dependencies needed.
 */

import { createContainer } from "iti";

import { DiamondPoseEnumerator } from "$lib/features/lab/tabs/collision-lab/services/implementations/DiamondPoseEnumerator";
import { LocalPoseLabelRepository } from "$lib/features/lab/tabs/collision-lab/services/implementations/LocalPoseLabelRepository";

export function createCollisionLabContainer() {
  return createContainer()
    .add({ diamondPoseEnumerator: () => new DiamondPoseEnumerator() })
    .add({ collisionLabPoseLabelRepository: () => new LocalPoseLabelRepository() });
}

export type CollisionLabContainer = ReturnType<typeof createCollisionLabContainer>;

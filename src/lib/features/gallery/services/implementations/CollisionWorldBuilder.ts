/**
 * CollisionWorldBuilder
 *
 * Builds the collision world from room definitions and wall colliders.
 * The collision world is used for efficient player movement collision detection.
 */

import { injectable } from "inversify";
import type { WallCollider, CollisionWorld } from "../../domain/models/WallCollider";
import { createCollisionWorld } from "../../domain/models/WallCollider";
import { PLAYER_EYE_HEIGHT } from "../../domain/constants/gallery-dimensions";

// Player collision radius (half the player's "width")
const PLAYER_RADIUS = 30;

// =============================================================================
// Service
// =============================================================================

@injectable()
export class CollisionWorldBuilder {
  /**
   * Build a collision world from wall colliders
   */
  build(colliders: readonly WallCollider[]): CollisionWorld {
    return createCollisionWorld([...colliders], PLAYER_RADIUS);
  }

  /**
   * Get the player collision radius
   */
  getPlayerRadius(): number {
    return PLAYER_RADIUS;
  }
}

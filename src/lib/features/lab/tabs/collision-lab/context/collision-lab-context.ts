/**
 * Collision Lab Context
 *
 * Distributes the collision-lab state to descendant components via
 * Svelte's context API. Set once in CollisionLab.svelte; consumed
 * by any component in the subtree via getCollisionLabContext().
 */

import { getContext, setContext } from "svelte";
import type { CollisionLabState } from "../state/collision-lab-state.svelte";

const KEY = Symbol("collision-lab-context");

/**
 * Context is set synchronously during component initialization, but the
 * state itself is async (awaits labelRepo.loadAll). The holder uses a
 * getter so children see the current state once it's ready - they gate
 * on `state != null` in the root component before mounting, so they
 * never observe the null value.
 */
export interface CollisionLabContext {
  readonly state: CollisionLabState;
}

export function setCollisionLabContext(ctx: CollisionLabContext): void {
  setContext(KEY, ctx);
}

export function getCollisionLabContext(): CollisionLabContext {
  const ctx = getContext<CollisionLabContext | undefined>(KEY);
  if (!ctx) {
    throw new Error(
      "getCollisionLabContext() called outside of a CollisionLab subtree"
    );
  }
  return ctx;
}

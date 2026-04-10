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

export interface CollisionLabContext {
  state: CollisionLabState;
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

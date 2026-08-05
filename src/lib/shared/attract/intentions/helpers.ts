/**
 * Shared beats for the intention bag. Everything here composes the motor
 * primitives the composer acts already proved out — no new motor work.
 *
 * Every query goes through the allowlist selectors in domain/annotations.ts,
 * so an intention physically cannot reach an unannotated control.
 */

import type { AttractGhost } from "../services/attract-ghost.svelte";
import { safe, type GhostKind } from "../domain/annotations";
import type { GhostContext } from "../domain/intention";

/** Press one element of a kind, chosen by the seeded RNG. False if none. */
export async function pressKind(
  g: AttractGhost,
  ctx: GhostContext,
  kind: GhostKind,
  timeoutMs = 2000,
): Promise<boolean> {
  const els = await g.waitFor(safe(kind), timeoutMs);
  if (!els.length || g.halted()) return false;
  const chosen = ctx.rng.pick(els)!;
  await g.moveAndPress(chosen);
  return true;
}

/** Browse a couple of alternatives, then commit to one. False if none. */
export async function browseKind(
  g: AttractGhost,
  kind: GhostKind,
  timeoutMs = 4000,
): Promise<boolean> {
  const els = await g.waitFor(safe(kind), timeoutMs);
  if (!els.length || g.halted()) return false;
  await g.browseAndPick(els);
  return true;
}

/**
 * Watch something for a while. False if it is gone.
 *
 * Stays where the hand already is by default. It used to glide to the target's
 * bottom-right corner every time, which after a press reads as the ghost
 * politely stepping out of its own way — Austen: "doing a weird thing where he
 * moves out of the way after clicking different settings and different buttons
 * which is not a thing that a normal user would" do. A person clicks, then
 * watches with the cursor still sitting where they clicked.
 *
 * `linger` (admire.ts) is the one beat that SHOULD travel to its subject and
 * settle beside it — it is going somewhere to admire something, not watching
 * the result of its own click. It calls restBeside directly.
 */
export async function watchKind(
  g: AttractGhost,
  kind: GhostKind,
  ms: number,
  timeoutMs = 2000,
): Promise<boolean> {
  const els = await g.waitFor(safe(kind), timeoutMs);
  if (!els.length || g.halted()) return false;
  await g.dwell(ms);
  return true;
}

/** The ghost's own name for whatever it is about to touch. */
export function labelOf(el: HTMLElement): string {
  const raw =
    el.getAttribute("data-ghost-label") ??
    el.getAttribute("aria-label") ??
    el.textContent ??
    "";
  return raw.trim().replace(/\s+/g, " ").slice(0, 40);
}

/** Rising pressure to move on, so no screen holds the ghost for the whole jam. */
export function restlessness(ctx: GhostContext): number {
  return Math.min(1, ctx.moduleDwellMs / 90_000);
}

/**
 * How settled the ghost is in the room it just walked into. A module's own
 * controls mount asynchronously — for the first second or two the DOM honestly
 * has nothing annotated on it, and an undamped navigator wins that gap every
 * time and leaves before the page it asked for has finished arriving. Nobody
 * walks into a room and turns straight back around.
 */
export function settled(ctx: GhostContext): number {
  return Math.min(1, ctx.moduleDwellMs / 10_000);
}

/** True when this kind is present and pressable right now. */
export const has = (ctx: GhostContext, kind: GhostKind): boolean =>
  (ctx.available[kind] ?? 0) > 0;

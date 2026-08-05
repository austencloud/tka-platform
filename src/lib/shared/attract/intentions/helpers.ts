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
import { visibleAll } from "../services/sensors";
import { GENERATED_LINES } from "./generated-lines";

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

/**
 * One of several phrasings, seeded. An intention that recurs for four hours with
 * one fixed line reads as a loop; three phrasings read as a person.
 */
export const oneOf = (ctx: GhostContext, lines: string[]): string =>
  ctx.rng.pick(lines) ?? lines[0]!;

/**
 * `oneOf`, widened by the generated pool for this slot.
 *
 * Three phrasings is enough to beat a fixed line and nowhere near enough to
 * survive the watch it actually gets: someone standing at a jam for twenty
 * minutes hears every one of them come round again, and the presenter reads as
 * a loop no matter how good the reasoning underneath it is. The generated pool
 * (generated-lines.ts, written offline by scripts/generate-ghost-lines.mjs)
 * adds ~24 more per slot.
 *
 * ADDITIVE, always. The hand-written lines stay in the pool, so deleting the
 * generated file leaves the presenter exactly as good as it was before any of
 * this — no runtime dependency, no API key, nothing to fail at a park.
 */
export function voiced(
  ctx: GhostContext,
  slotId: string,
  lines: string[],
): string {
  const generated = GENERATED_LINES[slotId] ?? [];
  return oneOf(ctx, generated.length ? [...lines, ...generated] : lines);
}

/**
 * `voiced` for a line that NAMES the control it is about to touch.
 *
 * Generated lines for these slots are templates carrying a single `{target}`,
 * substituted here with the label of the element the intention ALREADY
 * resolved. That is the whole reason they are templates: a generated line with
 * a control name baked into it would say one thing while the perform pressed
 * another, which is exactly the defect fixed in 3b912bbc97 ("he keeps saying I
 * wonder what side by side is and then not clicking side by side").
 *
 * Falls back to the hand-written lines when there is no target — the caller
 * should not have got here, but a thought that silently reads "{target}" on
 * screen would be worse than a plain one.
 */
export function voicedAbout(
  ctx: GhostContext,
  slotId: string,
  target: HTMLElement | null,
  lines: string[],
): string {
  if (!target) return oneOf(ctx, lines);
  const label = labelOf(target);
  return voiced(ctx, slotId, lines).replaceAll("{target}", label);
}

/**
 * One visible, pressable element of a kind, chosen by the seeded rng. The
 * standard `target()` body: resolved once so the thought and the press are about
 * the same control.
 */
export function pickOf(ctx: GhostContext, kind: GhostKind): HTMLElement | null {
  return ctx.rng.pick(visibleAll(safe(kind))) ?? null;
}

/** True when this kind is present and pressable right now. */
export const has = (ctx: GhostContext, kind: GhostKind): boolean =>
  (ctx.available[kind] ?? 0) > 0;

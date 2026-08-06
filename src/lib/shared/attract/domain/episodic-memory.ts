/**
 * Small, typed memories that turn repeated encounters into changed behavior.
 *
 * These are intentionally pure policy helpers. The mind owns when evidence is
 * recorded; intentions only ask what that evidence means for the next action.
 */

import type {
  GhostContext,
  GhostNavigationMemory,
  GhostNavigationOption,
  GhostWorld,
} from "./intention";

/** A sidebar layout is still readily recalled after a normal tour interval. */
export const SIDEBAR_FAMILIARITY_MS = 15 * 60_000;

/** An unchanged playback can become worth revisiting after a genuine absence. */
export const PLAYBACK_REVISIT_MS = 45_000;

export function navigationContextKey(
  world: Pick<GhostWorld, "moduleId" | "tabId">
): string {
  return `${world.moduleId ?? "none"}/${world.tabId ?? "none"}`;
}

export function navigationSignature(
  options: readonly GhostNavigationOption[]
): string {
  return options
    .map(({ kind, id, label }) => `${kind}:${id}:${label}`)
    .join("|");
}

export function recognizesNavigation(
  navigation: GhostNavigationMemory,
  contextKey: string,
  signature: string,
  at: number
): boolean {
  const memory = navigation.familiarityByContext.get(contextKey);
  return (
    memory?.signature === signature &&
    at - memory.lastReadAt <= SIDEBAR_FAMILIARITY_MS
  );
}

/**
 * Workspace playback is one surface even when the surrounding Create tab
 * changes. Viewer and camera practice are materially different ways to watch.
 */
export function playbackSurface(
  world: Pick<GhostWorld, "viewerOpen" | "cameraLive">
): string {
  if (world.viewerOpen) return "viewer";
  if (world.cameraLive) return "practice";
  return "workspace";
}

export function playbackWouldRepeat(ctx: GhostContext): boolean {
  return (
    ctx.playback.lastPlayedRevision === ctx.playback.presentationRevision &&
    ctx.playback.lastPlayedSurface === playbackSurface(ctx) &&
    ctx.trail.lastAt() - ctx.playback.lastPlayedAt < PLAYBACK_REVISIT_MS
  );
}

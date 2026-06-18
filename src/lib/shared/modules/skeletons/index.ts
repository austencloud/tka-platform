import type { Component } from "svelte";
import SharedShellSkeleton from "./SharedShellSkeleton.svelte";

export const SHARED_SHELL: Component = SharedShellSkeleton;

/**
 * Bespoke skeletons keyed by module id.
 *
 * HARD INVARIANT: a module gets a bespoke skeleton ONLY after that skeleton has
 * been visually verified to match the module's real rendered layout. A skeleton
 * that looks nothing like the resulting layout is never acceptable — it is worse
 * than no skeleton. When in doubt, leave the module out; it uses the neutral
 * loader (SHARED_SHELL: a thin bar over the background that claims no shape).
 *
 * The registry is intentionally EMPTY today. The earlier Create (fake workspace
 * grid) and Browse (fake list-rail + single card row) skeletons matched neither
 * module's real layout and were removed. To add one back, build it against the
 * real rendered DOM and confirm it visually before registering here.
 */
const REGISTRY: Record<string, Component> = {};

export function resolveSkeleton(moduleKey: string | null): Component {
  if (!moduleKey) return SHARED_SHELL;
  return REGISTRY[moduleKey] ?? SHARED_SHELL;
}

import type { Component } from "svelte";
import SharedShellSkeleton from "./SharedShellSkeleton.svelte";
import BrowseSkeleton from "./BrowseSkeleton.svelte";

export const SHARED_SHELL: Component = SharedShellSkeleton;

/**
 * Bespoke skeletons keyed by module id. A bespoke skeleton EARNS its place only
 * by accurately mirroring that module's real layout — a wrong-shaped skeleton is
 * worse than the neutral fallback. Browse is a simple, static section-index +
 * card grid, so its skeleton matches. Create deliberately has NO bespoke
 * skeleton: its layout (StandardWorkspaceLayout) is stateful and responsive
 * (empty = full picker; mid-sequence = workspace + picker; wide = side-by-side),
 * so it falls back to the neutral loader and then shows its own internal init
 * bar. Everything else uses SHARED_SHELL.
 */
const REGISTRY: Record<string, Component> = {
  browse: BrowseSkeleton,
  // backwards-compat alias: library resolves to Browse in ModuleRenderer
  library: BrowseSkeleton,
};

export function resolveSkeleton(moduleKey: string | null): Component {
  if (!moduleKey) return SHARED_SHELL;
  return REGISTRY[moduleKey] ?? SHARED_SHELL;
}

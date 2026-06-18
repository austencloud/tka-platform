import type { Component } from "svelte";
import SharedShellSkeleton from "./SharedShellSkeleton.svelte";
import CreateSkeleton from "./CreateSkeleton.svelte";
import BrowseSkeleton from "./BrowseSkeleton.svelte";

export const SHARED_SHELL: Component = SharedShellSkeleton;

/** Bespoke skeletons keyed by module id. Everything else uses SHARED_SHELL. */
const REGISTRY: Record<string, Component> = {
  create: CreateSkeleton,
  browse: BrowseSkeleton,
  // backwards-compat alias: library resolves to Browse in ModuleRenderer
  library: BrowseSkeleton,
};

export function resolveSkeleton(moduleKey: string | null): Component {
  if (!moduleKey) return SHARED_SHELL;
  return REGISTRY[moduleKey] ?? SHARED_SHELL;
}

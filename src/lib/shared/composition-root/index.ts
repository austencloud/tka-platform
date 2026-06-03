/**
 * Composition Root
 *
 * The single sanctioned location where features/ implementations are wired
 * into shared/ service slots. This is the ONLY file in shared/ that may
 * import from features/ — all other shared/ files use interfaces and
 * registration patterns to avoid reverse imports.
 *
 * Boot sequence:
 *   1. +layout.svelte dynamically imports this module
 *   2. Critical registrations fire synchronously (Browse/Create deps)
 *   3. Deferred registrations load via requestIdleCallback
 *   4. Factory getters throughout shared/ can now resolve their deps
 */

// ── Critical: needed before first Browse/Create render ──
import { configureShortCodeManager } from "../qr/get-short-code-manager";
import { getBrowseLoader } from "$lib/shared/browse/get-browse-loader";

import { registerLoopDetector } from "../create/get-loop-detector";
import { loopDetector } from "$lib/features/create/generate/circular/services/loop-detector";

import { registerLoopDisplayResolver } from "../loop-labeler/get-loop-display-resolver";
import { resolveLoopDisplay } from "$lib/features/loop-labeler/services/loop-display-resolver";

import { isBootProfileVerbose } from "../analytics/boot-profiler";

const _bootStart = typeof window !== 'undefined' ? performance.now() : 0;

// ── Critical registrations (browser-only) ──
if (typeof window !== 'undefined') {
  configureShortCodeManager(getBrowseLoader());
  registerLoopDetector(loopDetector);
  registerLoopDisplayResolver(resolveLoopDisplay);
}

if (typeof window !== 'undefined' && isBootProfileVerbose()) {
  const totalBoot = performance.now() - _bootStart;
  console.log(
    `%c Composition root (critical) - ${Math.round(totalBoot)}ms`,
    "font-size: 13px; font-weight: bold; color: #81c784;"
  );
}

// ── Deferred registrations: video export, generation engine, library sync, etc. ──
// These pull heavy deps (mediabunny, @tka/sequence-engine, content-moderator)
// that aren't needed for first render. Load after browser is idle.
if (typeof window !== 'undefined') {
  const load = () => import("./deferred-registrations");
  if ('requestIdleCallback' in window) {
    requestIdleCallback(() => load());
  } else {
    setTimeout(() => load(), 100);
  }
}

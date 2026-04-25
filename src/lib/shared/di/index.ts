/**
 * Application Dependency Injection — Module Singleton Getters
 *
 * All services have been migrated to module-level singleton getters
 * colocated with their implementations. This file exists solely as
 * the bootstrap entry point:
 *
 *   1. +layout.svelte dynamically imports this module, triggering
 *      side-effect registrations (e.g. ShortCodeManager configuration).
 *   2. The `container` export is retained for the "di-container" context
 *      provider in +layout.svelte (legacy compatibility).
 *
 * To access a service, import its getter directly:
 *   import { getAuthenticator } from "$lib/shared/auth/getAuthenticator";
 *   const auth = getAuthenticator();
 */

import { createContainer } from "iti";

// Side-effect: configure ShortCodeManager with browse dep
import { configureShortCodeManager } from "../qr/getShortCodeManager";
import { getBrowseLoader } from "$lib/features/browse/sequences/display/getBrowseLoader";

// Side-effect: late-bind QR generator into ImageComposer
import { getQRCodeGenerator } from "../qr/getQRCodeGenerator";
import { getImageComposer } from "../render/getImageComposer";

// Boot profiler
import { isBootProfileVerbose } from "../analytics/boot-profiler";

// Pictograph singleton imports (eagerly loaded for perf — used on every card render)
import { motionQueryHandler } from "$lib/shared/pictograph/shared/services/implementations/MotionQueryHandler";
import { gridModeDeriver } from "$lib/shared/pictograph/grid/services/implementations/GridModeDeriver";
import { gridPositionDeriver } from "$lib/shared/pictograph/grid/services/implementations/GridPositionDeriver";
import { startPositionDeriver } from "$lib/shared/pictograph/shared/services/implementations/StartPositionDeriver";
import { orientationCalculator } from "$lib/shared/pictograph/prop/services/implementations/OrientationCalculator";
import { betaDetector } from "$lib/shared/pictograph/prop/services/implementations/BetaDetector";
import { arrowPositioningOrchestrator } from "$lib/shared/pictograph/arrow/orchestration/services/implementations/ArrowPositioningOrchestrator";
import { letterQueryHandler } from "$lib/shared/pictograph/tka-glyph/services/implementations/LetterQueryHandler";
import { screenSpaceAdjustmentTransformer } from "$lib/shared/pictograph/arrow/positioning/calculation/services/implementations/ScreenSpaceAdjustmentTransformer";
import { arrowAdjustmentCalculator } from "$lib/shared/pictograph/arrow/positioning/calculation/services/implementations/ArrowAdjustmentCalculator";
import { arrowLocationCalculator } from "$lib/shared/pictograph/arrow/positioning/calculation/services/implementations/ArrowLocationCalculator";
import { pictographPreparer } from "$lib/shared/pictograph/shared/services/implementations/PictographPreparer";
import { turnsTupleGenerator } from "$lib/shared/pictograph/arrow/positioning/placement/services/implementations/TurnsTupleGenerator";

// ============================================================================
// BOOT PROFILER
// ============================================================================
const _diStart = typeof window !== 'undefined' ? performance.now() : 0;

// ============================================================================
// SIDE-EFFECT REGISTRATIONS (browser-only)
// ============================================================================
if (typeof window !== 'undefined') {
  configureShortCodeManager(getBrowseLoader());
}

// ============================================================================
// MINIMAL CONTAINER (retained for legacy context provider)
// ============================================================================
function buildAppContainer(): any {
  let c: any = createContainer();

  // Pictograph singletons (export const pattern — not getters, must be registered)
  c = c.add({
    motionQueryHandler: () => motionQueryHandler,
    gridModeDeriver: () => gridModeDeriver,
    gridPositionDeriver: () => gridPositionDeriver,
    startPositionDeriver: () => startPositionDeriver,
    orientationCalculator: () => orientationCalculator,
    betaDetector: () => betaDetector,
    arrowPositioningOrchestrator: () => arrowPositioningOrchestrator,
    letterQueryHandler: () => letterQueryHandler,
    screenSpaceAdjustmentTransformer: () => screenSpaceAdjustmentTransformer,
    arrowAdjustmentCalculator: () => arrowAdjustmentCalculator,
    arrowLocationCalculator: () => arrowLocationCalculator,
    pictographPreparer: () => pictographPreparer,
    turnsTupleGenerator: () => turnsTupleGenerator,
  });

  return c;
}

export const container = (typeof window !== 'undefined' ? buildAppContainer() : null) as unknown as
  { items: Record<string, unknown> };

// Log DI timing (verbose; gate behind ?profile=1)
if (typeof window !== 'undefined' && isBootProfileVerbose()) {
  const totalDI = performance.now() - _diStart;
  console.log(
    `%c DI bootstrap — ${Math.round(totalDI)}ms`,
    "font-size: 13px; font-weight: bold; color: #81c784;"
  );
}

// Late binding: Inject QR generator into ImageComposer
if (typeof window !== 'undefined') {
  try {
    const composer = getImageComposer();
    if (composer) {
      (composer as unknown as { setQRCodeGenerator: (g: unknown) => void }).setQRCodeGenerator(
        getQRCodeGenerator()
      );
    }
  } catch {
    // ImageComposer not yet initialized — QR injection will happen on first use
  }
}

// Export type for legacy compatibility
export type AppContainer = { items: Record<string, unknown> };

export default container;

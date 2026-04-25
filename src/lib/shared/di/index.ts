/**
 * Application Bootstrap Entry Point
 *
 * All services are module-level singleton getters colocated with their
 * implementations. This file exists solely as the bootstrap entry point:
 *
 *   1. +layout.svelte dynamically imports this module, triggering
 *      side-effect registrations (e.g. ShortCodeManager configuration).
 *   2. The `container` export is retained for the "di-container" context
 *      provider in +layout.svelte (legacy compatibility — will be removed
 *      once all getContext("di-container") call sites are confirmed gone).
 *
 * To access a service, import its getter directly:
 *   import { getAuthenticator } from "$lib/shared/auth/getAuthenticator";
 *   const auth = getAuthenticator();
 */

// Side-effect: configure ShortCodeManager with browse dep
import { configureShortCodeManager } from "../qr/getShortCodeManager";
import { getBrowseLoader } from "$lib/features/browse/sequences/display/getBrowseLoader";

// Side-effect: late-bind QR generator into ImageComposer
import { getQRCodeGenerator } from "../qr/getQRCodeGenerator";
import { getImageComposer } from "../render/getImageComposer";

// Boot profiler
import { isBootProfileVerbose } from "../analytics/boot-profiler";

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
// LEGACY CONTAINER SHIM (empty — no services registered)
// ============================================================================
export const container = (typeof window !== 'undefined' ? { items: {} } : null) as unknown as
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

export type AppContainer = { items: Record<string, unknown> };

export default container;

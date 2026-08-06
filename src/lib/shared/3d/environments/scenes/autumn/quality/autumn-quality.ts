import type { WebGLRenderer } from "three";

export type AutumnQualityTier = "low" | "medium" | "high";

export interface AutumnQualityConfig {
  fillTreeCount: number;
  mushroomCount: number;
  leafCount: number;
  sporeCount: number;
  fireflyCount: number;
  wispCount: number;
  pondReflector: boolean;
  godRays: boolean;
  shadows: boolean;
}

const CONFIGS: Record<AutumnQualityTier, AutumnQualityConfig> = {
  // Ocean "ultra" → autumn "high"
  high: {
    fillTreeCount: 36,
    mushroomCount: 18,
    leafCount: 140,
    sporeCount: 60,
    fireflyCount: 36,
    wispCount: 5,
    pondReflector: false,
    godRays: false,
    shadows: false,
  },
  // Ocean "medium" → autumn "medium"
  medium: {
    fillTreeCount: 28,
    mushroomCount: 14,
    leafCount: 90,
    sporeCount: 40,
    fireflyCount: 24,
    wispCount: 4,
    pondReflector: false,
    godRays: false,
    shadows: false,
  },
  // Ocean "low" → autumn "low"
  low: {
    fillTreeCount: 18,
    mushroomCount: 10,
    leafCount: 50,
    sporeCount: 20,
    fireflyCount: 12,
    wispCount: 3,
    pondReflector: false,
    godRays: false,
    shadows: false,
  },
};

export function getAutumnQualityConfig(
  tier: AutumnQualityTier
): AutumnQualityConfig {
  return CONFIGS[tier];
}

/**
 * Detects the appropriate quality tier for the current device.
 *
 * Heuristic mirrors detectOceanQuality (ocean-quality.ts):
 *   - null renderer → "medium" (no renderer context, assume mid-range; ocean returns "ultra" but
 *     autumn uses "medium" as the safe default since null means SSR / test environment)
 *   - mobile UA or known low-end GPU renderer string → "low"
 *   - integrated GPU (Intel/UHD/Iris) → "medium"
 *   - everything else (discrete GPU, high core count) → "high"   (maps from ocean's "ultra")
 *
 * Tier name mapping from ocean → autumn:
 *   ocean "ultra"  → autumn "high"
 *   ocean "medium" → autumn "medium"
 *   ocean "low"    → autumn "low"
 */
export function detectAutumnQuality(
  renderer: WebGLRenderer | null
): AutumnQualityTier {
  if (!renderer) return "medium";

  const gl = renderer.getContext();
  const debugInfo = gl.getExtension("WEBGL_debug_renderer_info");
  const gpuRenderer: string = debugInfo
    ? (gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) as string)
    : "";

  const isMobile = /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent);
  const isLowEnd = /SwiftShader|llvmpipe|Mali-4|Adreno [23]/i.test(gpuRenderer);
  const cores = navigator.hardwareConcurrency ?? 4;

  if (isMobile || isLowEnd || cores <= 4) return "low";
  if (/Intel|integrated|UHD|Iris/i.test(gpuRenderer)) return "medium";
  return "high";
}

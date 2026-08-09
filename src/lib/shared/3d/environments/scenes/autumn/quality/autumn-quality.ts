import type { WebGLRenderer } from "three";

export type AutumnQualityTier = "low" | "medium" | "high";

export interface AutumnQualityConfig {
  fillTreeCount: number;
  mushroomCount: number;
  leafCount: number;
  sporeCount: number;
  fireflyCount: number;
  wispCount: number;
  /**
   * Contact shadows from the moon key. Off on `low` because the extra depth
   * pass is the first thing a weak GPU cannot afford.
   */
  shadows: boolean;
  /**
   * Shadow map resolution. The camera spans 40m to cover tree-length shadows,
   * so 1024 gives ~26 texels/m — enough for soft contact, visibly stepped on
   * trunk edges. High doubles it.
   */
  shadowMapSize: number;
}

const CONFIGS: Record<AutumnQualityTier, AutumnQualityConfig> = {
  high: {
    fillTreeCount: 36,
    mushroomCount: 18,
    leafCount: 140,
    sporeCount: 60,
    fireflyCount: 36,
    wispCount: 5,
    shadows: true,
    shadowMapSize: 2048,
  },
  medium: {
    fillTreeCount: 28,
    mushroomCount: 14,
    leafCount: 90,
    sporeCount: 40,
    fireflyCount: 24,
    wispCount: 4,
    shadows: true,
    shadowMapSize: 1024,
  },
  low: {
    fillTreeCount: 18,
    mushroomCount: 10,
    leafCount: 50,
    sporeCount: 20,
    fireflyCount: 12,
    wispCount: 3,
    shadows: false,
    shadowMapSize: 1024,
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
 *   - null renderer → "medium" (SSR / test environment, assume mid-range)
 *   - mobile UA, known low-end GPU string, or <= 4 cores → "low"
 *   - integrated GPU (Intel/UHD/Iris) → "medium"
 *   - everything else (discrete GPU, high core count) → "high"
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

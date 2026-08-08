import type { WebGLRenderer } from "three";
import type { WinterDetailTier } from "../authored/winter-layout";

export interface WinterQualityConfig {
  pondSurfaceDetail: "full" | "reduced";
  sceneryMultiplier: number;
  snowMultiplier: number;
  shadows: boolean;
}

const CONFIGS: Record<WinterDetailTier, WinterQualityConfig> = {
  high: {
    pondSurfaceDetail: "full",
    sceneryMultiplier: 1,
    snowMultiplier: 1,
    shadows: true,
  },
  medium: {
    pondSurfaceDetail: "reduced",
    sceneryMultiplier: 0.72,
    snowMultiplier: 0.72,
    shadows: false,
  },
  low: {
    pondSurfaceDetail: "reduced",
    sceneryMultiplier: 0.45,
    snowMultiplier: 0.42,
    shadows: false,
  },
};

export function getWinterQualityConfig(
  tier: WinterDetailTier
): WinterQualityConfig {
  return CONFIGS[tier];
}

export function detectWinterQuality(
  renderer: WebGLRenderer | null
): WinterDetailTier {
  if (!renderer || typeof navigator === "undefined") return "medium";

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

import type { QualityTier, QualityTierConfig } from "../../types";

export interface GPUCapabilities {
  maxTextureUnits: number;
  floatTextures: boolean;
  hardwareConcurrency: number;
  isWebGPU: boolean;
}

export interface IQualityTierDetector {
  readonly currentTier: QualityTier;
  readonly currentConfig: QualityTierConfig;
  detectFromCapabilities(capabilities: GPUCapabilities): QualityTier;
  detectFromRenderer(renderer: unknown): QualityTier;
  setOverride(tier: QualityTier): void;
  clearOverride(): void;
  downgrade(): void;
}

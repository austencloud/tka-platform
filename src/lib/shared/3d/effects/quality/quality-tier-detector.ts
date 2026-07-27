import { QualityTier, TIER_CONFIGS } from "../types";
import type { QualityTierConfig } from "../types";
export interface GPUCapabilities {
  maxTextureUnits: number;
  floatTextures: boolean;
  hardwareConcurrency: number;
  isWebGPU: boolean;
}

const STORAGE_KEY = "tka-3d-quality-tier-override";

export class QualityTierDetector {
  private detectedTier: QualityTier = QualityTier.MEDIUM;
  private overrideTier: QualityTier | null = null;

  constructor() {
    this.loadOverride();
  }

  get currentTier(): QualityTier {
    return this.overrideTier ?? this.detectedTier;
  }

  get currentConfig(): QualityTierConfig {
    return TIER_CONFIGS[this.currentTier];
  }

  get hasOverride(): boolean {
    return this.overrideTier !== null;
  }

  detectFromCapabilities(capabilities: GPUCapabilities): QualityTier {
    if (capabilities.isWebGPU) {
      this.detectedTier = QualityTier.HIGH;
    } else if (
      capabilities.floatTextures &&
      capabilities.hardwareConcurrency >= 8 &&
      capabilities.maxTextureUnits >= 16
    ) {
      this.detectedTier = QualityTier.HIGH;
    } else if (
      capabilities.floatTextures &&
      capabilities.hardwareConcurrency >= 4
    ) {
      this.detectedTier = QualityTier.MEDIUM;
    } else {
      this.detectedTier = QualityTier.LOW;
    }
    return this.currentTier;
  }

  detectFromRenderer(renderer: unknown): QualityTier {
    const gl = renderer as {
      isWebGPURenderer?: boolean;
      capabilities?: {
        maxTextures?: number;
        floatFragmentTextures?: boolean;
        isWebGPU?: boolean;
      };
      extensions?: {
        has?: (extensionName: string) => boolean;
      };
      getContext?: () => {
        getExtension?: (extensionName: string) => unknown;
      };
    };
    const caps = gl?.capabilities;
    const supportsFloatColorBuffers =
      caps?.floatFragmentTextures === true ||
      gl.extensions?.has?.("EXT_color_buffer_float") === true ||
      Boolean(gl.getContext?.().getExtension?.("EXT_color_buffer_float"));

    return this.detectFromCapabilities({
      maxTextureUnits: caps?.maxTextures ?? 8,
      floatTextures: supportsFloatColorBuffers,
      hardwareConcurrency:
        typeof navigator !== "undefined"
          ? (navigator.hardwareConcurrency ?? 4)
          : 4,
      isWebGPU:
        gl.isWebGPURenderer === true || caps?.isWebGPU === true,
    });
  }

  setOverride(tier: QualityTier): void {
    this.overrideTier = tier;
    this.persistOverride(tier);
  }

  clearOverride(): void {
    this.overrideTier = null;
    this.removePersistedOverride();
  }

  downgrade(): void {
    const order = [QualityTier.HIGH, QualityTier.MEDIUM, QualityTier.LOW];
    const currentIndex = order.indexOf(this.currentTier);
    if (currentIndex < order.length - 1) {
      // Index is guaranteed valid by the bounds check above
      this.detectedTier = order[currentIndex + 1] as QualityTier;
    }
  }

  private loadOverride(): void {
    if (typeof localStorage === "undefined") return;
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (
        stored &&
        Object.values(QualityTier).includes(stored as QualityTier)
      ) {
        this.overrideTier = stored as QualityTier;
      }
    } catch {
      // localStorage unavailable
    }
  }

  private persistOverride(tier: QualityTier): void {
    if (typeof localStorage === "undefined") return;
    try {
      localStorage.setItem(STORAGE_KEY, tier);
    } catch {
      // localStorage unavailable
    }
  }

  private removePersistedOverride(): void {
    if (typeof localStorage === "undefined") return;
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // localStorage unavailable
    }
  }
}

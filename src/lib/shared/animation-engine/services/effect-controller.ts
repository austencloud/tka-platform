import type { EffectRendererManager } from "./effect-renderer-manager";
import type { FireOverlayConfig } from "../domain/types/FireTypes";
import type { LedOverlayConfig } from "../domain/types/LedTypes";
import type { TipEffectMap, TipEffortMap } from "../domain/types/TipEffectTypes";

export interface DiagnosticContext {
  isInitialized: boolean;
  isPlaying: boolean;
  currentStep: number;
  canvasSize: number;
  instanceId: string;
}

export class EffectController {
  constructor(private readonly effectManager: EffectRendererManager) {}

  setFireConfig(config: Partial<FireOverlayConfig>): void {
    this.effectManager.setFireConfig(config);
  }

  getFireConfig(): FireOverlayConfig {
    return this.effectManager.getFireConfig();
  }

  setLedConfig(config: Partial<LedOverlayConfig>): void {
    this.effectManager.setLedConfig(config);
  }

  getLedConfig(): LedOverlayConfig {
    return this.effectManager.getLedConfig();
  }

  setCellTipEffectMap(map: TipEffectMap | undefined): void {
    this.effectManager.setCellTipEffectMap(map);
  }

  setCellTipEffortMap(map: TipEffortMap | undefined): void {
    this.effectManager.setCellTipEffortMap(map);
  }

  invalidateFireCache(): void {
    this.effectManager.fireRenderer?.clearSimulation();
    this.effectManager.charcoalRenderer?.clearSimulation();
    this.effectManager.ledRenderer?.resetExportState();
  }

  invalidateFireFrameCacheOnly(): void {
    this.effectManager.fireRenderer?.invalidateFrameCache();
  }

  clearFireThermalFields(): void {
    this.effectManager.fireRenderer?.clearThermalFields();
    this.effectManager.charcoalRenderer?.clearSimulation();
    this.effectManager.ledRenderer?.resetExportState();
  }

  captureDiagnostics(context: DiagnosticContext): Record<string, unknown> {
    return {
      timestamp: new Date().toISOString(),
      performanceNow: performance.now(),
      instanceId: context.instanceId,
      engineState: {
        isInitialized: context.isInitialized,
        isPlaying: context.isPlaying,
        currentStep: context.currentStep,
        canvasSize: context.canvasSize,
      },
      fireConfig: this.effectManager.fireConfig,
    };
  }
}

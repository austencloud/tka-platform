import type { EffortId, EffortParams } from "$lib/features/effort-lab/domain/effort-types";

export type HapticImpactStyle = "light" | "medium" | "heavy";
export type HapticNotificationType = "success" | "warning" | "error";

export type HapticFeedbackType =
  | "selection"
  | "success"
  | "warning"
  | "error"
  | "custom";

export interface HapticFeedbackConfig {
  enabled: boolean;
  respectReducedMotion: boolean;
  throttleTime: number;
  customPatterns: Record<string, number[]>;
}

export interface IHapticFeedback {
  impact(style: HapticImpactStyle): boolean;
  notification(type: HapticNotificationType): boolean;
  selection(): boolean;

  trigger(type?: HapticFeedbackType): boolean;

  triggerEffort(
    effortId: EffortId,
    params?: EffortParams,
    durationMs?: number
  ): boolean;

  setCustomPattern(name: string, pattern: number[]): void;
  triggerCustom(name: string): boolean;

  isSupported(): boolean;
  setEnabled(enabled: boolean): void;
  isEnabled(): boolean;
  getConfig(): HapticFeedbackConfig;
  updateConfig(config: Partial<HapticFeedbackConfig>): void;
}

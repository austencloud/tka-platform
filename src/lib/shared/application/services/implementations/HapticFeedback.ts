import { browser } from "$app/environment";
import type { EffortId, EffortParams } from "$lib/features/effort-lab/domain/effort-types";
import { EffortHapticMapper } from "$lib/features/effort-lab/services/implementations/EffortHapticMapper";
import type {
  HapticFeedbackConfig,
  HapticFeedbackType,
  HapticImpactStyle,
  HapticNotificationType,
  IHapticFeedback,
} from "../contracts/IHapticFeedback";
import type { IPlatformDetector } from "$lib/shared/platform/services/contracts/IPlatformDetector";

const DEFAULT_CONFIG: HapticFeedbackConfig = {
  enabled: true,
  respectReducedMotion: true,
  throttleTime: 50,
  customPatterns: {},
};

export class HapticFeedback implements IHapticFeedback {
  private lastFeedbackTime: number = 0;
  private config: HapticFeedbackConfig = { ...DEFAULT_CONFIG };
  private effortMapper: EffortHapticMapper | null = null;
  private nativePlatformDetector: IPlatformDetector | null;

  constructor(nativePlatformDetector?: IPlatformDetector) {
    this.nativePlatformDetector = nativePlatformDetector ?? null;
    this.setupReducedMotionListener();
  }

  public impact(style: HapticImpactStyle): boolean {
    if (!this.canTrigger()) return false;
    this.lastFeedbackTime = Date.now();
    return this.nativeImpact(style);
  }

  public notification(type: HapticNotificationType): boolean {
    if (!this.canTrigger()) return false;
    this.lastFeedbackTime = Date.now();
    return this.nativeNotification(type);
  }

  public selection(): boolean {
    if (!this.canTrigger()) return false;
    this.lastFeedbackTime = Date.now();
    return this.nativeSelection();
  }

  public trigger(type: HapticFeedbackType = "selection"): boolean {
    switch (type) {
      case "selection":
        return this.impact("medium");
      case "success":
        return this.notification("success");
      case "warning":
        return this.notification("warning");
      case "error":
        return this.notification("error");
      case "custom":
        return false;
    }
  }

  public triggerEffort(
    effortId: EffortId,
    params?: EffortParams,
    durationMs?: number
  ): boolean {
    if (!this.canTrigger()) return false;
    if (!this.isNative()) return false;
    this.lastFeedbackTime = Date.now();

    if (!this.effortMapper) {
      this.effortMapper = new EffortHapticMapper();
    }

    const pattern = this.effortMapper.generatePattern(effortId, params, durationMs);
    this.playPatternAsNativeImpacts(pattern);
    return true;
  }

  public setCustomPattern(name: string, pattern: number[]): void {
    this.config.customPatterns[name] = [...pattern];
  }

  public triggerCustom(name: string): boolean {
    if (!this.canTrigger()) return false;
    if (!this.isNative()) return false;

    const pattern = this.config.customPatterns[name];
    if (!pattern) return false;

    this.lastFeedbackTime = Date.now();
    this.playPatternAsNativeImpacts(pattern);
    return true;
  }

  public isSupported(): boolean {
    return this.isNative();
  }

  public setEnabled(enabled: boolean): void {
    this.config.enabled = enabled;
  }

  public isEnabled(): boolean {
    return this.config.enabled;
  }

  public getConfig(): HapticFeedbackConfig {
    return { ...this.config };
  }

  public updateConfig(config: Partial<HapticFeedbackConfig>): void {
    this.config = { ...this.config, ...config };
  }

  private isNative(): boolean {
    return this.nativePlatformDetector?.isNative === true;
  }

  private nativeImpact(style: HapticImpactStyle): boolean {
    if (!this.isNative()) return false;
    import("@capacitor/haptics").then(({ Haptics, ImpactStyle }) => {
      const styleMap: Record<HapticImpactStyle, typeof ImpactStyle[keyof typeof ImpactStyle]> = {
        light: ImpactStyle.Light,
        medium: ImpactStyle.Medium,
        heavy: ImpactStyle.Heavy,
      };
      Haptics.impact({ style: styleMap[style] });
    }).catch(() => {});
    return true;
  }

  private nativeNotification(type: HapticNotificationType): boolean {
    if (!this.isNative()) return false;
    import("@capacitor/haptics").then(({ Haptics, NotificationType }) => {
      const typeMap: Record<HapticNotificationType, typeof NotificationType[keyof typeof NotificationType]> = {
        success: NotificationType.Success,
        warning: NotificationType.Warning,
        error: NotificationType.Error,
      };
      Haptics.notification({ type: typeMap[type] });
    }).catch(() => {});
    return true;
  }

  private nativeSelection(): boolean {
    if (!this.isNative()) return false;
    import("@capacitor/haptics").then(({ Haptics }) => {
      Haptics.selectionChanged();
    }).catch(() => {});
    return true;
  }

  private playPatternAsNativeImpacts(pattern: number[]): void {
    let timeOffset = 0;
    for (let i = 0; i < pattern.length; i++) {
      const duration = pattern[i] ?? 0;
      if (i % 2 === 0 && duration > 0) {
        setTimeout(() => this.nativeImpact("light"), timeOffset);
      }
      timeOffset += duration;
    }
  }

  private canTrigger(): boolean {
    if (!browser) return false;
    if (!this.config.enabled) return false;
    const now = Date.now();
    if (now - this.lastFeedbackTime < this.config.throttleTime) return false;
    return true;
  }

  private setupReducedMotionListener(): void {
    if (!browser || !window.matchMedia) return;
    try {
      const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
      if (mq.matches && this.config.respectReducedMotion) {
        this.config.enabled = false;
      }
      mq.addEventListener("change", (e) => {
        if (this.config.respectReducedMotion && e.matches) {
          this.config.enabled = false;
        }
      });
    } catch {}
  }
}

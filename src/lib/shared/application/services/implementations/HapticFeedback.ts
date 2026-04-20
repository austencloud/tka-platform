/**
 * Haptic Feedback Service Implementation
 *
 * Provides haptic feedback capabilities for mobile devices with proper
 * accessibility considerations, browser compatibility, and performance optimization.
 *
 * Supports:
 * - Android: Standard Vibration API (navigator.vibrate)
 * - iOS 17.4+: Checkbox switch hack (Safari-specific)
 * - Graceful degradation on unsupported platforms
 */

import { browser } from "$app/environment";
import type { EffortId, EffortParams } from "$lib/features/effort-lab/domain/effort-types";
import { EffortHapticMapper } from "$lib/features/effort-lab/services/implementations/EffortHapticMapper";
import type {
  HapticFeedbackConfig,
  HapticFeedbackType,
  IHapticFeedback,
} from "../contracts/IHapticFeedback";
import type { IPlatformDetector } from "$lib/shared/platform/services/contracts/IPlatformDetector";

// Feedback patterns (in milliseconds for Vibration API)
// For iOS, these map to number of haptic pulses
const FEEDBACK_PATTERNS: Record<
  Exclude<HapticFeedbackType, "custom">,
  number[]
> = {
  selection: [70], // Single pulse
  success: [100, 30, 50], // Double pulse
  warning: [60, 0, 60], // Double pulse
  error: [100, 0, 100, 0, 100], // Triple pulse
};

// iOS pulse counts for each feedback type
const IOS_PULSE_COUNTS: Record<
  Exclude<HapticFeedbackType, "custom">,
  number
> = {
  selection: 1,
  success: 2,
  warning: 2,
  error: 3,
};

// Default configuration
const DEFAULT_CONFIG: HapticFeedbackConfig = {
  enabled: true,
  respectReducedMotion: true,
  throttleTime: 50, // Reduced for snappier iOS response
  customPatterns: {},
};

export class HapticFeedback implements IHapticFeedback {
  private lastFeedbackTime: number = 0;
  private config: HapticFeedbackConfig = { ...DEFAULT_CONFIG };

  // Platform support flags
  private supportsVibrationAPI: boolean = false;
  private supportsIOSHaptic: boolean = false;

  // Cached iOS haptic element (reused for performance)
  private iosHapticInput: HTMLInputElement | null = null;

  // Effort-to-haptic pattern converter (lazy-initialized)
  private effortMapper: EffortHapticMapper | null = null;

  // Capacitor native platform detector (optional — null on web-only builds)
  private nativePlatformDetector: IPlatformDetector | null;

  constructor(nativePlatformDetector?: IPlatformDetector) {
    this.nativePlatformDetector = nativePlatformDetector ?? null;
    this.initializeService();
  }

  // ============================================================================
  // PUBLIC API
  // ============================================================================

  public trigger(type: HapticFeedbackType = "selection"): boolean {
    if (!this.canTriggerFeedback()) {
      return false;
    }

    // Update throttle time
    this.lastFeedbackTime = Date.now();

    // Native Capacitor: Use Taptic Engine (iOS) / Android vibration directly
    if (this.nativePlatformDetector?.isNative) {
      this.triggerNativeHaptic(type);
      return true;
    }

    // iOS Safari: Use checkbox hack
    if (this.supportsIOSHaptic) {
      const pulseCount = type === "custom" ? 1 : IOS_PULSE_COUNTS[type];
      return this.triggerIOSHaptic(pulseCount);
    }

    // Android/Other: Use Vibration API
    if (this.supportsVibrationAPI) {
      const pattern = type === "custom" ? [] : FEEDBACK_PATTERNS[type];
      return this.vibrate(pattern);
    }

    return false;
  }

  public setCustomPattern(name: string, pattern: number[]): void {
    this.config.customPatterns[name] = [...pattern];
  }

  public triggerCustom(name: string): boolean {
    if (!this.canTriggerFeedback()) {
      return false;
    }

    const pattern = this.config.customPatterns[name];
    if (!pattern) {
      console.warn(`Custom haptic pattern '${name}' not found`);
      return false;
    }

    // Update throttle time
    this.lastFeedbackTime = Date.now();

    // iOS: Count the pulses in the pattern (number of non-zero values)
    if (this.supportsIOSHaptic) {
      const pulseCount = pattern.filter((v) => v > 0).length || 1;
      return this.triggerIOSHaptic(pulseCount);
    }

    // Android: Use the pattern directly
    if (this.supportsVibrationAPI) {
      return this.vibrate(pattern);
    }

    return false;
  }

  public isSupported(): boolean {
    if (this.nativePlatformDetector?.isNative) return true;
    return this.supportsVibrationAPI || this.supportsIOSHaptic;
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

  public triggerEffort(
    effortId: EffortId,
    params?: EffortParams,
    durationMs?: number
  ): boolean {
    if (!this.canTriggerFeedback()) {
      return false;
    }

    this.lastFeedbackTime = Date.now();

    if (!this.effortMapper) {
      this.effortMapper = new EffortHapticMapper();
    }

    if (this.supportsIOSHaptic) {
      const pulseCount = this.effortMapper.getIOSPulseCount(effortId, params);
      return this.triggerIOSHaptic(pulseCount);
    }

    if (this.supportsVibrationAPI) {
      const pattern = this.effortMapper.generatePattern(effortId, params, durationMs);
      return this.vibrate(pattern);
    }

    return false;
  }

  // ============================================================================
  // PRIVATE METHODS - INITIALIZATION
  // ============================================================================

  private initializeService(): void {
    this.detectPlatformSupport();
    this.setupReducedMotionListener();

    // Pre-create iOS haptic element if supported
    if (this.supportsIOSHaptic) {
      this.createIOSHapticElement();
    }
  }

  /**
   * Detect platform-specific haptic support
   */
  private detectPlatformSupport(): void {
    if (!browser) {
      return;
    }

    // Check standard Vibration API (Android Chrome, Firefox, etc.)
    try {
      this.supportsVibrationAPI =
        "vibrate" in navigator &&
        typeof navigator.vibrate === "function" &&
        (navigator.maxTouchPoints ?? 0) > 0;
    } catch {
      this.supportsVibrationAPI = false;
    }

    // Check iOS Safari 17.4+ support
    this.supportsIOSHaptic = this.detectIOSSafariSupport();
  }

  /**
   * Detect if running on iOS Safari 17.4+ which supports the checkbox haptic hack
   */
  private detectIOSSafariSupport(): boolean {
    if (!browser) return false;

    try {
      const ua = navigator.userAgent;

      // Must be iOS (iPhone, iPad, iPod)
      const isIOS = /iPhone|iPad|iPod/.test(ua);
      if (!isIOS) return false;

      // Extract iOS version
      const iosVersionMatch = ua.match(/OS (\d+)_(\d+)/);
      if (!iosVersionMatch) return false;

      const majorVersion = parseInt(iosVersionMatch[1] ?? "0", 10);
      const minorVersion = parseInt(iosVersionMatch[2] ?? "0", 10);

      // Need iOS 17.4 or higher
      if (majorVersion < 17) return false;
      if (majorVersion === 17 && minorVersion < 4) return false;

      // Check if it's actually Safari (not Chrome/Firefox wrapper that might not support it)
      // Safari on iOS includes "Safari" but not "CriOS" (Chrome) or "FxiOS" (Firefox)
      const isSafari = /Safari/.test(ua) && !/CriOS|FxiOS/.test(ua);

      // Also support WKWebView-based browsers and PWAs
      const isWebKit = /AppleWebKit/.test(ua);

      return isSafari || isWebKit;
    } catch {
      return false;
    }
  }

  /**
   * Setup listener for reduced motion preference changes
   */
  private setupReducedMotionListener(): void {
    if (!browser || !window.matchMedia) {
      return;
    }

    try {
      const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");

      // Check initial state
      this.handleReducedMotionChange(mediaQuery);

      // Listen for changes
      const handler = (event: MediaQueryListEvent) => {
        this.handleReducedMotionChange(event);
      };
      mediaQuery.addEventListener("change", handler);
    } catch (error) {
      console.warn("Could not set up reduced motion listener:", error);
    }
  }

  /**
   * Handle changes to reduced motion preference
   */
  private handleReducedMotionChange(
    mediaQuery: MediaQueryList | MediaQueryListEvent
  ): void {
    if (!this.config.respectReducedMotion) {
      return;
    }

    // Disable haptic feedback if user prefers reduced motion
    if (mediaQuery.matches) {
      this.config.enabled = false;
    }
  }

  // ============================================================================
  // PRIVATE METHODS - iOS HAPTIC (Checkbox Hack)
  // ============================================================================

  /**
   * Create the hidden checkbox element used to trigger iOS haptics
   */
  private createIOSHapticElement(): void {
    if (!browser || this.iosHapticInput) return;

    try {
      const input = document.createElement("input");
      input.type = "checkbox";
      input.setAttribute("switch", ""); // Safari's magic attribute
      input.setAttribute("aria-hidden", "true");
      input.tabIndex = -1;

      // Hide it completely
      input.style.cssText = `
        position: fixed;
        top: -9999px;
        left: -9999px;
        width: 1px;
        height: 1px;
        opacity: 0;
        pointer-events: none;
        visibility: hidden;
      `;

      document.body.appendChild(input);
      this.iosHapticInput = input;
    } catch (error) {
      console.warn(
        "[HapticFeedback] Failed to create iOS haptic element:",
        error
      );
      this.supportsIOSHaptic = false;
    }
  }

  /**
   * Trigger haptic feedback via Capacitor's native Haptics plugin.
   * Uses Taptic Engine on iOS and standard vibration on Android.
   */
  private async triggerNativeHaptic(type: HapticFeedbackType): Promise<boolean> {
    try {
      const { Haptics, ImpactStyle, NotificationType } = await import(
        "@capacitor/haptics"
      );

      switch (type) {
        case "selection":
          await Haptics.impact({ style: ImpactStyle.Light });
          break;
        case "success":
          await Haptics.notification({ type: NotificationType.Success });
          break;
        case "warning":
          await Haptics.notification({ type: NotificationType.Warning });
          break;
        case "error":
          await Haptics.notification({ type: NotificationType.Error });
          break;
        default:
          await Haptics.impact({ style: ImpactStyle.Medium });
      }
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Trigger iOS haptic feedback by toggling the checkbox
   * @param pulseCount Number of haptic pulses to trigger
   */
  private triggerIOSHaptic(pulseCount: number = 1): boolean {
    if (!this.iosHapticInput) {
      // Try to create it if it doesn't exist
      this.createIOSHapticElement();
      if (!this.iosHapticInput) return false;
    }

    try {
      // Toggle the checkbox for each pulse
      // Small delay between pulses for distinct feedback
      for (let i = 0; i < pulseCount; i++) {
        if (i === 0) {
          this.iosHapticInput.click();
        } else {
          // Stagger subsequent pulses
          setTimeout(() => {
            this.iosHapticInput?.click();
          }, i * 60); // 60ms between pulses
        }
      }
      return true;
    } catch (error) {
      console.warn("[HapticFeedback] iOS haptic trigger failed:", error);
      return false;
    }
  }

  // ============================================================================
  // PRIVATE METHODS - Vibration API (Android)
  // ============================================================================

  /**
   * Check if feedback can be triggered (all conditions met)
   */
  private canTriggerFeedback(): boolean {
    // Skip if not in browser environment
    if (!browser) {
      return false;
    }

    // Skip if no platform support
    if (!this.supportsVibrationAPI && !this.supportsIOSHaptic) {
      return false;
    }

    // Skip if disabled
    if (!this.config.enabled) {
      return false;
    }

    // Check throttling
    const now = Date.now();
    if (now - this.lastFeedbackTime < this.config.throttleTime) {
      return false;
    }

    return true;
  }

  /**
   * Execute the vibration with error handling (Android)
   */
  private vibrate(pattern: number[]): boolean {
    try {
      navigator.vibrate(pattern);
      return true;
    } catch (error) {
      console.warn("[HapticFeedback] Vibration failed:", error);
      return false;
    }
  }
}

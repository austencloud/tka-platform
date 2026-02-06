/**
 * Haptic Feedback Service Interface
 *
 * Provides haptic feedback capabilities for mobile devices with proper
 * accessibility considerations and browser compatibility.
 */

export type HapticFeedbackType =
  | "selection" // Standard pulse for all interactive elements (70ms)
  | "success" // Success pattern (100ms, 30ms pause, 50ms)
  | "warning" // Warning pattern (60ms, 60ms pause, 60ms)
  | "error" // Error pattern (100ms, 60ms pause, 100ms, 60ms pause, 100ms)
  | "custom"; // Custom pattern

export interface HapticFeedbackConfig {
  enabled: boolean;
  respectReducedMotion: boolean;
  throttleTime: number;
  customPatterns: Record<string, number[]>;
}

export interface IHapticFeedback {
  /**
   * Trigger haptic feedback with the specified pattern
   * @param type The type of feedback to provide (default: "selection")
   * @returns Boolean indicating if feedback was triggered
   */
  trigger(type: HapticFeedbackType): boolean;

  /**
   * Set a custom vibration pattern
   * @param name Name for the custom pattern
   * @param pattern Array of vibration durations in milliseconds
   */
  setCustomPattern(name: string, pattern: number[]): void;

  /**
   * Trigger a custom vibration pattern
   * @param name Name of the custom pattern to trigger
   * @returns Boolean indicating if feedback was triggered
   */
  triggerCustom(name: string): boolean;

  /**
   * Check if haptic feedback is supported on this device
   * @returns Boolean indicating if haptic feedback is supported
   */
  isSupported(): boolean;

  /**
   * Enable or disable haptic feedback
   * @param enabled Boolean indicating if haptic feedback should be enabled
   */
  setEnabled(enabled: boolean): void;

  /**
   * Get the current enabled state
   * @returns Boolean indicating if haptic feedback is enabled
   */
  isEnabled(): boolean;

  /**
   * Get current configuration
   * @returns Current haptic feedback configuration
   */
  getConfig(): HapticFeedbackConfig;

  /**
   * Update configuration
   * @param config Partial configuration to update
   */
  updateConfig(config: Partial<HapticFeedbackConfig>): void;
}

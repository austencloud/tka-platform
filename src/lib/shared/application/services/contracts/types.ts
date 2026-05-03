// --- From HapticFeedback ---

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

// --- From RippleEffect ---

export interface RippleOptions {
  duration?: number;
  color?: string;
  opacity?: number;
}

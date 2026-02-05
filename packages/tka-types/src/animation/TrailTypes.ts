export interface TrailPoint {
  x: number;
  y: number;
  timestamp: number;
  propIndex: 0 | 1;
  endType: 0 | 1;
}

export enum TrailMode {
  OFF = "off",
  FADE = "fade",
  LOOP_CLEAR = "loop_clear",
  PERSISTENT = "persistent",
}

export enum TrackingMode {
  LEFT_END = "left_end",
  RIGHT_END = "right_end",
  BOTH_ENDS = "both_ends",
}

export enum TrailEffect {
  NONE = "none",
  GLOW = "glow",
}

export interface TrailSettings {
  enabled: boolean;
  mode: TrailMode;
  effect: TrailEffect;
  fadeDurationMs: number;
  maxPoints: number;
  lineWidth: number;
  glowBlur: number;
  blueColor: string;
  redColor: string;
  minOpacity: number;
  maxOpacity: number;
  trackingMode: TrackingMode;
  hideProps: boolean;
  usePathCache: boolean;
  previewMode: boolean;
}

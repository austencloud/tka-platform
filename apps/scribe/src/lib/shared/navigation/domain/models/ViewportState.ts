/**
 * ViewportState.ts - Domain model for viewport information
 */

export interface SafeAreaInsets {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export interface ViewportDimensions {
  viewportWidth: number;
  viewportHeight: number;
  screenWidth: number;
  screenHeight: number;
  browserUIOffset: number;
  safeAreaInsets: SafeAreaInsets;
}

export interface ViewportState {
  width: number;
  height: number;
  isMobile: boolean;
  actualVH: number;
  safeHeight: number;
  dimensions: ViewportDimensions;
}

export interface ViewportChangeEvent {
  state: ViewportState;
  timestamp: number;
  trigger: "resize" | "orientation" | "ui-change";
}

/**
 * ViewportMode.ts - Enumeration for viewport display modes
 */

export enum ViewportMode {
  Desktop = "desktop",
  Mobile = "mobile",
}

export type ViewportModeType = keyof typeof ViewportMode;

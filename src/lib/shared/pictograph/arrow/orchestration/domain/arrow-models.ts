/**
 * Arrow Lifecycle Domain Models
 *
 * Domain models for arrow lifecycle management.
 * Pure data structures with no business logic.
 */

export interface ArrowAssets {
  readonly imageSrc: string;
  readonly viewBox: {
    width: number;
    height: number;
    /** Full viewBox string including origin, e.g., "-296 -2937 2784 3091" */
    fullViewBox?: string;
  };
  readonly center: { x: number; y: number };
  // Arrow tip z-promotion: pre-split shaft/tip SVG content
  readonly shaftSrc?: string;
  readonly tipSrc?: string;
  readonly tipBBox?: { x: number; y: number; width: number; height: number };
}

export interface ArrowPosition {
  readonly x: number;
  readonly y: number;
  readonly rotation: number;
}

export interface ArrowState {
  readonly assets: ArrowAssets | null;
  readonly position: ArrowPosition | null;
  readonly shouldMirror: boolean;
  readonly isVisible: boolean;
  readonly isLoading: boolean;
  readonly error: string | null;
}

export interface ArrowLifecycleResult {
  readonly positions: Record<string, ArrowPosition>;
  readonly mirroring: Record<string, boolean>;
  readonly assets: Record<string, ArrowAssets>;
  readonly allReady: boolean;
  readonly errors: Record<string, string>;
}

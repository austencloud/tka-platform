/**
 * SpotlightGestures.svelte.ts
 *
 * Gesture controller for the premium media spotlight viewer.
 * Handles swipe navigation, swipe-to-dismiss, pinch-to-zoom, and pan gestures.
 *
 * Architecture:
 * - Pure class-based handler (not an ITI service - component-instantiated)
 * - Uses Svelte 5 reactive state for gesture tracking
 * - Coordinates multiple gesture types without conflicts
 */

/** Gesture thresholds */
const THRESHOLDS = {
  /** Minimum distance (px) for slow horizontal swipe to navigate */
  SWIPE_DISTANCE: 80,
  /** Minimum distance (px) for fast horizontal swipe to navigate */
  SWIPE_DISTANCE_FAST: 50,
  /** Minimum velocity (px/ms) to be considered a fast swipe */
  FAST_SWIPE_VELOCITY: 0.5,
  /** Minimum distance (px) for vertical swipe to dismiss */
  DISMISS_DISTANCE: 150,
  /** Minimum velocity for fast dismiss */
  FAST_DISMISS_VELOCITY: 0.3,
  /** Minimum distance before gesture is considered intentional */
  MOVEMENT_THRESHOLD: 10,
  /** Rubber band resistance factor (0-1, higher = more resistance) */
  RUBBER_BAND_FACTOR: 0.3,
} as const;

/** Zoom constraints */
const ZOOM = {
  MIN: 1,
  MAX: 5,
  DOUBLE_TAP: 2,
  /** Minimum distance between fingers to start pinch */
  PINCH_THRESHOLD: 10,
} as const;

export type GestureDirection = "left" | "right" | "up" | "down" | null;
export type GestureType = "none" | "swipe-horizontal" | "swipe-vertical" | "pinch" | "pan";

export interface GestureState {
  /** Current gesture type being tracked */
  type: GestureType;
  /** Is a gesture currently in progress */
  isActive: boolean;
  /** Horizontal offset during swipe (px) */
  offsetX: number;
  /** Vertical offset during swipe (px) */
  offsetY: number;
  /** Current zoom scale */
  scale: number;
  /** Pan X offset when zoomed */
  panX: number;
  /** Pan Y offset when zoomed */
  panY: number;
  /** Detected swipe direction */
  direction: GestureDirection;
  /** Progress toward threshold (0-1) */
  progress: number;
  /** Is at horizontal edge (rubber band effect) */
  atEdge: boolean;
}

export interface GestureCallbacks {
  /** Called when user swipes to navigate */
  onNavigate?: (direction: "prev" | "next") => void;
  /** Called when user swipes to dismiss */
  onDismiss?: () => void;
  /** Called with gesture state during drag for visual feedback */
  onGestureUpdate?: (state: GestureState) => void;
  /** Called when gesture ends (for cleanup/snap-back) */
  onGestureEnd?: (state: GestureState) => void;
  /** Check if we can navigate in a direction */
  canNavigate?: (direction: "prev" | "next") => boolean;
}

export class SpotlightGestureHandler {
  private touchStartX = 0;
  private touchStartY = 0;
  private touchCurrentX = 0;
  private touchCurrentY = 0;
  private touchStartTime = 0;
  private initialPinchDistance = 0;
  private initialScale = 1;

  private gestureType: GestureType = "none";
  private isGestureActive = false;
  private gestureDirection: GestureDirection = null;

  private scale = 1;
  private panX = 0;
  private panY = 0;
  private lastTapTime = 0;

  private callbacks: GestureCallbacks = {};

  private element: HTMLElement | null = null;
  private cleanupFn: (() => void) | null = null;

  constructor(callbacks: GestureCallbacks = {}) {
    this.callbacks = callbacks;
  }

  /**
   * Attach gesture handlers to an element
   */
  attach(element: HTMLElement) {
    this.detach();
    this.element = element;

    const handleTouchStart = (e: TouchEvent) => this.onTouchStart(e);
    const handleTouchMove = (e: TouchEvent) => this.onTouchMove(e);
    const handleTouchEnd = (e: TouchEvent) => this.onTouchEnd(e);

    element.addEventListener("touchstart", handleTouchStart, { passive: false });
    element.addEventListener("touchmove", handleTouchMove, { passive: false });
    element.addEventListener("touchend", handleTouchEnd, { passive: false });
    element.addEventListener("touchcancel", handleTouchEnd, { passive: false });

    this.cleanupFn = () => {
      element.removeEventListener("touchstart", handleTouchStart);
      element.removeEventListener("touchmove", handleTouchMove);
      element.removeEventListener("touchend", handleTouchEnd);
      element.removeEventListener("touchcancel", handleTouchEnd);
    };
  }

  /**
   * Remove gesture handlers
   */
  detach() {
    this.cleanupFn?.();
    this.cleanupFn = null;
    this.element = null;
  }

  /**
   * Update callbacks (e.g., when props change)
   */
  updateCallbacks(callbacks: Partial<GestureCallbacks>) {
    this.callbacks = { ...this.callbacks, ...callbacks };
  }

  getState(): GestureState {
    const deltaX = this.touchCurrentX - this.touchStartX;
    const deltaY = this.touchCurrentY - this.touchStartY;

    // Calculate progress based on gesture type
    let progress = 0;
    if (this.gestureType === "swipe-horizontal") {
      progress = Math.min(1, Math.abs(deltaX) / THRESHOLDS.SWIPE_DISTANCE);
    } else if (this.gestureType === "swipe-vertical") {
      progress = Math.min(1, Math.abs(deltaY) / THRESHOLDS.DISMISS_DISTANCE);
    }

    // Determine if at edge (for rubber band)
    const atEdge =
      this.gestureType === "swipe-horizontal" &&
      ((deltaX > 0 && !this.callbacks.canNavigate?.("prev")) ||
        (deltaX < 0 && !this.callbacks.canNavigate?.("next")));

    return {
      type: this.gestureType,
      isActive: this.isGestureActive,
      offsetX: deltaX,
      offsetY: deltaY,
      scale: this.scale,
      panX: this.panX,
      panY: this.panY,
      direction: this.gestureDirection,
      progress,
      atEdge,
    };
  }

  resetZoom() {
    this.scale = 1;
    this.panX = 0;
    this.panY = 0;
  }

  /**
   * Check if currently zoomed
   */
  isZoomed(): boolean {
    return this.scale > 1;
  }


  private onTouchStart(e: TouchEvent) {
    const touches = e.touches;

    // Double-tap detection (single touch)
    if (touches.length === 1) {
      const now = Date.now();
      const timeSinceLastTap = now - this.lastTapTime;

      if (timeSinceLastTap < 300) {
        // Double-tap detected
        this.handleDoubleTap(touches[0]!);
        this.lastTapTime = 0;
        e.preventDefault();
        return;
      }

      this.lastTapTime = now;
    }

    // Start tracking
    if (touches.length === 1) {
      this.touchStartX = touches[0]!.clientX;
      this.touchStartY = touches[0]!.clientY;
      this.touchCurrentX = this.touchStartX;
      this.touchCurrentY = this.touchStartY;
      this.touchStartTime = Date.now();
      this.gestureType = "none";
      this.gestureDirection = null;
      this.isGestureActive = false;
    } else if (touches.length === 2) {
      // Pinch start
      this.initialPinchDistance = this.getDistance(touches[0]!, touches[1]!);
      this.initialScale = this.scale;
      this.gestureType = "pinch";
      this.isGestureActive = true;
    }
  }

  private onTouchMove(e: TouchEvent) {
    const touches = e.touches;

    if (touches.length === 1) {
      this.touchCurrentX = touches[0]!.clientX;
      this.touchCurrentY = touches[0]!.clientY;

      const deltaX = this.touchCurrentX - this.touchStartX;
      const deltaY = this.touchCurrentY - this.touchStartY;
      const absDeltaX = Math.abs(deltaX);
      const absDeltaY = Math.abs(deltaY);

      // Determine gesture type if not yet decided
      if (this.gestureType === "none" && (absDeltaX > THRESHOLDS.MOVEMENT_THRESHOLD || absDeltaY > THRESHOLDS.MOVEMENT_THRESHOLD)) {
        // If zoomed, allow panning
        if (this.isZoomed()) {
          this.gestureType = "pan";
          this.isGestureActive = true;
        } else if (absDeltaX > absDeltaY) {
          // Horizontal swipe (navigation)
          this.gestureType = "swipe-horizontal";
          this.gestureDirection = deltaX > 0 ? "right" : "left";
          this.isGestureActive = true;
        } else {
          // Vertical swipe (dismiss)
          this.gestureType = "swipe-vertical";
          this.gestureDirection = deltaY > 0 ? "down" : "up";
          this.isGestureActive = true;
        }
      }

      // Update direction as we move
      if (this.gestureType === "swipe-horizontal") {
        this.gestureDirection = deltaX > 0 ? "right" : "left";
      } else if (this.gestureType === "swipe-vertical") {
        this.gestureDirection = deltaY > 0 ? "down" : "up";
      }

      // Handle pan when zoomed
      if (this.gestureType === "pan") {
        this.panX += deltaX;
        this.panY += deltaY;
        this.touchStartX = this.touchCurrentX;
        this.touchStartY = this.touchCurrentY;
      }

      // Prevent default for our gestures
      if (this.isGestureActive) {
        e.preventDefault();
        this.callbacks.onGestureUpdate?.(this.getState());
      }
    } else if (touches.length === 2 && this.gestureType === "pinch") {
      // Pinch zoom
      const distance = this.getDistance(touches[0]!, touches[1]!);
      const scaleChange = distance / this.initialPinchDistance;
      this.scale = Math.min(ZOOM.MAX, Math.max(ZOOM.MIN, this.initialScale * scaleChange));
      e.preventDefault();
      this.callbacks.onGestureUpdate?.(this.getState());
    }
  }

  private onTouchEnd(_e: TouchEvent) {
    if (!this.isGestureActive) {
      return;
    }

    const deltaX = this.touchCurrentX - this.touchStartX;
    const deltaY = this.touchCurrentY - this.touchStartY;
    const duration = Date.now() - this.touchStartTime;
    const velocityX = Math.abs(deltaX) / duration;
    const velocityY = Math.abs(deltaY) / duration;

    // Evaluate gesture result
    if (this.gestureType === "swipe-horizontal") {
      const isFastSwipe = velocityX >= THRESHOLDS.FAST_SWIPE_VELOCITY;
      const threshold = isFastSwipe ? THRESHOLDS.SWIPE_DISTANCE_FAST : THRESHOLDS.SWIPE_DISTANCE;

      if (Math.abs(deltaX) >= threshold) {
        const direction = deltaX > 0 ? "prev" : "next";
        if (this.callbacks.canNavigate?.(direction) !== false) {
          this.callbacks.onNavigate?.(direction);
        }
      }
    } else if (this.gestureType === "swipe-vertical") {
      const isFastDismiss = velocityY >= THRESHOLDS.FAST_DISMISS_VELOCITY;
      const threshold = isFastDismiss ? THRESHOLDS.DISMISS_DISTANCE * 0.5 : THRESHOLDS.DISMISS_DISTANCE;

      // Only dismiss on downward swipe
      if (deltaY > threshold && this.gestureDirection === "down") {
        this.callbacks.onDismiss?.();
      }
    }

    // Notify gesture end for snap-back animation
    this.callbacks.onGestureEnd?.(this.getState());

    // Reset tracking
    this.isGestureActive = false;
    this.gestureType = "none";
    this.gestureDirection = null;
  }

  private handleDoubleTap(touch: Touch) {
    if (this.scale > 1) {
      // Reset to 1x
      this.scale = 1;
      this.panX = 0;
      this.panY = 0;
    } else {
      // Zoom to 2x, centered on tap point
      this.scale = ZOOM.DOUBLE_TAP;

      // Calculate pan to center on tap point
      if (this.element) {
        const rect = this.element.getBoundingClientRect();
        const tapX = touch.clientX - rect.left;
        const tapY = touch.clientY - rect.top;
        const centerX = rect.width / 2;
        const centerY = rect.height / 2;

        // Pan toward tap point
        this.panX = (centerX - tapX) * (ZOOM.DOUBLE_TAP - 1);
        this.panY = (centerY - tapY) * (ZOOM.DOUBLE_TAP - 1);
      }
    }

    this.callbacks.onGestureUpdate?.(this.getState());
  }

  private getDistance(touch1: Touch, touch2: Touch): number {
    const dx = touch1.clientX - touch2.clientX;
    const dy = touch1.clientY - touch2.clientY;
    return Math.sqrt(dx * dx + dy * dy);
  }

  applyRubberBand(offset: number, atEdge: boolean): number {
    if (!atEdge) return offset;
    // Diminishing returns as you pull further
    const sign = offset > 0 ? 1 : -1;
    const absOffset = Math.abs(offset);
    return sign * absOffset * THRESHOLDS.RUBBER_BAND_FACTOR;
  }

  /**
   * Dispose of the handler
   */
  dispose() {
    this.detach();
  }
}

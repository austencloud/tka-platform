/**
 * Canvas Resize Types
 *
 * Co-exported types and constants for the canvas resize system.
 */

/**
 * Default canvas size
 */
export const DEFAULT_CANVAS_SIZE = 500;

/**
 * Renderer interface for resize operations
 */
export interface ResizableRenderer {
  resize: (size: number) => Promise<void>;
}

/**
 * Reactive state owned by the service
 */
export interface CanvasResizeState {
  /** Current canvas size */
  currentSize: number;
  /** Increments on each completed resize (for triggering reactivity) */
  resizeCount: number;
  /** Whether a resize is in progress */
  isResizing: boolean;
}


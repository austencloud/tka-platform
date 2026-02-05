/**
 * Canvas Resize Service Interface
 *
 * Handles canvas resize logic for AnimatorCanvas.
 * Uses ResizeObserver when available, falls back to window resize.
 *
 * Uses reactive state ownership - service owns $state, component derives from it.
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

/**
 * Service for managing canvas resizing
 */
export interface ICanvasResizer {
  /**
   * Reactive state - read from component via $derived
   */
  readonly state: CanvasResizeState;

  /**
   * Initialize the service with container and renderer
   */
  initialize(container: HTMLDivElement, renderer: ResizableRenderer): void;

  /**
   * Set up resize observers and listeners
   */
  setup(): void;

  /**
   * Clean up resize observers and listeners
   */
  teardown(): void;

  /**
   * Manually trigger a resize
   * @param currentSize - Current canvas size to compare against
   */
  resize(currentSize: number): Promise<number>;

  /**
   * Clean up all resources
   */
  dispose(): void;
}

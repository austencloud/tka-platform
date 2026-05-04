/**
 * Canvas Resize Service Implementation
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

export class CanvasResizer {
  // Reactive state - owned by service
  state = $state<CanvasResizeState>({
    currentSize: DEFAULT_CANVAS_SIZE,
    resizeCount: 0,
    isResizing: false,
  });

  private container: HTMLDivElement | null = null;
  private renderer: ResizableRenderer | null = null;
  private resizeObserver: ResizeObserver | null = null;
  private paused = false;

  // Bound reference to resize handler for event listener cleanup
  private boundResizeHandler = () => this.handleResize();

  initialize(container: HTMLDivElement, renderer: ResizableRenderer): void {
    this.container = container;
    this.renderer = renderer;
  }

  setup(): void {
    this.teardown();

    if (typeof ResizeObserver !== "undefined" && this.container) {
      this.resizeObserver = new ResizeObserver(() => {
        this.handleResize();
      });
      this.resizeObserver.observe(this.container);
    }

    if (typeof window !== "undefined") {
      window.addEventListener("resize", this.boundResizeHandler);
    }
  }

  teardown(): void {
    this.resizeObserver?.disconnect();
    this.resizeObserver = null;

    if (typeof window !== "undefined") {
      window.removeEventListener("resize", this.boundResizeHandler);
    }
  }

  async resize(currentSize: number): Promise<number> {
    this.state.currentSize = currentSize;
    return this.performResize();
  }

  pauseObservation(): void {
    this.paused = true;
  }

  resumeObservation(): void {
    this.paused = false;
    // Catch up to whatever size the container is now
    this.handleResize();
  }

  dispose(): void {
    this.teardown();
    this.paused = false;
    this.container = null;
    this.renderer = null;
    this.state.currentSize = DEFAULT_CANVAS_SIZE;
    this.state.resizeCount = 0;
    this.state.isResizing = false;
  }

  private handleResize(): void {
    if (this.paused) return;
    this.performResize();
  }

  private async performResize(): Promise<number> {
    if (!this.container || !this.renderer) return this.state.currentSize;

    const rect = this.container.getBoundingClientRect();
    const newSize =
      Math.min(
        rect.width || DEFAULT_CANVAS_SIZE,
        rect.height || DEFAULT_CANVAS_SIZE
      ) || DEFAULT_CANVAS_SIZE;

    if (newSize !== this.state.currentSize) {
      this.state.isResizing = true;
      this.state.currentSize = newSize;
      await this.renderer.resize(newSize);
      this.state.isResizing = false;
      this.state.resizeCount++; // Increment to trigger reactivity
    }

    return newSize;
  }
}

/**
 * Canvas Resize Service Implementation
 *
 * Handles canvas resize logic for AnimatorCanvas.
 * Uses ResizeObserver when available, falls back to window resize.
 *
 * Uses reactive state ownership - service owns $state, component derives from it.
 */

import {
  DEFAULT_CANVAS_SIZE,
  type ICanvasResizer,
  type ResizableRenderer,
  type CanvasResizeState,
} from "../contracts/ICanvasResizer";

export class CanvasResizer implements ICanvasResizer {
  // Reactive state - owned by service
  state = $state<CanvasResizeState>({
    currentSize: DEFAULT_CANVAS_SIZE,
    resizeCount: 0,
    isResizing: false,
  });

  private container: HTMLDivElement | null = null;
  private renderer: ResizableRenderer | null = null;
  private resizeObserver: ResizeObserver | null = null;

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

  dispose(): void {
    this.teardown();
    this.container = null;
    this.renderer = null;
    this.state.currentSize = DEFAULT_CANVAS_SIZE;
    this.state.resizeCount = 0;
    this.state.isResizing = false;
  }

  private handleResize(): void {
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

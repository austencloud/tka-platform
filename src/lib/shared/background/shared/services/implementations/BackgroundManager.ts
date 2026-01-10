// BackgroundManager.ts - Pure business logic service (no state)
import type {
  Dimensions,
  PerformanceMetrics,
} from "../../domain/types/background-types";
import type { IBackgroundManager } from "../contracts/IBackgroundManager";
import { PerformanceTracker } from "./PerformanceTracker";

/**
 * BackgroundManager - Pure business logic service
 * Handles canvas management, animation loops, and performance tracking
 * State is managed separately in BackgroundState.svelte.ts
 */
export class BackgroundManager implements IBackgroundManager {
  private performanceTracker: PerformanceTracker;
  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  private animationFrameId: number | null = null;
  private reportCallback: ((metrics: PerformanceMetrics) => void) | null = null;

  // State callbacks - injected by components that use this service
  private dimensionsCallback: ((dimensions: Dimensions) => void) | null = null;
  private metricsCallback: ((metrics: PerformanceMetrics) => void) | null =
    null;
  private shouldRenderCallback: (() => boolean) | null = null;

  constructor() {
    this.performanceTracker = PerformanceTracker.getInstance();
  }

  /**
   * Set state callbacks for reactive updates
   */
  public setStateCallbacks(callbacks: {
    onDimensionsChange?: (dimensions: Dimensions) => void;
    onMetricsChange?: (metrics: PerformanceMetrics) => void;
    shouldRender?: () => boolean;
  }): void {
    this.dimensionsCallback = callbacks.onDimensionsChange || null;
    this.metricsCallback = callbacks.onMetricsChange || null;
    this.shouldRenderCallback = callbacks.shouldRender || null;
  }

  public initializeCanvas(
    canvas: HTMLCanvasElement,
    onReady?: () => void
  ): void {
    this.canvas = canvas;

    this.ctx = canvas.getContext("2d");
    if (!this.ctx) {
      console.error("Failed to get canvas context");
      return;
    }

    const isBrowser = typeof window !== "undefined";
    const initialWidth = isBrowser ? window.innerWidth : 1280;
    const initialHeight = isBrowser ? window.innerHeight : 720;

    const dimensions: Dimensions = {
      width: initialWidth,
      height: initialHeight,
    };

    canvas.width = initialWidth;
    canvas.height = initialHeight;

    // Update state through callback
    if (this.dimensionsCallback) {
      this.dimensionsCallback(dimensions);
    }

    if (isBrowser) {
      window.addEventListener("resize", this.handleResize.bind(this));
      document.addEventListener(
        "visibilitychange",
        this.handleVisibilityChange.bind(this)
      );
    }

    if (onReady) {
      onReady();
    }
  }

  public startAnimation(
    renderFn: (ctx: CanvasRenderingContext2D, dimensions: Dimensions) => void,
    reportFn?: (metrics: PerformanceMetrics) => void
  ): void {
    if (!this.ctx || !this.canvas) {
      console.error("Canvas not initialized");
      return;
    }

    if (reportFn) {
      this.reportCallback = reportFn;
    }

    this.performanceTracker.reset();

    const animate = () => {
      if (!this.ctx || !this.canvas) return;

      this.performanceTracker.update();

      const perfStatus = this.performanceTracker.getPerformanceStatus();
      const metrics: PerformanceMetrics = {
        fps: perfStatus.fps,
        warnings: perfStatus.warnings,
      };

      // Update state through callback
      if (this.metricsCallback) {
        this.metricsCallback(metrics);
      }

      if (this.reportCallback) {
        this.reportCallback(metrics);
      }

      const dimensions: Dimensions = {
        width: this.canvas.width,
        height: this.canvas.height,
      };

      // Check if should render through callback
      const shouldRender = this.shouldRenderCallback
        ? this.shouldRenderCallback()
        : true;

      if (shouldRender) {
        this.ctx.clearRect(0, 0, dimensions.width, dimensions.height);
        renderFn(this.ctx, dimensions);
      }

      this.animationFrameId = requestAnimationFrame(animate);
    };

    if (typeof window !== "undefined") {
      this.animationFrameId = requestAnimationFrame(animate);
    }
  }

  public stopAnimation(): void {
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
  }

  public cleanup(): void {
    this.stopAnimation();

    if (typeof window !== "undefined") {
      window.removeEventListener("resize", this.handleResize.bind(this));
      document.removeEventListener(
        "visibilitychange",
        this.handleVisibilityChange.bind(this)
      );
    }

    this.canvas = null;
    this.ctx = null;
    this.reportCallback = null;
    this.dimensionsCallback = null;
    this.metricsCallback = null;
    this.shouldRenderCallback = null;
  }

  private handleResize(): void {
    if (!this.canvas) return;

    const newWidth = window.innerWidth;
    const newHeight = window.innerHeight;

    this.canvas.width = newWidth;
    this.canvas.height = newHeight;

    const dimensions: Dimensions = {
      width: newWidth,
      height: newHeight,
    };

    // Update state through callback
    if (this.dimensionsCallback) {
      this.dimensionsCallback(dimensions);
    }
  }

  private handleVisibilityChange(): void {
    // Handle visibility changes - could update active state through callback
  }
}

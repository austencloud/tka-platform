interface Disposable {
  dispose?(): void;
  close?(): void;
  cleanup?(): void;
}

type TrackedResource =
  | HTMLElement
  | HTMLImageElement
  | HTMLCanvasElement
  | Worker
  | WebGLRenderingContext
  | WebGL2RenderingContext
  | Path2D
  | Disposable
  | TrackedResource[]
  | Set<TrackedResource>
  | Map<unknown, TrackedResource>
  | unknown;

export class ResourceTracker {
  private resources: Set<TrackedResource>;
  private active: boolean;
  private tracking: boolean = false;
  private usageHistory: Array<{
    timestamp: Date;
    memoryUsage: number;
    cpuUsage?: number;
  }> = [];

  constructor() {
    this.resources = new Set();
    this.active = true;
  }

  /**
   * Start tracking resources (IResourceTracker interface method)
   */
  startTracking(): void {
    this.tracking = true;
  }

  /**
   * Stop tracking resources (IResourceTracker interface method)
   */
  stopTracking(): void {
    this.tracking = false;
  }

  /**
   * Get current resource usage (IResourceTracker interface method)
   */
  getCurrentUsage(): {
    memoryUsage: number;
    cpuUsage?: number;
    activeConnections: number;
  } {
    const memoryUsage = this.getMemoryUsage();
    const usage = {
      memoryUsage,
      activeConnections: this.resources.size,
    };

    // Add to history if tracking
    if (this.tracking) {
      this.usageHistory.push({
        timestamp: new Date(),
        memoryUsage,
      });

      // Keep only last 100 entries
      if (this.usageHistory.length > 100) {
        this.usageHistory.shift();
      }
    }

    return usage;
  }

  /**
   * Get resource usage history (IResourceTracker interface method)
   */
  getUsageHistory(): Array<{
    timestamp: Date;
    memoryUsage: number;
    cpuUsage?: number;
  }> {
    return [...this.usageHistory];
  }

  private getMemoryUsage(): number {
    // Estimate memory usage based on tracked resources
    let estimate = 0;

    this.resources.forEach((resource) => {
      if (resource instanceof HTMLCanvasElement) {
        estimate += resource.width * resource.height * 4; // RGBA bytes
      } else if (resource instanceof HTMLImageElement) {
        estimate +=
          (resource.naturalWidth || 100) * (resource.naturalHeight || 100) * 4;
      } else {
        estimate += 1024; // Default 1KB estimate per resource
      }
    });

    return estimate;
  }

  public trackResource(resource: unknown): void {
    if (!this.active) {
      console.warn(
        "Attempting to track a resource after ResourceTracker has been disposed"
      );
      return;
    }

    this.resources.add(resource);
  }

  public untrackResource(resource: unknown): void {
    this.resources.delete(resource);
  }

  public disposeAll(): void {
    if (!this.active) return;

    try {
      this.resources.forEach((resource) => {
        this.disposeResource(resource);
      });

      this.resources.clear();
    } catch (e) {
      console.error("Error disposing resources:", e);
    } finally {
      this.active = false;
    }
  }

  public getTrackedCount(): number {
    return this.resources.size;
  }

  public isActive(): boolean {
    return this.active;
  }

  public deactivate(): void {
    this.active = false;
  }

  private disposeResource(resource: TrackedResource): void {
    if (!resource) return;

    if (resource instanceof HTMLElement) {
      if (resource.parentNode) {
        resource.parentNode.removeChild(resource);
      }

      if (resource instanceof HTMLImageElement) {
        resource.onload = null;
        resource.onerror = null;

        resource.src = "";
      } else if (resource instanceof HTMLCanvasElement) {
        const context = resource.getContext("2d");
        if (context) {
          context.setTransform(1, 0, 0, 1, 0, 0);
          context.clearRect(0, 0, resource.width, resource.height);
        }
      }
    } else if (
      resource instanceof WebGLRenderingContext ||
      resource instanceof WebGL2RenderingContext
    ) {
      const extension = resource.getExtension("WEBGL_lose_context");
      if (extension) extension.loseContext();
    } else if (resource instanceof Path2D) {
      // Path2D objects don't need explicit cleanup
    } else if (
      resource &&
      typeof resource === "object" &&
      "dispose" in resource &&
      typeof resource.dispose === "function"
    ) {
      resource.dispose();
    } else if (
      resource &&
      typeof resource === "object" &&
      "close" in resource &&
      typeof resource.close === "function"
    ) {
      resource.close();
    } else if (
      resource &&
      typeof resource === "object" &&
      "cleanup" in resource &&
      typeof resource.cleanup === "function"
    ) {
      resource.cleanup();
    } else if (Array.isArray(resource)) {
      resource.forEach((item) => this.disposeResource(item));
    } else if (resource instanceof Set || resource instanceof Map) {
      resource.forEach((item) => this.disposeResource(item));
      resource.clear();
    }
  }

  public isTracking(resource: TrackedResource): boolean {
    return this.resources.has(resource);
  }

  public get resourceCount(): number {
    return this.resources.size;
  }
}

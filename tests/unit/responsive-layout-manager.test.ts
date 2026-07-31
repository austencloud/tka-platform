import { describe, expect, it, vi } from "vitest";
import type { DeviceDetector } from "../../src/lib/shared/device/services/device-detector";
import type { ViewportManager } from "../../src/lib/shared/device/services/viewport-manager.svelte";
import { ResponsiveLayoutManager } from "../../src/lib/shared/create/services/responsive-layout-manager";

class TestViewportManager {
  width = 375;
  height = 667;
  private listeners = new Set<() => void>();

  onViewportChange(callback: () => void): () => void {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  resize(width: number, height: number): void {
    this.width = width;
    this.height = height;
    this.listeners.forEach((callback) => callback());
  }

  get listenerCount(): number {
    return this.listeners.size;
  }
}

function createDeviceDetector(): DeviceDetector {
  return {
    getNavigationLayoutImmediate: () => "bottom",
    isDesktop: () => false,
    isLandscapeMobile: () => false,
  } as unknown as DeviceDetector;
}

describe("ResponsiveLayoutManager", () => {
  it("starts viewport updates when a consumer subscribes directly", () => {
    const viewport = new TestViewportManager();
    const manager = new ResponsiveLayoutManager(
      createDeviceDetector(),
      viewport as unknown as ViewportManager
    );
    const onLayoutChange = vi.fn();

    const unsubscribe = manager.onLayoutChange(onLayoutChange);

    expect(viewport.listenerCount).toBe(1);

    viewport.resize(960, 412);

    expect(onLayoutChange).toHaveBeenCalledTimes(1);
    expect(onLayoutChange).toHaveBeenLastCalledWith(
      expect.objectContaining({
        viewportWidth: 960,
        viewportHeight: 412,
        shouldUseSideBySideLayout: true,
      })
    );

    unsubscribe();
    manager.dispose();
    expect(viewport.listenerCount).toBe(0);
  });

  it("does not register twice when a caller also initializes explicitly", () => {
    const viewport = new TestViewportManager();
    const manager = new ResponsiveLayoutManager(
      createDeviceDetector(),
      viewport as unknown as ViewportManager
    );

    manager.initialize();
    manager.onLayoutChange(() => {});

    expect(viewport.listenerCount).toBe(1);

    manager.dispose();
  });
});

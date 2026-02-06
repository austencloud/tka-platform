/**
 * Arrow Lifecycle Factories
 *
 * Factory functions for creating arrow lifecycle domain objects.
 * Provides convenient creation methods with sensible defaults.
 */

import type {
  ArrowAssets,
  ArrowLifecycleResult,
  ArrowPosition,
  ArrowState,
} from "./arrow-models.js";

export function createArrowAssets(data: Partial<ArrowAssets>): ArrowAssets {
  return {
    imageSrc: data.imageSrc ?? "",
    viewBox: data.viewBox ?? { width: 0, height: 0 },
    center: data.center ?? { x: 0, y: 0 },
  };
}

export function createArrowPosition(
  data: Partial<ArrowPosition>
): ArrowPosition {
  return {
    x: data.x ?? 0,
    y: data.y ?? 0,
    rotation: data.rotation ?? 0,
  };
}

export function createArrowState(data: Partial<ArrowState> = {}): ArrowState {
  return {
    assets: data.assets ?? null,
    position: data.position ?? null,
    shouldMirror: data.shouldMirror ?? false,
    isVisible: data.isVisible ?? false,
    isLoading: data.isLoading ?? false,
    error: data.error ?? null,
  };
}

export function createArrowLifecycleResult(
  data: Partial<ArrowLifecycleResult> = {}
): ArrowLifecycleResult {
  return {
    positions: data.positions ?? {},
    mirroring: data.mirroring ?? {},
    assets: data.assets ?? {},
    allReady: data.allReady ?? false,
    errors: data.errors ?? {},
  };
}

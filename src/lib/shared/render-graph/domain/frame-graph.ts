import type { RenderPassDescriptor } from "./render-pass";

export type TargetFormat = "rgba8" | "rgba16f";

export interface TargetDescriptor {
  width: number;
  height: number;
  format: TargetFormat;
}

/**
 * One frame's worth of work. Ordered pass list plus per-target FBO specs.
 *
 * The graph is declarative: callers build it, backend executes it. No
 * GPU state leaks across frames through the graph itself - per-pass
 * persistent state (trail ping-pong FBOs) is managed by the backend
 * keyed off pass identity (e.g. per-tip tipId in TrailPassPayload).
 */
export interface FrameGraph {
  passes: RenderPassDescriptor[];
  targets: Record<string, TargetDescriptor>;
}

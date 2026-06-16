/**
 * Threlte context unwrappers — single source of truth for resolving live
 * Three.js objects from the ThrelteContext returned by useThrelte().
 *
 * Problem: @threlte/core wraps `camera` in a CurrentWritable<T> (access via
 * `.current`), but `scene` and `renderer` are returned as plain objects in the
 * current version. The type declarations say `scene: Scene` and
 * `renderer: WebGLRenderer`, yet older build variants or minor version bumps
 * may wrap them too. Rather than sprinkling `(ctx as any).foo?.current ?? ctx.foo`
 * across 6+ files, we resolve them here once with a proper guard.
 *
 * All six callers (Museum3DScene, PlacementGhost, MuseumPortal,
 * MuseumPostProcessing, MuseumSceneEditor, MuseumPerformerStation3D) import
 * from this module.
 */

import type { ThrelteContext } from "@threlte/core";
import type { Scene, WebGLRenderer, Camera } from "three";

/**
 * A value returned by useThrelte() that may be either a plain T or wrapped in
 * an object with a `.current` property (CurrentWritable pattern).
 */
type MaybeCurrentWritable<T> = T | { current: T };

function unwrap<T>(value: MaybeCurrentWritable<T> | undefined): T | null {
  if (value == null) return null;
  if (typeof value === "object" && "current" in (value as object)) {
    return (value as { current: T }).current ?? null;
  }
  return value as T;
}

/** Resolve the Three.js Scene from a ThrelteContext. */
export function resolveScene(ctx: ThrelteContext): Scene | null {
  return unwrap<Scene>(ctx.scene as MaybeCurrentWritable<Scene>);
}

/** Resolve the WebGLRenderer from a ThrelteContext. */
export function resolveRenderer(ctx: ThrelteContext): WebGLRenderer | null {
  const r = unwrap<WebGLRenderer>(ctx.renderer as MaybeCurrentWritable<WebGLRenderer>);
  return r?.domElement ? r : null;
}

/** Resolve the active Camera from a ThrelteContext. */
export function resolveCamera(ctx: ThrelteContext): Camera | null {
  // camera is CurrentWritable<Camera> per the type declaration
  const c = unwrap<Camera>(ctx.camera as unknown as MaybeCurrentWritable<Camera>);
  return c?.isCamera ? c : null;
}

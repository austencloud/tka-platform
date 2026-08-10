/**
 * Bare-shell review mode for the Cinder Court graybox (`?shell=bare`).
 *
 * Gate 2 was rejected a second time on 2026-08-10 because three days of Gate 3
 * dressing had been applied to a shell that was never approved, and the room
 * could no longer be judged underneath it. Bare mode strips the room back to
 * the things Gate 2 is actually about - the carved shell, the walked route, the
 * thresholds, the court floors and the performer rigs - and lights them neutrally
 * so geometry is readable instead of atmospheric.
 *
 * This is a review switch, not a feature flag: nothing outside the graybox
 * review route reads it, and Gate 3 dressing is unchanged and returns the moment
 * the parameter is absent.
 */

/**
 * GLB node families that are Gate 3 placement decisions rather than room
 * structure. The torch stems in particular are the reason for the switch: 24
 * free-standing posts at standoffs between 0.42m and 2.59m from the nearest
 * shell vertex make it impossible to see whether the wall behind them is right.
 *
 * `FF_Growth_Route_*` is the walked ribbon out to the Earth door and stays -
 * hence the negative lookahead rather than a plain `FF_Growth_` prefix.
 */
const BARE_SHELL_HIDDEN = [
  /^FF_TorchStem_/i,
  /^FF_Guide_/i,
  /^FF_Trench_/i,
  /^FF_Growth_(?!Route_)/i,
] as const;

/** True when the named GLB node is dressing rather than room structure. */
export function isHiddenInBareShell(nodeName: string): boolean {
  return BARE_SHELL_HIDDEN.some((pattern) => pattern.test(nodeName));
}

/** Reads `?shell=bare` from the review route. Server-side renders normally. */
export function isBareShellRequested(): boolean {
  if (typeof window === "undefined") return false;
  return new URLSearchParams(window.location.search).get("shell") === "bare";
}

/**
 * A light grey-blue, deliberately unlike anything in the room. Against black,
 * a hole in the shell reads as another shadow; against this it reads as a hole.
 */
export const BARE_SHELL_BACKGROUND = "#48525f";

/**
 * Flat-shade and single-tone the room for review.
 *
 * The GLB is authored smooth-shaded, which is right for a finished rock and
 * wrong for reading one: averaged vertex normals run straight across the hard
 * corners a boolean carve produces, so a wall becomes one long gradient and
 * individual facets go black for reasons the geometry does not explain. Flat
 * shading puts a normal on every triangle, which makes a wall read as a wall
 * and a boolean artifact read as an artifact.
 *
 * Materials are cloned before mutating: the GLB's own materials are shared
 * across nodes and cached by the loader, so editing them in place would leak
 * review shading into the dressed scene on the next navigation.
 */
export function applyBareShellShading(object: {
  material?: unknown;
  isMesh?: boolean;
}): void {
  const source = object.material;
  const list = Array.isArray(source) ? source : [source];
  const cloned = list.map((entry) => {
    const material = entry as
      | {
          clone?: () => Record<string, unknown>;
          flatShading?: boolean;
          needsUpdate?: boolean;
        }
      | undefined;
    if (!material?.clone) return material;
    const copy = material.clone();
    copy.flatShading = true;
    copy.needsUpdate = true;
    return copy;
  });
  (object as { material: unknown }).material = Array.isArray(source)
    ? cloned
    : cloned[0];
}

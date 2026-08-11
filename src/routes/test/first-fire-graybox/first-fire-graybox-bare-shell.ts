/**
 * Bare-shell review mode for the Cinder Court graybox (`?shell=bare`).
 *
 * Gate 2 was rejected a second time on 2026-08-10 because three days of Gate 3
 * dressing had been applied to a shell that was never approved, and the room
 * could no longer be judged underneath it. Bare mode strips the room back to
 * the things Gate 2 is actually about - the carved shell, the two door
 * thresholds and the performer rigs - and lights them neutrally so geometry is
 * readable instead of atmospheric.
 *
 * The route ribbon and court floors were kept at first, on the reasoning that
 * the walked route is Gate 2 content. They are not: they are thin plates lying
 * ON the shell, and stacked a few centimetres apart they hid the one thing the
 * gate is for - the shape of the floor. See BARE_SHELL_VISIBLE.
 *
 * This is a review switch, not a feature flag: nothing outside the graybox
 * review route reads it, and Gate 3 dressing is unchanged and returns the moment
 * the parameter is absent.
 */

/**
 * The only GLB nodes bare mode keeps. Everything else in the room is a Gate 3
 * placement decision and goes.
 *
 * The torch stems were the original reason for the switch: 24 free-standing
 * posts at standoffs between 0.42m and 2.59m from the nearest shell vertex make
 * it impossible to see whether the wall behind them is right.
 *
 * The floor plates were the second reason, found on 2026-08-11. The carved rock
 * floor is one plane at z=0 - every walkable sample lands there - but the room
 * ships ~40 thin slabs lying on top of it, each shaded differently and each a
 * few centimetres above the last: the court discs top out at 0.055, the orbit
 * rings at 0.062, the trenches at 0.075 and the route ribbon runs 0.017 to
 * 0.092. Overlapping, with rock showing through the seams, they read as a
 * jagged patchwork of steps, which is what a flat floor was reported as being.
 *
 * This is a KEEP list rather than the hide list it started as, because a hide
 * list cannot survive the delivery pipeline. `gltf-transform optimize
 * --instance true` merges every repeated-geometry node into one instanced mesh
 * and the family names go with them: the 96 route-ribbon and orbit-ring
 * segments arrive at runtime as a single InstancedMesh called `Cube009`, which
 * sails through `/^FF_Route_/` and puts the ribbon straight back on the floor
 * the switch exists to clear. Structural nodes are unique geometry, so they are
 * exactly the nodes whose names cannot be merged away - which makes a keep list
 * self-correcting where a hide list silently leaks.
 *
 * Kept, and why: the carved shell itself; the two door thresholds, which mark
 * where the room begins and ends and are one box each; and the performer pads,
 * which are real raised structure that collision is derived from.
 */
const BARE_SHELL_VISIBLE = [
  /^FF_Shell_Rock$/i,
  /^FF_Water_Threshold$/i,
  /^FF_Steam_Threshold$/i,
  /^FF_PerformerPad_/i,
] as const;

/** True when the named GLB node is dressing rather than room structure. */
export function isHiddenInBareShell(nodeName: string): boolean {
  return !BARE_SHELL_VISIBLE.some((pattern) => pattern.test(nodeName));
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
 * The one tone every surface wears in bare mode. Light enough that the neutral
 * ambient actually lands on it, and desaturated so nothing in the room reads as
 * a material decision.
 */
const BARE_SHELL_TONE = "#a2a7ad";

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
 * The tone is overridden too, which the first version of this deliberately did
 * not do - the reasoning was that the GLB's own rock is one honest surface. It
 * is not: the baked basalt is near-black, so the review lights had nothing to
 * land on and the whole shell came back as a dark brown smear with a couple of
 * tan plates in it. A graybox is grey on purpose. Every surface gets the same
 * matte tone, no map, no emissive, no metalness, so the only thing left in the
 * frame is form.
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
    (copy.color as { set?: (value: string) => void } | undefined)?.set?.(
      BARE_SHELL_TONE
    );
    (copy.emissive as { set?: (value: string) => void } | undefined)?.set?.(
      "#000000"
    );
    if ("map" in copy) copy.map = null;
    if ("emissiveMap" in copy) copy.emissiveMap = null;
    if ("vertexColors" in copy) copy.vertexColors = false;
    if ("metalness" in copy) copy.metalness = 0;
    if ("roughness" in copy) copy.roughness = 0.92;
    copy.needsUpdate = true;
    return copy;
  });
  (object as { material: unknown }).material = Array.isArray(source)
    ? cloned
    : cloned[0];
}

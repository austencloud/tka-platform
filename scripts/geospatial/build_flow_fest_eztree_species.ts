/**
 * Bakes the Flow Fest tree species catalog into near-tier GLBs.
 *
 *   npx tsx scripts/geospatial/build_flow_fest_eztree_species.ts
 *   npx tsx scripts/geospatial/build_flow_fest_eztree_species.ts --only sugar-maple
 *   npx tsx scripts/geospatial/build_flow_fest_eztree_species.ts --dry-run
 *
 * WHY BUILD TIME AND NOT IN THE BROWSER
 * -------------------------------------
 * ez-tree can generate in a browser, and the temptation is to do it per session
 * so every tree is unique. That is the wrong trade here, for four reasons that
 * were each checked against this repository rather than assumed:
 *
 *  1. The renderer is instanced. `createForestRuntimeTreeInstances` builds one
 *     `InstancedMesh` per family per LOD tier and pushes thousands of matrices
 *     through it. Per-instance generation means per-instance geometry, which
 *     means one draw call per tree instead of one per family.
 *  2. The library's browser bundle inlines every bark and leaf texture as
 *     base64. Shipping it to the client costs about 4 MB of JavaScript before a
 *     single tree exists.
 *  3. The mid and far tiers are produced by `build_flow_fest_tree_lods.mjs`,
 *     which runs meshopt simplification and a union-find pass that prunes whole
 *     leaf cards. Neither runs in the browser.
 *  4. Baked output is deterministic and cacheable. The same seed produces the
 *     same tree on every machine, so a screenshot review means something.
 *
 * WHAT CALIBRATION IS SOLVING
 * ---------------------------
 * The runtime scales every instance uniformly by
 * `renderedHeightMeters / sourceHeight`, so only two proportions survive:
 * crown radius over height, and clear bole over height. Each form in the
 * catalog declares the pair it must hit, measured off the GLBs it replaces.
 * This script searches two parameters until the generated tree matches:
 *
 *   crown spread  -> scales `branch.length` at levels 1..3
 *   bole fraction -> `branch.start[1]`, where level-1 branches begin
 *
 * They interact (a wider crown raises the top of the tree, which changes both
 * ratios), so the solve alternates between them and re-measures each round.
 */

import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  realpathSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import {
  FLOW_FEST_TREE_FAMILY_PLANS,
  flowFestTreeFamilySeed,
  flowFestTreeForm,
  flowFestTreeSpeciesForForm,
  type FlowFestTreeFamilyPlan,
  type FlowFestTreeForm,
  type FlowFestTreeProportionTarget,
  type FlowFestTreeShapeOptions,
} from "../../src/routes/test/flow-fest-sim/flow-fest-tree-species";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, "../..");
const EZ_TREE_ASSETS = resolve(
  REPO_ROOT,
  "node_modules/@dgreenheck/ez-tree/src/lib/assets"
);
const OUTPUT_DIR = resolve(
  REPO_ROOT,
  "static/models/flow-fest-sim/ecology/species"
);
const MANIFEST_PATH = resolve(OUTPUT_DIR, "manifest.json");

/** Texture edge in pixels. The source atlases are 1024; 512 is the near tier. */
const TEXTURE_SIZE = 512;

// ---------------------------------------------------------------------------
// ez-tree in Node
// ---------------------------------------------------------------------------

/**
 * `textures.js` constructs a `THREE.TextureLoader` and loads every atlas at
 * module-import time, which reaches `document.createElementNS`. We never read
 * the resulting THREE textures — the GLB gets its images from the same files on
 * disk, through sharp — so a minimal stub is enough to let the import succeed.
 */
function installDomStub(): void {
  if (typeof (globalThis as { document?: unknown }).document !== "undefined") return;
  const element = () => ({
    addEventListener() {},
    removeEventListener() {},
    set src(_value: string) {},
    get src() {
      return "";
    },
  });
  (globalThis as { document?: unknown }).document = {
    createElementNS: element,
    createElement: element,
  };
}

interface RawTreeArrays {
  verts: number[];
  normals: number[];
  indices: number[];
  uvs: number[];
}

interface EzTree {
  options: Record<string, unknown>;
  branches: RawTreeArrays;
  leaves: RawTreeArrays;
  loadFromJson(json: unknown): void;
  generate(): void;
}

type EzTreeConstructor = new () => EzTree;

async function loadEzTree(): Promise<EzTreeConstructor> {
  installDomStub();
  const module = (await import("@dgreenheck/ez-tree")) as {
    Tree: EzTreeConstructor;
  };
  return module.Tree;
}

// ---------------------------------------------------------------------------
// Generation
// ---------------------------------------------------------------------------

type MutableShape = {
  seed: number;
} & {
  -readonly [K in keyof FlowFestTreeShapeOptions]: FlowFestTreeShapeOptions[K];
};

function cloneShape(shape: FlowFestTreeShapeOptions, seed: number): MutableShape {
  return JSON.parse(JSON.stringify({ ...shape, seed })) as MutableShape;
}

interface GeneratedTree {
  /** Flat XYZ triples. */
  readonly woodPositions: Float32Array;
  readonly woodNormals: Float32Array;
  readonly woodUvs: Float32Array;
  readonly woodIndices: Uint32Array;
  readonly leafPositions: Float32Array;
  readonly leafNormals: Float32Array;
  readonly leafUvs: Float32Array;
  readonly leafIndices: Uint32Array;
}

/**
 * Per-vertex normals for the leaf cards. ez-tree does not fill
 * `tree.leaves.normals`; its own mesh calls `computeVertexNormals` on a THREE
 * geometry, which the 16-bit index type in `createLeavesGeometry` caps at
 * 65535 vertices. Reading the raw arrays and computing here removes that cap.
 */
function computeVertexNormals(
  positions: Float32Array,
  indices: Uint32Array
): Float32Array {
  const normals = new Float32Array(positions.length);
  for (let i = 0; i < indices.length; i += 3) {
    const a = indices[i]! * 3;
    const b = indices[i + 1]! * 3;
    const c = indices[i + 2]! * 3;
    const abx = positions[b]! - positions[a]!;
    const aby = positions[b + 1]! - positions[a + 1]!;
    const abz = positions[b + 2]! - positions[a + 2]!;
    const acx = positions[c]! - positions[a]!;
    const acy = positions[c + 1]! - positions[a + 1]!;
    const acz = positions[c + 2]! - positions[a + 2]!;
    const nx = aby * acz - abz * acy;
    const ny = abz * acx - abx * acz;
    const nz = abx * acy - aby * acx;
    for (const offset of [a, b, c]) {
      normals[offset] = normals[offset]! + nx;
      normals[offset + 1] = normals[offset + 1]! + ny;
      normals[offset + 2] = normals[offset + 2]! + nz;
    }
  }
  for (let i = 0; i < normals.length; i += 3) {
    const length = Math.hypot(normals[i]!, normals[i + 1]!, normals[i + 2]!);
    if (length > 1e-8) {
      normals[i] = normals[i]! / length;
      normals[i + 1] = normals[i + 1]! / length;
      normals[i + 2] = normals[i + 2]! / length;
    } else {
      normals[i] = 0;
      normals[i + 1] = 1;
      normals[i + 2] = 0;
    }
  }
  return normals;
}

/**
 * Bakes `bark.textureScale` into the wood UVs. ez-tree applies it as a THREE
 * texture repeat of `(x, 1 / y)`; a GLB cannot carry that on a shared image
 * without `KHR_texture_transform`, and the LOD simplifier is happier with plain
 * UVs than with a transform extension it has to preserve through a weld.
 */
function bakeBarkUvScale(
  uvs: Float32Array,
  scale: { x: number; y: number }
): Float32Array {
  const out = new Float32Array(uvs.length);
  const scaleV = scale.y === 0 ? 1 : 1 / scale.y;
  for (let i = 0; i < uvs.length; i += 2) {
    out[i] = uvs[i]! * scale.x;
    out[i + 1] = uvs[i + 1]! * scaleV;
  }
  return out;
}

function generateTree(Tree: EzTreeConstructor, shape: MutableShape): GeneratedTree {
  const tree = new Tree();
  tree.loadFromJson(shape);
  // `loadFromJson` calls `generate`, but only after `copy` has merged the
  // options; regenerating makes the seed assignment order explicit.
  (tree.options as { seed: number }).seed = shape.seed;
  tree.generate();

  const woodPositions = new Float32Array(tree.branches.verts);
  const woodIndices = new Uint32Array(tree.branches.indices);
  // A leaf count of zero means leafless. ez-tree still emits leaf cards for it,
  // which put foliage on the standing snag and gave it a measured clear bole of
  // 0.65 against a target of zero. Honour the intent here instead.
  const leafless = shape.leaves.count <= 0;
  const leafPositions = leafless
    ? new Float32Array(0)
    : new Float32Array(tree.leaves.verts);
  const leafIndices = leafless
    ? new Uint32Array(0)
    : new Uint32Array(tree.leaves.indices);

  return {
    woodPositions,
    woodNormals: new Float32Array(tree.branches.normals),
    woodUvs: bakeBarkUvScale(
      new Float32Array(tree.branches.uvs),
      shape.bark.textureScale
    ),
    woodIndices,
    leafPositions,
    leafNormals: computeVertexNormals(leafPositions, leafIndices),
    leafUvs: leafless ? new Float32Array(0) : new Float32Array(tree.leaves.uvs),
    leafIndices,
  };
}

// ---------------------------------------------------------------------------
// Measurement (identical statistics to measure_flow_fest_trees.mjs)
// ---------------------------------------------------------------------------

interface TreeMeasurement {
  readonly height: number;
  readonly trunkHeight: number;
  readonly crownRadiusP95: number;
  readonly crownRadiusRatio: number;
  readonly trunkHeightRatio: number;
  /** Bole radius near the ground, as a fraction of height. Collision input. */
  readonly trunkRadiusRatio: number;
  readonly minY: number;
  readonly woodTriangles: number;
  readonly leafTriangles: number;
}

function percentile(sorted: number[], fraction: number): number {
  if (sorted.length === 0) return 0;
  const index = Math.min(
    sorted.length - 1,
    Math.max(0, Math.round(fraction * (sorted.length - 1)))
  );
  return sorted[index]!;
}

function measureTree(tree: GeneratedTree): TreeMeasurement {
  const wood = tree.woodPositions;
  const leaf = tree.leafPositions;
  const hasLeaves = leaf.length > 0;

  let minY = Infinity;
  let maxY = -Infinity;
  for (const source of [wood, leaf]) {
    for (let i = 1; i < source.length; i += 3) {
      const y = source[i]!;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }
  const height = Math.max(1e-6, maxY - minY);

  // Trunk axis: horizontal centre of the lowest 10% of the WOOD. Using the
  // whole-model centre lets a lopsided crown drag the axis and inflate radius.
  const boleCut = minY + height * 0.1;
  let axisX = 0;
  let axisZ = 0;
  let boleCount = 0;
  for (let i = 0; i < wood.length; i += 3) {
    if (wood[i + 1]! <= boleCut) {
      axisX += wood[i]!;
      axisZ += wood[i + 2]!;
      boleCount += 1;
    }
  }
  if (boleCount > 0) {
    axisX /= boleCount;
    axisZ /= boleCount;
  }

  const crownSource = hasLeaves ? leaf : wood;
  const radii: number[] = [];
  const heights: number[] = [];
  for (let i = 0; i < crownSource.length; i += 3) {
    radii.push(Math.hypot(crownSource[i]! - axisX, crownSource[i + 2]! - axisZ));
    heights.push(crownSource[i + 1]! - minY);
  }
  radii.sort((a, b) => a - b);
  heights.sort((a, b) => a - b);

  // Bole radius: the median radial distance of wood in a low band. ez-tree
  // builds the trunk as a tapered ring-swept cylinder, so within a band below
  // the first limbs every vertex sits at the same distance from the axis and
  // the median IS the radius; a stray low branch skews only the upper tail.
  // The band widens until it holds samples because ez-tree's trunk sections
  // are long — a narrow band can fall entirely between two rings.
  let trunkRadius = 0;
  for (const [low, high] of [
    [0.005, 0.04],
    [0.005, 0.1],
    [0, 0.15],
  ]) {
    const band: number[] = [];
    for (let i = 0; i < wood.length; i += 3) {
      const y = wood[i + 1]! - minY;
      if (y < height * low || y > height * high) continue;
      band.push(Math.hypot(wood[i]! - axisX, wood[i + 2]! - axisZ));
    }
    if (band.length < 8) continue;
    band.sort((a, b) => a - b);
    trunkRadius = percentile(band, 0.5);
    break;
  }

  const crownRadiusP95 = percentile(radii, 0.95);
  // Clear bole: where the crown actually starts. The 2nd percentile of foliage
  // height ignores the odd stray card hanging below the canopy mass.
  const trunkHeight = hasLeaves ? percentile(heights, 0.02) : 0;

  return {
    height,
    trunkHeight,
    crownRadiusP95,
    crownRadiusRatio: crownRadiusP95 / height,
    trunkHeightRatio: trunkHeight / height,
    trunkRadiusRatio: trunkRadius / height,
    minY,
    woodTriangles: tree.woodIndices.length / 3,
    leafTriangles: tree.leafIndices.length / 3,
  };
}

// ---------------------------------------------------------------------------
// Calibration
// ---------------------------------------------------------------------------

/** Geometric ladder of crown-spread multipliers used for the coarse scan. */
const CROWN_SPREAD_SCAN = [
  0.12, 0.17, 0.23, 0.3, 0.4, 0.52, 0.66, 0.82, 1, 1.2, 1.45, 1.75, 2.1, 2.5,
  3,
];
/** `branch.start[1]` candidates: where the first branch level leaves the bole. */
const BOLE_FRACTION_SCAN = [
  0.02, 0.08, 0.15, 0.23, 0.31, 0.4, 0.5, 0.6, 0.7, 0.82,
];
const REFINE_STEPS = 5;
/** Two coordinate-descent passes: crown, bole, crown again, bole again. */
const CALIBRATION_PASSES = 2;

/**
 * The crown knob. It scales how far the first three branch levels REACH and,
 * with it, how far they lean off their parent.
 *
 * Length alone is not a sufficient lever. Shortening level-1 branches lowers
 * the treetop nearly as fast as it narrows the crown, so for several species
 * crownRadius/height barely moves — sugar maple bottomed out at 0.344 with the
 * length ladder run down to 0.12x, well above its 0.255 target. Branch angle
 * moves the numerator and the denominator in OPPOSITE directions: a steeper
 * level-1 angle both tucks the crown in and lifts the treetop. Tying the two
 * together gives the solver a knob with real range while keeping one degree of
 * freedom for the search.
 *
 * The angle factor is deliberately gentler than the length factor and is
 * clamped, so a species keeps its character: an upright beech never flattens
 * into a fencerow oak, and no branch is ever driven past horizontal.
 */
function applyCrownSpread(
  shape: MutableShape,
  spread: number,
  base: {
    readonly length: Readonly<Record<number, number>>;
    readonly angle: Readonly<Record<number, number>>;
  }
): void {
  const angleFactor = Math.min(1.25, Math.max(0.45, 0.45 + 0.55 * spread));
  for (const level of [1, 2, 3]) {
    const baseLength = base.length[level];
    if (typeof baseLength === "number") {
      (shape.branch.length as Record<number, number>)[level] =
        baseLength * spread;
    }
    const baseAngle = base.angle[level];
    if (typeof baseAngle === "number") {
      (shape.branch.angle as Record<number, number>)[level] = Math.min(
        92,
        Math.max(8, baseAngle * angleFactor)
      );
    }
  }
}

function setBoleFraction(shape: MutableShape, fraction: number): void {
  (shape.branch.start as Record<number, number>)[1] = fraction;
}

interface CalibrationResult {
  readonly shape: MutableShape;
  readonly tree: GeneratedTree;
  readonly measurement: TreeMeasurement;
  readonly spread: number;
  readonly boleFraction: number;
  readonly generations: number;
  readonly seed: number;
  readonly attempt: number;
}

/**
 * When a family counts as calibrated: within 5% of its target ratio, or within
 * 0.02 in absolute ratio units, whichever is looser.
 *
 * Both bars exist because both ratios are fractions of tree height. The
 * relative bar is what matters on a wide crown, where 5% of 0.46 is a metre of
 * canopy on a mature tree. The absolute bar is what matters on a small target:
 * 5% of an understory boxelder's 0.12 clear bole is 6 mm of trunk on a ten
 * metre tree, which no viewer can see and no search should burn seeds chasing.
 */
const CALIBRATION_RELATIVE_TOLERANCE = 0.05;
const CALIBRATION_ABSOLUTE_TOLERANCE = 0.02;
/** Seeds tried per family before the closest result is accepted anyway. */
const SEED_ATTEMPTS = 5;

/**
 * Solves one knob against one measured ratio: coarse scan, then bisection
 * inside the bracket that straddles the target.
 *
 * A bisection alone is not safe here. Both knobs change the model's total
 * HEIGHT as well as the numerator, and neither ratio is reliably monotonic in
 * its knob — a longer level-1 branch raises the treetop faster than it widens
 * the crown for some species, so crownRadius/height falls as spread rises, and
 * rises for others. Scanning first reads the local direction off the samples
 * instead of assuming one, and the best sample is always retained, so the
 * result can only improve on the starting shape.
 */
function solveKnob(
  candidates: readonly number[],
  measure: (value: number) => number,
  target: number
): { value: number; error: number } {
  const samples = candidates.map((value) => ({
    value,
    measured: measure(value),
  }));
  let best = samples[0]!;
  for (const sample of samples) {
    if (Math.abs(sample.measured - target) < Math.abs(best.measured - target)) {
      best = sample;
    }
  }

  // Find the adjacent pair that brackets the target, preferring the one
  // closest to the best sample; bisect inside it using the observed direction.
  let low: (typeof samples)[number] | null = null;
  let high: (typeof samples)[number] | null = null;
  for (let i = 0; i < samples.length - 1; i += 1) {
    const a = samples[i]!;
    const b = samples[i + 1]!;
    if ((a.measured - target) * (b.measured - target) <= 0) {
      if (
        low === null ||
        Math.min(Math.abs(a.value - best.value), Math.abs(b.value - best.value)) <
          Math.abs(low.value - best.value)
      ) {
        low = a;
        high = b;
      }
    }
  }

  if (low && high) {
    let lowSample = low;
    let highSample = high;
    for (let step = 0; step < REFINE_STEPS; step += 1) {
      const midValue = (lowSample.value + highSample.value) / 2;
      const mid = { value: midValue, measured: measure(midValue) };
      if (Math.abs(mid.measured - target) < Math.abs(best.measured - target)) {
        best = mid;
      }
      if ((lowSample.measured - target) * (mid.measured - target) <= 0) {
        highSample = mid;
      } else {
        lowSample = mid;
      }
    }
  }

  return { value: best.value, error: Math.abs(best.measured - target) };
}

/**
 * Per-variant offset around the form's target, so siblings of one species do
 * not converge on an identical silhouette.
 *
 * Calibration exists to hold apparent scale, but a target hit exactly by every
 * family would undo the whole point of the swap: eleven sugar maples with the
 * same crown-to-height ratio read as one model rotated eleven ways. Spreading
 * the variants evenly across a narrow band keeps the FORM's mean on target
 * while giving each family its own reach. The band is deliberately smaller
 * than the natural variation inside the outgoing habitat sets, which ran from
 * 0.19 to 0.78 crown-radius-over-height inside a single set.
 */
const CROWN_VARIANT_BAND = 0.09;
const BOLE_VARIANT_BAND = 0.12;

function variantTargets(
  form: FlowFestTreeForm,
  variantIndex: number
): FlowFestTreeProportionTarget {
  const count = Math.max(1, form.variants);
  // -1 .. +1 across the variants, 0 when a form has a single family.
  const offset = count === 1 ? 0 : (variantIndex / (count - 1)) * 2 - 1;
  return {
    crownRadiusRatio:
      form.target.crownRadiusRatio * (1 + offset * CROWN_VARIANT_BAND),
    trunkHeightRatio:
      form.target.trunkHeightRatio * (1 + offset * BOLE_VARIANT_BAND),
  };
}

/**
 * Fits one family's shape to its variant target with two coordinate-descent
 * passes over two knobs: crown spread (branch reach and lean, levels 1-3) and
 * bole fraction (where level-1 branches leave the trunk).
 *
 * Everything that carries a species' identity is left alone: child counts,
 * gnarliness, taper, twist, radius, force, bark and leaf atlas, leaf size and
 * count. A calibrated sugar maple is still a sugar maple.
 */
function calibrate(
  Tree: EzTreeConstructor,
  form: FlowFestTreeForm,
  seed: number,
  target: FlowFestTreeProportionTarget
): CalibrationResult {
  const base = {
    length: { ...form.shape.branch.length } as Record<number, number>,
    angle: { ...form.shape.branch.angle } as Record<number, number>,
  };
  const solvesBole = target.trunkHeightRatio > 0;
  let generations = 0;

  const buildAt = (spread: number, boleFraction: number) => {
    const shape = cloneShape(form.shape, seed);
    applyCrownSpread(shape, spread, base);
    if (solvesBole) setBoleFraction(shape, boleFraction);
    const tree = generateTree(Tree, shape);
    generations += 1;
    return { shape, tree, measurement: measureTree(tree) };
  };

  let spread = 1;
  let boleFraction = form.shape.branch.start[1] ?? 0.35;

  const solveCrown = () => {
    spread = solveKnob(
      CROWN_SPREAD_SCAN,
      (value) => buildAt(value, boleFraction).measurement.crownRadiusRatio,
      target.crownRadiusRatio
    ).value;
  };

  for (let pass = 0; pass < CALIBRATION_PASSES; pass += 1) {
    solveCrown();
    if (solvesBole) {
      boleFraction = solveKnob(
        BOLE_FRACTION_SCAN,
        (value) => buildAt(spread, value).measurement.trunkHeightRatio,
        target.trunkHeightRatio
      ).value;
    }
  }
  // End on the crown. Bole placement moves the crown ratio as a side effect, so
  // a descent that finishes on the bole leaves the width — the thing a viewer
  // reads first — settled against a stale bole.
  if (solvesBole) solveCrown();

  const final = buildAt(spread, boleFraction);
  return { ...final, spread, boleFraction, generations, seed, attempt: 0 };
}

/**
 * How far a calibration result sits from its target, as a fraction of the
 * accepted tolerance for that ratio. Below 1 is converged; the value is
 * comparable across families, so the best seed is well defined even when none
 * converge.
 */
function calibrationError(
  measurement: TreeMeasurement,
  target: FlowFestTreeProportionTarget
): number {
  const score = (achieved: number, wanted: number) => {
    const allowed = Math.max(
      CALIBRATION_ABSOLUTE_TOLERANCE,
      wanted * CALIBRATION_RELATIVE_TOLERANCE
    );
    return Math.abs(achieved - wanted) / allowed;
  };
  const crown = score(measurement.crownRadiusRatio, target.crownRadiusRatio);
  if (target.trunkHeightRatio <= 0) return crown;
  return Math.max(
    crown,
    score(measurement.trunkHeightRatio, target.trunkHeightRatio)
  );
}

/**
 * Calibrates a family, walking seeds until one lands inside tolerance.
 *
 * ez-tree's trunk wander is seed-driven and the crown knob cannot undo it: a
 * strongly leaning trunk carries its foliage off the bole axis, so
 * crownRadius/height stays high even with the branches run down to a tenth of
 * their length. Sugar maple's first seed floored at 0.352 against a 0.255
 * target for exactly that reason. The seed carries no meaning of its own, so
 * the fix is to try another one rather than to bend a species' shape further.
 */
function calibrateFamily(
  Tree: EzTreeConstructor,
  form: FlowFestTreeForm,
  plan: FlowFestTreeFamilyPlan,
  target: FlowFestTreeProportionTarget
): CalibrationResult {
  let best: CalibrationResult | null = null;
  let bestError = Infinity;
  let generations = 0;

  for (let attempt = 0; attempt < SEED_ATTEMPTS; attempt += 1) {
    const seed = flowFestTreeFamilySeed(form.formId, plan.variantIndex, attempt);
    const result = calibrate(Tree, form, seed, target);
    generations += result.generations;
    const error = calibrationError(result.measurement, target);
    if (error < bestError) {
      bestError = error;
      best = { ...result, seed, attempt, generations };
    }
    if (error <= 1) break;
  }

  return { ...best!, generations };
}

/**
 * Diagnostic sweep behind `--scan`. Prints how each ratio responds to each knob
 * for one family, which is how the crown knob's usable range gets checked when
 * a form refuses to reach its target.
 */
function scanKnobs(
  Tree: EzTreeConstructor,
  form: FlowFestTreeForm,
  seed: number
): void {
  const base = {
    length: { ...form.shape.branch.length } as Record<number, number>,
    angle: { ...form.shape.branch.angle } as Record<number, number>,
  };
  const bole = form.shape.branch.start[1] ?? 0.35;
  console.log(`  crown ladder at bole ${bole.toFixed(2)}:`);
  for (const spread of CROWN_SPREAD_SCAN) {
    const shape = cloneShape(form.shape, seed);
    applyCrownSpread(shape, spread, base);
    setBoleFraction(shape, bole);
    const m = measureTree(generateTree(Tree, shape));
    console.log(
      `    spread ${spread.toFixed(2).padStart(5)} -> h ${m.height.toFixed(2).padStart(6)} crownR ${m.crownRadiusP95.toFixed(2).padStart(6)} cR/h ${m.crownRadiusRatio.toFixed(3)} tH/h ${m.trunkHeightRatio.toFixed(3)}`
    );
  }
  console.log(`  bole ladder at spread 1.00:`);
  for (const fraction of BOLE_FRACTION_SCAN) {
    const shape = cloneShape(form.shape, seed);
    applyCrownSpread(shape, 1, base);
    setBoleFraction(shape, fraction);
    const m = measureTree(generateTree(Tree, shape));
    console.log(
      `    bole   ${fraction.toFixed(2).padStart(5)} -> h ${m.height.toFixed(2).padStart(6)} cR/h ${m.crownRadiusRatio.toFixed(3)} tH/h ${m.trunkHeightRatio.toFixed(3)}`
    );
  }
}

// ---------------------------------------------------------------------------
// Textures
// ---------------------------------------------------------------------------

interface TextureSet {
  readonly baseColor: Uint8Array;
  readonly normal: Uint8Array;
  /** Occlusion in R, roughness in G, metalness in B. */
  readonly occlusionRoughnessMetallic: Uint8Array;
}

const barkTextureCache = new Map<string, TextureSet>();
const leafTextureCache = new Map<string, Uint8Array>();

type SharpModule = typeof import("sharp");

async function loadSharp(): Promise<SharpModule> {
  return (await import("sharp")).default as unknown as SharpModule;
}

async function barkTextures(
  sharp: SharpModule,
  barkType: string
): Promise<TextureSet> {
  const cached = barkTextureCache.get(barkType);
  if (cached) return cached;

  const source = (kind: string) =>
    resolve(EZ_TREE_ASSETS, `bark/${barkType}_${kind}_1k.jpg`);

  const toWebp = (path: string) =>
    sharp(path)
      .resize(TEXTURE_SIZE, TEXTURE_SIZE, { fit: "fill" })
      .webp({ quality: 82, effort: 5 })
      .toBuffer();

  const [baseColor, normal] = await Promise.all([
    toWebp(source("color")),
    toWebp(source("normal")),
  ]);

  // glTF wants occlusion / roughness / metalness in one image's R / G / B.
  const [occlusion, roughness] = await Promise.all([
    sharp(source("ao"))
      .resize(TEXTURE_SIZE, TEXTURE_SIZE, { fit: "fill" })
      .greyscale()
      .raw()
      .toBuffer(),
    sharp(source("roughness"))
      .resize(TEXTURE_SIZE, TEXTURE_SIZE, { fit: "fill" })
      .greyscale()
      .raw()
      .toBuffer(),
  ]);
  const packed = Buffer.alloc(TEXTURE_SIZE * TEXTURE_SIZE * 3);
  for (let i = 0; i < TEXTURE_SIZE * TEXTURE_SIZE; i += 1) {
    packed[i * 3] = occlusion[i]!;
    packed[i * 3 + 1] = roughness[i]!;
    packed[i * 3 + 2] = 0;
  }
  const occlusionRoughnessMetallic = await sharp(packed, {
    raw: { width: TEXTURE_SIZE, height: TEXTURE_SIZE, channels: 3 },
  })
    .webp({ quality: 82, effort: 5 })
    .toBuffer();

  const set: TextureSet = {
    baseColor: new Uint8Array(baseColor),
    normal: new Uint8Array(normal),
    occlusionRoughnessMetallic: new Uint8Array(occlusionRoughnessMetallic),
  };
  barkTextureCache.set(barkType, set);
  return set;
}

async function leafTexture(
  sharp: SharpModule,
  leafType: string
): Promise<Uint8Array> {
  const cached = leafTextureCache.get(leafType);
  if (cached) return cached;
  // `alphaQuality: 100` keeps the cutout mask crisp. A soft alpha edge is what
  // makes alpha-tested foliage crawl, and the coverage-preserving mip chain in
  // `alpha-coverage-mipmaps.ts` assumes a clean level 0.
  const buffer = await sharp(resolve(EZ_TREE_ASSETS, `leaves/${leafType}_color.png`))
    .resize(TEXTURE_SIZE, TEXTURE_SIZE, { fit: "fill" })
    .webp({ quality: 88, alphaQuality: 100, effort: 5 })
    .toBuffer();
  const bytes = new Uint8Array(buffer);
  leafTextureCache.set(leafType, bytes);
  return bytes;
}

// ---------------------------------------------------------------------------
// glTF export
// ---------------------------------------------------------------------------

/**
 * The top-level `node_modules/@gltf-transform` links vanish while a parallel
 * session's pnpm install relinks; the `.pnpm` virtual store is stable. Same
 * resolution `build_flow_fest_tree_lods.mjs` and the measurement tool use.
 */
function resolveGltfTransformCli(): string {
  const friendly = resolve(REPO_ROOT, "node_modules/@gltf-transform/cli/package.json");
  if (existsSync(friendly)) return realpathSync(friendly);
  const store = realpathSync(resolve(REPO_ROOT, "node_modules/.pnpm"));
  const entry = readdirSync(store).find((name) =>
    name.startsWith("@gltf-transform+cli@")
  );
  if (!entry) throw new Error("@gltf-transform/cli not found in the pnpm store");
  return resolve(store, entry, "node_modules/@gltf-transform/cli/package.json");
}

/* eslint-disable @typescript-eslint/no-explicit-any */
interface GltfToolkit {
  readonly io: any;
  readonly Document: any;
  readonly EXTTextureWebP: any;
  readonly EXTMeshoptCompression: any;
  readonly dedup: any;
  readonly prune: any;
  readonly reorder: any;
  readonly weld: any;
  readonly MeshoptEncoder: any;
}

async function loadGltfToolkit(): Promise<GltfToolkit> {
  const requireFromCli = createRequire(resolveGltfTransformCli());
  const [core, extensions, functions] = await Promise.all([
    import(pathToFileURL(requireFromCli.resolve("@gltf-transform/core")).href),
    import(pathToFileURL(requireFromCli.resolve("@gltf-transform/extensions")).href),
    import(pathToFileURL(requireFromCli.resolve("@gltf-transform/functions")).href),
  ]);
  const { MeshoptDecoder, MeshoptEncoder } = requireFromCli("meshoptimizer");
  await MeshoptEncoder.ready;
  const io = new core.NodeIO()
    .registerExtensions(extensions.ALL_EXTENSIONS)
    .registerDependencies({
      "meshopt.decoder": MeshoptDecoder,
      "meshopt.encoder": MeshoptEncoder,
    });
  return {
    io,
    Document: core.Document,
    EXTTextureWebP: extensions.EXTTextureWebP,
    EXTMeshoptCompression: extensions.EXTMeshoptCompression,
    dedup: functions.dedup,
    prune: functions.prune,
    reorder: functions.reorder,
    weld: functions.weld,
    MeshoptEncoder,
  };
}

interface ExportInput {
  readonly familyId: string;
  readonly form: FlowFestTreeForm;
  readonly tree: GeneratedTree;
  readonly measurement: TreeMeasurement;
  readonly bark: TextureSet;
  readonly leaf: Uint8Array | null;
}

async function exportFamilyGlb(
  toolkit: GltfToolkit,
  input: ExportInput
): Promise<Uint8Array> {
  const document = new toolkit.Document();
  const buffer = document.createBuffer();
  const scene = document.createScene(input.familyId);
  const webp = document.createExtension(toolkit.EXTTextureWebP).setRequired(true);
  void webp;

  const sampler = {
    wrapS: 10497,
    wrapT: 10497,
  };

  const makeTexture = (name: string, image: Uint8Array) =>
    document
      .createTexture(name)
      .setImage(image)
      .setMimeType("image/webp");

  const barkBaseColor = makeTexture(`${input.familyId}_bark_diff`, input.bark.baseColor);
  const barkNormal = makeTexture(`${input.familyId}_bark_nor`, input.bark.normal);
  const barkOrm = makeTexture(
    `${input.familyId}_bark_orm`,
    input.bark.occlusionRoughnessMetallic
  );

  // Material NAMES are load-bearing: `isFlowFestForestFoliageMaterial` routes
  // foliage grading, per-instance tint and the alpha mip chain by name token.
  const woodMaterial = document
    .createMaterial(`${input.familyId}_wood`)
    .setBaseColorFactor([1, 1, 1, 1])
    .setMetallicFactor(0)
    .setRoughnessFactor(1)
    .setBaseColorTexture(barkBaseColor)
    .setNormalTexture(barkNormal)
    .setOcclusionTexture(barkOrm)
    .setMetallicRoughnessTexture(barkOrm)
    .setDoubleSided(false);
  woodMaterial.getBaseColorTextureInfo()?.setWrapS(sampler.wrapS).setWrapT(sampler.wrapT);
  woodMaterial.getNormalTextureInfo()?.setWrapS(sampler.wrapS).setWrapT(sampler.wrapT);
  woodMaterial.getOcclusionTextureInfo()?.setWrapS(sampler.wrapS).setWrapT(sampler.wrapT);
  woodMaterial
    .getMetallicRoughnessTextureInfo()
    ?.setWrapS(sampler.wrapS)
    .setWrapT(sampler.wrapT);

  const mesh = document.createMesh(input.familyId);

  const addPrimitive = (
    positions: Float32Array,
    normals: Float32Array,
    uvs: Float32Array,
    indices: Uint32Array,
    material: unknown
  ) => {
    const primitive = document
      .createPrimitive()
      .setAttribute(
        "POSITION",
        document.createAccessor().setType("VEC3").setArray(positions).setBuffer(buffer)
      )
      .setAttribute(
        "NORMAL",
        document.createAccessor().setType("VEC3").setArray(normals).setBuffer(buffer)
      )
      .setAttribute(
        "TEXCOORD_0",
        document.createAccessor().setType("VEC2").setArray(uvs).setBuffer(buffer)
      )
      .setIndices(
        document.createAccessor().setType("SCALAR").setArray(indices).setBuffer(buffer)
      )
      .setMaterial(material);
    mesh.addPrimitive(primitive);
  };

  addPrimitive(
    input.tree.woodPositions,
    input.tree.woodNormals,
    input.tree.woodUvs,
    input.tree.woodIndices,
    woodMaterial
  );

  if (input.leaf && input.tree.leafIndices.length > 0) {
    const leafBaseColor = makeTexture(`${input.familyId}_leaves_diff`, input.leaf);
    const leafMaterial = document
      .createMaterial(`${input.familyId}_leaves`)
      .setBaseColorFactor([1, 1, 1, 1])
      .setMetallicFactor(0)
      .setRoughnessFactor(1)
      .setBaseColorTexture(leafBaseColor)
      .setAlphaMode("MASK")
      .setAlphaCutoff(input.form.shape.leaves.alphaTest)
      .setDoubleSided(true);
    leafMaterial
      .getBaseColorTextureInfo()
      ?.setWrapS(sampler.wrapS)
      .setWrapT(sampler.wrapT);
    addPrimitive(
      input.tree.leafPositions,
      input.tree.leafNormals,
      input.tree.leafUvs,
      input.tree.leafIndices,
      leafMaterial
    );
  }

  // Sit the tree on Y = 0 so the runtime's `bounds.min.y` correction is a no-op
  // and every family shares one ground contract.
  const node = document
    .createNode(input.familyId)
    .setMesh(mesh)
    .setTranslation([0, -input.measurement.minY, 0]);
  scene.addChild(node);

  await document.transform(
    toolkit.weld(),
    toolkit.dedup(),
    toolkit.prune({ keepAttributes: false }),
    // Vertex-cache ordering first; meshopt's filtered encoding depends on it.
    toolkit.reorder({ encoder: toolkit.MeshoptEncoder })
  );

  // Same compression the distance tiers use. These files are mostly vertex
  // data, and QUANTIZE keeps the decoder identical to the one the runtime
  // already loads (`useMeshopt()` in FlowFestForestEcology).
  document
    .createExtension(toolkit.EXTMeshoptCompression)
    .setRequired(true)
    .setEncoderOptions({
      method: toolkit.EXTMeshoptCompression.EncoderMethod.QUANTIZE,
    });

  return toolkit.io.writeBinary(document);
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

interface ManifestEntry {
  readonly familyId: string;
  readonly speciesId: string;
  readonly formId: string;
  readonly role: string;
  readonly seed: number;
  readonly seedAttempt: number;
  readonly file: string;
  readonly bytes: number;
  readonly sourceHeight: number;
  readonly target: { crownRadiusRatio: number; trunkHeightRatio: number };
  readonly formTarget: { crownRadiusRatio: number; trunkHeightRatio: number };
  readonly achieved: { crownRadiusRatio: number; trunkHeightRatio: number };
  /** Bole radius per metre of rendered height. Feeds the collision cylinder. */
  readonly trunkRadiusRatio: number;
  /** Distance to target as a fraction of the accepted tolerance; <= 1 is a hit. */
  readonly toleranceRatio: number;
  readonly triangles: { wood: number; leaf: number };
  readonly solved: { crownSpread: number; boleFraction: number; generations: number };
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run") || args.includes("--scan");
  const scan = args.includes("--scan");
  const onlyIndex = args.indexOf("--only");
  const only = onlyIndex >= 0 ? args[onlyIndex + 1] : null;

  const plans: readonly FlowFestTreeFamilyPlan[] = only
    ? FLOW_FEST_TREE_FAMILY_PLANS.filter(
        (plan) =>
          plan.speciesId === only ||
          plan.formId === only ||
          plan.familyId === only
      )
    : FLOW_FEST_TREE_FAMILY_PLANS;

  if (plans.length === 0) {
    console.error(`no families matched --only ${only}`);
    process.exitCode = 1;
    return;
  }

  const Tree = await loadEzTree();
  const sharp = dryRun ? null : await loadSharp();
  const toolkit = dryRun ? null : await loadGltfToolkit();

  if (!dryRun) mkdirSync(OUTPUT_DIR, { recursive: true });

  const header = [
    "family".padEnd(34),
    "cR/h".padStart(13),
    "tH/h".padStart(13),
    "spread".padStart(7),
    "bole".padStart(6),
    "tris".padStart(7),
    "KB".padStart(7),
  ].join(" ");
  console.log(header);
  console.log("-".repeat(header.length));

  const manifest: ManifestEntry[] = [];
  // What this run baked, versus the whole roster the manifest describes. They
  // are the same list unless `--only` scoped the run.
  let families: readonly ManifestEntry[] = manifest;
  let totalBytes = 0;
  let offTarget = 0;

  for (const plan of plans) {
    const form = flowFestTreeForm(plan.formId);
    if (!form) throw new Error(`no form for ${plan.formId}`);

    if (scan) {
      console.log(`${plan.familyId} (seed ${plan.seed})`);
      scanKnobs(Tree, form, plan.seed);
      continue;
    }

    const target = variantTargets(form, plan.variantIndex);
    const result = calibrateFamily(Tree, form, plan, target);
    const { measurement } = result;

    let bytes = 0;
    const file = `${plan.familyId}.glb`;
    if (!dryRun && sharp && toolkit) {
      const bark = await barkTextures(sharp, form.shape.bark.type);
      const leaf =
        form.shape.leaves.count > 0
          ? await leafTexture(sharp, form.shape.leaves.type)
          : null;
      const glb = await exportFamilyGlb(toolkit, {
        familyId: plan.familyId,
        form,
        tree: result.tree,
        measurement,
        bark,
        leaf,
      });
      writeFileSync(resolve(OUTPUT_DIR, file), glb);
      bytes = statSync(resolve(OUTPUT_DIR, file)).size;
      totalBytes += bytes;
    }

    const error = calibrationError(measurement, target);
    if (error > 1) offTarget += 1;
    const triangles = measurement.woodTriangles + measurement.leafTriangles;
    console.log(
      [
        plan.familyId.padEnd(34),
        `${measurement.crownRadiusRatio.toFixed(3)}/${target.crownRadiusRatio.toFixed(3)}`.padStart(13),
        `${measurement.trunkHeightRatio.toFixed(3)}/${target.trunkHeightRatio.toFixed(3)}`.padStart(13),
        result.spread.toFixed(3).padStart(7),
        result.boleFraction.toFixed(3).padStart(6),
        String(triangles).padStart(7),
        (bytes / 1024).toFixed(0).padStart(7),
        error <= 1 ? "  " : " *",
      ].join(" ")
    );

    const species = flowFestTreeSpeciesForForm(plan.formId);
    manifest.push({
      familyId: plan.familyId,
      speciesId: plan.speciesId,
      formId: plan.formId,
      role: plan.role,
      seed: result.seed,
      seedAttempt: result.attempt,
      file,
      bytes,
      sourceHeight: Number(measurement.height.toFixed(4)),
      target: {
        crownRadiusRatio: Number(target.crownRadiusRatio.toFixed(4)),
        trunkHeightRatio: Number(target.trunkHeightRatio.toFixed(4)),
      },
      formTarget: {
        crownRadiusRatio: form.target.crownRadiusRatio,
        trunkHeightRatio: form.target.trunkHeightRatio,
      },
      achieved: {
        crownRadiusRatio: Number(measurement.crownRadiusRatio.toFixed(4)),
        trunkHeightRatio: Number(measurement.trunkHeightRatio.toFixed(4)),
      },
      trunkRadiusRatio: Number(measurement.trunkRadiusRatio.toFixed(4)),
      triangles: {
        wood: measurement.woodTriangles,
        leaf: measurement.leafTriangles,
      },
      toleranceRatio: Number(error.toFixed(3)),
      solved: {
        crownSpread: Number(result.spread.toFixed(4)),
        boleFraction: Number(result.boleFraction.toFixed(4)),
        generations: result.generations,
      },
    });
    void species;
  }

  if (!dryRun) {
    // A scoped `--only` run rebakes part of the roster. The manifest still has
    // to describe the whole roster, because the ecology drift guard compares it
    // against the full catalog and the trunk-profile table is generated from
    // it. Writing only the filtered entries would silently truncate the file
    // and make the next full-catalog assertion fail on a file that is merely
    // incomplete rather than wrong. Merge instead: freshly baked entries win,
    // untouched entries survive, and entries whose family left the catalog are
    // dropped because their GLB is no longer referenced.
    const rebaked = new Map(manifest.map((entry) => [entry.familyId, entry]));
    const retained = new Map<string, ManifestEntry>();
    if (only && existsSync(MANIFEST_PATH)) {
      const previous = JSON.parse(readFileSync(MANIFEST_PATH, "utf8")) as {
        readonly families?: readonly ManifestEntry[];
      };
      for (const entry of previous.families ?? []) {
        retained.set(entry.familyId, entry);
      }
    }
    families = FLOW_FEST_TREE_FAMILY_PLANS.map(
      (plan) => rebaked.get(plan.familyId) ?? retained.get(plan.familyId)
    ).filter((entry): entry is ManifestEntry => entry !== undefined);

    writeFileSync(
      MANIFEST_PATH,
      `${JSON.stringify(
        {
          generator: "scripts/geospatial/build_flow_fest_eztree_species.ts",
          library: "@dgreenheck/ez-tree",
          textureSize: TEXTURE_SIZE,
          families,
        },
        null,
        2
      )}\n`
    );
  }

  const meanCrown =
    manifest.reduce((sum, entry) => sum + entry.achieved.crownRadiusRatio, 0) /
    manifest.length;
  const meanBole =
    manifest.reduce((sum, entry) => sum + entry.achieved.trunkHeightRatio, 0) /
    manifest.length;
  console.log("");
  console.log(
    `${manifest.length} families   mean crownRadius/height ${meanCrown.toFixed(3)}   mean trunkHeight/height ${meanBole.toFixed(3)}   total ${(totalBytes / 1024 / 1024).toFixed(2)} MB`
  );
  console.log(
    offTarget === 0
      ? "all families inside calibration tolerance"
      : `${offTarget} family(ies) outside tolerance, marked * above`
  );

  // Paste target for FLOW_FEST_FOREST_TRUNK_PROFILES. Measured here rather
  // than in the LOD builder: that script's band statistic is tuned for dense
  // conditioned scans and returns nothing on ez-tree's sparse ring-swept
  // trunks, which have only a handful of vertices in a 2-7% band.
  console.log("");
  console.log(
    "// Bole radius per metre of rendered height (paste into flow-fest-forest-ecology.ts):"
  );
  console.log("export const FLOW_FEST_FOREST_TRUNK_PROFILES: Record<string, number> = {");
  for (const entry of families) {
    console.log(`  "${entry.familyId}": ${entry.trunkRadiusRatio},`);
  }
  console.log("};");
}

await main();

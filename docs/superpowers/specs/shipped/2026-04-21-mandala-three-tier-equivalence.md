# Mandala Three-Tier Equivalence System

**Date:** 2026-04-21
**Status:** Approved — ready for implementation planning
**Phase:** Sticker Lab Phase 2
**Companion specs:**
- [`2026-04-20-mandala-canonical-form-scoping-memo.md`](./2026-04-20-mandala-canonical-form-scoping-memo.md) — problem framing
- [`2026-04-20-sticker-lab-mvp-design.md`](./2026-04-20-sticker-lab-mvp-design.md) — Phase 1 implementation

---

## 1. Goals and Non-Goals

### Goals

**Primary:** Define an algorithmic procedure that classifies any two TKA LOOP mandalas into one of three equivalence tiers — DISTINCT, SHAPE-EQUIVALENT, or ULTRA-EQUIVALENT — by examining mandala output geometry and coloration, not sequence data.

**Secondary goals that follow from the primary:**

- Make "browse unique mandalas" feasible across the 53k+ enumerated LOOPs. Without deduplication, ~90% of a gallery browse shows visual repetition.
- Enable the sticker lab to refuse duplicate mints and to surface "other LOOPs that produce this mandala" on any sticker's detail view.
- Support a mandala-as-search-key: one hash lookup returns all LOOPs that paint a given shape.
- Create the data foundation for Phase 3's Chimera Mandala Builder, which remixes canonical blue paths from one orbit with canonical red paths from another.

### Non-Goals

- Approximate / perceptual similarity. This spec defines exact equivalence only. Two mandalas that look "almost the same" but differ by a single petal curve are DISTINCT.
- Cross-length equivalence. A 4-beat LOOP and an 8-beat LOOP that happen to paint the same geometric figure are classified as DISTINCT because the underlying beat-count difference changes curve density even when tip endpoints coincide. This keeps the scope combinatorially bounded.
- Non-LOOP sequences. The mandala system is LOOP-only (`2026-03-26-sequence-mandala-design.md`, §Scope).
- Grid mode cross-equivalence. A diamond-mode mandala and a box-mode mandala are always DISTINCT, even when they produce identical geometric output. Grid mode is part of the sequence identity.
- Rendering parameter equivalence. Two `MandalaPaths` objects rendered with different `strokeWidth`, `palette`, or `style` options are the same mandala. Equivalence operates on geometry and color-assignment, not rendering parameters.

---

## 2. Primitives Defined

### 2.1 Actual `MandalaPaths` — the ground truth

`MandalaPaths` is defined in `src/lib/shared/mandala/domain/mandala-types.ts`:

```ts
export interface SVGPathData {
  d: string;      // SVG path "d" attribute string
  tipIndex: number; // index into prop's tip points array
}

export interface MandalaPaths {
  blue: SVGPathData[];
  red: SVGPathData[];
  purple: SVGPathData[];
}
```

`MandalaGeometryCalculator.calculate()` (`src/lib/shared/mandala/services/implementations/MandalaGeometryCalculator.ts`, line 613) takes `readonly StepLike[]` and returns this structure. The `purple` array is derived automatically from spatial overlap between blue and red paths (lines 557–583); it carries no independent geometric information. Purple is a *rendering hint*, not a geometric primitive.

Coloration is implicit: `blue[]` entries are blue-hand paths, `red[]` entries are red-hand paths.

### 2.2 `MandalaShape` — geometry only

A `MandalaShape` is the union of all path curves regardless of color assignment. It answers: "what curves exist in this mandala, without knowing which hand drew which curve?"

```ts
export interface MandalaShape {
  /** All tip paths, color-stripped, sorted into canonical order. */
  paths: QuantizedPath[];
  /** Number of motion-carrying beats (stepsWithMotions.length). */
  beatCount: number;
  /** Coordinate quantization resolution used (see §4). */
  quantization: number;
}

export type QuantizedPath = string; // SVG "d" string with coordinates rounded to quantization grid
```

Two `MandalaShape` values are equal when their canonical forms match byte-for-byte after the shape-normalization procedure in §4.

### 2.3 `MandalaColoring` — color assignment map

A `MandalaColoring` captures which curves are blue and which are red, referenced by their position in the canonical shape ordering.

```ts
export interface MandalaColoring {
  /** Indices into MandalaShape.paths that belong to the blue hand. */
  blueIndices: readonly number[];
  /** Indices into MandalaShape.paths that belong to the red hand. */
  redIndices: readonly number[];
}
```

After shape canonicalization picks a specific permutation of paths as the canonical order, the coloring indices are relative to that order. Shape canonicalization and coloring canonicalization must compose in the right order (see §5).

### 2.4 `Mandala` — the composite

```ts
export interface Mandala {
  shape: MandalaShape;
  coloring: MandalaColoring;
}
```

Extracting a `Mandala` from a `MandalaPaths` object:

```ts
function mandalaFromPaths(paths: MandalaPaths, beatCount: number): Mandala {
  const allPaths = [
    ...paths.blue.map(p => ({ d: p.d, hand: 'blue' as const })),
    ...paths.red.map(p => ({ d: p.d, hand: 'red' as const })),
  ];
  // purple is ignored — it is derived from blue+red overlap, carries no independent geometry
  const quantized = allPaths.map(p => ({ d: quantizePath(p.d, QUANTIZATION_GRID), hand: p.hand }));
  const sorted = sortPathsForShape(quantized); // produces deterministic raw order before canonicalization
  return {
    shape: {
      paths: sorted.map(p => p.d),
      beatCount,
      quantization: QUANTIZATION_GRID,
    },
    coloring: {
      blueIndices: sorted.flatMap((p, i) => p.hand === 'blue' ? [i] : []),
      redIndices: sorted.flatMap((p, i) => p.hand === 'red' ? [i] : []),
    },
  };
}
```

---

## 3. Group Action Catalog

The equivalence group is the set of all transformations that, when applied to a mandala, produce a mandala that should count as "the same" for a given tier.

### 3.1 Candidate transformations

**R — Rotation by k·45° (k = 0..7)**

The TKA grid has 8 cardinal/intercardinal positions (`GRID_DOT_ANGLES` in `MandalaRenderer.ts`, lines 29–38). A rotation by 45° maps each grid position to the next. In mandala coordinate space this is a rotation by k·π/4 applied to every point. The group generated by R alone is the cyclic group C₈ of order 8.

**F — Reflection**

Mirror across any of the 4 symmetry axes of the square (horizontal, vertical, two diagonals). Combined with R, this gives the full dihedral group D₈ of order 16 (all symmetries of the regular octagon).

**H — Hand swap (blue ↔ red)**

Swapping which hand is labeled blue and which is labeled red. This is a Z₂ action.

**E — Cyclic entry point shift**

A LOOP is a closed path. Rotating which beat is "first" produces the same tip trajectory but starting from a different point on the curve. For an n-beat LOOP this is a C_n action. For n=8 the group has order 8.

**T — Time reversal**

Running the LOOP backward. The tip traces the same curves in reverse. This is another Z₂ action.

### 3.2 Which transformations apply at each tier

**SHAPE tier** — equivalences that make two mandalas "the same shape" (ignoring color):

All five transformations apply: R, F, H, E, T.

- R and F: rotating or reflecting the entire figure leaves the set of curves invariant up to rigid motion.
- H: when we strip color entirely (shape tier ignores color), hand-swap is invisible.
- E: a cyclic entry shift traces the same closed curves from a different starting point. The resulting SVG path strings will differ (M starts at a different point), but the geometric curve set is the same.
- T: time reversal traces each curve in the opposite direction. The resulting d-string is different, but the set of curves is the same.

Shape-tier group: **G_shape = D₈ × Z₂(time) × C_n(entry)**. For n=8: |G_shape| = 16 × 2 × 8 = **256**. H is absorbed into D₈ at shape tier because color is stripped.

**ULTRA tier** — equivalences that make two mandalas "the same shape with the same coloring at the same points":

- R and F apply: rigid motions preserve color assignments.
- H does NOT apply: swapping blue↔red changes the coloring. Two mandalas that are identical except blue and red are swapped are SHAPE-EQUIVALENT but not ULTRA-EQUIVALENT.
- E applies when hand-swap does not break color symmetry. For most LOOPs, a cyclic entry shift preserves which hand is which. This is safe to include.
- T applies: time reversal preserves color assignments (the same hand traces the reversed curve). Safe to include.

Ultra-tier group: **G_ultra = D₈ × Z₂(time) × C_n(entry)**. For n=8: |G_ultra| = 16 × 2 × 8 = **256**. H is not in this group.

### 3.3 Theoretical orbit sizes

The orbit of a mandala under G_shape has size |G_shape| / |Stab(mandala)|, where Stab is the stabilizer subgroup (the set of group elements that leave the mandala unchanged). For a generic asymmetric mandala the stabilizer is trivial and the orbit has size 256. Mandalas with symmetry have smaller orbits: an 8-fold rotationally symmetric mandala has |Stab| ≥ 8, giving orbit size ≤ 32.

In practice most LOOPs produce asymmetric mandalas. The 53k enumeration will collapse to roughly 53000 / (average_orbit_size). If average orbit size is ~50 (a conservative estimate for the mix of symmetric and asymmetric shapes), the distinct shape count is around 1000. Testing against actual enumerated data is part of Phase 2a.

### 3.4 Why H applies to SHAPE but not ULTRA

Austen's verbatim definition: "the exact same mandala with the exact same coloration at the exact same points which would be ultra the same." Hand-swap changes which points are colored blue vs. red. Two identical shapes where blue and red are swapped are explicitly described as a step above DISTINCT but a step below ULTRA. They are SHAPE-EQUIVALENT.

---

## 4. Shape Canonical Form Algorithm

The shape canonical form takes a `MandalaPaths` object and produces a string representation that is identical for any two SHAPE-EQUIVALENT mandalas.

### 4.1 Coordinate quantization

SVG path `d` strings produced by `MandalaGeometryCalculator` use `.toFixed(2)` formatting (line 298 in `MandalaGeometryCalculator.ts`). Floating-point accumulation across the 64-samples-per-beat Catmull-Rom integration means two paths that are geometrically identical can differ at the 2nd decimal place due to different starting configurations that chain through different staff angle sequences.

**Decision:** Quantize to a grid of 0.25 mandala coordinate units. The mandala coordinate space runs from approximately −155 to +155 (MANDALA_GRID_RADIUS = 80 from `mandala-constants.ts` line 8, plus tip reach of ~75 units). At 0.25 unit resolution this gives 1240 cells per axis, sufficient to distinguish curves that differ by more than the integration noise floor.

Quantization procedure per coordinate value `v`:
```
quantized = Math.round(v / 0.25) * 0.25
```

Applied to every numeric token in the SVG `d` string via regex replacement. The result is a re-serialized path string with all coordinates snapped to the 0.25 grid.

```ts
const QUANTIZATION_GRID = 0.25;

function quantizePath(d: string, grid: number): string {
  return d.replace(/-?\d+\.?\d*/g, (match) => {
    const v = parseFloat(match);
    return (Math.round(v / grid) * grid).toFixed(2);
  });
}
```

### 4.2 Strip coloration

Collect all paths from `MandalaPaths.blue` and `MandalaPaths.red`, discard the `tipIndex` metadata and color label, quantize each path. Result: an array of quantized path strings with no color information.

Purple paths are always derived from blue+red overlap and are ignored.

### 4.3 Entry-point normalization (cyclic shift)

An SVG cubic bezier path for an n-beat LOOP has a specific M (moveto) starting point. Cyclic shifts produce paths with different M points. To canonicalize across entry shifts, we treat each closed path as a "cyclic string" and use the rotation that produces the lexicographically smallest representation.

For a path with k segments (k = beatCount × samplesPerBeat, roughly), the path decomposes into k cubic bezier segments. Represent each segment as a tuple `(x1 y1 x2 y2 x y)` — the control points and endpoint. Serialize the full path as an ordered list of segment tuples. Apply Booth's algorithm to find the lexicographically minimum rotation of this segment sequence. Rebuild the d-string from the minimum rotation.

In practice: for a staff LOOP with 8 beats at 64 samples per beat, a path has ~512 segment tuples. Booth's algorithm is O(n) — trivially fast.

### 4.4 Time-reversal normalization

For each path, compute its reverse (traverse the bezier segments backward, reversing control point order). Take the lexicographically smaller of (forward, reversed) as the canonical representation.

Combined with step 4.3: canonical(path) = min(booth_min(forward), booth_min(reversed)).

### 4.5 Shape group enumeration

To handle D₈ (rotations + reflections), enumerate all 16 elements of D₈, apply each to the full set of quantized paths, and take the lexicographically smallest result.

Applying a D₈ element to the path set means applying the corresponding 2D transformation to every coordinate in every path string, then re-quantizing. The 8 rotations are by multiples of π/4. The 8 reflections are rotation + mirror across the x-axis.

For efficiency: only apply D₈ transformations, not every combination of D₈ × Z₂(time) × C_n. Instead, per-path canonicalization in steps 4.3–4.4 handles time and cyclic shift independently, and the D₈ enumeration handles rigid body symmetry.

### 4.6 Path set serialization

After applying a D₈ element to the path set:
1. Each path has already been individually canonicalized (steps 4.3–4.4).
2. Sort the path set lexicographically by the path d-string.
3. Serialize as a newline-separated concatenation.

The shape canonical form is the lexicographically minimum such serialization across all 16 D₈ elements.

### 4.7 Pseudocode

```ts
function shapeCanonicalForm(paths: MandalaPaths, beatCount: number): string {
  // Step 1: strip color, quantize
  const allPaths: string[] = [
    ...paths.blue.map(p => quantizePath(p.d, QUANTIZATION_GRID)),
    ...paths.red.map(p => quantizePath(p.d, QUANTIZATION_GRID)),
  ];

  // Step 2: per-path canonical form (entry shift + time reversal)
  const canonPaths = allPaths.map(d => perPathCanonical(d, beatCount));

  // Step 3: enumerate D₈, apply each transformation, pick minimum serialization
  let minSerialization = '';
  for (const transform of D8_ELEMENTS) {
    const transformed = canonPaths.map(d => applyD8Transform(d, transform));
    const sorted = [...transformed].sort();
    const serialization = sorted.join('\n');
    if (minSerialization === '' || serialization < minSerialization) {
      minSerialization = serialization;
    }
  }

  return minSerialization;
}

function perPathCanonical(d: string, beatCount: number): string {
  const segments = parseBezierSegments(d);
  const boothForward = boothMinRotation(segments);
  const boothReverse = boothMinRotation(reverseBezierSegments(segments));
  const canonical = boothForward < boothReverse ? boothForward : boothReverse;
  return serializeBezierSegments(canonical);
}

// D8_ELEMENTS: 16 functions, each (x,y) → (x',y')
// Rotations: k * π/4 for k in 0..7
// Reflections: rotate then mirror across x-axis (y → -y)
```

Types required:
```ts
type BezierSegment = { x1: number; y1: number; x2: number; y2: number; x: number; y: number };
type D8Transform = (x: number, y: number) => [number, number];
```

---

## 5. Ultra Canonical Form Algorithm

The ultra canonical form extends shape canonicalization to preserve color assignment.

### 5.1 The coupling constraint

When we pick the D₈ element that minimizes the shape serialization (step 4.6), we must track which D₈ element was chosen — call it `g*`. The same `g*` is applied to the coloring. This ensures that "blue paths in the upper-left" and "blue paths in the upper-left after rotation" hash identically.

### 5.2 Procedure

```ts
function ultraCanonicalForm(paths: MandalaPaths, beatCount: number): string {
  // Step 1: strip color, quantize, per-path canonical
  const bluePaths = paths.blue.map(p => ({
    d: perPathCanonical(quantizePath(p.d, QUANTIZATION_GRID), beatCount),
    color: 'B' as const,
  }));
  const redPaths = paths.red.map(p => ({
    d: perPathCanonical(quantizePath(p.d, QUANTIZATION_GRID), beatCount),
    color: 'R' as const,
  }));
  const allTagged = [...bluePaths, ...redPaths];

  // Step 2: enumerate D₈, apply each transformation
  let minSerialization = '';
  for (const transform of D8_ELEMENTS) {
    // Apply transform to path coordinates
    const transformed = allTagged.map(p => ({
      d: applyD8Transform(p.d, transform),
      color: p.color,
    }));
    // Sort by d-string, then by color as tiebreaker
    const sorted = [...transformed].sort((a, b) =>
      a.d !== b.d ? (a.d < b.d ? -1 : 1) : a.color.localeCompare(b.color)
    );
    // Serialize: each path prefixed with its color tag
    const serialization = sorted.map(p => `${p.color}:${p.d}`).join('\n');
    if (minSerialization === '' || serialization < minSerialization) {
      minSerialization = serialization;
    }
  }

  return minSerialization;
}
```

**Key difference from shape canonical form:** paths are tagged with their color before sorting. Two mandalas that are identical except blue↔red swapped will produce different serializations because the `B:` and `R:` prefixes sort differently.

### 5.3 Relationship between shape and ultra hashes

- `shapeHash(m1) === shapeHash(m2)` implies m1 and m2 are SHAPE-EQUIVALENT.
- `ultraHash(m1) === ultraHash(m2)` implies m1 and m2 are ULTRA-EQUIVALENT.
- ULTRA-EQUIVALENT → SHAPE-EQUIVALENT (ultra is strictly stronger).
- SHAPE-EQUIVALENT does NOT imply ULTRA-EQUIVALENT.

The shape hash can be derived from the ultra canonical form by stripping color prefixes and re-minimizing, but computing it separately (without color tags) is more efficient.

---

## 6. Hashing Procedure

### 6.1 Hash function selection

**Choice: SHA-256, truncated to 64 hex characters (32 bytes).**

Justification:

- SHA-256 is available in every modern browser via `crypto.subtle.digest('SHA-256', data)` (async, Web Crypto API) and via Node's `crypto` module in build-time scripts. No external dependency.
- Collision probability for 53k inputs is negligible: ~(53000²) / 2⁶⁴ ≈ 1.5 × 10⁻¹⁰. The registry can run a byte-for-byte canonical form comparison on any reported collision to confirm.
- The canonical form strings are typically 10–40 KB (many bezier curves). SHA-256 handles arbitrary-length input.

**Alternative considered: structural hash (deterministic JSON hash)**

A custom structural hash based on sorted segment tuples and polynomial rolling would be faster but requires careful implementation to avoid collisions from hash composition. Not worth the complexity when SHA-256 is available.

**Alternative considered: xxHash**

xxHash is 10× faster than SHA-256 but requires adding a dependency. Given that canonicalization (not hashing) dominates the compute time, the speed difference is not load-bearing. SHA-256 wins on zero-dependency grounds.

### 6.2 Encoding

```ts
async function hashCanonicalForm(form: string): Promise<string> {
  const bytes = new TextEncoder().encode(form);
  const hashBuffer = await crypto.subtle.digest('SHA-256', bytes);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}
```

### 6.3 Result types

```ts
export type ShapeHash = string;  // 64-char hex SHA-256 of shape canonical form
export type UltraHash = string;  // 64-char hex SHA-256 of ultra canonical form
```

### 6.4 Collision handling

The registry stores the full canonical form string alongside each hash. On any hash lookup that finds a match, compare canonical forms byte-for-byte as a confirmation. Log a warning if hashes match but canonical forms differ (a true collision — astronomically unlikely with SHA-256 but defensively handled).

---

## 7. Data Structures

### 7.1 `MandalaEquivalenceClass`

```ts
export interface MandalaEquivalenceClass {
  /** The canonical shape form (serialized string). */
  shapeCanonicalForm: string;
  /** SHA-256 hash of shapeCanonicalForm. Primary lookup key. */
  shapeHash: ShapeHash;
  /** All ultra-equivalence classes within this shape class. */
  ultraClasses: MandalaUltraClass[];
}

export interface MandalaUltraClass {
  /** SHA-256 hash of ultra canonical form. */
  ultraHash: UltraHash;
  /** The ultra canonical form (serialized string). */
  ultraCanonicalForm: string;
  /** The chosen representative: one sequenceId that produces this mandala. */
  representativeSequenceId: string;
  /** All sequenceIds in this ultra class. */
  memberSequenceIds: string[];
}
```

### 7.2 `MandalaPrimitiveRegistry`

In-memory structure:

```ts
export interface MandalaPrimitiveRegistry {
  /** Map from shapeHash → MandalaEquivalenceClass. */
  byShape: Map<ShapeHash, MandalaEquivalenceClass>;
  /** Map from ultraHash → MandalaUltraClass. Direct lookup for deduplication. */
  byUltra: Map<UltraHash, MandalaUltraClass>;
  /** Total sequences processed. */
  totalProcessed: number;
  /** Total distinct shape classes. */
  distinctShapes: number;
  /** Total distinct ultra classes. */
  distinctUltra: number;
}
```

### 7.3 Persistent JSON schema

The registry is serialized to a JSON file at build time and loaded at runtime. Proposed location: `static/data/mandala-registry.json` (served as a static asset, loaded lazily when the sticker lab or mandala directory opens).

```json
{
  "version": 1,
  "generatedAt": 1745280000000,
  "totalSequences": 53000,
  "shapes": [
    {
      "shapeHash": "a1b2c3...",
      "shapeCanonicalForm": "M 12.50 ...\nM 45.00 ...",
      "ultraClasses": [
        {
          "ultraHash": "d4e5f6...",
          "ultraCanonicalForm": "B:M 12.50 ...\nR:M 45.00 ...",
          "representativeSequenceId": "seq_abc123",
          "memberSequenceIds": ["seq_abc123", "seq_def456"]
        }
      ]
    }
  ]
}
```

The `shapeCanonicalForm` and `ultraCanonicalForm` strings are stored in the JSON so that:
1. Collision checking can compare forms without recomputing.
2. A future streaming approach can skip hashing if the form is already stored.

At 53k sequences with an estimated 1000–5000 distinct shape classes, and roughly 2–10 ultra classes per shape class, the registry JSON will be 5–50 MB. This is acceptable for a one-time build artifact loaded lazily. If it proves too large, the canonical forms can be omitted and stored separately (hash-only index + on-demand form lookup).

### 7.4 TypeScript interface file location

New file: `src/lib/features/sticker-lab/domain/mandala-equivalence-types.ts`

---

## 8. Discovery and Enumeration Workflow

### 8.1 Where it runs

The canonicalization pass runs as a **build-time Node.js script**, not in the browser. Computing D₈ enumeration + SHA-256 hashing for 53k sequences at ~256 group elements each is CPU-bound. A rough estimate: 256 D₈ applications × 64 samples/beat × 8 beats × 2 hands × 2 tips (staff) = ~524k coordinate pair transforms per sequence. At 53k sequences: ~27 billion transforms. In practice the Booth's algorithm and per-path canonical step are cheaper than brute-force coordinate re-parsing, and sequences cluster into equivalence classes early. Target: < 10 minutes wall time on a modern laptop.

Script location: `scripts/enumerate-mandala-registry.ts` (run via `tsx scripts/enumerate-mandala-registry.ts`).

### 8.2 Incremental updates

The script supports two modes:

**Full rebuild:** Processes every LOOP sequence in the deck enumeration JSON, outputs `static/data/mandala-registry.json`.

**Incremental:** Accepts `--since <timestamp>` and processes only sequences newer than that timestamp. Merges results into an existing registry file. Used when new deck entries are added without re-enumerating the full 53k.

### 8.3 Input source

The script reads from the same JSON files produced by the deck enumerator (`scripts/enumerate-decks.ts` / equivalent). Each deck JSON record contains a `sequenceId` and a `steps` array (the same `StepLike[]` format that `MandalaGeometryCalculator.calculate()` accepts). The script instantiates `MandalaGeometryCalculator` and calls it directly in Node — the calculator has no browser dependencies.

Note: `MandalaGeometryCalculator.buildCacheKey()` (line 593–611 in `MandalaGeometryCalculator.ts`) currently includes only `motionType + startLocation + endLocation + turns`. This is sufficient for the registry because sequences with the same key will produce the same `MandalaPaths`. The canonicalization step adds rotational/reflective deduplication on top.

### 8.4 Web worker for on-demand use

The sticker lab's "other LOOPs that paint this mandala" affordance requires a runtime hash lookup. The registry JSON is loaded once into an in-memory `MandalaPrimitiveRegistry` when the sticker lab opens. All subsequent lookups are synchronous Map accesses — no recomputation needed.

If a user submits a chimera sticker (Phase 3, `sourceLoop: null`), the chimera's combined path must be canonicalized at runtime to determine its position in the registry. This runs in a dedicated web worker (`src/lib/features/sticker-lab/workers/mandala-canonicalizer.worker.ts`) to avoid blocking the main thread. The worker accepts a `MandalaPaths` message and returns `{ shapeHash, ultraHash }`.

### 8.5 Registry loading

```ts
// src/lib/features/sticker-lab/services/implementations/MandalaPrimitiveRegistryLoader.ts

export async function loadMandalaPrimitiveRegistry(): Promise<MandalaPrimitiveRegistry> {
  const response = await fetch('/data/mandala-registry.json');
  const json = await response.json();
  return deserializeRegistry(json); // converts arrays → Maps
}
```

The loader is called once, lazily, on first access to the mandala directory or sticker deduplication feature. The result is cached in a module-level variable for the session lifetime.

---

## 9. Test Cases

The following pairs use staff props (bilateral, 2 tips per hand, 4 paths total per sequence) on the diamond grid. Beat counts noted.

### 9.1 ULTRA-EQUIVALENT pairs (same shape AND same coloring)

These pairs should produce identical `ultraHash` values.

**Pair U1 — Cyclic entry shift**
- Sequence A: 8-beat LOOP, word ALPHA (rotated), starting at alpha.
- Sequence B: Same motions as A but the sequence starts at beat 3 (cyclic reindex).
- Why ULTRA: Cyclic shift is in G_ultra. The Booth's algorithm rotation canonicalizes both to the same entry point. Shape is identical, blue/red assignment is identical.
- Expected: `ultraHash(A) === ultraHash(B)`, `shapeHash(A) === shapeHash(B)`.

**Pair U2 — Time reversal**
- Sequence A: 8-beat LOOP, word BOOK (rotated).
- Sequence B: BOOK played backward (reversed beat order).
- Why ULTRA: T ∈ G_ultra. Per-path time-reversal normalization canonicalizes both. Both sequences paint the same curves in opposite traversal directions.
- Expected: `ultraHash(A) === ultraHash(B)`.

**Pair U3 — D₈ rotation by 45°**
- Sequence A: 8-beat LOOP anchored at N-start.
- Sequence B: Same word / motion structure but anchored at NE-start (rotated 45°).
- Why ULTRA: Rotation ∈ D₈ ⊆ G_ultra. The D₈ enumeration step normalizes both to the same canonical orientation.
- Expected: `ultraHash(A) === ultraHash(B)`.

**Pair U4 — D₈ reflection**
- Sequence A: A LOOP that is left-right asymmetric.
- Sequence B: The mirror image LOOP (same positions reflected across the vertical axis).
- Why ULTRA: Reflection ∈ D₈ ⊆ G_ultra. Mirror of the coordinate set is one of the 16 D₈ elements.
- Expected: `ultraHash(A) === ultraHash(B)`.

**Pair U5 — Two structurally different sequences, same mandala output**
- Sequence A: A 4-beat inverted LOOP using all-pro motions at level 1.
- Sequence B: A different 4-beat inverted LOOP using anti motions, but whose tip trajectory happens to be geometrically identical to A's tip trajectory.
- Why ULTRA: The mandala comparison ignores sequence structure entirely — it operates only on `MandalaPaths` output. If two different motion vocabularies produce the same tip curves (which can happen when PRO and ANTI motions with different turn values trace the same arc), they will be ultra-equivalent.
- Expected: `ultraHash(A) === ultraHash(B)`, `shapeHash(A) === shapeHash(B)`.

### 9.2 SHAPE-EQUIVALENT but NOT ULTRA-EQUIVALENT pairs

These pairs share a `shapeHash` but differ in `ultraHash`.

**Pair S1 — Hand swap**
- Sequence A: LOOP where blue traces clockwise petals, red traces counterclockwise petals.
- Sequence B: Same LOOP but blue and red are swapped (the sequence runs on swapped hands).
- Why SHAPE not ULTRA: H ∉ G_ultra. The geometric curve set is identical. But blue indices and red indices differ. The `B:` and `R:` prefixes in ultra canonical form sort differently.
- Expected: `shapeHash(A) === shapeHash(B)`, `ultraHash(A) !== ultraHash(B)`.

**Pair S2 — Swapped LOOP variant**
- Sequence A: A base LOOP.
- Sequence B: The swapped-LOOP variant of A (the LOOP executor swaps blue and red hands).
- Why SHAPE not ULTRA: The swapped executor produces the same geometric figure but with hands exchanged. Identical to S1 structurally.
- Expected: `shapeHash(A) === shapeHash(B)`, `ultraHash(A) !== ultraHash(B)`.

**Pair S3 — Mirrored with asymmetric coloring**
- Sequence A: A LOOP with distinct blue and red petal patterns.
- Sequence B: Sequence A reflected (mirrored LOOP variant), which reflects the position of each hand's petal cluster. The geometric set of curves is identical. The hand labels survive the reflection but now map to different spatial positions.
- Why SHAPE not ULTRA: The reflection that makes A and B shape-equivalent maps blue paths to the positions where red paths were and vice versa. The coloring tag does not survive this particular D₈ element unchanged. The shape canonical form discards color and sees them as equal. The ultra canonical form tags paths with color before sorting and sees a difference.
- Expected: `shapeHash(A) === shapeHash(B)`, `ultraHash(A) !== ultraHash(B)`.

**Pair S4 — Inverted with color flip**
- Sequence A: A base LOOP.
- Sequence B: The inverted-LOOP variant of A. Inverted LOOPs run both hands in reversed rotation directions. This often produces the same geometric curves (the inverted curves can be equivalent to the originals under D₈ + time reversal) but flips which hand draws which petal set.
- Why SHAPE not ULTRA: Same reasoning as S1–S3.
- Expected: `shapeHash(A) === shapeHash(B)`, `ultraHash(A) !== ultraHash(B)`.

**Pair S5 — 180° rotation with color asymmetry**
- Sequence A: A LOOP with a blue petal cluster in the northern hemisphere and a red petal cluster in the southern hemisphere.
- Sequence B: The same LOOP rotated 180° on the grid. Blue is now in the south, red in the north.
- Why SHAPE not ULTRA: The 180° rotation (k=4 element of C₈ ⊆ D₈) is in G_ultra, so if it is the rotation that minimizes the shape canonical form, the ultra canonical form will also apply it — and blue/red assignments will follow correctly. But if the 180° rotation is in G_shape (H absorbed) and not in G_ultra for THIS specific mandala (because applying 180° rotation maps blue to where red was), then the ultra hash differs. This pair specifically picks a LOOP where the 180° rotation is the minimizing element for shape but swaps colors relative to the non-rotated form.
- Expected: `shapeHash(A) === shapeHash(B)`, `ultraHash(A) !== ultraHash(B)`.

### 9.3 DISTINCT pairs

These pairs should produce different `shapeHash` values.

**Pair D1 — Different turn values**
- Sequence A: Word ALPHA with 0 turns.
- Sequence B: Word ALPHA with 1 turn per beat.
- Why DISTINCT: Turn values change the prop rotation per beat, which changes the tip trajectory radius and curvature. The curve set is geometrically different.
- Expected: `shapeHash(A) !== shapeHash(B)`.

**Pair D2 — Same word, different letter types**
- Sequence A: A LOOP using all Type 1 (dual-shift) letters.
- Sequence B: A LOOP using all Type 3 (dash) letters but the same start/end locations.
- Why DISTINCT: Pro vs. dash produce arc vs. straight-line hand paths. The tip curves are geometrically different even if they start and end at the same grid positions.
- Expected: `shapeHash(A) !== shapeHash(B)`.

**Pair D3 — Different beat count**
- Sequence A: A 4-beat LOOP.
- Sequence B: An 8-beat LOOP that uses the same motion pattern as A repeated twice.
- Why DISTINCT: Cross-length equivalence is explicitly out of scope (§1, Non-Goals). Different `beatCount` → different canonical form even if the geometric curve density repeats.
- Expected: `shapeHash(A) !== shapeHash(B)`.

**Pair D4 — Same structure, different grid mode**
- Sequence A: A LOOP in diamond grid mode.
- Sequence B: The same LOOP in box grid mode.
- Why DISTINCT: Grid mode cross-equivalence is out of scope (§1, Non-Goals). The LOCATION_ANGLES differ between diamond and box grids, producing different tip trajectories.
- Expected: `shapeHash(A) !== shapeHash(B)`.

**Pair D5 — Different prop types**
- Sequence A: An 8-beat LOOP rendered with staff props (bilateral, 2 tips per hand).
- Sequence B: The same sequence rendered with fan props (unilateral, 1 tip per hand).
- Why DISTINCT: `MandalaGeometryCalculator.getTipOffsetsForProp()` selects different tip offset sets for staff vs. fan. The geometric output is different: staff produces 4 paths (blue-left, blue-right, red-left, red-right), fan produces 2. The path sets are geometrically distinct.
- Expected: `shapeHash(A) !== shapeHash(B)`.

---

## 10. Open Questions — Resolved

The scoping memo listed 10 open questions. Each is resolved here.

**Q1: Does hand-color swap count as equivalence?**

Resolved in §3.2: hand-swap is in G_shape (makes two mandalas SHAPE-EQUIVALENT) but not in G_ultra (they remain ULTRA-DISTINCT). This matches Austen's three-tier definition precisely — hand-swapped mandalas are "one step further" from identical, not fully equivalent.

**Q2: Does time reversal count?**

Yes, for both tiers. T ∈ G_shape and T ∈ G_ultra. Per-path canonical form handles it in step 4.4. Two LOOPs that trace the same tip curves in opposite directions produce the same mandala.

**Q3: Exact or approximate canonical form?**

Exact, with coordinate quantization at 0.25 units (§4.1). The 0.25 grid is narrow enough to distinguish genuinely different curves but wide enough to absorb floating-point noise from the integration chain in `MandalaGeometryCalculator`. If testing against the actual 53k dataset reveals systematic misfires (visually identical mandalas producing different hashes, or visually distinct mandalas colliding), the quantization grid is the single tuning parameter to adjust.

**Q4: Cross-length equivalence?**

Out of scope, explicitly. Classified as DISTINCT regardless of geometric similarity.

**Q5: Representation choice?**

Hybrid: the SVG `d` strings produced by `MandalaGeometryCalculator` serve as the serializable skeleton (option (c) from the memo — combinatorial, discrete segments). The quantized d-strings are canonical representations of the parametric curves. Full geometric fidelity is preserved through the bezier coefficients; the Booth's algorithm canonicalization operates on the segment tuple sequence.

The graph-on-grid-positions approach (option (c) from the memo) is rejected because it loses curve shape — two different arcs between the same grid endpoints have different tip trajectories. The bezier coefficient approach preserves this.

**Q6: What does "petal" mean formally?**

A petal is the curve traced by one tip during one beat, as produced by `generatePathPoints()` in `MandalaGeometryCalculator.ts` (lines 351–432). Formally, it is one bezier segment sequence produced by `samplesPerBeat` interpolation samples. The canonical form operates on the full path (all beats concatenated) rather than individual petals, so "petal" is not a unit in the algorithm — it is a visualization aid only.

**Q7: Performance target?**

Build-time script, target < 10 minutes for 53k sequences on a modern laptop. Runtime: registry lookup is a synchronous Map access, O(1). Runtime canonicalization (chimera path in Phase 3) runs in a web worker, target < 500ms per mandala.

**Q8: Stabilizer metadata?**

Yes. Store `orbitSize` on each `MandalaEquivalenceClass`. Computed as: run all 256 G_shape elements, count how many leave the canonical form unchanged (those form the stabilizer). Orbit size = 256 / |stabilizer|. This metadata exposes "how symmetric is this mandala" to the UI — mandalas with orbit size 8 or less have high symmetry worth surfacing.

```ts
// Added to MandalaEquivalenceClass:
orbitSize: number; // 256 / |stabilizer(mandala)|
```

**Q9: Interaction with grid mode?**

Diamond-mode and box-mode mandalas are always DISTINCT (non-goals, §1). The registry is partitioned by grid mode: two registry JSON files (`mandala-registry-diamond.json`, `mandala-registry-box.json`) or a top-level `gridMode` discriminant in the combined file.

**Q10: Fidelity vs. aesthetic?**

Exact equivalence only, with the 0.25 quantization grid as the only "fuzzy" element. No threshold-based near-equivalence for the gallery. If this proves too strict in practice (two visually indistinguishable mandalas are classified as DISTINCT due to a micro-difference in integration), the quantization grid is the lever to adjust.

---

## 11. Implementation Constraints

### 11.1 Files that must not break

| File | Constraint |
|---|---|
| `src/lib/shared/mandala/domain/mandala-types.ts` | `MandalaPaths`, `SVGPathData` interfaces must remain stable. New types go in `mandala-equivalence-types.ts`, not here. |
| `src/lib/shared/mandala/services/implementations/MandalaGeometryCalculator.ts` | No changes. The canonicalization layer sits above it, consuming its output. |
| `src/lib/shared/mandala/services/implementations/MandalaRenderer.ts` | No changes. |
| `src/lib/features/sticker-lab/domain/sticker-types.ts` | No changes to existing types. New field `shapeHash?: ShapeHash` may be added to `StickerUnit` in Phase 2b, as an optional extension. |
| `src/lib/features/sticker-lab/state/mandala-paths-cache.svelte.ts` | No changes. The equivalence system reads `MandalaPaths` from this cache. |

### 11.2 New files required

```
src/lib/features/sticker-lab/domain/
  mandala-equivalence-types.ts           # MandalaShape, MandalaColoring, Mandala, MandalaEquivalenceClass, etc.

src/lib/features/sticker-lab/services/contracts/
  IMandalaCanonicalizer.ts               # interface for the canonicalization service
  IMandalaPrimitiveRegistryLoader.ts     # interface for loading the registry

src/lib/features/sticker-lab/services/implementations/
  MandalaCanonicalizer.ts                # shape + ultra canonical form algorithms
  MandalaPrimitiveRegistryLoader.ts      # fetch + deserialize registry JSON

src/lib/features/sticker-lab/workers/
  mandala-canonicalizer.worker.ts        # web worker wrapper for runtime canonicalization (Phase 3)

scripts/
  enumerate-mandala-registry.ts          # build-time script: processes deck JSONs → mandala-registry.json

static/data/
  mandala-registry-diamond.json          # build artifact (gitignored or committed, TBD)
  mandala-registry-box.json
```

### 11.3 DI registration

The `MandalaCanonicalizer` and `MandalaPrimitiveRegistryLoader` are registered in the sticker-lab DI container. The `IMandalaCanonicalizer` symbol is added to `src/lib/shared/di/container-types.ts`. Binding added to `src/lib/shared/di/index.ts`.

### 11.4 Registry JSON: commit or gitignore?

The registry JSON is a build artifact derived from sequence data. It does not contain secrets and is large (~5–50 MB). Decision: **gitignore the registry JSON** and generate it as part of the build pipeline (or as a manual `npm run enumerate-mandala-registry` step). The sticker lab's registry loader handles the case where the file is absent by showing a "registry unavailable" state rather than crashing.

---

## 12. Phase Boundaries

### Phase 2a — Hashing and Registry (no UI)

Deliverables:
- `mandala-equivalence-types.ts` with all TypeScript interfaces.
- `MandalaCanonicalizer.ts` with `shapeCanonicalForm()`, `ultraCanonicalForm()`, and their respective `hashCanonicalForm()` wrappers.
- Unit tests (Jest/Vitest) covering all 15 test cases in §9. Tests use a small set of pre-computed `MandalaPaths` objects (generated by calling `MandalaGeometryCalculator` on known sequences and serializing the output as test fixtures).
- `scripts/enumerate-mandala-registry.ts` producing `mandala-registry-diamond.json` and `mandala-registry-box.json` from the existing deck enumeration JSONs.
- `MandalaPrimitiveRegistryLoader.ts` and its interface.
- DI wiring.

Acceptance criteria: running the registry script against the full 53k enumeration completes in < 10 minutes and produces a registry where the ratio of distinct shapes to total sequences is in the expected 1:10–1:100 range.

### Phase 2b — UI Exposure in Sticker Lab

Deliverables:
- Sticker deduplication: `addLoop()` in sticker-lab-state checks `ultraHash` before adding. If the same ultra hash already exists on the sheet, show a toast ("This mandala is already on your sheet") rather than a duplicate.
- "Other LOOPs that make this mandala" affordance on each `StickerListItem`. Tap/click opens a drawer listing all `memberSequenceIds` from the ultra class.
- Mandala directory: a new tab or section in the Stickers lab showing one sticker thumbnail per shape equivalence class, with the orbit size and ultra class count displayed.
- `shapeHash` and `ultraHash` added as optional fields to `StickerUnit` (for future search).

### Phase 2c — Beyond

- Chimera Mandala Builder (Phase 3 of Sticker Lab): the canonical blue path pool and canonical red path pool are the two axes of the chimera builder. Phase 3 depends on Phase 2a being complete.
- "Find all sequences that paint this shape" as a search axis in the deck browser.
- Deck grouping by mandala orbit: curated packs like "All LOOPs in this petal family."
- Per-mandala symmetry badges in the gallery (orbit size metadata from §10, Q8).

---

*This spec is self-contained. Implementation planning follows the `superpowers:writing-plans` skill applied to Phase 2a deliverables.*

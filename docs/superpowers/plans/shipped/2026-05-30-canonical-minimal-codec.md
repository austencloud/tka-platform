# Canonical Minimal Sequence Codec — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the versioned (v1/v2/v3) TKA sequence codec with one canonical format that stores only irreducible per-motion fields and derives `motionType`, `handPath`, both orientations, and `propType` on decode.

**Architecture:** A single shared deriver (in `render/core/calculations/orientation.ts`, which already owns `calculateEndOrientation` + `getHandpathDirection`) gains `deriveMotionType` + `deriveHandOrbitalDirection`. The encoder writes `startLoc, endLoc, rotationDirection, turns` per motion (+ one `prefloatRotationDirection` char on floats), plus a per-sequence header of 2 orientation seeds + 2 prop types. Decode derives everything else. All v1/v2/v3 branches, `reencodeFlat`, and recipe-hash version logic are deleted — nothing is released, so there is no legacy corpus to stay compatible with.

**Tech Stack:** TypeScript, Svelte 5, Vitest. Tests run with `npx vitest run --config tests/config/vitest.config.ts <path>`.

---

## Spec

Source of truth: `docs/superpowers/specs/2026-05-30-canonical-minimal-codec-design.md`. Read it before starting.

## Format reference (the one canonical format)

```
<header>|<startPositionBeat>|<beat>|<beat>|...
```

- **header** = `<blueOriSeed><redOriSeed><bluePropCode><redPropCode>` — 4 chars, no `:`. Distinguishes itself from a beat because beats always contain `:`.
- **beat** = `<blueMotion>:<redMotion>`
- **motion (non-float)** = `<startLoc:2><endLoc:2><rotation:1><turns:1+>`
- **motion (float, turns code `f`)** = `<startLoc:2><endLoc:2><rotation:1><turns:1><prefloatRot:1>` where `rotation` is `x` (noRotation, honest) and `prefloatRot` is `c`/`u` (cw/ccw)
- An absent motion (e.g. one-hand step) encodes as empty string between the `:`.

Existing single-char maps in `sequence-encoder.ts` are reused verbatim: `LOCATION_ENCODE/DECODE` (2-char), `ROTATION_ENCODE/DECODE` (`c`/`u`/`x`), `ORIENTATION_ENCODE/DECODE`, `PROP_TYPE_ENCODE/DECODE`. `MOTION_TYPE_ENCODE/DECODE` is **deleted** (no longer stored).

## File Structure

| File | Responsibility | Change |
|------|----------------|--------|
| `src/lib/shared/render/core/calculations/orientation.ts` | Canonical derivers. Already has `calculateEndOrientation`, `getHandpathDirection` (full handpath incl. hashIn/hashOut). | **Add** `deriveHandOrbitalDirection`, `deriveMotionType`. |
| `src/lib/shared/navigation/services/sequence-encoder.ts` | The codec. | **Rewrite** encodeMotion/decodeMotion/encodeBeat/decodeBeat/encodeSequence/decodeSequence to single format. **Delete** `decodeSequenceV3`, `reencodeFlat`, `MOTION_TYPE_ENCODE/DECODE`, all `formatVersion` params. |
| `src/lib/shared/qr/services/compositional-decoder.ts` | Recipe QR decode. | **Delete** seedVersion logic + `reencodeFlat` import; hash always on the single format. |
| `tests/unit/codec/motion-type-parity.test.ts` | **Centerpiece** corpus parity gate. | **Create.** |
| `tests/unit/codec/canonical-codec.test.ts` | Round-trip + float + header tests for the new format. | **Create.** |
| `tests/unit/codec/derive-endorientation.test.ts`, `derive-startorientation.test.ts`, `qr-roundtrip.test.ts`, `deriver-parity.test.ts` | Existing tests referencing `__test__.encodeMotion(m, 1\|2\|3)` and `v2\|`/`v3\|` sentinels. | **Update** to the single format (no version args). |

---

### Task 1: Add `deriveHandOrbitalDirection` + `deriveMotionType` to the canonical deriver

**Files:**
- Modify: `src/lib/shared/render/core/calculations/orientation.ts` (append exports near `getHandpathDirection`, ~line 84)
- Test: `tests/unit/codec/derive-motion-type.test.ts` (create)

Context: `getHandpathDirection(start, end)` already exists in this file and returns `"cw" | "ccw" | "dash" | "static" | "hashIn" | "hashOut"`. `deriveHandOrbitalDirection` reduces that to the shift-arc direction or null. `deriveMotionType` is the full classifier the codec needs (the existing `deriveMotionType` copies in the create module are partial — they fall back to a stored type, which decode does not have).

- [ ] **Step 1: Write the failing test**

`tests/unit/codec/derive-motion-type.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import {
  deriveMotionType,
  deriveHandOrbitalDirection,
} from "$lib/shared/render/core/calculations/orientation";

describe("deriveHandOrbitalDirection", () => {
  it("returns cw/ccw for shift arcs, null for non-shift geometry", () => {
    expect(deriveHandOrbitalDirection("n", "e")).toBe("cw");   // diamond cw
    expect(deriveHandOrbitalDirection("n", "w")).toBe("ccw");  // diamond ccw
    expect(deriveHandOrbitalDirection("ne", "se")).toBe("cw"); // box cw
    expect(deriveHandOrbitalDirection("n", "n")).toBeNull();   // static
    expect(deriveHandOrbitalDirection("n", "s")).toBeNull();   // dash (opposite)
    expect(deriveHandOrbitalDirection("n", "c")).toBeNull();   // hash (to center)
  });
});

describe("deriveMotionType", () => {
  it("float when turns is fl, before any geometry check", () => {
    expect(deriveMotionType("n", "e", "c", "fl")).toBe("float");
  });
  it("shift: pro when rotation matches orbit, anti when opposite", () => {
    // n->e orbit is cw
    expect(deriveMotionType("n", "e", "c", 0)).toBe("pro");  // cw == cw
    expect(deriveMotionType("n", "e", "u", 0)).toBe("anti"); // ccw != cw
    expect(deriveMotionType("n", "e", "c", 1)).toBe("pro");  // turns irrelevant to pro/anti
  });
  it("static when start == end", () => {
    expect(deriveMotionType("n", "n", "x", 0)).toBe("static");
  });
  it("dash for opposite-point straight line", () => {
    expect(deriveMotionType("n", "s", "x", 0)).toBe("dash");
  });
  it("dash (MotionType axis) for perimeter<->center hash geometry", () => {
    expect(deriveMotionType("n", "c", "x", 0)).toBe("dash");
    expect(deriveMotionType("c", "n", "x", 0)).toBe("dash");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run --config tests/config/vitest.config.ts tests/unit/codec/derive-motion-type.test.ts`
Expected: FAIL — `deriveMotionType`/`deriveHandOrbitalDirection` are not exported.

- [ ] **Step 3: Implement the derivers**

Append to `src/lib/shared/render/core/calculations/orientation.ts` after `getHandpathDirection` (the existing function around line 84). The orbital direction is just the shift case of the existing handpath map:

```ts
/**
 * The shift-arc orbital direction for a hand path, or null when the path is not
 * a shift (static / dash / hash geometry). Built on the canonical getHandpathDirection.
 */
export function deriveHandOrbitalDirection(
  startLocation: string,
  endLocation: string
): "cw" | "ccw" | null {
  const hp = getHandpathDirection(startLocation, endLocation);
  return hp === "cw" || hp === "ccw" ? hp : null;
}

/**
 * Full motion-type classifier from the irreducible stored fields. Unlike the
 * partial create-module copies, this resolves ALL five MotionType values with no
 * stored-type fallback, so the codec can derive motionType on decode.
 *
 * rotationDirection codes: "cw"/"ccw"/"noRotation" (enum string values) OR the
 * codec's single-char "c"/"u"/"x" — both are accepted.
 */
export function deriveMotionType(
  startLocation: string,
  endLocation: string,
  rotationDirection: string,
  turns: number | "fl"
): "pro" | "anti" | "float" | "dash" | "static" {
  if (turns === "fl") return "float";

  const orbit = deriveHandOrbitalDirection(startLocation, endLocation);
  if (orbit !== null) {
    const rot = rotationDirection.toLowerCase();
    const rotIsCw = rot === "cw" || rot === "c";
    const orbitDir = orbit === "cw" ? "cw" : "ccw";
    const motionDir = rotIsCw ? "cw" : "ccw";
    return motionDir === orbitDir ? "pro" : "anti";
  }

  if (startLocation.toLowerCase() === endLocation.toLowerCase()) return "static";
  return "dash";
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run --config tests/config/vitest.config.ts tests/unit/codec/derive-motion-type.test.ts`
Expected: PASS (all cases).

- [ ] **Step 5: Commit**

```bash
git add src/lib/shared/render/core/calculations/orientation.ts tests/unit/codec/derive-motion-type.test.ts
git commit -m "feat(codec): canonical deriveMotionType + deriveHandOrbitalDirection" -- src/lib/shared/render/core/calculations/orientation.ts tests/unit/codec/derive-motion-type.test.ts
```

---

### Task 2: Corpus parity ship gate (centerpiece)

**Files:**
- Create: `tests/unit/codec/motion-type-parity.test.ts`

This proves `deriveMotionType` reproduces the **stored** `blueMotionType`/`redMotionType` for every motion in both base grid-mode dataframes (650 rows × 2 hands × 2 modes). CSV columns (verified): `letter,startPosition,endPosition,timing,direction,blueMotionType,blueRotationDirection,blueStartLocation,blueEndLocation,redMotionType,redRotationDirection,redStartLocation,redEndLocation`. Base dataframes contain no float/hash rows (turns are 0); those axes are covered by Task 1 unit cases. The CSVs live at `static/data/pictographs/{Diamond,Box}PictographDataframe.csv`.

- [ ] **Step 1: Write the failing test**

`tests/unit/codec/motion-type-parity.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { deriveMotionType } from "$lib/shared/render/core/calculations/orientation";

function loadRows(file: string): Record<string, string>[] {
  const text = readFileSync(resolve(process.cwd(), file), "utf8").trim();
  const lines = text.split(/\r?\n/);
  const header = lines[0]!.split(",");
  return lines.slice(1).map((line) => {
    const cells = line.split(",");
    const row: Record<string, string> = {};
    header.forEach((h, i) => (row[h] = cells[i] ?? ""));
    return row;
  });
}

const FILES = [
  "static/data/pictographs/DiamondPictographDataframe.csv",
  "static/data/pictographs/BoxPictographDataframe.csv",
];

describe("corpus parity: deriveMotionType reproduces stored motionType", () => {
  for (const file of FILES) {
    it(`matches every motion in ${file}`, () => {
      const rows = loadRows(file);
      expect(rows.length).toBeGreaterThan(100);
      const mismatches: string[] = [];
      for (const row of rows) {
        for (const color of ["blue", "red"] as const) {
          const stored = row[`${color}MotionType`];
          if (!stored) continue;
          const derived = deriveMotionType(
            row[`${color}StartLocation`]!,
            row[`${color}EndLocation`]!,
            row[`${color}RotationDirection`]!,
            0
          );
          if (derived !== stored) {
            mismatches.push(
              `${row.letter} ${color}: ${row[`${color}StartLocation`]}->${row[`${color}EndLocation`]} ` +
                `rot=${row[`${color}RotationDirection`]} stored=${stored} derived=${derived}`
            );
          }
        }
      }
      expect(mismatches, mismatches.slice(0, 20).join("\n")).toEqual([]);
    });
  }
});
```

- [ ] **Step 2: Run the test**

Run: `npx vitest run --config tests/config/vitest.config.ts tests/unit/codec/motion-type-parity.test.ts`
Expected: PASS. If it FAILS, the failure names the exact letter/motion. A real mismatch means either `deriveMotionType` has a bug or the corpus contains a class the rule doesn't cover (e.g. an unexpected pair) — STOP and reconcile against the spec before continuing; do not weaken the test.

- [ ] **Step 3: Commit**

```bash
git add tests/unit/codec/motion-type-parity.test.ts
git commit -m "test(codec): exhaustive corpus parity gate for deriveMotionType" -- tests/unit/codec/motion-type-parity.test.ts
```

---

### Task 3: Rewrite `encodeMotion` to the single canonical format

**Files:**
- Modify: `src/lib/shared/navigation/services/sequence-encoder.ts:133-191`

Drops the `motionType` char and the `formatVersion` param. A float (`turns === "fl"`) writes `rotation = x` and appends the prefloat rotation char.

- [ ] **Step 1: Write the failing test**

`tests/unit/codec/canonical-codec.test.ts` (create — more cases added in Task 6):
```ts
import { describe, it, expect } from "vitest";
import { __test__ } from "$lib/shared/navigation/services/sequence-encoder";
import {
  MotionType, RotationDirection, Orientation,
} from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";
import { GridLocation } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
import { PropType } from "$lib/shared/pictograph/prop/domain/enums/PropType";

function motion(over: Record<string, unknown> = {}) {
  return {
    motionType: MotionType.PRO,
    rotationDirection: RotationDirection.CLOCKWISE,
    startLocation: GridLocation.NORTH,
    endLocation: GridLocation.EAST,
    turns: 0,
    startOrientation: Orientation.IN,
    endOrientation: Orientation.IN,
    propType: PropType.STAFF,
    ...over,
  } as never;
}

describe("encodeMotion canonical format", () => {
  it("non-float motion = startLoc(2)+endLoc(2)+rot(1)+turns(1), no type char", () => {
    // n=no, e=ea, cw=c, turns=0  ->  "noeac0"
    expect(__test__.encodeMotion(motion())).toBe("noeac0");
  });
  it("float = rotation x + appended prefloat rotation char", () => {
    // float n->e, prefloat was pro on a cw arc => prefloatRotationDirection cw => "c"
    // encoded: no ea x f c
    const m = motion({
      motionType: MotionType.FLOAT,
      turns: "fl",
      rotationDirection: RotationDirection.NO_ROTATION,
      prefloatRotationDirection: RotationDirection.CLOCKWISE,
    });
    expect(__test__.encodeMotion(m)).toBe("noeaxfc");
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run --config tests/config/vitest.config.ts tests/unit/codec/canonical-codec.test.ts`
Expected: FAIL — current `encodeMotion` still emits a type char and takes a `formatVersion`.

- [ ] **Step 3: Rewrite `encodeMotion`**

Replace `sequence-encoder.ts:133-191` with:
```ts
function encodeMotion(motion: MotionData | undefined): string {
  if (!motion) return "";

  const startLoc = LOCATION_ENCODE[motion.startLocation];
  const endLoc = LOCATION_ENCODE[motion.endLocation];
  const isFloat = motion.turns === "fl";

  // A float does not spin: its own rotation is noRotation. The prefloat rotation
  // (cw/ccw) is appended as a separate char so the type can be derived on decode.
  const rotation = isFloat
    ? ROTATION_ENCODE[RotationDirection.NO_ROTATION]
    : ROTATION_ENCODE[
        motion.rotationDirection === ("no_rotation" as RotationDirection)
          ? RotationDirection.NO_ROTATION
          : motion.rotationDirection
      ] ??
      (motion.motionType === "static" || motion.motionType === "dash"
        ? ROTATION_ENCODE[RotationDirection.NO_ROTATION]
        : undefined);

  const turns = isFloat ? "f" : String(motion.turns);
  const prop = PROP_TYPE_ENCODE[motion.propType] ?? PROP_TYPE_ENCODE[PropType.STAFF];

  if (!startLoc || !endLoc || !rotation || !prop) {
    console.error("❌ Encoder: motion missing required fields", {
      startLocation: motion.startLocation,
      endLocation: motion.endLocation,
      rotationDirection: motion.rotationDirection,
      turns: motion.turns,
      propType: motion.propType,
    });
    return "";
  }

  if (!isFloat) {
    return `${startLoc}${endLoc}${rotation}${turns}`;
  }

  // Float: append prefloat rotation (always cw/ccw — floats are always shifts).
  const prefloatRot =
    ROTATION_ENCODE[motion.prefloatRotationDirection as RotationDirection] ??
    ROTATION_ENCODE[RotationDirection.CLOCKWISE];
  return `${startLoc}${endLoc}${rotation}${turns}${prefloatRot}`;
}
```

Note: `prop` is computed for the per-motion error check but is NOT in the per-motion string — prop lives in the header (Task 5). It stays in the function only to validate the motion is well-formed; remove if the reviewer prefers, but keeping the guard is harmless. **Decision: drop `prop` from this function entirely** since it is neither emitted nor needed for validation here:

```ts
// Replace the prop line + guard with:
  if (!startLoc || !endLoc || !rotation) {
    console.error("❌ Encoder: motion missing required fields", {
      startLocation: motion.startLocation,
      endLocation: motion.endLocation,
      rotationDirection: motion.rotationDirection,
      turns: motion.turns,
    });
    return "";
  }
```
(Remove the `const prop = ...` line and its use.)

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run --config tests/config/vitest.config.ts tests/unit/codec/canonical-codec.test.ts`
Expected: PASS (encodeMotion cases).

- [ ] **Step 5: Commit**

```bash
git add src/lib/shared/navigation/services/sequence-encoder.ts tests/unit/codec/canonical-codec.test.ts
git commit -m "feat(codec): encodeMotion single format (drop motionType char, float appends prefloat rotation)" -- src/lib/shared/navigation/services/sequence-encoder.ts tests/unit/codec/canonical-codec.test.ts
```

---

### Task 4: Rewrite `decodeMotion` to derive motionType + handPath

**Files:**
- Modify: `src/lib/shared/navigation/services/sequence-encoder.ts:200-290`

Parses `startLoc, endLoc, rotation, turns (+prefloatRot if float)`. Derives `motionType` via Task 1, `handPath` via `getHandpathDirection`, `endOrientation` via `calculateEndOrientation`. `startOrientation` is passed in (chained from the seed, as the old v3 path did). `propType` is passed in (from the header).

- [ ] **Step 1: Write the failing test**

Add to `tests/unit/codec/canonical-codec.test.ts`:
```ts
import { decodeSequence } from "$lib/shared/navigation/services/sequence-encoder";

describe("decodeMotion derivation", () => {
  it("derives pro/anti from rotation + locations", () => {
    // header ii SS | startpos | step1 . Build via encodeSequence round-trip in Task 6;
    // here assert the low-level decode through __test__.
    const m = __test__.decodeMotion("noeac0", "blue", Orientation.IN, PropType.STAFF);
    expect(m?.motionType).toBe(MotionType.PRO);     // n->e cw == orbit cw
    expect(m?.startOrientation).toBe(Orientation.IN);
    expect(m?.propType).toBe(PropType.STAFF);
  });
  it("derives float + prefloat rotation from the appended char", () => {
    const m = __test__.decodeMotion("noeaxfc", "blue", Orientation.IN, PropType.STAFF);
    expect(m?.motionType).toBe(MotionType.FLOAT);
    expect(m?.rotationDirection).toBe(RotationDirection.NO_ROTATION);
    expect(m?.prefloatRotationDirection).toBe(RotationDirection.CLOCKWISE);
    expect(m?.prefloatMotionType).toBe(MotionType.PRO); // derived: cw rot on cw orbit
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run --config tests/config/vitest.config.ts tests/unit/codec/canonical-codec.test.ts`
Expected: FAIL — `decodeMotion` signature still takes `formatVersion` and reads a type char.

- [ ] **Step 3: Rewrite `decodeMotion`**

Replace `sequence-encoder.ts:200-290`. New signature: `(encoded, color, chainStartOrientation, propType)`.
```ts
function decodeMotion(
  encoded: string,
  color: "blue" | "red",
  chainStartOrientation: Orientation,
  propType: PropType
): MotionData | undefined {
  if (!encoded || encoded.length < 6) return undefined;

  let pos = 0;
  const startLocCode = encoded.slice(pos, pos + 2); pos += 2;
  const endLocCode = encoded.slice(pos, pos + 2); pos += 2;
  const rotationCode = encoded[pos++];

  // turns: digits/decimal point, or "f" for float
  let turnsCode = "";
  while (pos < encoded.length && /[0-9.f]/.test(encoded[pos]!)) {
    turnsCode += encoded[pos++];
  }
  const isFloat = turnsCode === "f";

  // float appends a prefloat rotation char (cw/ccw)
  const prefloatRotCode = isFloat ? encoded[pos++] : undefined;

  const startLocation = LOCATION_DECODE[startLocCode];
  const endLocation = LOCATION_DECODE[endLocCode];
  const rotationDirection = ROTATION_DECODE[rotationCode!];
  const turns = isFloat ? ("fl" as const) : parseFloat(turnsCode);
  const startOrientation = chainStartOrientation;

  if (!startLocation || !endLocation || !rotationDirection || !startOrientation) {
    throw new Error(`Invalid motion encoding: ${encoded}`);
  }

  const motionType = deriveMotionType(
    startLocation as unknown as string,
    endLocation as unknown as string,
    rotationDirection as unknown as string,
    turns
  ) as unknown as MotionType;

  // Float: recover prefloat rotation from the stored char, derive prefloat type.
  let prefloatRotationDirection: RotationDirection | undefined;
  let prefloatMotionType: MotionType | undefined;
  if (isFloat) {
    prefloatRotationDirection =
      ROTATION_DECODE[prefloatRotCode!] ?? RotationDirection.CLOCKWISE;
    prefloatMotionType = deriveMotionType(
      startLocation as unknown as string,
      endLocation as unknown as string,
      prefloatRotationDirection as unknown as string,
      0
    ) as unknown as MotionType;
  }

  const endOrientation = calculateEndOrientation({
    motionType: motionType as unknown as string,
    turns,
    rotationDirection: rotationDirection as unknown as string,
    startLocation: startLocation as unknown as string,
    endLocation: endLocation as unknown as string,
    startOrientation: startOrientation as unknown as string,
  }) as Orientation;

  const handPath = getHandpathDirection(
    startLocation as unknown as string,
    endLocation as unknown as string
  );

  const motionColor = color === "blue" ? ("blue" as const) : ("red" as const);
  const gridMode = inferGridModeFromMotion(startLocation, endLocation);

  return {
    motionType,
    rotationDirection,
    startLocation,
    endLocation,
    turns,
    startOrientation,
    endOrientation,
    handPath,
    color: motionColor as unknown as MotionColor,
    isVisible: true,
    propType,
    gridMode: gridMode as unknown as GridMode,
    arrowLocation: startLocation,
    arrowPlacementData: {} as unknown as ArrowPlacementData,
    propPlacementData: {} as unknown as PropPlacementData,
    ...(prefloatMotionType && { prefloatMotionType }),
    ...(prefloatRotationDirection && { prefloatRotationDirection }),
  } as MotionData;
}
```

Add the import at the top of the file (the deriver now lives in orientation.ts alongside `calculateEndOrientation`, already imported):
```ts
import {
  calculateEndOrientation,
  deriveMotionType,
  getHandpathDirection,
} from "$lib/shared/render/core/calculations/orientation";
```
(Replace the existing single `calculateEndOrientation` import.)

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run --config tests/config/vitest.config.ts tests/unit/codec/canonical-codec.test.ts`
Expected: PASS (decodeMotion cases).

- [ ] **Step 5: Commit**

```bash
git add src/lib/shared/navigation/services/sequence-encoder.ts tests/unit/codec/canonical-codec.test.ts
git commit -m "feat(codec): decodeMotion derives motionType/handPath/orientations + float prefloat recovery" -- src/lib/shared/navigation/services/sequence-encoder.ts tests/unit/codec/canonical-codec.test.ts
```

---

### Task 5: Rewrite `encodeSequence`/`decodeSequence` — single format with prop header, delete v1/v2/v3

**Files:**
- Modify: `src/lib/shared/navigation/services/sequence-encoder.ts` — `encodeBeat` (193-198), `decodeBeat` (292-317), `encodeSequence` (417-457), `decodeSequence` (528-640), delete `decodeSequenceV3` (464-526).

Header gains the two prop codes after the two orientation seeds. `decodeMotion` now needs the per-color prop, threaded from the header.

- [ ] **Step 1: Write the failing test**

Add to `tests/unit/codec/canonical-codec.test.ts`:
```ts
describe("sequence round-trip (single format)", () => {
  function staticMotion(loc: GridLocation, prop = PropType.STAFF) {
    return motion({
      motionType: MotionType.STATIC, startLocation: loc, endLocation: loc,
      rotationDirection: RotationDirection.NO_ROTATION, turns: 0,
      startOrientation: Orientation.IN, endOrientation: Orientation.IN, propType: prop,
    });
  }
  it("encodes a header (2 ori seeds + 2 prop codes) and round-trips", () => {
    const seq = decodeSequence(
      // header: blue ori i, red ori i, blue prop S(staff)=S, red prop C(club)=C
      // built via encodeSequence below; here just assert encode shape
      __test__.buildForTest
        ? ""
        : "iiSC|" + // placeholder; replaced by encodeSequence output in real run
          "nonoxs0:sosoxs0", // start position (static n / static s) — illustrative
    );
    expect(seq).toBeTruthy();
  });
});
```
NOTE: the placeholder above will not pass as-is. Replace Step 1 with a **construct-via-encode** round-trip once `encodeSequence` is implemented (Step 3). Concretely, after Step 3 the real test is:
```ts
import { encodeSequence } from "$lib/shared/navigation/services/sequence-encoder";

it("round-trips a 1-step sequence with mixed props", () => {
  const original = {
    id: "x", name: "", word: "", steps: [
      { stepNumber: 0, duration: 1, blueReversal: false, redReversal: false, isBlank: false,
        motions: { blue: staticMotion(GridLocation.NORTH), red: staticMotion(GridLocation.SOUTH) },
        id: "s0", letter: null, startPosition: null, endPosition: null },
      { stepNumber: 1, duration: 1, blueReversal: false, redReversal: false, isBlank: false,
        motions: {
          blue: motion({ startLocation: GridLocation.NORTH, endLocation: GridLocation.EAST, rotationDirection: RotationDirection.CLOCKWISE, turns: 0 }),
          red:  motion({ startLocation: GridLocation.SOUTH, endLocation: GridLocation.WEST, rotationDirection: RotationDirection.CLOCKWISE, turns: 0 }),
        },
        id: "s1", letter: null, startPosition: null, endPosition: null },
    ],
    startPosition: undefined, startingPosition: undefined,
    thumbnails: [], isFavorite: false, isCircular: false, tags: [], metadata: {}, sequenceLength: 1,
  } as never;

  const encoded = encodeSequence(original);
  expect(encoded).not.toMatch(/^v[123]\|/);            // no version sentinel
  const decoded = decodeSequence(encoded);
  expect(decoded.steps[1]!.motions.blue!.motionType).toBe(MotionType.PRO);
  expect(decoded.steps[1]!.motions.blue!.propType).toBe(PropType.STAFF);
});
```
Use only this real test for Step 1; drop the placeholder block.

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run --config tests/config/vitest.config.ts tests/unit/codec/canonical-codec.test.ts`
Expected: FAIL — `encodeSequence` still emits `v3|` + a 2-char seed-only header; `decodeSequence` still branches on sentinels.

- [ ] **Step 3a: Rewrite `encodeBeat` (drop formatVersion)**

Replace `sequence-encoder.ts:193-198`:
```ts
function encodeBeat(beat: StepData | StartPositionData): string {
  const motions = beat.motions ?? { blue: undefined, red: undefined };
  return `${encodeMotion(motions.blue)}:${encodeMotion(motions.red)}`;
}
```

- [ ] **Step 3b: Rewrite `encodeSequence`**

Replace `sequence-encoder.ts:417-457`. Keep the existing start-position resolution block (417-447) verbatim; replace the header/emit block (449-456) with:
```ts
  const spMotions = startPositionStep.motions ?? { blue: undefined, red: undefined };
  const blueSeed = ORIENTATION_ENCODE[spMotions.blue?.startOrientation as Orientation] ?? "i";
  const redSeed = ORIENTATION_ENCODE[spMotions.red?.startOrientation as Orientation] ?? "i";
  const bluePropCode =
    PROP_TYPE_ENCODE[(spMotions.blue?.propType ?? PropType.STAFF) as PropType] ??
    PROP_TYPE_ENCODE[PropType.STAFF];
  const redPropCode =
    PROP_TYPE_ENCODE[(spMotions.red?.propType ?? PropType.STAFF) as PropType] ??
    PROP_TYPE_ENCODE[PropType.STAFF];

  const header = `${blueSeed}${redSeed}${bluePropCode}${redPropCode}`;
  const encodedStartPosition = encodeBeat(startPositionStep);
  const encodedSteps = actualSteps.map((step) => encodeBeat(step));
  return `${header}|${encodedStartPosition}|${encodedSteps.join("|")}`;
```

- [ ] **Step 3c: Replace `decodeSequence` + delete `decodeSequenceV3`**

Delete `decodeSequenceV3` (464-526) and replace `decodeSequence` (528-640) with a single chaining path:
```ts
export function decodeSequence(encoded: string): SequenceData {
  if (!encoded) throw new Error("Cannot decode empty sequence");

  const parts = encoded.split("|");
  if (parts.length < 2) throw new Error("Invalid sequence encoding - missing data");

  const header = parts[0] ?? "iiSS";
  let blueOri = (ORIENTATION_DECODE[header[0] ?? "i"] ?? Orientation.IN) as Orientation;
  let redOri = (ORIENTATION_DECODE[header[1] ?? "i"] ?? Orientation.IN) as Orientation;
  const blueProp = (PROP_TYPE_DECODE[header[2] ?? "S"] ?? PropType.STAFF) as PropType;
  const redProp = (PROP_TYPE_DECODE[header[3] ?? "S"] ?? PropType.STAFF) as PropType;

  const beatEncodings = parts.slice(1);
  if (beatEncodings.length === 0) throw new Error("Invalid sequence encoding - no beats");

  const decodeChained = (enc: string, stepNumber: number): StepData => {
    const segs = enc.split(":");
    const blue = decodeMotion(segs[0] ?? "", "blue", blueOri, blueProp);
    const red = decodeMotion(segs[1] ?? "", "red", redOri, redProp);
    if (blue) blueOri = blue.endOrientation;
    if (red) redOri = red.endOrientation;
    return {
      stepNumber, duration: 1, blueReversal: false, redReversal: false,
      isBlank: !(segs[0] ?? "") && !(segs[1] ?? ""),
      motions: { blue, red },
      id: crypto.randomUUID(), letter: null, startPosition: null, endPosition: null,
    };
  };

  const startBeat = decodeChained(beatEncodings[0]!, 0);
  const startPosition = createStartPositionData({
    id: startBeat.id || crypto.randomUUID(),
    letter: startBeat.letter,
    gridPosition: startBeat.startPosition,
    startPosition: startBeat.startPosition,
    endPosition: startBeat.endPosition,
    motions: startBeat.motions,
  });

  const steps = beatEncodings.slice(1)
    .filter((e) => e && e.length > 0)
    .map((enc, index) => decodeChained(enc, index + 1));

  return {
    id: crypto.randomUUID(), name: "Shared Sequence", word: "",
    steps, startingPosition: startPosition, startPosition,
    thumbnails: [], isFavorite: false, isCircular: false,
    tags: [], metadata: {}, sequenceLength: steps.length,
  };
}
```

- [ ] **Step 3d: Delete `decodeBeat`** (292-317) if no longer referenced. Grep first:
Run: `grep -n "decodeBeat" src/lib/shared/navigation/services/sequence-encoder.ts`
If the only hits are its definition and the now-deleted v1/v2 path, delete the function. The `__test__` export must drop `decodeMotion`'s old signature references (handled in Task 8).

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run --config tests/config/vitest.config.ts tests/unit/codec/canonical-codec.test.ts`
Expected: PASS (round-trip + no-sentinel assertions).

- [ ] **Step 5: Commit**

```bash
git add src/lib/shared/navigation/services/sequence-encoder.ts tests/unit/codec/canonical-codec.test.ts
git commit -m "feat(codec): single-format encode/decode with prop header; delete v1/v2/v3 + decodeSequenceV3" -- src/lib/shared/navigation/services/sequence-encoder.ts tests/unit/codec/canonical-codec.test.ts
```

---

### Task 6: Delete `reencodeFlat` + recipe-hash version logic

**Files:**
- Modify: `src/lib/shared/navigation/services/sequence-encoder.ts` (delete `reencodeFlat`, 917-932; update `__test__` export, 935)
- Modify: `src/lib/shared/qr/services/compositional-decoder.ts:20,133-156`

- [ ] **Step 1: Update the compositional-decoder test expectation**

Check for an existing recipe-decode test:
Run: `grep -rln "CompositionalDecoder\|compositional-decoder\|recipe" tests/unit --include=*.ts`
If `tests/unit/services/CompositionalEncoding.test.ts` exists, read it; the assertion that a recipe round-trips must still pass with single-format hashing. Add (or adjust) a test asserting `decode()` verifies a freshly-encoded recipe without any version branching. If no test exists, create `tests/unit/codec/recipe-single-format.test.ts` round-tripping one recipe through `encodeSequenceForQR` → `decodeSequenceFromQR` (already covered partly by `qr-roundtrip.test.ts`; extend there instead).

- [ ] **Step 2: Run to verify current state**

Run: `npx vitest run --config tests/config/vitest.config.ts tests/unit/codec/qr-roundtrip.test.ts`
Expected: may FAIL after Task 5 (qr-roundtrip uses old `__test__.encodeMotion(m, 1)` — fixed in Task 8). Note the failure; it is addressed in Task 8.

- [ ] **Step 3: Delete `reencodeFlat` and simplify the recipe hash**

In `sequence-encoder.ts` delete the whole `reencodeFlat` function (917-932).

In `compositional-decoder.ts`:
- Delete the import `import { reencodeFlat } from "...sequence-encoder";` (line 20).
- Replace the version-aware hash block (133-146) with:
```ts
    // Single canonical format: hash the flat encoding directly.
    const flatEncoded = this.flatEncoder.encode(fullSequence);
    const actualHash = await computeRecipeHash(flatEncoded);
```
(The `seedVersion`/`hashInput` lines and their comment are removed.)

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run --config tests/config/vitest.config.ts tests/unit/services/CompositionalEncoding.test.ts tests/unit/codec/qr-roundtrip.test.ts`
Expected: CompositionalEncoding PASS. (qr-roundtrip fixed in Task 8.)

- [ ] **Step 5: Commit**

```bash
git add src/lib/shared/navigation/services/sequence-encoder.ts src/lib/shared/qr/services/compositional-decoder.ts
git commit -m "refactor(codec): drop reencodeFlat + recipe-hash version logic (single format)" -- src/lib/shared/navigation/services/sequence-encoder.ts src/lib/shared/qr/services/compositional-decoder.ts
```

---

### Task 7: Update the `__test__` export + delete the MotionType codec maps

**Files:**
- Modify: `src/lib/shared/navigation/services/sequence-encoder.ts` (`MOTION_TYPE_ENCODE/DECODE` 71-81; `__test__` 935)

- [ ] **Step 1: Delete `MOTION_TYPE_ENCODE` and `MOTION_TYPE_DECODE`**

Grep to confirm no remaining references after Tasks 3-5:
Run: `grep -n "MOTION_TYPE_ENCODE\|MOTION_TYPE_DECODE" src/lib/shared/navigation/services/sequence-encoder.ts`
Expected: only the two definitions (71-81). Delete them. (`MotionType` enum import may now be unused — remove from the import if so; check `grep -n "MotionType" sequence-encoder.ts`.)

- [ ] **Step 2: Update the `__test__` export**

`decodeMotion`'s signature changed (no `formatVersion`; now `(encoded, color, chainStartOrientation, propType)`). Update line 935:
```ts
export const __test__ = { encodeMotion, decodeMotion, encodeBeat };
```
(Signature is unchanged in shape — the helpers are still exported; only their parameters changed. Tests in Task 8 call them with the new signatures.)

- [ ] **Step 3: Run the full codec suite**

Run: `npx vitest run --config tests/config/vitest.config.ts tests/unit/codec/derive-motion-type.test.ts tests/unit/codec/motion-type-parity.test.ts tests/unit/codec/canonical-codec.test.ts`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/lib/shared/navigation/services/sequence-encoder.ts
git commit -m "refactor(codec): delete MOTION_TYPE codec maps (motionType now derived)" -- src/lib/shared/navigation/services/sequence-encoder.ts
```

---

### Task 8: Migrate the legacy codec tests to the single format

**Files:**
- Modify: `tests/unit/codec/derive-endorientation.test.ts`, `tests/unit/codec/derive-startorientation.test.ts`, `tests/unit/codec/qr-roundtrip.test.ts`, `tests/unit/codec/deriver-parity.test.ts`

These reference `__test__.encodeMotion(m, 1|2|3)`, `__test__.decodeMotion(enc, color, 1|2|3)`, and `v2|`/`v3|` sentinels — all gone. Re-express each test's intent against the single format.

- [ ] **Step 1: Triage each file**

Run: `grep -nE "encodeMotion\(.*,\s*[123]\)|decodeMotion\(.*,\s*[123]|v2\||v3\|" tests/unit/codec/*.test.ts`
This lists every call site to migrate.

- [ ] **Step 2: Rewrite `derive-endorientation.test.ts`**

Its purpose — endOrientation is derived, not stored — is now the codec's default. Replace version-specific assertions with single-format ones. The "Task 1: encodeMotion versioning" test (v1 one char longer than v2) is **obsolete** — delete that `describe`. Keep the orientation-algebra cases (pro/anti × turns) but call `__test__.decodeMotion(enc, "blue", Orientation.IN, PropType.STAFF)` and assert `endOrientation`. Concretely, replace the file's bodies so each case builds an encoded motion with `__test__.encodeMotion(motion({...}))` and decodes it with the 4-arg signature.

- [ ] **Step 3: Rewrite `derive-startorientation.test.ts`**

Its v1/v2/v3 length assertions are obsolete — delete length-by-version cases. Keep the chaining test (start orientation chains from the seed) by asserting `decodeSequence(encodeSequence(seq))` reproduces each motion's `startOrientation` and `endOrientation`. Keep the nonradial-seed case (`counter` seed preserved through the chain).

- [ ] **Step 4: Rewrite `qr-roundtrip.test.ts`**

Replace `__test__.encodeMotion(m, 1)` fixture construction with `encodeSequence`/`decodeSequence` of a built sequence, then `encodeSequenceForQR` → `decodeSequenceFromQR`, asserting `endOrientation` per motion is preserved. Keep the STATIC start-position fixture (chain-valid).

- [ ] **Step 5: Update `deriver-parity.test.ts`**

It guards that `calculateEndOrientation` agrees across copies. Extend it to also assert the codec's `deriveMotionType` agrees with the create-module classifier on the shift cases (so a future divergent copy is caught). Add an import of `deriveMotionType` from `orientation.ts` and assert pro/anti agreement on the diamond+box shift pairs.

- [ ] **Step 6: Run the whole codec directory**

Run: `npx vitest run --config tests/config/vitest.config.ts tests/unit/codec/`
Expected: PASS — all files green.

- [ ] **Step 7: Commit**

```bash
git add tests/unit/codec/derive-endorientation.test.ts tests/unit/codec/derive-startorientation.test.ts tests/unit/codec/qr-roundtrip.test.ts tests/unit/codec/deriver-parity.test.ts
git commit -m "test(codec): migrate legacy version-specific tests to single canonical format" -- tests/unit/codec/derive-endorientation.test.ts tests/unit/codec/derive-startorientation.test.ts tests/unit/codec/qr-roundtrip.test.ts tests/unit/codec/deriver-parity.test.ts
```

---

### Task 9: Full verification gate

**Files:** none (verification only)

- [ ] **Step 1: Find any remaining callers of deleted symbols**

Run:
```bash
grep -rnE "reencodeFlat|formatVersion|decodeSequenceV3|MOTION_TYPE_ENCODE|MOTION_TYPE_DECODE|v2\||v3\|" src tests --include=*.ts --include=*.svelte
```
Expected: no hits in `src/` or `tests/` except inside string literals/comments that are intentionally historical. Fix any real caller (e.g. a component importing `reencodeFlat`).

- [ ] **Step 2: Full type check (capture once)**

Run: `npm run check > /tmp/codec-check.log 2>&1; echo rc=$?`
Then: `grep -niE "sequence-encoder|compositional-decoder|codec|orientation\.ts" /tmp/codec-check.log`
Expected: zero errors in the touched files. Pre-existing errors elsewhere are out of scope; confirm none are newly introduced by greping for the touched paths.

- [ ] **Step 3: Full codec + QR test run**

Run: `npx vitest run --config tests/config/vitest.config.ts tests/unit/codec/ tests/unit/services/CompositionalEncoding.test.ts tests/unit/services/SequenceEncoder.test.ts`
Expected: PASS. If `tests/unit/services/SequenceEncoder*.test.ts` assert old version behavior, migrate them the same way as Task 8 (add a follow-up commit).

- [ ] **Step 4: Build gate**

Run: `npm run build:fast > /tmp/codec-build.log 2>&1; echo rc=$?`
Expected: rc=0. If it fails, read the log, fix, re-run.

- [ ] **Step 5: Final commit (if any fixes in steps 1-4)**

```bash
git add <only the files you fixed>
git commit -m "fix(codec): resolve remaining single-format migration callers" -- <files>
```

---

## Self-Review

**Spec coverage:**
- Single format, no version sentinels → Tasks 5, 6, 7, 9.
- 4 stored fields per motion (+1 float prefloat) → Tasks 3, 4.
- Header = 2 ori seeds + 2 prop codes → Task 5.
- Derive motionType → Tasks 1, 2. Derive handPath (incl. hash) → Task 4 (reuses `getHandpathDirection`). Derive orientations → Task 4. Derive prefloatMotionType, store prefloatRotationDirection → Tasks 3, 4.
- Exhaustive corpus parity (both grid modes, motionType axis) → Task 2. HandPath axis hash/center cases → Task 1 unit cases (base CSVs carry no center rows; `getHandpathDirection` is already the canonical handpath and is reused, not reimplemented).
- One canonical copy of derivers → Task 1 (added to `orientation.ts` which owns `calculateEndOrientation` + `getHandpathDirection`); drift guard extended in Task 8 Step 5.
- Delete reencodeFlat + recipe version logic → Task 6.

**Gap noted:** the base Diamond/Box dataframes contain no float or hash rows (verified: 0), so the corpus parity gate (Task 2) exercises pro/anti/dash/static only. Float and hash derivation are proven by Task 1 unit cases against known inputs. If a centric (Tau/Terra) or skewed dataframe with `blueHandPath` columns is later wired in, extend Task 2 to assert the handPath axis against those stored columns. This is called out, not silently skipped.

**Placeholder scan:** Task 5 Step 1 contains an explicit instruction to drop the placeholder block and use the real construct-via-encode test — follow that, do not commit the placeholder.

**Type consistency:** `deriveMotionType(start, end, rotationDirection, turns)` signature is identical in Tasks 1, 2, 4. `decodeMotion(encoded, color, chainStartOrientation, propType)` is consistent in Tasks 4, 5, 8. `encodeMotion(motion)` (no version) consistent in Tasks 3, 5, 8.

# Codec Derive-endOrientation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stop storing per-motion `endOrientation` in the sequence codec; recompute it on decode from the canonical deriver, behind a `v2|` format version with a permanent v1 legacy path.

**Architecture:** Version the flat encoded string with a `v2|` sentinel. v2 `encodeMotion` emits 7 fields (no endOrient); v2 `decodeMotion` reads 7 fields and derives endOrientation via `calculateEndOrientation`. v1 emit/decode retained for in-the-wild blobs and for version-correct recipe hashing. New test proves derived == original across a corpus.

**Tech Stack:** TypeScript, Vitest. Files under `src/lib/shared/navigation/services/` and `src/lib/shared/qr/services/`. Canonical deriver: `src/lib/shared/render/core/calculations/orientation.ts`.

**Reference (real current code, verified):**
- `encodeMotion` `sequence-encoder.ts:132-175`, returns `${startLoc}${endLoc}${startOrient}${endOrient}${rotation}${turns}${type}${prop}`.
- `decodeMotion` `:184-255`, cursor reads: startLoc(2), endLoc(2), startOrient(1), endOrient(1), rotation(1), turns(var), type(1), prop(1); guard `encoded.length < 10`.
- `encodeSequence` `:382-417` → `${encodedStartPosition}|${encodedSteps.join("|")}`.
- `decodeSequence` `:419-513`, `isLegacyFormat = /^\d+$/.test(firstPart)` at `:433`.
- Deriver: `export function calculateEndOrientation(input: OrientationInput): Orientation` (`orientation.ts:210`), `OrientationInput { motionType: string; turns?: number | "fl"; rotationDirection: string; startLocation: string; endLocation: string; startOrientation?: string }`.
- Recipe hash: `compositional-encoder.ts:101` `computeRecipeHash(flatEncoded)`; verify `compositional-decoder.ts:133-141`.

**Test location:** `tests/unit/codec/` (repo uses `tests/unit/`). Run: `npx vitest run tests/unit/codec/<file> -t "<name>"`.

---

### Task 1: Version-aware `encodeMotion` (v1 retained, v2 drops endOrient)

**Files:**
- Modify: `src/lib/shared/navigation/services/sequence-encoder.ts:132-175`
- Test: `tests/unit/codec/encode-motion-version.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from "vitest";
import { __test__ } from "$lib/shared/navigation/services/sequence-encoder";
import { MotionType, RotationDirection, Orientation } from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";
import { GridLocation } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
import { PropType } from "$lib/shared/pictograph/prop/domain/enums/PropType";

const motion = {
  motionType: MotionType.PRO,
  rotationDirection: RotationDirection.CLOCKWISE,
  startLocation: GridLocation.NORTH,
  endLocation: GridLocation.EAST,
  turns: 0,
  startOrientation: Orientation.IN,
  endOrientation: Orientation.IN,
  propType: PropType.STAFF,
} as any;

describe("encodeMotion versioning", () => {
  it("v1 emits 8 fields including endOrient (no~ea~i~i~c~0~p~S)", () => {
    expect(__test__.encodeMotion(motion, 1)).toBe("noeaiic0pS");
  });
  it("v2 omits the endOrient char (one shorter, startOrient then rotation)", () => {
    expect(__test__.encodeMotion(motion, 2)).toBe("noeaic0pS");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/codec/encode-motion-version.test.ts`
Expected: FAIL — `__test__` export does not exist / `encodeMotion` takes no version arg.

- [ ] **Step 3: Implement**

Replace `encodeMotion` (`:132`) signature and body tail. Add `formatVersion` param; in v2 skip the endOrient char and drop it from the validation gate:

```ts
function encodeMotion(motion: MotionData | undefined, formatVersion: 1 | 2 = 2): string {
  if (!motion) return "";

  const startLoc = LOCATION_ENCODE[motion.startLocation];
  const endLoc = LOCATION_ENCODE[motion.endLocation];
  const startOrient = ORIENTATION_ENCODE[motion.startOrientation];
  const endOrient = ORIENTATION_ENCODE[motion.endOrientation];
  const normalizedRotDir =
    motion.rotationDirection === ("no_rotation" as RotationDirection)
      ? RotationDirection.NO_ROTATION
      : motion.rotationDirection;
  const rotation =
    ROTATION_ENCODE[normalizedRotDir] ??
    (motion.motionType === "static" || motion.motionType === "dash"
      ? ROTATION_ENCODE[RotationDirection.NO_ROTATION]
      : undefined);
  const turns = motion.turns === "fl" ? "f" : String(motion.turns);
  const type = MOTION_TYPE_ENCODE[motion.motionType];
  const prop = PROP_TYPE_ENCODE[motion.propType] ?? PROP_TYPE_ENCODE[PropType.STAFF];

  const endOrientRequired = formatVersion === 1;
  if (!startLoc || !endLoc || !startOrient || (endOrientRequired && !endOrient) || !rotation || !type || !prop) {
    console.error("❌ URL Encoder: Motion has missing required fields!", {
      hasStartLoc: !!startLoc, hasEndLoc: !!endLoc, hasStartOrient: !!startOrient,
      hasEndOrient: !!endOrient, hasRotation: !!rotation, hasType: !!type, hasProp: !!prop,
      formatVersion,
    });
    return "";
  }

  return formatVersion === 1
    ? `${startLoc}${endLoc}${startOrient}${endOrient}${rotation}${turns}${type}${prop}`
    : `${startLoc}${endLoc}${startOrient}${rotation}${turns}${type}${prop}`;
}
```

At the bottom of the file add a test-only export (after the existing exports):

```ts
export const __test__ = { encodeMotion, decodeMotion };
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/codec/encode-motion-version.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/shared/navigation/services/sequence-encoder.ts tests/unit/codec/encode-motion-version.test.ts
git commit -m "feat(codec): version-aware encodeMotion, v2 drops endOrient" -- src/lib/shared/navigation/services/sequence-encoder.ts tests/unit/codec/encode-motion-version.test.ts
```

---

### Task 2: Version-aware `decodeMotion` (v2 derives endOrientation)

**Files:**
- Modify: `src/lib/shared/navigation/services/sequence-encoder.ts:184-255`
- Test: `tests/unit/codec/decode-motion-derive.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from "vitest";
import { __test__ } from "$lib/shared/navigation/services/sequence-encoder";
import { Orientation } from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";

describe("decodeMotion v2 derive", () => {
  // v2 motion "noeaic0pS": N->E, startOri in, rot cw, 0 turns, pro, staff.
  // Pro @ 0 whole turns preserves orientation => endOrientation === in.
  it("derives endOrientation for v2 (pro 0 turns preserves)", () => {
    const m = __test__.decodeMotion("noeaic0pS", "blue", 2)!;
    expect(m.startOrientation).toBe(Orientation.IN);
    expect(m.endOrientation).toBe(Orientation.IN);
  });
  // v1 motion "noeaiac1pS": startOri in, endOri out(a... no) -> use real: anti 1 turn.
  it("v1 still reads endOrientation positionally (unchanged)", () => {
    const m = __test__.decodeMotion("noeaioc0pS", "blue", 1)!;
    expect(m.startOrientation).toBe(Orientation.IN);
    expect(m.endOrientation).toBe(Orientation.OUT);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/codec/decode-motion-derive.test.ts`
Expected: FAIL — `decodeMotion` takes no version arg / v2 misparses.

- [ ] **Step 3: Implement**

Add the import at the top of `sequence-encoder.ts` (with the other imports):

```ts
import { calculateEndOrientation } from "$lib/shared/render/core/calculations/orientation";
```

Replace `decodeMotion` (`:184`). Add `formatVersion`; in v2 skip the endOrient read and derive after all fields are parsed; version-aware min-length guard:

```ts
function decodeMotion(
  encoded: string,
  color: "blue" | "red",
  formatVersion: 1 | 2 = 2
): MotionData | undefined {
  const minLen = formatVersion === 1 ? 10 : 9;
  if (!encoded || encoded.length < minLen) return undefined;

  let pos = 0;

  const startLocCode = encoded.slice(pos, pos + 2);
  pos += 2;
  const endLocCode = encoded.slice(pos, pos + 2);
  pos += 2;

  const startOrientCode = encoded[pos++];
  const endOrientCode = formatVersion === 1 ? encoded[pos++] : undefined;
  const rotationCode = encoded[pos++];

  let turnsCode = "";
  while (pos < encoded.length && encoded[pos] && !MOTION_TYPE_DECODE[encoded[pos]!]) {
    turnsCode += encoded[pos++];
  }

  const typeCode = encoded[pos++];
  const propCode = encoded[pos];

  const startLocation = LOCATION_DECODE[startLocCode];
  const endLocation = LOCATION_DECODE[endLocCode];
  const startOrientation = ORIENTATION_DECODE[startOrientCode!];
  const rotationDirection = ROTATION_DECODE[rotationCode!];
  const turns = turnsCode === "f" ? ("fl" as const) : parseFloat(turnsCode);
  const motionType = MOTION_TYPE_DECODE[typeCode!];
  const propType = PROP_TYPE_DECODE[propCode!];

  const endOrientation =
    formatVersion === 1
      ? ORIENTATION_DECODE[endOrientCode!]
      : (calculateEndOrientation({
          motionType: motionType as unknown as string,
          turns,
          rotationDirection: rotationDirection as unknown as string,
          startLocation: startLocation as unknown as string,
          endLocation: endLocation as unknown as string,
          startOrientation: startOrientation as unknown as string,
        }) as Orientation);

  if (
    !startLocation || !endLocation || !startOrientation || !endOrientation ||
    !rotationDirection || !motionType || !propType
  ) {
    throw new Error(`Invalid motion encoding: ${encoded}`);
  }

  const MotionColorLocal = { BLUE: "blue" as const, RED: "red" as const };
  const motionColor = color === "blue" ? MotionColorLocal.BLUE : MotionColorLocal.RED;
  const gridMode = inferGridModeFromMotion(startLocation, endLocation);

  return {
    motionType, rotationDirection, startLocation, endLocation, turns,
    startOrientation, endOrientation,
    color: motionColor as unknown as MotionColor,
    isVisible: true, propType,
    gridMode: gridMode as unknown as GridMode,
    arrowLocation: startLocation,
    arrowPlacementData: {} as unknown as ArrowPlacementData,
    propPlacementData: {} as unknown as PropPlacementData,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/codec/decode-motion-derive.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/shared/navigation/services/sequence-encoder.ts tests/unit/codec/decode-motion-derive.test.ts
git commit -m "feat(codec): v2 decodeMotion derives endOrientation via canonical deriver" -- src/lib/shared/navigation/services/sequence-encoder.ts tests/unit/codec/decode-motion-derive.test.ts
```

---

### Task 3: `v2|` sentinel in encodeSequence / decodeSequence

**Files:**
- Modify: `src/lib/shared/navigation/services/sequence-encoder.ts` — `encodeBeat:177`, `decodeBeat:257`, `encodeSequence:382`, `decodeSequence:419`
- Test: `tests/unit/codec/sequence-version-roundtrip.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from "vitest";
import { encodeSequence, decodeSequence } from "$lib/shared/navigation/services/sequence-encoder";

// Minimal one-step sequence fixture (pro 0 turns, in->in derivable).
function fixture() {
  // Build via decodeSequence of a known v1 string so we have a real SequenceData.
  return decodeSequence("noeaiic0pS:soweiic0pS|noeaiic0pS:soweiic0pS");
}

describe("flat string versioning", () => {
  it("encodeSequence emits a v2| sentinel", () => {
    expect(encodeSequence(fixture()).startsWith("v2|")).toBe(true);
  });
  it("v2 round-trips back to equal motions", () => {
    const seq = fixture();
    const round = decodeSequence(encodeSequence(seq));
    expect(round.steps[0]!.motions.blue!.endOrientation).toBe(seq.steps[0]!.motions.blue!.endOrientation);
  });
  it("legacy un-prefixed strings still decode (v1)", () => {
    const seq = decodeSequence("noeaiic0pS:soweiic0pS|noeaiic0pS:soweiic0pS");
    expect(seq.steps.length).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/codec/sequence-version-roundtrip.test.ts`
Expected: FAIL — no `v2|` sentinel emitted.

- [ ] **Step 3: Implement**

Thread `formatVersion` through `encodeBeat` and `decodeBeat`:

```ts
function encodeBeat(beat: StepData | StartPositionData, formatVersion: 1 | 2 = 2): string {
  const motions = beat.motions ?? { blue: undefined, red: undefined };
  const blueMotion = encodeMotion(motions.blue, formatVersion);
  const redMotion = encodeMotion(motions.red, formatVersion);
  return `${blueMotion}:${redMotion}`;
}

function decodeBeat(encoded: string, stepNumber: number, formatVersion: 1 | 2 = 2): StepData {
  const parts = encoded.split(":");
  if (parts.length !== 2) {
    throw new Error(`Invalid beat encoding: ${encoded}`);
  }
  const blueEncoded = parts[0]!;
  const redEncoded = parts[1]!;
  return {
    stepNumber, duration: 1, blueReversal: false, redReversal: false,
    isBlank: !blueEncoded && !redEncoded,
    motions: {
      blue: decodeMotion(blueEncoded, "blue", formatVersion),
      red: decodeMotion(redEncoded, "red", formatVersion),
    },
    id: crypto.randomUUID(), letter: null, startPosition: null, endPosition: null,
  };
}
```

In `encodeSequence` (`:414-416`), prepend the sentinel and emit v2:

```ts
  const encodedStartPosition = encodeBeat(startPositionStep, 2);
  const encodedSteps = actualSteps.map((step) => encodeBeat(step, 2));
  return `v2|${encodedStartPosition}|${encodedSteps.join("|")}`;
```

In `decodeSequence` (`:419`), detect and strip the sentinel before the existing logic:

```ts
export function decodeSequence(encoded: string): SequenceData {
  if (!encoded) {
    throw new Error("Cannot decode empty sequence");
  }

  let formatVersion: 1 | 2 = 1;
  let body = encoded;
  if (encoded.startsWith("v2|")) {
    formatVersion = 2;
    body = encoded.slice(3);
  }

  const parts = body.split("|");
  // ... unchanged through firstPart / isLegacyFormat ...
```

Then pass `formatVersion` into every `decodeBeat(...)` call inside `decodeSequence` (there are three: the legacy-branch map `:461`, the start-position decode `:468`, and the steps map `:481`). Example for the steps map:

```ts
    steps = beatEncodings.map((encoding, index) =>
      decodeBeat(encoding, index + 1, formatVersion)
    );
```

and the start position:

```ts
    const startingPosition = decodeBeat(startPositionEncoding, 0, formatVersion);
```

and the legacy numeric branch:

```ts
    const sequenceSteps = beatEncodings.map((encoding, index) =>
      decodeBeat(encoding, startStep + index, formatVersion)
    );
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/codec/sequence-version-roundtrip.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/shared/navigation/services/sequence-encoder.ts tests/unit/codec/sequence-version-roundtrip.test.ts
git commit -m "feat(codec): v2| flat-string sentinel routes encode/decode version" -- src/lib/shared/navigation/services/sequence-encoder.ts tests/unit/codec/sequence-version-roundtrip.test.ts
```

---

### Task 4: Ship-gate corpus equivalence test (derived == original)

**Files:**
- Test: `tests/unit/codec/endorientation-equivalence.test.ts`

- [ ] **Step 1: Write the test**

```ts
import { describe, it, expect } from "vitest";
import { encodeSequence, decodeSequence } from "$lib/shared/navigation/services/sequence-encoder";

// Corpus of real v1 flat strings covering pro/anti/static/dash/float/turns.
// Each pair is "blue:red". Decoded as v1 (these are un-prefixed) to get the
// ORIGINAL endOrientation, then re-encoded v2 + decoded to derive it.
const V1_CORPUS = [
  "noeaiic0pS:soweiic0pS|noeaiic1pS:soweiic1pS",        // pro, 0 and 1 turns
  "noeaioa0aS:soweioa0aS|noeaioa1aS:soweioa1aS",        // anti
  "nonoiix0sS:sosoii x0sS".replace(" ", "") + "|nonoiix0sS:sosoiix0sS", // static
  "noeaiif fS:soweiif fS".replace(/ /g, "") + "|noeaiiffS:soweiiffS",   // float ("f" turns)
];

describe("endOrientation derive-only equivalence (ship gate)", () => {
  for (const flat of V1_CORPUS) {
    it(`derived === original for: ${flat.slice(0, 24)}...`, () => {
      const original = decodeSequence(flat);                 // v1, true stored endOri
      const v2 = encodeSequence(original);                   // drops endOri
      const derived = decodeSequence(v2);                    // recomputes endOri
      expect(derived.steps.length).toBe(original.steps.length);
      for (let i = 0; i < original.steps.length; i++) {
        for (const c of ["blue", "red"] as const) {
          const o = original.steps[i]!.motions[c];
          const d = derived.steps[i]!.motions[c];
          if (!o) { expect(d).toBeFalsy(); continue; }
          expect(d!.endOrientation, `step ${i} ${c}`).toBe(o.endOrientation);
        }
      }
    });
  }
});
```

- [ ] **Step 2: Run the test**

Run: `npx vitest run tests/unit/codec/endorientation-equivalence.test.ts`
Expected: PASS. If any case FAILS, the deriver disagrees with stored data on that motion type — STOP, investigate the deriver branch, do not proceed. (This is the gate doing its job.)

- [ ] **Step 3: Commit**

```bash
git add tests/unit/codec/endorientation-equivalence.test.ts
git commit -m "test(codec): ship-gate corpus proves derived endOrientation == original" -- tests/unit/codec/endorientation-equivalence.test.ts
```

---

### Task 5: Legacy decode regression (in-the-wild v1 still resolves)

**Files:**
- Test: `tests/unit/codec/legacy-decode-regression.test.ts`

- [ ] **Step 1: Write the test**

```ts
import { describe, it, expect } from "vitest";
import { decodeSequence, decodeSequenceWithCompression } from "$lib/shared/navigation/services/sequence-encoder";

describe("legacy v1 decode regression", () => {
  it("un-prefixed flat string decodes as v1 with its stored endOrientation", () => {
    // endOri 'o' (out) is stored; v1 must read it positionally, not derive.
    const seq = decodeSequence("noeaioc0pS:soweioc0pS|noeaioc0pS:soweioc0pS");
    expect(seq.steps[0]!.motions.blue!.endOrientation).toBe("out");
  });
  it("decodeSequenceWithCompression passes raw un-prefixed through to v1", () => {
    const seq = decodeSequenceWithCompression("noeaioc0pS:soweioc0pS|noeaioc0pS:soweioc0pS");
    expect(seq.steps.length).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Run the test**

Run: `npx vitest run tests/unit/codec/legacy-decode-regression.test.ts`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add tests/unit/codec/legacy-decode-regression.test.ts
git commit -m "test(codec): legacy v1 blobs still resolve with stored endOrientation" -- tests/unit/codec/legacy-decode-regression.test.ts
```

---

### Task 6: Recipe (`r1:`) hash version-awareness

**Files:**
- Modify: `src/lib/shared/qr/services/compositional-encoder.ts` (hash on v2), `compositional-decoder.ts:124-141` (re-hash in seed's version)
- Test: `tests/unit/codec/recipe-hash-version.test.ts`

**Context:** `computeRecipeHash` runs on `this.flatEncoder.encode(...)` output. After Task 3, `encodeSequence` emits `v2|...`, so NEW recipes hash on v2 — self-consistent. OLD `r1:` recipes were hashed on v1 (no sentinel). The decoder reconstructs from the seed, re-encodes via `encodeSequence` (now v2), and re-hashes — which would mismatch a v1 hash. Fix: the decoder detects the seed's version from its decompressed string and re-hashes using that version.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from "vitest";
import { encodeSequenceForQR, decodeSequenceFromQR } from "$lib/shared/navigation/services/sequence-encoder";
import { decodeSequence } from "$lib/shared/navigation/services/sequence-encoder";

// A 4-step rotated LOOP that the compositional encoder will recipe-encode.
// (Use a known-good fixture string; if recipe encoding declines, the test
// asserts flat fallback still round-trips, which is also acceptable.)
const LOOP_FLAT =
  "noeaiic0pS:soweiic0pS|eaonic0pS:wesoic0pS|onweic0pS:sosoic0pS|weeaic0pS:eaeaic0pS";

describe("recipe hash version-awareness", () => {
  it("new v2 recipe (or flat fallback) round-trips without hash mismatch", async () => {
    const seq = decodeSequence(LOOP_FLAT);
    const qr = await encodeSequenceForQR(seq);          // s~r2-seed... or s~q1:flat
    const back = await decodeSequenceFromQR(qr);         // must not throw
    expect(back.steps.length).toBe(seq.steps.length);
  });
});
```

- [ ] **Step 2: Run test to verify it fails (or passes via fallback)**

Run: `npx vitest run tests/unit/codec/recipe-hash-version.test.ts`
Expected: If the encoder recipes it, decode throws "Hash mismatch" before the fix → FAIL. (If it falls back to flat, it passes — still implement the fix below to keep old recipes valid.)

- [ ] **Step 3: Implement re-hash in seed's version**

In `compositional-decoder.ts`, replace the re-hash block (`:132-141`). Detect the seed version from the decompressed `seedEncoded` and re-encode the reconstructed full sequence in that version for hashing. Add a small helper that re-encodes at a given version — since `encodeSequence` now always emits v2, add a v1-capable re-encode by stripping/forcing the sentinel:

```ts
// version of the seed: v2 if the decompressed seed carries the sentinel
const seedIsV2 = seedEncoded.startsWith("v2|");

// flatEncoded is v2 (encodeSequence always emits v2). For a v1 seed, the
// original hash was computed on a v1 string, so strip the sentinel and
// re-emit motions as v1 before hashing.
const flatEncoded = this.flatEncoder.encode(fullSequence); // v2|...
const hashInput = seedIsV2 ? flatEncoded : toV1Flat(flatEncoded);
const actualHash = await computeRecipeHash(hashInput);

if (actualHash !== expectedHash) {
  throw new Error(
    `Hash mismatch: expected ${expectedHash}, got ${actualHash}. ` +
      `Sequence may be corrupted.`
  );
}
return flatEncoded; // caller decodes v2 normally
```

Add `toV1Flat` to `sequence-encoder.ts` and export it — it re-encodes a decoded sequence in v1 (8-field) form:

```ts
export function reencodeFlat(encoded: string, targetVersion: 1 | 2): string {
  const seq = decodeSequence(encoded);
  if (targetVersion === 2) return encodeSequence(seq);
  // v1: re-run the beat encoder at version 1
  const startBeat = seq.startPosition ?? seq.startingPosition;
  const start = startBeat ? __test__.encodeBeatV1(startBeat) : ":";
  const steps = seq.steps
    .filter((s) => s.stepNumber !== 0)
    .map((s) => __test__.encodeBeatV1(s));
  return `${start}|${steps.join("|")}`;
}
```

and extend the `__test__` export and add a v1 beat helper:

```ts
function encodeBeatV1(beat: StepData | StartPositionData): string {
  return encodeBeat(beat, 1);
}
export const __test__ = { encodeMotion, decodeMotion, encodeBeatV1 };
```

In `compositional-decoder.ts`, import and use it:

```ts
import { reencodeFlat } from "$lib/shared/navigation/services/sequence-encoder";
// ...
const hashInput = seedIsV2 ? flatEncoded : reencodeFlat(flatEncoded, 1);
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/codec/recipe-hash-version.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/shared/qr/services/compositional-decoder.ts src/lib/shared/navigation/services/sequence-encoder.ts tests/unit/codec/recipe-hash-version.test.ts
git commit -m "fix(codec): version-aware recipe hashing keeps old r1: codes valid" -- src/lib/shared/qr/services/compositional-decoder.ts src/lib/shared/navigation/services/sequence-encoder.ts tests/unit/codec/recipe-hash-version.test.ts
```

---

### Task 7: Deriver-copies parity test (drift tripwire)

**Files:**
- Test: `tests/unit/codec/deriver-parity.test.ts`

- [ ] **Step 1: Write the test**

```ts
import { describe, it, expect } from "vitest";
import { calculateEndOrientation as core } from "$lib/shared/render/core/calculations/orientation";

// The three other copies (paths verified): sequence-engine, mcp-server, package.
// Import whichever are resolvable from the app build; assert each equals core.
import { calculateEndOrientation as engine } from "$lib/shared/sequence-engine/services/orientation-propagator";

const MOTION_TYPES = ["pro", "anti", "float", "dash", "static"];
const ORIS = ["in", "out", "clock", "counter"];
const TURNS = [0, 0.5, 1, 1.5, 2];
const ROT = ["cw", "ccw", "no_rotation"];

describe("calculateEndOrientation copies agree", () => {
  it("engine copy matches core across the input space", () => {
    for (const motionType of MOTION_TYPES)
      for (const startOrientation of ORIS)
        for (const turns of TURNS)
          for (const rotationDirection of ROT) {
            const input = { motionType, turns, rotationDirection, startLocation: "n", endLocation: "e", startOrientation } as any;
            expect(engine(input), JSON.stringify(input)).toBe(core(input));
          }
  });
});
```

Note: if `orientation-propagator` wraps with positional args rather than an `OrientationInput` object, adapt the call to its real signature (confirm during implementation by reading `src/lib/shared/sequence-engine/services/orientation-propagator.ts`). If a copy is not importable from the app build (mcp-server), skip that copy with a comment — the engine + core parity is the load-bearing one for the app.

- [ ] **Step 2: Run the test**

Run: `npx vitest run tests/unit/codec/deriver-parity.test.ts`
Expected: PASS. If FAIL, the copies have already drifted — report it (this is exactly the drift the follow-up collapse will fix).

- [ ] **Step 3: Commit**

```bash
git add tests/unit/codec/deriver-parity.test.ts
git commit -m "test(codec): deriver copies parity tripwire" -- tests/unit/codec/deriver-parity.test.ts
```

---

### Task 8: Full typecheck + suite + final commit

- [ ] **Step 1: Typecheck**

Run: `npm run check > /tmp/check.log 2>&1; grep -niE "error" /tmp/check.log | head -40`
Expected: no new errors in `sequence-encoder.ts`, `compositional-decoder.ts`, or the new tests. Fix any that appear (likely enum-vs-string casts in the derive call — keep the `as unknown as string` casts).

- [ ] **Step 2: Run the full codec suite**

Run: `npx vitest run tests/unit/codec`
Expected: all PASS.

- [ ] **Step 3: Run the broader sequence/QR suite for regressions**

Run: `npx vitest run tests/unit -t "encode" && npx vitest run tests/unit -t "decode"`
Expected: existing sequence/QR tests still PASS.

- [ ] **Step 4: Final commit (if any fixups)**

```bash
git add -- src/lib/shared/navigation/services/sequence-encoder.ts src/lib/shared/qr/services/compositional-decoder.ts tests/unit/codec
git commit -m "chore(codec): typecheck + suite green for derive-endOrientation pilot" -- src/lib/shared/navigation/services/sequence-encoder.ts src/lib/shared/qr/services/compositional-decoder.ts tests/unit/codec
```

---

## Self-Review

**Spec coverage:** §3 version sentinel → Task 3; versioned encode/decode motion → Tasks 1-2; derive via canonical → Task 2; recipe hash compat → Task 6; ship gate equivalence → Task 4; legacy regression → Task 5; deriver parity → Task 7; migration deferred (no task, correct). All spec sections mapped.

**Placeholder scan:** Task 7 flags a real conditional (confirm `orientation-propagator` signature during impl) — that is a verify-then-adapt instruction with the fallback specified, not a placeholder. Corpus strings in Task 4 must be validated to decode on first run; if a hand-built string is malformed, replace it with one produced by `encodeSequence` of a real fixture (the equivalence logic is what matters, not the literal bytes).

**Type consistency:** `formatVersion: 1 | 2` threaded uniformly through encodeMotion/decodeMotion/encodeBeat/decodeBeat. `__test__` export extended in Tasks 1 and 6 (encodeMotion, decodeMotion, encodeBeatV1). `reencodeFlat` defined in Task 6, consumed in compositional-decoder.

**Known soft spot:** the literal corpus byte-strings in Tasks 2/4/5 are hand-authored from the encode format and MUST be confirmed against a real `encodeSequence`/`encodeMotion` output on first test run; if a literal is wrong the test will fail on parse, not on logic — regenerate it from a real fixture and continue.

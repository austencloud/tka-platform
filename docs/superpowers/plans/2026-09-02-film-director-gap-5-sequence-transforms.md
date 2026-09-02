# Film Director Gap 5 — Sequence Transforms + Library Source

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Re-read this file at the start of every task.

**Goal:** A performer can spin a transformed copy of another performer's sequence (`transformOf` + `transforms`) or a saved public-library sequence (`library`), with `mirrorOf` kept as the one-word sugar for the most common transform.

**Architecture:** The sequence grammar (`sequence-language.ts` types + `film-director-schema.ts` zod) gains two source keys. The spec resolver validates the transform graph one level deep exactly as it validates mirrors. `director-sequence-library.ts` gains injectable dependencies (`generate`, `transforms`, `loadLibrarySequence`) with production defaults, applies transform chains through `$lib/shared/create/services/sequence-transformer.ts`, and loads library sequences through a new `director-library-source.ts` that reads `publicSequences` with the existing `batchFetchPublicSequences`. No renderer change: the viewer adapter already takes whatever `SequenceData` the library hands it.

**Tech Stack:** TypeScript, zod 4, vitest (`tests/config/vitest.config.ts`), Firebase Firestore web SDK (already initialized lazily by `getFirestoreInstance`).

**Worktree:** `E:\worktrees\tka-platform\director-gaps`, branch `claude/director-gaps`. Run every command from there. Never touch `E:\tka-platform`, never start/stop any server on :5173.

**Test command:** `node node_modules/vitest/vitest.mjs run --config tests/config/vitest.config.ts tests/unit/film-director`

---

## Research the plan rests on (verified 2026-09-02)

- `src/lib/shared/create/services/sequence-transformer.ts` exports, all taking `SequenceData` and returning `SequenceData` or `Promise<SequenceData>`:
  - `mirrorSequence(seq, hand="both")` async — north-south reflection (the existing `mirrorOf` semantics).
  - `flipSequence(seq, hand="both")` async — east-west reflection.
  - `rotateSequence(seq, rotationAmount, hand="both")` async — `rotationAmount` is a count of 45° steps; positive is clockwise (`rotateLocation` walks `LOCATION_MAP_EIGHTH_CW`); `normalizeRotationSteps` wraps modulo 8; odd counts toggle grid mode when both hands rotate.
  - `swapHands(seq)` sync.
  - `invertSequence(seq, hand="both")` async — pro/anti and rotation direction inversion.
  - `rewindSequence(seq, hand="both")` async — retrograde, reversals recomputed.
  - `shiftStartPosition(seq, targetStepNumber)` sync — rotates the step order so step N becomes step 1; no-op for 1 or out of range.
  - `TargetHand = "left" | "right" | "both"` (`$lib/shared/create/state/panel-coordination-state.svelte` re-export; the plain type also lives in `$lib/shared/create/domain/panel-types.ts` — import from `panel-types` to keep the film lib free of `.svelte` state imports).
- `firestore.rules:1575` — `publicSequences/{id}` is `allow read: if true`. The public REST endpoint returns documents unauthenticated; real ids seen 2026-09-02 include `0c7e6529-1dca-4254-903e-7068e38c030c` (word `FLFLFLFL`), `3b7882d6-a87d-4b57-bbfe-8eacb9e39f04` (`AABB`), `218749e2-c04a-4426-a34e-9a80325b13b5` (`LFBBLFBB`).
- `src/lib/shared/library/services/collection-firestore-mapper.ts:199` `batchFetchPublicSequences(firestore, ids, ownerId?)` returns `LibrarySequence[]` where `LibrarySequence extends SequenceData`. `src/lib/shared/auth/firebase.ts:419` `getFirestoreInstance(): Promise<Firestore>`.
- `director-sequence-library.ts` today: `createDirectorSequenceLibrary(demoSequence)`; `resolveSource` caches by `sequenceDirectiveKey`; `resolveMirror` caches by `mirror:<key>`; `resolveScene` handles `mirrorOf` via `byId`; failures fall back to the demo with a director-readable reason. `FilmDirectorScene.svelte:59` is the only production caller.
- `resolve-film-director-spec.ts:674-705` validates mirrors: self-mirror, missing target, mirror-of-mirror.
- `film-director-schema.ts:389` `SEQUENCE_SOURCE_KEYS = ["source","mirrorOf","word","length"]`; `performerSequenceSchema` is one flat strict object with an exactly-one-source refinement; controls are rejected on `demo`/`mirrorOf`.
- `sequence-language.ts:162` `DirectorPerformerSequence` union; `sequenceDirectiveKey` at :501.
- `tests/unit/film-director/performer-sequences.test.ts` holds the resolver tests for this axis; `film-director-schema.test.ts` the accept/reject tests; `sequence-language.test.ts` the key/compile tests. There is no test for `director-sequence-library.ts` yet — Task 4 adds one via injected deps.

---

## Grammar (what a director writes)

```jsonc
// Sugar (unchanged): reflect another performer north-south.
{ "mirrorOf": "performer-1" }

// Transform chain applied in order to another performer's resolved sequence.
{
  "transformOf": "performer-1",
  "transforms": [
    { "op": "mirror" },                                   // hand?: "left"|"right"|"both"
    { "op": "flip", "hand": "left" },
    { "op": "rotate", "degrees": 90, "direction": "cw" }, // degrees: 45|90|135|180|225|270|315
    { "op": "swap-hands" },
    { "op": "invert" },
    { "op": "rewind" },
    { "op": "start-at", "step": 3 }                       // step >= 2
  ]
}

// A saved public sequence by its publicSequences document id.
{ "library": "0c7e6529-1dca-4254-903e-7068e38c030c" }
```

Rules:
- `transformOf` requires `transforms` with 1–8 entries. `mirrorOf` stays a separate key and is the one-word spelling of `{transformOf, transforms:[{op:"mirror"}]}`; it is NOT rewritten, so existing films resolve byte-identically.
- The target of `transformOf` (like `mirrorOf`) must be another performer in the scene whose own sequence is not a `mirrorOf`/`transformOf`. A transform of a `library`, `demo`, `word`, or `length` performer is fine.
- `transformOf` and `library` take no generation controls, same as `mirrorOf`/`demo`.
- `swap-hands` and `start-at` take no `hand`.
- Error copy speaks in director terms, numbers with at most two decimals, keys quoted.

---

## File structure

| File | Change |
| --- | --- |
| `src/routes/test/film-director/_lib/sequence-language.ts` | Types `DirectorSequenceTransform`, `DirectorTransformedSequence`, `DirectorLibrarySequence`; union extension; `sequenceDirectiveKey` cases; `isTransformedSequence`, `isLibrarySequence`, `transformSourceId` helpers. |
| `src/routes/test/film-director/_lib/film-director-schema.ts` | `sequenceTransformSchema`; `transformOf`, `transforms`, `library` fields; source-key list and refinement copy. |
| `src/routes/test/film-director/_lib/resolve-film-director-spec.ts` | Generalize the mirror-graph validation to any derived sequence. |
| `src/routes/test/film-director/_lib/director-library-source.ts` (new) | `loadPublicLibrarySequence(id)`. |
| `src/routes/test/film-director/_lib/director-sequence-library.ts` | Injectable deps; `resolveDerived` replaces `resolveMirror`; library source. |
| `src/routes/test/film-director/_components/FilmDirectorScene.svelte` | No change needed unless the constructor signature changes — keep the one-arg call working via defaults. |
| `src/routes/test/film-director/_films/proving-grounds.ts` | Scene 6 `derived-sequences`. |
| `docs/reference/film-director-capability-matrix.md` | Sequence row + closed-gap bullet. |
| Tests: `sequence-language.test.ts`, `film-director-schema.test.ts`, `performer-sequences.test.ts`, `director-sequence-library.test.ts` (new), `film-library.test.ts`, snapshot. |

---

### Task 1: Types and keys in `sequence-language.ts`

**Files:** Modify `src/routes/test/film-director/_lib/sequence-language.ts`; Test `tests/unit/film-director/sequence-language.test.ts`.

- [ ] **Step 1: Write the failing tests** (append to `sequence-language.test.ts`, inside a new `describe("derived and library sequences")`):

```ts
import {
  isLibrarySequence,
  isTransformedSequence,
  sequenceDirectiveKey,
  transformSourceId,
} from "../../../src/routes/test/film-director/_lib/sequence-language";

describe("derived and library sequences", () => {
  it("keys a transform chain by its source and its ordered ops", () => {
    const key = sequenceDirectiveKey({
      transformOf: "lead",
      transforms: [
        { op: "rotate", degrees: 90, direction: "cw" },
        { op: "swap-hands" },
      ],
    });
    expect(key).toBe(
      'transformOf:lead:[{"degrees":90,"direction":"cw","op":"rotate"},{"op":"swap-hands"}]'
    );
  });

  it("keys the same ops in a different order as a different sequence", () => {
    const a = sequenceDirectiveKey({
      transformOf: "lead",
      transforms: [{ op: "mirror" }, { op: "flip" }],
    });
    const b = sequenceDirectiveKey({
      transformOf: "lead",
      transforms: [{ op: "flip" }, { op: "mirror" }],
    });
    expect(a).not.toBe(b);
  });

  it("keys a library sequence by its id", () => {
    expect(sequenceDirectiveKey({ library: "abc-123" })).toBe("library:abc-123");
  });

  it("names the performer a derived sequence comes from", () => {
    expect(transformSourceId({ mirrorOf: "lead" })).toBe("lead");
    expect(
      transformSourceId({ transformOf: "second", transforms: [{ op: "invert" }] })
    ).toBe("second");
    expect(transformSourceId({ source: "demo" })).toBeNull();
    expect(transformSourceId({ library: "x" })).toBeNull();
  });

  it("classifies sources", () => {
    expect(isTransformedSequence({ transformOf: "a", transforms: [{ op: "rewind" }] })).toBe(true);
    expect(isTransformedSequence({ mirrorOf: "a" })).toBe(false);
    expect(isLibrarySequence({ library: "a" })).toBe(true);
    expect(isLibrarySequence({ word: "AB" })).toBe(false);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `node node_modules/vitest/vitest.mjs run --config tests/config/vitest.config.ts tests/unit/film-director/sequence-language.test.ts`
Expected: FAIL — `transformSourceId`/`isTransformedSequence`/`isLibrarySequence` are not exported.

- [ ] **Step 3: Implement.** In `sequence-language.ts`, replace the `DirectorPerformerSequence` block (currently lines ~151-171) with:

```ts
/** Hands a transform may address. `both` is the default everywhere it applies. */
export type DirectorTransformHand = "left" | "right" | "both";

export const DIRECTOR_ROTATION_DEGREES = [45, 90, 135, 180, 225, 270, 315] as const;
export type DirectorRotationDegrees = (typeof DIRECTOR_ROTATION_DEGREES)[number];

/**
 * One operation on another performer's sequence, applied in the order
 * written. Every op maps onto a function the Create module's Actions panel
 * already owns in `sequence-transformer.ts`; the film adds words, not math.
 *
 * - `mirror`: reflect across the north-south axis (what `mirrorOf` does).
 * - `flip`: reflect across the east-west axis.
 * - `rotate`: turn the whole pattern about the grid center, 45° steps.
 * - `swap-hands`: the left hand's motions go to the right hand and back.
 * - `invert`: pro ↔ anti and every rotation direction reversed.
 * - `rewind`: play the sequence backwards (retrograde).
 * - `start-at`: rotate the phrase so the named step is danced first.
 */
export type DirectorSequenceTransform =
  | { op: "mirror"; hand?: DirectorTransformHand }
  | { op: "flip"; hand?: DirectorTransformHand }
  | {
      op: "rotate";
      degrees: DirectorRotationDegrees;
      direction: "cw" | "ccw";
      hand?: DirectorTransformHand;
    }
  | { op: "swap-hands" }
  | { op: "invert"; hand?: DirectorTransformHand }
  | { op: "rewind"; hand?: DirectorTransformHand }
  | { op: "start-at"; step: number };

export interface DirectorTransformedSequence {
  transformOf: string;
  transforms: DirectorSequenceTransform[];
}

/** A saved sequence in the public library, by its `publicSequences` id. */
export interface DirectorLibrarySequence {
  library: string;
}

/**
 * What one performer spins. `demo` is the film's shared sequence; `word` and
 * `length` generate a new one through the same pipeline the Create module
 * uses; `mirrorOf` reflects another performer's sequence across the
 * north-south axis — the one-word spelling of
 * `{transformOf, transforms: [{op: "mirror"}]}`; `transformOf` applies any
 * chain of the Actions-panel transforms to another performer's sequence; and
 * `library` plays a sequence someone saved to the public library.
 *
 * `demo`, `mirrorOf`, `transformOf`, and `library` take no controls. A derived
 * sequence is its source's sequence changed in a stated way, so a turn figure
 * written on it would have to disagree with the thing it claims to derive
 * from; a library sequence is already finished.
 */
export type DirectorPerformerSequence =
  | { source: "demo" }
  | { mirrorOf: string }
  | DirectorTransformedSequence
  | DirectorLibrarySequence
  | DirectorGeneratedSequence;

export function isGeneratedSequence(
  sequence: DirectorPerformerSequence
): sequence is DirectorGeneratedSequence {
  return "word" in sequence || "length" in sequence;
}

export function isTransformedSequence(
  sequence: DirectorPerformerSequence
): sequence is DirectorTransformedSequence {
  return "transformOf" in sequence;
}

export function isLibrarySequence(
  sequence: DirectorPerformerSequence
): sequence is DirectorLibrarySequence {
  return "library" in sequence;
}

/**
 * The performer a derived sequence reads from, or null for a sequence that
 * stands on its own. `mirrorOf` and `transformOf` are the two derived forms.
 */
export function transformSourceId(
  sequence: DirectorPerformerSequence
): string | null {
  if ("mirrorOf" in sequence) return sequence.mirrorOf;
  if ("transformOf" in sequence) return sequence.transformOf;
  return null;
}
```

Then extend `sequenceDirectiveKey`:

```ts
export function sequenceDirectiveKey(
  sequence: DirectorPerformerSequence
): string {
  if ("mirrorOf" in sequence) return `mirrorOf:${sequence.mirrorOf}`;
  if ("transformOf" in sequence) {
    return `transformOf:${sequence.transformOf}:${stableJson(sequence.transforms)}`;
  }
  if ("library" in sequence) return `library:${sequence.library}`;
  if (!isGeneratedSequence(sequence)) return "demo";
  return `generated:${stableJson(sequence)}`;
}
```

`stableJson` already sorts object keys, which is why the expected key in the test lists `degrees, direction, op`.

- [ ] **Step 4: Run tests** — same command. Expected: PASS. Also run the whole `tests/unit/film-director` folder; anything that switches exhaustively on the union (grep `"mirrorOf" in` across `_lib`) must still type-check — fix `film-director-edit.ts` if it narrows the union (read it; it consumes `performer.sequence` only through the schema, so it should need no change).

- [ ] **Step 5: Commit**

```bash
git add src/routes/test/film-director/_lib/sequence-language.ts tests/unit/film-director/sequence-language.test.ts
git commit -m "feat(film-director): speak transformOf and library sequence sources (types)" -- src/routes/test/film-director/_lib/sequence-language.ts tests/unit/film-director/sequence-language.test.ts
```

---

### Task 2: Schema

**Files:** Modify `src/routes/test/film-director/_lib/film-director-schema.ts` (~lines 389-482); Test `tests/unit/film-director/film-director-schema.test.ts`.

- [ ] **Step 1: Failing tests.** Find how the existing schema tests build a film (there is a helper that wraps a scene; reuse it — look for the `mirrorOf` accept test and copy its shape). Add:

```ts
describe("sequence sources: transformOf and library", () => {
  it("accepts a transform chain", () => {
    const parsed = parse(
      sceneWith({
        performance: {
          performers: [
            { id: "lead", sequence: { word: "SAILOR" } },
            {
              id: "second",
              sequence: {
                transformOf: "lead",
                transforms: [
                  { op: "rotate", degrees: 90, direction: "cw" },
                  { op: "swap-hands" },
                  { op: "start-at", step: 2 },
                ],
              },
            },
          ],
        },
      })
    );
    expect(parsed.scenes[0]!.performance.performers[1]!.sequence).toEqual({
      transformOf: "lead",
      transforms: [
        { op: "rotate", degrees: 90, direction: "cw" },
        { op: "swap-hands" },
        { op: "start-at", step: 2 },
      ],
    });
  });

  it("accepts a library sequence", () => {
    const parsed = parse(
      sceneWith({
        performance: {
          performers: [{ id: "solo", sequence: { library: "0c7e6529-1dca-4254-903e-7068e38c030c" } }],
        },
      })
    );
    expect(parsed.scenes[0]!.performance.performers[0]!.sequence).toEqual({
      library: "0c7e6529-1dca-4254-903e-7068e38c030c",
    });
  });

  it("rejects transformOf without transforms", () => {
    expect(() =>
      parse(sceneWith({ performance: { performers: [{ id: "a", sequence: { transformOf: "b" } }] } }))
    ).toThrow(/"transforms" says what changes/);
  });

  it("rejects transforms without transformOf", () => {
    expect(() =>
      parse(
        sceneWith({
          performance: {
            performers: [{ id: "a", sequence: { word: "AB", transforms: [{ op: "mirror" }] } }],
          },
        })
      )
    ).toThrow(/"transforms" only means something on a "transformOf"/);
  });

  it("rejects an empty transform chain", () => {
    expect(() =>
      parse(
        sceneWith({
          performance: {
            performers: [{ id: "a", sequence: { transformOf: "b", transforms: [] } }],
          },
        })
      )
    ).toThrow(/at least one/);
  });

  it("rejects a rotation that is not a 45-degree step", () => {
    expect(() =>
      parse(
        sceneWith({
          performance: {
            performers: [
              {
                id: "a",
                sequence: {
                  transformOf: "b",
                  transforms: [{ op: "rotate", degrees: 60, direction: "cw" }],
                },
              },
            ],
          },
        })
      )
    ).toThrow(/45/);
  });

  it("rejects a hand on swap-hands", () => {
    expect(() =>
      parse(
        sceneWith({
          performance: {
            performers: [
              {
                id: "a",
                sequence: { transformOf: "b", transforms: [{ op: "swap-hands", hand: "left" }] },
              },
            ],
          },
        })
      )
    ).toThrow();
  });

  it("rejects start-at step 1", () => {
    expect(() =>
      parse(
        sceneWith({
          performance: {
            performers: [
              { id: "a", sequence: { transformOf: "b", transforms: [{ op: "start-at", step: 1 }] } },
            ],
          },
        })
      )
    ).toThrow(/already starts/);
  });

  it("rejects controls on a library sequence", () => {
    expect(() =>
      parse(
        sceneWith({
          performance: {
            performers: [{ id: "a", sequence: { library: "x", turns: "none" } }],
          },
        })
      )
    ).toThrow(/already finished/);
  });

  it("rejects controls on a transformed sequence", () => {
    expect(() =>
      parse(
        sceneWith({
          performance: {
            performers: [
              {
                id: "a",
                sequence: { transformOf: "b", transforms: [{ op: "flip" }], level: 2 },
              },
            ],
          },
        })
      )
    ).toThrow(/carries no controls of its own/);
  });

  it("rejects two sources", () => {
    expect(() =>
      parse(
        sceneWith({
          performance: {
            performers: [{ id: "a", sequence: { library: "x", mirrorOf: "b" } }],
          },
        })
      )
    ).toThrow(/names one source, but this one names "mirrorOf", "library"/);
  });
});
```

Adapt `parse`/`sceneWith` to whatever helpers the file already uses (read the top of the test file first). If `turns: "none"` is not a valid spelling in the current turns grammar, use any control the existing controls tests use (e.g. `level: 2`).

- [ ] **Step 2: Run** — Expected: FAIL on the new fields (strict object rejects `transformOf`).

- [ ] **Step 3: Implement.** Above `performerSequenceSchema`:

```ts
const transformHandSchema = z.enum(["left", "right", "both"]);

const sequenceTransformSchema = z.discriminatedUnion("op", [
  z.object({ op: z.literal("mirror"), hand: transformHandSchema.optional() }).strict(),
  z.object({ op: z.literal("flip"), hand: transformHandSchema.optional() }).strict(),
  z
    .object({
      op: z.literal("rotate"),
      degrees: z.literal(DIRECTOR_ROTATION_DEGREES, {
        error: () =>
          "A sequence rotates in 45-degree steps: 45, 90, 135, 180, 225, 270, or 315.",
      }),
      direction: z.enum(["cw", "ccw"]),
      hand: transformHandSchema.optional(),
    })
    .strict(),
  z.object({ op: z.literal("swap-hands") }).strict(),
  z.object({ op: z.literal("invert"), hand: transformHandSchema.optional() }).strict(),
  z.object({ op: z.literal("rewind"), hand: transformHandSchema.optional() }).strict(),
  z
    .object({
      op: z.literal("start-at"),
      step: z
        .number()
        .int()
        .min(2, {
          error: "A sequence already starts at step 1. Name a later step to start from.",
        })
        .max(64),
    })
    .strict(),
]);
```

Import `DIRECTOR_ROTATION_DEGREES` from `./sequence-language`. Check the zod 4 error-customization spelling already used elsewhere in this schema file (search for `error:` or `message:`) and match it.

Update the keys and object:

```ts
const SEQUENCE_SOURCE_KEYS = ["source", "mirrorOf", "transformOf", "library", "word", "length"] as const;
```

Add fields to the object:

```ts
    transformOf: z.string().min(1).optional(),
    transforms: z
      .array(sequenceTransformSchema)
      .min(1, { error: 'A "transforms" list needs at least one operation.' })
      .max(8)
      .optional(),
    library: z.string().min(1).optional(),
```

Extend the `superRefine`. After the `named.length > 1` branch and before the `word`/`length` early return:

```ts
    if (named[0] === "transformOf" && value.transforms === undefined) {
      ctx.addIssue({
        code: "custom",
        message:
          '"transformOf" names whose sequence to change; "transforms" says what changes. Add a "transforms" list.',
      });
      return;
    }
    if (named[0] !== "transformOf" && value.transforms !== undefined) {
      ctx.addIssue({
        code: "custom",
        message:
          '"transforms" only means something on a "transformOf" sequence. Name the performer to transform, or remove the list.',
      });
      return;
    }
```

Update the no-source message:

```ts
'A sequence names one source: {source: "demo"}, a "word" to spell, a "length" to improvise, a "mirrorOf" to reflect, a "transformOf" to change, or a "library" id to play.'
```

Update the controls message to a small lookup:

```ts
    const CONTROL_REJECTIONS: Record<string, string> = {
      mirrorOf: `A mirror reflects another performer's sequence exactly, so it carries no controls of its own. Move ${quoted(controls)} to the performer being mirrored.`,
      transformOf: `A transformed sequence is another performer's sequence changed in a stated way, so it carries no controls of its own. Move ${quoted(controls)} to the performer being transformed.`,
      library: `A library sequence is already finished, so it carries no controls of its own. Remove ${quoted(controls)}, or spell a "word" of your own.`,
      source: `The demo sequence is the film's shared one, so it carries no controls of its own. Remove ${quoted(controls)}, or spell a "word" of your own.`,
    };
    ctx.addIssue({ code: "custom", message: CONTROL_REJECTIONS[named[0]!]! });
```

Note `transforms` is NOT in `SEQUENCE_CONTROL_KEYS` — it is part of the source, handled by the two refinements above.

- [ ] **Step 4: Run** the schema tests and the full folder. Expected: PASS; the resolution snapshot must be untouched (no shipped film uses the new keys).

- [ ] **Step 5: Commit** with pathspec: the schema file and its test.

---

### Task 3: Resolver validation of the derived graph

**Files:** Modify `src/routes/test/film-director/_lib/resolve-film-director-spec.ts:674-705`; Test `tests/unit/film-director/performer-sequences.test.ts`.

- [ ] **Step 1: Failing tests** (append):

```ts
  it("resolves a transform chain that names another performer", () => {
    const spec = resolveFilmDirectorSpec(
      named([
        { id: "lead", sequence: { word: "SAILOR" } },
        {
          id: "second",
          sequence: { transformOf: "lead", transforms: [{ op: "rewind" }] },
        },
      ])
    );
    expect(spec.scenes[0]!.performance.performers[1]!.sequence).toEqual({
      transformOf: "lead",
      transforms: [{ op: "rewind" }],
    });
  });

  it("resolves a transform of a library performer", () => {
    const spec = resolveFilmDirectorSpec(
      named([
        { id: "lead", sequence: { library: "0c7e6529-1dca-4254-903e-7068e38c030c" } },
        { id: "second", sequence: { transformOf: "lead", transforms: [{ op: "flip" }] } },
      ])
    );
    expect(spec.scenes[0]!.performance.performers.map((p) => p.sequence)).toEqual([
      { library: "0c7e6529-1dca-4254-903e-7068e38c030c" },
      { transformOf: "lead", transforms: [{ op: "flip" }] },
    ]);
  });

  it("rejects a performer transforming themselves", () => {
    expect(() =>
      resolveFilmDirectorSpec(
        named([{ id: "solo", sequence: { transformOf: "solo", transforms: [{ op: "invert" }] } }])
      )
    ).toThrow(/cannot transform themselves/);
  });

  it("rejects a transform of a performer who is not in the scene", () => {
    expect(() =>
      resolveFilmDirectorSpec(
        named([{ id: "solo", sequence: { transformOf: "ghost", transforms: [{ op: "invert" }] } }])
      )
    ).toThrow(/transforms "ghost", who is not in this scene/);
  });

  it("rejects a transform of a mirror, and a mirror of a transform", () => {
    expect(() =>
      resolveFilmDirectorSpec(
        named([
          { id: "a", sequence: { word: "AB" } },
          { id: "b", sequence: { mirrorOf: "a" } },
          { id: "c", sequence: { transformOf: "b", transforms: [{ op: "flip" }] } },
        ])
      )
    ).toThrow(/"b", whose sequence is already derived from another performer's. Derive from the original instead/);
    expect(() =>
      resolveFilmDirectorSpec(
        named([
          { id: "a", sequence: { word: "AB" } },
          { id: "b", sequence: { transformOf: "a", transforms: [{ op: "flip" }] } },
          { id: "c", sequence: { mirrorOf: "b" } },
        ])
      )
    ).toThrow(/already derived from another performer's/);
  });
```

Check the existing mirror-of-mirror test's expected regex (`already a mirror`) — the message changes to the generalized wording below, so update that older assertion to `/already derived from another performer's/` as well.

- [ ] **Step 2: Run** — FAIL.

- [ ] **Step 3: Implement.** Replace the `forEach` at lines ~682-705 with:

```ts
  resolvedSequences.forEach((sequence, index) => {
    const self = performerIds[index]!;
    assertSequenceDirective(
      sequence,
      `Scene "${scene.id}", performer "${self}"`
    );
    const sourceId = transformSourceId(sequence);
    if (sourceId === null) return;
    const verb = "mirrorOf" in sequence ? "mirror" : "transform";
    if (sourceId === self) {
      throw new Error(
        `Scene "${scene.id}": performer "${self}" cannot ${verb} themselves.`
      );
    }
    const targetIndex = performerIds.indexOf(sourceId);
    if (targetIndex < 0) {
      throw new Error(
        `Scene "${scene.id}": performer "${self}" ${verb}s "${sourceId}", who is not in this scene.`
      );
    }
    if (transformSourceId(resolvedSequences[targetIndex]!) !== null) {
      throw new Error(
        `Scene "${scene.id}": performer "${self}" ${verb}s "${sourceId}", whose sequence is already derived from another performer's. Derive from the original instead.`
      );
    }
  });
```

Import `transformSourceId` from `./sequence-language`. Update the comment above it to say "derived" rather than "mirror" where it describes the one-level rule.

- [ ] **Step 4: Run the full folder.** Expected: PASS, snapshot untouched.

- [ ] **Step 5: Commit** (resolver + test, pathspec).

---

### Task 4: Sequence library — injectable deps, transform chains, library source

**Files:** Create `src/routes/test/film-director/_lib/director-library-source.ts`; Modify `src/routes/test/film-director/_lib/director-sequence-library.ts`; Test create `tests/unit/film-director/director-sequence-library.test.ts`.

- [ ] **Step 1: Failing test** (new file):

```ts
import { describe, expect, it, vi } from "vitest";

import {
  createDirectorSequenceLibrary,
  type DirectorSequenceLibraryDeps,
} from "../../../src/routes/test/film-director/_lib/director-sequence-library";
import { resolveFilmDirectorSpec } from "../../../src/routes/test/film-director/_lib/resolve-film-director-spec";
import type { SequenceData } from "../../../src/lib/shared/foundation/domain/models/sequence-data";

/** Sequences are opaque here; only identity and the applied op trail matter. */
function seq(tag: string): SequenceData {
  return { id: tag, name: tag, word: tag, steps: [] } as unknown as SequenceData;
}
const tag = (s: SequenceData) => s.id as string;

function deps(): DirectorSequenceLibraryDeps & { calls: string[] } {
  const calls: string[] = [];
  const stamp = (op: string) => async (s: SequenceData, ...rest: unknown[]) => {
    calls.push(`${op}(${tag(s)}${rest.length ? "," + rest.map(String).join(",") : ""})`);
    return seq(`${tag(s)}>${op}`);
  };
  return {
    calls,
    generate: vi.fn(async () => seq("gen")),
    loadLibrarySequence: vi.fn(async (id: string) => seq(`lib:${id}`)),
    transforms: {
      mirrorSequence: stamp("mirror"),
      flipSequence: stamp("flip"),
      rotateSequence: stamp("rotate"),
      swapHands: (s) => {
        calls.push(`swap(${tag(s)})`);
        return seq(`${tag(s)}>swap`);
      },
      invertSequence: stamp("invert"),
      rewindSequence: stamp("rewind"),
      shiftStartPosition: (s, step) => {
        calls.push(`start-at(${tag(s)},${step})`);
        return seq(`${tag(s)}>start-at`);
      },
    },
  };
}

function film(performers: Record<string, unknown>[]) {
  return resolveFilmDirectorSpec({
    version: 2,
    id: "lib-film",
    title: "Lib Film",
    scenes: [{ id: "s1", title: "S1", performance: { performers } }],
  });
}

describe("director sequence library", () => {
  it("applies a transform chain in order with the spoken hand and rotation", async () => {
    const d = deps();
    const lib = createDirectorSequenceLibrary(seq("demo"), d);
    await lib.prepare(
      film([
        { id: "lead" },
        {
          id: "second",
          sequence: {
            transformOf: "lead",
            transforms: [
              { op: "rotate", degrees: 90, direction: "ccw", hand: "left" },
              { op: "flip" },
              { op: "swap-hands" },
              { op: "start-at", step: 3 },
            ],
          },
        },
      ])
    );
    expect(d.calls).toEqual([
      "rotate(demo,-2,left)",
      "flip(demo>rotate,both)",
      "swap(demo>rotate>flip)",
      "start-at(demo>rotate>flip>swap,3)",
    ]);
    expect(tag(lib.forScene("s1").get("second")!)).toBe("demo>rotate>flip>swap>start-at");
    expect(lib.failures).toEqual([]);
  });

  it("turns clockwise degrees into positive 45-degree steps", async () => {
    const d = deps();
    const lib = createDirectorSequenceLibrary(seq("demo"), d);
    await lib.prepare(
      film([
        { id: "lead" },
        {
          id: "second",
          sequence: { transformOf: "lead", transforms: [{ op: "rotate", degrees: 135, direction: "cw" }] },
        },
      ])
    );
    expect(d.calls).toEqual(["rotate(demo,3,both)"]);
  });

  it("keeps mirrorOf on the mirror transform", async () => {
    const d = deps();
    const lib = createDirectorSequenceLibrary(seq("demo"), d);
    await lib.prepare(film([{ id: "lead" }, { id: "second", sequence: { mirrorOf: "lead" } }]));
    expect(d.calls).toEqual(["mirror(demo,both)"]);
  });

  it("loads a library sequence once and lets another performer transform it", async () => {
    const d = deps();
    const lib = createDirectorSequenceLibrary(seq("demo"), d);
    await lib.prepare(
      film([
        { id: "lead", sequence: { library: "abc" } },
        { id: "second", sequence: { library: "abc" } },
        { id: "third", sequence: { transformOf: "lead", transforms: [{ op: "rewind" }] } },
      ])
    );
    expect(d.loadLibrarySequence).toHaveBeenCalledTimes(1);
    expect(tag(lib.forScene("s1").get("lead")!)).toBe("lib:abc");
    expect(tag(lib.forScene("s1").get("third")!)).toBe("lib:abc>rewind");
  });

  it("shares one derived result between performers who ask for the same chain", async () => {
    const d = deps();
    const lib = createDirectorSequenceLibrary(seq("demo"), d);
    await lib.prepare(
      film([
        { id: "lead" },
        { id: "b", sequence: { transformOf: "lead", transforms: [{ op: "invert" }] } },
        { id: "c", sequence: { transformOf: "lead", transforms: [{ op: "invert" }] } },
      ])
    );
    expect(d.calls).toEqual(["invert(demo,both)"]);
  });

  it("falls back to the demo with a reason when a library sequence is missing", async () => {
    const d = deps();
    d.loadLibrarySequence = vi.fn(async (id: string) => {
      throw new Error(`Library sequence "${id}" is not in the public library.`);
    });
    const lib = createDirectorSequenceLibrary(seq("demo"), d);
    await lib.prepare(film([{ id: "lead", sequence: { library: "nope" } }]));
    expect(tag(lib.forScene("s1").get("lead")!)).toBe("demo");
    expect(lib.failures[0]).toMatch(/performer "lead": Library sequence "nope" is not in the public library/);
  });
});
```

`console.error` fires on the fallback path; silence it in that test with `vi.spyOn(console, "error").mockImplementation(() => {})` if the suite treats console noise as failure.

- [ ] **Step 2: Run** — FAIL (no second constructor arg, no `DirectorSequenceLibraryDeps`).

- [ ] **Step 3: Create `director-library-source.ts`:**

```ts
/**
 * Loads a sequence a director named by its public-library id. Public
 * sequences are world-readable (`firestore.rules` → `publicSequences`), so
 * this works signed out, which is what a test workbench needs. The batch
 * fetcher is the library module's own reader; this file only adds the
 * one-id shape and a director-readable miss.
 */

import { getFirestoreInstance } from "$lib/shared/auth/firebase";
import { batchFetchPublicSequences } from "$lib/shared/library/services/collection-firestore-mapper";
import type { SequenceData } from "$lib/shared/foundation/domain/models/sequence-data";

export async function loadPublicLibrarySequence(
  sequenceId: string
): Promise<SequenceData> {
  const firestore = await getFirestoreInstance();
  const [sequence] = await batchFetchPublicSequences(firestore, [sequenceId]);
  if (!sequence) {
    throw new Error(
      `Library sequence "${sequenceId}" is not in the public library.`
    );
  }
  return sequence;
}
```

- [ ] **Step 4: Rewrite `director-sequence-library.ts`:**

```ts
/**
 * Resolves each performer's directed sequence into real SequenceData.
 *
 * The film schema lets a performer say what they spin — the shared demo, a
 * directed sequence, a saved library sequence, or another performer's
 * sequence changed by a chain of transforms (`mirrorOf` being the one-word
 * spelling of a single mirror). Generating, loading, and transforming are all
 * async, so this sits between the synchronous spec resolver and the location:
 * the scene asks for a scene's sequences, gets whatever has resolved so far,
 * and re-applies once the rest land.
 *
 * Everything is cached by what it is rather than by who asked for it, so two
 * performers who directed the same sequence share one generated result, and a
 * given transform chain of it runs once no matter how many performers ask.
 *
 * Dependencies are injectable so the chain logic is testable without the
 * generation orchestrator, Firestore, or the motion-query singleton; the
 * defaults are the production owners.
 */

import { generationOrchestrator } from "$lib/shared/create/services/generation-orchestrator";
import {
  flipSequence,
  invertSequence,
  mirrorSequence,
  rewindSequence,
  rotateSequence,
  shiftStartPosition,
  swapHands,
} from "$lib/shared/create/services/sequence-transformer";
import type { GenerationOptions } from "$lib/shared/create/services/generation-orchestrator"; // adjust to the real export site of GenerationOptions
import type { SequenceData } from "$lib/shared/foundation/domain/models/sequence-data";

import { loadPublicLibrarySequence } from "./director-library-source";
import type {
  ResolvedDirectorScene,
  ResolvedFilmDirectorSpec,
} from "./film-director-schema";
import {
  compileSequenceDirective,
  isGeneratedSequence,
  isLibrarySequence,
  sequenceDirectiveKey,
  transformSourceId,
  type DirectorPerformerSequence,
  type DirectorSequenceTransform,
  type DirectorTransformHand,
} from "./sequence-language";

export interface DirectorSequenceTransforms {
  mirrorSequence(seq: SequenceData, hand: DirectorTransformHand): Promise<SequenceData>;
  flipSequence(seq: SequenceData, hand: DirectorTransformHand): Promise<SequenceData>;
  rotateSequence(seq: SequenceData, steps: number, hand: DirectorTransformHand): Promise<SequenceData>;
  swapHands(seq: SequenceData): SequenceData;
  invertSequence(seq: SequenceData, hand: DirectorTransformHand): Promise<SequenceData>;
  rewindSequence(seq: SequenceData, hand: DirectorTransformHand): Promise<SequenceData>;
  shiftStartPosition(seq: SequenceData, step: number): SequenceData;
}

export interface DirectorSequenceLibraryDeps {
  generate(options: GenerationOptions): Promise<SequenceData>;
  loadLibrarySequence(id: string): Promise<SequenceData>;
  transforms: DirectorSequenceTransforms;
}

const PRODUCTION_DEPS: DirectorSequenceLibraryDeps = {
  generate: (options) => generationOrchestrator.generateSequence(options),
  loadLibrarySequence: loadPublicLibrarySequence,
  transforms: {
    mirrorSequence,
    flipSequence,
    rotateSequence,
    swapHands,
    invertSequence,
    rewindSequence,
    shiftStartPosition,
  },
};

export interface DirectorSequenceLibrary {
  prepare(film: ResolvedFilmDirectorSpec): Promise<void>;
  forScene(sceneId: string): ReadonlyMap<string, SequenceData>;
  readonly failures: readonly string[];
}

const EMPTY: ReadonlyMap<string, SequenceData> = new Map();

/** Degrees and a felt direction → the transformer's signed 45° step count (positive is clockwise). */
export function rotationSteps(degrees: number, direction: "cw" | "ccw"): number {
  const steps = degrees / 45;
  return direction === "cw" ? steps : -steps;
}

/** The chain `mirrorOf` stands for. */
const MIRROR_CHAIN: readonly DirectorSequenceTransform[] = [{ op: "mirror" }];

export async function applyTransformChain(
  source: SequenceData,
  chain: readonly DirectorSequenceTransform[],
  transforms: DirectorSequenceTransforms
): Promise<SequenceData> {
  let current = source;
  for (const step of chain) {
    switch (step.op) {
      case "mirror":
        current = await transforms.mirrorSequence(current, step.hand ?? "both");
        break;
      case "flip":
        current = await transforms.flipSequence(current, step.hand ?? "both");
        break;
      case "rotate":
        current = await transforms.rotateSequence(
          current,
          rotationSteps(step.degrees, step.direction),
          step.hand ?? "both"
        );
        break;
      case "swap-hands":
        current = transforms.swapHands(current);
        break;
      case "invert":
        current = await transforms.invertSequence(current, step.hand ?? "both");
        break;
      case "rewind":
        current = await transforms.rewindSequence(current, step.hand ?? "both");
        break;
      case "start-at":
        current = transforms.shiftStartPosition(current, step.step);
        break;
    }
  }
  return current;
}

export function createDirectorSequenceLibrary(
  demoSequence: SequenceData,
  deps: DirectorSequenceLibraryDeps = PRODUCTION_DEPS
): DirectorSequenceLibrary {
  const sources = new Map<string, Promise<SequenceData>>();
  const derived = new Map<string, Promise<SequenceData>>();
  const byScene = new Map<string, Map<string, SequenceData>>();
  const failures: string[] = [];
  let preparedFilmId: string | null = null;
  let preparing: Promise<void> | null = null;

  function resolveSource(sequence: DirectorPerformerSequence): Promise<SequenceData> {
    const key = sequenceDirectiveKey(sequence);
    const existing = sources.get(key);
    if (existing) return existing;

    const created = isGeneratedSequence(sequence)
      ? deps.generate(compileSequenceDirective(sequence))
      : isLibrarySequence(sequence)
        ? deps.loadLibrarySequence(sequence.library)
        : Promise.resolve(demoSequence);

    sources.set(key, created);
    return created;
  }

  /**
   * A derived sequence is cached by its SOURCE's directive key plus the chain,
   * not by the source performer's id: two performers who transform two
   * different performers spinning the same word still share one result.
   */
  function resolveDerived(
    source: DirectorPerformerSequence,
    chain: readonly DirectorSequenceTransform[]
  ): Promise<SequenceData> {
    const key = `derived:${sequenceDirectiveKey(source)}:${JSON.stringify(chain)}`;
    const existing = derived.get(key);
    if (existing) return existing;

    const created = resolveSource(source).then((resolved) =>
      applyTransformChain(resolved, chain, deps.transforms)
    );
    derived.set(key, created);
    return created;
  }

  async function resolveScene(scene: ResolvedDirectorScene): Promise<void> {
    const performers = scene.performance.performers;
    const byId = new Map(performers.map((performer) => [performer.id, performer.sequence]));
    const resolved = new Map<string, SequenceData>();

    await Promise.all(
      performers.map(async (performer) => {
        const directed = performer.sequence;
        try {
          const sourceId = transformSourceId(directed);
          if (sourceId !== null) {
            // The spec resolver already proved this names a non-derived
            // performer in this same scene.
            const source = byId.get(sourceId)!;
            const chain = "transformOf" in directed ? directed.transforms : MIRROR_CHAIN;
            resolved.set(performer.id, await resolveDerived(source, chain));
            return;
          }
          resolved.set(performer.id, await resolveSource(directed));
        } catch (error: unknown) {
          const reason = error instanceof Error ? error.message : String(error);
          failures.push(`Scene "${scene.id}", performer "${performer.id}": ${reason}`);
          console.error(
            `[FilmDirector] Could not build the directed sequence for "${performer.id}" in scene "${scene.id}". Falling back to the film's demo sequence.`,
            error
          );
          resolved.set(performer.id, demoSequence);
        }
      })
    );

    byScene.set(scene.id, resolved);
  }

  function prepare(film: ResolvedFilmDirectorSpec): Promise<void> {
    if (preparedFilmId === film.id && preparing) return preparing;
    preparedFilmId = film.id;
    byScene.clear();
    failures.length = 0;
    preparing = Promise.all(film.scenes.map(resolveScene)).then(() => undefined);
    return preparing;
  }

  return {
    prepare,
    forScene: (sceneId) => byScene.get(sceneId) ?? EMPTY,
    get failures() {
      return failures;
    },
  };
}
```

Fix the `GenerationOptions` import to wherever `compileSequenceDirective`'s return type is declared (grep `GenerationOptions` in `sequence-language.ts` and reuse that import path). Keep the derived-key JSON order identical to the chain as written (JSON.stringify preserves author order; ordering matters for chains, so do NOT sort here).

`FilmDirectorScene.svelte:59` keeps calling `createDirectorSequenceLibrary(sequence)` — the default deps apply. Confirm the mirror path still runs `mirrorSequence(source, "both")` exactly as before.

- [ ] **Step 5: Run** the new test and the full folder — PASS.

- [ ] **Step 6: Commit** (library, source file, test; pathspec).

---

### Task 5: Proving-grounds scene 6 + film-library test + docs

**Files:** Modify `src/routes/test/film-director/_films/proving-grounds.ts`, `tests/unit/film-director/film-library.test.ts`, `docs/reference/film-director-capability-matrix.md`, snapshot.

- [ ] **Step 1: Scene.** Append after the Gap 4 `three-shots` scene (if Gap 4 has landed on the branch; otherwise after `tracking-shot` and note the order in the commit):

```ts
    {
      id: "derived-sequences",
      title: "Derived Sequences",
      intent:
        "Gap 5: three ways to spin something other than the film's demo. Performer 1 plays a saved public-library sequence (FLFLFLFL). Performer 2 plays performer 1's sequence rotated 90° clockwise with hands swapped, so the same phrase reads turned and crossed. Performer 3 plays performer 1's sequence run backwards. Watch the three props: same material, three different pictures.",
      durationBeats: 16,
      transition: { kind: "cut" },
      location: { environmentId: "cosmic" },
      performance: {
        bpm: 120,
        formation: "line",
        cast: {
          count: 3,
          defaults: { effect: "none" },
          performers: [
            {
              id: "performer-1",
              // A real publicSequences document id, world-readable
              // (firestore.rules → publicSequences). Word FLFLFLFL as of
              // 2026-09-02. If it is ever unpublished the library falls back
              // to the demo and names the miss in `failures`.
              sequence: { library: "0c7e6529-1dca-4254-903e-7068e38c030c" },
            },
            {
              id: "performer-2",
              sequence: {
                transformOf: "performer-1",
                transforms: [
                  { op: "rotate", degrees: 90, direction: "cw" },
                  { op: "swap-hands" },
                ],
              },
            },
            {
              id: "performer-3",
              sequence: {
                transformOf: "performer-1",
                transforms: [{ op: "rewind" }],
              },
            },
          ],
        },
      },
      camera: {
        subject: { kind: "group" },
        shotSize: "wide",
        angle: "eye",
        position: "front",
        moves: [{ move: "hold" }],
      },
    },
```

Extend the file's header comment with a Gap 5 paragraph and the `brief` with one sentence ("A sixth scene spins a saved library sequence beside two transforms of it, a 90° rotation with swapped hands and a retrograde.").

- [ ] **Step 2: film-library test.** In the Proving Grounds block of `film-library.test.ts` add assertions that scene `derived-sequences` resolves performers' sequences to exactly the three objects above, and that `resolveFilmDirectorSpec` still succeeds. Check the film's total `durationSeconds` assertion (it was 40 after Gap 3; Gap 4 added 8 → 48; this scene adds 8 → update to the current value + 8).

- [ ] **Step 3: Snapshot.** Run the folder; the snapshot test fails on the Proving Grounds block only. Regenerate with `-u`, then `git diff tests/unit/film-director/__snapshots__/` and confirm only the `proving` block changed.

- [ ] **Step 4: Capability matrix.** In `docs/reference/film-director-capability-matrix.md`, update the sequence row to list `transformOf` + `transforms` (ops: mirror, flip, rotate 45° steps cw/ccw, swap-hands, invert, rewind, start-at; optional hand on the reflect/rotate/invert/rewind ops) and `library` (public `publicSequences` id), with `mirrorOf` described as sugar. Add a closed-gap bullet: "Sequence transforms and library source (closed 2026-09-02)". If a `<!-- directive-axes -->` list exists, do NOT add these — they are literal references, not directive axes (same reasoning as `mirrorOf`).

- [ ] **Step 5: Run the full folder + `npm run check:fast`.** Report counts; no new type errors in film-director files.

- [ ] **Step 6: Commit** with pathspec (film, test, snapshot, matrix, and this plan doc `docs/superpowers/plans/2026-09-02-film-director-gap-5-sequence-transforms.md`).

---

## Out of scope (say so, do not do)

- Rewriting `mirrorOf` into `transformOf` in resolved output (would change eight shipped snapshots for no behavior).
- A private-library or by-word library lookup — `library` is a public document id only.
- Per-step transforms or transforms on generated controls.
- Any renderer/adapter change.

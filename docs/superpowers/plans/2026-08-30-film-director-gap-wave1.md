# Film Director Gap Campaign — Wave 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** land the resolution-snapshot regression harness (Phase 0), the
`distinct`+`not` combined directive spelling (Gap 9), and beats as a time unit
everywhere seconds are speakable (Gap 1), plus the `proving-grounds` film that
visually demonstrates both gaps.

**Architecture:** Phase 0 freezes the 8 shipped films' resolved specs as vitest
string snapshots (numbers rounded to 1e-6). Gap 9 extends the `{pick}` branch
of the directive grammar with an optional `not`, normalizing into the
already-supported `{kind:"pick", distinct, pool, exclude}` canonical form. Gap
1 keeps seconds as the sole internal unit: a new pure converter
(`director-beat-times.ts`) rewrites a validated scene input's every
`durationBeats`/`atBeats` into `durationSeconds`/`atSeconds` using the scene's
own bpm, called once at the top of `resolveScene`; compilers stay untouched.

**Tech stack:** zod schemas, vitest (`tests/unit/film-director` project),
TypeScript. Working dir: `E:/worktrees/tka-platform/director-gaps`.

**House rules that bind every task:** commit with explicit pathspec
(`git commit -m "..." -- <paths>`); never `git add -A`; run tests via
`npx vitest run --project unit tests/unit/film-director/<file>` from the
worktree root (the film-director tests run in the `unit` project; if
`--project unit` errors, run plain `npx vitest run tests/unit/film-director/<file>`
and use whatever invocation the existing suite uses). Do not start any dev
server. Do not push.

---

### Task 1: Resolution snapshot harness (Phase 0)

**Files:**
- Test: `tests/unit/film-director/film-resolution-snapshot.test.ts` (create)

- [x] **Step 1: Write the test**

```ts
/**
 * The campaign's anti-regression gate: every film in the registry resolves to
 * a frozen spec. A later grammar phase that changes any snapshot must show
 * that diff and justify it in its commit message — silent drift in shipped
 * films is the failure this file exists to catch.
 *
 * Numbers are rounded to 1e-6 before snapshotting so an FP-identical refactor
 * does not churn the snapshot while any real change does.
 */
import { describe, expect, it } from "vitest";

import { FILM_LIBRARY } from "../../../src/routes/test/film-director/_films/index";
import { resolveFilmDirectorSpec } from "../../../src/routes/test/film-director/_lib/resolve-film-director-spec";

function stableJson(value: unknown): string {
  return JSON.stringify(
    value,
    (_key, val) =>
      typeof val === "number" ? Math.round(val * 1e6) / 1e6 : val,
    2
  );
}

describe("film resolution snapshots", () => {
  for (const entry of FILM_LIBRARY) {
    it(`"${entry.label}" (${entry.key}) resolves to its frozen spec`, () => {
      expect(stableJson(resolveFilmDirectorSpec(entry.film))).toMatchSnapshot();
    });
  }
});
```

- [x] **Step 2: Run it once to WRITE the snapshots, then again to prove they hold**

Run: `npx vitest run tests/unit/film-director/film-resolution-snapshot.test.ts`
Expected: first run PASSES and reports "snapshots written"; a second identical
run PASSES with 0 written. Confirm a `__snapshots__/film-resolution-snapshot.test.ts.snap`
file appeared next to the test.

- [x] **Step 3: Commit (snapshot file included)**

```bash
git commit -m "test(film-director): freeze resolved specs of all library films" -- tests/unit/film-director/film-resolution-snapshot.test.ts tests/unit/film-director/__snapshots__/film-resolution-snapshot.test.ts.snap
```

---

### Task 2: `distinct` + `not` combined spelling (Gap 9)

**Files:**
- Modify: `src/routes/test/film-director/_lib/directives.ts`
- Test: `tests/unit/film-director/directives.test.ts` (extend)
- Test: `tests/unit/film-director/resolve-directives.test.ts` (extend)
- Test: `tests/unit/film-director/resolve-directive-spec.test.ts` (extend)

- [x] **Step 1: Write the failing tests**

In `tests/unit/film-director/directives.test.ts`, add (adapt describe nesting
to the file's existing style — read it first):

```ts
describe("pick with not", () => {
  it("accepts {pick, not} and normalizes not into exclude", () => {
    expect(
      normalizeDirective<string>({ pick: "distinct", not: "wall" })
    ).toEqual({ kind: "pick", distinct: true, pool: null, exclude: ["wall"] });
  });

  it("accepts an array not and keeps the pool", () => {
    expect(
      normalizeDirective<string>({
        pick: "any",
        from: ["wall", "wheel", "floor"],
        not: ["wall", "floor"],
      })
    ).toEqual({
      kind: "pick",
      distinct: false,
      pool: ["wall", "wheel", "floor"],
      exclude: ["wall", "floor"],
    });
  });

  it("schema accepts {pick: 'distinct', not} on a plane axis", () => {
    const schema = directiveSchema(z.string());
    expect(
      schema.safeParse({ pick: "distinct", not: "wall" }).success
    ).toBe(true);
    expect(
      schema.safeParse({ pick: "distinct", not: ["wall", "floor"] }).success
    ).toBe(true);
  });

  it("schema still rejects an empty not array on the pick branch", () => {
    const schema = directiveSchema(z.string());
    expect(schema.safeParse({ pick: "any", not: [] }).success).toBe(false);
  });
});
```

In `tests/unit/film-director/resolve-directives.test.ts`, add a behavior test
(match the file's existing harness for calling `resolveCastAxis` — read it
first and reuse its helpers for the random stream):

```ts
it("pick distinct with not draws distinct values and never the excluded one", () => {
  // 3 performers on a 5-value catalog, excluding one value: all three
  // resolved values are distinct and none is the excluded value.
  // Use the file's existing seeded-stream helper.
});

it("pick distinct with not rejects when the pool minus exclusions is smaller than the cast", () => {
  // 4 performers, pool of 4, excluding 1 → the existing not-enough-values
  // rejection fires. Assert on the error message the resolver already throws
  // for exhausted distinct pools.
});
```

Write those two bodies for real against the file's existing helpers — the
comments above describe the scenario, and the assertions must be concrete
(`expect(new Set(resolved).size).toBe(3)`, `expect(resolved).not.toContain(...)`,
`expect(() => ...).toThrow(...)`).

In `tests/unit/film-director/resolve-directive-spec.test.ts`, add scene-scope
coverage using the file's existing minimal-film helpers:

```ts
it("scene-scoped environmentId accepts {pick:'any', not} and never draws the excluded environment", () => {
  // Resolve a 1-scene film with location.environmentId =
  //   { pick: "any", not: "forest" }
  // and assert resolved.scenes[0].location.environmentId !== "forest".
});

it("scene-scoped formation still rejects pick distinct, with or without not", () => {
  // { pick: "distinct", not: "line" } on performance.formation must throw the
  // existing "distinct/sameAs are performer-scoped" error.
});
```

Same rule: concrete bodies, reusing the file's film-fixture helpers.

- [x] **Step 2: Run to verify the new tests fail**

Run: `npx vitest run tests/unit/film-director/directives.test.ts`
Expected: FAIL — schema rejects `{pick, not}` (strict object), normalize
returns exclude `[]`.

- [x] **Step 3: Implement in `directives.ts`**

Type change:

```ts
export type DirectiveExpression<T extends string | number> =
  | { pick: "any" | "distinct"; from?: readonly T[]; not?: T | readonly T[] }
  | { oneOf: readonly T[] }
  | { not: T | readonly T[]; from?: readonly T[] }
  | { sameAs: string };
```

Schema change — the pick branch of `directiveSchema` becomes:

```ts
z.object({
  pick: z.enum(["any", "distinct"]),
  from: z.array(value).min(1).optional(),
  not: z.union([value, z.array(value).min(1)]).optional(),
}).strict(),
```

`normalizeDirective` — the pick branch must be checked BEFORE the not branch
(an object carrying both keys is pick-with-exclusions, not a bare not), and it
reads the optional `not`:

```ts
if ("sameAs" in value) return { kind: "sameAs", sameAs: value.sameAs };
if ("oneOf" in value) {
  return { kind: "pick", distinct: false, pool: [...value.oneOf], exclude: [] };
}
if ("pick" in value) {
  const exclude =
    value.not === undefined
      ? []
      : Array.isArray(value.not)
        ? [...value.not]
        : [value.not];
  return {
    kind: "pick",
    distinct: value.pick === "distinct",
    pool: value.from ? [...value.from] : null,
    exclude,
  };
}
// bare { not, from? }
const exclude = Array.isArray(value.not) ? [...value.not] : [value.not];
return {
  kind: "pick",
  distinct: false,
  pool: value.from ? [...value.from] : null,
  exclude,
};
```

Update the precedence note in `normalizeDirective`'s doc comment to
`sameAs > oneOf > pick > not` and say why the reorder is safe: schema-validated
input never carried both keys before this change, so no validated document
changes meaning.

Also update the union's error string to name the new spelling, keeping its
shape: `"Expected a literal value or a directive object ({pick}, {pick, not}, {oneOf}, {not}, {sameAs})"`.

- [x] **Step 4: Run the full film-director suite**

Run: `npx vitest run tests/unit/film-director`
Expected: PASS everywhere, including the Task 1 snapshots (this change touches
no resolved output for existing films) and the directive corpus.

- [x] **Step 5: Commit**

```bash
git commit -m "feat(film-director): speak distinct+not on one axis" -- src/routes/test/film-director/_lib/directives.ts tests/unit/film-director/directives.test.ts tests/unit/film-director/resolve-directives.test.ts tests/unit/film-director/resolve-directive-spec.test.ts
```

---

### Task 3: Beat-time converter module (Gap 1, core)

**Files:**
- Create: `src/routes/test/film-director/_lib/director-beat-times.ts`
- Test: `tests/unit/film-director/director-beat-times.test.ts` (create)

- [x] **Step 1: Write the failing tests**

```ts
import { describe, expect, it } from "vitest";

import {
  beatsToSeconds,
  convertSceneBeatTimes,
} from "../../../src/routes/test/film-director/_lib/director-beat-times";
import type { DirectorSceneInput } from "../../../src/routes/test/film-director/_lib/film-director-schema";

const baseScene = (
  overrides: Partial<DirectorSceneInput>
): DirectorSceneInput => ({
  id: "s1",
  title: "Scene",
  ...overrides,
});

describe("beatsToSeconds", () => {
  it("converts beats at the scene bpm", () => {
    expect(beatsToSeconds(16, 120)).toBe(8);
    expect(beatsToSeconds(8, 66)).toBeCloseTo(7.2727, 3);
  });
});

describe("convertSceneBeatTimes", () => {
  it("converts a scene durationBeats and removes the beats field", () => {
    const scene = convertSceneBeatTimes(
      baseScene({ durationBeats: 16 } as Partial<DirectorSceneInput>),
      120
    );
    expect(scene.durationSeconds).toBe(8);
    expect("durationBeats" in scene && scene.durationBeats).toBeFalsy();
  });

  it("leaves a seconds-stated scene untouched", () => {
    const input = baseScene({ durationSeconds: 12 });
    expect(convertSceneBeatTimes(input, 90)).toEqual(input);
  });

  it("converts transition durationBeats at the incoming scene's bpm", () => {
    const scene = convertSceneBeatTimes(
      baseScene({
        transition: { kind: "fade-through-black", durationBeats: 2 },
      } as unknown as Partial<DirectorSceneInput>),
      60
    );
    expect(scene.transition?.durationSeconds).toBe(2);
  });

  it("converts blocking-move, scene-blocking, and camera-move durations", () => {
    const scene = convertSceneBeatTimes(
      baseScene({
        performance: {
          bpm: 120,
          blocking: { endFormation: "line", durationBeats: 8 },
          performers: [
            {
              blocking: [
                { move: "walk", to: { x: 1, z: 0 }, durationBeats: 4 },
                { move: "stand" },
              ],
            },
          ],
        },
        camera: {
          shotSize: "medium",
          moves: [
            { move: "push-in", durationBeats: 8 },
            { move: "hold" },
          ],
        },
      } as unknown as Partial<DirectorSceneInput>),
      120
    );
    expect(scene.performance?.blocking?.durationSeconds).toBe(4);
    expect(scene.performance?.performers?.[0]?.blocking?.[0]?.durationSeconds).toBe(2);
    expect(scene.performance?.performers?.[0]?.blocking?.[1]?.durationSeconds).toBeUndefined();
    expect(scene.camera?.moves?.[0]?.durationSeconds).toBe(4);
  });

  it("converts cast defaults and cast performer blocking too", () => {
    const scene = convertSceneBeatTimes(
      baseScene({
        performance: {
          cast: {
            count: 2,
            defaults: {
              blocking: [{ move: "walk", direction: "forward", durationBeats: 4 }],
            },
            performers: [
              { blocking: [{ move: "turn", direction: "left", durationBeats: 2 }] },
            ],
          },
        },
      } as unknown as Partial<DirectorSceneInput>),
      60
    );
    expect(
      scene.performance?.cast?.defaults?.blocking?.[0]?.durationSeconds
    ).toBe(4);
    expect(
      scene.performance?.cast?.performers?.[0]?.blocking?.[0]?.durationSeconds
    ).toBe(2);
  });

  it("converts camera keyframe atBeats to atSeconds", () => {
    const scene = convertSceneBeatTimes(
      baseScene({
        camera: {
          keyframes: [
            { atSeconds: 0, position: [0, 1, -4] },
            { atBeats: 8, position: [0, 1, -2] },
          ],
        },
      } as unknown as Partial<DirectorSceneInput>),
      120
    );
    expect(scene.camera?.keyframes?.[1]?.atSeconds).toBe(4);
    expect(
      scene.camera?.keyframes?.[1] &&
        "atBeats" in scene.camera.keyframes[1] &&
        scene.camera.keyframes[1].atBeats
    ).toBeFalsy();
  });

  it("rejects a beats-stated scene duration that converts outside 1-60 seconds, speaking beats", () => {
    expect(() =>
      convertSceneBeatTimes(
        baseScene({ durationBeats: 96 } as Partial<DirectorSceneInput>),
        66
      )
    ).toThrow(/96 beats at 66 bpm is 87\.3s/);
    expect(() =>
      convertSceneBeatTimes(
        baseScene({ durationBeats: 96 } as Partial<DirectorSceneInput>),
        66
      )
    ).toThrow(/scenes run 1-60 seconds/i);
  });

  it("rejects a beats-stated transition longer than 3 seconds, speaking beats", () => {
    expect(() =>
      convertSceneBeatTimes(
        baseScene({
          transition: { kind: "cut", durationBeats: 8 },
        } as unknown as Partial<DirectorSceneInput>),
        60
      )
    ).toThrow(/8 beats at 60 bpm is 8(\.0)?s/);
  });
});
```

- [x] **Step 2: Run to verify they fail**

Run: `npx vitest run tests/unit/film-director/director-beat-times.test.ts`
Expected: FAIL — module does not exist.

- [x] **Step 3: Implement `director-beat-times.ts`**

```ts
/**
 * Beats are surface grammar; seconds are the machine's only internal unit.
 *
 * A director counts music, not a stopwatch — "walk in for four beats" is
 * speakable where "walk in for 2.667 seconds" is not. Every duration field in
 * the scene schema accepts a `durationBeats` twin (and camera keyframes an
 * `atBeats` twin), and this module rewrites them into seconds ONCE, at the top
 * of resolveScene, using the scene's own bpm. Every compiler downstream
 * (move windows, blocking, camera) keeps thinking in seconds and never learns
 * beats exist.
 *
 * Schema-level bounds on durationSeconds (scene 1-60, transition 0-3) cannot
 * see a beats-stated value, so the converter re-checks the converted result
 * here and speaks the error in beats.
 */
import type { DirectorSceneInput } from "./film-director-schema";

export function beatsToSeconds(beats: number, bpm: number): number {
  return (beats * 60) / bpm;
}

interface BeatTimed {
  durationSeconds?: number;
  durationBeats?: number;
}

function convertDuration<T extends BeatTimed>(value: T, bpm: number): T {
  if (value.durationBeats === undefined) return value;
  const { durationBeats, ...rest } = value;
  return { ...rest, durationSeconds: beatsToSeconds(durationBeats, bpm) } as T;
}

function describeBeats(beats: number, bpm: number): string {
  const seconds = beatsToSeconds(beats, bpm);
  return `${beats} beats at ${bpm} bpm is ${seconds.toFixed(1)}s`;
}

export function convertSceneBeatTimes(
  scene: DirectorSceneInput,
  bpm: number
): DirectorSceneInput {
  let converted: DirectorSceneInput = scene;
  const mutate = () => {
    if (converted === scene) converted = { ...scene };
    return converted as DirectorSceneInput & Record<string, unknown>;
  };

  if (scene.durationBeats !== undefined) {
    const seconds = beatsToSeconds(scene.durationBeats, bpm);
    if (seconds < 1 || seconds > 60) {
      throw new Error(
        `Scene "${scene.id}": ${describeBeats(scene.durationBeats, bpm)} — scenes run 1-60 seconds.`
      );
    }
    const target = mutate();
    delete target.durationBeats;
    target.durationSeconds = seconds;
  }

  if (scene.transition?.durationBeats !== undefined) {
    const seconds = beatsToSeconds(scene.transition.durationBeats, bpm);
    if (seconds > 3) {
      throw new Error(
        `Scene "${scene.id}": transition ${describeBeats(scene.transition.durationBeats, bpm)} — transitions top out at 3 seconds.`
      );
    }
    const target = mutate();
    target.transition = convertDuration(scene.transition, bpm);
  }

  if (scene.performance) {
    const performance = { ...scene.performance };
    let performanceChanged = false;

    if (performance.blocking?.durationBeats !== undefined) {
      performance.blocking = convertDuration(performance.blocking, bpm);
      performanceChanged = true;
    }

    const convertMoves = <
      T extends { blocking?: readonly BeatTimed[] } | undefined,
    >(
      owner: T
    ): T => {
      if (!owner?.blocking?.some((move) => move.durationBeats !== undefined)) {
        return owner;
      }
      return {
        ...owner,
        blocking: owner.blocking.map((move) => convertDuration(move, bpm)),
      };
    };

    if (performance.performers) {
      const next = performance.performers.map((performer) =>
        convertMoves(performer)
      );
      if (next.some((performer, i) => performer !== performance.performers![i])) {
        performance.performers = next;
        performanceChanged = true;
      }
    }
    if (performance.cast) {
      const cast = { ...performance.cast };
      let castChanged = false;
      const defaults = convertMoves(cast.defaults);
      if (defaults !== cast.defaults) {
        cast.defaults = defaults;
        castChanged = true;
      }
      if (cast.performers) {
        const next = cast.performers.map((performer) => convertMoves(performer));
        if (next.some((performer, i) => performer !== cast.performers![i])) {
          cast.performers = next;
          castChanged = true;
        }
      }
      if (castChanged) {
        performance.cast = cast;
        performanceChanged = true;
      }
    }

    if (performanceChanged) mutate().performance = performance;
  }

  if (scene.camera) {
    const camera = { ...scene.camera };
    let cameraChanged = false;

    if (camera.moves?.some((move) => move.durationBeats !== undefined)) {
      camera.moves = camera.moves.map((move) => convertDuration(move, bpm));
      cameraChanged = true;
    }
    if (camera.keyframes?.some((frame) => frame.atBeats !== undefined)) {
      camera.keyframes = camera.keyframes.map((frame) => {
        if (frame.atBeats === undefined) return frame;
        const { atBeats, ...rest } = frame;
        return { ...rest, atSeconds: beatsToSeconds(atBeats, bpm) };
      });
      cameraChanged = true;
    }

    if (cameraChanged) mutate().camera = camera;
  }

  return converted;
}
```

NOTE: this code reads `durationBeats`/`atBeats` off schema types that do not
carry them until Task 4. Implement Tasks 3 and 4 together if the intermediate
type errors block the test run, but keep the commits separate as written.

- [x] **Step 4: Run the tests**

Run: `npx vitest run tests/unit/film-director/director-beat-times.test.ts`
Expected: PASS (if types block compilation before Task 4's schema fields
exist, proceed to Task 4 and come back — the two tasks' tests must both pass
before either commit).

- [x] **Step 5: Commit**

```bash
git commit -m "feat(film-director): beat-to-seconds converter for scene inputs" -- src/routes/test/film-director/_lib/director-beat-times.ts tests/unit/film-director/director-beat-times.test.ts
```

---

### Task 4: Beats fields in the schema + version 4 (Gap 1, grammar)

**Files:**
- Modify: `src/routes/test/film-director/_lib/film-director-schema.ts`
- Modify: `src/routes/test/film-director/_lib/director-camera-track.ts` (keyframe seconds guard)
- Test: `tests/unit/film-director/film-director-schema.test.ts` (extend)

- [x] **Step 1: Write the failing schema tests**

Add to `film-director-schema.test.ts`, following its existing fixture helpers
(read the file first; it has minimal-film builders):

```ts
describe("beats as a time unit", () => {
  it("accepts version 4", () => {
    // minimal valid film with version: 4 parses
  });

  it("accepts durationBeats on a scene and rejects both units at once", () => {
    // { durationBeats: 16 } parses; { durationSeconds: 8, durationBeats: 16 }
    // fails with a message matching /exactly one of/i
  });

  it("accepts durationBeats on transitions, blocking moves, scene blocking, and camera moves", () => {
    // one fixture with all four; parses
  });

  it("rejects stating both units on a transition, a blocking move, a scene blocking, or a camera move", () => {
    // each of the four both-stated shapes fails with /exactly one of/i
  });

  it("accepts atBeats on a camera keyframe and demands exactly one time unit", () => {
    // { atBeats: 8, position } parses; { atSeconds: 1, atBeats: 8, position }
    // fails; { position } alone fails
  });
});
```

Concrete bodies, real fixtures — the sketches above name the required
assertions.

- [x] **Step 2: Run to verify they fail**

Run: `npx vitest run tests/unit/film-director/film-director-schema.test.ts`
Expected: FAIL — unknown keys on strict objects.

- [x] **Step 3: Implement the schema fields**

In `film-director-schema.ts`:

1. Version: add `export const FILM_DIRECTOR_SCHEMA_VERSION_4 = 4 as const;`,
   add `z.literal(FILM_DIRECTOR_SCHEMA_VERSION_4)` to the version union, and
   add `| typeof FILM_DIRECTOR_SCHEMA_VERSION_4` to
   `ResolvedFilmDirectorSpec["version"]`.

2. A tiny shared refinement helper near the top (after `finiteNumber`):

```ts
const oneTimeUnit = (
  value: { durationSeconds?: number; durationBeats?: number },
  ctx: z.RefinementCtx
) => {
  if (value.durationSeconds !== undefined && value.durationBeats !== undefined) {
    ctx.addIssue({
      code: "custom",
      message: 'State exactly one of "durationSeconds" or "durationBeats".',
    });
  }
};
```

3. `transitionSchema`: add `durationBeats: finiteNumber.min(0).max(32).optional(),`
   and append `.superRefine(oneTimeUnit)`.

4. `sceneSchema`: add `durationBeats: finiteNumber.positive().max(240).optional(),`
   and append `.superRefine(oneTimeUnit)` after `.strict()`.

5. `blockingMoveSchema`: add `durationBeats: finiteNumber.positive().optional(),`
   and append `.superRefine(oneTimeUnit)`.

6. `sceneBlockingSchema`: add `durationBeats: finiteNumber.positive().optional(),`
   and append `.superRefine(oneTimeUnit)`.

7. The camera move object inside `cameraSchema`'s `moves` array: add
   `durationBeats: finiteNumber.positive().optional(),` and append
   `.superRefine(oneTimeUnit)`.

8. `cameraKeyframeSchema`: change `atSeconds` to
   `atSeconds: finiteNumber.nonnegative().optional(),`, add
   `atBeats: finiteNumber.nonnegative().optional(),`, and append:

```ts
.superRefine((frame, ctx) => {
  if ((frame.atSeconds !== undefined) === (frame.atBeats !== undefined)) {
    ctx.addIssue({
      code: "custom",
      message: 'A camera keyframe states exactly one of "atSeconds" or "atBeats".',
    });
  }
})
```

9. In `director-camera-track.ts`, the raw-keyframe path reads
   `frame.atSeconds`, which is now optional in the type. Add a one-seam guard
   where the keyframes are mapped:

```ts
const atSeconds = frame.atSeconds;
if (atSeconds === undefined) {
  throw new Error(
    "Camera keyframes must be converted to seconds before resolution — convertSceneBeatTimes was skipped."
  );
}
```

   and use `atSeconds` in the `keyframe(...)` call. This is defensive: after
   Task 5 wires the converter, resolution can never see an unconverted frame.

- [x] **Step 4: Run schema tests + the Task 3 tests together**

Run: `npx vitest run tests/unit/film-director/film-director-schema.test.ts tests/unit/film-director/director-beat-times.test.ts`
Expected: PASS both.

- [x] **Step 5: Commit**

```bash
git commit -m "feat(film-director): durationBeats/atBeats grammar, schema v4" -- src/routes/test/film-director/_lib/film-director-schema.ts src/routes/test/film-director/_lib/director-camera-track.ts tests/unit/film-director/film-director-schema.test.ts
```

---

### Task 5: Wire the converter into resolveScene (Gap 1, resolution)

**Files:**
- Modify: `src/routes/test/film-director/_lib/resolve-film-director-spec.ts`
- Test: `tests/unit/film-director/resolve-directive-spec.test.ts` (extend)

- [x] **Step 1: Write the failing end-to-end tests**

Add to `resolve-directive-spec.test.ts` (reuse its minimal-film fixtures):

```ts
describe("beats resolve through the scene bpm", () => {
  it("a 16-beat scene at 120 bpm resolves to 8 seconds", () => {
    // film with one scene: { durationBeats: 16, performance: { bpm: 120 } }
    // → resolved.scenes[0].durationSeconds === 8 and
    //   resolved.durationSeconds === 8
  });

  it("beats-stated camera moves land their keyframes on the beat", () => {
    // scene: durationBeats 16, bpm 120, camera { shotSize: "medium",
    //   moves: [{ move: "push-in", durationBeats: 8 }, { move: "hold" }] }
    // → the push-in's arrival keyframe sits at atSeconds 4 (± 1e-6), and the
    //   final keyframe at 8.
  });

  it("beats-stated blocking arrives on the beat", () => {
    // scene: durationBeats 16, bpm 120, one performer with
    //   blocking: [{ move: "walk", to: { x: 1.5, z: 0 }, durationBeats: 8 },
    //              { move: "stand" }]
    // → the walk's arrival blocking keyframe sits at atSeconds 4.
  });

  it("a beats-stated scene with no bpm converts at the default 90", () => {
    // scene: { durationBeats: 12 } → resolved durationSeconds 8.
  });

  it("a beat-count that converts past the scene ceiling rejects speaking beats", () => {
    // { durationBeats: 96, performance: { bpm: 66 } } → throws /96 beats at 66 bpm/
  });
});
```

Concrete bodies against the file's fixtures.

- [x] **Step 2: Run to verify they fail**

Run: `npx vitest run tests/unit/film-director/resolve-directive-spec.test.ts`
Expected: the new tests FAIL (beats fields parse but are silently ignored —
scene falls back to the 8s default).

- [x] **Step 3: Wire the converter**

In `resolve-film-director-spec.ts`:

```ts
import { convertSceneBeatTimes } from "./director-beat-times";
```

At the top of `resolveScene`, replace:

```ts
const durationSeconds = scene.durationSeconds ?? 8;
```

with:

```ts
// Beats convert against the scene's own bpm, so bpm resolves first; every
// line below this one thinks purely in seconds.
const bpm = rawScene.performance?.bpm ?? 90;
const scene = convertSceneBeatTimes(rawScene, bpm);
const durationSeconds = scene.durationSeconds ?? 8;
```

(rename the function's parameter from `scene` to `rawScene`), and change the
existing `bpm: scene.performance?.bpm ?? 90` line in the returned
`performance` object to `bpm,` so the two reads cannot drift.

- [x] **Step 4: Run the FULL film-director suite including snapshots**

Run: `npx vitest run tests/unit/film-director`
Expected: PASS everywhere. The Task 1 snapshots must be UNCHANGED (no library
film states beats) — if any snapshot churns, the wiring changed seconds-stated
behavior and must be fixed, not re-snapshotted.

- [x] **Step 5: Commit**

```bash
git commit -m "feat(film-director): resolve beats through the scene bpm" -- src/routes/test/film-director/_lib/resolve-film-director-spec.ts tests/unit/film-director/resolve-directive-spec.test.ts
```

---

### Task 6: Proving Grounds film + capability matrix

**Files:**
- Create: `src/routes/test/film-director/_films/proving-grounds.ts`
- Modify: `src/routes/test/film-director/_films/index.ts`
- Modify: `docs/reference/film-director-capability-matrix.md`
- Test: `tests/unit/film-director/film-library.test.ts` (extend with behavior assertions)

- [x] **Step 1: Author the film**

`proving-grounds.ts` — version 4, id `proving-grounds-r1`, two scenes (one per
wave-1 gap; later waves append scenes). Follow the authorial idiom of
`_films/ember.ts` (typed film const + doc comments explaining what each scene
proves; import the film type the way ember does — read ember.ts first):

Scene 1, id `combined-draw`, title "Combined Draw", intent
"Gap 9: three performers draw DISTINCT blue planes and DISTINCT red planes,
and none of the six is ever the wall plane." Duration 12 (seconds), bpm 90,
environment `forest`, formation `line`, cast count 3 with defaults:
`bluePlane: { pick: "distinct", not: "wall" }`,
`redPlane: { pick: "distinct", not: "wall" }`, effect `"none"`,
`location.visiblePlanes` listing all planes the draw can land on —
`["wheel", "floor", "right-shield", "left-shield", "forward-ramp", "backward-ramp", "right-wing", "left-wing"]`
— so the drawn planes are visible as scenery grids in the frame. Camera: wide,
eye, front, hold.

Scene 2, id `on-the-beat`, title "On the Beat", intent
"Gap 1: everything here is counted, nothing timed — a 16-beat scene at 120 bpm
(8s), the camera pushes in for exactly 8 beats then holds 8, and the walker
crosses on an 8-beat phrase." `durationBeats: 16`, bpm 120, transition
`{ kind: "cut" }`, environment `cosmic`, formation `side-by-side`, cast count
2, performer-2 override:
`blocking: [{ move: "walk", to: { x: 1.5, z: -1 }, durationBeats: 8, facing: "travel" }, { move: "stand" }]`.
Camera: `shotSize: "medium"`, `angle: "eye"`, `position: "front"`,
`moves: [{ move: "push-in", amount: { meters: 1.5 }, durationBeats: 8 }, { move: "hold", durationBeats: 8 }]`.

Verify the walk speed is legal: distance from performer-2's side-by-side slot
to (1.5, -1) over 4 seconds must be ≤ 2.6 m/s and ≥ ~0.5 m/s — print the
slot position in a scratch test or compute from `createFormationFromPreset`
and adjust the destination if not.

Registry entry in `_films/index.ts` (append, matching existing entries):

```ts
{
  key: "proving",
  label: "Proving Grounds",
  film: provingGroundsFilm,
  poster: {
    src: "/films/posters/proving.webp",
    sceneId: "combined-draw",
    offsetSeconds: 6,
  },
},
```

- [x] **Step 2: Extend film-library.test.ts with proving-grounds behavior checks**

Following the "Nine Planes actually exercises..." pattern:

```ts
it("Proving Grounds exercises the gaps it advertises", () => {
  const proving = FILM_LIBRARY.find((entry) => entry.key === "proving")!;
  const resolved = resolveFilmDirectorSpec(proving.film);

  const combined = resolved.scenes.find((s) => s.id === "combined-draw")!;
  const blues = combined.performance.performers.map((p) => p.bluePlane);
  const reds = combined.performance.performers.map((p) => p.redPlane);
  expect(new Set(blues).size).toBe(blues.length);
  expect(new Set(reds).size).toBe(reds.length);
  expect(blues).not.toContain("wall");
  expect(reds).not.toContain("wall");

  const onBeat = resolved.scenes.find((s) => s.id === "on-the-beat")!;
  expect(onBeat.durationSeconds).toBe(8);
  const pushArrival = onBeat.camera.keyframes.find(
    (frame) => Math.abs(frame.atSeconds - 4) < 1e-6
  );
  expect(pushArrival).toBeDefined();
  const walker = onBeat.performance.performers[1]!;
  const arrival = walker.blocking.find(
    (frame) => Math.abs(frame.atSeconds - 4) < 1e-6
  );
  expect(arrival).toBeDefined();
  expect(arrival!.position).toEqual({ x: 1.5, z: -1 });
});
```

- [x] **Step 3: Run the full film-director suite**

Run: `npx vitest run tests/unit/film-director`
Expected: everything PASSES except ONE test:
`"Proving Grounds" ... has a baked poster` fails with "proving.webp is
missing". That is the only allowed red — the poster is baked by the main
session after this task (it needs a browser). If anything else is red, fix it.
The snapshot test now writes ONE new snapshot (proving-grounds) — commit it.

- [x] **Step 4: Update the capability matrix**

In `docs/reference/film-director-capability-matrix.md`:
- Header version "(v3)" → "(v4)".
- Directive-grammar section: document the combined spelling
  `{ pick: "any" | "distinct", from?, not? }` — one line noting `not` composes
  with both picks, and scene-scoped axes still reject `distinct`.
- Time rows: wherever the matrix documents `durationSeconds` (scene,
  transition, blocking move, scene blocking, camera move) note the
  `durationBeats` twin and the rule "beats convert at the scene's own bpm
  (default 90); state exactly one unit per field". Document keyframe `atBeats`
  beside `atSeconds`.
- Do NOT touch the `<!-- directive-axes: ... -->` comment — no new axis.

- [x] **Step 5: Commit**

```bash
git commit -m "feat(film-director): Proving Grounds film exercises wave-1 gaps" -- src/routes/test/film-director/_films/proving-grounds.ts src/routes/test/film-director/_films/index.ts tests/unit/film-director/film-library.test.ts tests/unit/film-director/__snapshots__/film-resolution-snapshot.test.ts.snap docs/reference/film-director-capability-matrix.md
```

---

## Final gate (run before reporting done)

Run: `npx vitest run tests/unit/film-director`
Report the exact totals. Expected: all green except the single proving-poster
test. Then run `npx tsc --noEmit -p .` ONLY if the repo has a root tsconfig
suitable for it — otherwise skip (svelte-check is the repo's checker and the
main session runs it; do not start one yourself if another is running
machine-wide).

Report back: per-task commit SHAs, the final test totals, and any deviation
from this plan with its reason.

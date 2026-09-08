# Film Director Gap 2 — Per-Step Changes (`stepEffects`, `stepEfforts`, `holds`)

> Executor plan. Worktree: `E:\worktrees\tka-platform\director-gaps`, branch
> `claude/director-gaps`. Campaign ledger:
> `docs/superpowers/plans/2026-08-30-film-director-gap-campaign.md` (Gap 2, line 118).

**Goal:** a director can change what a performer carries partway through a
scene, and can stop one performer's prop phrase for a stated number of steps
while the rest of the cast keeps counting:

```jsonc
{
  "id": "performer-1",
  "stepEffects": [
    { "step": 0, "effect": "none" },
    { "step": 4, "effect": "trails" },
    { "step": 8, "effect": "fire" }
  ],
  "stepEfforts": [{ "step": 8, "effort": "punch" }]
}
{
  "id": "performer-2",
  "holds": [{ "fromStep": 4, "steps": 4 }]
}
```

**Architecture.** `stepEffects` and `stepEfforts` copy `stepPlanes` exactly:
an array of `{step, <axis>}` entries on `performerSchema` and
`castDefaultsSchema`, each value a scene-scope directive (literal, `pick:"any"`,
`oneOf`, `not`; `distinct`/`sameAs` rejected with the same message shape),
resolved next to `resolveStepPlanesForPerformer` on new seed axes `stepEffect`
and `stepEffort`, landing on the resolved performer as `stepEffects` and
`stepEfforts`. A performer's own list replaces the cast-default list rather
than merging with it.

The runtime half is where this gap differs from `stepPlanes`.
`character-instance-state.svelte.ts` has `setStepHandPlane`, a per-step setter,
so `stepPlanes` applies once at scene apply. There is no per-step setter for
effect or effort: `setEffect` and `setEffort` set the whole performer. So the
film applies them per frame, writing only on change, from a last-applied map
that resets when a scene is applied.

`holds` is literal-only and is a pure remap of one performer's playhead. The
viewer already owns the seam: `performerSteps` (host override, honoured by
`resolvePerformerStepSource`) beats the shared clock outright for any performer
the host supplies a number for. Nothing in the viewer changes.

Schema version stays **5**. Every addition is optional.

**Test command:**
`node node_modules/vitest/vitest.mjs run --config tests/config/vitest.config.ts tests/unit/film-director`
(`-u` only in Task 6's snapshot step.)

---

## Research this plan rests on (verified 2026-09-02 by reading the files)

- `film-director-schema.ts:36-47` `FILM_DIRECTOR_DIRECTIVE_AXES` currently ends
  `..., "leftPlane", "rightPlane", "stepPlane"`. `capability-matrix.test.ts`
  asserts the doc's `<!-- directive-axes: ... -->` comment equals this list,
  sorted.
- `film-director-schema.ts:254-264` `stepPlaneEntrySchema`; `:615-633`
  `performerSchema` (`stepPlanes` at `:631`); `:635-648` `castDefaultsSchema`
  (`stepPlanes` at `:646`); `:955-959` `ResolvedDirectorStepPlane`; `:961-980`
  `ResolvedDirectorPerformer` (`stepPlanes` at `:979`).
- `film-director-schema.ts:202-208` `effectIdSchema` accepts `"none"` plus every
  `EFFECTS` id. `:113-119` `effortIdSchema` refines against
  `DIRECTOR_EFFORT_IDS` (`:75-84`: `linear, glide, dab, press, punch, elastic,
  bounce, anticipation`). Effect ids in the registry
  (`effect-registry.ts:56-75`): `trails, fire, led, charcoal, zap, sparkles,
  ghost, bloom, goo, bubbles, petals, smoke, ink, silk, animal, pulse`.
- `resolve-film-director-spec.ts:214-239` `resolveSceneDirective` with its
  `streamKey` parameter; `:248-277` `resolveStepPlanesForPerformer`;
  `:123-139` `ResolvedPerformerFields`; `:496` and `:728` where `stepPlanes`
  is carried through; `:661-675` the replace-not-merge comment and lookup.
  Catalogs already at module scope: `EFFECT_CATALOG` (`:108-111`, `"none"` plus
  the registry ids) and `EFFORT_CATALOG` (`:112`).
- Base per-performer defaults: `resolve-film-director-spec.ts:545-550` —
  `effect` defaults to `"none"`, `effort` to `"linear"`.
- `director-viewer-adapter.ts:123-152` — the scene-apply loop calls
  `performer.setEffect(directed.effect, { equipBuild: false })` and
  `performer.setEffort(directed.effort)` once per scene, then loads the
  sequence, then the planes. `:203-219` `applyDirectorPerformerMotion` reaches
  performers through `viewer.performerManager.performers`.
- `character-instance-state.svelte.ts:954-966` `setEffort(effortId)` and
  `:1006-1051` `setEffect(effect, options)`. **Both push an undo entry
  unconditionally** (`sceneUndo.pushSelfRestoringEntry`, manager obtained at
  `:913`). There is no existing suppression option anywhere in
  `scene-undo-manager.ts`. Task 5 adds one. The module's public surface is
  `ReturnType<typeof createCharacterInstanceState>` (`:1473-1475`), so an extra
  optional parameter needs no interface edit. Callers today:
  `EffectsSettingsPanel.svelte:164,183`, `EffortPopover.svelte:29`,
  `PerformerHubDetail.svelte:336`, and the adapter — none pass the new option.
- `performer-step-timing.ts:30-43` `resolvePerformerStepSource(hostStep,
  sharedStep, beatOffset, totalSteps)`: a finite `hostStep` wins outright and is
  wrapped by `((hostStep % totalSteps) + totalSteps) % totalSteps`.
- **The host override already carries a fraction.** `Viewer3DScene.svelte:398-410`
  does `const performerBeat = Math.floor(performerStep); p.goToStep(performerBeat);
  p.setProgress(performerStep - performerBeat);`, and the JS `%` operator keeps
  the fractional part, so a fractional `performerSteps[i]` pins step and progress
  together. `StageModule.svelte:183-191` already passes `stepIndex + progress`
  through this seam. **No viewer change is needed for holds, and the plan's
  contingency extension (a parallel `performerStepProgress` prop) is not
  required.** Every `performerSteps` consumer:
  `StageModule.svelte:802`, `Viewer3DCanvas.svelte:127,184,582`,
  `Viewer3DFullscreen.svelte:65,121,271`, `Viewer3DScene.svelte:142,195,402,795`.
  `FilmDirectorScene.svelte` passes nothing today; adding the prop is additive.
- `sample-film-director.ts:143-146` — `frame.sequenceStep` is
  `sceneTimeSeconds * bpm / 60`, already fractional and unwrapped;
  `frame.performerStepOffsets` is each performer's `beatOffset`.
  `FilmDirectorScene.svelte:102-108` maps that into `presentedStepOffsets`,
  passed at `:487`; `frame.sequenceStep` is passed as `currentStep` at `:474-476`.
- `FilmDirectorScene.svelte:192-204` `applyScene`; `:446-456` the two existing
  per-frame `$effect`s that write camera and motion into the viewer.
- Proving Grounds has **six** scenes as of `7577d4cbed`: `combined-draw`,
  `on-the-beat`, `camera-edges`, `tracking-shot`, `three-shots`,
  `derived-sequences`. Read the file at execution time and append after the
  last scene, whatever it is by then.
- `film-resolution-snapshot.test.ts.snap` contains 151 `"stepPlanes"` lines, one
  per resolved performer across the whole library.
- `directive-corpus/corpus-runner.test.ts:14-36` requires ≥ 25 entries per
  category. Adding a corpus category for these axes is out of scope (see the
  closing section).

---

## Grammar (what a director writes)

```jsonc
// Per-step effect. Scene-scope directive per entry, same as stepPlanes.
"stepEffects": [
  { "step": 0,  "effect": "none" },
  { "step": 4,  "effect": "trails" },
  { "step": 8,  "effect": { "pick": "any", "not": ["fire"] } },
  { "step": 12, "effect": { "oneOf": ["goo", "ink"] } }
]

// Per-step effort. Same shape.
"stepEfforts": [{ "step": 8, "effort": "punch" }]

// Time stops for this performer's prop phrase.
"holds": [{ "fromStep": 4, "steps": 4 }]
```

Rules:

- An entry's `step` is an integer ≥ 0 in that performer's own step numbering.
- Two entries naming the same step reject by name.
- `"none"` is a legal effect literal, exactly as it is for `effect`.
- `distinct` and `sameAs` reject on an entry: the value is pinned to one
  (performer, step) pair, so there is no cast to be distinct across.
- A performer's own `stepEffects` / `stepEfforts` / `holds` list REPLACES the
  cast-default list. It does not merge.
- `holds` is literal only. It takes no directive.
- Holds that overlap reject by name. Order in the list does not matter.

**Hold semantics.** Time stops for that performer's prop phrase. While the
shared clock, after the performer's `beatOffset`, is inside
`[fromStep, fromStep + steps)`, the performer is pinned to `fromStep` at
progress 0. Afterwards they resume from `fromStep`, so every later step lags by
`steps`, accumulated across multiple holds. Blocking is authored geometry and is
NOT paused by a hold: a performer who holds while walking keeps walking.

**Holds and per-step changes compose through the effective step.** The effect
and effort lookup reads the HELD step, so an entry scheduled at a held step
applies for the whole hold.

---

## File map

| File | Change |
| --- | --- |
| `src/routes/test/film-director/_lib/film-director-schema.ts` | Two entry schemas, one hold schema, three performer/cast fields, two axis names, two resolved types, three resolved-performer fields. |
| `src/routes/test/film-director/_lib/resolve-film-director-spec.ts` | Two resolvers beside `resolveStepPlanesForPerformer`, hold validation, replace-not-merge wiring. |
| `src/routes/test/film-director/_lib/director-step-changes.ts` (new) | `resolveStepChange` — the value in force at a step. |
| `src/routes/test/film-director/_lib/director-step-holds.ts` (new) | `resolveHeldStep` — the playhead remap. |
| `src/lib/shared/3d/state/character-instance-state.svelte.ts` | `recordUndo` option on `setEffect` and `setEffort`. |
| `src/routes/test/film-director/_lib/director-viewer-adapter.ts` | `applyDirectorStepChanges`. |
| `src/routes/test/film-director/_components/FilmDirectorScene.svelte` | Held-step derived, `performerSteps` prop, per-frame step-change effect, map reset in `applyScene`. |
| `src/routes/test/film-director/_films/proving-grounds.ts` | Scene `per-step-changes`, header paragraph, brief sentence. |
| `docs/reference/film-director-capability-matrix.md` | Two directive rows, one literal row, the axes comment, the stepPlanes paragraph, a Grammar-gaps bullet. |
| Tests | `plane-axes.test.ts` sibling assertions, `film-director-schema.test.ts`, new `step-changes.test.ts`, new `step-holds.test.ts`, `film-library.test.ts`, snapshot. |

---

### Task 1: Schema

**Files:** Modify `src/routes/test/film-director/_lib/film-director-schema.ts`;
Test `tests/unit/film-director/film-director-schema.test.ts`.

- [ ] **Step 1: Write the failing tests.** Read the top of
  `film-director-schema.test.ts` first and reuse whatever film/scene helper the
  existing `stepPlanes` parse tests (around lines 181 and 210) use. Append:

```ts
describe("per-step changes: stepEffects, stepEfforts, holds", () => {
  it("accepts a step effect list, a step effort list, and holds", () => {
    const parsed = parse(
      film({
        performance: {
          cast: {
            count: 2,
            performers: [
              {
                id: "performer-1",
                stepEffects: [
                  { step: 0, effect: "none" },
                  { step: 4, effect: "trails" },
                ],
                stepEfforts: [{ step: 8, effort: "punch" }],
              },
              { id: "performer-2", holds: [{ fromStep: 4, steps: 4 }] },
            ],
          },
        },
      })
    );
    const cast = parsed.scenes[0]!.performance.cast!.performers!;
    expect(cast[0]!.stepEffects).toEqual([
      { step: 0, effect: "none" },
      { step: 4, effect: "trails" },
    ]);
    expect(cast[0]!.stepEfforts).toEqual([{ step: 8, effort: "punch" }]);
    expect(cast[1]!.holds).toEqual([{ fromStep: 4, steps: 4 }]);
  });

  it("accepts the same three lists on cast defaults", () => {
    const parsed = parse(
      film({
        performance: {
          cast: {
            count: 2,
            defaults: {
              stepEffects: [{ step: 2, effect: { pick: "any", not: ["fire"] } }],
              stepEfforts: [{ step: 2, effort: { oneOf: ["punch", "dab"] } }],
              holds: [{ fromStep: 0, steps: 2 }],
            },
          },
        },
      })
    );
    expect(parsed.scenes[0]!.performance.cast!.defaults!.holds).toEqual([
      { fromStep: 0, steps: 2 },
    ]);
  });

  it("rejects an unknown effect on a step entry", () => {
    expect(() =>
      parse(
        film({
          performance: {
            cast: {
              count: 1,
              performers: [
                { id: "a", stepEffects: [{ step: 0, effect: "glitter" }] },
              ],
            },
          },
        })
      )
    ).toThrow(/Unknown effect "glitter"/);
  });

  it("rejects an unknown effort on a step entry", () => {
    expect(() =>
      parse(
        film({
          performance: {
            cast: {
              count: 1,
              performers: [
                { id: "a", stepEfforts: [{ step: 0, effort: "swagger" }] },
              ],
            },
          },
        })
      )
    ).toThrow(/Unknown effort "swagger"/);
  });

  it("rejects a negative step and a fractional step", () => {
    for (const step of [-1, 1.5]) {
      expect(() =>
        parse(
          film({
            performance: {
              cast: {
                count: 1,
                performers: [
                  { id: "a", stepEffects: [{ step, effect: "trails" }] },
                ],
              },
            },
          })
        )
      ).toThrow();
    }
  });

  it("rejects a hold of zero steps and a negative fromStep", () => {
    expect(() =>
      parse(
        film({
          performance: {
            cast: {
              count: 1,
              performers: [{ id: "a", holds: [{ fromStep: 0, steps: 0 }] }],
            },
          },
        })
      )
    ).toThrow(/at least one step/);
    expect(() =>
      parse(
        film({
          performance: {
            cast: {
              count: 1,
              performers: [{ id: "a", holds: [{ fromStep: -1, steps: 2 }] }],
            },
          },
        })
      )
    ).toThrow();
  });

  it("rejects an unknown key inside a hold", () => {
    expect(() =>
      parse(
        film({
          performance: {
            cast: {
              count: 1,
              performers: [
                { id: "a", holds: [{ fromStep: 0, steps: 2, beats: 4 }] },
              ],
            },
          },
        })
      )
    ).toThrow();
  });
});
```

- [ ] **Step 2: Run to verify failure.**

Run: `node node_modules/vitest/vitest.mjs run --config tests/config/vitest.config.ts tests/unit/film-director/film-director-schema.test.ts`
Expected: FAIL — `performerSchema` is `.strict()`, so `stepEffects` is an
unrecognized key.

- [ ] **Step 3: Implement.** In `film-director-schema.ts`, extend the axis list
  at `:36-47`. Keep the existing order and append:

```ts
export const FILM_DIRECTOR_DIRECTIVE_AXES = [
  "characterId",
  "prop",
  "effect",
  "effort",
  "staffLengthCm",
  "environmentId",
  "formation",
  "leftPlane",
  "rightPlane",
  "stepPlane",
  "stepEffect",
  "stepEffort",
] as const;
```

Directly after `stepPlaneEntrySchema` (ends `:264`, before
`cameraTargetSchema` at `:266`) add:

```ts
// Per-step effect and effort are scene-scope directives for the same reason
// stepPlanes is: the value is pinned to one (performer, step) pair, so
// distinct has no cast to spread across and sameAs has no matching pair to
// copy from. Unlike a plane there is no hand — an effect and an effort are
// carried by the whole performer.
const stepEffectEntrySchema = z
  .object({
    step: z.number().int().min(0),
    effect: directiveSchema(effectIdSchema),
  })
  .strict();

const stepEffortEntrySchema = z
  .object({
    step: z.number().int().min(0),
    effort: directiveSchema(effortIdSchema),
  })
  .strict();

/**
 * Time stops for one performer's prop phrase. Literal only: a hold is a
 * statement about this performer's clock, and there is no catalog of holds to
 * draw one from. `fromStep` is where the phrase freezes; `steps` is how long
 * it stays frozen, in the same counts the rest of the cast keeps dancing.
 * Overlap is checked at resolve time, where the scene and performer are known
 * and the rejection can name them.
 */
const holdSchema = z
  .object({
    fromStep: z.number().int().min(0),
    steps: z
      .number()
      .int()
      .min(1, { error: "A hold lasts at least one step." }),
  })
  .strict();
```

Add three fields to `performerSchema`, immediately after `stepPlanes` (`:631`):

```ts
    stepEffects: z.array(stepEffectEntrySchema).optional(),
    stepEfforts: z.array(stepEffortEntrySchema).optional(),
    holds: z.array(holdSchema).max(16).optional(),
```

Add the identical three lines to `castDefaultsSchema` after `stepPlanes`
(`:646`).

Add the resolved types beside `ResolvedDirectorStepPlane` (`:955-959`):

```ts
export interface ResolvedDirectorStepEffect {
  step: number;
  effect: EffectType;
}

export interface ResolvedDirectorStepEffort {
  step: number;
  effort: EffortId;
}

export interface ResolvedDirectorHold {
  fromStep: number;
  steps: number;
}
```

And three fields on `ResolvedDirectorPerformer`, immediately after
`stepPlanes` (`:979`) so the snapshot's new lines land in one place:

```ts
  stepPlanes: ResolvedDirectorStepPlane[];
  stepEffects: ResolvedDirectorStepEffect[];
  stepEfforts: ResolvedDirectorStepEffort[];
  holds: ResolvedDirectorHold[];
```

- [ ] **Step 4: Run** the schema test file. Expected: PASS. The full folder
  will still fail at the resolver (the new resolved fields are not produced
  yet) — that is Task 2.

- [ ] **Step 5: Commit**

```bash
git commit -m "feat(film-director): accept stepEffects, stepEfforts, and holds in the schema

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>" -- src/routes/test/film-director/_lib/film-director-schema.ts tests/unit/film-director/film-director-schema.test.ts
```

---

### Task 2: Resolver

**Files:** Modify `src/routes/test/film-director/_lib/resolve-film-director-spec.ts`;
Test `tests/unit/film-director/plane-axes.test.ts` (it already owns the
per-step-axis resolver assertions; add a sibling `describe`).

- [ ] **Step 1: Write the failing tests.** Append to `plane-axes.test.ts`,
  reusing its module-level `film()` helper (`:8-19`):

```ts
describe("per-step changes: stepEffects, stepEfforts, holds", () => {
  it("defaults every performer to three empty lists", () => {
    const spec = resolveFilmDirectorSpec(
      film({ performance: { cast: { count: 2 } } })
    );
    for (const performer of spec.scenes[0]!.performance.performers) {
      expect(performer.stepEffects).toEqual([]);
      expect(performer.stepEfforts).toEqual([]);
      expect(performer.holds).toEqual([]);
    }
  });

  it("resolves literal step effects and step efforts in the order written", () => {
    const spec = resolveFilmDirectorSpec(
      film({
        performance: {
          cast: {
            count: 1,
            performers: [
              {
                id: "performer-1",
                stepEffects: [
                  { step: 0, effect: "none" },
                  { step: 4, effect: "trails" },
                ],
                stepEfforts: [{ step: 8, effort: "punch" }],
              },
            ],
          },
        },
      })
    );
    const performer = spec.scenes[0]!.performance.performers[0]!;
    expect(performer.stepEffects).toEqual([
      { step: 0, effect: "none" },
      { step: 4, effect: "trails" },
    ]);
    expect(performer.stepEfforts).toEqual([{ step: 8, effort: "punch" }]);
  });

  it("resolves a pick on a step entry from the catalog and stays deterministic", () => {
    const doc = film({
      performance: {
        cast: {
          count: 1,
          performers: [
            {
              id: "performer-1",
              stepEffects: [{ step: 2, effect: { pick: "any", not: ["fire"] } }],
            },
          ],
        },
      },
    });
    const first = resolveFilmDirectorSpec(doc).scenes[0]!.performance
      .performers[0]!.stepEffects[0]!;
    const second = resolveFilmDirectorSpec(doc).scenes[0]!.performance
      .performers[0]!.stepEffects[0]!;
    expect(first.effect).not.toBe("fire");
    expect(second).toEqual(first);
  });

  it("gives each step entry its own draw rather than one draw reused", () => {
    const spec = resolveFilmDirectorSpec(
      film({
        performance: {
          cast: {
            count: 1,
            performers: [
              {
                id: "performer-1",
                stepEffects: [
                  { step: 0, effect: { pick: "any" } },
                  { step: 1, effect: { pick: "any" } },
                  { step: 2, effect: { pick: "any" } },
                  { step: 3, effect: { pick: "any" } },
                  { step: 4, effect: { pick: "any" } },
                  { step: 5, effect: { pick: "any" } },
                ],
              },
            ],
          },
        },
      })
    );
    const drawn = spec.scenes[0]!.performance.performers[0]!.stepEffects.map(
      (entry) => entry.effect
    );
    // Independent streams, not one value copied six times. Six draws from a
    // 17-value catalog landing on one value would be a collapsed stream.
    expect(new Set(drawn).size).toBeGreaterThan(1);
  });

  it("rejects distinct and sameAs on a step entry", () => {
    for (const value of [{ pick: "distinct" }, { sameAs: "performer-2" }]) {
      expect(() =>
        resolveFilmDirectorSpec(
          film({
            performance: {
              cast: {
                count: 2,
                performers: [
                  { id: "performer-1", stepEffects: [{ step: 0, effect: value }] },
                ],
              },
            },
          })
        )
      ).toThrow(
        /"stepEffect" supports literals, pick:any, oneOf, and not — distinct\/sameAs are performer-scoped\./
      );
    }
  });

  it("rejects two step entries naming the same step", () => {
    expect(() =>
      resolveFilmDirectorSpec(
        film({
          performance: {
            cast: {
              count: 1,
              performers: [
                {
                  id: "performer-1",
                  stepEffects: [
                    { step: 4, effect: "fire" },
                    { step: 4, effect: "trails" },
                  ],
                },
              ],
            },
          },
        })
      )
    ).toThrow(
      /Scene "s1": performer "performer-1" stepEffects names step 4 twice\./
    );
    expect(() =>
      resolveFilmDirectorSpec(
        film({
          performance: {
            cast: {
              count: 1,
              performers: [
                {
                  id: "performer-1",
                  stepEfforts: [
                    { step: 0, effort: "dab" },
                    { step: 0, effort: "punch" },
                  ],
                },
              ],
            },
          },
        })
      )
    ).toThrow(
      /Scene "s1": performer "performer-1" stepEfforts names step 0 twice\./
    );
  });

  it("rejects overlapping holds and names both", () => {
    expect(() =>
      resolveFilmDirectorSpec(
        film({
          performance: {
            cast: {
              count: 1,
              performers: [
                {
                  id: "performer-1",
                  holds: [
                    { fromStep: 6, steps: 2 },
                    { fromStep: 4, steps: 4 },
                  ],
                },
              ],
            },
          },
        })
      )
    ).toThrow(
      /Scene "s1": performer "performer-1" holds overlap: step 4 for 4 steps and step 6 for 2 steps\./
    );
  });

  it("accepts holds that touch without overlapping, sorted by where they start", () => {
    const spec = resolveFilmDirectorSpec(
      film({
        performance: {
          cast: {
            count: 1,
            performers: [
              {
                id: "performer-1",
                holds: [
                  { fromStep: 8, steps: 2 },
                  { fromStep: 4, steps: 4 },
                ],
              },
            ],
          },
        },
      })
    );
    expect(spec.scenes[0]!.performance.performers[0]!.holds).toEqual([
      { fromStep: 4, steps: 4 },
      { fromStep: 8, steps: 2 },
    ]);
  });

  it("replaces cast defaults rather than merging with them", () => {
    const spec = resolveFilmDirectorSpec(
      film({
        performance: {
          cast: {
            count: 2,
            defaults: {
              stepEffects: [{ step: 0, effect: "goo" }],
              stepEfforts: [{ step: 0, effort: "glide" }],
              holds: [{ fromStep: 0, steps: 2 }],
            },
            performers: [
              {
                id: "performer-1",
                stepEffects: [{ step: 6, effect: "ink" }],
                stepEfforts: [{ step: 6, effort: "punch" }],
                holds: [{ fromStep: 6, steps: 1 }],
              },
            ],
          },
        },
      })
    );
    const [first, second] = spec.scenes[0]!.performance.performers;
    expect(first!.stepEffects).toEqual([{ step: 6, effect: "ink" }]);
    expect(first!.stepEfforts).toEqual([{ step: 6, effort: "punch" }]);
    expect(first!.holds).toEqual([{ fromStep: 6, steps: 1 }]);
    expect(second!.stepEffects).toEqual([{ step: 0, effect: "goo" }]);
    expect(second!.stepEfforts).toEqual([{ step: 0, effort: "glide" }]);
    expect(second!.holds).toEqual([{ fromStep: 0, steps: 2 }]);
  });
});
```

- [ ] **Step 2: Run to verify failure.**

Run: `node node_modules/vitest/vitest.mjs run --config tests/config/vitest.config.ts tests/unit/film-director/plane-axes.test.ts`
Expected: FAIL — `performer.stepEffects` is `undefined`.

- [ ] **Step 3: Implement.** Import the three new resolved types from
  `./film-director-schema` alongside `ResolvedDirectorStepPlane`. Directly
  after `resolveStepPlanesForPerformer` (ends `:277`) add:

```ts
/**
 * Rejects two entries that address the same step. Directors write these lists
 * by hand and a duplicate is always a mistake: whichever entry the reader
 * believes is in force, the other one is dead text.
 */
function assertOneEntryPerStep(
  entries: readonly { step: number }[],
  field: string,
  performerId: string,
  sceneId: string
): void {
  const seen = new Set<number>();
  for (const entry of entries) {
    if (seen.has(entry.step)) {
      throw new Error(
        `Scene "${sceneId}": performer "${performerId}" ${field} names step ${entry.step} twice.`
      );
    }
    seen.add(entry.step);
  }
}

/**
 * Resolves one performer's effective stepEffects list. Each entry's value is a
 * scene-scoped directive on axis "stepEffect", so a single
 * `seed.axes.stepEffect` reroll reshuffles every stepEffects entry in the
 * film, while each (performer, step) pair still draws from its own stream via
 * a distinguishing streamKey — the same arrangement stepPlanes uses.
 */
function resolveStepEffectsForPerformer(
  entries: readonly { step: number; effect: DirectiveValue<string> }[],
  performerId: string,
  sceneId: string,
  seed: FilmSeed
): ResolvedDirectorStepEffect[] {
  assertOneEntryPerStep(entries, "stepEffects", performerId, sceneId);
  return entries.map((entry) => ({
    step: entry.step,
    effect: resolveSceneDirective<string>(
      entry.effect,
      "stepEffect",
      () => {
        throw new Error(
          `Scene "${sceneId}": stepEffects entry for "${performerId}" at step ${entry.step} is missing an effect.`
        );
      },
      sceneId,
      seed,
      EFFECT_CATALOG,
      // NUL-separated like createAxisStream's own key: authored ids may
      // contain spaces, so a space-joined key would be ambiguous.
      `${sceneId}\u0000${performerId}\u0000${entry.step}\u0000stepEffect`
    ) as EffectType,
  }));
}

/** The effort twin of resolveStepEffectsForPerformer, axis "stepEffort". */
function resolveStepEffortsForPerformer(
  entries: readonly { step: number; effort: DirectiveValue<EffortId> }[],
  performerId: string,
  sceneId: string,
  seed: FilmSeed
): ResolvedDirectorStepEffort[] {
  assertOneEntryPerStep(entries, "stepEfforts", performerId, sceneId);
  return entries.map((entry) => ({
    step: entry.step,
    effort: resolveSceneDirective<EffortId>(
      entry.effort,
      "stepEffort",
      () => {
        throw new Error(
          `Scene "${sceneId}": stepEfforts entry for "${performerId}" at step ${entry.step} is missing an effort.`
        );
      },
      sceneId,
      seed,
      EFFORT_CATALOG,
      `${sceneId}\u0000${performerId}\u0000${entry.step}\u0000stepEffort`
    ),
  }));
}

/**
 * Sorts a performer's holds by where they start and proves none overlaps the
 * next. Overlapping holds have no honest meaning: the lag the first one adds
 * would move the second one's window out from under the number the director
 * wrote.
 */
function resolveHoldsForPerformer(
  holds: readonly { fromStep: number; steps: number }[],
  performerId: string,
  sceneId: string
): ResolvedDirectorHold[] {
  const sorted = [...holds].sort((a, b) => a.fromStep - b.fromStep);
  for (let index = 1; index < sorted.length; index += 1) {
    const previous = sorted[index - 1]!;
    const current = sorted[index]!;
    if (current.fromStep < previous.fromStep + previous.steps) {
      throw new Error(
        `Scene "${sceneId}": performer "${performerId}" holds overlap: step ${previous.fromStep} for ${previous.steps} steps and step ${current.fromStep} for ${current.steps} steps.`
      );
    }
  }
  return sorted.map((hold) => ({ fromStep: hold.fromStep, steps: hold.steps }));
}
```

`DirectiveValue`, `FilmSeed`, `EffectType`, and `EffortId` are already imported
in this file (they carry the existing plane and effect resolvers) — confirm
rather than re-adding.

Next to the `resolvedStepPlanes` block (`:661-675`) add the three siblings,
keeping the replace-not-merge comment's reasoning:

```ts
  // Same replace-not-merge rule as stepPlanes above: naming a performer's
  // steps is dictation, not an addition to what the cast shares.
  const resolvedStepEffects: ResolvedDirectorStepEffect[][] = rawInputs.map(
    (input, index) =>
      resolveStepEffectsForPerformer(
        input.stepEffects ?? cast?.defaults?.stepEffects ?? [],
        performerIds[index]!,
        scene.id,
        filmSeed
      )
  );
  const resolvedStepEfforts: ResolvedDirectorStepEffort[][] = rawInputs.map(
    (input, index) =>
      resolveStepEffortsForPerformer(
        input.stepEfforts ?? cast?.defaults?.stepEfforts ?? [],
        performerIds[index]!,
        scene.id,
        filmSeed
      )
  );
  const resolvedHolds: ResolvedDirectorHold[][] = rawInputs.map(
    (input, index) =>
      resolveHoldsForPerformer(
        input.holds ?? cast?.defaults?.holds ?? [],
        performerIds[index]!,
        scene.id
      )
  );
```

Carry them through both hops. `ResolvedPerformerFields` (`:123-139`), after
`stepPlanes`:

```ts
  stepEffects: ResolvedDirectorStepEffect[];
  stepEfforts: ResolvedDirectorStepEffort[];
  holds: ResolvedDirectorHold[];
```

The `resolvedFields` literal (`:712-731`), after `stepPlanes: resolvedStepPlanes[index]!`:

```ts
      stepEffects: resolvedStepEffects[index]!,
      stepEfforts: resolvedStepEfforts[index]!,
      holds: resolvedHolds[index]!,
```

And the final performer literal (the one carrying `stepPlanes: input.stepPlanes`
at `:496`), after that line:

```ts
      stepEffects: input.stepEffects,
      stepEfforts: input.stepEfforts,
      holds: input.holds,
```

- [ ] **Step 4: Run the full folder.** Expected: every test passes except
  `film-resolution-snapshot.test.ts`, which now fails on three new lines per
  resolved performer. Leave it failing; Task 6 regenerates it once, after the
  proving scene lands, so the snapshot is written a single time.

- [ ] **Step 5: Commit**

```bash
git commit -m "feat(film-director): resolve per-step effects, efforts, and holds

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>" -- src/routes/test/film-director/_lib/resolve-film-director-spec.ts tests/unit/film-director/plane-axes.test.ts
```

---

### Task 3: `director-step-changes.ts` — the value in force at a step

**Files:** Create `src/routes/test/film-director/_lib/director-step-changes.ts`;
Test create `tests/unit/film-director/step-changes.test.ts`.

- [ ] **Step 1: Write the failing test** (new file):

```ts
import { describe, expect, it } from "vitest";

import { resolveStepChange } from "../../../src/routes/test/film-director/_lib/director-step-changes";

const entries = [
  { step: 0, value: "none" },
  { step: 4, value: "trails" },
  { step: 8, value: "fire" },
];

describe("resolveStepChange", () => {
  it("returns the performer's base value when the list is empty", () => {
    expect(resolveStepChange([], 7, "linear")).toBe("linear");
  });

  it("returns the base value before the first entry", () => {
    expect(resolveStepChange([{ step: 8, value: "punch" }], 7, "linear")).toBe(
      "linear"
    );
  });

  it("takes the entry that names the step exactly", () => {
    expect(resolveStepChange(entries, 4, "glide")).toBe("trails");
  });

  it("holds the last entry at or before the step", () => {
    expect(resolveStepChange(entries, 5, "glide")).toBe("trails");
    expect(resolveStepChange(entries, 7, "glide")).toBe("trails");
    expect(resolveStepChange(entries, 8, "glide")).toBe("fire");
    expect(resolveStepChange(entries, 40, "glide")).toBe("fire");
  });

  it("does not care what order the entries were written in", () => {
    const shuffled = [entries[2]!, entries[0]!, entries[1]!];
    expect(resolveStepChange(shuffled, 5, "glide")).toBe("trails");
  });

  it("ignores the fractional part of a step", () => {
    expect(resolveStepChange(entries, 3.99, "glide")).toBe("none");
    expect(resolveStepChange(entries, 4.01, "glide")).toBe("trails");
  });

  it("falls back to the base value for a step that is not a finite number", () => {
    expect(resolveStepChange(entries, Number.NaN, "glide")).toBe("glide");
  });
});
```

- [ ] **Step 2: Run to verify failure.**

Run: `node node_modules/vitest/vitest.mjs run --config tests/config/vitest.config.ts tests/unit/film-director/step-changes.test.ts`
Expected: FAIL — the module does not exist.

- [ ] **Step 3: Implement.** Create `director-step-changes.ts`:

```ts
/**
 * What a per-step list has in force at a given step.
 *
 * `stepPlanes` needs nothing like this: the runtime owns a per-step setter
 * (`setStepHandPlane`), so the whole list is handed over once when the scene is
 * applied. Effect and effort have no per-step setter — `setEffect` and
 * `setEffort` set the whole performer — so the film has to decide, every frame,
 * which entry is current and write only when the answer changes.
 *
 * A list is a series of changes, not a series of moments: an entry stays in
 * force until the next one supersedes it, and before the first entry the
 * performer carries whatever the scene gave them.
 */
export interface DirectorStepChange<T> {
  step: number;
  value: T;
}

export function resolveStepChange<T>(
  entries: readonly DirectorStepChange<T>[],
  step: number,
  base: T
): T {
  if (!Number.isFinite(step)) return base;
  const current = Math.floor(step);
  let chosen: DirectorStepChange<T> | null = null;
  for (const entry of entries) {
    if (entry.step > current) continue;
    if (chosen === null || entry.step > chosen.step) chosen = entry;
  }
  return chosen === null ? base : chosen.value;
}
```

The resolved entries are `{step, effect}` and `{step, effort}`, not
`{step, value}`, so the callers in Task 5 map them. That keeps this module
free of the film's field names and keeps its test readable.

- [ ] **Step 4: Run** the new test file. Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git commit -m "feat(film-director): resolve which per-step entry is in force

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>" -- src/routes/test/film-director/_lib/director-step-changes.ts tests/unit/film-director/step-changes.test.ts
```

---

### Task 4: `director-step-holds.ts` — the playhead remap

**Files:** Create `src/routes/test/film-director/_lib/director-step-holds.ts`;
Test create `tests/unit/film-director/step-holds.test.ts`.

- [ ] **Step 1: Write the failing test** (new file):

```ts
import { describe, expect, it } from "vitest";

import { resolveHeldStep } from "../../../src/routes/test/film-director/_lib/director-step-holds";

const hold = [{ fromStep: 4, steps: 4 }];

describe("resolveHeldStep", () => {
  it("passes the shared clock straight through when nothing holds", () => {
    expect(resolveHeldStep(6, 0.25, 0, [], 0)).toEqual({
      step: 6,
      progress: 0.25,
    });
  });

  it("passes through before the hold starts", () => {
    expect(resolveHeldStep(3, 0.5, 0, hold, 0)).toEqual({
      step: 3,
      progress: 0.5,
    });
  });

  it("pins the performer to the held step at progress zero for the whole window", () => {
    for (const [step, progress] of [
      [4, 0],
      [4, 0.9],
      [5, 0.5],
      [7, 0.99],
    ] as const) {
      expect(resolveHeldStep(step, progress, 0, hold, 0)).toEqual({
        step: 4,
        progress: 0,
      });
    }
  });

  it("resumes from the held step, so every later step lags by the hold", () => {
    expect(resolveHeldStep(8, 0, 0, hold, 0)).toEqual({ step: 4, progress: 0 });
    expect(resolveHeldStep(9, 0.5, 0, hold, 0)).toEqual({
      step: 5,
      progress: 0.5,
    });
    expect(resolveHeldStep(15, 0, 0, hold, 0)).toEqual({
      step: 11,
      progress: 0,
    });
  });

  it("accumulates lag across several holds", () => {
    const holds = [
      { fromStep: 2, steps: 2 },
      { fromStep: 6, steps: 3 },
    ];
    // First hold: shared 2-3 pins to 2, so shared 4 is the performer's 2.
    expect(resolveHeldStep(4, 0, 0, holds, 0)).toEqual({ step: 2, progress: 0 });
    // The second hold starts at the performer's step 6, which the two-step lag
    // puts at shared step 8.
    expect(resolveHeldStep(7, 0, 0, holds, 0)).toEqual({ step: 5, progress: 0 });
    expect(resolveHeldStep(8, 0, 0, holds, 0)).toEqual({ step: 6, progress: 0 });
    expect(resolveHeldStep(10, 0.5, 0, holds, 0)).toEqual({
      step: 6,
      progress: 0,
    });
    expect(resolveHeldStep(11, 0, 0, holds, 0)).toEqual({ step: 6, progress: 0 });
    // Five steps of accumulated lag after both holds.
    expect(resolveHeldStep(14, 0, 0, holds, 0)).toEqual({ step: 9, progress: 0 });
  });

  it("applies the performer's beatOffset before the hold windows", () => {
    // beatOffset 2 puts this performer two steps ahead, so they reach the
    // step-4 hold two shared steps early.
    expect(resolveHeldStep(2, 0, 2, hold, 0)).toEqual({ step: 4, progress: 0 });
    expect(resolveHeldStep(1, 0, 2, hold, 0)).toEqual({ step: 3, progress: 0 });
  });

  it("wraps to the sequence length when one is known, and does not when it is not", () => {
    expect(resolveHeldStep(13, 0.5, 0, hold, 8)).toEqual({
      step: 1,
      progress: 0.5,
    });
    expect(resolveHeldStep(13, 0.5, 0, hold, 0)).toEqual({
      step: 9,
      progress: 0.5,
    });
  });

  it("keeps a negative offset in range when a sequence length is known", () => {
    const wrapped = resolveHeldStep(0, 0, -1, [], 8);
    expect(wrapped.step).toBe(7);
    expect(wrapped.progress).toBe(0);
  });

  it("returns the opening step for non-finite input", () => {
    expect(resolveHeldStep(Number.NaN, 0, 0, hold, 0)).toEqual({
      step: 0,
      progress: 0,
    });
  });
});
```

- [ ] **Step 2: Run to verify failure.**

Run: `node node_modules/vitest/vitest.mjs run --config tests/config/vitest.config.ts tests/unit/film-director/step-holds.test.ts`
Expected: FAIL — the module does not exist.

- [ ] **Step 3: Implement.** Create `director-step-holds.ts`:

```ts
import type { ResolvedDirectorHold } from "./film-director-schema";

/**
 * Where one performer's prop phrase sits when time stops for them.
 *
 * A hold is not a pause of the film. The shared clock keeps counting, the
 * camera keeps moving, and the rest of the cast keeps dancing; this one
 * performer's phrase freezes at `fromStep` for `steps` counts and then picks up
 * exactly where it froze. Everything after a hold therefore lags by its length,
 * and several holds accumulate.
 *
 * Blocking is deliberately untouched. A performer's staging is authored
 * geometry on the scene's own clock, so a performer who holds mid-walk keeps
 * walking with a frozen prop — which is the picture a director asking for this
 * is asking for.
 *
 * `totalSteps` is the performer's loaded sequence length, or 0 when the caller
 * does not know it. The film director does not: the sequence lives in the
 * viewer, whose `resolvePerformerStepSource` wraps whatever the host supplies.
 * So the film passes 0 and lets the viewer wrap, while a caller that does know
 * the length gets the wrap here.
 */
export interface HeldStep {
  /** Whole step of the performer's own phrase. */
  step: number;
  /** How far into that step, 0 to 1. Always 0 inside a hold. */
  progress: number;
}

export function resolveHeldStep(
  sharedStep: number,
  progress: number,
  beatOffset: number,
  holds: readonly ResolvedDirectorHold[],
  totalSteps: number
): HeldStep {
  if (
    !Number.isFinite(sharedStep) ||
    !Number.isFinite(progress) ||
    !Number.isFinite(beatOffset)
  ) {
    return { step: 0, progress: 0 };
  }

  const shared = sharedStep + progress + beatOffset;

  // Sorted and non-overlapping by the resolver, but sorting here too keeps
  // this function honest for a caller that builds holds some other way.
  const ordered = [...holds].sort((a, b) => a.fromStep - b.fromStep);

  let lag = 0;
  for (const hold of ordered) {
    // Where this hold's window sits on the SHARED clock: its own step plus
    // every earlier hold's length.
    const opens = hold.fromStep + lag;
    if (shared < opens) break;
    if (shared < opens + hold.steps) {
      return { step: wrap(hold.fromStep, totalSteps), progress: 0 };
    }
    lag += hold.steps;
  }

  const position = wrap(shared - lag, totalSteps);
  const step = Math.floor(position);
  return { step, progress: position - step };
}

function wrap(value: number, totalSteps: number): number {
  if (!Number.isFinite(totalSteps) || totalSteps <= 0) {
    return Math.max(0, value);
  }
  return ((value % totalSteps) + totalSteps) % totalSteps;
}
```

- [ ] **Step 4: Run** the new test file. Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git commit -m "feat(film-director): stop time for one performer with holds

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>" -- src/routes/test/film-director/_lib/director-step-holds.ts tests/unit/film-director/step-holds.test.ts
```

---

### Task 5: Runtime — undo-free setters, the adapter write, the frame loop

**Files:** Modify `src/lib/shared/3d/state/character-instance-state.svelte.ts`,
`src/routes/test/film-director/_lib/director-viewer-adapter.ts`,
`src/routes/test/film-director/_components/FilmDirectorScene.svelte`;
Test `tests/unit/film-director/director-viewer-adapter.test.ts`.

**Why the undo option is needed.** `setEffect` (`:1006-1051`) and `setEffort`
(`:954-966`) both call `sceneUndo.pushSelfRestoringEntry` on every invocation.
Frame-driven writes are not performer choices, and even change-gated writes
would put one entry in the history for every step boundary in every scene of a
looping film. There is no existing suppression path in `scene-undo-manager.ts`,
so add one option, defaulting to today's behavior.

- [ ] **Step 1: Write the failing test.** Append to
  `director-viewer-adapter.test.ts`, matching whatever fake-performer factory
  that file already uses for `applyDirectorSceneToViewer` (read it first — the
  existing `stepPlanes` cases at `:134` and `:198-230` build one). The fake
  performer needs `setEffect`, `setEffort`, and an `id`:

```ts
describe("applyDirectorStepChanges", () => {
  function stepScene() {
    return resolveFilmDirectorSpec({
      version: 5,
      id: "step-film",
      title: "Step Film",
      scenes: [
        {
          id: "s1",
          title: "S1",
          performance: {
            cast: {
              count: 2,
              performers: [
                {
                  id: "performer-1",
                  effect: "none",
                  effort: "linear",
                  stepEffects: [
                    { step: 4, effect: "trails" },
                    { step: 8, effect: "fire" },
                  ],
                  stepEfforts: [{ step: 8, effort: "punch" }],
                },
                { id: "performer-2" },
              ],
            },
          },
        },
      ],
    }).scenes[0]!;
  }

  it("writes only when the value changes, and never for a performer with no entries", () => {
    const scene = stepScene();
    const viewer = fakeViewer(2);
    const applied = new Map<string, { effect: string; effort: string }>();
    const calls = () =>
      viewer.performerManager.performers.map((performer) => ({
        effect: performer.setEffect.mock.calls.length,
        effort: performer.setEffort.mock.calls.length,
      }));

    applyDirectorStepChanges(viewer, scene, [3, 3], applied);
    expect(calls()[0]).toEqual({ effect: 0, effort: 0 });

    applyDirectorStepChanges(viewer, scene, [4, 4], applied);
    applyDirectorStepChanges(viewer, scene, [5, 5], applied);
    applyDirectorStepChanges(viewer, scene, [6, 6], applied);
    expect(calls()[0]).toEqual({ effect: 1, effort: 0 });
    const performer = viewer.performerManager.performers[0]!;
    expect(performer.setEffect).toHaveBeenLastCalledWith("trails", {
      equipBuild: false,
      recordUndo: false,
    });

    applyDirectorStepChanges(viewer, scene, [8, 8], applied);
    expect(calls()[0]).toEqual({ effect: 2, effort: 1 });
    expect(performer.setEffort).toHaveBeenLastCalledWith("punch", {
      recordUndo: false,
    });

    // performer-2 states no per-step entries, so no frame ever writes to it.
    expect(calls()[1]).toEqual({ effect: 0, effort: 0 });
  });

  it("returns to the scene's base value when the playhead loops back", () => {
    const scene = stepScene();
    const viewer = fakeViewer(2);
    const applied = new Map<string, { effect: string; effort: string }>();
    applyDirectorStepChanges(viewer, scene, [8, 8], applied);
    applyDirectorStepChanges(viewer, scene, [0, 0], applied);
    const performer = viewer.performerManager.performers[0]!;
    expect(performer.setEffect).toHaveBeenLastCalledWith("none", {
      equipBuild: false,
      recordUndo: false,
    });
  });
});
```

- [ ] **Step 2: Run to verify failure.**

Run: `node node_modules/vitest/vitest.mjs run --config tests/config/vitest.config.ts tests/unit/film-director/director-viewer-adapter.test.ts`
Expected: FAIL — `applyDirectorStepChanges` is not exported.

- [ ] **Step 3a: The undo option.** In
  `character-instance-state.svelte.ts`, change `setEffort` (`:954`) to:

```ts
  function setEffort(
    effortId: EffortId,
    options?: { recordUndo?: boolean }
  ): void {
    const before = $state.snapshot(_settings);
    _settings = { ..._settings, effortId };
    // A frame-driven write is not a performer choosing an effort. The film
    // director changes effort at authored steps, every scene, on a loop; one
    // history entry per step boundary would bury every real edit under them.
    if (options?.recordUndo === false) return;
    const after = $state.snapshot(_settings);
    sceneUndo.pushSelfRestoringEntry("change-effort", `Effort: ${effortId}`, {
      undo: () => {
        _settings = before;
      },
      redo: () => {
        _settings = after;
      },
    });
  }
```

And in `setEffect` (`:1006`), widen the options type and return before the push:

```ts
  function setEffect(
    effect: EffectType | null,
    options?: { equipBuild?: boolean; recordUndo?: boolean }
  ): void {
```

then immediately after the `_settings = {...}` assignment and before
`const after = $state.snapshot(_settings);`:

```ts
    // See setEffort: frame-driven writes stay out of the undo history.
    if (options?.recordUndo === false) return;
```

Nothing else in either function changes, and every existing caller keeps
today's behavior because the flag is only read when explicitly `false`.

- [ ] **Step 3b: The adapter write.** In `director-viewer-adapter.ts`, import
  `resolveStepChange` from `./director-step-changes` and add, after
  `applyDirectorPerformerMotion` (ends `:219`):

```ts
/** What the film last wrote to one performer, so a frame that changes nothing writes nothing. */
export interface DirectorAppliedStepChange {
  effect: EffectType;
  effort: EffortId;
}

/**
 * Applies this frame's per-step effect and effort for every performer who
 * states any.
 *
 * `stepPlanes` is handed to the runtime once at scene apply because
 * `setStepHandPlane` exists. There is no per-step setter for effect or effort,
 * so the film watches the playhead instead and writes the whole-performer
 * setter when the answer changes. `applied` is the caller's memory of the last
 * write, keyed by performer id — the caller clears it when a scene is applied,
 * so a cut re-writes rather than trusting stale state.
 *
 * `effectiveSteps` are HELD steps (director-step-holds.ts), not the raw shared
 * clock, so an entry scheduled inside a hold applies for the whole hold.
 *
 * `equipBuild: false` matches the scene-apply call above: a step-level effect
 * change states an effect, not a request to put a different prop in the
 * performer's hand mid-shot. `recordUndo: false` keeps a looping film from
 * flooding the undo history.
 */
export function applyDirectorStepChanges(
  viewer: Viewer3DState,
  scene: ResolvedDirectorScene,
  effectiveSteps: readonly number[],
  applied: Map<string, DirectorAppliedStepChange>
): void {
  const performers = viewer.performerManager.performers;
  scene.performance.performers.forEach((directed, index) => {
    if (directed.stepEffects.length === 0 && directed.stepEfforts.length === 0)
      return;
    const performer = performers[index];
    if (!performer) return;

    const step = effectiveSteps[index] ?? 0;
    const effect = resolveStepChange(
      directed.stepEffects.map((entry) => ({
        step: entry.step,
        value: entry.effect,
      })),
      step,
      directed.effect
    );
    const effort = resolveStepChange(
      directed.stepEfforts.map((entry) => ({
        step: entry.step,
        value: entry.effort,
      })),
      step,
      directed.effort
    );

    const last = applied.get(directed.id);
    if (last?.effect !== effect) {
      performer.setEffect(effect, { equipBuild: false, recordUndo: false });
    }
    if (last?.effort !== effort) {
      performer.setEffort(effort, { recordUndo: false });
    }
    applied.set(directed.id, { effect, effort });
  });
}
```

Import `EffectType` and `EffortId` types here if the file does not already
carry them (it imports `EffectsConfig` from the same effects domain at `:11`;
`EffectType` comes from `$lib/shared/effects/domain/effects-config` and
`EffortId` from `$lib/shared/effort/domain/effort-types`, the same paths
`film-director-schema.ts:6-7` uses).

- [ ] **Step 3c: The frame loop.** In `FilmDirectorScene.svelte`:

Add the imports beside the existing adapter import (`:16-22`) and the
blocking-track import (`:23`):

```ts
  import {
    applyDirectorCameraFrame,
    applyDirectorEffectPresets,
    applyDirectorPerformerMotion,
    applyDirectorSceneToViewer,
    applyDirectorStepChanges,
    buildDirectorViewerSeed,
    type DirectorAppliedStepChange,
  } from "../_lib/director-viewer-adapter";
  import { resolveHeldStep } from "../_lib/director-step-holds";
```

After `presentedStepOffsets` (`:102-108`) add the held-step derivation:

```ts
  /**
   * Each performer's own playhead once their holds are applied, or null for a
   * performer who states none — null falls through to the viewer's shared
   * clock plus `performerStepOffsets`, so a film with no holds drives the
   * viewer exactly as it did before this existed.
   *
   * The fractional value is deliberate: `Viewer3DScene` floors it for
   * `goToStep` and passes the remainder to `setProgress`, so one number pins
   * both the step and how far into it the performer sits.
   *
   * Sequence length is unknown here — the sequence lives in the viewer — so
   * `resolveHeldStep` is called with 0 and the viewer's
   * `resolvePerformerStepSource` does the wrapping it already does.
   */
  const presentedHeldSteps = $derived(
    presentedScene.performance.performers.map((performer, index) => {
      if (performer.holds.length === 0) return null;
      const shared = director.preparation.complete
        ? director.frame.sequenceStep
        : 0;
      const whole = Math.floor(shared);
      const held = resolveHeldStep(
        whole,
        shared - whole,
        presentedStepOffsets[index] ?? 0,
        performer.holds,
        0
      );
      return held.step + held.progress;
    })
  );

  /**
   * The step each performer's per-step effect and effort read from: the held
   * playhead where one exists, the shared clock plus their offset where it
   * does not.
   */
  const presentedEffectiveSteps = $derived(
    presentedScene.performance.performers.map((_, index) => {
      const held = presentedHeldSteps[index];
      if (held !== null) return held;
      const shared = director.preparation.complete
        ? director.frame.sequenceStep
        : 0;
      return shared + (presentedStepOffsets[index] ?? 0);
    })
  );

  /** Last per-step effect/effort written per performer id — see applyDirectorStepChanges. */
  const appliedStepChanges = new Map<string, DirectorAppliedStepChange>();
```

In `applyScene` (`:192-204`), clear the map as the first statement after
`appliedSceneId = scene.id;`:

```ts
    // A cut re-establishes every performer from the scene document, so the
    // next frame must write its per-step values rather than trust what the
    // previous scene left in this map.
    appliedStepChanges.clear();
```

Add a third per-frame `$effect` beside the camera and motion ones (`:446-456`):

```ts
  $effect(() => {
    const steps = presentedEffectiveSteps;
    director.sceneReady;
    applyDirectorStepChanges(viewer, presentedScene, steps, appliedStepChanges);
  });
```

Pass the held steps to the canvas, beside `performerStepOffsets` (`:487`):

```svelte
    performerStepOffsets={presentedStepOffsets}
    performerSteps={presentedHeldSteps}
```

`Viewer3DCanvas.svelte:127` types the prop
`readonly (number | null | undefined)[] | null` and forwards it at `:582`, so a
`(number | null)[]` is exactly what it takes.

- [ ] **Step 4: Run** the adapter test file, then the whole folder. Expected:
  the adapter test passes; the folder is green except the snapshot, still
  pending Task 6.

- [ ] **Step 5: Commit**

```bash
git commit -m "feat(film-director): drive per-step effect, effort, and holds each frame

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>" -- src/lib/shared/3d/state/character-instance-state.svelte.ts src/routes/test/film-director/_lib/director-viewer-adapter.ts src/routes/test/film-director/_components/FilmDirectorScene.svelte tests/unit/film-director/director-viewer-adapter.test.ts
```

---

### Task 6: Proving Grounds scene, film-library test, snapshot

**Files:** Modify `src/routes/test/film-director/_films/proving-grounds.ts`,
`tests/unit/film-director/film-library.test.ts`,
`tests/unit/film-director/__snapshots__/film-resolution-snapshot.test.ts.snap`.

- [ ] **Step 1: The scene.** Read `proving-grounds.ts` first and append after
  the LAST scene in the `scenes` array, whatever it is at that moment (six as
  of `7577d4cbed`, ending with `derived-sequences`). Do not edit any earlier
  scene:

```ts
    {
      id: "per-step-changes",
      title: "Per-Step Changes",
      intent:
        "Gap 2: two things change partway through one scene. Performer 1 starts bare, picks up trails at step 4, and catches fire at step 8, switching to a punched effort at the same count. Performer 2 states no changes at all, but holds: at step 4 their prop stops for four counts while performer 1 keeps going, and afterwards they carry on from where they froze, four steps behind the clock.",
      durationBeats: 16,
      transition: { kind: "cut" },
      location: { environmentId: "cosmic" },
      performance: {
        bpm: 120,
        formation: "side-by-side",
        cast: {
          count: 2,
          performers: [
            {
              id: "performer-1",
              stepEffects: [
                { step: 0, effect: "none" },
                { step: 4, effect: "trails" },
                { step: 8, effect: "fire" },
              ],
              stepEfforts: [{ step: 8, effort: "punch" }],
            },
            {
              id: "performer-2",
              holds: [{ fromStep: 4, steps: 4 }],
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

`none`, `trails`, and `fire` are live `EFFECTS` ids (`effect-registry.ts:56-57`,
plus `"none"` which `effectIdSchema:202-208` admits explicitly). `punch` is in
`DIRECTOR_EFFORT_IDS` (`film-director-schema.ts:75-84`) and differs from the
`"linear"` default this scene's performers otherwise carry.

Extend the file's header comment with a Gap 2 paragraph after the Gap 5 one:

```
 * Gap 2, changes partway through a scene. Before this wave a performer carried
 * one effect and one effort for a whole scene, and every performer counted the
 * same clock: to change either, a director had to cut to a new scene. Scene 7
 * states `stepEffects` and `stepEfforts` on one performer and `holds` on
 * another. Nothing about the scene changes at those counts except what that
 * one performer carries, and what the held performer's prop is doing.
```

Append one sentence to `brief`: `A seventh scene changes one performer's effect and effort partway through while another's prop stops for four counts.`

- [ ] **Step 2: film-library test.** In the "Proving Grounds exercises the gaps
  it advertises" block (`film-library.test.ts:193`), after the
  `derived-sequences` assertions, add:

```ts
    const perStep = resolved.scenes.find((s) => s.id === "per-step-changes")!;
    expect(perStep.durationSeconds).toBe(8);
    const [changer, holder] = perStep.performance.performers;
    expect(changer!.stepEffects).toEqual([
      { step: 0, effect: "none" },
      { step: 4, effect: "trails" },
      { step: 8, effect: "fire" },
    ]);
    expect(changer!.stepEfforts).toEqual([{ step: 8, effort: "punch" }]);
    expect(changer!.holds).toEqual([]);
    expect(holder!.holds).toEqual([{ fromStep: 4, steps: 4 }]);
    expect(holder!.stepEffects).toEqual([]);

    // The lookup the frame loop performs: base value before the first entry,
    // then each entry holding until the next supersedes it.
    const effectAt = (step: number) =>
      resolveStepChange(
        changer!.stepEffects.map((entry) => ({
          step: entry.step,
          value: entry.effect,
        })),
        step,
        changer!.effect
      );
    expect(effectAt(3)).toBe("none");
    expect(effectAt(4)).toBe("trails");
    expect(effectAt(7)).toBe("trails");
    expect(effectAt(8)).toBe("fire");

    // The hold, read the way the scene component reads it: pinned through its
    // window, then four steps behind the shared clock for good.
    const holdAt = (step: number) =>
      resolveHeldStep(step, 0, holder!.beatOffset, holder!.holds, 0);
    expect(holdAt(3)).toEqual({ step: 3, progress: 0 });
    expect(holdAt(4)).toEqual({ step: 4, progress: 0 });
    expect(holdAt(7)).toEqual({ step: 4, progress: 0 });
    expect(holdAt(8)).toEqual({ step: 4, progress: 0 });
    expect(holdAt(12)).toEqual({ step: 8, progress: 0 });
```

Add the two imports at the top of the file:

```ts
import { resolveStepChange } from "../../../src/routes/test/film-director/_lib/director-step-changes";
import { resolveHeldStep } from "../../../src/routes/test/film-director/_lib/director-step-holds";
```

The block ends with an assertion that every scene saying "cut" resolves
`transition.durationSeconds === 0` (Gap 4). Read how it enumerates the scenes:
if it lists ids, add `per-step-changes`; if it filters on
`transition.kind === "cut"`, it already covers the new scene.

- [ ] **Step 3: Snapshot — the expected blast radius, stated before regenerating.**

Two kinds of change, and NOTHING else may appear in the diff:

1. **Mechanical, every film.** Every resolved performer gains three lines,
   `"stepEffects": []`, `"stepEfforts": []`, `"holds": []`, directly after its
   `"stepPlanes"` line. There are 151 `"stepPlanes"` lines in the snapshot
   today, so expect roughly 453 added lines spread across every film block.
   This is expected and is not drift.
2. **The Proving Grounds block only.** One new scene, plus the film's
   `durationSeconds` growing by 8 and the film-key/brief text changing.

Regenerate once:

```bash
node node_modules/vitest/vitest.mjs run --config tests/config/vitest.config.ts tests/unit/film-director -u
```

Then prove the blast radius rather than assuming it:

```bash
git diff -U0 tests/unit/film-director/__snapshots__ | grep -E '^[-+]' | grep -vE '"(stepEffects|stepEfforts|holds)": \[\]|^(---|\+\+\+)'
```

Every remaining line must be inside the Proving Grounds block. If any other
film's block shows a changed value, stop and report it — that is a real
regression, not a snapshot update. Report the command output in the final
summary.

- [ ] **Step 4: Run the full folder.** Expected: green.

- [ ] **Step 5: Commit**

```bash
git commit -m "feat(film-director): prove per-step changes in Proving Grounds scene 7

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>" -- src/routes/test/film-director/_films/proving-grounds.ts tests/unit/film-director/film-library.test.ts tests/unit/film-director/__snapshots__/film-resolution-snapshot.test.ts.snap
```

---

### Task 7: Capability matrix, gate, final commit

**Files:** Modify `docs/reference/film-director-capability-matrix.md`; commit
this plan doc.

- [ ] **Step 1: The axes comment (line 3).** `capability-matrix.test.ts` sorts
  both sides, so order does not matter, but keep it matching the schema's:

```
<!-- directive-axes: characterId,prop,effect,effort,staffLengthCm,environmentId,formation,leftPlane,rightPlane,stepPlane,stepEffect,stepEffort -->
```

- [ ] **Step 2: Two rows in the directive-capable table,** directly after the
  `stepPlanes` row (line 34), in the same five-column shape:

```
| stepEffects   | performer, array of per-step entries | scene-scoped directive per entry: literal, pick any, oneOf, not (distinct/sameAs rejected — pinned to a single (performer, step) pair) | Each entry is `{step: int ≥ 0, effect: <effect directive>}`, `"none"` a legal literal. Effective list: `performer.stepEffects ?? cast?.defaults?.stepEffects ?? []` — a performer's own list REPLACES the cast-default list. Catalog is `EFFECT_CATALOG` in `resolve-film-director-spec.ts` (`"none"` plus every `EFFECTS` id). Reroll knob: `seed.axes.stepEffect`; each (performer, step) pair draws its own stream. Applied per frame by `applyDirectorStepChanges` (`director-viewer-adapter.ts`) with `equipBuild: false` and `recordUndo: false`, written only when the value changes. | unknown effect: catalog message above; `distinct`/`sameAs`: `Scene "<id>": "stepEffect" supports literals, pick:any, oneOf, and not — distinct/sameAs are performer-scoped.`; two entries on one step: `Scene "<id>": performer "<id>" stepEffects names step <n> twice.` |
| stepEfforts   | performer, array of per-step entries | same scene-scoped subset as stepEffects | Each entry is `{step: int ≥ 0, effort: <effort directive>}`. Same replace-not-merge rule and the `DIRECTOR_EFFORT_IDS` catalog. Reroll knob: `seed.axes.stepEffort`. Applied per frame beside stepEffects, `recordUndo: false`. | unknown effort: catalog message above; `distinct`/`sameAs`: same message with `"stepEffort"`; duplicate step: `... stepEfforts names step <n> twice.` |
```

- [ ] **Step 3: Extend the stepPlanes paragraph** (lines 36-41). Replace its
  last sentence with:

```
`stepPlanes` was the first speakable axis that addresses an individual step
rather than a whole performer or a whole scene, and `stepEffects` and
`stepEfforts` now join it: all three resolve once per (scene, performer, step)
— stepPlanes once per hand as well. They differ in how they reach the runtime.
A plane has a per-step setter (`performer.setStepHandPlane`), so the whole list
is handed over once when the scene is applied. Effect and effort do not:
`setEffect` and `setEffort` set the whole performer, so the film reads the
playhead every frame, decides which entry is in force
(`director-step-changes.ts`), and writes only on change. Before 2026-08-24
director scenes could not address individual beats at all.
```

- [ ] **Step 4: A row in the literal-only table** for `holds`, in that table's
  own column shape (read it — it differs from the directive table):

```
| holds | performer, array of `{fromStep: int ≥ 0, steps: int ≥ 1}` (max 16) | Time stops for that performer's prop phrase. While the shared clock, after their `beatOffset`, is inside `[fromStep, fromStep + steps)`, they are pinned to `fromStep` at progress 0; afterwards they resume from `fromStep`, so every later step lags by `steps`, accumulated across several holds. Blocking is authored geometry and is NOT paused — a performer who holds mid-walk keeps walking. Literal only: a hold states this performer's clock and has no catalog to draw from. `performer.holds ?? cast?.defaults?.holds ?? []`, replace not merge; resolved sorted by `fromStep`. | `director-step-holds.ts` (`resolveHeldStep`), driven into the viewer's existing `performerSteps` host-override seam (`performer-step-timing.ts` `resolvePerformerStepSource`) — the value is fractional, which pins step and progress together. | overlapping holds: `Scene "<id>": performer "<id>" holds overlap: step <n> for <n> steps and step <n> for <n> steps.`; `steps: 0`: `A hold lasts at least one step.`; negative `fromStep`: zod bounds rejection |
```

- [ ] **Step 5: A Grammar gaps bullet.** In the `## Grammar gaps` section
  (line 201), keep `None open. Closed so far:` and append a bullet in the shape
  the Gap 4 and Gap 5 entries use:

```
- **Per-step changes: effect, effort, and holds** (closed 2026-09-02). Before
  this gap closed a performer carried one effect and one effort for a whole
  scene and every performer counted the same clock, so changing either meant
  cutting to a new scene. `stepEffects` and `stepEfforts` copy `stepPlanes`
  exactly at the schema and resolver — a per-step entry whose value is a
  scene-scope directive, a performer's list replacing the cast-default list —
  and differ only at the runtime, where no per-step setter exists: the film
  reads the playhead each frame and calls `setEffect`/`setEffort` when the
  value in force changes, with `equipBuild: false` so a step-level effect never
  swaps the prop and `recordUndo: false` so a looping film does not flood the
  undo history (the option added to `character-instance-state.svelte.ts` for
  this). `holds` is literal only and remaps one performer's playhead:
  `resolveHeldStep` pins them at `fromStep` for the stated counts and leaves
  them that far behind afterwards, driven into the viewer's existing
  `performerSteps` host-override seam. Blocking does not pause during a hold,
  and per-step effects read the HELD step, so an entry scheduled inside a hold
  applies for its whole length. `/test/film-director?film=proving` scene 7
  ("per-step-changes") shows both halves side by side.
```

- [ ] **Step 6: Gate.**

1. Full suite: `node node_modules/vitest/vitest.mjs run --config tests/config/vitest.config.ts tests/unit/film-director` — report `Tests N passed`.
2. `npm run check:fast > /tmp/check.log 2>&1; grep -nE "film-director|character-instance-state" /tmp/check.log` — the files this plan touched must be error-free. The two pre-existing `FilmDirectorScene.svelte` performer-edit typing errors are baseline; leave them and say so.

- [ ] **Step 7: Commit**

```bash
git commit -m "docs(film-director): document per-step effects, efforts, and holds

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>" -- docs/reference/film-director-capability-matrix.md docs/superpowers/plans/2026-09-02-film-director-gap-2-per-step-changes.md
```

Report: every SHA, test totals, the snapshot blast-radius command output, and
any deviation from this plan with the reason.

---

## Out of scope (say so, do not do)

- A directive-corpus category for `stepEffect`/`stepEffort`.
  `corpus-runner.test.ts:14-36` requires at least 25 entries per category, which
  is a larger job than this gap and adds nothing the resolver tests do not
  already prove.
- Pausing blocking during a hold. A hold stops the prop phrase; staging is
  authored geometry on the scene's clock. If a director later wants a performer
  to stand still while held, that is a blocking `stand`, spoken separately.
- Holds stated in beats, or a hold on the whole cast. Both are additive later.
- A per-step prop, character, or staff length. Those setters rebuild geometry
  and are a different cost class from an effect id.
- Any change to `Viewer3DScene.svelte`, `Viewer3DCanvas.svelte`, or
  `performer-step-timing.ts`. The host-override seam already carries a
  fractional step; verified 2026-09-02.
- Raising the schema version. Every field this plan adds is optional, so a v5
  film written yesterday still parses and resolves to the same values plus three
  empty arrays.

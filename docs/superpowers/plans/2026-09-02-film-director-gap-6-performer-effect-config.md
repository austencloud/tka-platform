# Film Director Gap 6: Per-Performer Effect Config Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make "performer 1 trails long and red, performer 2 trails short and blue" a spoken request that the schema understands and rejects by name, with the constraint documented, because the effects engine holds one config per effect id for the whole scene.

**Architecture:** The design task (research 2026-09-02, `scratchpad/gap6-research.md`) found the constraint is structural: `EffectsConfigState` (`src/lib/shared/effects/state/effects-config-state.svelte.ts`) is one context instance whose map is `Record<effectId, Intent>` with no performer dimension, `applyDirectorEffectPresets` (`director-viewer-adapter.ts:162-193`) calls `state.replace(config)` once per scene, and `EffectOrchestrator3D.svelte:1293-1325` reads `effectsState.<effectId>` for every performer's tips. Threading a performer dimension through the production effects engine is a 3D-effects-engine change, not a workbench change, and is out of scope for this campaign. The ledger's design explicitly names the alternative: a clear rejection naming the constraint plus capability-matrix documentation. This plan does that. No pretending.

**Tech Stack:** zod schema in `src/routes/test/film-director/_lib/film-director-schema.ts`, vitest.

Run tests with:

```
node node_modules/vitest/vitest.mjs run --config tests/config/vitest.config.ts tests/unit/film-director
```

---

### Task 1: Performer-scoped effect config keys reject by name

**Files:**
- Modify: `src/routes/test/film-director/_lib/film-director-schema.ts` (`performerSchema` ~line 615 and `castDefaultsSchema` ~line 635)
- Test: `tests/unit/film-director/film-director-schema.test.ts`

Today `performerSchema` is `.strict()`, so `effectPresets` or `effectOverrides` on a performer rejects with zod's generic "Unrecognized key" message. That tells the director nothing about why. Replace it with a spoken rejection.

- [ ] **Step 1: Write the failing tests**

Append a new `describe` block at the end of `tests/unit/film-director/film-director-schema.test.ts`. Use the same film-building helper the file already uses for other rejection tests (read the top of the file and reuse `baseFilm`/`parseFilm` or whatever it names; do not invent a second helper).

```ts
describe("per-performer effect config (spoken but not real)", () => {
  const PERFORMER_EFFECT_CONFIG_MESSAGE =
    'Effect presets and overrides are scene-wide: the effects engine keeps one configuration per effect id for the whole scene, so two performers using the same effect always look the same. Move "effectPresets"/"effectOverrides" to the scene, or give the performers different effects.';

  it("rejects effectPresets on a performer with the scene-wide constraint", () => {
    const result = parseFilmWithPerformers([
      { id: "performer-1", effect: "trails", effectPresets: { trails: "comet" } },
    ]);
    expect(result.success).toBe(false);
    expect(messagesOf(result)).toContain(PERFORMER_EFFECT_CONFIG_MESSAGE);
  });

  it("rejects effectOverrides on a performer with the same message", () => {
    const result = parseFilmWithPerformers([
      { id: "performer-1", effect: "trails", effectOverrides: { trails: { length: 2 } } },
    ]);
    expect(result.success).toBe(false);
    expect(messagesOf(result)).toContain(PERFORMER_EFFECT_CONFIG_MESSAGE);
  });

  it("rejects effectPresets in cast defaults with the same message", () => {
    const result = parseFilmWithCastDefaults({ effectPresets: { trails: "comet" } });
    expect(result.success).toBe(false);
    expect(messagesOf(result)).toContain(PERFORMER_EFFECT_CONFIG_MESSAGE);
  });

  it("still accepts scene-scoped effectPresets", () => {
    const result = parseFilmWithScene({ effectPresets: { trails: "comet" } });
    expect(result.success).toBe(true);
  });
});
```

Adapt `parseFilmWithPerformers`, `parseFilmWithCastDefaults`, `parseFilmWithScene`, and `messagesOf` to whatever the file's existing helpers are called. If no helper collects all issue messages, add one small local `messagesOf(result)` that returns `result.error.issues.map(i => i.message)` for a failed safeParse. Check the effect registry for a real preset id for `trails` before using `"comet"`; if `trails` has no preset by that name, the scene-scoped acceptance test should use one that exists (`getRegistration("trails").presetGroup.presets`).

- [ ] **Step 2: Run to verify they fail**

Expected: the three rejection tests fail because the message is zod's "Unrecognized key(s) in object" rather than the spoken message.

- [ ] **Step 3: Implement**

In `film-director-schema.ts`, above `performerSchema`, add:

```ts
/**
 * Spoken but not real. A director will plausibly ask for one performer's
 * trails to be long and another's short. The effects engine cannot do it:
 * `EffectsConfigState` holds one configuration per effect id for the whole
 * scene and `EffectOrchestrator3D` reads that single config for every
 * performer's tips. Accept the keys so the rejection can explain the
 * constraint instead of zod's "unrecognized key".
 */
export const PERFORMER_EFFECT_CONFIG_MESSAGE =
  'Effect presets and overrides are scene-wide: the effects engine keeps one configuration per effect id for the whole scene, so two performers using the same effect always look the same. Move "effectPresets"/"effectOverrides" to the scene, or give the performers different effects.';

const performerEffectConfigKeys = {
  effectPresets: z.unknown().optional(),
  effectOverrides: z.unknown().optional(),
};

function rejectPerformerEffectConfig(
  value: { effectPresets?: unknown; effectOverrides?: unknown },
  ctx: z.RefinementCtx
): void {
  for (const key of ["effectPresets", "effectOverrides"] as const) {
    if (value[key] !== undefined) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: [key], message: PERFORMER_EFFECT_CONFIG_MESSAGE });
    }
  }
}
```

Spread `...performerEffectConfigKeys` into both the `performerSchema` object and the `castDefaultsSchema` object, and add `.superRefine(rejectPerformerEffectConfig)` after each `.strict()`. Keep the objects `.strict()`.

If the resolved performer type is derived from the schema with `z.infer`, confirm the two `unknown` keys do not leak into `ResolvedDirectorPerformer`; the resolver never reads them, and rejected input never resolves, so no runtime change is needed. If typecheck of the resolver complains about the new optional keys, omit them from the derived type explicitly rather than plumbing them through.

- [ ] **Step 4: Run the suite**

Expected: all pass, snapshot unchanged (no shipped film uses these keys). Confirm with `git diff --stat` that the snapshot file is not modified.

### Task 2: Capability matrix

**Files:**
- Modify: `docs/reference/film-director-capability-matrix.md`

- [ ] **Step 1: Add a bullet to "Spoken but not real (proven rejections)"**

After the "Per-performer prop color / tint" bullet:

```md
- **Per-performer effect presets or overrides.** `effectPresets` and
  `effectOverrides` are scene-scoped only. `EffectsConfigState`
  (`src/lib/shared/effects/state/effects-config-state.svelte.ts`) holds one
  configuration per effect id for the whole scene, `applyDirectorEffectPresets`
  (`director-viewer-adapter.ts`) replaces that single state once per scene, and
  `EffectOrchestrator3D.svelte` reads the same config for every performer's
  tips. Two performers on the same effect always look the same; only different
  effect ids look different. Written on a performer or in cast defaults, either
  key rejects with: `Effect presets and overrides are scene-wide: ...` (full
  text in `PERFORMER_EFFECT_CONFIG_MESSAGE`). Making this real means adding a
  performer dimension to the effects state and threading the performer id
  through the orchestrator's resolve calls. That is an effects-engine task,
  ruled out of the director-language campaign on 2026-09-02.
```

- [ ] **Step 2: Add a "Grammar gaps" closing bullet**

```md
- **Per-performer effect config** (ruled 2026-09-02). Investigated and
  declined rather than built: see "Per-performer effect presets or overrides"
  under "Spoken but not real". The grammar now names the constraint when asked.
```

### Task 3: Commit

- [ ] Run the full film-director suite once more; expected all green.
- [ ] Commit with explicit pathspecs only:

```
git add src/routes/test/film-director/_lib/film-director-schema.ts tests/unit/film-director/film-director-schema.test.ts docs/reference/film-director-capability-matrix.md docs/superpowers/plans/2026-09-02-film-director-gap-6-performer-effect-config.md
git commit -m "feat(film-director): name the scene-wide effect config constraint

Per-performer effectPresets/effectOverrides now reject with a message that
explains the effects engine keeps one configuration per effect id for the
whole scene, instead of zod's unrecognized-key text. Documented under spoken
but not real.

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>" -- src/routes/test/film-director/_lib/film-director-schema.ts tests/unit/film-director/film-director-schema.test.ts docs/reference/film-director-capability-matrix.md docs/superpowers/plans/2026-09-02-film-director-gap-6-performer-effect-config.md
```

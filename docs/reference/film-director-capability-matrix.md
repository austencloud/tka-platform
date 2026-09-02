# Film Director Capability Matrix

<!-- directive-axes: characterId,prop,effect,effort,staffLengthCm,environmentId,formation,leftPlane,rightPlane,stepPlane -->

One row per speakable axis of the `/test/film-director` schema (v4). "Source
of truth" is the live registry/enum — never copy value lists here.

## Directive-capable axes

These support the full directive grammar (literal, `pick: "any"`,
`pick: "distinct"`, `oneOf`, `not`, `sameAs`) at performer scope, or the
scene-scoped subset (literal, `pick: "any"`, `oneOf`, `not`) where noted.
Grammar and normalization: `src/routes/test/film-director/_lib/directives.ts`.
Resolution: `src/routes/test/film-director/_lib/resolve-film-director-spec.ts`,
`resolve-directives.ts`.

A pick may exclude values in the same breath: `{pick: "any" | "distinct",
from?, not?}` — `not` composes with both picks (and with `from`, which narrows
the pool the exclusion then trims), so "everyone on a different plane, and
nobody on the wall" is one directive. Scene-scoped axes take `{pick: "any",
not}` and still reject `distinct`, with or without `not`.

| Axis          | Scope                                | Grammar                                                                                                                                                                                   | Source of truth                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       | Rejection behavior                                                                                                                                                                                                                                                        |
| ------------- | ------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| prop          | performer                            | literal, pick any/distinct, oneOf, not, sameAs                                                                                                                                            | `src/lib/shared/pictograph/prop/domain/enums/prop-type.ts` (`PropType`)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               | unknown value: `"<value>" is not in the deployed catalog for this axis`                                                                                                                                                                                                   |
| characterId   | performer                            | literal, pick any/distinct, oneOf, not, sameAs                                                                                                                                            | `src/lib/shared/3d/domain/character-model.ts` (`CHARACTER_DEFINITIONS`)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               | literal: `Character "<id>" is not in the deployed 3D catalog.`; directive form: catalog message above                                                                                                                                                                     |
| effect        | performer                            | literal, pick any/distinct, oneOf, not, sameAs ("none" is a legal literal)                                                                                                                | `src/lib/shared/animation-engine/components/effects-panel/effect-registry.ts` (`EFFECTS`)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             | catalog message above                                                                                                                                                                                                                                                     |
| effort        | performer                            | literal, pick any/distinct, oneOf, not, sameAs                                                                                                                                            | `DIRECTOR_EFFORT_IDS` in `src/routes/test/film-director/_lib/film-director-schema.ts`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | catalog message above                                                                                                                                                                                                                                                     |
| staffLengthCm | performer                            | literal, directives require an explicit `from` (no finite catalog)                                                                                                                        | schema bounds 40–300 in `film-director-schema.ts`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     | open pick with no `from`: `this axis has no finite catalog — provide "from" with explicit values.`; `sameAs` to a performer with no staff length: `has no staff length to copy`                                                                                           |
| environmentId | scene                                | literal, pick any, oneOf, not                                                                                                                                                             | `src/lib/shared/3d/environments/domain/scene-environment.ts` (`SceneEnvironmentId`)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   | `distinct`/`sameAs` at scene scope: `supports literals, pick:any, oneOf, and not — distinct/sameAs are performer-scoped.`; unknown value: catalog message above                                                                                                           |
| formation     | scene                                | literal, pick any, oneOf, not                                                                                                                                                             | `DIRECTOR_FORMATIONS` in `film-director-schema.ts`, filtered per scene by `@austencloud/scene-3d` `PRESET_VALID_COUNTS[preset]` for that scene's performer count; open picks never select `"custom"` (needs per-performer positions)                                                                                                                                                                                                                                                                                                                                                                                  | count mismatch: `Formation "<preset>" does not support <n> performers.`; scene-scope `distinct`/`sameAs`: same message as environmentId                                                                                                                                   |
| leftPlane     | performer                            | literal, pick any/distinct, oneOf, not, sameAs                                                                                                                                            | `Plane` enum, `@austencloud/scene-3d` `dist/lib/domain/enums/Plane.d.ts` — nine values: `wall`, `wheel`, `floor`, `right-shield`, `left-shield`, `forward-ramp`, `backward-ramp`, `right-wing`, `left-wing`. Precedence: `performer.leftPlane ?? cast?.defaults?.leftPlane ?? "wall"`. Reroll knob: `seed.axes.leftPlane`; the resolver retains the historical blue-plane hash namespace so existing films do not reshuffle.                                                                                                                                                                                          | unknown value: `Unknown plane "<value>". Planes: wall, wheel, floor, right-shield, left-shield, forward-ramp, backward-ramp, right-wing, left-wing.` (lists the full catalog — there's no "closest" plane the way there's an obvious closest prop)                        |
| rightPlane    | performer                            | literal, pick any/distinct, oneOf, not, sameAs                                                                                                                                            | Same `Plane` catalog and precedence as leftPlane, resolved as its own independent axis (a `sameAs` on rightPlane copies the other performer's rightPlane, never their leftPlane). Reroll knob: `seed.axes.rightPlane`; the historical red-plane hash namespace remains stable.                                                                                                                                                                                                                                                                                                                                        | same catalog message as leftPlane                                                                                                                                                                                                                                         |
| stepPlanes    | performer, array of per-step entries | scene-scoped directive per entry: literal, pick any, oneOf, not (distinct/sameAs rejected — pinned to a single (performer, step, hand) triple, same reasoning as environmentId/formation) | Each entry is `{step: int ≥ 0, hand: "left" \| "right", plane: <Plane directive>}`. Effective list: `performer.stepPlanes ?? cast?.defaults?.stepPlanes ?? []` — a performer's own list REPLACES the cast-default list, it does not merge with it. Reroll knob: `seed.axes.stepPlane` (shared across every stepPlanes entry in the film; each (performer, step, hand) triple still draws its own stream via a distinguishing key, so bumping this salt doesn't collapse every entry to the same value). Legacy blue/red hand values normalize at the schema boundary without changing their historical random stream. | unknown plane: same catalog message as leftPlane; `distinct`/`sameAs` on an entry: `Scene "<id>": "stepPlane" supports literals, pick:any, oneOf, and not — distinct/sameAs are performer-scoped.`; bad `hand`: zod enum rejection; negative `step`: zod bounds rejection |

`stepPlanes` is the first speakable axis that addresses an individual step
rather than a whole performer or a whole scene. Every other axis in this table
resolves once per (scene, performer) or once per scene; `stepPlanes` resolves
once per (scene, performer, step, hand). Before 2026-08-24, director scenes had
no way to address individual beats at all — the setter existed
(`performer.setStepHandPlane`) but nothing in the schema could reach it.

## Literal-only axes (not directive-capable)

These are real, resolved fields with no directive grammar — either because
they are booleans/records the grammar doesn't cover, or because they are
per-scene camera/scene mechanics with their own dedicated language instead of
the pick/oneOf/not vocabulary.

**Counted time.** Every duration below has a `durationBeats` twin, and camera
keyframes take `atBeats` beside `atSeconds`. Beats convert at the scene's own
`performance.bpm` (default 90) — `beats * 60 / bpm` — before anything else
resolves, so seconds stay the only internal unit
(`src/routes/test/film-director/_lib/director-beat-times.ts`). State exactly
one unit per field: naming both rejects with `State exactly one of
"durationSeconds" or "durationBeats".` (keyframes: `A camera keyframe states
exactly one of "atSeconds" or "atBeats".`). A beat count that converts outside
a scene or transition second bound rejects in the unit it was spoken in — `96
beats at 66 bpm is 87.27s`, not a bare seconds number the director never wrote.
(Beats-stated moves and keyframes have no second bound of their own; a move
total that overruns the scene, or a keyframe past its end, still rejects
downstream with the existing seconds-speaking message.)

| Axis                            | Scope                      | Shape                                                                                                                                              | Source of truth                                                                                                                                                                              | Notes                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| ------------------------------- | -------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| performer `id`                  | performer                  | literal string, defaults to `performer-<n>`                                                                                                        | `film-director-schema.ts` `performerSchema`                                                                                                                                                  | Used to address cast overrides and `sameAs` targets.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| performer `name`                | performer                  | literal string, optional                                                                                                                           | `performerSchema`                                                                                                                                                                            | Defaults to `Performer <n>`. Rendered through `simplifyRepeatedWord`-equivalent display where it feeds sequence UI; here it is a raw label.                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| performer `position`            | performer                  | literal `{x, z}`                                                                                                                                   | `performerSchema`                                                                                                                                                                            | Only required (and only meaningful) for `formation: "custom"`; otherwise the formation preset's slot geometry places the performer.                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| performer `facingDegrees`       | performer                  | literal number (degrees)                                                                                                                           | `performerSchema`                                                                                                                                                                            | Falls back to the formation slot's computed facing angle when omitted.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| performer `beatOffset`          | performer                  | literal number                                                                                                                                     | `performerSchema`                                                                                                                                                                            | Defaults to 0.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| performer `blocking`            | performer                  | literal array of 1–16 moves: `{move: "stand" \| "walk" \| "turn", to?, direction?, amount?, facing?, durationSeconds? \| durationBeats?, easing?}` | `blockingMoveSchema` in `film-director-schema.ts` (shape); `src/routes/test/film-director/_lib/blocking-language.ts` (meaning + resolution)                                                  | A move states its length in seconds or in beats — one unit per move, converted at the scene bpm (see "Counted time"). `walk` takes `to: {x, z}` (world point) or `direction` + `amount` (performer-relative); `facing` ∈ `travel`/`hold`/`audience`/`{degrees}` (`audience` faces the default camera side at −Z, NOT the seated crowd at +Z). Travel speed is capped at `MAX_TRAVEL_SPEED` (2.6 m/s) — a faster leg rejects — and below ~0.47 m/s the walk clip hits its playback-rate floor and the feet skate. Deliberately not directive-capable: a path is authored geometry, not a pick. |
| `performance.blocking`          | scene                      | literal `{endFormation, durationSeconds? \| durationBeats?, easing?, facing?}`                                                                     | `sceneBlockingSchema` in `film-director-schema.ts`                                                                                                                                           | Beats convert at the scene bpm; state exactly one unit (see "Counted time"). Cast-wide staging: walks every performer from their opening slot into the named formation's slots — the spoken "and then they all form a line". A performer with their own `blocking` list ignores it. `endFormation` validates against the same formation catalog (and per-count validity) as the `formation` axis.                                                                                                                                                                                             |
| performer `sequence`            | performer                  | one source (`{source:"demo"}` \| `word` \| `length` \| `mirrorOf`) plus, for the two generated sources, any of the twelve controls below           | `src/routes/test/film-director/_lib/sequence-language.ts` (grammar + meaning), `film-director-schema.ts` `performerSequenceSchema` (shape); resolved async by `director-sequence-library.ts` | Defaults to `{source:"demo"}` (the film's shared sequence). See "Sequence directives" below. Deliberately not directive-capable: `mirrorOf` names one specific performer, so a random pick would have nothing to mean. Rejections: `A sequence names one source…`; `performer "<id>" cannot mirror themselves.`; `mirrors "<id>", who is not in this scene.`; `mirrors "<id>", who is already a mirror. Mirror the original instead.` Generation happens after the first frame, so a scene opens on the shared sequence and re-applies when the library resolves.                             |
| bpm                             | scene (`performance.bpm`)  | literal number, 20–300                                                                                                                             | `performanceSchema`                                                                                                                                                                          | Defaults to 90.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| durationSeconds / durationBeats | scene                      | literal number, 1–60 seconds or a positive beat count up to 240                                                                                    | `sceneSchema`                                                                                                                                                                                | Defaults to 8s when neither is stated. Beats convert at this scene's own bpm (default 90) and the converted seconds must still land in 1–60; state exactly one unit (see "Counted time").                                                                                                                                                                                                                                                                                                                                                                                                     |
| transition                      | scene                      | literal `{kind, durationSeconds \| durationBeats}`                                                                                                 | `transitionSchema`                                                                                                                                                                           | `kind` ∈ `cut` / `environment-dissolve` / `fade-through-black`. First scene defaults to `cut` (0s); later scenes default to `environment-dissolve` (0.8s). A `cut` is instantaneous: it resolves to 0s unless a duration is stated. Seconds bound 0–3, beats 0–32, and beats convert at the scene bpm into that seconds range — one unit per transition (see "Counted time").                                                                                                                                                                                                                                                                                          |
| showStage / showAudience        | scene (`location`)         | literal booleans                                                                                                                                   | `sceneSchema`                                                                                                                                                                                | Both default `false`. Applied through the scene-feature context in `FilmDirectorScene.svelte`, not through `director-viewer-adapter.ts`.                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| location.visiblePlanes          | scene (`location`)         | literal `Plane[]`, default `[]`                                                                                                                    | `sceneSchema`, `Plane` enum (`@austencloud/scene-3d`)                                                                                                                                        | Not directive-capable — a director names an exact set of grid planes to show, not a pick. Duplicate rejected: `location.visiblePlanes lists "<value>" twice.`; unknown value: same catalog message as leftPlane.                                                                                                                                                                                                                                                                                                                                                                              |
| sceneFeatures                   | scene (`location`)         | literal `Record<string, boolean>`                                                                                                                  | `sceneSchema`                                                                                                                                                                                | Merges onto the built-in defaults (`environment: true`, `campfire`/`tent`: false, `stage`/`audience` from `showStage`/`showAudience`). Feature keys are whatever the active environment's `scene-feature-registry.ts` recognizes; unknown keys are silently inert (no rejection).                                                                                                                                                                                                                                                                                                             |
| seed                            | film                       | literal `{base?: int, axes?: Record<string, int>}`                                                                                                 | `directive-random.ts` (`resolveFilmSeed`)                                                                                                                                                    | `base` defaults to a stable hash of the film `id` (`hashString(filmId)`). Every directive draw is seeded from `${base}\0salt\0sceneId\0axis`, where `salt = seed.axes[axis] ?? 0`. Bumping one axis's salt rerolls only that axis, everywhere it's drawn, without disturbing any other axis's picks. Effect-preset `{pick:"any"}` draws use the axis name `effectPreset:<effectId>`, so each configurable effect's preset reroll has its own independent salt.                                                                                                                                |
| format                          | film                       | literal `{width?, height?, fps?}`                                                                                                                  | `FilmDirectorInputSchema`                                                                                                                                                                    | Bounds: width 640–7680, height 360–4320, fps 24–120.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| playback                        | film                       | literal `{loop?, autoplay?}`                                                                                                                       | `FilmDirectorInputSchema`                                                                                                                                                                    | —                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| effectPresets                   | scene                      | `Record<effectId, presetId \| {pick:"any"}>`                                                                                                       | effect registry preset groups (`effect-registry.ts`, `getRegistration(effectId).presetGroup.presets`)                                                                                        | unknown effect: `Effect preset references unknown effect "<id>".`; unknown preset: `Effect "<id>" has no preset named "<preset>".`; `{pick:"any"}` with no registered presets: `has no registered presets to pick from.`                                                                                                                                                                                                                                                                                                                                                                      |
| effectOverrides                 | scene                      | `Record<effectId, Record<string, unknown>>`                                                                                                        | validated against `effect-registry.ts` registration only (property-level values are NOT validated against the effect's own schema)                                                           | unknown effect: `Effect overrides reference unknown effect "<id>".`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| camera keyframes                | scene                      | literal array of `{atSeconds \| atBeats, position, target?, fovDeg?, interpolation?, easing?}`                                                     | `film-director-schema.ts` `cameraKeyframeSchema`                                                                                                                                             | A keyframe states its cue in seconds or in beats — exactly one, converted at the scene bpm (see "Counted time"). Mutually exclusive with the framing grammar (`shotSize`/`angle`/`position`/`moves`/`subject`) and with `preset` (unless `preset: "custom"`, which requires at least one keyframe).                                                                                                                                                                                                                                                                                           |
| camera framing grammar          | scene                      | `subject` + `shotSize`/`angle`/`position` + `moves[]`, each move `{move, amount?, direction?, durationSeconds? \| durationBeats?, easing?}`        | `src/routes/test/film-director/_lib/camera-language.ts`                                                                                                                                      | A move's length is stated in seconds or beats, one unit per move, converted at the scene bpm (see "Counted time"); moves that state neither split the scene's remaining time evenly. Exclusivity rules enforced by `cameraSchema`'s `.refine()`s (keyframes vs. framing; preset vs. framing; `subject` vs. `target`; `track` only on `subject`; `shots` vs. each of framing/preset/keyframes/target). A performer `subject` may add `track: true` (aim) or `track: "follow"` to stay framed while they walk. Per-move unit/direction contradictions enforced by `validateMove()` in `camera-language.ts` (e.g. `orbit` takes degrees + cw/ccw only, `push-in`/`pull-back` take meters and no direction). `move` ∈ `hold`/`push-in`/`pull-back`/`orbit`/`crane`/`pan`/`truck`/`zoom`/`roll`: `truck` takes meters + left/right, `zoom` takes degrees + in/out and rejects outside 20–100, `roll` takes degrees + cw/ccw. Several framings in one scene are spoken as `shots: [...]` (2-16), each a full framing plus an optional duration, joined by hard cuts - see "Mid-scene cuts" under Grammar gaps. |
| cast block                      | scene (`performance.cast`) | `{count: 1-8, defaults?, performers?: override[]}`                                                                                                 | `castSchema`                                                                                                                                                                                 | Mutually exclusive with `performance.performers` (schema `.refine()`). Overrides addressed by `id` (`performer-<n>`) fill their named slot; overrides with no `id` fill remaining slots in array order. An `id` that doesn't match any of the cast's performers rejects: `Cast override "<id>" does not match any of the <n> performers.`                                                                                                                                                                                                                                                     |

## Sequence directives

A performer's `sequence` names exactly one source, and the two generated
sources take controls. "DJ, starting at beta at south, one turn every step" is
`{word: "DJ", startPosition: {group: "beta", location: "south"}, turns: 1}`.

| Source                         | Shape      | Meaning                                                                                                                                                                                                                             |
| ------------------------------ | ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `{source: "demo"}`             | literal    | The film's shared sequence. Takes no controls.                                                                                                                                                                                      |
| `{mirrorOf: "<performer id>"}` | literal    | That performer's sequence reflected across the north-south axis (`mirrorSequence`). Takes no controls — a mirror reflects its source exactly, so a control written here would have to disagree with the thing it claims to reflect. |
| `{word: "DJDJDJ"}`             | 1–24 chars | Spell it. `length` echoes the spelled length.                                                                                                                                                                                       |
| `{length: 8}`                  | 1–64       | Improvise that many steps.                                                                                                                                                                                                          |

Controls, all optional, all on the generated sources only. Each compiles to a
`GenerationOptions` field the orchestrator actually reads — verified call-site
by call-site, because `GenerationOptions.propContinuity` reads like the
prop-continuity knob and reaches neither `builder.build()`.

| Control            | Spoken form                                                                   | Compiles to                                                                                                                   |
| ------------------ | ----------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `startPosition`    | `"beta5"`, `{left: "s", right: "s"}`, or `{group: "beta", location: "south"}` | `startPositionId`                                                                                                             |
| `endPosition`      | one position ref or an array of up to 16                                      | `endPositions`                                                                                                                |
| `turns`            | `1` · `[1, 0]` · `{left: [1, 0], right: 0}` · `{intensity: 2}`                | `turnPattern`, or `turnIntensity` for the `{intensity}` form                                                                  |
| `level`            | `1` \| `2` \| `3` (default 2)                                                 | `difficulty` (beginner/intermediate/advanced), and the turn pool the figure is checked against                                |
| `startOrientation` | `"in"` \| `"out"` \| `"clock"` \| `"counter"`, or `{left, right}`             | `leftStartOrientation` / `rightStartOrientation`                                                                              |
| `gridMode`         | `GridMode` value (default `diamond`)                                          | `gridMode`                                                                                                                    |
| `flow`             | `"smooth"` \| `"mixed"` \| `"choppy"` (default smooth)                        | `constraintPreset` — the prop-continuity axis                                                                                 |
| `handPath`         | same three                                                                    | `handPathMode`                                                                                                                |
| `motionTypes`      | `"no-dash"` \| `"prefer-dash"`                                                | `motionTypeFilter`                                                                                                            |
| `loop`             | a `LOOPType`, or `{type, period: "halved" \| "quartered"}`                    | `loopType` + `period`, **and** `mode: CIRCULAR` — without the mode the engine never reads either, so a LOOP directive sets it |
| `mustContain`      | letters, up to 24                                                             | `mustContainLetters`                                                                                                          |
| `mustNotContain`   | letters, up to 24                                                             | `mustNotContainLetters`                                                                                                       |

Notes worth knowing before writing one:

- **A turn figure repeats; an intensity runs out.** `turns` becomes
  `turnPattern`, read modulo its own length, so it still answers at the bridge
  steps the search inserts. `{intensity}` is a fixed-length random allocation
  that leaves inserted steps unturned. Say a figure when you mean "every step."
- **A hand left out of a `{left, right}` figure rests.** `{left: [1, 0]}` gives
  right `[0]`, not the right hand's default roll.
- **`{group, location}` is unambiguous only for beta**, where both hands share
  a point. Alpha has two candidates per location and gamma four, so those throw
  and list them: `"alpha at s" could be alpha1 (left s, right n) or alpha5 (left
n, right s). Name one, or give a {left, right} pair.` Locations accept `n`,
  `north`, or `North-East`.
- **The level gates the turn pool.** Level 1 allows only 0, level 2 whole turns
  to 3, level 3 adds halves and the float marker `"fl"`. A turn outside the
  level names the pool it violated.
- **An illegal directive stops the film at load**, the way a bad `mirrorOf`
  does. An engine that cannot satisfy a legal request still falls back to the
  demo sequence with a console reason.

## Camera orbit direction convention

`orbit` moves take `direction: "cw" | "ccw"`. The sign convention follows the
azimuth math in `camera-language.ts` (see the comment above the `orbit`
branch in `resolveDirectorCameraTrack`): increasing azimuth rotates +z toward
+x, which is clockwise viewed from above, so `cw` increases the angle and
`ccw` decreases it. The felt on-screen direction has not been visually
confirmed against this convention yet — if Austen reads a `cw` orbit as
turning the wrong way on screen, the fix is flipping the sign in that one
branch, not the schema.

## Camera roll direction convention

`roll` moves take `direction: "cw" | "ccw"` and accumulate into a resolved
keyframe's `rollDeg`; `cw` adds, `ccw` subtracts. Positive `rollDeg` rolls the
camera body clockwise as seen from behind the camera, so the world in the frame
tips the other way: verticals lean left and the horizon's right side drops.
That is the cinematographer's sense of "roll clockwise" (the camera moves, the
picture counter-rotates) and it was confirmed on screen 2026-09-01 at
`rollDeg: 10` — the camera's local x-axis measured 9.975 degrees off the world
horizontal and the performers leaned left. If a director wants the picture to
tip clockwise instead, they say `ccw`.

The roll lives in viewer state (`viewer3DState.cameraRollDeg`), not on the
camera directly: camera-controls rewrites the camera's position and `lookAt`
every frame, so a one-shot `rotateZ` was erased before the next render.
`Viewer3DCamera` re-applies the roll after the controls' task each frame
(`useTask(..., { after: ORBIT_UPDATE_TASK })`), from scratch — reset `up`,
`lookAt` the controls' target, then `rotateZ` — so it cannot accumulate on a
frame where the controls did not run. A scene's first roll anchors the ramp
with an explicit `rollDeg: 0` keyframe before it starts turning, so the tilt
reads as departing from level rather than snapping in partway rolled.

## Real but not yet speakable

Swept from `src/routes/test/film-director/_lib/director-viewer-adapter.ts`
against the per-performer setter API on the character/performer state factory
(`src/lib/shared/3d/state/character-instance-state.svelte.ts`) and the viewer-level
setter API (`src/lib/shared/3d/state/viewer-3d-state.svelte.ts`). Each of these
is a real, callable setter the director adapter has access to but never calls
with a directed value — it either hardwires a constant into
`buildDirectorViewerSeed` or never touches the field at all.

Per-performer hand plane (`performer.setHandPlane`), per-step hand plane
(`performer.setStepHandPlane`), and plane visibility
(`viewer.togglePlane`/`showAllPlanes`/`hideAllPlanes`/`visiblePlanes`) were in
this table until 2026-08-24 — they are now speakable as `leftPlane`/
`rightPlane`/`stepPlanes` and `location.visiblePlanes` in the directive-capable and
literal-axes tables above. The remaining rows below were reviewed the same day
and each got an explicit ruling, not a "maybe later":

| Setter / field                                 | Real owner                  | Adapter's current behavior                                                                                         | Status (2026-08-24 ruling)                                                                                                                                                                                                       |
| ---------------------------------------------- | --------------------------- | ------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `viewer.setOceanVariant(v: OceanVariant)`      | `viewer-3d-state.svelte.ts` | `buildDirectorViewerSeed` hardwires `oceanVariant: "abyss"` regardless of which environment the scene resolves to. | **SHELVED.** "There's only one ocean" — stays hardwired to `abyss`. No schema axis; not a candidate for one.                                                                                                                     |
| `viewer.setNavMode(value: ViewerNavMode)`      | `viewer-3d-state.svelte.ts` | `buildDirectorViewerSeed` hardwires `navMode: "orbit"`.                                                            | **DROPPED.** Nav mode is a viewer navigation control; the director camera overrides it every frame (`applyDirectorCameraFrame`), so it cannot affect what's on screen during a rendered film. Not a candidate for a schema axis. |
| `viewer.toggleGridLabels()` / `showGridLabels` | `viewer-3d-state.svelte.ts` | `buildDirectorViewerSeed` hardwires `showGridLabels: false`.                                                       | **Hardwired off BY DECISION.** Default-off confirmed 2026-08-24, not a gap. Not a candidate for a schema axis.                                                                                                                   |

## Grammar gaps

None open. Closed so far:

- **Beats as a time unit** (closed 2026-08-30). Before this gap closed, every
  duration field in the scene schema accepted only `durationSeconds` — a
  director who counts music had to do the beats-to-seconds arithmetic
  themselves and write the result by hand. Every duration field now takes a
  `durationBeats` twin (and camera keyframes an `atBeats` twin), converted
  ONCE at the top of `resolveScene` via `convertSceneBeatTimes`
  (`director-beat-times.ts`), using the scene's own `performance.bpm` — every
  compiler downstream (move windows, blocking, camera) keeps thinking purely
  in seconds and never learns beats exist. A beat count that converts outside
  its field's valid seconds range rejects in the unit it was spoken in, and
  names whether the bpm was stated or defaulted (see "Counted time" above).
  `/test/film-director?film=proving` scene 2 ("on-the-beat") states its whole
  clock in beats: a 16-beat scene, an 8-beat camera push, and an 8-beat
  crossing walk.
- **Distinct + exclude in one directive** (closed 2026-08-30). The canonical
  `NormalizedDirective` shape (`directives.ts`) could always represent
  `{kind: "pick", distinct: true, pool, exclude: [...]}`, but the Zod union's
  `{pick}` variant carried no `not`, so no input spelling reached that state —
  "give everyone a different prop, but never LED" was unsayable. The `{pick}`
  variant now takes an optional `not` (one value or a list), and
  `normalizeDirective` checks `pick` before the bare `{not}` form so a
  `{pick, not}` object cannot fall through to the exclude-only branch.
  `/test/film-director?film=proving` exercises it on two axes at once.
- **Camera edges: truck, zoom, roll** (closed 2026-08-30). Before this gap
  closed, the camera vocabulary stopped at `hold`/`push-in`/`pull-back`/
  `orbit`/`crane`/`pan` — no move slid the frame sideways without turning it,
  tightened the lens without moving the rig, or tilted the horizon. Three
  moves close it: `truck` (meters, `left`/`right`) translates position and
  target together along the camera-right ground axis; `zoom` (degrees,
  `in`/`out`) adjusts `fovDeg` in place and rejects rather than clamps when a
  request would take the lens outside 20–100 degrees, naming the degrees
  asked for, the fov it would reach, and the fov it is at; `roll` (degrees,
  `cw`/`ccw`) ramps a new `rollDeg` field from an explicit `0` anchor on a
  scene's first roll. `rollDeg` is optional on a resolved keyframe (present
  only where a roll ran, so every film that never rolls stays byte-identical
  to its pre-roll snapshot) and required on a sampled `DirectorCameraFrame`
  (always `0` when absent). Positive `rollDeg` means clockwise as the audience
  sees the frame — see "Camera roll direction convention" above for the sign,
  including that it has not yet been visually confirmed. `/test/film-director?film=proving`
  scene 3 ("camera-edges") states all three in one breath: a one-meter truck,
  a fifteen-degree zoom, and a ten-degree clockwise roll. A `truck` from a
  framing that looks straight up or down rejects (no sideways to slide along),
  and the sampler holds a flat fov or roll segment exactly instead of letting
  Catmull-Rom bow it toward the neighbouring keyframes.
- **Camera tracks a walking performer** (closed 2026-09-01). Before this gap
  closed, the compiler framed the cast where it stood when the scene opened and
  the camera stayed aimed there, so a performer who walked left the frame
  behind. A performer `subject` now takes `track: true` or `track: "follow"`.
  `true` aims: the camera stays put and turns its target with the walker.
  `"follow"` travels: target and position both move with them, so the framing
  holds constant. The keyframe compiler is untouched — resolution records
  `camera.tracking: {performerId, mode}` and `applyCameraTracking` in
  `sample-film-director.ts` offsets the sampled camera by the performer's live
  displacement from their resolved opening mark (measured from that mark, not
  the first blocking keyframe, so blocking that opens on a hold still tracks).
  `tracking` is optional and absent when unused, so every film that does not
  track resolves byte-identically to its pre-tracking snapshot. Grammar only:
  `track` on a preset's `target` or on a raw keyframe target rejects, because
  those aim exactly where their target says.
  `/test/film-director?film=proving` scene 4 ("tracking-shot") follows a
  three-meter crossing with a medium shot that holds its framing throughout.
- **Mid-scene cuts** (closed 2026-09-01). Before this gap closed a scene held
  one framing for its whole length: to cut, a director split the shot into
  separate scenes and rebuilt cast, location, and blocking in each. `camera`
  now takes `shots: [...]`, 2–16 entries, each a complete framing (`subject`,
  `shotSize`, `angle`, `position`, `moves`) plus an optional `durationSeconds`
  or `durationBeats`. Shots that state no duration split the scene's remaining
  time evenly, exactly as moves do; a stated total longer than the scene
  rejects by name (`Camera shots total 20s but the scene's duration is 16s.`).
  `compileCameraShots` (`camera-language.ts`) frames and compiles each shot in
  its own window with the existing `computeCameraFraming` +
  `compileCameraMoves`, shifts the result to where that window sits, and marks
  the last keyframe of every shot but the final one `interpolation: "step"`.
  The sampler holds that step until the next shot's first keyframe, which sits
  at the same instant — the cut — and treats a step as a tangent barrier so the
  Catmull-Rom spline on either side never bends toward framing that belongs to
  another shot. One track out; nothing downstream of the keyframes changed.
  Exclusive with a single top-level framing (`subject`/`shotSize`/`angle`/
  `position`/`moves`), with `preset`, with raw `keyframes`, and with `target`
  (`subject` is spoken inside each shot); a lone shot rejects, because one shot
  is just a framing. Limit: `track` inside a shot rejects. Tracking offsets the
  whole resolved track by one walker's displacement, which cannot describe a
  walker followed in one shot and dropped in the next. Closing this gap also
  made `transition: {kind: "cut"}` instantaneous — it had defaulted to a 0.8s
  dissolve window, which is not a cut. A stated `durationSeconds` still wins.
  `/test/film-director?film=proving` scene 5 ("three-shots") cuts twice inside
  one scene: a wide front two-shot, a low close-up that pushes in, and a high
  medium shot from behind.

## Spoken but not real (proven rejections)

Things a director might plausibly ask for that the schema correctly rejects
because the capability does not exist at the scope requested, or does not
exist in the app's control surface at all:

- **Per-performer prop color / tint.** No setter exists anywhere in
  `src/lib/shared/3d` or `@austencloud/scene-3d`'s `AvatarSkeletonBuilder` for
  an individually colored prop. The colors seen in the UI
  (`src/lib/shared/3d/components/controls/PropPopover.svelte`'s
  `getPerformerColor(index)`) are a fixed index-based UI accent, not a
  material property that can be assigned.
- **Character scale / height, per performer.** `setScale(scale)` exists on
  `AvatarSkeletonBuilder` (`@austencloud/scene-3d`), but nothing in this app
  calls it per performer — the only caller path is the global
  `userProportionsState` singleton (`user-proportions-state.svelte.ts`), which
  derives one character scale for the whole scene from the user's own height/
  build settings. There is no per-performer entry point to override it.
- **Lighting** (per-scene or per-environment light rig control). No schema
  axis, no adapter hook, no setter surfaced to the director path.
- **9+ performers.** `castSchema.count` caps at 8 (`z.number().int().min(1).max(8)`);
  `performanceSchema.performers` caps at 8 as well.
- **`distinct`/`sameAs` on a scene-scoped axis** (`environmentId`, `formation`).
  These concepts require multiple performers to be meaningful; a scene has
  exactly one resolved value. Rejects with the message in the axis table
  above — including `{pick: "distinct", not}`, where the combined spelling
  does not buy `distinct` a scope it never had.
- **Two time units on one field.** `durationSeconds` and `durationBeats`
  together, or a keyframe's `atSeconds` with `atBeats`, reject rather than
  picking a winner. See "Counted time" above.
- **A nonexistent character, prop, effect, effort, environment, or formation
  name.** Every axis validates against its live catalog and rejects by name
  (see the "Rejection behavior" column above) — there is no silent fallback.

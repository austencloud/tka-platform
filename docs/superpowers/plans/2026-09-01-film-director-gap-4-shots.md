# Film Director Gap 4 — Mid-Scene Cuts (`camera.shots`)

> Executor plan. Worktree: `E:\worktrees\tka-platform\director-gaps`, branch
> `claude/director-gaps`. Campaign ledger:
> `docs/superpowers/plans/2026-08-30-film-director-gap-campaign.md`.

**Goal:** a director can cut between framings inside one scene:

```ts
camera: {
  shots: [
    { subject: {kind:"group"}, shotSize: "wide", angle: "eye", position: "front", durationBeats: 6 },
    { subject: {kind:"performer", performerId:"performer-1"}, shotSize: "close-up", angle: "low", position: "front",
      moves: [{ move: "push-in", amount: { meters: 0.5 } }], durationBeats: 6 },
    { subject: {kind:"group"}, shotSize: "medium", angle: "high", position: "behind" },
  ],
}
```

Each shot is a complete framing block (same fields as today's single framing:
`subject`, `shotSize`, `angle`, `position`, `moves`) plus an optional
`durationSeconds` or `durationBeats`. Consecutive shots are joined by a hard
cut. Shots that state no duration split the scene's remaining time evenly,
exactly like moves do.

**Architecture:** `shots` compiles to ONE keyframe track. Each shot is
compiled independently with the existing `computeCameraFraming` +
`compileCameraMoves` (with a context whose `durationSeconds` is the shot's
length), its keyframes are shifted by the shot's start time, and the last
keyframe of every non-final shot is marked `interpolation: "step"` so the
sampler holds it until the next shot's first keyframe, which sits at the same
instant. The sampler gains one rule so Catmull-Rom tangents do not leak across
a step boundary. Nothing downstream of the keyframe track changes.

This gap also owns the deferred cut-semantics item from wave 1: a scene
`transition: {kind:"cut"}` still resolved a 0.8 s transition window. A cut is
instantaneous. The resolver default becomes 0 s for cuts.

**Files:**
- Modify `src/routes/test/film-director/_lib/film-director-schema.ts`
- Modify `src/routes/test/film-director/_lib/director-beat-times.ts`
- Modify `src/routes/test/film-director/_lib/director-camera-track.ts`
- Modify `src/routes/test/film-director/_lib/camera-language.ts`
- Modify `src/routes/test/film-director/_lib/resolve-film-director-spec.ts` (cut default)
- Modify `src/routes/test/film-director/_films/proving-grounds.ts`
- Modify `docs/reference/film-director-capability-matrix.md`
- Tests: `tests/unit/film-director/film-director-schema.test.ts`,
  `tests/unit/film-director/camera-language.test.ts`,
  `tests/unit/film-director/director-camera-track.test.ts`,
  `tests/unit/film-director/director-beat-times.test.ts`,
  `tests/unit/film-director/film-library.test.ts`,
  regenerate `tests/unit/film-director/__snapshots__/film-resolution-snapshot.test.ts.snap`.

Suite: `node node_modules/vitest/vitest.mjs run --config tests/config/vitest.config.ts tests/unit/film-director`
(`-u` only for the snapshot step).

**Snapshot expectations for this gap (read before regenerating):** the
Proving Grounds block changes (new scene 5). ALSO, because the cut default
changes, every shipped scene that states `transition: {kind:"cut"}`
(understudy-night, chance-suite, ember, figures, nine-planes, and proving
scenes 2 and 4) changes its `transition.durationSeconds` from `0.8` to `0`.
Nothing else may change. After `-u`, run
`git diff -U0 tests/unit/film-director/__snapshots__ | grep -E '^[-+]' | grep -vE 'durationSeconds|^(---|\+\+\+)'`
and confirm every remaining hunk is inside the Proving Grounds block. Report
the list of films whose blocks changed.

---

## Task 1 — Schema

In `film-director-schema.ts`, extract the framing fields into a reusable
shape so a shot and the top-level camera share one definition. The existing
`cameraSchema` object literal has `subject`, `shotSize`, `angle`, `position`,
`moves`; pull those five into `const cameraFramingFields = { ... }` and spread
them into both `cameraSchema` and a new:

```ts
const cameraShotSchema = z
  .object({
    ...cameraFramingFields,
    durationSeconds: finiteNumber.positive().optional(),
    durationBeats: finiteNumber.positive().optional(),
  })
  .strict()
  .superRefine(atMostOneTimeUnit);
```

Add to `cameraSchema`: `shots: z.array(cameraShotSchema).min(2).max(16).optional()`.
The `.min(2)` message must say why: `"One shot is just a framing. State it directly on camera, or give shots at least two entries to cut between."`
(zod: `.min(2, { message })`).

Exclusivity refines to add on `cameraSchema` (keep every existing refine):
- `shots` vs single-framing fields (`subject`/`shotSize`/`angle`/`position`/`moves`):
  `'Shots and a single framing are exclusive. Put every framing inside "shots".'`
- `shots` vs `preset`: `"A preset and shots are exclusive. Shots are their own framing."`
- `shots` vs `keyframes`: `"Raw keyframes and shots are exclusive. Use one."`
- `shots` vs `target`: `'Use "subject" inside each shot, not "target".'`

The `usesGrammar` computation in `resolveDirectorCameraTrack` and the
"Raw keyframes and framing grammar are exclusive" resolver checks must treat
`shots` as grammar too (Task 3).

Tests (`film-director-schema.test.ts`): a two-shot film parses; one shot
rejects with `/at least two/`; shots + `shotSize` at the top level rejects
with `/exclusive/`; shots + preset rejects; shots + keyframes rejects; a shot
stating both `durationSeconds` and `durationBeats` rejects (reuse the existing
"one time unit" message assertion pattern from the moves tests).

## Task 2 — Beat conversion

In `director-beat-times.ts` (the `if (scene.camera)` block, ≈ line 149):
convert `camera.shots` the way `camera.moves` is converted. For each shot:
convert the shot's own `durationBeats` via `convertDuration(shot, bpm.value)`,
and convert `shot.moves` entries the same way `camera.moves` are. Only mark
`cameraChanged` when something actually converted (follow the file's existing
identity-preserving pattern so the "does not mutate / returns same object"
tests keep passing).

Tests (`director-beat-times.test.ts`): a scene at 120 bpm with
`shots: [{..., durationBeats: 8, moves: [{move:"push-in", durationBeats: 4}]}, {...}]`
converts to `durationSeconds: 4` and the move to `durationSeconds: 2`, and the
input object is not mutated. A scene whose shots state only seconds returns
the same `camera` object identity.

## Task 3 — Compile shots to one track

In `camera-language.ts` add:

```ts
export interface DirectorCameraShot extends DirectorFramingInput {
  moves?: DirectorCameraMove[];
  durationSeconds?: number;
}

/**
 * Gap 4. Several framings inside one scene, joined by hard cuts. Each shot is
 * framed and its moves compiled exactly as a single-framing camera would be,
 * inside its own time window, then shifted to where that window sits in the
 * scene. The last keyframe of every shot but the final one is a step so the
 * sampler holds it until the next shot's first keyframe, which starts at the
 * same instant: the cut.
 */
export function compileCameraShots(
  shots: readonly DirectorCameraShot[],
  context: CameraLanguageContext
): ResolvedDirectorCameraKeyframe[] {
  const windows = allocateMoveWindows(shots, context.durationSeconds, "Camera shots");
  const frames: ResolvedDirectorCameraKeyframe[] = [];
  shots.forEach((shot, index) => {
    const { start, end } = windows[index]!;
    const length = end - start;
    if (length <= 1e-6) {
      throw new Error(
        `Camera shot ${index + 1} has no time. Every shot needs a duration, stated or left over.`
      );
    }
    const shotContext = { ...context, durationSeconds: length };
    const framing = computeCameraFraming(
      { subject: shot.subject, shotSize: shot.shotSize, angle: shot.angle, position: shot.position },
      shotContext
    );
    const compiled = compileCameraMoves(shot.moves ?? [{ move: "hold" }], framing, shotContext);
    const isLast = index === shots.length - 1;
    compiled.forEach((frame, frameIndex) => {
      const shifted = { ...frame, atSeconds: frame.atSeconds + start };
      if (!isLast && frameIndex === compiled.length - 1) shifted.interpolation = "step";
      frames.push(shifted);
    });
  });
  return frames;
}
```

Read `computeCameraFraming`'s real signature and the shape of `context` before
writing this; adapt names, keep semantics. Note `allocateMoveWindows` already
throws when stated durations exceed the scene; its message uses the `subject`
string, so "Camera shots" reads: `Camera shots total 20s but the scene's duration is 16s.`

Wire it in `resolveDirectorCameraTrack` (`director-camera-track.ts`):
`usesGrammar` includes `input.shots`; when `input.shots` is present, return
`{ preset: "custom", substitutedFor: null, keyframes: compileCameraShots(input.shots, context) }`.
Tracking (Gap 3) and shots: a shot's `subject.track` would need per-shot
tracking, which the resolved `camera.tracking` cannot express. Reject it with
`'Tracking and shots do not combine yet. Track a walker with a single framing, or cut between shots without "track".'`
and add that as a schema refine as well (`shots.some(s => s.subject?.kind === "performer" && s.subject.track)`).

Sampler rule (`sampleDirectorCameraTrack` in `director-camera-track.ts`, the
`before`/`after` neighbour selection ≈ lines 395–396): a step keyframe is a
tangent barrier.

```ts
let before = keyframes[Math.max(0, startIndex - 1)] ?? start;
let after = keyframes[Math.min(keyframes.length - 1, endIndex + 1)] ?? end;
// A step keyframe is a cut: the spline on either side must not bend toward
// framing that belongs to a different shot.
if (before.interpolation === "step") before = start;
if (end.interpolation === "step") after = end;
```

Two keyframes now share an instant at every cut (shot N's last, shot N+1's
first). Confirm by reading the sampler that `findIndex(frame.atSeconds > t)`
picks shot N's terminal frame as `end` for `t < cut` and shot N+1's first frame
as `start` for `t >= cut`. The raw-keyframe path's "cannot share the same time"
check applies only to raw keyframes; do not extend it to compiled tracks.

Tests (`camera-language.test.ts` + `director-camera-track.test.ts`): three
shots over a 12 s scene, no durations → windows 0–4, 4–8, 8–12; the compiled
track's keyframes are non-decreasing in time; the frame at 4 s from shot 1 has
`interpolation: "step"` and shot 2's first frame is also at 4 s with shot 2's
framing; the final shot's last frame is NOT step-forced (it keeps what
`compileCameraMoves` gave it). Sampling: at 3.999 s the frame equals shot 1's
hold position exactly; at 4 s it equals shot 2's framing; with shot 1 holding
and shot 2 pushing in smoothly, the position sampled at 4.5 s lies on the
straight segment between shot 2's start and end positions within 1e-6 in each
axis (proves the tangent barrier: without it the spline bends toward shot 1).
Stated durations: `[{durationSeconds: 2}, {}, {durationSeconds: 4}]` on 12 s
→ 0–2, 2–8, 8–12. Over-long total rejects with `/Camera shots total/`.

## Task 4 — Cut transitions are instantaneous

`resolve-film-director-spec.ts` ≈ line 804: compute `kind` first, then
`durationSeconds: scene.transition?.durationSeconds ?? (sceneIndex === 0 || kind === "cut" ? 0 : 0.8)`.
Then read `FilmDirectorScene.svelte` `beginSceneTransition` (≈ lines 258–330)
and the snapshot-fade CSS around line 561 and confirm a `snapshotDurationMs`
of 0 still: captures the outgoing frame, holds it while the incoming scene
prepares, and drops it the moment the incoming frame is ready without a
visible dissolve. If a 0 ms CSS transition would skip `transitionend` and leave
the snapshot stuck, handle that path explicitly (e.g. hide immediately when
`snapshotDurationMs === 0`). Report what you found and what you changed.

Test (`resolve-directive-spec.test.ts` or `film-director-schema.test.ts`): a
second scene with `transition: {kind:"cut"}` and no duration resolves to
`durationSeconds: 0`; a second scene with no transition still resolves to
`environment-dissolve` / `0.8`; an explicit `{kind:"cut", durationSeconds: 0.5}`
keeps 0.5.

## Task 5 — Proving Grounds scene 5

Append (do not edit scenes 1–4):

```ts
{
  id: "three-shots",
  title: "Three Shots",
  intent:
    "Gap 4: one scene, three framings, two hard cuts. A wide front two-shot for six beats, then a cut to a low close-up on the left performer that pushes in for six beats, then a cut to a high medium shot from behind for the last four. The frame jumps at each cut; nothing glides between framings.",
  durationBeats: 16,
  transition: { kind: "cut" },
  location: { environmentId: "cosmic" },
  performance: {
    bpm: 120,
    formation: "side-by-side",
    cast: { count: 2, defaults: { effect: "none" } },
  },
  camera: {
    shots: [
      { subject: { kind: "group" }, shotSize: "wide", angle: "eye", position: "front", durationBeats: 6 },
      {
        subject: { kind: "performer", performerId: "performer-1" },
        shotSize: "close-up",
        angle: "low",
        position: "front",
        moves: [{ move: "push-in", amount: { meters: 0.4 } }],
        durationBeats: 6,
      },
      { subject: { kind: "group" }, shotSize: "medium", angle: "high", position: "behind" },
    ],
  },
},
```

Add a Gap 4 paragraph to the film's top doc comment and one sentence to
`brief`: "A fifth scene cuts between three framings without a single glide."

`film-library.test.ts` Proving Grounds block: scene `three-shots` resolves;
keyframes at 3 s and 6 s exist; the keyframe at 3 s is `step`; sampling at
2.99 s vs 3.0 s moves the camera position by more than 1 m (a real cut, not a
glide); sampling at 6.0 s vs 5.99 s likewise; the scene's first frame is at
0 s with a wide framing (position farther from target than the close-up's at
3 s). Also assert the two cut scenes (`on-the-beat`, `tracking-shot`,
`three-shots`) resolve `transition.durationSeconds === 0`.

## Task 6 — Capability matrix

`docs/reference/film-director-capability-matrix.md`: find the mid-scene cut /
`camera.shots` gap entry and rewrite it as closed, mirroring the Gap 3 entry's
shape (spelling, semantics, exclusivity list, the tangent-barrier rule, the
"tracking and shots do not combine" limit, the cut-transition default change,
proving scene id). Run `capability-matrix.test.ts`.

## Task 7 — Gate, commit

1. Full film-director suite green; report `Tests N passed`.
2. `npm run check:fast > /tmp/check.log 2>&1; grep -nE "film-director" /tmp/check.log` — touched files error-free (the two pre-existing `FilmDirectorScene.svelte` performer-edit typing errors are baseline; leave them).
3. Commit with explicit pathspecs only, message ends with
   `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`.

Report: SHA, test totals, snapshot-diff film list, what Task 4's snapshot
investigation found, deviations.

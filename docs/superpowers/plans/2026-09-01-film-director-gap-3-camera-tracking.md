# Film Director Gap 3 — Camera Tracks a Walking Performer

> Executor plan. Worktree: `E:\worktrees\tka-platform\director-gaps`, branch
> `claude/director-gaps`. Campaign ledger:
> `docs/superpowers/plans/2026-08-30-film-director-gap-campaign.md`.

**Goal:** a director can say `subject: {kind:"performer", performerId, track: true | "follow"}`
and the camera keeps that performer in frame while they walk. `track: true`
aims (the camera stays put and turns its target with the walker);
`track: "follow"` moves both camera and target with the walker, keeping the
framing constant.

**Architecture:** the keyframe compiler is untouched. Tracking is a
sampling-layer composition in `sampleFilmDirector`: after sampling the camera
track and every performer's blocking, offset the camera's target (aim) or
target + position (follow) by the tracked performer's live displacement from
their opening mark. The resolved scene carries `camera.tracking` only when a
scene asked for it (optional field, absent otherwise) so the eight shipped
films' resolved snapshots stay byte-identical.

**Files:**
- Modify `src/routes/test/film-director/_lib/film-director-schema.ts`
- Modify `src/routes/test/film-director/_lib/director-camera-track.ts`
- Modify `src/routes/test/film-director/_lib/sample-film-director.ts`
- Modify `src/routes/test/film-director/_films/proving-grounds.ts`
- Modify `docs/reference/film-director-capability-matrix.md`
- Tests: `tests/unit/film-director/film-director-schema.test.ts`,
  `tests/unit/film-director/director-camera-track.test.ts` (or a new
  `sample-film-director.test.ts`), `tests/unit/film-director/film-library.test.ts`,
  regenerate `tests/unit/film-director/__snapshots__/film-resolution-snapshot.test.ts.snap`.

Run the suite with:

```
node node_modules/vitest/vitest.mjs run --config tests/config/vitest.config.ts tests/unit/film-director
```

Add `-u` only for the snapshot regeneration step, then `git diff` the `.snap`
and confirm the ONLY changed block is Proving Grounds.

---

## Task 1 — Schema: `track` on the performer subject

In `film-director-schema.ts`, the performer variant of `cameraTargetSchema`
(≈ line 267) gains:

```ts
track: z.union([z.literal(true), z.literal("follow")]).optional(),
```

with a doc comment: `true` = aim (camera turns to keep the walker centered),
`"follow"` = camera and target both travel with the walker.

`cameraTargetSchema` is shared by `subject`, `target`, and keyframe `target`.
Tracking is grammar-only. Add a `.refine` to `cameraSchema` (next to the
existing subject/target exclusivity refine) that rejects `track` anywhere
except `subject`:

```ts
.refine(
  (camera) =>
    !(camera.target?.kind === "performer" && camera.target.track) &&
    !camera.keyframes?.some(
      (frame) => frame.target?.kind === "performer" && frame.target.track
    ),
  {
    message:
      'Tracking is spoken on "subject" with framing grammar. Presets and raw keyframes aim where their targets say.',
    path: ["target"],
  }
)
```

Resolved type — in `ResolvedDirectorScene.camera` add:

```ts
/**
 * Present only when the scene's subject asked to be tracked. The sampler
 * offsets the compiled camera by this performer's live displacement from
 * their opening mark: "aim" moves the target, "follow" moves target and
 * position together. Absent (not null) on every other scene so films that
 * never track resolve byte-identically to their pre-tracking snapshots.
 */
tracking?: { performerId: string; mode: "aim" | "follow" };
```

Mirror the field on `ResolvedDirectorCameraTrack` in `director-camera-track.ts`.

Tests (`film-director-schema.test.ts`): (a) a film with
`subject: {kind:"performer", performerId:"performer-1", track:"follow"}`
parses; (b) `track: "aim"` (a string that isn't `"follow"`) is rejected;
(c) `camera: { preset: ..., target: {kind:"performer", performerId, track:true} }`
is rejected with a message matching `/spoken on "subject"/`; (d) a raw
keyframe whose target carries `track` is rejected the same way. Look at how
existing tests build a minimal film and copy that helper.

## Task 2 — Resolver: carry tracking through

In `resolveDirectorCameraTrack` (`director-camera-track.ts`), inside the
`usesGrammar` branch, build the return value as:

```ts
const subject = input!.subject;
const tracking =
  subject?.kind === "performer" && subject.track
    ? {
        performerId: subject.performerId,
        mode: subject.track === "follow" ? ("follow" as const) : ("aim" as const),
      }
    : undefined;
return {
  preset: "custom",
  substitutedFor: null,
  keyframes: compileCameraMoves(...),
  ...(tracking ? { tracking } : {}),
};
```

`resolveSubject` in `camera-language.ts` already throws for a missing
performerId, so no new validation is needed there. Then find where
`resolve-film-director-spec.ts` (≈ line 783) copies `cameraTrack` into the
resolved scene's `camera` and make sure `tracking` rides along (spread the
track, or add the conditional spread — check the exact shape there first).

Tests (`director-camera-track.test.ts`): resolving grammar with
`track: true` yields `tracking: {performerId, mode:"aim"}`; with `"follow"`
yields `mode:"follow"`; without `track` the resolved track has NO `tracking`
key (`expect("tracking" in resolved).toBe(false)`).

## Task 3 — Sampler composition

In `sample-film-director.ts`, replace the `camera:` line with a computed
value. Keep `performerMotion` computed first so it can be reused:

```ts
const performerMotion = scene.performance.performers.map((performer) =>
  sampleDirectorBlockingTrack(performer.blocking, sceneTimeSeconds)
);
const camera = applyCameraTracking(
  sampleDirectorCameraTrack(scene.camera.keyframes, sceneTimeSeconds),
  scene,
  performerMotion
);
```

and add (exported, so it can be unit tested directly):

```ts
/**
 * Gap 3. The compiler framed the tracked performer at their opening mark;
 * this shifts that framing by wherever they have walked since. Aim moves
 * only the target (the camera turns), follow moves target and position
 * together (the framing travels). Displacement is measured from the
 * performer's resolved opening position, not from the first blocking
 * keyframe, so a scene whose blocking starts with a hold still tracks.
 */
export function applyCameraTracking(
  camera: DirectorCameraFrame,
  scene: ResolvedDirectorScene,
  performerMotion: readonly DirectorBlockingFrame[]
): DirectorCameraFrame {
  const tracking = scene.camera.tracking;
  if (!tracking) return camera;
  const index = scene.performance.performers.findIndex(
    (performer) => performer.id === tracking.performerId
  );
  const performer = scene.performance.performers[index];
  const motion = performerMotion[index];
  if (!performer || !motion) return camera;
  const dx = motion.position.x - performer.position.x;
  const dz = motion.position.z - performer.position.z;
  if (dx === 0 && dz === 0) return camera;
  const target: [number, number, number] = [
    camera.target[0] + dx,
    camera.target[1],
    camera.target[2] + dz,
  ];
  if (tracking.mode === "aim") return { ...camera, target };
  return {
    ...camera,
    target,
    position: [camera.position[0] + dx, camera.position[1], camera.position[2] + dz],
  };
}
```

`DirectorCameraFrame` is the return type of `sampleDirectorCameraTrack`
(exported from `director-camera-track.ts` — confirm the name; export it if it
is not). Check that the adapter and `FilmDirectorScene.svelte` consume
`frame.camera` as a value each frame (they do — `applyDirectorCameraFrame`),
so nothing else changes.

Tests (new `tests/unit/film-director/sample-film-director.test.ts`, or
appended to the schema test that already imports `sampleFilmDirector`):
build a two-performer film where performer-2 walks from its formation mark
2 m in -x over 4 s and the camera subject is performer-2 with `track: true`.
Sample at 0 s and at 4 s: target x differs by −2 (toBeCloseTo, 6), target y
unchanged, position identical. Same film with `"follow"`: position x also
differs by −2. Same film with no `track`: target identical at 0 s and 4 s.
Also: `applyCameraTracking` with a tracking id that matches no performer
returns the input unchanged.

## Task 4 — Proving Grounds scene 4

Append a scene to `proving-grounds.ts` (do not edit scenes 1–3):

```ts
{
  id: "tracking-shot",
  title: "Tracking Shot",
  intent:
    "Gap 3: the camera follows a walking performer. A medium shot on the walker holds the same framing for the whole crossing — the walker stays put in frame while the forest slides past behind them — then the frame stops when they do.",
  durationBeats: 16,
  transition: { kind: "cut" },
  location: { environmentId: "forest" },
  performance: {
    bpm: 120,
    formation: "side-by-side",
    cast: {
      count: 2,
      defaults: { effect: "none" },
      performers: [
        {
          id: "performer-2",
          // Side-by-side puts performer-2 at (0.9, 0). A 3 m crossing in
          // the four seconds eight beats buy is 0.75 m/s — a walk.
          blocking: [
            { move: "walk", to: { x: -2.1, z: 0 }, durationBeats: 8, facing: "travel" },
            { move: "stand" },
          ],
        },
      ],
    },
  },
  camera: {
    subject: { kind: "performer", performerId: "performer-2", track: "follow" },
    shotSize: "medium",
    angle: "eye",
    position: "front",
    moves: [{ move: "hold" }],
  },
},
```

Confirm the side-by-side formation mark for performer-2 by reading the
formation code (grep `side-by-side` under `_lib/`) and adjust the `to.x` so
the ground distance is ≈ 3 m. Update the film's top doc comment ("Wave 1
covers…" paragraph list) with a Gap 3 paragraph and extend `brief` with one
sentence: "A fourth scene follows a walker with a medium shot that never
loses them."

`film-library.test.ts` Proving Grounds block — add assertions: scene
`tracking-shot` has `camera.tracking` equal to
`{performerId:"performer-2", mode:"follow"}`; `sampleFilmDirector` at the
scene's start + 4 s versus start + 0 s shifts camera target AND position by
the walker's displacement (toBeCloseTo on x and z, 6 places); at start + 6 s
(standing) the offset equals the 4 s offset. Also assert the other three
scenes have no `tracking` key.

Regenerate the snapshot with `-u`; `git diff --stat` and eyeball the diff:
only the Proving Grounds block changes.

## Task 5 — Capability matrix

In `docs/reference/film-director-capability-matrix.md`: find the row / bullet
that lists Gap 3 (camera tracking a walking performer) as a gap and rewrite it
as closed: spelling (`subject.track: true | "follow"`), semantics (aim vs
follow, sampling-layer offset from the opening mark, compiler untouched),
the grammar-only restriction (presets/keyframes reject `track`), and the
proving scene id. Keep the file's existing table formatting (prettier'd).
`tests/unit/film-director/capability-matrix.test.ts` reads this file — run it
and satisfy whatever it checks.

## Task 6 — Gate, commit

1. Full film-director suite green (report the `Tests N passed` line).
2. `npm run check:fast > /tmp/check.log 2>&1; grep -nE "film-director" /tmp/check.log`
   must show no errors in touched files (≈636 pre-existing errors elsewhere
   are baseline — ignore them; do not fix unrelated files).
3. Commit with explicit pathspec only (list every file you touched; never
   `git add -A`/`.`):

```
git add <paths>
git commit -m "feat(film-director): camera tracks a walking performer (gap 3)" -m "..." -m "Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>" -- <paths>
```

Report back: commit SHA, test totals, the snapshot diff summary, and the
exact opening mark + destination of the walker in scene 4.

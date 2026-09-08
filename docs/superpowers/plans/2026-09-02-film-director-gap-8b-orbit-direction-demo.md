# Film Director Gap 8b: Orbit Direction Demo Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give Austen two side-by-side scenes in Proving Grounds, one `orbit` with `direction: "cw"` and one with `"ccw"`, over staging where the direction of travel is unmistakable, so he can say which reads clockwise. No compiler change in this plan. If he reports the felt direction is inverted, the fix is a one-line sign flip in the `orbit` branch of `camera-language.ts`, done in a follow-up.

**Architecture:** Two appended scenes in `src/routes/test/film-director/_films/proving-grounds.ts`. Both use the same staging: three performers in a `line` formation with three different characters so the frame reads left-to-right, in the forest environment where the trees give a fixed background reference. Camera: group subject, wide, eye, front, a single `orbit` of 90 degrees over the whole scene. Scene A `cw`, scene B `ccw`. Nothing else differs, so the only variable between the two is the sign.

**Tech Stack:** film JSON, vitest snapshot.

Run tests with:

```
node node_modules/vitest/vitest.mjs run --config tests/config/vitest.config.ts tests/unit/film-director
```

---

### Task 1: The two scenes

**Files:**
- Modify: `src/routes/test/film-director/_films/proving-grounds.ts`
- Modify: `tests/unit/film-director/film-library.test.ts`
- Modify: `tests/unit/film-director/__snapshots__/film-resolution-snapshot.test.ts.snap` (regenerated)

- [ ] **Step 1: Read the film as it stands.** Earlier gaps appended scenes after `derived-sequences`; count them and append these two after the last scene. Read the `orbit` move rules in `src/routes/test/film-director/_lib/camera-language.ts` (`validateMove` and the `orbit` branch) to confirm `orbit` takes `amount: {degrees}` and `direction: "cw" | "ccw"`, and confirm three real character ids from `CHARACTER_DEFINITIONS` in `src/lib/shared/3d/domain/character-model.ts`.

- [ ] **Step 2: Write the failing film-library assertion.** In `film-library.test.ts`, next to the existing proving-grounds scene assertions, add:

```ts
it("proving grounds stages the orbit direction pair identically except for the sign", () => {
  const spec = resolveFilmDirectorSpec(provingGroundsFilm);
  const cw = spec.scenes.find((scene) => scene.id === "orbit-clockwise")!;
  const ccw = spec.scenes.find((scene) => scene.id === "orbit-counterclockwise")!;
  expect(cw).toBeDefined();
  expect(ccw).toBeDefined();
  expect(cw.performance.performers.map((p) => p.characterId)).toEqual(
    ccw.performance.performers.map((p) => p.characterId)
  );
  const cwStart = cw.camera.keyframes[0]!.position;
  const cwEnd = cw.camera.keyframes.at(-1)!.position;
  const ccwEnd = ccw.camera.keyframes.at(-1)!.position;
  // Same start, mirrored end: a 90 degree orbit each way from the same front
  // framing lands on opposite sides of the line.
  expect(ccw.camera.keyframes[0]!.position).toEqual(cwStart);
  expect(cwEnd.x).toBeCloseTo(-ccwEnd.x, 6);
  expect(cwEnd.z).toBeCloseTo(ccwEnd.z, 6);
});
```

Adapt the import names and the resolved camera field path (`camera.keyframes[i].position` as an `{x, y, z}` object or an array) to what the resolved type actually is; read `ResolvedDirectorScene` in `film-director-schema.ts` first.

- [ ] **Step 3: Run it to verify it fails** (scenes not found).

- [ ] **Step 4: Append the two scenes.** After the last scene in `proving-grounds.ts`:

```ts
    {
      id: "orbit-clockwise",
      title: "Orbit Clockwise",
      intent:
        "Gap 8b, first half: the camera orbits the line 90 degrees with direction cw. Three different characters stand left to right so the direction of travel reads at a glance. Watch which way the line turns in the frame.",
      durationBeats: 16,
      transition: { kind: "cut" },
      location: { environmentId: "forest" },
      performance: {
        bpm: 120,
        formation: "line",
        cast: {
          count: 3,
          defaults: { effect: "none" },
          performers: [
            { id: "performer-1", characterId: "<first real id>" },
            { id: "performer-2", characterId: "<second real id>" },
            { id: "performer-3", characterId: "<third real id>" },
          ],
        },
      },
      camera: {
        subject: { kind: "group" },
        shotSize: "wide",
        angle: "eye",
        position: "front",
        moves: [{ move: "orbit", amount: { degrees: 90 }, direction: "cw" }],
      },
    },
    {
      id: "orbit-counterclockwise",
      title: "Orbit Counterclockwise",
      intent:
        "Gap 8b, second half: the same staging and the same 90 degree orbit, direction ccw. The line should turn the opposite way from the previous scene. Whichever of the two you would call clockwise decides whether the sign in camera-language.ts stays.",
      durationBeats: 16,
      transition: { kind: "cut" },
      location: { environmentId: "forest" },
      performance: {
        bpm: 120,
        formation: "line",
        cast: {
          count: 3,
          defaults: { effect: "none" },
          performers: [
            { id: "performer-1", characterId: "<first real id>" },
            { id: "performer-2", characterId: "<second real id>" },
            { id: "performer-3", characterId: "<third real id>" },
          ],
        },
      },
      camera: {
        subject: { kind: "group" },
        shotSize: "wide",
        angle: "eye",
        position: "front",
        moves: [{ move: "orbit", amount: { degrees: 90 }, direction: "ccw" }],
      },
    },
```

Replace the three placeholders with real character ids you read in Step 1. Add one paragraph to the file's header comment in the same voice as the earlier gaps ("Gap 8b, the felt direction of an orbit. ...") and one sentence to the `brief`.

- [ ] **Step 5: Run the suite with `-u`.** Then `git diff tests/unit/film-director/__snapshots__/film-resolution-snapshot.test.ts.snap` and confirm every hunk is inside the Proving Grounds block (the brief and the two new scenes). Run the suite once more without `-u`; expected all green.

### Task 2: Capability matrix note

**Files:**
- Modify: `docs/reference/film-director-capability-matrix.md`

- [ ] In the "Camera orbit direction convention" section, append:

```md
`/test/film-director?film=proving` now ends with two scenes, `orbit-clockwise`
and `orbit-counterclockwise`, identical except for the sign, staged so the
direction of travel reads at a glance. The convention stays unconfirmed until
Austen says which one he would call clockwise (added 2026-09-02).
```

### Task 3: Commit

- [ ] Commit with explicit pathspecs only:

```
git add src/routes/test/film-director/_films/proving-grounds.ts tests/unit/film-director/film-library.test.ts tests/unit/film-director/__snapshots__/film-resolution-snapshot.test.ts.snap docs/reference/film-director-capability-matrix.md docs/superpowers/plans/2026-09-02-film-director-gap-8b-orbit-direction-demo.md
git commit -m "feat(film-director): stage the orbit direction pair in Proving Grounds

Two scenes identical except for orbit direction, so the felt sense of cw and
ccw can be judged on screen before the sign convention is confirmed.

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>" -- src/routes/test/film-director/_films/proving-grounds.ts tests/unit/film-director/film-library.test.ts tests/unit/film-director/__snapshots__/film-resolution-snapshot.test.ts.snap docs/reference/film-director-capability-matrix.md docs/superpowers/plans/2026-09-02-film-director-gap-8b-orbit-direction-demo.md
```

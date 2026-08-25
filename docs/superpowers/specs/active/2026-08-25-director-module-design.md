---
status: active
value: 5
effort: L
remaining: "Umbrella spec only. Each phase gets its own design before it is built."
depends_on: "2026-08-20-stage-performance-runtime-design.md"
plan_path: ""
tags: [director, film, choreography, 3d, admin]
last_triaged: 2026-08-25
---

# Director Module — Bird's-Eye Design

> Umbrella spec. It captures the whole vision and fixes the ownership lines and
> the phase order. It does not contain implementation detail. Phases 1, 2, and 3
> each get their own design spec before they are built.

**Goal:** Turn the `/test/film-director` proof into a production admin module
where Austen describes a movie in words and the software performs it.

## 1. What this is

The Director builds **the movie**, not the set. Austen, 2026-08-25:

> "the point of this is not to build the scene but the point of this is to build
> the movie"

Its primary user is Austen, and its primary job is producing aesthetically
pleasing, narratable demonstrations of what the software can do. The long-range
target is unchanged from the directive-language work:

> "the ability to describe whatever I want to happen on stage however I want it
> to happen and have it happen"

Everything below serves that sentence.

## 2. Positioning and access

| Question | Decision |
| --- | --- |
| Public? | No. Premium capability, deliberately withheld for now. |
| Access for now | Admin only. |
| Where it lives | Its own tab in the 3D scenes module. |
| Name | Director. |
| Vocabulary | A **film** contains **scenes**; a scene has a **location**. Settled 2026-08-24; unchanged here. |

Holding it back is a positioning choice, not a readiness one. The gate is an
admin check, not an unfinished-feature flag.

## 3. Ownership: three layers

Film production already divides this work, and the division matches the
codebase's existing seams.

| Layer | Film role | Owner | Owns |
| --- | --- | --- | --- |
| The set | Production design | Scene Composer | Environment, set dressing, scene objects |
| The blocking | Choreography | `features/stage` | Marks, formations, travel, foot planting, beat timing |
| The movie | Directing | Director module | Cast, shots, camera, effects, timing, the film document |

Two of these three lines are already asserted by
`active/2026-08-20-stage-performance-runtime-design.md`, which states that Scene
Composer "does not own performer placement or choreography," and assigns marks,
formations, and sequence assignments to `features/stage`.

**One authoring surface, three ownership layers.** Austen authors everything in
the Director. He never opens Stage. The film document grows a blocking section
that compiles down to Stage's marks and formations, and Stage's runtime performs
it. This keeps a single verbal-spec surface while refusing to build a third
implementation of locomotion.

## 4. Findings that set the phase order

Four facts discovered on 2026-08-25, each verified in the current tree.

1. **Sliding feet are a disabled flag, not a missing feature.**
   `FilmDirectorScene.svelte:392` sets `enablePerformerLocomotion={false}`.
   `Viewer3DScene.svelte:700-701` feeds that single flag to both
   `enableLocomotion` and `enableFootPlanting` on `PerformerRig`, whose contract
   documents foot planting as "pins feet to the ground during contact phases."

2. **Per-performer control is a UI gap, not a schema gap.** `performerSchema` in
   `film-director-schema.ts` already carries `avatarId`, `prop`, `effect`,
   `effort`, `position`, `facingDegrees`, `staffLengthCm`, and plane overrides.
   Every parameter Austen asked to change already exists in the document. There
   is no way to change it except by editing JSON.

3. **The camera has no presets.** `camera-language.ts` computes a shot as
   `baseDistance × SHOT_SIZE_MULTIPLIER[shotSize]`, elevated by
   `ANGLE_ELEVATION_DEG[angle]`, where `baseDistance` derives from a bounding box
   over performer positions. A formula cannot know whether the frame it produced
   is good. This is the whole reason the framing is unreliable.

4. **Choreography is roughly half-built and not wired.** `features/stage` is a
   real lazily-loaded app module (`src/routes/+layout.svelte:266`) containing
   `StageViewer`, `StageTimeline`, `MarkProperties`, `FormationOverlay`,
   `StageSidebar`, and a motion-matching locomotion controller. Its runtime
   contract already separates `bodyFacing` from `moveDirection` so a performer
   can face the audience while traveling sideways (direct travel vs crab travel).
   How much of it works end to end is **unverified** and is the first task of
   Phase 2.

The film document also has **no travel model**. `position` and `facingDegrees`
are static per performer per scene. That absence is the real Phase 2 scope.

## 5. Phases

Order: control surface, then choreography, then integration. Integration is
packaging and changes no hard part; doing it first means doing it twice.
Choreography is the larger prize but is gated on auditing Stage. The control
surface removes what blocks demos today and is the cheapest of the three.

### Phase 1 — Control surface

Make every parameter the document already supports reachable without editing
JSON, and make the camera trustworthy.

- Per-performer editing inside the Director view, live, for the duration of the
  scene: avatar, prop, effect, effort, sequence, staff length, planes.
- Save the modified film as a new film **or** over the existing one.
- A curated camera-preset library replacing formula-derived framing. Each preset
  is named, hand-tuned, visually verified, and declares the conditions it is
  valid under (cast size, formation, whether performers travel). Fewer options,
  every one guaranteed. Presets are approved by screenshot, not derived.
- Turn foot planting on and evaluate what it fixes on its own.

Success: Austen composes the Star target in section 6 without opening the JSON
editor, and every camera preset produces a usable frame.

### Phase 2 — Choreography

- **First task: audit `features/stage`.** Establish what actually runs before
  planning against it. This spec assumes nothing beyond the file tree.
- Add a travel model to the film document: start mark, end mark, travel style
  per performer per scene.
- Compile that model to Stage marks and formations; let Stage's runtime perform
  it.
- Support the three travel styles the Star target needs: forward, backward, and
  sideways-while-facing-front.
- Verbal specification of blocking, consistent with the existing directive
  language.

Success: the Star target's line forms, with performers stepping rather than
sliding.

### Phase 3 — Integration

- Mount the Director as an admin-gated tab in the 3D scenes module.
- Migrate the film collection from the test route to the module.
- Retire `/test/film-director` or reduce it to a thin harness.

Success: reachable in the app, admin only, with the saved-film shelf intact.

## 6. The Star target (acceptance example)

Austen's stated target for the Star of Five film. This is the concrete test that
Phases 1 and 2 are done. Recorded as the requirement, in his terms.

**Phase 1 portion:**

- Front performer runs a simple sequence: `D → J`, starting at beta south, one
  turn on every step. (`analyze_word_feasibility("DJ")` confirms DJ is buildable
  and recommends the `smooth` preset. The beta-south start and the per-step turn
  still need validation at build time.)
- Front performer's effect changes from `fire` to `led`. Fire is too visually
  intense for sustained viewing.
- Front performer's effort changes from `punch` to `linear`. Both are existing
  `EffortId` values.
- The avatar is selectable from within the scene, on the page.

**Phase 2 portion:**

- The fan performers in front travel sideways.
- The performers in back travel forward.
- The front performer travels backward.
- All of them arrive in a line.
- Start and end locations are predefined, and the steps read as real steps.

## 7. Risks and open questions

- **Stage's true state is unknown.** If the audit finds the runtime thinner than
  its spec claims, Phase 2 grows substantially. Audit before estimating.
- **Curating camera presets is judgment work, not fan-out work.** Presets must be
  rendered and looked at. Per `fable-routing.md`, subagents cannot see the page;
  this is hands-on work.
- **Foot planting alone may not fix visible sliding.** The flag is worth turning
  on early precisely to find out how much is left.
- **"Guaranteed to be good under whatever circumstances"** needs a bounded
  definition of circumstances. Proposed: cast size, formation, and whether
  performers travel. Confirm during the Phase 1 design.
- **Overwrite-in-place needs a decision** on whether prior versions are
  recoverable. Deferred to the Phase 1 design.

## 8. What this spec does not decide

Component names, file layout, the travel schema's shape, the preset data
structure, the admin gate mechanism, and migration detail. Each phase gets its
own design spec, brainstormed on its own, before any of it is built.

## Related

- `active/2026-08-20-stage-performance-runtime-design.md` — Stage runtime contract
- `active/2026-08-24-film-collection-design.md` — saved films, the shelf, deep links
- `2026-08-23-film-director-directive-language-design.md` — the directive language
- `backlog/2026-05-25-stage-locomotion-design.md` — superseded, useful product research
- `.claude/rules/never-hand-roll.md`, `.claude/rules/effects-earn-their-slot.md`

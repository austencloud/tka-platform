# Contact Lab Truth Sprint Handoff

**Date parked:** 2026-08-14  
**Branch:** `main`  
**Base commit at handoff:** `06bdecb5ac` (`refactor(difficulty): share active level catalog`)  
**Feature commit:** none; the Contact Lab work remains uncommitted in the shared checkout  
**Design record:** [Contact Juggling Viewer Design](./2026-08-14-contact-juggling-viewer-design.md)

## Mission

Prove that the Kinetic Alphabet can drive a recognizable contact-juggling
technique without forcing contact balls through the full-body spinner viewer.
The first proof is deliberately narrow: two articulated, palm-up hands, four
balls, and one slow two-ball palmspin derived from a real catalog sequence.

This is a separate motion discipline inside Flow Arts Composer. It may reuse
sequence data, playback, and 3D loading, but it must not inherit the spinner
camera, floor grid, prop picker, or rigid hand-to-prop transform.

## Done: verified

### The false spinner-viewer promise is quarantined

`prop-motion-discipline.ts` classifies the contact-ball family as `contact`.
Both spinner prop pickers filter those props out without changing the global
registry. If contact data reaches the current 3D motion surface, it receives an
intentional contact-viewer boundary instead of mounting the spinner stage.
The 2D prop identity is left intact.

Verification at handoff:

- `tests/unit/3d-viewer/prop-motion-discipline.test.ts`: 4/4 tests passed.
- The tests cover all four contact-ball variants, either-hand scene routing,
  picker filtering, and non-mutation of the global prop registry.
- `/test/contact-viewer-boundary` exists for isolated visual inspection.

### A real TKA sequence drives the motion proof

`/test/contact-lab` loads `tnd-quarter-opp-mpmp` from
`/data/hero/tnd-base-words.json`. The four source steps map to opposing circular
hand paths. The translator refuses empty sequences, center positions,
unsupported arcs, disconnected paths, direction reversals, and open loops.
Unsupported input does not become a decorative orbit.

Each hand owns two tangent balls, a palm-local eight-position path, a declared
support region, and per-digit openness. The proof exposes playback, scrubbing,
30 BPM teaching speed, current TKA step, current palm position, support labels,
and camera presets.

Verification at handoff:

- `tests/unit/contact-lab/contact-motion-profile.test.ts`: 7/7 tests passed.
- Both focused files together: 11/11 tests passed on 2026-08-14.
- The tests cover catalog binding, source-step use, rejection behavior, ball
  count, exact pair tangency, support continuity, eight-position coverage, and
  loop closure.

### The final hand orientation is palm-up

The hand GLB is rendered with root rotation
`[-Math.PI / 2, Math.PI / 2, 0]`. Both palms face the sky and the thumbs point
outward. The blue and red pair centers use opposite X offsets so the balls sit
over their corresponding palms after the rig flip.

The final in-app-browser inspection showed both palm surfaces under the balls,
correct pair alignment, and no browser warnings or errors. The focused seven
motion-profile tests were rerun after this flip and passed.

### The proof route has been visually exercised

The route was inspected at 1920x1080, 2560x1440, 3840x2160, 1440x900,
820x1180, 960x412, and 375x667. The canvas filled each viewport after its
resize settled, the controls stayed reachable, and no overflow was observed.
The last screenshots lived in the Windows temp directory and should be
regenerated when work resumes rather than treated as durable artifacts.

The route was left open at
`https://localhost:5173/test/contact-lab` in the in-app browser.

## Believed done: unverified

- The animation is visually coherent, but no contact juggler has approved it
  as a believable two-ball palmspin. The UI correctly says `External review
pending`.
- Contact points and support regions are authored motion data. They are not the
  result of mesh collision, inverse kinematics, or a rolling-contact solver.
- The discipline gate should preserve saved scenes because it routes rendering
  without rewriting prop data. Saved-scene behavior has not received an
  end-to-end browser test.
- The 2D contact-ball renderer should remain unchanged. The unit test proves
  that the global registry is not mutated, but the full 2D sequence workflow
  was not re-exercised at the end of the sprint.
- The proof is bound to `MPMP`. Broader claims about letters, direction pairs,
  or contact technique families have not been earned.

## In flight

Nothing is actively being implemented. This work is intentionally parked at
the practitioner-review gate.

All Contact Lab work remains uncommitted on `main`. The relevant paths are:

```text
.claude/rules/canonical-capabilities.md
docs/superpowers/specs/2026-08-14-contact-juggling-viewer-design.md
src/lib/features/contact-lab/**
src/routes/test/contact-lab/**
src/lib/shared/3d/domain/prop-motion-discipline.ts
src/lib/shared/3d/components/ContactViewerRequired.svelte
src/routes/test/contact-viewer-boundary/**
tests/unit/contact-lab/**
tests/unit/3d-viewer/prop-motion-discipline.test.ts
src/lib/shared/3d/components/controls/PerformerHubDetail.svelte
src/lib/shared/3d/components/controls/PropPopover.svelte
src/lib/shared/sequence-viewer/components/ViewerMotionSurface.svelte
```

The shared checkout contains substantial unrelated work. In particular,
`PerformerHubDetail.svelte` also contains another session's avatar-preloading
changes. The Contact Lab ownership in that file is limited to importing the
motion-discipline predicates and filtering categories and variants. Inspect
and commit hunks deliberately. Do not sweep the whole file or the shared index
into a Contact Lab commit.

## Loose ends, ranked

1. Put the teaching-angle and top-down loops in front of a contact juggler.
   Ask whether it reads as a two-ball palmspin, whether the ball order and
   direction are right, which fingers should be active, and whether any frame
   shows a click, slip, gap, or impossible support.
2. Implement only the corrections supported by that review. Keep the proof to
   one technique until its contact path is credible.
3. Rerun both focused test files and repeat the responsive visual sweep. Capture
   fresh top, teaching, and low-angle evidence.
4. Test saved contact sequence data through 2D and the 3D boundary. Confirm the
   selected prop survives without being replaced by Staff or written back.
5. If the proof passes practitioner review, write and approve the Phase 2 plan
   for a `contact-3d` motion surface in the canonical viewer shell.
6. Add contact mappings one profile at a time. Each profile needs named support
   regions, refusal cases, slow-motion inspection, and practitioner review.
7. Revisit a standalone Contact Lab product only after its curriculum or saved
   data meaningfully diverges from Composer.

## Decisions already made

- Contact juggling is not a spinner prop variant. It gets a hand-level viewer.
- The first proof uses four balls because the current Double Contact Ball
  notation represents a pair for each color track.
- TKA supplies ordered spatial and temporal intent. A contact profile supplies
  the technique. A letter alone does not specify contact physics.
- Invalid or ambiguous mappings must stop at an unresolved state.
- The first proof sequence is canonical catalog data, not a hand-authored
  fixture with a catalog label attached.
- Palms face the sky. Thumbs point outward. The camera looks down toward the
  hands rather than placing a full avatar in a scenic stage.
- Phase 2 production integration waits for practitioner approval.
- No standalone app is authorized.
- Visual work should finish with the tested route already open in the in-app
  browser.

## Gotchas

- The rig's local axes are unintuitive. `[-Math.PI / 2, -Math.PI / 2, 0]`
  shows the backs of the hands with thumbs inward. `[-Math.PI / 2, 0, 0]`
  turns the hands edge-on. Removing the root rotation makes them upright and
  separates them from the balls.
- After the palm-up flip, blue uses `-CONTACT_PALM_X_OFFSET` and red uses
  `+CONTACT_PALM_X_OFFSET`. `ContactPalmGrid.svelte` must use the same centers.
- `/models/rigged-hand.glb` exposes one `Open/Close` animation. The rig filters
  its tracks into per-digit `AnimationClip`s. Normalized times around 0.80 to
  0.86 keep the hand open; active digits use 0.68. Large excursions make the
  fingers look like claws or flat blades.
- The proof sequence ID is `tnd-quarter-opp-mpmp`. Loading must fail visibly if
  that catalog entry disappears or changes shape.
- Viewport emulation triggers the global `Connecting to cloud` loader. The
  Three canvas can lag the viewport by about two seconds. Wait until the
  progress bar is gone and the canvas rectangle matches the viewport before
  judging or capturing the layout.
- Repository-wide `npm run check:fast` was red with 294 errors and 16 warnings,
  overwhelmingly from unrelated work in the shared checkout. The only Contact
  Lab diagnostic found was the `ContactCamera.svelte` ref using `null` instead
  of `undefined`; that was corrected. The route then compiled and ran without
  browser errors.
- Port 5173 is the user's HTTPS dev server. Do not restart or kill it. Reuse
  `https://localhost:5173/test/contact-lab` for inspection.
- No branch or worktree was created.

## Resume checkpoint

Start by reading the design record and this handoff, then run:

```powershell
pnpm vitest run --config tests/config/vitest.config.ts tests/unit/contact-lab/contact-motion-profile.test.ts tests/unit/3d-viewer/prop-motion-discipline.test.ts
```

If those tests pass, the next real action is practitioner review, not more
viewer-shell code.

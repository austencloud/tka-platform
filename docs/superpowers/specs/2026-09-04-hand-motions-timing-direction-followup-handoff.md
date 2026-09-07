# Hand Motions and Timing/Direction Follow-up — Handoff (2026-09-04)

## Mission

Turn the current `hand-motions-intro` lesson into a true first encounter with
**Timing and Direction**. Preserve the useful one-at-a-time Shift, Dash, and
Static opening and the six-up comparison board, but stop jumping directly from
those motions to six unexplained relationships. Introduce the system first,
then let a learner select one relationship and study its live hand animation
beside the production hand-path Choreo Card, with legible controls and no
duplicated element iconography. Keep this work aligned with the downstream
Pictograph Anatomy and Learning Letters lessons rather than re-teaching or
revealing their material early.

## Done — verified

- The current four-step Hand Motions lesson was integrated through commits
  `00b978b7f5844117b10e570c8fddf2934cf77667`, `03ebc89b9b`,
  `15a6efdee2`, and `18bd1ff77d`. On 2026-09-04, both the feature commit and
  final polish commit were verified as ancestors of local `main` at
  `56cfd326035817de5247b896d27a6c2b3b90d4df`.
- The current route keeps Shift, Dash, and Static one at a time, then presents
  all six relationships on a responsive comparison board. It has synchronized
  play/pause, focus expansion, local progress, Level 1 progress, Escape/back
  focus collapse, and review-mode return to the board. These behaviors were
  exercised during the completed browser pass for the integrated commits.
- The completed visual pass covered the required matrix. Evidence remains at:
  `C:/Users/Austen/AppData/Local/Temp/hand-motions-six-up-1920-r2.webp`,
  `hand-motions-six-up-2560-r2.webp`,
  `hand-motions-six-up-3840-r2.webp`,
  `hand-motions-six-up-1440-r2.webp`,
  `hand-motions-six-up-820-r2.webp`,
  `hand-motions-six-up-960-landscape-r3.webp`, and
  `hand-motions-six-up-375-r2.webp`. Focus evidence remains at
  `hand-motions-focus-1920-r2.webp` and `hand-motions-focus-375.webp` in the
  same Temp directory.
- On 2026-09-04,
  `pnpm exec vitest run --config tests/config/vitest.config.ts tests/unit/learn/canonical-concept-lessons.test.ts`
  passed 1 file and 10 tests against the current integrated primary checkout.
- The canonical card owner already supports the requested letter-free hand
  breakdown. `src/lib/shared/sequence-viewer/components/ChoreoCard.svelte`
  exposes `handPathMode`, documented there as “HAND props, float arrows, no
  TKA.” This is the production path to use for the selected relationship's
  piece-by-piece card. No new renderer is needed.
- The separate Pictograph Anatomy lesson already exists at
  `letter-codex-intro`. It uses `PictographContainer` plus
  `ArtifactRegionSpotlight` for a seven-step tour of the step number, start/end,
  letter/turns, hand timing and direction, prop timing and direction, and the
  central paths. The focused 10-test suite asserts those regions and the
  curriculum order before letters.
- Learning Letters is already limited to the guide's six Alpha/Beta words.
  `LearningWordStage.svelte` reserves simultaneous performance video,
  animation, Choreo Card, and explanation regions; the typed content registry
  has empty media/explanation slots for all 19 founding words without revealing
  the other 13 in this lesson. The focused 10-test suite passed its six-word
  progression contract on 2026-09-04.
- The public Timing and Direction article cluster was integrated by merge
  `8a8de59625`. Its six relationship data reuses
  `TIMING_DIRECTION_MODES` from
  `pictograph-foundation-content.ts`; it is an adjacent reference surface, not
  a replacement Learn interaction.

## Believed done — unverified

- `LearningWordStage.svelte` is configured to keep the production animation
  surface, including hand timing/direction at bottom right and prop
  timing/direction at top right. Recheck the live context menu and both glyphs
  after any shared viewer changes; this was not re-tested during handoff
  writing.
- `ChoreoCard handPathMode` is the right existing API for the new focused study
  view, but the six authored `learn-mode-*` sequences have not yet been rendered
  through that mode in this lesson. Verify all six cards before choosing final
  sizing or layout.
- The existing `highlightedStepIndex` and `onStepClick` ChoreoCard APIs appear
  suitable for synchronizing the card with the animation. The exact playback
  event owner still needs to be traced before implementation.

## In flight

- No feature implementation for this feedback has started. The current lesson
  remains the integrated four-step version described above.
- This handoff was authored in the task worktree
  `E:/tka-platform-hand-motions-followup-handoff` on branch
  `codex/hand-motions-followup-handoff` for guarded integration into local
  `main`.
- At handoff writing, the primary checkout was on `main` at
  `56cfd326035817de5247b896d27a6c2b3b90d4df`. Other agents may move it.
- The primary checkout had unrelated changes in
  `scripts/audit-frame-budget.mjs` and
  `docs/superpowers/specs/flow-fest-sim/austen-site-markers.json`. They were not
  touched, staged, reset, or committed by this handoff.

## Loose ends (ranked)

1. **Slow the transition into Timing and Direction.** Keep Shift, Dash, and
   Static, then add a separate step titled exactly `Timing and Direction` before
   showing the six-up board. The already-approved bridge sentence is: “Time
   compares the hands: together, split, or quarter. Direction compares their
   travel: same or opposite.” If the lesson needs more explanatory sentences or
   more than one new teaching step, ground them in the Flow Arts MCP and Guide,
   put the exact draft in `docs/learn/copy-reviews/hand-motions-intro.md`, and
   obtain Austen's exact-copy approval before placing them in the component.
2. **Add the missing selected-relationship study view.** After a learner picks
   a relationship, show its existing live `HandMotionPlayer` animation and a
   production `ChoreoCard` with `handPathMode` together. The card should expose
   the hand paths beat by beat without introducing TKA letters. Investigate
   shared playback/step events so the card can highlight the beat currently
   playing and its cells can seek the animation if the canonical APIs support
   that contract.
3. **Make labels comfortably readable.** The current `0.75rem`/minimum-type
   labels become comically small in the compact focus rail and on a native 4K
   screen. Establish a legible type floor and hierarchy at all required
   viewports. Do not solve this by magnifying the entire page or violating the
   established 1680/2600 layout seams.
4. **Remove duplicated element identity.** A tile currently repeats the element
   icon in its top-left header and as the canonical bottom-right elemental glyph
   inside the animation. The bottom-right glyph owns that identity. Remove the
   redundant header icon wherever both are visible. Icon-first labels remain
   appropriate only in selectors or summaries where the canonical bottom-right
   glyph is not already present.
5. **Keep the six-up board as comparison/review, not first explanation.** It is
   useful after the system is introduced. Preserve inspectable six-up motion,
   synchronized playback, focus expansion, keyboard focus return, Escape/back
   collapse, and direct review-mode entry. Do not return to six serial giant
   canvases.
6. **Resolve curriculum overlap deliberately.** `hand-motions-intro` currently
   shows all six relationships even though `dual-shifts-alpha-beta` and
   `gamma-motion` immediately follow as one-mode-at-a-time lessons. Audit the
   Guide and the interaction purpose of all three. The likely division is:
   introduce the two axes here, use the six-up board as comparison, then let the
   two later concepts provide guided practice. Do not delete or merge concepts
   without an explicit curriculum decision from Austen.
7. **Preserve Learning Letters boundaries.** `words-alpha-beta` must continue to
   teach only AAAA, BBBB, CCCC, GGGG, HHHH, and IIII one at a time, followed by
   a six-word recap. Do not restore the rejected 19-word ending. All 19 base
   sequences retain typed future video and explanation slots, and each eventual
   lesson stage should keep performance video, animation, Choreo Card, and
   approved explanation attached to the same word.
8. **Re-run the complete proof loop.** Update focused contracts for the new
   step count/title/card ownership, run relevant tests and one proportionate
   checker pass, then inspect intro, bridge, all-six, and focused card+animation
   states at 1920×1080, 2560×1440, 3840×2160, 1440×900, 820×1180, 960×412,
   and 375×667. Verify reduced motion, keyboard navigation, play/pause sync,
   persistence migration, review entry, and no horizontal overflow.

## Decisions already made

- On 2026-09-04 Austen said the system is called **Timing and Direction**. Use
  that phrase for the concept/heading. `Time + Direction` is rejected.
- Individual relationships use **time**, not **timing**: “split time, same
  direction,” “together time, opposite direction,” and “quarter time, same
  direction.” The noun changes with context; do not globally replace one with
  the other.
- Learners need an introduction to what Timing and Direction means before all
  six relationships appear together.
- Keep the six animations available on one comparison screen. A learner may
  select one to expand and study it.
- A selected relationship needs a corresponding Choreo Card that breaks its
  hand paths down piece by piece. Reuse the production card; do not hand-roll
  pictographs or a card facsimile.
- The current top-left element icon is redundant when the animation already
  shows the canonical elemental glyph at bottom right. Do not show both.
- Labels must be comfortable for children, older adults, phones, and native 4K
  displays. The current tiny focus/selector labels are rejected.
- Element presentation is generally icon first, followed by the abbreviation
  or the full relationship name. Do not also spell out Water, Earth, Sun, Fire,
  Air, or Moon unless the lesson is actually teaching element names.
- Learning Letters presents only the six guide-assigned Alpha/Beta words in
  concept #23. The remaining 13 founding words belong to later lessons.
- Every one of the 19 base sequences eventually deserves a performance video,
  attached to the same curriculum record as its animation, card, and grounded
  explanation. Empty slots already exist; videos and explanations do not.
- New explanatory TKA prose still requires current-turn MCP grounding, Guide
  review, an exact-copy proposal, and Austen's approval. Routine interface
  labels and the terminology decisions above do not authorize new teaching
  claims.

## Gotchas

- `MotionsConceptExperience.svelte` currently derives the final heading as
  `Time + Direction`; this is now explicitly wrong. Its `comparisonIndex` is
  equal to `HAND_PATH_STEPS.length`, and scroll/review mode jumps directly to
  that index. Adding a bridge changes persistence and review routing; migrate
  or normalize old saved step values instead of letting returning users land on
  the wrong screen.
- `TimingDirectionBoard.svelte` hides the five non-focused players and turns
  them into a compact selector rail. Its smallest container rule reduces labels
  to the compact type token, and the focus rail is the source of the “teensy
  tiny” feedback.
- The current board header renders an element icon even though
  `HandMotionPlayer showElementalGlyph` renders the same identity at bottom
  right. Remove the duplicate without removing the canonical bottom-right
  glyph.
- The six comparison sequences live in
  `pictograph-foundation-content.ts`. Some carry letter values internally, but
  this prerequisite lesson must not expose letter notation. Use
  `ChoreoCard handPathMode`, which is expressly the letter-free hand-path
  rendering contract.
- `LearningWordStage.svelte` is a useful production composition reference for
  simultaneous animation and Choreo Card, but its staff-prop and media teaching
  contract is not a drop-in Hand Motions design. Compose the shared owners; do
  not copy its CSS wholesale.
- The standalone `PictographAnatomyConceptExperience.svelte` already teaches
  pictograph regions before the first letter lesson. Showing a hand-path card
  in concept #3 should be a readable motion breakdown, not a duplicate anatomy
  lecture or an unexplained wall of notation.
- Three feedback screenshots from 2026-09-04 are available at
  `C:/Users/Austen/AppData/Local/Temp/codex-clipboard-2941b615-a83e-42e0-b404-455cfd38b1c5.png`,
  `codex-clipboard-71e54ce3-2f20-4d2e-8081-33c556c01b34.png`, and
  `codex-clipboard-1c35823b-32a7-4923-a94f-aef3808ce03a.png`. They document the
  oversized focused canvas, tiny rail labels, and duplicated header/bottom-right
  element icon.
- Port 5173 is Austen's HTTPS/2 dev server. Never start, stop, restart, replace,
  or kill it. Use the shared debug Chrome launcher and one task-owned tab for
  browser proof.
- Local `main` is shared and moving. Use a dedicated worktree, keep commits to
  explicit pathspecs, and preserve unrelated primary-checkout changes.

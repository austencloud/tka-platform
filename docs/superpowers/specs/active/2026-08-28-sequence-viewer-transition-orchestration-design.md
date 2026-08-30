# Sequence Viewer Transition Orchestration

**Status:** Active, advancing one visual approval gate at a time

## Objective

Every main Sequence Viewer transition should read as one physical action. The
old surface remains understandable while the workspace travels to its new
shape, the incoming surface appears when it is ready, and a second selection
mid-transition continues from the visible frame instead of jumping to an old
endpoint.

This work does not add a second animation system. It routes each geometry and
content change through the shared motion owners already used elsewhere in the
app.

## Canonical ownership

| Change                                              | Owner                                                                                |
| --------------------------------------------------- | ------------------------------------------------------------------------------------ |
| Split allocation, rail presence, inspector presence | `PanelGroup`                                                                         |
| Cheap content or label swap                         | `Crossfade`                                                                          |
| Heavy viewer surface swap                           | Existing mounted-layer pattern in `ViewerMotionSurface` and `ViewerCompanionSurface` |
| Canvas backing size across hidden/revealed panes    | `CanvasResizer`, keyed from the shared `inert` accessibility boundary                |
| Multi-element Practice recomposition                | `createLayoutMotion()` where panel allocation alone cannot carry the change          |
| Timing and reduced motion                           | `DURATION`, `motionDuration()`, and global `--transition-*` tokens                   |

`SequenceViewerShell` remains the overall chrome owner. `ViewerSplitPane`
remains the owner of the two-pane stage. The review route composes production
components and never becomes another viewer implementation.

## Transition gates

Work proceeds in this order. A gate is not complete until Austen approves the
live production transition in the review surface and that approval date is
recorded.

| Gate | Transition                                               | Baseline                 | Target |
| ---- | -------------------------------------------------------- | ------------------------ | ------ |
| 1    | Side by Side ⇄ 2D / Card, including inspector allocation | D                        | A+     |
| 2    | 2D ⇄ 3D, including first open                            | B+ repeat / C first open | A+     |
| 3    | 2D / 3D ⇄ Tunnel                                         | B                        | A+     |
| 4    | Card ⇄ left-side modes                                   | D                        | A+     |
| 5    | Viewer stage ⇄ Performances                              | D                        | A+     |
| 6    | Viewer stage ⇄ Post Studio                               | D                        | A+     |
| 7    | Card ⇄ Motion inspector content and collapse behavior    | C-                       | A+     |
| 8    | Practice enter, setup ⇄ running, and exit                | C+                       | A+     |
| 9    | Desktop rail and mobile bottom-bar active-state motion   | C                        | A+     |

Later gates may share infrastructure established by an earlier gate, but they
do not broaden the current gate's behavior without their own review.

## Durable visual review surface

`/test/sequence-viewer-transitions` is the acceptance surface. It uses the real
`SequenceViewerOrchestrator` and `SequenceViewerShell` against a deterministic
local sequence. The outer review page supplies:

- the gate list and current approval state;
- exact viewport frames for the required responsive families;
- manual replay through the production controls;
- automatic A ⇄ B replay through those same controls;
- rapid interruption and reduced-motion checks;
- acceptance criteria and a browser-persisted approval timestamp;
- a direct-frame URL for full-size inspection and browser capture.

The page stores local review state only. Austen's explicit approval in the task
is the authoritative sign-off; after approval, the timestamp is also copied
into this document so it survives browser storage and future machines.

## Gate 1 contract

Side by Side ⇄ single-view uses `PanelGroup` to keep both panes mounted while
their allocation changes from 1:1 to 1:0 or 0:1. The outgoing pane fades on the
same shared clock. Mobile portrait changes row allocation, while landscape and
desktop change column allocation. Responsive direction changes settle without
first-paint animation. The surrounding export inspector joins and leaves through
the same canonical panel owner, so the stage and inspector read as one continuous
workspace recomposition instead of overlapping grid and split-pane animations.

Acceptance requires:

1. Side by Side → 2D and Side by Side → Card show continuous geometry.
2. The reverse transitions restore the split without a blank or doubled frame.
3. 2D → Side by Side → Card triggered rapidly never jumps backward.
4. Both panes preserve their mounted state and playback/card progress.
5. Reduced motion removes all spatial interpolation and hands the old and new
   workspace pixels across with a short opacity-only dissolve.
6. No overflow, unreadable scaling, or stranded controls at the required
   375×667, 960×412, 820×1180, 1440×900, 1920×1080, 2560×1440, and 3840×2160
   viewports.
7. The Card settings keep their destination wrapping and vertical composition
   while the inspector dock opens and closes; only the dock reveal and the
   canonical content fade move.
8. A hidden animation pane retains its last readable canvas backing store, so
   the returning mandala is never magnified from collapsed geometry.

## Risks and controls

- Canvas and card content can remeasure repeatedly during structural motion.
  The panes remain mounted and clipped by `PanelGroup`; runtime capture must
  confirm that resize work does not blur or hitch.
- A zero-sized pane must also be `inert` and non-interactive. Visual hiding is
  not an accessibility boundary.
- Hidden 3D and video surfaces must eventually pause expensive work without
  losing their retained state. That belongs to their later gates.
- Review instrumentation must click the production mode controls. Directly
  changing `viewerState` would bypass the behavior being approved.

## Verification per gate

Each gate requires focused unit tests for silent state and interruption bugs,
one scoped type/check pass, console inspection, and live review at every
reachable required viewport. Visual evidence must exercise both endpoints, a
normal transition, rapid interruption, and reduced motion.

### Gate 1 evidence · 2026-08-28

- The stage split and surrounding export inspector both route through
  `PanelGroup`; no feature-local grid timing remains in this handoff.
- Austen's visual passes caught two different midpoint collapses that endpoint
  checks missed. The first came from the outer inspector/split allocation. The
  second survived that repair: the contained Card itself changed Auto layout
  from `4×3` to `5×2` and back while the workspace moved. At 960×412 the new
  height/aspect trace measured the visual falling from about 421×351 to 421×203
  and its aspect jumping from 1.20 to 2.15.
- The geometry trace now samples Card width, height, aspect, selected viewer
  mode, resolved columns/rows, and the transition layout lease. It distinguishes
  visible deformation from internal ResizeObserver work covered by the reduced
  motion snapshot dissolve.
- The repair leases the last readable Auto grid for the entire Card visit. It
  releases only after the return transition has actually settled: the shared
  `DURATION.emphasis` clock for full motion, or `ViewTransition.finished` for
  reduced motion, followed by two paints for ResizeObserver to publish the final
  contained dimensions. Auto remains container-aware outside that visit.
- The final 960×412 full-motion replay reported a 350×292 minimum Card visual,
  aspect 1.20–1.20, a single `4×3` layout, zero squashed frames, zero tiny Card
  or Animation frames, and no viewport overflow.
- The final 960×412 reduced-motion replay reported a 421×351 minimum Card
  visual, aspect 1.20–1.20, a single `4×3` layout, zero visible squashed frames,
  zero dissolve-covered Card reflow frames, and an opacity-only dissolve.
- The wide-screen reverse-leg trace exposed a separate axis race. At 1440×900,
  the temporary inspector made the focused stage portrait-shaped, so the inner
  split changed `horizontal → vertical → horizontal` while Card returned. Its
  pane height fell 847→515→847 px and the rendered Card fell
  581×839→381×550→581×839 even though the Card's center traveled monotonically.
- `ViewerSplitPane` now retains the last meaningful Side-by-Side axis through a
  focused visit and the shared emphasis-duration release. The export dock leads
  the returning split by `STAGGER.normal`, giving the two nested `PanelGroup`
  allocations one continuous visual handoff instead of competing for the same
  pixels. The stable Card Auto-layout lease also spans a 2D focus visit, so a
  rapid 2D → split → Card interruption cannot publish a transient `2×5` grid.
- The corrected 1440×900 Card return keeps one horizontal axis, a constant
  581×839 Card visual, and a 530→1124 px center path with zero size dip,
  backtrack, overshoot, tiny frames, or squashed frames. The 1920, 2560, and
  3840 desktop replays likewise report zero visual-size dip and zero travel
  reversal. The interrupted replay holds `3×4` with zero tiny or squashed
  frames.
- Austen's reduced-motion pass exposed a real browser deadlock. The dissolve
  update callback waited for two animation frames, but Chromium suppresses
  painting while that callback is open. The viewer therefore appeared frozen
  until the browser's safety timeout aborted the transition and exposed the
  destination all at once. The callback now publishes the Svelte destination
  synchronously and never waits on paint. A rapid reversal skips the stale
  dissolve before starting the new one.
- The review replay no longer trusts a fixed sleep. It waits for the actual rail
  selection, fails if the commit exceeds the gate timeout, and records every
  commit latency. At 1440×900 the reduced Card round trip commits in `56 ms`
  and `70 ms`; the rapid 2D → split → Card → split sequence commits each choice
  in `69–113 ms`, with zero tiny Card or Animation frames.
- The seven-size full-motion sweep retained the canonical `4×3` Card on compact
  frames and `3×4` Card on desktop frames without viewport overflow. The review
  page remains positioned on the reported 1440×900 full-motion case for
  Austen's visual confirmation.
- Austen's next visual pass exposed a separate inspector-content reflow: the
  settings were `width: 100%` while the dock grew from zero, so chip wrapping
  and auto vertical centering made the controls appear oversized before they
  collapsed into place. The shell now keeps the settings at the tier's final
  sidebar width and lets `PanelGroup` reveal that stable composition. Their
  entrance uses the shared reduced-motion-aware fade/drift helper.
- The review trace now samples the Card settings width, height, opacity, and
  vertical center. At 1440×900, both entrance and exit hold `560×396` with zero
  width, height, or center drift. The 1920×1080, 2560×1440, and 3840×2160 runs
  likewise report zero reflow at their `800`, `800`, and `1000` px dock tiers.
- Austen's next wide-screen pass caught a canvas-backing artifact that pane
  geometry alone could not reveal. While Card was focused, the hidden animation
  wrapper measured `48 px`; its ResizeObserver rebuilt the mandala at that size.
  On the return frame the `48 px` raster was stretched across `630 px`, a
  measured `13.13×` magnification that made the guide lines look temporarily
  heavy.
- `CanvasResizer` now treats an `inert` ancestor as the canonical hidden-surface
  boundary. It retains the last readable raster while hidden, then rebuilds
  only after the shared emphasis-duration reveal has settled. Reduced motion
  uses the same rule with the existing `40 ms` observation settle, so it gains
  no spatial motion or delayed mode commit.
- The gate now records mandala backing size, displayed size, scale, and
  magnified-frame count. Full and reduced Card returns at 1440×900 both report
  `1.00×` maximum scale and zero magnified frames. Full-motion checks at
  960×412, 1920×1080, and 3840×2160 report the same result, with zero tiny
  Animation frames and no runtime warnings or errors.
- The iPhone SE pass exposed review-harness instability rather than a new
  production pane collapse. The frame initialized as desktop until `onMount`,
  reused the same live iframe while device dimensions changed, and treated only
  `aria-pressed` controls as committed even though the mobile bottom bar uses
  its active class. The frame now starts from the real client width, each
  viewport selection receives a fresh exact-size preview, and the replay gate
  recognizes both production selection signals. The outer review surface owns
  a `100dvh` scroll container, so its geometry report and decision controls are
  reachable despite the app shell's global overflow boundary.
- Two consecutive cold 375×667 full-motion Card round trips started vertical
  with Side by Side selected and completed `split → card → split`. Both reported
  a stable `4×3` Card, zero squashed frames, zero magnified mandala frames, and a
  `1.00×` mandala return. The reduced-motion run completed in `1044 ms` with 32
  dissolve frames, zero squashed frames, and no viewport overflow.
- The final iPhone SE polish pass put the contained Card width and vertical
  travel on one sampled clock. Before the repair, focus width settled at
  `183 ms` while the Card continued rising until `316 ms`, a `133 ms` split in
  the gesture. The sizing owner now captures the Side-by-Side Card box, targets
  the focused box for the forward leg, and restores the captured box from the
  same event that reveals the returning split. The last visible gate trace
  measured focus width/rise settling within `16 ms` and return width/fall
  starting together and settling within `21 ms`. Three consecutive mobile
  round trips stayed within `0–30 ms` at settle, with zero squashed or magnified
  frames. The 1440×900 regression replay retained its constant `562×839` Card
  visual and monotonic horizontal slide.
- A cold Card replay after leaving the hidden pane in another mode reproduced
  the intermittent rising-cell failure as a stale `5×2 → 4×3` Auto-layout
  change. The Card briefly measured `375×186` at a `2.02` aspect and logged 43
  squashed frames. The shell had accepted a wide, shallow layout report from
  the collapsing hidden Card, then leased it on the next Card visit.
- The lease source now remembers only Auto layouts reported from a contained
  Card box whose width and height both meet `MIN_VIEWER_PANE_REVEAL_SIZE`.
  Collapsing hidden-pane measurements still reach current-layout consumers but
  cannot replace the next visit's stable shape. Cold and stale-mode iPhone SE
  replays now hold `4×3` at a `322×280` minimum with zero squashed frames; direct
  cell-boundary sampling found zero upward-overflow frames. The complete
  responsive sweep holds `4×3` on compact frames and `3×4` on desktop through
  3840×2160, with zero squashed frames. Reduced motion records 36 opacity-only
  dissolve frames and the same stable `4×3` Card.
- Austen's screenshot then exposed an internal motion layer the outer Card-box
  trace could not see. The `4×3` lease stayed stable, but all eight step-cell
  wrappers ran their own page-space FLIP while the parent Card moved. The first
  instrumented replay reproduced 34 transformed-cell frames: the cells appeared
  to keep rising, overlapped their neighbors, then snapped back when FLIP ended.
- The Card sizing owner now suppresses cell FLIP for the existing
  `containSizeMotion` lifetime. Reduced motion keeps that non-visual suppression
  signal through the opacity dissolve and its final ResizeObserver paints; the
  global reduced-motion rule still collapses all spatial interpolation. Eight
  consecutive full-motion and eight reduced-motion iPhone SE round trips report
  zero transformed-cell frames and zero squashed frames. The seven-viewport
  sweep through 3840×2160 reports the same result.
- Fifty focused tests pass and `svelte-check` reports zero errors and zero
  warnings. The production build currently stops on the unrelated existing
  `@austencloud/scene-3d` package export mismatch for `propFinishState`.

## Approval ledger

| Gate                           | Status   | Approved by | Approved at          | Notes                                                              |
| ------------------------------ | -------- | ----------- | -------------------- | ------------------------------------------------------------------ |
| 1. Side by Side ⇄ 2D / Card    | Approved | Austen      | 2026-08-29 09:57 CDT | Approved after full/reduced, mobile-to-4K, and transformed-cell QA |
| 2. 2D ⇄ 3D                     | Pending  |             |                      |                                                                    |
| 3. 2D / 3D ⇄ Tunnel            | Pending  |             |                      |                                                                    |
| 4. Card ⇄ left-side modes      | Pending  |             |                      |                                                                    |
| 5. Viewer stage ⇄ Performances | Pending  |             |                      |                                                                    |
| 6. Viewer stage ⇄ Post Studio  | Pending  |             |                      |                                                                    |
| 7. Export inspector            | Pending  |             |                      |                                                                    |
| 8. Practice                    | Pending  |             |                      |                                                                    |
| 9. Mode switchers              | Pending  |             |                      |                                                                    |

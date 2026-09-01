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

## Gate 2 contract

2D ⇄ 3D uses the existing mounted layers in `ViewerMotionSurface`. A first 3D
request mounts and prepares the scene behind the still-live 2D canvas. The 3D
layer becomes presentable only after its ready event, then the two surfaces
crossfade on the shared emphasis clock. Later switches use the same path with an
already-ready scene. No keyed remount or second surface-switching abstraction is
introduced.

Reduced motion keeps the stage geometry fixed. The two overlapping motion
surfaces retain only the canonical opacity handoff, while the outer workspace
uses the existing reduced-motion View Transition dissolve. Compact viewports
that fail the production 3D shortest-side gate remain layout-only review sizes.

Acceptance requires:

1. The live 2D frame remains visible for the entire first 3D preparation.
2. The first visible 3D frame is ready and never exposes its loading curtain.
3. Warm 2D ⇄ 3D round trips use the same opacity clock in both directions.
4. Rapid reversals expose neither a blank stage nor an unready 3D surface.
5. Reduced motion has no spatial interpolation and retains a short opacity-only
   handoff.
6. Every viewport passes overflow and responsive-axis checks; transition replay
   runs only where the canonical production 3D gate passes.

### Gate 2 evidence · 2026-08-30

- The cold 1440×900 full-motion replay kept 2D visible for 82 sampled preparation
  frames, then crossed through five sampled opacity frames. It reported zero
  blank frames, zero unready 3D frames, zero visible loading-curtain frames, and
  the expected `2D → 3D → 2D` surface path.
- The warm 1440×900 replay reported seven crossfade frames and the same zero-
  defect counts. The rapid reversal trace traveled
  `2D → 3D → 2D → 3D → 2D` through 14 crossfade frames without exposing a blank
  or unready stage.
- The global reduced-motion rule initially collapsed the inner surface opacity
  change to `0.01 ms`; instrumentation caught the resulting snap even though the
  outer workspace dissolve was present. The two canonical mounted motion layers
  now retain only `opacity` and delayed `visibility` on `--duration-normal`.
- A cold 1440×900 reduced-motion replay held 2D for 48 sampled preparation
  frames, used seven crossfade frames and 25 outer dissolve frames, and reported
  zero blank, unready, or loading-curtain frames. The warm replay used eight
  inner crossfade frames and 30 dissolve frames.
- Tablet 820×1180 passed in its vertical panel composition with nine full-motion
  crossfade frames and 13 reduced-motion crossfade frames. Native 3840×2160
  passed in its horizontal composition with four full-motion and seven reduced-
  motion crossfade frames. Both reported zero blank, unready, and loading-
  curtain frames.
- The complete 375×667 through 3840×2160 sweep reported no viewport overflow.
  The 375×667 and 960×412 sizes correctly withhold 3D under the shared
  `fits3DViewport()` predicate; the review surface disables impossible replays
  and labels those sizes as responsive-layout checks.
- Austen's visual pass then caught a one-frame mandala twitch after the returning
  2D surface appeared settled. The 1920×1080 trace reproduced the hidden 2D
  stage expanding from `940 px` to `1740 px`, rebuilding its mandala backing at
  the hidden geometry, then rebuilding again `79 ms` after the pane was fully
  opaque and back at `940 px`.
- The existing mounted motion layers are now true `inert` boundaries while
  hidden, so `CanvasResizer` retains the last readable backing store through the
  temporary 3D allocation and resumes only after the shared settle clock. The
  layer opacity and width lease now share `DURATION.emphasis`; no new crossfade
  or resize owner was introduced.
- The polished 1920×1080 replay records 11 full-motion crossfade frames and six
  reduced-motion crossfade frames with zero late 2D backing changes. Rapid
  reversal records nine overlap frames and the full
  `2D → 3D → 2D → 3D → 2D` path with the same zero count. Tablet records 13/7
  full/reduced overlap frames and 4K records 12/13, all without blank, unready,
  loading-curtain, overflow, or late-backing frames.
- Fifty-six focused tests pass, `svelte-check` reports zero errors and zero
  warnings, `git diff --check` is clean, and the in-app browser console reports
  no warnings or errors.
- Austen approved the final 1920×1080 full-motion handoff and measured trace at
  16:27 CDT on 2026-08-30, with no remaining visual notes. Gate 2 is complete.

## Gate 3 contract

2D and Tunnel are two presentations of one shell-owned `AnimatorCanvas`, not
two canvases that crossfade. `ViewerSplitPane` owns the shared
`TunnelViewController`; `ViewerMotionSurface` feeds that controller's performers,
effects, spectrum, grid, and save actions into the already-mounted Animator.
Entering Tunnel blooms the additional performer layers over the live 2D base.
Exiting reverses the same envelope. The playback clock, backing store, base prop
state, and canvas DOM identity never change.

The outer `PanelGroup` inspector also remains mounted on desktop. The existing
Animation settings and `ArtSettingsPanel` stay alive in stacked content layers;
the art settings node is reparented into the shell-owned inspector slot without
remounting. Their opacity changes while the inspector's width and DOM identity
stay fixed. Compact layouts retain the production bottom-dock composition, so
desktop inspector identity is not treated as a mobile invariant.

3D remains a genuinely different renderer and therefore keeps the canonical
ready-frame surface crossfade. Its destination is a fully composed Tunnel:
Tunnel layers snap to their completed internal state before the 3D crossfade,
then reset only after the outgoing canvas is hidden. This prevents the old
double fade where 3D opacity and Tunnel-layer opacity moved at the same time.
Reduced motion snaps the internal layer envelope and lets the existing
opacity-only workspace View Transition provide the accessible dissolve.

Acceptance requires:

1. 2D ⇄ Tunnel retains one Animator DOM identity, one backing store, and one
   playback clock for the complete round trip.
2. Desktop 2D ⇄ Tunnel retains one outer inspector identity and never exposes
   duplicate active settings content.
3. Full-motion 2D entry, exit, and interruption use the canonical emphasis
   clock and a staggered per-layer opacity envelope.
4. 3D ⇄ Tunnel has one surface-opacity owner; its fully composed Tunnel
   destination never double-fades, blanks, or appears unready.
5. Reduced motion uses the existing opacity-only workspace dissolve, with no
   internal spatial animation or delayed state swap.
6. Every required viewport passes overflow, responsive-axis, canvas singleton,
   readiness, and late-backing checks. The 3D replay remains disabled where the
   production viewport gate does not pass.

### Gate 3 evidence · 2026-08-30

- The architecture gate now assigns stable DOM identities to the persistent
  Animator and desktop inspector on every sampled frame. It also counts live
  Animator canvases and active settings panels, so a remount or duplicate can no
  longer hide behind a visually plausible fade.
- The fresh 1440×900 2D round trip records 12 layer-bloom frames, a fixed
  `700 px` stage and canvas, and the expected
  `2D base → 2D base + Tunnel layers → Tunnel → … → 2D base` path. It reports
  zero Animator remounts, inspector remounts, non-singleton canvases, duplicate
  settings, blank frames, unready frames, double fades, and late backing changes.
- The rapid-reversal trace records 23 reversible layer-bloom frames through
  `animation → tunnel → animation → tunnel → animation`, with the same zero
  defect counts and zero-millisecond mode commits.
- Reduced motion records zero internal bloom frames and 18 workspace-dissolve
  frames. The Animator and inspector identities remain stable, and the surface
  path collapses cleanly to `2D base → Tunnel → 2D base`.
- The first shared-renderer 3D replay exposed six double-fade frames because the
  3D surface and the Tunnel layers were both changing opacity. The corrected
  handoff precomposes Tunnel before the surface crossfade and holds it intact on
  exit. Its rerun reports zero bloom, double-fade, blank, unready, remount,
  duplicate, and late-backing frames, with a zero-millisecond ready handoff.
- The 375×667 mobile replay uses its intentional vertical/bottom-dock
  composition and reports a fixed `375 px` Tunnel display, zero overflow, and
  zero canvas/remount/readiness defects. Native 3840×2160 reports a fixed
  `2660 px` stage and `2107 px` Tunnel display with the same zero counts.
- Forty-seven focused tests pass, `svelte-check` reports zero errors and zero
  warnings, `git diff --check` is clean, and the final in-app-browser run emits
  no console warning or error. Gate 3 is ready for Austen's visual review.

## Gate 4 contract

Card and the motion modes are persistent surfaces inside the same nested
`PanelGroup` workspace. A direct Card selection never routes through Side by
Side, and a direct motion selection never remounts the Card, Animator, or outer
inspector. The selected pane allocation and inspector allocation publish in the
same mode mutation, so the Card edge, stage edge, and settings content describe
one structural change.

The Card's Auto layout and last readable contained box are leased through the
handoff. While its panel track is narrower than that box, the fixed Card is
clipped by the canonical panel wrapper instead of being flex-compressed. This
keeps every pictograph cell square and stationary while the Card is progressively
covered or revealed. The existing Side-by-Side focus motion keeps its approved
behavior; motion-mode restoration uses a distinct containment phase because it
starts behind a zero-sized track.

Card, 2D, and Tunnel retain the desktop inspector track while their persistent
content layers crossfade. 3D owns its full stage and intentionally releases the
inspector track while its preparation surface and scene take over; the track
closes and reopens monotonically without losing its DOM identity. Compact
layouts keep the production bottom-dock composition. Reduced motion removes the
spatial interpolation and uses the existing workspace snapshot dissolve.

Acceptance requires:

1. Card ⇄ 2D, Card ⇄ 3D, and Card ⇄ Tunnel use direct mode paths with no
   Side-by-Side intermediate frame.
2. Card, Animator, and desktop inspector retain one DOM identity through every
   round trip and rapid reversal.
3. A visible Card never falls below the readable floor, changes aspect through
   a sliver, or transforms its cells while the panel track moves.
4. Card and stage center/allocation paths are monotonic in both directions,
   with no backtrack or endpoint overshoot.
5. Card/2D/Tunnel settings crossfade without a blank inspector; 3D's inspector
   release and return remain monotonic on the structural clock.
6. Reduced motion has no spatial tween, no blank workspace, and no delayed
   state commit outside the canonical dissolve.
7. Every required viewport passes overflow, responsive-axis, identity, blank,
   squash, transformed-cell, and travel checks. 3D remains disabled where the
   production viewport capability gate does not pass.

### Gate 4 evidence · 2026-09-01

- The first instrumented 1440×900 replay exposed the real failure: the Card's
  panel collapsed to `6 px` while the live Card remained above `0.5` opacity.
  The trace counted 22 squashed frames and two blank-inspector frames even
  though the endpoints looked correct.
- Card settings now remain in the shell-owned inspector layer, so Card, Motion,
  and Tunnel controls trade places without removing the inspector content tree.
  Card-to-2D and Card-to-Tunnel each record four crossfade frames, zero blank
  inspector frames, and a fixed `560 px` desktop inspector.
- Motion-mode restoration now reuses the existing Card containment lease and
  disables flex compression while the track is below the leased box. The final
  1440×900 Card-to-2D replay records zero squashed frames, zero transformed-cell
  frames, and the direct `card → animation → card` path. Card travel is
  `530 → 885 → 530 px`; stage allocation is `26 → 700 → 1 px`. Every leg has
  zero backtrack and zero overshoot.
- Card-to-Tunnel records the direct `card → tunnel → card` path with the same
  zero remount, blank, squash, transform, backtrack, and overshoot counts.
  Card-to-first-3D retains all three DOM identities and the honest 3D preparation
  surface; its inspector closes `560 → 4 px` and reopens `4 → 560 px`
  monotonically while the 3D stage takes the released space.
- Rapid reversal records `card → animation → card → tunnel → card` with zero
  intermediate split, remount, blank-workspace, blank-inspector, squash, or
  transformed-cell frames. Reduced motion records 35 workspace-dissolve frames
  with the same zero defect counts and no spatial Card layout change.
- The full 375×667, 960×412, 820×1180, 1440×900, 1920×1080, 2560×1440, and
  3840×2160 sweep reports no viewport overflow. Every reachable Card-to-2D
  replay records zero remount, blank, squash, transform, backtrack, and
  overshoot counts; 375×667 and 960×412 correctly withhold 3D through the shared
  viewport capability predicate.
- Forty-two focused tests pass, `svelte-check` reports zero errors and zero
  warnings, `git diff --check` is clean, and the final in-app-browser console
  contains no warnings or errors. Gate 4 is ready for Austen's visual review.
- Austen approved the final Card-to-motion handoff on 2026-09-01 with no
  remaining visual notes. Gate 4 is complete.

## Gate 5 contract

The production viewer stage and `SequenceVideos` are persistent sibling layers
inside the same shell-owned `PanelGroup` stage. Selecting Performances changes
the outer stage allocation and the two layers' complementary opacity in one
mode commit. The gallery therefore inherits the exact pixels released by the
inspector instead of mounting after the workspace has already changed shape.

The inactive gallery stays inert and retains browsing state, but it does not
load its shared store, attach a timing map to the shared playhead, or leave a
video playing. The hidden motion stage also receives paused playback while
Performances owns the workspace. Full motion uses the canonical emphasis clock;
reduced motion removes local interpolation and lets the existing named viewer
snapshot dissolve carry the state change.

Acceptance requires:

1. Stage and Performances retain one DOM identity through 2D, ready 3D, and
   rapid-reversal round trips.
2. Their opacity remains complementary, with no blank or double-opaque frame.
3. Both layers occupy the same stage box on every sampled frame.
4. The stage and desktop inspector allocations move monotonically on the same
   structural clock and return to their prior endpoints.
5. The inactive gallery neither fetches nor drives media playback or the shared
   sequence playhead.
6. Reduced motion uses the existing opacity-only workspace dissolve with no
   delayed mode commit or spatial tween.
7. Every required viewport passes overflow, responsive-axis, identity,
   readiness, opacity, layer-size, and allocation-travel checks. 3D remains
   disabled where the production viewport capability gate does not pass.

### Gate 5 evidence · 2026-09-01

- The production shell now holds exactly one persistent motion-stage layer and
  one persistent performance-gallery layer. The instrumented 1920×1080 2D
  round trip records 15 crossfade frames, zero remounts, zero blank frames,
  zero double-opaque frames, zero unready-gallery frames, `0.000` opacity
  complement drift, and `0 px` layer-width mismatch.
- At 1920×1080 the stage expands `932 → 1740 px` while the inspector closes
  `800 → 1 px`, then both reverse monotonically to their starting allocation.
  Every leg reports zero backtrack and zero overshoot.
- The ready-3D round trip records 15 crossfade frames through
  `animation-3d → videos → animation-3d`, with a fixed `1260 px` stage and the
  same zero-defect identity, opacity, readiness, and layer-size counts.
- Rapid reversal travels
  `animation → videos → animation → videos → animation` through 35 sampled
  crossfade frames without a blank, remount, double-opaque frame, readiness
  failure, opacity drift, or layer-size mismatch.
- Reduced motion commits each endpoint inside the existing viewer snapshot
  dissolve. The mounted layers snap to `Stage → Performances → Stage`, preserve
  both identities, and report zero blank, double-opaque, readiness, opacity,
  and layer-size defects.
- The 375×667 mobile replay uses its intentional vertical composition and
  records 18 crossfade frames with a fixed stage allocation. The complete
  375×667, 960×412, 820×1180, 1440×900, 1920×1080, 2560×1440, and 3840×2160
  sweep reports no viewport overflow. Every replay records zero remount,
  blank, double-opaque, unready, opacity-drift, width-mismatch, backtrack, and
  overshoot defects.
- Sixty-two focused tests pass, `svelte-check` reports zero errors and zero
  warnings, `git diff --check` is clean, and the final in-app-browser console
  contains no warnings or errors. Gate 5 is ready for Austen's visual review.

## Approval ledger

| Gate                           | Status           | Approved by | Approved at          | Notes                                                              |
| ------------------------------ | ---------------- | ----------- | -------------------- | ------------------------------------------------------------------ |
| 1. Side by Side ⇄ 2D / Card    | Approved         | Austen      | 2026-08-29 09:57 CDT | Approved after full/reduced, mobile-to-4K, and transformed-cell QA |
| 2. 2D ⇄ 3D                     | Approved         | Austen      | 2026-08-30 16:27 CDT | Approved after shared-clock crossfade and canvas-settle QA         |
| 3. 2D / 3D ⇄ Tunnel            | Ready for review |             |                      | Single-owner fade; 3D, reversal, reduced, mobile-to-4K green       |
| 4. Card ⇄ left-side modes      | Approved         | Austen      | 2026-09-01           | Direct paths; persistent surfaces; mobile-to-4K geometry green     |
| 5. Viewer stage ⇄ Performances | Ready for review |             |                      | Persistent layers; 2D/3D/reversal/reduced/mobile-to-4K green       |
| 6. Viewer stage ⇄ Post Studio  | Pending          |             |                      |                                                                    |
| 7. Export inspector            | Pending          |             |                      |                                                                    |
| 8. Practice                    | Pending          |             |                      |                                                                    |
| 9. Mode switchers              | Pending          |             |                      |                                                                    |

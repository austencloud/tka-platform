# Sequence Viewer Transition Program — Handoff (2026-09-01)

## Mission

Bring every main Sequence Viewer mode change to an individually instrumented,
visually approved A+ transition without creating a second motion system. Work
proceeds one gate at a time through the production viewer mounted inside
`/test/sequence-viewer-transitions`. The durable program contract and approval
ledger are in
[`2026-08-28-sequence-viewer-transition-orchestration-design.md`](active/2026-08-28-sequence-viewer-transition-orchestration-design.md).
The current Performance architecture is governed by
[`2026-09-01-performance-two-pane-workspace-design.md`](2026-09-01-performance-two-pane-workspace-design.md).

## Done — verified

- Gate 1, Side by Side ⇄ 2D / Card, is approved in the durable ledger for
  2026-08-29. Commit `1342ce01c4` established the production review surface,
  persistent panel composition, Card layout lease, reduced-motion dissolve,
  responsive sweep, and focused geometry tests. The orchestration spec records
  the final 960×412 and 1440×900 measurements, the seven-size sweep, green
  focused tests, zero Svelte diagnostics, and Austen's approval at 09:57 CDT.
- Gate 2, 2D ⇄ 3D, is approved in the durable ledger for 2026-08-30. Its evidence
  is carried in the Gate 2 section of the orchestration spec: full/reduced and
  rapid-reversal traces at mobile, tablet, desktop, and 4K reported zero blank,
  unready, loading-curtain, or late-backing frames; 56 focused tests and
  `svelte-check` were green. Austen approved it at 16:27 CDT.
- Gate 3, 2D / 3D ⇄ Tunnel, was implemented by `b660c9dc12`. The production
  shell owns one persistent Animator and one desktop inspector; the final
  1440×900, mobile, 4K, 3D, interruption, and reduced-motion traces in the
  orchestration spec record zero remount, duplicate, blank, unready, double-fade,
  or late-backing defects. Forty-seven focused tests and `svelte-check` were
  green. The durable approval ledger still says **Ready for review**; see the
  reconciliation item below.
- Gate 4, Card ⇄ motion modes, is approved for 2026-09-01. Commit `35d38a4c9b`
  made Card, motion surfaces, and inspector contents persistent and added the
  direct-path/reversal measurements. The seven-size sweep recorded zero
  remount, blank, squash, transformed-cell, backtrack, or overshoot defects;
  42 focused tests and `svelte-check` were green. Austen approved the final
  handoff with no remaining notes.
- Gate 5's first persistent-layer and instrumentation pass landed in
  `7fd97f1659`. Its durable evidence records clean 2D, ready-3D, reversal,
  reduced-motion, and seven-size traces plus 62 focused tests and zero Svelte
  diagnostics.
- Gate 5 was then redesigned as the approved two-pane Performance workspace in
  feature commit `46a1007dc6`, merged into local `main` by `889bc92a87`.
  `SequenceViewerShell` now keeps the outer stage and inspector tracks mounted;
  `PerformanceStage` changes the stage source, `PerformanceInspector` changes
  the right-hand information, and one `performance-workspace-state` owns
  selection, player registration, upload/map mode, deletion, and the shared
  playhead. Upload and timing mapping remain focused full-workspace editors.
- Verification for `46a1007dc6` on 2026-09-01: the configured Vitest command
  passed 55/55 focused tests across six files; `pnpm exec svelte-check
--tsconfig ./tsconfig.json --output machine` reported 83 files, 0 errors, and
  0 warnings; scoped Stylelint passed. The repository finish gate reran
  `npm run check` and reported 0 errors and 0 warnings before merging and
  deleting the task worktree.
- The final Gate 5 full-motion 2D replay recorded zero viewer-stage,
  Performance-stage, or inspector remounts; zero blank, double-opaque, unready,
  or visible inspector-layout-change frames; one maximum performance player;
  and 0 px layer-width mismatch. The surface path was
  `Motion stage → both → Performance stage → both → Motion stage`.
- The final Gate 5 rapid reversal retained the same zero counts and one player.
  Reduced motion recorded zero blank, double-opaque, unready, layout-change,
  and width-mismatch defects while the existing workspace dissolve owned the
  visible handoff. The cold 3D round trip completed in 20,660 ms with the same
  zero-defect counts and one player.
- Gate 5 was visually swept at 375×667, 960×412, 820×1180, 1440×900,
  1920×1080, 2560×1440, and 3840×2160. Every frame reported no viewport
  overflow. Compact layouts use a real bounded stage-over-inspector allocation;
  desktop layouts use stage left and inspector right. The integrated route
  returned HTTP 200 and rendered in the in-app Browser at
  `https://localhost:5173/test/sequence-viewer-transitions?gate=performances`.

## Believed done — unverified

- Gate 5's implementation and branch-level visual evidence are complete, but
  Austen has not yet given the final visual approval after the two-pane redesign.
  Do not mark Gate 5 approved until he reviews the current `main` route.
- The complete replay suite was run on the rebased feature commit immediately
  before integration. After the no-conflict merge, the real 5173 route was
  confirmed by HTTP 200 and rendered body text, but the full replay matrix was
  not rerun a second time on the merge commit.
- Austen sent “Approved” while reviewing the Tunnel work on 2026-09-01, but the
  durable Gate 3 ledger still says Ready for review and has no approval
  timestamp. The approval may have referred to the surrounding Tunnel layout
  refinement rather than the transition gate. Reconcile this with Austen
  instead of silently changing the ledger.

## In flight

- No Sequence Viewer product edits are uncommitted. The Performance feature
  worktree and branch were removed after the verified merge.
- The in-app Browser is positioned on
  `https://localhost:5173/test/sequence-viewer-transitions?gate=performances`
  for Gate 5 review.
- The primary checkout contains a pre-existing untracked `human-generator/`
  directory. It is unrelated to this program and must not be staged, deleted,
  moved, or included in transition commits.

## Loose ends (ranked)

1. Start by having Austen visually review Gate 5 on the current 5173 page. Run
   Replay with 2D, Replay with 3D, Stress reversal, and Reduced motion. If he
   approves, record the absolute approval date/time in the orchestration spec
   and the gate's durable state; do not approve it on his behalf.
2. Reconcile the Gate 5 contract/evidence in the active orchestration spec with
   the newer two-pane design. Its older wording still describes `SequenceVideos`
   as a gallery layer that closes the inspector, while the approved design and
   current code use `PerformanceStage` plus a persistent
   `PerformanceInspector`. Keep the measured evidence, but make ownership and
   acceptance criteria match the current architecture.
3. Resolve the Gate 3 approval-ledger ambiguity with Austen and record the
   outcome. Do not make him re-review the transition if his 2026-09-01
   “Approved” was intended as the gate sign-off.
4. After Gate 5 approval, begin Gate 6: Viewer stage ⇄ Post Studio. First inspect
   the real transition and instrument its surface identity, readiness, stage/
   inspector allocation, blank/double-painted frames, rapid reversal, reduced
   motion, and all seven required viewports. Present the recommended contract
   for approval before non-trivial implementation.
5. Continue in map order after Gate 6: Gate 7 Export inspector, Gate 8 Practice,
   and Gate 9 rail/mobile switcher feedback. Later gates may reuse current
   infrastructure but need their own visual approval.

## Decisions already made

- Austen's standing direction is one transition at a time, with a bird's-eye
  view of the whole viewer, canonical owners instead of hand-rolled timing, and
  an in-app visual gate for every sign-off.
- “Stage” is the canonical user-facing name for the 3D Sequence Viewer mode.
  Internal renderer identifiers can remain `animation-3d` where changing them
  would conflate UI terminology with state identity.
- Tunnel remains its own visualization. It shares the Animator, playback
  transport, art settings architecture, and inspector shell with 2D; it is not
  folded into 2D as a secondary effect.
- Performance remains its own visualization. Motion and Performance share the
  outer stage allocation and inspector track, not a fake common renderer.
- The Performance video and animation canvas stay separate mounted sources.
  `DualSourceCrossfade` owns their complementary opacity. The standard profile
  is intentional; the staggered soft dissolve produced a sampled blank frame on
  the reverse leg.
- A Performance poster counts as a visually ready destination. Waiting only for
  decoded video data made the transition stall for seconds despite a complete
  poster already being visible.
- Performance browsing is two-pane. Upload and step-map editing are focused
  full-workspace subflows. They reuse the same state owner and return to the
  still-mounted browse workspace.
- Narrow Performance layouts stack the stage above a bounded inspector. The
  inspector owns its list scroll, and no capability disappears on mobile.
- Reduced motion uses the existing named workspace dissolve and immediate final
  geometry. It must never wait inside the browser's View Transition update
  callback.
- The review route must exercise production controls and components. Directly
  changing viewer state would bypass the behavior under review.

## Gotchas

- Port 5173 is Austen's HTTPS dev server. Never start, stop, restart, kill, or
  replace it. Links and curl probes use `https://localhost:5173`, not HTTP.
- Austen explicitly prefers the in-app Browser for this program. Do not switch
  to DevTools for visual review.
- The replay controls can remain disabled for roughly 1–2 seconds after the
  review iframe reloads. Wait for “Production viewer ready” before clicking.
- A cold ready-3D Gate 5 replay took about 20.66 seconds. Do not treat the long
  preparation as a Performance transition failure unless the gate reports an
  error or never receives a ready 3D frame.
- The mobile Performance inspector cannot use an intrinsic `auto` basis because
  its layered contents measure near zero. `ViewerWorkspacePanels` receives
  `--performance-inspector-height` as an explicit responsive stacked
  destination. Reverting to `auto` hides the inspector beneath a full-height
  stage.
- Use `.performance-stage-layer video.performance-player` when counting the
  player. An exact `[class="performance-player"]` selector fails after Svelte
  adds its scoped class.
- Keep poster-backed readiness in `PerformanceStage.svelte`. Requiring
  `loadeddata` alone reproduces the seconds-long frozen gate and unready frames.
- The in-app Browser screenshot API can briefly return a solid violet frame
  after navigation even when the page has rendered. Confirm body text or wait
  before treating that as an application failure.
- Work alongside other sessions defensively. `main` advanced by dozens of
  commits during Gate 5; the feature was rebased without conflicts immediately
  before integration. Always use a task-owned worktree, rebase onto current
  `main`, and commit only explicit owned paths.

# Plan Index

Every implementation plan, ledger and audit sitting loose in this folder, with an evidence-backed status. **Archive-only policy: nothing here has been deleted or moved.** Note that the checkbox ledgers in these root-level plans are unreliable — most were never ticked even when the work landed — so status here leans on commit subjects, the presence of the code in `src/`, and whether the paired design was filed under `specs/shipped/`.

**127 loose plans in `docs/superpowers/plans/`** (files already filed under `active/`, `backlog/`, `shipped/`, `archived/` and the named subfolders are not listed here).

| Status | Count | Meaning |
| --- | --- | --- |
| SHIPPED | 98 | The thing it describes exists in `src/` or landed in a named commit. |
| SUPERSEDED | 6 | A later doc replaced it, or the doc says so itself. |
| IN-FLIGHT | 14 | Partly built — an open ledger, an open branch, or a named blocker. |
| OPEN | 9 | Still an idea. Nothing built, nothing supersedes it. |

Nothing has been deleted or moved. This index is the only new file.

## Open ideas worth a look

Complete enough to hand to an executor, and nothing supersedes them.

| # | File | Why it is worth a look |
| --- | --- | --- |
| 1 | [`2026-08-25-director-first-class-shell.md`](./2026-08-25-director-first-class-shell.md) | 56-task plan against a shipped, heavily-exercised film-director surface. The largest executor-ready plan on the list. |
| 2 | [`2026-06-27-beatstrip-extraction.md`](./2026-06-27-beatstrip-extraction.md) | Phase A.1 of the practice rehaul — everything downstream in `practice/` is waiting on it. |
| 3 | [`2026-06-27-practice-strip-viewer-integration.md`](./2026-06-27-practice-strip-viewer-integration.md) | Phase A.2, ready the moment A.1 lands. |
| 4 | [`2026-07-06-sidebar-package-convergence.md`](./2026-07-06-sidebar-package-convergence.md) | Rebuild and publish `@austencloud/sidebar` 1.0.0; unblocks the Phase B plan below it. |
| 5 | [`2026-07-06-sidebar-convergence-phase-b-tka.md`](./2026-07-06-sidebar-convergence-phase-b-tka.md) | 13-task ledger, 1 ticked. Blocked only on the package above. |
| 6 | [`2026-06-22-css-debt-cascade-layers.md`](./2026-06-22-css-debt-cascade-layers.md) | 559 `!important` removals with a cascade-layer strategy already written. Grindable in slices. |
| 7 | [`2026-07-19-guide-4k-per-page-polish.md`](./2026-07-19-guide-4k-per-page-polish.md) | A 39-page audit list. Re-audit first — some pages have likely been fixed since. |
| 8 | [`2026-07-22-kill-the-bar-hardening.md`](./2026-07-22-kill-the-bar-hardening.md) | Codex 5.6 found real correctness bugs in a shipped auth path. Verify which are still live. |
| 9 | [`2026-06-26-shop-operations-go-live.md`](./2026-06-26-shop-operations-go-live.md) | Not an engineering gap — a product decision about turning on real pre-orders. |

## By topic family

### film director  <sub>11 shipped, 1 in-flight, 1 open, 1 superseded</sub>

| File | Type | Status | Evidence | Next action |
| --- | --- | --- | --- | --- |
| [`2026-08-25-director-first-class-shell.md`](./2026-08-25-director-first-class-shell.md) | plan | **OPEN** | 3b240e7d28 plan + 87e02b10ea spec only; 0/56 | Executor-ready: film library front door, one-row transport, one save |
| [`2026-09-02-film-director-round2-ledger.md`](./2026-09-02-film-director-round2-ledger.md) | plan | **IN-FLIGHT** | c80c4570f3 wave D ticked; ledger 50/54 | 4 adversarial gaps left |
| [`2026-09-02-film-director-gap-6-performer-effect-config.md`](./2026-09-02-film-director-gap-6-performer-effect-config.md) | plan | **SUPERSEDED** | e2ac5c8092 — ruled out by the effect architecture |  |
| [`2026-08-23-film-director-directive-language.md`](./2026-08-23-film-director-directive-language.md) | plan | **SHIPPED** | f45e932013 + 94cb21d4e7 ticks all 12; ledger 57/57 |  |
| [`2026-08-24-film-director-plane-axes.md`](./2026-08-24-film-director-plane-axes.md) | plan | **SHIPPED** | 5505227f5b + 73f1aed8e7; ledger 22/22 |  |
| [`2026-08-30-film-director-gap-8a-camera-edges.md`](./2026-08-30-film-director-gap-8a-camera-edges.md) | plan | **SHIPPED** | 6b72820d71 merge; ledger 21/21 |  |
| [`2026-08-30-film-director-gap-campaign.md`](./2026-08-30-film-director-gap-campaign.md) | plan | **SHIPPED** | 8041edb411 closes the ledger; 11/12 | One campaign line left unticked |
| [`2026-08-30-film-director-gap-wave1.md`](./2026-08-30-film-director-gap-wave1.md) | plan | **SHIPPED** | 1a44e25ba8 merge; ledger 28/28 |  |
| [`2026-09-01-film-director-gap-3-camera-tracking.md`](./2026-09-01-film-director-gap-3-camera-tracking.md) | plan | **SHIPPED** | bc39c2a0c4 merged at f0152b61ac |  |
| [`2026-09-01-film-director-gap-4-shots.md`](./2026-09-01-film-director-gap-4-shots.md) | plan | **SHIPPED** | bb6ff7fd07 closes gap 4 |  |
| [`2026-09-02-film-director-gap-2-per-step-changes.md`](./2026-09-02-film-director-gap-2-per-step-changes.md) | plan | **SHIPPED** | ffac8aa657 + 73ff889a75 stepEffects/stepEfforts/holds |  |
| [`2026-09-02-film-director-gap-5-sequence-transforms.md`](./2026-09-02-film-director-gap-5-sequence-transforms.md) | plan | **SHIPPED** | 4690e6f687 merge — transforms + library source |  |
| [`2026-09-02-film-director-gap-7-blocking-edges.md`](./2026-09-02-film-director-gap-7-blocking-edges.md) | plan | **SHIPPED** | 8e8145de43 closes gap 7; ledger 46/46 |  |
| [`2026-09-02-film-director-gap-8b-orbit-direction-demo.md`](./2026-09-02-film-director-gap-8b-orbit-direction-demo.md) | plan | **SHIPPED** | 0bccc101f5 + 33362ce727 orbit cw follows the felt direction |  |

### qr/scan  <sub>5 shipped, 1 superseded</sub>

| File | Type | Status | Evidence | Next action |
| --- | --- | --- | --- | --- |
| [`2026-06-22-qr-card-journey-map.md`](./2026-06-22-qr-card-journey-map.md) | plan | **SUPERSEDED** | design archived; 6d44d33614 dropped the journey reveal |  |
| [`2026-06-29-instant-scan-card-pictographs.md`](./2026-06-29-instant-scan-card-pictographs.md) | plan | **SHIPPED** | 1031928883 make scan cards instant and stable |  |
| [`2026-07-02-qr-scan-viewer-header.md`](./2026-07-02-qr-scan-viewer-header.md) | plan | **SHIPPED** | 608507b652 profiled ViewerHeader | Superseded by the viewer-header unification plan |
| [`2026-07-02-scan-card-to-collection.md`](./2026-07-02-scan-card-to-collection.md) | plan | **SHIPPED** | f5d5a7ff1c ScanCardSheet continuous filing |  |
| [`2026-07-05-scan-handoff-desktop-to-phone.md`](./2026-07-05-scan-handoff-desktop-to-phone.md) | plan | **SHIPPED** | fb6622567a desktop handoff panel |  |
| [`2026-07-05-shortcode-dup-mint-fix.md`](./2026-07-05-shortcode-dup-mint-fix.md) | plan | **SHIPPED** | 928c29c4b5 one shortcode per sequence |  |

### choreo  <sub>5 shipped</sub>

| File | Type | Status | Evidence | Next action |
| --- | --- | --- | --- | --- |
| [`2026-06-30-choreo-sheet.md`](./2026-06-30-choreo-sheet.md) | plan | **SHIPPED** | bbef38b419 sheet builder + 7f3253fe7a persistence |  |
| [`2026-07-01-choreo-act-playback.md`](./2026-07-01-choreo-act-playback.md) | plan | **SHIPPED** | design filed in specs/shipped |  |
| [`2026-07-01-choreo-sheet-v2.md`](./2026-07-01-choreo-sheet-v2.md) | plan | **SHIPPED** | design filed in specs/shipped |  |
| [`2026-07-02-choreo-annotated-sheet.md`](./2026-07-02-choreo-annotated-sheet.md) | plan | **SHIPPED** | design filed in specs/shipped |  |
| [`2026-07-25-choreo-gorgeous-4k.md`](./2026-07-25-choreo-gorgeous-4k.md) | plan | **SHIPPED** | b87b42c6bc + fffbe0f5f7 + 67d4ca3103; design filed in specs/shipped |  |

### deck/shop  <sub>3 shipped, 1 in-flight, 1 open</sub>

| File | Type | Status | Evidence | Next action |
| --- | --- | --- | --- | --- |
| [`2026-06-26-shop-operations-go-live.md`](./2026-06-26-shop-operations-go-live.md) | plan | **OPEN** | only design+plan commits; SALES_LIVE still false | Product decision gate before real pre-orders |
| [`2026-08-02-shop-unification.md`](./2026-08-02-shop-unification.md) | plan | **IN-FLIGHT** | b085cdaa91 records shipped state + follow-ups; spec re-filed to active | Unpushed; SALES_LIVE=false — push is a prod event |
| [`2026-06-29-one-spot-info-cell-chooser.md`](./2026-06-29-one-spot-info-cell-chooser.md) | plan | **SHIPPED** | b1f5316be1 + 0c5b7927b7 |  |
| [`2026-07-10-loop-configurator-concepts-handoff.md`](./2026-07-10-loop-configurator-concepts-handoff.md) | handoff | **SHIPPED** | Concept A shipped d882677301; Deal & Spread payoff shipped 2026-07-11 |  |
| [`2026-07-13-shop-cart-order-doc.md`](./2026-07-13-shop-cart-order-doc.md) | plan | **SHIPPED** | ad2b93ebe3 createCartCheckout writes a pending order |  |

### guide  <sub>3 shipped, 1 in-flight, 1 open</sub>

| File | Type | Status | Evidence | Next action |
| --- | --- | --- | --- | --- |
| [`2026-07-19-guide-4k-per-page-polish.md`](./2026-07-19-guide-4k-per-page-polish.md) | plan | **OPEN** | 6ff3d1715f plan only; no per-page ledger | Re-audit the 39 pages at 4K and cut the list to what still fails |
| [`2026-07-14-guide-reflow-single-source.md`](./2026-07-14-guide-reflow-single-source.md) | plan | **IN-FLIGHT** | ledger 2/72; hand-positions shipped as the proof topic | Migrate the remaining Level-1 topics |
| [`2026-07-07-guide-reader.md`](./2026-07-07-guide-reader.md) | plan | **SHIPPED** | 4219935f4c continuous page scroller |  |
| [`2026-07-11-guide-print-interactive-shippable.md`](./2026-07-11-guide-print-interactive-shippable.md) | plan | **SHIPPED** | design filed in specs/shipped |  |
| [`2026-07-14-guide-crawlable-paginated-reader-plan.md`](./2026-07-14-guide-crawlable-paginated-reader-plan.md) | plan | **SHIPPED** | 576486695e; 5af1175292 marks final status |  |

### notation  <sub>5 shipped</sub>

| File | Type | Status | Evidence | Next action |
| --- | --- | --- | --- | --- |
| [`2026-07-18-notation-4k-layout-lab.md`](./2026-07-18-notation-4k-layout-lab.md) | plan | **SHIPPED** | 4e12517553 /test/notation-4k |  |
| [`2026-07-18-notation-roots-remediation.md`](./2026-07-18-notation-roots-remediation.md) | plan | **SHIPPED** | d1438ada3c + 29da3bc4fb merged to main |  |
| [`2026-07-19-notation-loops-implementation-plan.md`](./2026-07-19-notation-loops-implementation-plan.md) | plan | **SHIPPED** | 65b12b5088 /notation/loops; ledger 6/6 |  |
| [`2026-07-19-shape-matrix-elemental-drill.md`](./2026-07-19-shape-matrix-elemental-drill.md) | plan | **SHIPPED** | 33e42936ef; ledger 24/24 | Successors: fuse-shape-matrix, shape-matrix-app |
| [`2026-07-20-notation-caps-redesign.md`](./2026-07-20-notation-caps-redesign.md) | plan | **SHIPPED** | 4ed2f41eaf bento hub | 4K density correction spec still open |

### practice  <sub>3 shipped, 2 open</sub>

| File | Type | Status | Evidence | Next action |
| --- | --- | --- | --- | --- |
| [`2026-06-27-beatstrip-extraction.md`](./2026-06-27-beatstrip-extraction.md) | plan | **OPEN** | 130839a1cb is the plan doc only | Practice rehaul phase A.1 |
| [`2026-06-27-practice-strip-viewer-integration.md`](./2026-06-27-practice-strip-viewer-integration.md) | plan | **OPEN** | plan doc a58e566fa3; depends on phase A.1 | Practice rehaul phase A.2 |
| [`2026-06-28-practice-metronome.md`](./2026-06-28-practice-metronome.md) | plan | **SHIPPED** | 527e3199b3 per-beat click in the playback controller |  |
| [`2026-06-29-practice-setup-bottom-bar.md`](./2026-06-29-practice-setup-bottom-bar.md) | plan | **SHIPPED** | 64e74af47a mobile setup bar |  |
| [`2026-07-01-viewer-practice-ar-mirror.md`](./2026-07-01-viewer-practice-ar-mirror.md) | plan | **SHIPPED** | a6473cee3f passive AR mirror behind the practice canvas |  |

### app shell  <sub>1 shipped, 2 open</sub>

| File | Type | Status | Evidence | Next action |
| --- | --- | --- | --- | --- |
| [`2026-07-06-sidebar-convergence-phase-b-tka.md`](./2026-07-06-sidebar-convergence-phase-b-tka.md) | plan | **OPEN** | only be38cf4883 plan doc; ledger 1/13 | Blocked on Phase A of the package convergence |
| [`2026-07-06-sidebar-package-convergence.md`](./2026-07-06-sidebar-package-convergence.md) | plan | **OPEN** | only a64afd7afa + e7ecfffa61 doc commits | Rebuild and publish @austencloud/sidebar 1.0.0 |
| [`2026-07-05-hover-expand-overlay-sidebar.md`](./2026-07-05-hover-expand-overlay-sidebar.md) | plan | **SHIPPED** | 5637f5e982 + b1af963bbc hover-intent controller |  |

### auth  <sub>2 shipped, 1 open</sub>

| File | Type | Status | Evidence | Next action |
| --- | --- | --- | --- | --- |
| [`2026-07-22-kill-the-bar-hardening.md`](./2026-07-22-kill-the-bar-hardening.md) | plan | **OPEN** | post-review plan, 42-task ledger never ticked | Confirm which Codex 5.6 findings are still live before re-running |
| [`2026-07-12-account-deletion-tombstone.md`](./2026-07-12-account-deletion-tombstone.md) | plan | **SHIPPED** | cb3363624b tombstone + cascade cleanup; ledger 7/7 |  |
| [`2026-07-22-kill-the-bar-app-forward.md`](./2026-07-22-kill-the-bar-app-forward.md) | plan | **SHIPPED** | design filed in specs/shipped; 524474f788 nav path |  |

### effects  <sub>3 shipped</sub>

| File | Type | Status | Evidence | Next action |
| --- | --- | --- | --- | --- |
| [`2026-06-23-effect-tuner.md`](./2026-06-23-effect-tuner.md) | plan | **SHIPPED** | d139dd2f3c effect-tuner harness |  |
| [`2026-07-06-menagerie-effect.md`](./2026-07-06-menagerie-effect.md) | plan | **SHIPPED** | 22d5ce890c; effect later renamed to Animal |  |
| [`2026-08-05-effects-3d-migration.md`](./2026-08-05-effects-3d-migration.md) | plan | **SHIPPED** | src/lib/shared/3d/effects has bubbles, smoke, petals, bloom, poi, silk |  |

### filter/collections  <sub>3 shipped</sub>

| File | Type | Status | Evidence | Next action |
| --- | --- | --- | --- | --- |
| [`2026-07-06-max-turn-intensity-filter.md`](./2026-07-06-max-turn-intensity-filter.md) | plan | **SHIPPED** | ce06de5cc3 + 7f3599cbea chip |  |
| [`2026-07-06-smart-collections.md`](./2026-07-06-smart-collections.md) | plan | **SHIPPED** | d303ac1fb9 + the smart-collection commit stream |  |
| [`2026-07-07-founding-smart-collections.md`](./2026-07-07-founding-smart-collections.md) | plan | **SHIPPED** | ec4be89ebb founding config + adapter |  |

### loop/generate  <sub>3 shipped</sub>

| File | Type | Status | Evidence | Next action |
| --- | --- | --- | --- | --- |
| [`2026-07-08-loop-selector-vertical-panel.md`](./2026-07-08-loop-selector-vertical-panel.md) | plan | **SHIPPED** | c8105b6984 + ee757e2318 |  |
| [`2026-07-12-compositional-loop-p1-p2.md`](./2026-07-12-compositional-loop-p1-p2.md) | plan | **SHIPPED** | fdb06d9258 gates green; ledger 51/51 |  |
| [`2026-07-12-compositional-loop-p3.md`](./2026-07-12-compositional-loop-p3.md) | plan | **SHIPPED** | 5aa393e7ff gates green; ledger 24/24 |  |

### onboarding  <sub>2 shipped, 1 superseded</sub>

| File | Type | Status | Evidence | Next action |
| --- | --- | --- | --- | --- |
| [`2026-07-22-first-session-activation.md`](./2026-07-22-first-session-activation.md) | plan | **SUPERSEDED** | self: SUPERSEDED 2026-07-22, split into SP1/SP2/SP3 |  |
| [`2026-06-29-create-tutorial-mobile-fullscreen.md`](./2026-06-29-create-tutorial-mobile-fullscreen.md) | plan | **SHIPPED** | 5609c75ac1 |  |
| [`2026-06-29-create-tutorial-type1-and-tap-play.md`](./2026-06-29-create-tutorial-type1-and-tap-play.md) | plan | **SHIPPED** | 87ea44a136 tap-to-play minimal chrome |  |

### seo  <sub>3 shipped</sub>

| File | Type | Status | Evidence | Next action |
| --- | --- | --- | --- | --- |
| [`2026-07-09-seo-overhaul.md`](./2026-07-09-seo-overhaul.md) | plan | **SHIPPED** | ledger 53/59; design filed in specs/shipped | 6 unticked items remain |
| [`2026-07-16-flow-arts-software-seo.md`](./2026-07-16-flow-arts-software-seo.md) | plan | **SHIPPED** | b9bfe5060e /roots/software; ledger 23/28 |  |
| [`2026-07-17-flow-arts-software-round2.md`](./2026-07-17-flow-arts-software-round2.md) | plan | **SHIPPED** | b9bfe5060e /roots/software; ledger 15/19 | History redesign successor sits in specs/active |

### 3d viewer  <sub>1 shipped, 1 in-flight</sub>

| File | Type | Status | Evidence | Next action |
| --- | --- | --- | --- | --- |
| [`2026-08-23-viewer3d-intro-presets.md`](./2026-08-23-viewer3d-intro-presets.md) | plan | **IN-FLIGHT** | d732cb06e5 first-open overlay; ledger 13/52 | Presets panel in the 3D rail is unbuilt |
| [`2026-06-22-mobile-3d-scene-controls.md`](./2026-06-22-mobile-3d-scene-controls.md) | plan | **SHIPPED** | 555be330f9 two FABs + sheets |  |

### admin  <sub>2 shipped</sub>

| File | Type | Status | Evidence | Next action |
| --- | --- | --- | --- | --- |
| [`2026-06-23-admin-user-geolocation.md`](./2026-06-23-admin-user-geolocation.md) | plan | **SHIPPED** | 1a4207dfa6 user map section |  |
| [`2026-06-28-remove-and-purge-sequences.md`](./2026-06-28-remove-and-purge-sequences.md) | plan | **SHIPPED** | c69c1b4c85 admin purge function | Function deploy still gated |

### create/generate  <sub>2 shipped</sub>

| File | Type | Status | Evidence | Next action |
| --- | --- | --- | --- | --- |
| [`2026-08-16-generative-turn-configuration.md`](./2026-08-16-generative-turn-configuration.md) | plan | **SHIPPED** | 94bba27f96 generate from a turn pattern; 7c6788475b bridge-step coverage | Layer-signature blocker (bridge steps get no turns) still tracked separately |
| [`2026-08-16-turn-pattern-redesign.md`](./2026-08-16-turn-pattern-redesign.md) | plan | **SHIPPED** | 61c98d04c5 turn patterns under customize; b564ee0af3 sentence readback |  |

### filter/gallery  <sub>2 shipped</sub>

| File | Type | Status | Evidence | Next action |
| --- | --- | --- | --- | --- |
| [`2026-08-04-gallery-split-pane-workspace.md`](./2026-08-04-gallery-split-pane-workspace.md) | plan | **SHIPPED** | 6854d7e845; ledger 73/73 |  |
| [`2026-08-04-unified-filter-workspace.md`](./2026-08-04-unified-filter-workspace.md) | plan | **SHIPPED** | 92b06dcb55 ledger complete |  |

### halved pictograph  <sub>1 shipped, 1 in-flight</sub>

| File | Type | Status | Evidence | Next action |
| --- | --- | --- | --- | --- |
| [`2026-07-14-halved-pictograph-phase-2-arrow-identity.md`](./2026-07-14-halved-pictograph-phase-2-arrow-identity.md) | plan | **IN-FLIGHT** | 16ef2d19d8 buildHalvedStep; phase 2b explicitly deferred | Finish phase 2b (twin bugs first) |
| [`2026-07-14-halved-pictograph-phase-1-orientation-algebra.md`](./2026-07-14-halved-pictograph-phase-1-orientation-algebra.md) | plan | **SHIPPED** | 1422672395 plan; c274830f31 records phase 2a complete on top of it |  |

### landing  <sub>1 shipped, 1 superseded</sub>

| File | Type | Status | Evidence | Next action |
| --- | --- | --- | --- | --- |
| [`2026-07-18-how-tka-works-assembly-table.md`](./2026-07-18-how-tka-works-assembly-table.md) | plan | **SUPERSEDED** | replaced by the proof strip; design moved to specs/archived |  |
| [`2026-07-18-how-it-works-proof-strip.md`](./2026-07-18-how-it-works-proof-strip.md) | plan | **SHIPPED** | 06069726b5; design filed in specs/shipped |  |

### mandala  <sub>2 shipped</sub>

| File | Type | Status | Evidence | Next action |
| --- | --- | --- | --- | --- |
| [`2026-06-22-mandala-decoder.md`](./2026-06-22-mandala-decoder.md) | plan | **SHIPPED** | 4471cbeb1b decoder lab + 834709f2d3 |  |
| [`2026-06-26-mandala-loader.md`](./2026-06-26-mandala-loader.md) | plan | **SHIPPED** | cbb29e9d44 MandalaLoader + loading gate |  |

### museum  <sub>2 shipped</sub>

| File | Type | Status | Evidence | Next action |
| --- | --- | --- | --- | --- |
| [`2026-06-21-personal-museum.md`](./2026-06-21-personal-museum.md) | plan | **SHIPPED** | f1f97b3b4e in-world placement picker + 22 commits |  |
| [`2026-08-12-wing-declarations.md`](./2026-08-12-wing-declarations.md) | plan | **SHIPPED** | eb7ff0e2d3 recorded as built; e8108eb0e9 derives CAVE_MODE_ROOMS |  |

### museum/drowned gallery  <sub>1 shipped, 1 superseded</sub>

| File | Type | Status | Evidence | Next action |
| --- | --- | --- | --- | --- |
| [`2026-08-02-drowned-gallery-graybox.md`](./2026-08-02-drowned-gallery-graybox.md) | plan | **SUPERSEDED** | df52cef9bf ring v2 replaces the sump layout |  |
| [`2026-08-03-drowned-gallery-ring-graybox.md`](./2026-08-03-drowned-gallery-ring-graybox.md) | plan | **SHIPPED** | 56e5d337f9 ledger closed 6/6 | Channels design is the successor |

### process  <sub>1 shipped, 1 in-flight</sub>

| File | Type | Status | Evidence | Next action |
| --- | --- | --- | --- | --- |
| [`2026-08-01-great-closeout-ledger.md`](./2026-08-01-great-closeout-ledger.md) | plan | **IN-FLIGHT** | 13/43; rotation core done, Stripe Tax open | Work the remaining 30 close-out lines |
| [`2026-09-04-worktree-retirement-audit.md`](./2026-09-04-worktree-retirement-audit.md) | audit | **SHIPPED** | 967c68afc5 merged at bd34a90159 |  |

### pronunciation  <sub>2 shipped</sub>

| File | Type | Status | Evidence | Next action |
| --- | --- | --- | --- | --- |
| [`2026-08-16-pronunciation-corpus-session.md`](./2026-08-16-pronunciation-corpus-session.md) | plan | **SHIPPED** | dd2c841619 + cf268edb88 corpus saved to storage |  |
| [`2026-08-16-pronunciation-token-bank.md`](./2026-08-16-pronunciation-token-bank.md) | plan | **SHIPPED** | 8f140d2825 v2 token bank; ledger 36/37 |  |

### share intake  <sub>1 shipped, 1 in-flight</sub>

| File | Type | Status | Evidence | Next action |
| --- | --- | --- | --- | --- |
| [`2026-07-28-share-target-intake-native.md`](./2026-07-28-share-target-intake-native.md) | plan | **IN-FLIGHT** | tasks 0-3 DONE (d412cfa4e7, 6f1e7c1c3d, d231c87d6d) of a 133-step ledger | Resume at task 4 |
| [`2026-07-29-direct-share-shortcuts.md`](./2026-07-29-direct-share-shortcuts.md) | plan | **SHIPPED** | tasks 1-5 DONE (6abc00a146..7ef7679b56); design filed in specs/shipped |  |

### tunnel  <sub>2 shipped</sub>

| File | Type | Status | Evidence | Next action |
| --- | --- | --- | --- | --- |
| [`2026-07-06-tunnel-performer-appearance.md`](./2026-07-06-tunnel-performer-appearance.md) | plan | **SHIPPED** | 519f458ac2 cast section; 3df8a56fb3 performer skins | Branch codex/tunnel-performer-morph still open |
| [`2026-07-08-save-a-tunnel-collection.md`](./2026-07-08-save-a-tunnel-collection.md) | plan | **SHIPPED** | 1394d23c1c openTunnelInViewer |  |

### viewer  <sub>2 shipped</sub>

| File | Type | Status | Evidence | Next action |
| --- | --- | --- | --- | --- |
| [`2026-07-03-viewer-header-unification.md`](./2026-07-03-viewer-header-unification.md) | plan | **SHIPPED** | 608507b652 profiled ViewerHeader; 84f6d86645 deleted the superseded ones |  |
| [`2026-08-30-viewer-url-addressable-state.md`](./2026-08-30-viewer-url-addressable-state.md) | plan | **SHIPPED** | ea2c3c5567 + f31032657a; ledger 65/65 |  |

### wall plane  <sub>1 shipped, 1 in-flight</sub>

| File | Type | Status | Evidence | Next action |
| --- | --- | --- | --- | --- |
| [`2026-07-13-wall-plane-feasibility.md`](./2026-07-13-wall-plane-feasibility.md) | plan | **IN-FLIGHT** | self: tasks 1,2,3,5,6,7,10 shipped; task 4 pending Austen; 8,9,11 PAUSED | Visual gate (task 4) then unpause 8/9/11 |
| [`2026-07-13-wall-plane-depth-solver.md`](./2026-07-13-wall-plane-depth-solver.md) | plan | **SHIPPED** | acb57580f7 minimum-depth concavity solver |  |

### analytics  <sub>1 in-flight</sub>

| File | Type | Status | Evidence | Next action |
| --- | --- | --- | --- | --- |
| [`2026-08-04-session-triage.md`](./2026-08-04-session-triage.md) | plan | **IN-FLIGHT** | session-triage-queries.ts + session-friction-score.ts exist; no admin tab route | Build the admin tab |

### backgrounds/autumn  <sub>1 shipped</sub>

| File | Type | Status | Evidence | Next action |
| --- | --- | --- | --- | --- |
| [`2026-06-21-enchanted-autumn-dusk.md`](./2026-06-21-enchanted-autumn-dusk.md) | plan | **SHIPPED** | dd3c5a7abb + 062434d08e | Later replaced by the 2026-08 living autumn clearing |

### backgrounds/ocean  <sub>1 shipped</sub>

| File | Type | Status | Evidence | Next action |
| --- | --- | --- | --- | --- |
| [`2026-06-21-2d-fish-motion-smoothing.md`](./2026-06-21-2d-fish-motion-smoothing.md) | plan | **SHIPPED** | design filed in specs/shipped |  |

### browse  <sub>1 superseded</sub>

| File | Type | Status | Evidence | Next action |
| --- | --- | --- | --- | --- |
| [`2026-06-30-gallery-start-here-phase1.md`](./2026-06-30-gallery-start-here-phase1.md) | plan | **SUPERSEDED** | 7603fabf2a shipped it; front door later replaced by the browse IA migration |  |

### combinator  <sub>1 shipped</sub>

| File | Type | Status | Evidence | Next action |
| --- | --- | --- | --- | --- |
| [`2026-08-04-sequence-combinator.md`](./2026-08-04-sequence-combinator.md) | plan | **SHIPPED** | 475650e8e5 lab page | Redesign spec 2026-08-05 still open |

### creators  <sub>1 shipped</sub>

| File | Type | Status | Evidence | Next action |
| --- | --- | --- | --- | --- |
| [`2026-07-01-creator-profile-readability-density.md`](./2026-07-01-creator-profile-readability-density.md) | plan | **SHIPPED** | 7b72aefa6d |  |

### css/infra  <sub>1 open</sub>

| File | Type | Status | Evidence | Next action |
| --- | --- | --- | --- | --- |
| [`2026-06-22-css-debt-cascade-layers.md`](./2026-06-22-css-debt-cascade-layers.md) | plan | **OPEN** | only f6bbe9e982 + c38e9e3f13 doc commits | 559 !important removals still outstanding |

### effects/led  <sub>1 in-flight</sub>

| File | Type | Status | Evidence | Next action |
| --- | --- | --- | --- | --- |
| [`2026-08-16-led-simulator-plan.md`](./2026-08-16-led-simulator-plan.md) | plan | **IN-FLIGHT** | 065a2a046a config v2 + 2D pipeline; ledger 14/21 | 7 ledger items left |

### endless spinner  <sub>1 shipped</sub>

| File | Type | Status | Evidence | Next action |
| --- | --- | --- | --- | --- |
| [`2026-07-29-endless-spinner-rebuild.md`](./2026-07-29-endless-spinner-rebuild.md) | plan | **SHIPPED** | b25193b683 + fbe2542c97; design filed in specs/shipped |  |

### film  <sub>1 shipped</sub>

| File | Type | Status | Evidence | Next action |
| --- | --- | --- | --- | --- |
| [`2026-09-01-film-autosave-plan.md`](./2026-09-01-film-autosave-plan.md) | plan | **SHIPPED** | 0fef25bcdf merged at 9b92755b4e; ledger 7/7 | End-to-end record-to-retained-render proof still owed |

### fuse  <sub>1 shipped</sub>

| File | Type | Status | Evidence | Next action |
| --- | --- | --- | --- | --- |
| [`2026-08-21-fuse-choreo-card-contract-repair.md`](./2026-08-21-fuse-choreo-card-contract-repair.md) | plan | **SHIPPED** | b5de6e0355 restore choreo card contracts |  |

### generate  <sub>1 shipped</sub>

| File | Type | Status | Evidence | Next action |
| --- | --- | --- | --- | --- |
| [`2026-07-30-generate-saved-setups-favorites.md`](./2026-07-30-generate-saved-setups-favorites.md) | plan | **SHIPPED** | bc2daf5d4a closes it 25/25 on f9548ddc6b |  |

### mandala/sticker  <sub>1 shipped</sub>

| File | Type | Status | Evidence | Next action |
| --- | --- | --- | --- | --- |
| [`2026-08-20-path-mandalas-sticker-convergence.md`](./2026-08-20-path-mandalas-sticker-convergence.md) | plan | **SHIPPED** | 4796b1cf7e sticker-lab converges the path mandala workflows |  |

### mcp  <sub>1 shipped</sub>

| File | Type | Status | Evidence | Next action |
| --- | --- | --- | --- | --- |
| [`2026-07-27-mcp-resource-server-auth.md`](./2026-07-27-mcp-resource-server-auth.md) | plan | **SHIPPED** | 0472386f94 authorization on the http transport |  |

### museum/air  <sub>1 shipped</sub>

| File | Type | Status | Evidence | Next action |
| --- | --- | --- | --- | --- |
| [`2026-08-05-air-updraft-prototype.md`](./2026-08-05-air-updraft-prototype.md) | plan | **SHIPPED** | 18c35bcc1e updraft column; ledger 11/11 | Prototype only — the Air room itself is unbuilt |

### museum/earth  <sub>1 shipped</sub>

| File | Type | Status | Evidence | Next action |
| --- | --- | --- | --- | --- |
| [`2026-08-04-earth-canyon-graybox.md`](./2026-08-04-earth-canyon-graybox.md) | plan | **SHIPPED** | a828740e57 + c02fe06f92 ledger 5/5 | Pit-render defect tracked in the 08-05 handoff |

### museum/fire  <sub>1 shipped</sub>

| File | Type | Status | Evidence | Next action |
| --- | --- | --- | --- | --- |
| [`2026-08-04-first-fire-graybox.md`](./2026-08-04-first-fire-graybox.md) | plan | **SHIPPED** | 987b7d68b2 ledger closed 5/5 | Torch procession + cinder court are successors |

### museum/sun  <sub>1 in-flight</sub>

| File | Type | Status | Evidence | Next action |
| --- | --- | --- | --- | --- |
| [`2026-08-05-sundial-graybox.md`](./2026-08-05-sundial-graybox.md) | plan | **IN-FLIGHT** | self: tasks 1-5 DONE (d9e92e8a68, e45af28ab3) but task 5's gate did NOT pass | Work the Loose ends section, re-run the gate |

### museum/water  <sub>1 in-flight</sub>

| File | Type | Status | Evidence | Next action |
| --- | --- | --- | --- | --- |
| [`2026-08-16-water-wing-playable-graybox.md`](./2026-08-16-water-wing-playable-graybox.md) | plan | **IN-FLIGHT** | 6a11560c69 plan; ledger 8/48 | Task 8 is a non-delegable first-person walk |

### perf/boot  <sub>1 shipped</sub>

| File | Type | Status | Evidence | Next action |
| --- | --- | --- | --- | --- |
| [`2026-06-24-gallery-prefetch-staleness-gate.md`](./2026-06-24-gallery-prefetch-staleness-gate.md) | plan | **SHIPPED** | f0194405e6 bounded idle callback |  |

### play  <sub>1 shipped</sub>

| File | Type | Status | Evidence | Next action |
| --- | --- | --- | --- | --- |
| [`2026-07-12-play-arcade.md`](./2026-07-12-play-arcade.md) | plan | **SHIPPED** | 8896238d2e ledger complete, all 10 tasks | Follow-ups recorded in the ledger |

### play/3d  <sub>1 in-flight</sub>

| File | Type | Status | Evidence | Next action |
| --- | --- | --- | --- | --- |
| [`2026-08-18-performer-hub-rethink.md`](./2026-08-18-performer-hub-rethink.md) | plan | **IN-FLIGHT** | e95aadbad3 + 92c0d260fe dock occlusion fix; ledger 28/50 | 22 tasks left |

### poi legality  <sub>1 shipped</sub>

| File | Type | Status | Evidence | Next action |
| --- | --- | --- | --- | --- |
| [`2026-07-18-poi-legal-composer-filtering.md`](./2026-07-18-poi-legal-composer-filtering.md) | plan | **SHIPPED** | f6f7314ac7 behind a dark gate | Decide whether to lift the dark gate |

### profile  <sub>1 shipped</sub>

| File | Type | Status | Evidence | Next action |
| --- | --- | --- | --- | --- |
| [`2026-07-28-profile-lobby.md`](./2026-07-28-profile-lobby.md) | plan | **SHIPPED** | 512e83aa49 three-band stage on the live profile; design filed in specs/shipped |  |

### pwa/offline  <sub>1 shipped</sub>

| File | Type | Status | Evidence | Next action |
| --- | --- | --- | --- | --- |
| [`2026-07-02-sw-update-flow.md`](./2026-07-02-sw-update-flow.md) | plan | **SHIPPED** | design filed in specs/shipped |  |

### shape matrix  <sub>1 shipped</sub>

| File | Type | Status | Evidence | Next action |
| --- | --- | --- | --- | --- |
| [`2026-06-21-shape-matrix-lab.md`](./2026-06-21-shape-matrix-lab.md) | plan | **SHIPPED** | 97f2ff06fe; design filed in specs/shipped |  |

### shared ui  <sub>1 shipped</sub>

| File | Type | Status | Evidence | Next action |
| --- | --- | --- | --- | --- |
| [`2026-07-08-unified-sequence-selection.md`](./2026-07-08-unified-sequence-selection.md) | plan | **SHIPPED** | 1e19dc91d5 guide strips on the shared primitive | Successor drill in specs/active |

### spiroanim  <sub>1 in-flight</sub>

| File | Type | Status | Evidence | Next action |
| --- | --- | --- | --- | --- |
| [`2026-08-30-spiroanim-tka-bridge.md`](./2026-08-30-spiroanim-tka-bridge.md) | plan | **IN-FLIGHT** | 3e7663bd0f + 3c08d69e1a bridge route works; SpiroAnim PR #4 unmerged | Merge the upstream SpiroAnim PR |

### teardown  <sub>1 shipped</sub>

| File | Type | Status | Evidence | Next action |
| --- | --- | --- | --- | --- |
| [`2026-06-26-xp-teardown.md`](./2026-06-26-xp-teardown.md) | plan | **SHIPPED** | 1b17aa1f95 removed the last vestiges |  |

### testing  <sub>1 shipped</sub>

| File | Type | Status | Evidence | Next action |
| --- | --- | --- | --- | --- |
| [`2026-06-29-component-test-layer.md`](./2026-06-29-component-test-layer.md) | plan | **SHIPPED** | d26d22579d component tests landed |  |

### tika  <sub>1 shipped</sub>

| File | Type | Status | Evidence | Next action |
| --- | --- | --- | --- | --- |
| [`2026-09-05-tika-arrange-verb.md`](./2026-09-05-tika-arrange-verb.md) | plan | **SHIPPED** | 57760d601f live battery; merged ef2a9a8e2e today |  |

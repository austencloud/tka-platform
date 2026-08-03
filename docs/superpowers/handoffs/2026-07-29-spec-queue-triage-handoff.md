# Spec Queue Triage — Handoff (2026-07-29)

## Mission

Continue the repository-wide spec reconciliation Austen requested on 2026-07-29: remove fully implemented work from the active queue, preserve completed designs in `shipped/`, preserve replaced or obsolete designs in `archived/`, and leave anything that still lacks live, browser, device, or production proof in the queue with an honest resume point. This pass reduced the detector's active and backlog scan from 151 specs to 137 without deleting design history.

## Done — verified

Commit `87db5680d1c8650aaeebe47da1e071c2dfb91401` reclassified 14 specs with explicit path-scoped staging and commit:

| Spec | Disposition | Evidence |
|---|---|---|
| [Beta Offset Swap](./shipped/2026-05-12-beta-offset-swap-design.md) | Shipped | Implementation commit `ceb4a0f342`; current model, placement, Create handler, MCP renderer, and cache-key test all carry `betaSwapped`. |
| [Art Settings Panel + Tunnel Export](./shipped/2026-06-21-art-settings-panel-design.md) | Shipped | Rail `8c6338de3b`; export `c776aacd34`; kaleidoscope layers `a39c7027f3`; current analytics contract test passed. |
| [Content-Hash V2 Rollout](./shipped/2026-06-30-content-hash-v2-rollout.md) | Shipped | Staged rollout `e7331c42c1`, `d814ad76d3`, `81f72d2457`, `4a9b8e872c`; recorded migration proof covered 936 production documents with zero would-rewrite or would-fork-on-resave results. |
| [Creator Profile Readability + Density](./shipped/2026-06-30-creator-profile-readability-density-design.md) | Shipped | Feature commit `7b72aefa6d`; audit fixes `df6bc2f1cc`; current Creators source retains the compact state, frosted surface, and collapsed admin controls. |
| [Gallery Drill Content Peek](./shipped/2026-07-01-gallery-drill-content-peek-design.md) | Shipped | Gallery drill v7 commit `e2d821b1f9`; desktop and virtual-grid follow-up `81b9716271`; `GalleryDrill.svelte` remains the live front door. |
| [Viewer / Scan Chrome Unification](./shipped/2026-07-02-viewer-scan-chrome-unification-design.md) | Shipped | Shared shell commit `fcd3a516d8`; the 16-test shell contract passed. The later `/sequence/[id]` migration seam is not unfinished scope from this two-host design. |
| [Loop-Detection Audit Fixes](./shipped/2026-07-03-fable-loop-detection-audit-fixes-design.md) | Shipped | Canonical algebra commit `f3f2eab145`; app audit and sequence-engine recovery tests passed in this session. |
| [Sectioned Virtual Gallery](./shipped/2026-07-03-sectioned-virtual-gallery-design.md) | Shipped | Virtualization commit `9d6b3cfe75` recorded 6–7 rendered cards, 57–65 ms tasks, bounded DOM size, and working section jumps in Chrome; `81b9716271` fixed the remaining first-paint hole. |
| [Hover-Expand Overlay Sidebar](./shipped/2026-07-05-hover-expand-overlay-sidebar-design.md) | Shipped | Rail commits `b1af963bbc`, `2db901593b`, `5637f5e982`; single-tree morph `89bcf81be8`; package migration `5483ff00f5`; sidebar package-boundary tests passed. |
| [Fuse Tab v2](./archived/2026-03-28-fuse-tab-v2-design.md) | Archived | The spec already recorded that v2 was reverted and the FLIP approach failed. Fuse-as-a-Mixer commit `65af4c3175` is the replacement lineage. |
| [Merge Card View into Decks](./archived/2026-03-28-merge-card-view-into-decks-design.md) | Archived | Commit `dd8420258d` retired Catalogs, Card Designer, and Theme Lab, removing the tab structure this draft proposed changing. |
| [Per-Performer Prop Sizing](./archived/2026-05-20-per-performer-prop-sizing-design.md) | Archived | Core sizing and badges landed in `a2bea2b2e1`, `d62aada8b2`, `0192fbc583`, and `776b3346aa`; the UI proposal was replaced by the shipped Performer Rail and Performer Hub. |
| [Gallery Front Door Phase 1](./archived/2026-07-01-gallery-front-door-phase1-design.md) | Archived | Gallery drill v7 `e2d821b1f9` absorbed the front-door behavior. Building this draft now would create a second, retired entry model. |
| [Creators to Social](./archived/2026-07-08-creators-to-social-design.md) | Archived | Commit `2a940bd17e` promoted Creators to its own top-level module and retired the intermediate Social placement. |

Verification run on 2026-07-29:

- `pnpm exec vitest run --config tests/config/vitest.config.ts tests/unit/content-hash-v2-fork-proof.test.ts tests/unit/sidebar-shell-contract.test.ts tests/unit/art-export-analytics.test.ts tests/unit/3d-viewer/prop-size-link.test.ts tests/unit/sequence-viewer-shell-contract.test.ts tests/unit/loop/real-loop-detector-audit.test.ts tests/unit/CellCacheKeyDeriver.test.ts`
  - Result: 7 files passed, 55 tests passed.
- From `packages/sequence-engine/`: `pnpm exec vitest run --config vitest.config.ts tests/loop/detection/real-loop-recovery.test.ts`
  - Result: 1 file passed, 19 tests passed.
- `npm run check`
  - Result: 0 errors and 5 warnings. The warnings are in unrelated existing files.
- `node scripts/spec-drift-detector.cjs --json <temp-path>`
  - Result after the moves: 137 scanned, 91 active, 46 backlog. Buckets: 9 `DIVERGENT`, 2 `LIKELY_DONE`, 2 `GHOST_PATHS`, 7 `WATCH`, 2 `DRIFT_ACKED`, 62 `NO_STATE`, and 53 `OK`.

## Believed done — unverified

- [QR Account Funnel](./active/2026-07-05-qr-account-funnel-design.md) says implemented, but its browser and authenticated-flow proof is still blocked. Keep it active until the listed sign-in and return-path checks are observed.
- [Shortcode Duplicate Mint Fix](./active/2026-07-05-shortcode-dup-mint-fix-design.md) has code, rules, and backfill commits, but the last recorded live behavior still minted a duplicate after deployment. It needs a current production-shaped save of an existing payload plus a Firestore query proving no new shortcode document was created.
- [Shop Transitions](./active/2026-06-26-shop-transitions-design.md) has direct implementation traffic in the Motion-FLIP commit `60f946c57c`, the shared route-morph commit `924eecda09`, and the 2026-07-27 named-view-transition refactor `d3a9926b32`. It still needs the spec's browser interaction and layout-stability proof before closeout.
- [Effects Preset Data Consolidation](./active/2026-06-04-effects-preset-data-consolidation-design.md) records 50 passing tests and completed implementation, but explicitly leaves its in-browser checklist owed.
- [QR Scan to Play](./active/2026-06-22-qr-scan-to-play-design.md) has later QR and scan-event commits. It still needs a real rendered card, phone scan, route resolution, and Firestore Scan Activity observation.
- [Gallery Thumbnail Warm Pass](./active/2026-07-02-gallery-thumbnail-warm-pass-design.md) and [Tail Latency](./active/2026-07-23-gallery-thumbnail-tail-latency-design.md) have implementation commits but still need representative field and cache-tier measurements.
- [Inbox iOS Focus Zoom](./active/2026-07-23-inbox-ios-focus-zoom-design.md), [Inbox Multiline Rendering](./active/2026-07-23-inbox-multiline-message-rendering-design.md), and [Train Wake Lock](./active/2026-07-23-train-screen-wake-lock-design.md) have code fixes but retain device verification requirements.
- [Provider-Aware Account Deletion](./active/2026-06-30-account-deletion-provider-aware-reauth-design.md) should not be closed from source inspection alone. Verify provider-specific reauthentication in an emulator or expendable test account, not Austen's live account.

## In flight

- Branch: `main`. No branch or worktree was created.
- The triage closeout is fully committed at `87db5680d1c8650aaeebe47da1e071c2dfb91401`. Before this handoff file, the triage task owned no uncommitted files and left no staged changes.
- The shared checkout contains unrelated work from other sessions in launcher/status-bar files, Create workspace sharing, Write sheet/PDF layout, landing and homepage work, mobile sharing, animation visibility, and 3D trails. Do not reset, stage, reformat, or commit those files as part of spec triage.
- A fresh claim appeared during this pass at `docs/superpowers/specs/.claims/2026-05-29-3d-trail-parity-design.md.lock`, claimed on 2026-07-29 at 23:02:43 -05:00 for the 3D trail visibility envelope. It belongs to another live task and must be preserved.

## Loose ends (ranked)

1. **Adjudicate Shop Transitions.** It is the strongest next closeout candidate among the remaining `DIVERGENT` specs. Reconcile the original acceptance list against the current named-view-transition implementation, obtain the required browser proof, then either ship it or update `remaining` with the exact failed cases.
2. **Resolve the shortcode production question.** Re-run the duplicate-save scenario against current deployed behavior and inspect the resulting Firestore identity. This is the only responsible basis for closing the duplicate-mint spec.
3. **Reconcile the remaining detector hazards.** The nine `DIVERGENT` entries after this wave are Scene Composer, Shop Transitions, Real-Flow Notation, Scan Card to Collection, Cross-Feature Decoupling, Physical Merch Store, Error Boundary System, Social Sharing SSR, and Mandala Phase 2 Trails. Several are broad-path or homonym false positives. Read each spec and inspect its named files before changing status.
4. **Audit the two ghost-path entries.** Anatomical IK Constraints has 80 percent of named paths deleted. Turn-in-Place Animation has all named paths deleted but is still blocked on missing clip assets. Determine replacement paths and dependencies before archiving either one.
5. **Work through high-signal `NO_STATE` specs.** Start with Shop Operations Go-Live, Add to Collection UX, QR Scan to Play, Q-Scan Instrumentation, and Viewer Popover Architecture. Their commit traffic is high enough that stale status text could cause a rebuild.
6. **Classify specs stored at the root of `docs/superpowers/specs/`.** The drift detector only scans `active/` and `backlog/`. Root-level Fuse specs, dispatch documents, ledgers, and handoffs are invisible to queue counts until deliberately classified.
7. **Refresh partial specs instead of merely leaving them alone.** When a spec is genuinely incomplete, replace generic `remaining` text such as “Body status: Active” with the cold-start resume point and set `last_triaged: 2026-07-29`.

## Decisions already made

- Austen's 2026-07-29 direction is to remove fully implemented specs from the queue and start using handoffs as the continuation boundary.
- Completed work moves to `shipped/`. Replaced, rejected, reverted, or obsolete work moves to `archived/`. Historical specs are not deleted.
- A code commit alone is not enough when the spec still requires browser, device, Firestore, authentication, or production proof. Those specs stay active until the stated observation exists.
- The drift detector is a shortlist, not an automatic migration tool. Every move in `87db5680d1` was adjudicated against commit history, current source, tests, or recorded browser evidence.
- A completed audit can still own unfinished implementation work. The Performance Audit remains active because its audit is complete but its prioritized remediation and design decision are not.
- All commits in the shared checkout use explicit pathspecs. Unrelated dirty files and claims are preserved.

## Gotchas

- `spec-drift-detector.cjs` exits with code 1 while actionable drift remains. That exit is expected after this wave; inspect the written JSON and bucket counts instead of treating it as a broken command.
- Detector false positives come from broad directory paths and topic homonyms. Physical Merch Store, Cross-Feature Decoupling, and Error Boundary System currently show that pattern.
- The detector ignores root-level spec documents and `backlog/someday/`. The reported 137 is the actionable `active/` plus `backlog/` queue, not every Markdown file under `specs/`.
- The app loop audit prints a table containing intentional `FAIL` and `PARTIAL` observations for noncanonical legacy detectors. The Vitest file itself passed all six assertions. Do not mistake its diagnostic stdout for a failed test run.
- The sequence-engine Vitest config sets its own root. Run its test from `packages/sequence-engine/`; passing the repository-relative path from the repository root returns “No test files found.”
- The full check's five existing warnings were two `line-clamp` compatibility warnings, two unused reduced-motion selectors, and one `figcaption` parent warning. There were zero errors.
- The body of Scan Handoff calls Scan Card to Collection “SHIPPED,” while the separate scanner spec and current proof do not support closing that dependency yet. Verify the actual filing flow instead of trusting that sentence.
- Port 5173 is Austen's HTTPS dev server. Do not start, stop, or restart it. Browser interaction requires the permission and verification rules in `AGENTS.md`.

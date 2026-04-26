# Spec & Plan Queue

> **This is a snapshot.** Run `/queue` for live data from spec frontmatter.
> Generated: 2026-04-26.

Ranked by VALUE (1-5) x EFFORT_MULTIPLIER (XS=5, S=4, M=3, L=2, XL=1). Higher score = better ROI.

## Directory Layout

```
specs/
  shipped/    162 completed specs (historical reference only)
  active/       5 specs with current-sprint work
  backlog/     55 specs triaged and scored below
  archived/    20 superseded, rejected, or correctly deprioritized
plans/
  shipped/    plans for completed work
  active/     plans for in-progress work
  backlog/    plans awaiting execution
```

---

## ACTIVE (in-flight, has explicit resume point)

| Spec | Status | Next Step |
|------|--------|-----------|
| sequence-viewer-redesign-design | Phases 0+1 done (12 commits) | Resume Phase 2 Task 11 (DestinationBadge) |
| sequence-viewer-redesign-notes | Architectural notes for above | Reference doc for Phase 2+ |
| native-mobile-integration | Phase 1 store-ready shipped | Phase 2: SQLite offline, native auth, haptics |
| sequence-engine-unification | beat→step rename landed | Delete app-side executors, consolidate MCP copies |
| effects-unification-deferred | Items documented | Fix crackle 3D parity, FireTipTracker aliasing, zap dark mode |

---

## TIER 1: CLOSE-OUTS (score 16-25, 90%+ done, verify & ship)

| Score | Spec | Effort | Remaining |
|-------|------|--------|-----------|
| 25 | sticker-lab-mvp | XS | Verify functional. Cloud persistence = separate spec |
| 20 | effect-state-unification | S | Trail path into tipEffectMap, localStorage key cleanup |
| 20 | r2-video-storage-migration | S | Core live. Multipart only at scale |
| 16 | mpc-print-prep-tab | S | Verify PDF at 822x1122px MPC spec |
| 16 | gallery-virtualization-sidebar | S | Visual QA — was reverted once for styling |
| 16 | create-offline-persistence | S | Verify offline save-to-library e2e |
| 16 | portfolio-lower-sections-redesign | S | All 5 sections redesigned. QA pass |

---

## TIER 2: HIGH-VALUE QUICK WINS (score 12-16)

| Score | Spec | Effort | Source | Remaining |
|-------|------|--------|--------|-----------|
| 16 | level-modal-redesign | S | forgotten | Full build |
| 16 | unified-create-tab-hints | S | forgotten | Full build |
| 16 | adaptive-gallery-controls | S | forgotten | Full build |
| 12 | festival-qr-offline-audit | M | partial | iOS Universal Links, web fallback. Critical for card launch |
| 12 | sequence-viewer-unification | M | partial | Route consolidation (/p/ + /sequence/ → one shell) |
| 12 | atomic-plane-system | M | partial | L8 done. L9 fusion = new spec when needed |
| 12 | offline-first-architecture | M | partial | Proactive SVG prefetch + status toast. Festival scenario |
| 12 | view-sequence-mcp-tool | M | forgotten | Full build |
| 12 | my-props-editor | M | forgotten | Full build |
| 12 | profile-screen | M | forgotten | Full build |
| 12 | shortcode-durability-roadmap | S | partial | Wave 2 polish (sparklines, zero-scan view) |
| 12 | mobile-bento-export-panels | S | partial | Sub-sheet polish |
| 12 | arrow-tip-z-promotion | M | partial | Needs Illustrator SVG splitting for 60 arrows |
| 12 | unified-museum-mode | M | partial | E-key interaction + overlay in 3D |
| 12 | invert-rotation-toggle | S | partial | Single Invert button replacing CW/CCW pair |

---

## TIER 3: STRATEGIC INVESTMENTS (score 8-10, L/XL effort)

| Score | Spec | Effort | Remaining |
|-------|------|--------|-----------|
| 10 | unified-gpu-render-pipeline | L | WebGPU backend, full 2D migration. Incremental |
| 10 | sequence-engine-unification | L | See active — tracked there |
| 10 | native-mobile-integration | L | See active — tracked there |
| 9 | silk-polish | M | 6 renderer upgrades (~280 LOC). Well-scoped |
| 9 | turn-in-place-animation | M | Authored turn clips for 14 heading changes |
| 9 | arrange-tab-unified-sidebar | M | Collapsible-section refactor |
| 9 | per-room-lighting | M | Replace global ambient with per-room local lights |
| 9 | compositional-data-model | M | 2x2 browse taxonomy UI |
| 9 | poi-image-library | M | Firebase persistence layer (local library works) |
| 8 | hand-path-ecosystem | L | 3 lab tabs (Atlas, Builder, Disassemble view) |
| 8 | level-1-guide-redesign | L | Content authoring for 40+ interactive pages |
| 8 | physical-merch-store | L | Stripe + MakePlayingCards |
| 8 | sequence-viewer-redesign | L | Phase 2 Tasks 11-24. See active |
| 8 | led-strip-pattern-engine | L | Hardware upload (BLE/USB). Needs physical devices |
| 8 | mandala-canonical-form | L | Scoping memo. Needs spec |
| 8 | unified-render-composition | L | Full build |
| 8 | creator-intent-compositional-finalization | L | Full build |
| 8 | applications-tab | S | Act editing modal, performer portfolio |
| 8 | museum-game-integration-tests | S | Suites 2-4 (RoomGraph, GameBridge, ResourceDisposal) |
| 8 | orientation-selector-ux | S | Verify CW/CCW→clock/counter label fix |

---

## TIER 4: DEFER (score <8 or blocked)

| Spec | Why Deferred |
|------|-------------|
| media-workspace | Video panel works as Lab tab. Viewer integration = separate vision |
| festival-hub | UI built but needs real data (scraping/curation pipeline) |
| 1989-route-elevation | Charming but no revenue. Good for slow session |
| 1995-route-elevation | Same — DI wiring for 10 Win95 apps |
| fuse-tab-v2 | v2 was reverted. Current fuse tab works |
| museum-interior-design | Plaque rendering done. TVs/validator/whiteboards = museum focus required |
| collision-lab-future-work | Sphere collision functional. BVH = optimization for edge cases |
| multi-avatar-foundation | Infrastructure solid. Undo/persistence/raycasting = separate projects |
| unified-view-toggle-perf-harness | Q-cycle shipped. Perf harness = museum optimization tool |
| store-screenshot-capture | One-time tool for Play Store. May not be needed again |
| card-designer-split-screen | Forgotten. Assess when card designer is revisited |
| 1998-route-elevation | Forgotten. Low priority retro route |
| 2003-route-elevation | Forgotten. Low priority retro route |
| merge-card-view-into-decks | Forgotten. Assess when decks tab is revisited |
| timeline-sequence-integration | Forgotten. Needs timeline feature first |
| chimera-mandala-builder | Scoping memo. Needs canonical form first |

---

## ARCHIVED (20 specs in archived/)

Superseded by newer approaches, rejected by user, or correctly shelved:
- trail-point-assignments (superseded by unified tip system)
- hand-path-purpose-built-data (superseded by compositional model)
- hand-path-render-mode (superseded by ecosystem spec)
- unified-visibility-context-menus (superseded by gear popover pattern)
- trail-offscreen-canvas (superseded by GPU render pipeline)
- card-preview-tab (superseded by card designer v2)
- 3d-effects-design (superseded by effects unification)
- deck-browser-redesign (superseded by decks tab redesign)
- deck-sidebar-navigation (superseded by decks tab redesign)
- 3d-effect-parameter-parity (superseded by effects unification)
- effects-phase-1d-motion (superseded by Echo rename/pivot)
- guide-editor (superseded by level-1 guide redesign)
- export-drawer-collapsible-redesign (rejected by user — keep pill nav)
- grid-setup-wizard (archive candidate — no demand)
- yoga-sequence-builder (archive candidate — out of scope)
- visual-debug-raycast (archive candidate — dev tool, not needed)
- dive-in-transition (low priority transition effect)
- v-key-zoom-transition (low priority camera feature)
- pattern-blend-crossfades (low priority animation feature)
- planted-archaeology (low priority museum feature)
- negative-space-behind-body-prototype (notation research, not actionable)

---

## ORPHAN PLANS (no matching spec)

32 plans executed without a formal spec. Mostly shipped work. Listed for reference:
generate-panel-tour, unify-save-paths, archive-review-and-restoration, choreo-card-context-menu-redesign, path-shape-toggle, tika-inline-svg-rendering, video-trails-phase2-effects, video-trails-phase3-detection-studio, feedback-image-pre-upload, duration-aware-column-packing, fast-qr-scan-viewer, hand-path-choreo-cards, inspect-pipeline-trace-editor, realm-3d-consolidation, 1995-plan1-foundation, 1995-plan2-full-suite, 1995-plan3-polish-spectacle, visibility-tab-restoration, render-core-unification, mandala-progressive-reveal, museum-interior-design-phase1, physical-merch-store, 3d-video-export, 3d-effects-infrastructure-and-trails, dual-wheel-plane-mode, village-phase3-visual-identity, village-phase4-material-culture, village-phase5-effects-seasons, lazy-di-containers, record-scene-popover-refactor, session-handoff, unification-open-questions-answered

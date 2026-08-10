# God File Decomposition — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Decompose 28 god files into focused, single-responsibility modules via structural refactoring with zero behavior changes.

**Architecture:** Four independent phases. Phase 1 collapses ~1,400 lines of copy-paste effect dispatch boilerplate into registry-driven loops. Phases 2-4 extract logic from monolithic files into sibling `state/*.svelte.ts` modules (using `createFooState()` factories) and `services/*.ts` modules (kebab-case, pure functions or classes).

**Tech Stack:** Svelte 5 (runes), TypeScript, WebGL/WebGPU renderers. Verification: `npm run check` + `npm run build` after every task.

**Spec:** `docs/superpowers/specs/2026-05-04-god-file-decomposition-design.md`

---

## Phase 1: Dedup Refactors (3 files, zero new files, ~1,400 lines collapsed)

### Task 1: Collapse EffectRendererManager's 15 syncXOverlay methods into a generic registry

**Files:**
- Modify: `src/lib/shared/animation-engine/services/implementations/EffectRendererManager.ts`

The 15 `syncXOverlay()` methods (lines 133-615) are structurally identical: check enabled flag → create/init or dispose/null renderer → update render loop config → trigger render. Only fire and charcoal have minor variations (fire tip tracker reset, charcoal params init).

- [ ] **Step 1: Define the overlay effect registry type and registry array**

Add above the class definition:

```ts
interface OverlayEffectEntry {
  effect: EffectType;
  rendererKey: keyof EffectRendererManager;
  configKey: string;
  RendererClass: new () => { initialize(container: HTMLElement, w: number, h: number): boolean; dispose(): void; isInitialized(): boolean };
  onInit?: (mgr: EffectRendererManager) => void;
  onDisable?: (mgr: EffectRendererManager) => void;
}
```

Build the registry array with all 13 simple effects (zap through pulse) plus fire and charcoal with their custom hooks. Each entry maps effect name → renderer field → constructor → config key.

- [ ] **Step 2: Implement the generic `syncOverlay(entry)` method**

```ts
private syncOverlay(entry: OverlayEffectEntry): void {
  const enabled = this.hasEffectInEffectiveMap(entry.effect);
  const renderer = this[entry.rendererKey] as any;

  if (enabled) {
    if (!renderer?.isInitialized()) {
      if (!this.containerElement) return;
      const instance = new entry.RendererClass();
      const success = instance.initialize(this.containerElement, this.canvasSize, this.canvasSize);
      if (success) {
        (this as any)[entry.rendererKey] = instance;
        this.renderLoopService?.updateConfig({ [entry.configKey]: instance });
        entry.onInit?.(this);
      }
    }
  } else {
    if (renderer?.isInitialized()) {
      renderer.dispose();
      (this as any)[entry.rendererKey] = null;
    }
    this.renderLoopService?.updateConfig({ [entry.configKey]: null });
    entry.onDisable?.(this);
  }

  this.triggerRender();
}
```

- [ ] **Step 3: Replace all 15 syncXOverlay methods with registry iteration**

Replace `syncFireOverlay()`, `syncCharcoalOverlay()`, ..., `syncPulseOverlay()` with:

```ts
syncEffectOverlay(effect: EffectType): void {
  const entry = this.overlayRegistry.find(e => e.effect === effect);
  if (entry) this.syncOverlay(entry);
}

syncAllOverlays(): void {
  for (const entry of this.overlayRegistry) {
    this.syncOverlay(entry);
  }
}
```

Fire and charcoal special cases go into `onInit`/`onDisable` hooks in their registry entries:
- Fire `onDisable`: reset fireTipTracker if charcoal also off
- Charcoal `onInit`: set charcoal params from VM
- Charcoal `onDisable`: reset fireTipTracker if fire also off

- [ ] **Step 4: Update syncEffectFlagsFromEffectiveMap to use registry**

Replace the 14 `syncFlag(...)` calls (lines 750-763) with a loop:

```ts
private syncEffectFlagsFromEffectiveMap(): void {
  for (const entry of this.overlayRegistry) {
    const has = this.hasEffectInEffectiveMap(entry.effect);
    const prevKey = `prevHas${entry.effect.charAt(0).toUpperCase() + entry.effect.slice(1)}Tips` as keyof this;
    if (has !== this[prevKey]) {
      (this as any)[prevKey] = has;
      this.syncEffectOverlay(entry.effect);
    }
  }
  // LED handled separately (config-driven, not overlay-driven)
  const hasLed = this.hasEffectInEffectiveMap("led");
  if (hasLed !== this.ledConfig.enabled) {
    this.setLedConfig({ enabled: hasLed });
  }
}
```

- [ ] **Step 5: Update ensureEnabled and postInit to use registry**

Replace the 15 individual `syncXOverlay()` calls in `ensureEnabled()` (lines 875-923) with `this.syncAllOverlays()`.

- [ ] **Step 6: Collapse the 15 prevHasXTips fields into a Map**

Replace the 15 individual boolean fields (`prevHasFireTips`, `prevHasCharcoalTips`, etc.) with:

```ts
private prevEffectFlags = new Map<EffectType, boolean>();
```

Update all reads/writes to use `this.prevEffectFlags.get(effect) ?? false` and `this.prevEffectFlags.set(effect, value)`.

- [ ] **Step 7: Verify and commit**

Run: `npm run check && npm run build`
Expected: zero type errors, successful build.

```
git add src/lib/shared/animation-engine/services/implementations/EffectRendererManager.ts
git commit -m "refactor(animation): collapse 15 syncOverlay methods into registry-driven generic"
```

---

### Task 2: Collapse AnimationEngine's handleVisibilityChange effect sync blocks

**Files:**
- Modify: `src/lib/shared/animation-engine/services/implementations/AnimationEngine.svelte.ts`

The `handleVisibilityChange` method (lines 1186-1454) has 14 identical blocks checking `erm.hasEffectInEffectiveMap("X")` and calling `erm.syncXOverlay()`. After Task 1, EffectRendererManager exposes `syncEffectFlagsFromEffectiveMap()` which does this already.

- [ ] **Step 1: Replace the 14 effect sync blocks with a single call**

Replace lines 1249-1336 (the 14 `hasXTips` blocks) with:

```ts
erm.syncEffectFlagsFromEffectiveMap();
```

Note: `syncEffectFlagsFromEffectiveMap` is currently `private`. Change to `public` in EffectRendererManager if needed. The AnimationEngine also needs to trigger a render after sync — check if the method already does this via `syncOverlay` → `triggerRender`.

The fire-specific `triggerRender` after sync (line 1253-1257) is already handled by the generic `syncOverlay` method calling `triggerRender()`. Verify this and remove the duplicate.

- [ ] **Step 2: Keep the non-duplicated sections intact**

These sections of `handleVisibilityChange` are NOT duplicated and must remain:
- Dark mode sync (lines 1193-1208)
- Trails visibility sync (lines 1210-1228)
- Props visibility sync (lines 1230-1244)
- Fire slider sync (lines 1338-1370)
- Effort preset reset (lines 1372-1383)
- Path shape change (lines 1385-1435)
- Charcoal params sync (lines 1437-1444)
- LED config diff (lines 1446-1450)
- Effect layer ordering (lines 1452-1453)

- [ ] **Step 3: Verify and commit**

Run: `npm run check && npm run build`

```
git add src/lib/shared/animation-engine/services/implementations/AnimationEngine.svelte.ts
git add src/lib/shared/animation-engine/services/implementations/EffectRendererManager.ts
git commit -m "refactor(animation): replace 14 effect sync blocks with single syncEffectFlagsFromEffectiveMap call"
```

---

### Task 3: Collapse AnimationRenderLoop's effect dispatch boilerplate

**Files:**
- Modify: `src/lib/shared/animation-engine/services/implementations/AnimationRenderLoop.ts`

The render loop has 14 effect dispatch blocks (lines ~966-1932), each following: check config → filter tips → build input → call renderer → catch error → circuit breaker. The fire/charcoal block is special (shared tips, dual renderer), but zap through pulse are nearly identical.

- [ ] **Step 1: Define the effect dispatch registry**

```ts
interface EffectDispatchEntry {
  effect: EffectType;
  configKey: keyof RenderFrameParams;
  rendererKey: string;
  disabledKey: string;
  errorCountKey: string;
  buildInput: (tips: TipPosition[], params: RenderFrameParams, currentTime: number) => any;
  render: (renderer: any, config: any, input: any) => void;
  clear?: (renderer: any) => void;
}
```

- [ ] **Step 2: Implement generic `dispatchEffect` method**

```ts
private dispatchEffect(
  entry: EffectDispatchEntry,
  params: RenderFrameParams,
  sharedTipResult: TipResult | null,
  currentTime: number
): void {
  const config = params[entry.configKey];
  const renderer = (params as any)[entry.rendererKey];
  if (!config || !renderer || (this as any)[entry.disabledKey] || params.suppress2DOverlays || !sharedTipResult) return;

  try {
    const tipMap = params.tipEffectMap ?? {};
    const effectTips = sharedTipResult.tips.filter(
      t => resolveEffect(t.propIndex, t.tipIndex, tipMap, {}) === entry.effect
    );
    if (effectTips.length === 0) return;

    const input = entry.buildInput(effectTips, params, currentTime);
    entry.render(renderer, config, input);
    (this as any)[entry.errorCountKey] = 0;
  } catch (error) {
    (this as any)[entry.errorCountKey]++;
    entry.clear?.(renderer);

    if ((this as any)[entry.errorCountKey] >= AnimationRenderLoop.EFFECT_ERROR_THRESHOLD) {
      (this as any)[entry.disabledKey] = true;
      const err = error instanceof Error ? error : new Error(String(error));
      console.error(`[AnimationRenderLoop] ${entry.effect} effect disabled after repeated failures:`, err);
      if (this.onEffectError) {
        this.onEffectError(entry.effect, err);
      } else {
        effectErrorSignal.trigger(entry.effect, err);
      }
    }
  }
}
```

- [ ] **Step 3: Build the registry for zap, sparkles, echo, bloom, water, bubbles, petals, smoke, ink, frost, silk, pulse**

Each entry specifies its config key, renderer key, how to build its input from filtered tips, and how to call its render method. Fire/charcoal stay as a special combined block because they share tips and have dual renderers.

- [ ] **Step 4: Replace the 12 individual dispatch blocks with a loop**

```ts
for (const entry of this.effectDispatchRegistry) {
  this.dispatchEffect(entry, params, sharedTipResult, currentTime);
}
```

Keep fire/charcoal as the one special case (lines 966-1033) since they share tip filtering and have dual renderers with shared error state.

- [ ] **Step 5: Collapse the 12 `XDisabledByError` + `consecutiveXErrors` fields into Maps**

```ts
private effectDisabledByError = new Map<EffectType, boolean>();
private consecutiveEffectErrors = new Map<EffectType, number>();
```

- [ ] **Step 6: Verify and commit**

Run: `npm run check && npm run build`

```
git add src/lib/shared/animation-engine/services/implementations/AnimationRenderLoop.ts
git commit -m "refactor(animation): collapse 12 effect dispatch blocks into registry-driven loop"
```

---

## Phase 2: Big Five State Extractions (5 Svelte god files)

Each task follows the same pattern:
1. Read the source file to identify exact line ranges
2. Create new module(s) with extracted symbols
3. Update source file to import and use extracted modules
4. Run `npm run check && npm run build`
5. Commit

### Task 4: Split ChoreoCard.svelte

**Files:**
- Modify: `src/lib/shared/sequence-viewer/components/ChoreoCard.svelte`
- Create: `src/lib/features/choreo-card/state/choreo-card-layout-state.svelte.ts`
- Create: `src/lib/features/choreo-card/services/choreo-card-cell-pipeline.ts`
- Create: `src/lib/features/choreo-card/services/choreo-card-context-menu.ts`
- Create: `src/lib/features/choreo-card/state/dark-mode-crossfader-state.svelte.ts`

**Extraction table:**

| Target file | Symbols to extract | Pattern |
|---|---|---|
| `choreo-card-layout-state.svelte.ts` | All `$derived` chains for column/row/aspect-ratio/header-footer sizing. Export `createChoreoCardLayoutState(sequence, options)` returning reactive object. | `createFooState()` factory |
| `choreo-card-cell-pipeline.ts` | `renderAllCells`, `relayoutCells`, `detectMixedDurations`, `calculateGridPosition`, `buildRenderOptions`, global preview cache (LRU). Export as pure functions. | Plain TS module |
| `choreo-card-context-menu.ts` | Context menu item construction logic. Export `buildChoreoCardContextMenu(sequence, handlers)`. | Plain TS module |
| `dark-mode-crossfader-state.svelte.ts` | `crossfadeActive`, crossfade timer, `activeDarkMode`, key diffing `$effect`. Export `createDarkModeCrossfaderState(darkMode)`. | `createFooState()` factory |

- [ ] **Step 1:** Read ChoreoCard.svelte fully. Identify exact line ranges for each extraction group.
- [ ] **Step 2:** Create `choreo-card-cell-pipeline.ts` with the pure functions. These have no `$state`/`$derived` — they're pure rendering logic.
- [ ] **Step 3:** Create `choreo-card-layout-state.svelte.ts` with the reactive derivations. Use `$derived` inside the factory function.
- [ ] **Step 4:** Create `dark-mode-crossfader-state.svelte.ts` with the crossfade state machine.
- [ ] **Step 5:** Create `choreo-card-context-menu.ts` with the menu builder.
- [ ] **Step 6:** Update ChoreoCard.svelte to import from the new modules. Replace inline logic with function calls / state object property access.
- [ ] **Step 7:** Run `npm run check && npm run build`. Fix any type errors.
- [ ] **Step 8:** Commit.

```
git add src/lib/features/choreo-card/state/ src/lib/features/choreo-card/services/ src/lib/shared/sequence-viewer/components/ChoreoCard.svelte
git commit -m "refactor(choreo-card): extract layout state, cell pipeline, context menu, and crossfader from ChoreoCard"
```

---

### Task 5: Split Museum3DScene.svelte

**Files:**
- Modify: `src/lib/features/museum/components/game/Museum3DScene.svelte`
- Create: `src/lib/features/museum/services/implementations/museum-camera-flip-controller.ts`
- Create: `src/lib/features/museum/services/implementations/museum-geometry-streamer.ts`
- Create: `src/lib/features/museum/services/implementations/museum-proximity-renderer.ts`
- Create: `src/lib/features/museum/services/implementations/museum-player-controller.ts`

**Extraction table:**

| Target file | Symbols to extract |
|---|---|
| `museum-camera-flip-controller.ts` (~180 lines) | TOP_DOWN/FPS state objects, flip animation progress, easeInOutCubic, syncFpsFromPlayer, syncFpsFromCamera. Export class with `update(delta)` and `getCameraTarget()`. |
| `museum-geometry-streamer.ts` (~300 lines) | Worker message handling, requestRoomBuild, activateRoom, serializeBucketsForWorker, distance computation, initial load orchestration. |
| `museum-proximity-renderer.ts` (~150 lines) | 7 proximity grid queries, recomputeVisibility, pending mount queue, mount/unmount radius logic. |
| `museum-player-controller.ts` (~200 lines) | Top-down WASD movement, FPS position sync, portal teleport, void recovery, spawn reset, facing direction computation. |

- [ ] **Step 1:** Read Museum3DScene.svelte fully. Map line ranges.
- [ ] **Step 2:** Extract each module. None use Svelte runes — all are plain TS classes/functions.
- [ ] **Step 3:** Update Museum3DScene.svelte to instantiate and delegate to extracted modules.
- [ ] **Step 4:** Run `npm run check && npm run build`. Fix type errors.
- [ ] **Step 5:** Commit.

```
git commit -m "refactor(museum): extract camera flip, geometry streamer, proximity renderer, player controller from Museum3DScene"
```

---

### Task 6: Split SequenceViewerOrchestrator.svelte

**Files:**
- Modify: `src/lib/shared/sequence-viewer/components/SequenceViewerOrchestrator.svelte`
- Create: `src/lib/shared/sequence-viewer/state/library-action-handler.svelte.ts`
- Create: `src/lib/shared/sequence-viewer/state/fullscreen-controller.svelte.ts`
- Create: `src/lib/shared/sequence-viewer/services/editing-pane-persistence.ts`

**Extraction table:**

| Target file | Symbols to extract |
|---|---|
| `library-action-handler.svelte.ts` (~120 lines) | handleSave, handleDelete, handlePublishAction, handleUnpublishAction, handleFavoriteToggle, isSaved/isFavorite `$state`, savedHashCache. Export `createLibraryActionHandler(deps)`. |
| `fullscreen-controller.svelte.ts` (~50 lines) | enterFullscreen, exitFullscreen, handleFullscreenTap, controlsHideTimeout, fullscreenControlsVisible `$state`. Export `createFullscreenController()`. |
| `editing-pane-persistence.ts` (~50 lines) | loadRecentEditingPane, persistEditingPane, sessionStorage TTL logic. Export as pure functions. |

- [ ] **Step 1-5:** Same pattern as Tasks 4-5. Read → extract → update imports → check → commit.

```
git commit -m "refactor(viewer): extract library actions, fullscreen controller, editing pane persistence from orchestrator"
```

---

### Task 7: Split CompositionLab.svelte

**Files:**
- Modify: `src/lib/features/constraint-layout-lab/CompositionLab.svelte`
- Create: `src/lib/features/constraint-layout-lab/state/composition-lab-state.svelte.ts`

**Extract:** All 15 `$state` variables, cell mutation handlers (add, delete, duplicate, update position/size/label/color/zIndex/mediaType), selectedCellIds, undo/redo stack + pushUndo/undo/redo, multi-select logic, keyboard shortcut handler.

Export: `createCompositionLabState(constraintSolver, persistence)` factory.

- [ ] **Step 1-5:** Read → extract → update → check → commit.

```
git commit -m "refactor(composition-lab): extract cell state and mutation handlers into composition-lab-state"
```

---

### Task 8: Split SaveToLibraryPanel.svelte

**Files:**
- Modify: `src/lib/features/create/shared/components/SaveToLibraryPanel.svelte`
- Create: `src/lib/features/create/shared/state/save-panel-state.svelte.ts`

**Extract:** All 15 `$state`, 23 `$derived`, 9 `$effect` blocks into a single reactive state object. Export `createSavePanelState(deps)`.

- [ ] **Step 1-5:** Read → extract → update → check → commit.

```
git commit -m "refactor(create): extract save panel reactive state into save-panel-state"
```

---

## Phase 3: Service Extractions (8 TS files)

### Task 9: Split LibraryRepository.ts

**Files:**
- Modify: `src/lib/features/library/services/implementations/LibraryRepository.ts`
- Create: `src/lib/features/library/services/implementations/library-recycle-bin.ts`
- Create: `src/lib/features/library/services/implementations/library-batch-operations.ts`

| Target | Extract |
|---|---|
| `library-recycle-bin.ts` (~200 lines) | `softDeleteSequence`, `restoreSequence`, `purgeSequence`, `emptyRecycleBin`, `getDeletedSequences` |
| `library-batch-operations.ts` (~250 lines) | `deleteSequences`, `addTagsToSequences`, `setVisibilityBatch`, `moveToCollection` |

Both modules receive Firestore instance and user ID as constructor/function params. LibraryRepository delegates to them.

- [ ] **Step 1-5:** Read → extract → delegate → check → commit.

```
git commit -m "refactor(library): extract recycle bin and batch operations from LibraryRepository"
```

---

### Task 10: Split ConversationManager.ts

**Files:**
- Modify: `src/lib/shared/messaging/services/implementations/ConversationManager.ts`
- Create: `src/lib/shared/messaging/services/implementations/group-conversation-manager.ts`
- Create: `src/lib/shared/messaging/services/implementations/conversation-mappers.ts`

| Target | Extract |
|---|---|
| `group-conversation-manager.ts` (~465 lines) | `createGroup`, `getOrCreateGroupConversation`, `addGroupMember`, `removeGroupMember`, `leaveGroup`, `updateGroupMetadata`, `setAdminStatus` |
| `conversation-mappers.ts` (~170 lines) | `mapDocToConversation`, `mapDocToPreview`, `refreshParticipantInfo` — pure functions, no class state |

- [ ] **Step 1-5:** Read → extract → delegate → check → commit.

```
git commit -m "refactor(messaging): extract group conversation manager and mappers from ConversationManager"
```

---

### Task 11: Split Canvas2DDirectRenderer.ts and ImageComposer.ts

**Files:**
- Modify: `src/lib/shared/render/services/implementations/Canvas2DDirectRenderer.ts`
- Create: `src/lib/shared/render/services/implementations/canvas-2d-glyph-renderer.ts`
- Create: `src/lib/shared/render/services/implementations/canvas-2d-transform-helper.ts`
- Modify: `src/lib/shared/render/services/implementations/ImageComposer.ts`
- Modify: `src/lib/shared/render/services/implementations/ImageFormatConverter.ts` (merge into existing)
- Create: `src/lib/shared/render/services/implementations/cell-border-renderer.ts`
- Create: `src/lib/shared/render/services/implementations/card-composer.ts`

**Canvas2DDirectRenderer extractions:**

| Target | Extract |
|---|---|
| `canvas-2d-glyph-renderer.ts` (~530 lines) | `drawTKAGlyphText`, `drawTurnText`, `drawDirectionDot`, `drawColoredImage`, VTG/elemental/position/reversal glyph methods |
| `canvas-2d-transform-helper.ts` (~180 lines) | `wrapSvgContent`, `shouldMirrorProp`, `drawElementWithTransform`, `drawDash` |

**ImageComposer extractions:**

| Target | Extract |
|---|---|
| Merge into `ImageFormatConverter.ts` (~80 lines) | `svgStringToImage`, `canvasToImage`, `svgToImage`, `blobToImage`, `imageToBlob` |
| `cell-border-renderer.ts` (~135 lines) | `drawSmartCellBorders`, `getOccupiedCells`, `findEmptyCellForQR` |
| `card-composer.ts` (~103 lines) | `composeCardImage` and header/footer height calculations |

- [ ] **Step 1-7:** Read both files → extract all modules → update imports → check → commit.

```
git commit -m "refactor(render): extract glyph renderer, transform helper, cell borders, card composer from Canvas2D/ImageComposer"
```

---

### Task 12: Split remaining Phase 3 files (5 files)

**VideoExportOrchestrator.ts:**
- Modify: `src/lib/features/compose/services/implementations/VideoExportOrchestrator.ts`
- Create: `src/lib/features/compose/services/implementations/export-frame-compositor.ts`
- Extract: Per-frame overlay rendering (glyph crossfade, step numbers, word header, progress bar) → `ExportFrameCompositor` class (~200 lines)

**PostHogFeatureFlagService.svelte.ts:**
- Modify: `src/lib/shared/auth/services/PostHogFeatureFlagService.svelte.ts`
- Create: `src/lib/shared/auth/services/posthog-flag-admin-service.ts`
- Create: `src/lib/shared/auth/domain/default-feature-flags.ts`
- Extract: Server-side flag CRUD (~120 lines) + default flag config generation (~100 lines). Delete deprecated stubs.

**authState.svelte.ts:**
- Modify: `src/lib/shared/auth/state/authState.svelte.ts`
- Create: `src/lib/shared/auth/services/profile-field-updater.ts`
- Create: `src/lib/shared/auth/services/auth-boot-orchestrator.ts`
- Extract: Profile update methods (~170 lines) + child service init cascade (~130 lines)

**collision-lab-state.svelte.ts:**
- Modify: `src/lib/features/lab/tabs/collision-lab/state/collision-lab-state.svelte.ts`
- Create: `src/lib/features/lab/tabs/collision-lab/services/pose-target-mapper.ts`
- Create: `src/lib/features/lab/tabs/collision-lab/services/collision-lab-diagnostic.ts`
- Extract: `handToPropTarget`, `poseToOptimizerInput`, OPTIMIZER_BOUNDS, POSITION_TO_GRID (~80 lines) + `buildDiagnosticReport` (~90 lines)

- [ ] **Step 1:** Extract from VideoExportOrchestrator → commit.
- [ ] **Step 2:** Extract from PostHogFeatureFlagService → commit.
- [ ] **Step 3:** Extract from authState → commit.
- [ ] **Step 4:** Extract from collision-lab-state → commit.
- [ ] **Step 5:** Final `npm run check && npm run build` across all changes.

---

## Phase 4: Remaining Splits (12 files)

### Task 13: Rendering infra splits (4 files)

**WebGPUBackend.ts:**
- Modify: `src/lib/shared/render-graph/services/implementations/WebGPUBackend.ts`
- Create: `src/lib/shared/render-graph/services/implementations/webgpu-trail-executor.ts`
- Create: `src/lib/shared/render-graph/services/implementations/webgpu-backend-shaders.ts`
- Extract: Trail pass execution (5 sub-passes, ~200 lines) + WGSL shader strings (~140 lines)

**terrain-compute-generator.ts:**
- Modify: `src/lib/shared/3d/procedural-engine/generation/gpu/terrain-compute-generator.ts`
- Create: `src/lib/shared/3d/procedural-engine/generation/terrain-cpu-generator.ts`
- Create: `src/lib/shared/3d/procedural-engine/generation/terrain-mesh-builder.ts`
- Extract: CPU fallback path (~350 lines) + skirt/index geometry (~150 lines)

**chunk-generator.worker.ts:**
- Modify: `src/lib/shared/3d/procedural-engine/workers/chunk-generator.worker.ts`
- Create: `src/lib/shared/3d/procedural-engine/workers/chunk-worker-messages.ts`
- Create: `src/lib/shared/3d/procedural-engine/generation/skirt-geometry.ts`
- Modify: `src/lib/shared/3d/procedural-engine/generation/biome-system.ts` (merge color helpers)
- Extract: Message interfaces (~120 lines) + biome color helpers (~50 lines) + skirt generation (~100 lines)

**chunk-manager.ts:**
- Modify: `src/lib/shared/3d/procedural-engine/core/chunk-manager.ts`
- Create: `src/lib/shared/3d/procedural-engine/core/chunk-zone-manager.ts`
- Create: `src/lib/shared/3d/procedural-engine/core/chunk-types.ts`
- Extract: Zone management (real terrain, stage, spawn clearing ~390 lines) + type definitions (~110 lines)

- [ ] **Step 1-4:** One commit per file. Read → extract → delegate → check → commit.

---

### Task 14: Component splits (3 files)

**ViewerFooter.svelte:**
- Modify: `src/lib/shared/sequence-viewer/components/ViewerFooter.svelte`
- Create: `src/lib/shared/sequence-viewer/components/LandscapeFooterControls.svelte`
- Create: `src/lib/shared/sequence-viewer/components/MidFooterControls.svelte`
- Create: `src/lib/shared/sequence-viewer/components/DesktopFooterControls.svelte`
- Extract: Three layout variants into child components. ViewerFooter becomes ResizeObserver + conditional `{#if}` delegation (~200 lines).

**FeedbackKanbanBoard.svelte:**
- Modify: `src/lib/features/feedback/components/manage/FeedbackKanbanBoard.svelte`
- Create: `src/lib/features/feedback/components/manage/DeferFeedbackDialog.svelte`
- Create: `src/lib/features/feedback/components/manage/TrashFeedbackDialog.svelte`
- Extract: Defer dialog (~120 lines) + trash dialog (~100 lines) into standalone components.

**WorldSceneContent.svelte:**
- Modify: `src/lib/shared/3d/procedural-engine/components/WorldSceneContent.svelte`
- Create: `src/lib/shared/3d/procedural-engine/services/terrain-material-factory.ts`
- Create: `src/lib/shared/3d/procedural-engine/services/world-game-loop.ts`
- Extract: Texture loading + material creation (~215 lines) + per-frame tick function (~190 lines)

- [ ] **Step 1-3:** One commit per file group.

---

### Task 15: State extractions (5 files)

**DeepOceanLab.svelte:**
- Create: `src/lib/features/background-builder/state/deep-ocean-lab-state.svelte.ts` (~200 lines)
- Create: `src/lib/features/background-builder/services/fish-behavior-controls.ts` (~150 lines)

**PhraseEffortLabModule.svelte:**
- Create: `src/lib/features/phrase-effort-lab/state/phrase-effort-lab-state.svelte.ts` (~200 lines)
- Create: `src/lib/features/phrase-effort-lab/services/phrase-effort-lab-persister.ts` (~60 lines)

**SequenceActionsPanel.svelte:**
- Completed 2026-08-09: rewrote and activated `src/lib/features/create/shared/services/sequence-actions-orchestrator.ts`
- Completed 2026-08-09: replaced the unused subdrawer model with `src/lib/features/create/shared/state/sequence-actions-panel-state.svelte.ts`
- Shipped design: `docs/superpowers/specs/shipped/2026-08-09-sequence-actions-panel-decomposition-design.md`

**DeckBrowser.svelte:**
- Create: `src/lib/features/choreo-card/domain/deck-vtg-labels.ts` (~50 lines)
- Create: `src/lib/features/choreo-card/state/deck-interior-state.svelte.ts` (~100 lines)

**animation-visibility-state.svelte.ts:**
- Create: `src/lib/shared/animation-engine/services/animation-visibility-migrations.ts` (~100 lines)
- Create: `src/lib/shared/animation-engine/services/led-settings-section.ts` (~140 lines)

- [ ] **Step 1-5:** One commit per file. Read → extract → update → check → commit.

---

### Task 16: Dead code cleanup

**Files:**
- Modify: `src/lib/features/museum/services/implementations/MuseumGeometryBuilder.ts`
- Modify: `src/lib/shared/auth/services/PostHogFeatureFlagService.svelte.ts` (if not done in Task 12)

- [ ] **Step 1:** Delete ~160 lines of commented-out legacy `buildMuseumGeometry` function from MuseumGeometryBuilder.ts.
- [ ] **Step 2:** Delete deprecated stubs from PostHogFeatureFlagService if not already done.
- [ ] **Step 3:** Run `npm run check && npm run build`.
- [ ] **Step 4:** Commit.

```
git commit -m "chore: delete dead code from MuseumGeometryBuilder and PostHogFeatureFlagService"
```

---

## Verification Checklist (run after each phase)

- [ ] `npm run check` — zero TypeScript errors
- [ ] `npm run build` — successful production build
- [ ] No new circular dependency warnings in build output
- [ ] `git diff --stat` — verify no unintended file changes
- [ ] Spot-check: open the app, verify animation playback works (Phase 1), choreo cards render (Phase 2), library save/load works (Phase 3)

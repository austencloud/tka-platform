# Lazy DI Container Loading — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reduce app startup time by deferring ~20 module-specific DI containers so they load only when their feature module mounts, instead of eagerly on every page refresh.

**Architecture:** Split the monolithic `di/index.ts` into an eager core container (services needed on every page) and lazy container factories (loaded on-demand per module). The eager container keeps full type safety. Lazy containers are accessed through a `getLazyItems()` helper that returns a typed promise. Module components call `getLazyItems('museum')` instead of `container.items.museumPersister`.

**Tech Stack:** ITI (Isomorphic Type-safe IoC), Vite dynamic imports, TypeScript intersection types

**Baseline measurement:** Boot profiler instrumentation already in place (`boot-profiler.ts`). Current `di-container` phase: **64.5s in dev** (Vite module loading), individual container factories: ~11ms. The win is reducing the Vite module graph — fewer imports = fewer HTTP requests on refresh.

---

## Container Classification

Based on usage analysis of shared code paths (MainApplication, MainInterface, +layout.svelte, app-state):

### Eager (17 containers) — used on every page load
compositionContainer, coreContainer, dataContainer, keyboardContainer, platformContainer,
navigationContainer, renderContainer, analyticsContainer, presenceContainer, communityContainer,
writeContainer, mandalaContainer, sequenceMandalaContainer, shareContainer, browseContainer,
buildContainer, backgroundBuilderContainer

### Early (6 containers) — used shortly after init by shared components
animatorContainer, gamificationContainer, loopLabelerContainer, feedbackContainer,
promoContainer, trainContainer

### Lazy (19 containers) — only used within their feature module
poiLabContainer, collisionLabContainer, museumContainer, festivalContainer,
storeContainer, hallOfShameContainer, arenaContainer, skel2tkaContainer,
composeBrowseContainer, composeArrangeContainer, effectsLabContainer,
videoTrailsContainer, videoInfraContainer, trigridLabContainer, multiGridContainer,
labContainer, assembleContainer, fuseContainer, poiContainer

### Conditionally Lazy (8 containers) — can defer until feature use
lanSyncContainer, deviceSyncContainer, connectContainer, offlineContainer,
voiceControlContainer, voiceSessionContainer, attributionContainer, pushContainer,
landingPreviewContainer, qrContainer, animation3DContainer, delightContainer,
learnContainer, libraryContainer, moderationContainer, adminContainer, watchContainer

**This plan covers the 19 purely lazy containers first.** The conditional group can be addressed in a follow-up once we see the impact.

---

## File Structure

| File | Action | Responsibility |
|------|--------|---------------|
| `src/lib/shared/di/index.ts` | Modify | Remove lazy container imports, instantiation, and `.add()` calls |
| `src/lib/shared/di/lazy-containers.ts` | Create | Async factory functions for each lazy container group |
| `src/lib/shared/di/container-types.ts` | Modify | Split into `IEagerContainerItems` and `ILazyContainerItems` |
| `src/lib/shared/di/eager-items.ts` | Create | Re-export `IEagerContainerItems` for consumers that only need core |
| Feature module files (19 modules) | Modify | Replace `container.items.X` with lazy container access |

---

### Task 1: Create the lazy container registry

**Files:**
- Create: `src/lib/shared/di/lazy-containers.ts`

This file defines async factory functions that dynamically import and instantiate each lazy container. The factories are cached so each container is only created once.

- [ ] **Step 1: Create `lazy-containers.ts` with the registry**

```typescript
// src/lib/shared/di/lazy-containers.ts

/**
 * Lazy Container Registry
 *
 * Each lazy container is loaded on-demand via dynamic import.
 * Results are cached — subsequent calls return the same instance.
 */

// Cache for instantiated lazy containers
const _cache = new Map<string, unknown>();

async function _loadOnce<T>(key: string, factory: () => Promise<T>): Promise<T> {
  const cached = _cache.get(key);
  if (cached) return cached as T;
  const instance = await factory();
  _cache.set(key, instance);
  return instance;
}

// ============================================================================
// LAZY CONTAINER FACTORIES
// Each function dynamically imports the container module and instantiates it.
// The container file (and all its transitive deps) only loads on first call.
// ============================================================================

export function getPoiLabItems() {
  return _loadOnce("poi-lab", async () => {
    const { createPoiLabContainer } = await import("./containers/poi-lab-container");
    return createPoiLabContainer().items;
  });
}

export function getCollisionLabItems() {
  return _loadOnce("collision-lab", async () => {
    const { createCollisionLabContainer } = await import("./containers/collision-lab-container");
    return createCollisionLabContainer().items;
  });
}

export function getMuseumItems() {
  return _loadOnce("museum", async () => {
    const { createMuseumContainer } = await import("./containers/museum-container");
    return createMuseumContainer().items;
  });
}

export function getFestivalItems() {
  return _loadOnce("festival", async () => {
    const { festivalContainer } = await import("./containers/festival-container");
    return festivalContainer.items;
  });
}

export function getStoreItems() {
  return _loadOnce("store", async () => {
    const { createStoreContainer } = await import("./containers/store-container");
    return createStoreContainer().items;
  });
}

export function getHallOfShameItems() {
  return _loadOnce("hall-of-shame", async () => {
    const { createHallOfShameContainer } = await import("./containers/hall-of-shame-container");
    return createHallOfShameContainer().items;
  });
}

export function getArenaItems() {
  return _loadOnce("arena", async () => {
    const { arenaContainer } = await import("./containers/arena-container");
    return arenaContainer.items;
  });
}

export function getSkel2TKAItems() {
  return _loadOnce("skel2tka", async () => {
    const { createSkel2TKAContainer } = await import("./containers/skel2tka-container");
    return createSkel2TKAContainer().items;
  });
}

export function getComposeBrowseItems() {
  return _loadOnce("compose-browse", async () => {
    const { createComposeBrowseContainer } = await import("./containers/compose-browse-container");
    return createComposeBrowseContainer().items;
  });
}

export function getComposeArrangeItems() {
  return _loadOnce("compose-arrange", async () => {
    const { createComposeArrangeContainer } = await import("./containers/compose-arrange-container");
    return createComposeArrangeContainer().items;
  });
}

export function getEffectsLabItems() {
  return _loadOnce("effects-lab", async () => {
    const { effectsLabContainer } = await import("./containers/effects-lab-container");
    return effectsLabContainer.items;
  });
}

export function getVideoTrailsItems() {
  return _loadOnce("video-trails", async () => {
    const { videoTrailsContainer } = await import("./containers/video-trails-container");
    return videoTrailsContainer.items;
  });
}

export function getVideoInfraItems() {
  return _loadOnce("video-infra", async () => {
    const { videoInfraContainer } = await import("./containers/video-infra-container");
    return videoInfraContainer.items;
  });
}

export function getTrigridLabItems() {
  return _loadOnce("trigrid-lab", async () => {
    const { trigridLabContainer } = await import("./containers/trigrid-lab-container");
    return trigridLabContainer.items;
  });
}

export function getMultiGridItems() {
  return _loadOnce("multi-grid", async () => {
    const { multiGridContainer } = await import("./containers/multi-grid-container");
    return multiGridContainer.items;
  });
}

export function getLabItems() {
  return _loadOnce("lab", async () => {
    const { labContainer } = await import("./containers/lab-container");
    return labContainer.items;
  });
}

export function getAssembleItems() {
  return _loadOnce("assemble", async () => {
    const { assembleContainer } = await import("./containers/assemble-container");
    return assembleContainer.items;
  });
}

export function getFuseItems() {
  return _loadOnce("fuse", async () => {
    const { fuseContainer } = await import("./containers/fuse-container");
    return fuseContainer.items;
  });
}

export function getPoiItems() {
  return _loadOnce("poi", async () => {
    const { createPoiContainer } = await import("./containers/poi-container");
    return createPoiContainer().items;
  });
}

export function getLandingPreviewItems() {
  return _loadOnce("landing-preview", async () => {
    const { createLandingPreviewContainer } = await import("./containers/landing-preview-container");
    return createLandingPreviewContainer().items;
  });
}
```

- [ ] **Step 2: Verify the file compiles**

Run: `npx tsc --noEmit --pretty false 2>&1 | grep lazy-containers`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/lib/shared/di/lazy-containers.ts
git commit -m "feat: add lazy container registry for on-demand DI loading"
```

---

### Task 2: Remove lazy containers from `di/index.ts`

**Files:**
- Modify: `src/lib/shared/di/index.ts`

Remove imports, instantiation, and `buildAppContainer()` `.add()` calls for all 19 lazy containers. Keep the `_timeContainer` instrumentation for the remaining eager ones.

- [ ] **Step 1: Remove lazy container imports from the top of `index.ts`**

Remove these import lines (keep all other imports):

```typescript
// REMOVE these imports:
import { createPoiLabContainer } from "./containers/poi-lab-container";
import { createCollisionLabContainer } from "./containers/collision-lab-container";
import { createPoiContainer } from "./containers/poi-container";
import { createLandingPreviewContainer } from "./containers/landing-preview-container";
import { createHallOfShameContainer } from "./containers/hall-of-shame-container";
import { createComposeBrowseContainer } from "./containers/compose-browse-container";
import { createComposeArrangeContainer } from "./containers/compose-arrange-container";
import { createMuseumContainer } from "./containers/museum-container";
import { createStoreContainer } from "./containers/store-container";
import { createSkel2TKAContainer } from "./containers/skel2tka-container";
import { trigridLabContainer } from "./containers/trigrid-lab-container";
import { multiGridContainer } from "./containers/multi-grid-container";
import { labContainer } from "./containers/lab-container";
import { assembleContainer } from "./containers/assemble-container";
import { fuseContainer } from "./containers/fuse-container";
import { arenaContainer } from "./containers/arena-container";
import { effectsLabContainer } from "./containers/effects-lab-container";
import { videoTrailsContainer } from "./containers/video-trails-container";
import { videoInfraContainer } from "./containers/video-infra-container";
import { festivalContainer } from "./containers/festival-container";
```

- [ ] **Step 2: Remove lazy container instantiation blocks**

Remove these blocks from the factory section (lines ~300-367):

```typescript
// REMOVE all of these:
const poiLabContainer = ...
const collisionLabContainer = ...
const poiContainer = ...
const landingPreviewContainer = ...
const hallOfShameContainer = ...
const composeBrowseContainer = ...
const composeArrangeContainer = ...
const museumContainer = ...
const skel2tkaContainer = ...
const storeContainer = ...
```

Note: `trigridLabContainer`, `multiGridContainer`, `labContainer`, `assembleContainer`, `fuseContainer`, `arenaContainer`, `effectsLabContainer`, `videoTrailsContainer`, `videoInfraContainer`, and `festivalContainer` are simple containers (not factory). Just remove their import lines — they have no instantiation block.

- [ ] **Step 3: Remove `.add()` calls from `buildAppContainer()`**

Remove these lines from the `buildAppContainer()` function:

```typescript
// REMOVE these .add() calls:
c = c.add(poiLabContainer.items);
c = c.add(collisionLabContainer.items);
c = c.add(poiContainer.items);
c = c.add(landingPreviewContainer.items);
c = c.add(hallOfShameContainer.items);
c = c.add(composeBrowseContainer.items);
c = c.add(composeArrangeContainer.items);
c = c.add(skel2tkaContainer.items);
c = c.add(labContainer.items);
c = c.add(assembleContainer.items);
c = c.add(fuseContainer.items);
c = c.add(arenaContainer.items);
c = c.add(effectsLabContainer.items);
c = c.add(videoTrailsContainer.items);
c = c.add(videoInfraContainer.items);
c = c.add(museumContainer.items);
c = c.add(festivalContainer.items);
c = c.add(storeContainer.items);
c = c.add(trigridLabContainer.items);
c = c.add(multiGridContainer.items);
```

- [ ] **Step 4: Commit**

```bash
git add src/lib/shared/di/index.ts
git commit -m "refactor: remove 19 lazy containers from eager DI initialization"
```

---

### Task 3: Update `container-types.ts` to separate eager from lazy types

**Files:**
- Modify: `src/lib/shared/di/container-types.ts`

Remove the lazy container types from the `IAppContainerItems` intersection. The eager container keeps its full type. Lazy containers get their types from the lazy-containers.ts factory return types.

- [ ] **Step 1: Remove lazy container type imports**

Remove these import lines from `container-types.ts`:

```typescript
// REMOVE these imports:
import type { TrigridLabContainer } from "./containers/trigrid-lab-container";
import type { MultiGridContainer } from "./containers/multi-grid-container";
import type { EffectsLabContainer } from "./containers/effects-lab-container";
import type { ArenaContainer } from "./containers/arena-container";
import type { AssembleContainer } from "./containers/assemble-container";
import type { FuseContainer } from "./containers/fuse-container";
import type { LabContainer } from "./containers/lab-container";
import type { VideoTrailsContainer } from "./containers/video-trails-container";
import type { VideoInfraContainer } from "./containers/video-infra-container";
import type { Skel2TKAContainer } from "./containers/skel2tka-container";
import type { PoiLabContainer } from "./containers/poi-lab-container";
import type { CollisionLabContainer } from "./containers/collision-lab-container";
import type { PoiContainer } from "./containers/poi-container";
import type { LandingPreviewContainer } from "./containers/landing-preview-container";
import type { HallOfShameContainer } from "./containers/hall-of-shame-container";
import type { ComposeBrowseContainer } from "./containers/compose-browse-container";
import type { ComposeArrangeContainer } from "./containers/compose-arrange-container";
import type { MuseumContainer } from "./containers/museum-container";
import type { FestivalContainer } from "./containers/festival-container";
import type { StoreContainer } from "./containers/store-container";
```

- [ ] **Step 2: Remove lazy type aliases**

Remove these type definitions:

```typescript
// REMOVE these type aliases:
type TrigridLabItems = ItemsOf<TrigridLabContainer>;
type MultiGridItems = ItemsOf<MultiGridContainer>;
type EffectsLabItems = ItemsOf<EffectsLabContainer>;
type ArenaItems = ItemsOf<ArenaContainer>;
type AssembleItems = ItemsOf<AssembleContainer>;
type FuseItems = ItemsOf<FuseContainer>;
type LabItems = ItemsOf<LabContainer>;
type VideoTrailsItems = ItemsOf<VideoTrailsContainer>;
type VideoInfraItems = ItemsOf<VideoInfraContainer>;
type Skel2TKAItems = ItemsOf<Skel2TKAContainer>;
type PoiLabItems = ItemsOf<PoiLabContainer>;
type CollisionLabItems = ItemsOf<CollisionLabContainer>;
type PoiItems = ItemsOf<PoiContainer>;
type LandingPreviewItems = ItemsOf<LandingPreviewContainer>;
type HallOfShameItems = ItemsOf<HallOfShameContainer>;
type ComposeBrowseItems = ItemsOf<ComposeBrowseContainer>;
type ComposeArrangeItems = ItemsOf<ComposeArrangeContainer>;
type MuseumItems = ItemsOf<MuseumContainer>;
type FestivalItems = ItemsOf<FestivalContainer>;
type StoreItems = ItemsOf<StoreContainer>;
```

- [ ] **Step 3: Remove lazy types from the `IAppContainerItems` intersection**

Remove these lines from the `IAppContainerItems` type:

```typescript
// REMOVE from IAppContainerItems:
PoiLabItems &
CollisionLabItems &
PoiItems &
LandingPreviewItems &
HallOfShameItems &
ComposeBrowseItems &
ComposeArrangeItems &
Skel2TKAItems &
LabItems &
AssembleItems &
FuseItems &
ArenaItems &
EffectsLabItems &
MuseumItems &
VideoTrailsItems &
VideoInfraItems &
FestivalItems &
StoreItems &
TrigridLabItems &
MultiGridItems &
```

- [ ] **Step 4: Verify compilation — expect type errors in feature modules**

Run: `npx tsc --noEmit --pretty false 2>&1 | grep -c "error TS"`
Expected: Type errors in feature module files where `container.items.X` references services from lazy containers. These will be fixed in Tasks 4-7.

- [ ] **Step 5: Commit**

```bash
git add src/lib/shared/di/container-types.ts
git commit -m "refactor: remove 19 lazy container types from IAppContainerItems"
```

---

### Task 4: Migrate feature modules — self-contained batch (poi-lab, collision-lab, hall-of-shame, landing-preview)

**Files:**
- Modify: Feature module components that use services from these containers

For each module, find all `container.items.X` references to services from that lazy container and replace them with calls to the lazy factory.

**Pattern — before:**
```typescript
import { container } from "$lib/shared/di";
const myService = container.items.poiLabSomething;
```

**Pattern — after:**
```typescript
import { getPoiLabItems } from "$lib/shared/di/lazy-containers";

// In onMount or async init:
const poiLabItems = await getPoiLabItems();
const myService = poiLabItems.poiLabSomething;
```

- [ ] **Step 1: Find all usages of lazy container services**

For each container, search for its service names in feature code:

```bash
# Find services registered in each container, then grep for their usage
# Example for poi-lab:
grep -r "container\.items\." src/lib/features/poi-lab/ --include="*.svelte" --include="*.ts" -l
```

Do this for: poi-lab, collision-lab, hall-of-shame, landing-preview.

- [ ] **Step 2: Update each feature module file**

For each file found:
1. Remove `import { container } from "$lib/shared/di"` (if the file has no other container.items usage for eager services)
2. Add `import { getXxxItems } from "$lib/shared/di/lazy-containers"`
3. Replace `container.items.serviceName` with awaited lazy access
4. If in a Svelte component, load in `onMount` or a top-level async block

- [ ] **Step 3: Verify these modules compile**

Run: `npx tsc --noEmit --pretty false 2>&1 | grep "poi-lab\|collision-lab\|hall-of-shame\|landing-preview"`
Expected: No errors from these feature directories

- [ ] **Step 4: Commit**

```bash
git add src/lib/features/poi-lab/ src/lib/features/collision-lab/ src/lib/features/hall-of-shame/ src/lib/features/landing/
git commit -m "refactor: migrate poi-lab, collision-lab, hall-of-shame, landing-preview to lazy DI"
```

---

### Task 5: Migrate feature modules — lab group (lab, assemble, fuse, trigrid, multi-grid, effects-lab, video-trails, video-infra)

**Files:**
- Modify: Components in `src/lib/features/lab/`, `src/lib/features/assemble/`, `src/lib/features/fuse/`, `src/lib/features/effects-lab/`, `src/lib/features/video-trails/`

Same pattern as Task 4. These are all lab-related modules.

- [ ] **Step 1: Find all usages**

```bash
grep -r "container\.items\." src/lib/features/lab/ src/lib/features/assemble/ src/lib/features/fuse/ src/lib/features/effects-lab/ src/lib/features/video/ --include="*.svelte" --include="*.ts" -l
```

Also check for trigrid-lab and multi-grid usage outside their containers.

- [ ] **Step 2: Update each file with lazy imports**

Replace `container.items.X` with the appropriate `getLabItems()`, `getAssembleItems()`, `getFuseItems()`, `getEffectsLabItems()`, `getVideoTrailsItems()`, `getVideoInfraItems()`, `getTrigridLabItems()`, `getMultiGridItems()`.

- [ ] **Step 3: Verify compilation**

Run: `npx tsc --noEmit --pretty false 2>&1 | grep "features/lab\|features/assemble\|features/fuse\|features/effects\|features/video"`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add src/lib/features/lab/ src/lib/features/assemble/ src/lib/features/fuse/ src/lib/features/effects-lab/ src/lib/features/video/
git commit -m "refactor: migrate lab group modules to lazy DI"
```

---

### Task 6: Migrate feature modules — standalone features (museum, festival, store, arena, poi, skel2tka)

**Files:**
- Modify: Components in their respective feature directories

- [ ] **Step 1: Find all usages**

```bash
grep -r "container\.items\." src/lib/features/museum/ src/lib/features/realm/ src/lib/features/festival/ src/lib/features/store/ src/lib/features/arena/ src/lib/features/poi/ src/lib/features/skel2tka/ --include="*.svelte" --include="*.ts" -l
```

Note: Museum might be under `realm/` or `museum/` — check both.

- [ ] **Step 2: Update each file with lazy imports**

- [ ] **Step 3: Verify compilation**

Run: `npx tsc --noEmit --pretty false 2>&1 | grep "features/museum\|features/realm\|features/festival\|features/store\|features/arena\|features/poi\|features/skel2tka"`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add src/lib/features/museum/ src/lib/features/realm/ src/lib/features/festival/ src/lib/features/store/ src/lib/features/arena/ src/lib/features/poi/ src/lib/features/skel2tka/
git commit -m "refactor: migrate museum, festival, store, arena, poi, skel2tka to lazy DI"
```

---

### Task 7: Migrate compose modules (compose-browse, compose-arrange)

**Files:**
- Modify: Components in `src/lib/features/compose/`

- [ ] **Step 1: Find all usages**

```bash
grep -r "container\.items\." src/lib/features/compose/ --include="*.svelte" --include="*.ts" -l
```

- [ ] **Step 2: Update each file with lazy imports**

- [ ] **Step 3: Verify compilation**

Run: `npx tsc --noEmit --pretty false 2>&1 | grep "features/compose"`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add src/lib/features/compose/
git commit -m "refactor: migrate compose modules to lazy DI"
```

---

### Task 8: Full compilation check and fix any remaining type errors

**Files:**
- Modify: Any files with remaining type errors

- [ ] **Step 1: Run full type check**

Run: `npx tsc --noEmit --pretty false 2>&1 | grep "error TS" | head -30`

Expect: Only pre-existing errors (the 49 from 3D/Threlte changes), no new errors from the lazy DI refactor.

- [ ] **Step 2: Fix any remaining errors**

Common issues to watch for:
- A shared utility importing a lazy container's service — needs to accept the service as a parameter instead
- A context file that passes lazy services at module root level — needs async init

- [ ] **Step 3: Commit fixes**

```bash
git add -u
git commit -m "fix: resolve remaining type errors from lazy DI migration"
```

---

### Task 9: Measure the improvement

**Files:**
- No changes — measurement only

- [ ] **Step 1: Refresh the app in dev mode**

Open the browser, hard-refresh (Ctrl+Shift+R), and check the console output.

- [ ] **Step 2: Compare boot profiler output**

The `di-container` phase should be significantly faster because Vite no longer needs to fetch the module graph for 19 container files and all their transitive dependencies.

Record the new numbers:
- `di-container` phase: was 64,573ms, now ___ms
- `total-init` phase: was 106,934ms, now ___ms
- DI container table: should show ~17 containers instead of 37

- [ ] **Step 3: Test module navigation**

Navigate to each lazy-loaded module (museum, poi-lab, arena, etc.) and verify:
- Module loads without errors
- Services work correctly (no "undefined" errors in console)
- Second navigation to the same module is instant (cached)

- [ ] **Step 4: Document the results**

Add a comment to the boot profiler summary or log the before/after numbers.

---

### Task 10: Remove boot profiler instrumentation (optional — keep if useful)

**Files:**
- Modify: `src/lib/shared/di/index.ts` — remove `_timeContainer` wrapper if desired
- Modify: `src/routes/+layout.svelte` — remove bootProfiler marks if desired

The profiler is lightweight and useful for ongoing monitoring. Consider keeping it behind a `localStorage.getItem('tka-boot-profile')` flag instead of removing it.

- [ ] **Step 1: Decide whether to keep, gate, or remove the profiler**

If keeping with a flag:
```typescript
const PROFILE_BOOT = typeof window !== 'undefined' && localStorage.getItem('tka-boot-profile') === '1';
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/shared/di/index.ts src/routes/+layout.svelte src/lib/shared/analytics/boot-profiler.ts
git commit -m "chore: gate boot profiler behind localStorage flag"
```

---

## Risk Mitigation

**Biggest risk:** A service from a lazy container is accidentally used in shared code (not just its feature module). The type system will catch this as a compile error in Task 3/8, so we'll know immediately.

**Fallback:** If a lazy container turns out to be needed eagerly, just move it back to `index.ts`. The lazy-containers.ts factory still works — it just won't be called.

**HMR:** Lazy containers don't need HMR state preservation since they're only instantiated when their module mounts (which already re-runs on HMR).

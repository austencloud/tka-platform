# DI Module Singleton Migration — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the ITI-based DI container with module-level singleton getters and Svelte 5 `createContext()`, eliminating 1,500+ lines of wiring infrastructure and the `any`-typed composition root.

**Architecture:** Each ITI container dissolves into getter functions (`getServiceName()`) colocated with the service implementations. Consumers change from `container.items.foo` to `getFoo()`. Internal service dependencies become direct function calls between getters. Browser-only services use `import { browser } from '$app/environment'` instead of 48 centralized `typeof window` guards.

**Tech Stack:** TypeScript, SvelteKit 5, Svelte 5 `createContext()`, Vite HMR (`import.meta.hot`)

**Spec:** `docs/superpowers/specs/2026-04-23-di-module-singleton-migration-design.md`

---

## Canonical Patterns

Every task in this plan applies one of these three patterns. Read them once, apply everywhere.

### Pattern A: Sync singleton getter (most services)

```typescript
// src/lib/shared/<domain>/getServiceName.ts
import { browser } from '$app/environment';
import { ServiceName } from './services/implementations/ServiceName';

let instance: ServiceName | null = null;

export function getServiceName(): ServiceName {
  if (!browser) throw new Error('getServiceName() is browser-only');
  return instance ??= new ServiceName();
}
```

For SSR-safe services (pure computation, no DOM/browser APIs), omit the browser guard.

### Pattern B: Sync singleton getter with dependencies

```typescript
// src/lib/shared/<domain>/getServiceName.ts
import { browser } from '$app/environment';
import { ServiceName } from './services/implementations/ServiceName';
import { getDependency } from '../other-domain/getDependency';

let instance: ServiceName | null = null;

export function getServiceName(): ServiceName {
  if (!browser) throw new Error('getServiceName() is browser-only');
  return instance ??= new ServiceName(getDependency());
}
```

### Pattern C: HMR-preserved singleton (stateful services only)

```typescript
// src/lib/shared/<domain>/getServiceName.ts
import { createServiceName } from './state/service-name-factory.svelte';

const hmrData = import.meta.hot?.data as { serviceName?: ReturnType<typeof createServiceName> } | undefined;
let instance = hmrData?.serviceName ?? createServiceName();

if (import.meta.hot) {
  import.meta.hot.dispose((data) => { data.serviceName = instance; });
}

export function getServiceName() {
  return instance;
}
```

### Consumer migration pattern

```typescript
// BEFORE
import { container } from '$lib/shared/di';
const foo = container.items.foo;

// AFTER
import { getFoo } from '$lib/shared/<domain>/getFoo';
const foo = getFoo();
```

### Verification after every task

```bash
npm run check   # TypeScript passes
npm run build   # Production build succeeds
```

---

## Phase 1: Infrastructure + First Migration (Proof of Concept)

### Task 1: Create migration progress tracker

**Files:**
- Create: `scripts/di-migration-progress.sh`

- [ ] **Step 1: Write the tracking script**

```bash
#!/usr/bin/env bash
# Reports remaining container.items references and ITI imports
echo "=== DI Migration Progress ==="
echo ""
echo "container.items references remaining:"
grep -r "container\.items\." src/ --include="*.ts" --include="*.svelte" -l 2>/dev/null | wc -l
echo ""
echo "ITI imports remaining:"
grep -r "from \"iti\"" src/ --include="*.ts" -l 2>/dev/null | wc -l
echo ""
echo "Container files remaining:"
ls src/lib/shared/di/containers/*.ts 2>/dev/null | wc -l
echo ""
echo "Top 10 most-referenced services:"
grep -roh "container\.items\.\w\+" src/ --include="*.ts" --include="*.svelte" 2>/dev/null | sort | uniq -c | sort -rn | head -10
```

- [ ] **Step 2: Run it to establish baseline**

Run: `bash scripts/di-migration-progress.sh`
Expected: ~531 container.items references, ~63 ITI imports, ~63 container files

- [ ] **Step 3: Commit**

```bash
git add scripts/di-migration-progress.sh
git commit -m "chore: add DI migration progress tracker script"
```

### Task 2: Migrate analyticsContainer (1 service, simplest possible)

This is the proof-of-concept migration. One container, one service, minimal consumers.

**Files:**
- Create: `src/lib/shared/analytics/getActivityLogger.ts`
- Modify: consumers of `container.items.activityLogger` (find via grep)
- Modify: `src/lib/shared/di/index.ts` — remove analyticsContainer from composition
- Modify: `src/lib/shared/di/container-types.ts` — remove AnalyticsItems from intersection
- Delete: `src/lib/shared/di/containers/analytics-container.ts`

- [ ] **Step 1: Find all consumers**

Run: `grep -rn "container\.items\.activityLogger" src/ --include="*.ts" --include="*.svelte"`
Note every file and line.

- [ ] **Step 2: Create the getter**

```typescript
// src/lib/shared/analytics/getActivityLogger.ts
import { browser } from '$app/environment';
import { PostHogActivityLogger } from './services/implementations/PostHogActivityLogger';

let instance: PostHogActivityLogger | null = null;

export function getActivityLogger(): PostHogActivityLogger {
  if (!browser) throw new Error('getActivityLogger() is browser-only');
  return instance ??= new PostHogActivityLogger();
}
```

- [ ] **Step 3: Update every consumer**

In each file from Step 1, replace:
```typescript
import { container } from '$lib/shared/di';
// ...
container.items.activityLogger
```
with:
```typescript
import { getActivityLogger } from '$lib/shared/analytics/getActivityLogger';
// ...
getActivityLogger()
```

If the file still uses `container.items` for OTHER services, keep the container import and only change the activityLogger references.

- [ ] **Step 4: Remove from DI composition**

In `src/lib/shared/di/index.ts`:
- Remove the `import { analyticsContainer }` line
- Remove `c = c.add(analyticsContainer.items);` from `buildAppContainer()`

In `src/lib/shared/di/container-types.ts`:
- Remove the `import type { AnalyticsContainer }` line
- Remove `type AnalyticsItems = ItemsOf<AnalyticsContainer>;`
- Remove `AnalyticsItems &` from the `IAppContainerItems` intersection

Also update any other containers that depend on analyticsContainer (check: `adminContainer` uses `activityLogger` — update its factory to call `getActivityLogger()` instead).

- [ ] **Step 5: Delete the container file**

Delete: `src/lib/shared/di/containers/analytics-container.ts`

- [ ] **Step 6: Verify**

Run: `npm run check && npm run build`
Run: `grep -rn "activityLogger" src/lib/shared/di/ --include="*.ts"` — should return nothing
Run: `bash scripts/di-migration-progress.sh` — container count should be 62

- [ ] **Step 7: Commit**

```bash
git add -A src/lib/shared/analytics/getActivityLogger.ts
git add src/lib/shared/di/index.ts src/lib/shared/di/container-types.ts src/lib/shared/di/containers/
git commit -m "refactor(di): migrate analyticsContainer to module singleton getter"
```

---

## Phase 2: Pictograph Services (Already Singletons)

### Task 3: Remove pictograph services from DI container

These 12 services on lines 45-57 of `index.ts` are already module-level singletons. ITI wraps them pointlessly. Some consumers import them directly, others go through `container.items`. Unify on direct import.

**Services (all already exported as singletons from their modules):**
- `motionQueryHandler` — `$lib/shared/pictograph/shared/services/implementations/MotionQueryHandler`
- `gridModeDeriver` — `$lib/shared/pictograph/grid/services/implementations/GridModeDeriver`
- `gridPositionDeriver` — `$lib/shared/pictograph/grid/services/implementations/GridPositionDeriver`
- `startPositionDeriver` — `$lib/shared/pictograph/shared/services/implementations/StartPositionDeriver`
- `orientationCalculator` — `$lib/shared/pictograph/prop/services/implementations/OrientationCalculator`
- `betaDetector` — `$lib/shared/pictograph/prop/services/implementations/BetaDetector`
- `arrowPositioningOrchestrator` — `$lib/shared/pictograph/arrow/orchestration/services/implementations/ArrowPositioningOrchestrator`
- `letterQueryHandler` — `$lib/shared/pictograph/tka-glyph/services/implementations/LetterQueryHandler`
- `screenSpaceAdjustmentTransformer` — `$lib/shared/pictograph/arrow/positioning/calculation/services/implementations/ScreenSpaceAdjustmentTransformer`
- `arrowAdjustmentCalculator` — `$lib/shared/pictograph/arrow/positioning/calculation/services/implementations/ArrowAdjustmentCalculator`
- `arrowLocationCalculator` — `$lib/shared/pictograph/arrow/positioning/calculation/services/implementations/ArrowLocationCalculator`
- `pictographPreparer` — `$lib/shared/pictograph/shared/services/implementations/PictographPreparer`
- `turnsTupleGenerator` — `$lib/shared/pictograph/arrow/positioning/placement/services/implementations/TurnsTupleGenerator`

- [ ] **Step 1: Find consumers using these through container.items**

Run for each service:
```bash
grep -rn "container\.items\.motionQueryHandler" src/ --include="*.ts" --include="*.svelte"
grep -rn "container\.items\.gridModeDeriver" src/ --include="*.ts" --include="*.svelte"
# ... repeat for all 12
```

- [ ] **Step 2: Update each consumer to import the singleton directly**

For each match, replace `container.items.motionQueryHandler` with a direct import:
```typescript
import { motionQueryHandler } from '$lib/shared/pictograph/shared/services/implementations/MotionQueryHandler';
```

No getter file needed — these are already exported singletons.

- [ ] **Step 3: Remove from index.ts**

Remove lines 45-57 (the pictograph singleton imports) from `index.ts`. These are only used to pass into factory container constructors. Update those factory container calls to import the singletons directly.

- [ ] **Step 4: Remove pictograph-container.ts clearPictographCaches from DI index**

Move the `clearAllRenderCaches()` function out of `index.ts` into `src/lib/shared/render/clearRenderCaches.ts`. Update any consumers.

- [ ] **Step 5: Verify and commit**

```bash
npm run check && npm run build
git commit -m "refactor(di): remove pictograph singletons from ITI container — direct imports"
```

---

## Phase 3: Trivial Leaf Containers (1-6 services, no cross-deps)

### Task 4: Migrate simple leaf containers (batch)

These containers have no dependencies on other containers. Each is 1-6 services. Migrate all in one batch.

**Containers to migrate (17 containers):**

| Container | Services | Domain directory |
|-----------|----------|-----------------|
| presenceContainer | 1 | `shared/presence/` |
| mandalaContainer | 1 | `shared/mandala/` |
| sequenceMandalaContainer | 2 | `shared/mandala/` |
| writeContainer | 2 | `features/write/` |
| platformContainer | 2 | `shared/platform/` |
| viewerAuthContainer | 2 | `shared/auth/` |
| compositionContainer | 6 | `shared/composition/` |
| backgroundBuilderContainer | 6 | `features/background-builder/` |
| keyboardContainer | 5 | `shared/keyboard/` |
| communityContainer | 12 | `features/community/` |
| arenaContainer | 5 | `features/arena/` |
| assembleContainer | 4 | `features/assemble-lab/` |
| effectsLabContainer | 4 | `features/effects-lab/` |
| festivalContainer | 6 | `features/festival/` |
| fuseContainer | 3 | `features/fuse/` |
| labContainer | 5 | `features/lab/` |
| trigridLabContainer | 2 | `features/trigrid-lab/` |

**For each container:**

- [ ] **Step 1: Read the container file** to identify every registered service and its dependencies

- [ ] **Step 2: For each service, create a getter file** in the service's domain directory following Pattern A or B

For containers with INTERNAL dependency chains (e.g., keyboardContainer where KeyboardShortcutManager depends on ShortcutRegistry), the getters call each other:

```typescript
// src/lib/shared/keyboard/getShortcutRegistry.ts
import { ShortcutRegistry } from './services/implementations/ShortcutRegistry';
let instance: ShortcutRegistry | null = null;
export function getShortcutRegistry(): ShortcutRegistry {
  return instance ??= new ShortcutRegistry();
}

// src/lib/shared/keyboard/getKeyboardShortcutManager.ts
import { KeyboardShortcutManager } from './services/implementations/KeyboardShortcutManager';
import { getShortcutRegistry } from './getShortcutRegistry';
let instance: KeyboardShortcutManager | null = null;
export function getKeyboardShortcutManager(): KeyboardShortcutManager {
  return instance ??= new KeyboardShortcutManager(getShortcutRegistry());
}
```

- [ ] **Step 3: Update all consumers** — grep for `container.items.<serviceName>` and replace with getter import

- [ ] **Step 4: Remove container from index.ts and container-types.ts**

- [ ] **Step 5: Delete the container file**

- [ ] **Step 6: Verify after each container**

```bash
npm run check
```

- [ ] **Step 7: Commit after completing all containers in this batch**

```bash
git commit -m "refactor(di): migrate 17 leaf containers to module singleton getters"
```

If the batch is too large for one commit, split by domain: shared/ containers first, then features/ containers.

---

## Phase 4: Core Container Dissolution (30+ services)

### Task 5: Migrate core container — HMR-preserved state services

The core container has 3 services with HMR state preservation. These MUST use Pattern C.

**Files:**
- Create: `src/lib/shared/application/getAppState.ts`
- Create: `src/lib/shared/foundation/getAppStateInitializer.ts`
- Create: `src/lib/shared/application/getPerformanceMetricsState.ts`

- [ ] **Step 1: Create HMR-preserved getters**

```typescript
// src/lib/shared/application/getAppState.ts
import { createAppState } from './state/app-state-factory.svelte';

type AppState = ReturnType<typeof createAppState>;
const hmrData = import.meta.hot?.data as { appState?: AppState } | undefined;
let instance: AppState = hmrData?.appState ?? createAppState();

if (import.meta.hot) {
  import.meta.hot.dispose((data) => { data.appState = instance; });
}

export function getAppState(): AppState {
  return instance;
}
```

```typescript
// src/lib/shared/foundation/getAppStateInitializer.ts
import { createAppStateInitializer } from './services/implementations/data/app-state-initializer.svelte';

type AppStateInitializer = ReturnType<typeof createAppStateInitializer>;
const hmrData = import.meta.hot?.data as { init?: AppStateInitializer } | undefined;
let instance: AppStateInitializer = hmrData?.init ?? createAppStateInitializer();

if (import.meta.hot) {
  import.meta.hot.dispose((data) => { data.init = instance; });
}

export function getAppStateInitializer(): AppStateInitializer {
  return instance;
}
```

```typescript
// src/lib/shared/application/getPerformanceMetricsState.ts
import { createPerformanceMetricsState } from './state/PerformanceMetricsState.svelte';

type PerfState = ReturnType<typeof createPerformanceMetricsState>;
const hmrData = import.meta.hot?.data as { perf?: PerfState } | undefined;
let instance: PerfState = hmrData?.perf ?? createPerformanceMetricsState();

if (import.meta.hot) {
  import.meta.hot.dispose((data) => { data.perf = instance; });
}

export function getPerformanceMetricsState(): PerfState {
  return instance;
}
```

- [ ] **Step 2: Update consumers and verify**

```bash
npm run check
```

- [ ] **Step 3: Commit**

```bash
git commit -m "refactor(di): migrate HMR-preserved state services from core container"
```

### Task 6: Migrate core container — device + settings services

These are already module singletons wrapped in ITI.

**Services:**
- `deviceDetector` — already singleton at `$lib/shared/device/services/implementations/DeviceDetector`
- `viewportManager` — already singleton at `$lib/shared/device/services/implementations/ViewportManager.svelte`
- `settingsState` — already singleton at `$lib/shared/settings/state/SettingsState.svelte` (exported as `settingsService`)

**Action:** No getter files needed. Update consumers to import the existing singletons directly:

```typescript
// BEFORE
import { container } from '$lib/shared/di';
const detector = container.items.deviceDetector;

// AFTER
import { deviceDetector } from '$lib/shared/device/services/implementations/DeviceDetector';
```

- [ ] **Step 1: Find and update all consumers** of `container.items.deviceDetector`, `container.items.viewportManager`, `container.items.settingsState`

- [ ] **Step 2: Verify and commit**

```bash
npm run check && npm run build
git commit -m "refactor(di): migrate device + settings singletons — direct imports"
```

### Task 7: Migrate core container — application services

**Services to create getters for:**
- `applicationInitializer` → `src/lib/shared/application/getApplicationInitializer.ts`
- `resourceTracker` → `src/lib/shared/application/getResourceTracker.ts`
- `componentManager` → `src/lib/shared/application/getComponentManager.ts`
- `errorHandler` → `src/lib/shared/application/getErrorHandler.ts` (29 consumers — high impact)
- `hapticFeedback` → `src/lib/shared/application/getHapticFeedback.ts` (238 consumers — highest impact)
- `rippleEffect` → `src/lib/shared/application/getRippleEffect.ts`

**Special case — hapticFeedback depends on nativePlatformDetector:**

```typescript
// src/lib/shared/application/getHapticFeedback.ts
import { browser } from '$app/environment';
import { HapticFeedback } from './services/implementations/HapticFeedback';
import { getNativePlatformDetector } from '$lib/shared/platform/getNativePlatformDetector';

let instance: HapticFeedback | null = null;

export function getHapticFeedback(): HapticFeedback {
  if (!browser) throw new Error('getHapticFeedback() is browser-only');
  return instance ??= new HapticFeedback(getNativePlatformDetector());
}
```

Note: `getNativePlatformDetector` must exist before this task. It was created in Task 4 (platformContainer migration).

- [ ] **Step 1: Create getter files for all 6 services**

- [ ] **Step 2: Update hapticFeedback consumers (238 files)**

This is the largest single consumer update. Approach:
1. Find all files: `grep -rl "container\.items\.hapticFeedback" src/`
2. In each file, replace the access pattern
3. If the file has no other `container.items` usages, remove the container import entirely

- [ ] **Step 3: Update errorHandler consumers (29 files)**

- [ ] **Step 4: Update remaining application service consumers**

- [ ] **Step 5: Verify and commit**

```bash
npm run check && npm run build
git commit -m "refactor(di): migrate application services from core container

hapticFeedback (238 consumers), errorHandler (29 consumers), and 4 others."
```

### Task 8: Migrate core container — auth, mobile, foundation, remaining services

**Auth services (create getters in `src/lib/shared/auth/`):**
- `authenticator`, `profilePictureManager`, `userDocumentManager`, `subscriptionManager`, `premiumGateChecker`, `usernameValidator`, `accountManager`

Note: `userDocumentManager` depends on `profilePictureManager` and `usernameValidator`. `accountManager` depends on `hapticFeedback`.

**Subscription services (create getters in `src/lib/shared/subscription/`):**
- `subscriptionManager`, `premiumGateChecker`

**Mobile services (create getters in `src/lib/shared/mobile/`):**
- `mobileFullscreenManager`, `platformDetector`, `gestureHandler`, `pwaEngagementTracker`, `pwaInstallDismissalManager`

**Foundation services (create getters in `src/lib/shared/foundation/`):**
- `wordDeriver`, `fileDownloader`, `storageManager`, `seoManager`, `svgImageConverter`

**Onboarding (create getter in `src/lib/shared/onboarding/`):**
- `onboardingPersister`

**Offline (create getter in `src/lib/shared/offline/`):**
- `conflictResolver`

**Library (create getter in `src/lib/features/library/`):**
- `tagManager`

**Feature flags (create getters in `src/lib/shared/auth/`):**
- `globalFeatureFlagPersister`, `userFeatureFlagPersister`

- [ ] **Step 1: Create all getter files** following Pattern A/B

- [ ] **Step 2: Update consumers for each service**

- [ ] **Step 3: Delete core-container.ts**

After all services are migrated, remove:
- `src/lib/shared/di/containers/core-container.ts`
- All core-container references from `index.ts` and `container-types.ts`

- [ ] **Step 4: Verify and commit**

```bash
npm run check && npm run build
git commit -m "refactor(di): dissolve core container — auth, mobile, foundation services"
```

---

## Phase 5: Data + Remaining Infrastructure Containers

### Task 9: Migrate dataContainer (9 services)

**Files to read:** `src/lib/shared/di/containers/data-container.ts`

Create getters in the service's home directory (likely `src/lib/shared/data/` or `src/lib/features/create/shared/`). Follow the same pattern as previous tasks.

Special attention: `sequenceRepository`, `persistenceService`, `reversalDetector`, `sequenceLoopabilityChecker` are consumed by many factory containers (navigation, create, browse, composeCoreContainer). When migrating these, also update the factory container calls in `index.ts` to use the getters instead.

- [ ] **Step 1: Read container file, identify services and consumers**
- [ ] **Step 2: Create getter files**
- [ ] **Step 3: Update consumers + update factory container calls in index.ts**
- [ ] **Step 4: Delete container file, remove from index.ts/container-types.ts**
- [ ] **Step 5: Verify and commit**

```bash
npm run check && npm run build
git commit -m "refactor(di): migrate dataContainer to module singleton getters"
```

---

## Phase 6: Mid-Graph Factory Containers

### Task 10: Migrate renderContainer (15+ services)

**Key complexity:** Layered internal dependency chain (4 layers). The getter pattern handles this naturally — deeper getters call shallower getters.

```
Layer 1 (leaf): canvasManager, layoutCalculator, dimensionCalculator, ...
Layer 2: textRenderer(dimensionCalculator, loopIconStripRenderer)
Layer 3: imageComposer(layoutCalculator, textRenderer, dimensionCalculator, ...)
Layer 4: sequenceRenderer(imageComposer, imageFormatConverter)
```

Create getters in `src/lib/shared/render/`:

```typescript
// src/lib/shared/render/getSequenceRenderer.ts
import { browser } from '$app/environment';
import { SequenceRenderer } from './services/implementations/SequenceRenderer';
import { getImageComposer } from './getImageComposer';
import { getImageFormatConverter } from './getImageFormatConverter';

let instance: SequenceRenderer | null = null;

export function getSequenceRenderer(): SequenceRenderer {
  if (!browser) throw new Error('getSequenceRenderer() is browser-only');
  return instance ??= new SequenceRenderer(getImageComposer(), getImageFormatConverter());
}
```

- [ ] **Step 1: Read container, map 4-layer dependency chain**
- [ ] **Step 2: Create getters bottom-up (leaf → root)**
- [ ] **Step 3: Update consumers**
- [ ] **Step 4: Handle the imageComposer ↔ qrCodeGenerator circular dep**

Move the late-binding wiring to a dedicated init function:

```typescript
// src/lib/shared/render/wireRenderDeps.ts
import { getImageComposer } from './getImageComposer';
import { getQRCodeGenerator } from '$lib/shared/qr/getQRCodeGenerator';

let wired = false;
export function wireRenderDeps(): void {
  if (wired) return;
  wired = true;
  (getImageComposer() as any).setQRCodeGenerator(getQRCodeGenerator());
}
```

Call `wireRenderDeps()` in root `+layout.svelte` `onMount`.

- [ ] **Step 5: Delete container, verify, commit**

```bash
npm run check && npm run build
git commit -m "refactor(di): migrate renderContainer to module singleton getters"
```

### Task 11: Migrate navigationContainer (9 services)

**External deps:** motionQueryHandler, gridModeDeriver, gridPositionDeriver (already direct singletons from Task 3), persistenceService (getter from Task 9).

- [ ] **Step 1-5: Standard migration pattern** — create getters in `src/lib/shared/navigation/` or appropriate domain dirs
- [ ] **Step 6: Commit**

```bash
git commit -m "refactor(di): migrate navigationContainer to module singleton getters"
```

### Task 12: Migrate remaining mid-graph containers (batch)

**Containers (no complex cross-deps):**
- feedbackContainer (10 services)
- gamificationContainer (7 services)
- promoContainer (5 services)
- moderationContainer (5 services)
- attributionContainer (3 services)
- voiceControlContainer (3 services)
- pushContainer (2 services)
- lanSyncContainer (4 services)
- viewer3DContainer (1 service)
- delightContainer (1 service)

- [ ] **Step 1-5: Standard migration pattern for each**
- [ ] **Step 6: Commit**

```bash
git commit -m "refactor(di): migrate 10 mid-graph factory containers to getters"
```

---

## Phase 7: Upper-Graph Factory Containers

### Task 13: Migrate shareContainer (7 services)

**External deps:** sequenceRenderer (getter from Task 10)

- [ ] **Standard migration pattern**
- [ ] **Commit**

### Task 14: Migrate browseContainer (28+ services)

**Largest factory container.** External deps: wordDeriver, deviceDetector, sequenceRenderer, startPositionDeriver, cloudThumbnailCache, sheetRouter, collaborativeVideoManager.

**Naming conflict note:** browseContainer uses `upsert` in index.ts because `filterPersister` and `navigator` conflict with other containers. With module singletons, this conflict disappears — each service has its own file with a unique getter name.

- [ ] **Step 1: Read container, list all 28+ services**
- [ ] **Step 2: Create getters** — use descriptive names to avoid the old conflicts:
  - `getBrowseFilterPersister()` not `getFilterPersister()`
  - `getBrowseNavigator()` not `getNavigator()`
- [ ] **Step 3: Update consumers (browseContainer has many consumers in features/browse/)**
- [ ] **Step 4: Delete, verify, commit**

```bash
git commit -m "refactor(di): migrate browseContainer (28 services) to getters — naming conflicts eliminated"
```

### Task 15: Migrate createModuleContainer (100+ services)

**Most complex container.** Has 22 external dependencies. But with all upstream getters already created (Tasks 4-14), this becomes straightforward — the factory's dependency parameters become getter calls.

- [ ] **Step 1: Read container, map all services and their deps**
- [ ] **Step 2: Create getters in `src/lib/features/create/`**

Each service's getter calls the upstream getters:
```typescript
// Example
import { getDeviceDetector } from '$lib/shared/device/...';
import { getGridPositionDeriver } from '$lib/shared/pictograph/...';
// ... etc
```

- [ ] **Step 3: Also remove configureLazyCreateContainer()** from index.ts — no longer needed since getters are inherently lazy

- [ ] **Step 4: Handle the loopDetector naming conflict**

`createModuleContainer` registers `loopDetector`. `loopLabelerContainer` later upserts it. With getters, these become two separate functions:
- `getCreateLoopDetector()` — from create module
- `getLoopLabelerLoopDetector()` — from loop labeler

Consumers choose the one they need. No upsert, no last-writer-wins.

- [ ] **Step 5: Verify and commit**

```bash
npm run check && npm run build
git commit -m "refactor(di): migrate createModuleContainer (100+ services) to getters"
```

### Task 16: Migrate remaining upper-graph containers

**Containers:**
- composeCoreContainer (28+ services)
- loopLabelerContainer (18 services) — resolves the upsert naming conflict
- libraryContainer (9+ services)
- trainContainer (11 services)
- learnContainer (13 services)
- adminContainer (13 services)
- voiceSessionContainer (6 services)
- deviceSyncContainer (5 services)
- connectContainer (5 services)
- watchContainer (5 services)
- offlineContainer (1 service)
- qrContainer (2 services)
- 3dEngineContainer (10 services)

- [ ] **Step 1-5: Standard migration for each container**
- [ ] **Step 6: Commit** (split into multiple commits if batch is too large)

```bash
git commit -m "refactor(di): migrate remaining upper-graph factory containers to getters"
```

---

## Phase 8: Feature Islands + Final Cleanup

### Task 17: Migrate lazy-loaded feature containers

These containers are already behind dynamic imports in `lazy-containers.ts`. Migration converts them from "lazy ITI containers" to "async getter functions with cached dynamic imports."

**Containers (20):**
poiLabContainer, collisionLabContainer, museumContainer, festivalContainer, storeContainer, hallOfShameContainer, arenaContainer, skel2tkaContainer, composeBrowseContainer, composeArrangeContainer, effectsLabContainer, videoTrailsContainer, videoInfraContainer, trigridLabContainer, multiGridContainer, labContainer, assembleContainer, fuseContainer, poiContainer, landingPreviewContainer

Note: Some of these were already migrated as leaf containers in Task 4. For those already done, skip. For any remaining:

```typescript
// Example: src/lib/features/museum/getMuseumServices.ts
let cache: MuseumServices | null = null;

export async function getMuseumServices(): Promise<MuseumServices> {
  if (cache) return cache;
  const { MuseumSceneManager } = await import('./services/implementations/MuseumSceneManager');
  const { MuseumVillageManager } = await import('./services/implementations/MuseumVillageManager');
  cache = {
    museumSceneManager: new MuseumSceneManager(),
    museumVillageManager: new MuseumVillageManager(),
  };
  return cache;
}
```

- [ ] **Step 1: For each remaining feature container, create async getters with dynamic imports**
- [ ] **Step 2: Update consumers (these are already in lazy-loading callsites)**
- [ ] **Step 3: Delete lazy-containers.ts and lazy-container.ts**
- [ ] **Step 4: Verify and commit**

```bash
npm run check && npm run build
git commit -m "refactor(di): migrate lazy-loaded feature containers to async getters"
```

### Task 18: Migrate standalone services + print services

**Standalone services registered directly in buildAppContainer():**
- `deepLinkResolver` → `src/lib/shared/application/getDeepLinkResolver.ts`
- `sequenceDataProvider` → `src/lib/shared/sequence-viewer/getSequenceDataProvider.ts`
- `deviceIdService` → `src/lib/shared/auth/getDeviceIdService.ts`

**Print services (inline factories in buildAppContainer):**
- `cardBackDomRenderer` → `src/lib/features/choreo-card/getCardBackDomRenderer.ts`
- `infoCardCanvasRenderer` → `src/lib/features/choreo-card/getInfoCardCanvasRenderer.ts`
- `printZipExporter` → `src/lib/features/choreo-card/getPrintZipExporter.ts`
- `printCardRenderer` → `src/lib/features/choreo-card/getPrintCardRenderer.ts`

- [ ] **Step 1: Create getters for each**
- [ ] **Step 2: Update consumers**
- [ ] **Step 3: Commit**

```bash
git commit -m "refactor(di): migrate standalone + print services to getters"
```

### Task 19: Wire post-init dependencies in root layout

Move late-binding wiring (currently in index.ts lines 547-551) to the app's natural composition root.

**File:** `src/routes/+layout.svelte`

- [ ] **Step 1: Add onMount wiring call**

```svelte
<script>
  import { onMount } from 'svelte';
  import { wireRenderDeps } from '$lib/shared/render/wireRenderDeps';

  onMount(() => {
    wireRenderDeps();
  });
</script>
```

- [ ] **Step 2: Verify and commit**

```bash
npm run check && npm run build
git commit -m "refactor(di): wire post-init deps in root layout"
```

### Task 20: Delete DI infrastructure + remove ITI

**The final cleanup.**

- [ ] **Step 1: Verify zero remaining container.items references**

```bash
grep -rn "container\.items\." src/ --include="*.ts" --include="*.svelte"
```

Must return zero results. If any remain, migrate them first.

- [ ] **Step 2: Verify zero remaining ITI imports in src/**

```bash
grep -rn "from \"iti\"" src/ --include="*.ts"
```

Must return zero results.

- [ ] **Step 3: Delete DI infrastructure files**

```bash
rm src/lib/shared/di/index.ts
rm src/lib/shared/di/container-types.ts
rm src/lib/shared/di/lazy-container.ts
rm src/lib/shared/di/lazy-containers.ts
rm -rf src/lib/shared/di/containers/
```

- [ ] **Step 4: Remove ITI dependency**

```bash
npm uninstall iti
```

- [ ] **Step 5: Clean up any remaining DI barrel exports**

Check if `src/lib/shared/di/` has any other files. If only empty directory remains, remove it. If there's a `pictograph-container.ts` export used elsewhere, move it to the pictograph domain.

- [ ] **Step 6: Final verification**

```bash
npm run check && npm run build
bash scripts/di-migration-progress.sh  # Should show 0 across all metrics
```

- [ ] **Step 7: Commit**

```bash
git commit -m "refactor(di): remove ITI dependency and all DI infrastructure

Deleted:
- src/lib/shared/di/index.ts (575 lines)
- src/lib/shared/di/container-types.ts (270 lines)
- src/lib/shared/di/containers/ (63 files)
- src/lib/shared/di/lazy-container.ts
- src/lib/shared/di/lazy-containers.ts
- iti dependency from package.json

All 372 services now accessed via module singleton getters.
Zero 'any' casts in service composition. Zero manual type intersections."
```

- [ ] **Step 8: Delete migration tracking script**

```bash
rm scripts/di-migration-progress.sh
git commit -m "chore: remove DI migration tracking script — migration complete"
```

---

## Note: createContext() — Future Pattern, Not Migration Target

The spec defines `createContext()` for component-scoped services (per-viewer, per-3D-scene). No current services use this pattern — all 372 services are app-wide singletons. This plan migrates them to module singleton getters.

`createContext()` becomes available for NEW services that need component-tree scoping. When a future service needs per-component instances (e.g., a viewer-specific animation engine), use this instead of a module singleton:

```typescript
import { createContext } from 'svelte';
export const [getAnimationEngine, setAnimationEngine] = createContext<IAnimationEngine>();
```

No migration task needed — this is a convention for new code, documented in the spec.

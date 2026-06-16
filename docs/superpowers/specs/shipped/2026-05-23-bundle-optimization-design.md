# Bundle Optimization: Three.js Leak + Conditional UI Lazy-Loading

**Date:** 2026-05-23
**Status:** CLOSED 2026-06-13 — all four fixes verified shipped.
**Impact:** ~600-800KB removed from initial MainApplication chunk

> **CLOSED 2026-06-13 (verified done).** Current-code sweep:
> - **Fix 1** — `SequenceViewerDrawerHost` is now a `{#await import(...)}` dynamic
>   import (MainApplication.svelte:646). ✅
> - **Fix 2** — none of the conditional components (FirstRunWizard, AuthDrawer,
>   voice-control trio, etc.) are statically imported any more; MainApplication
>   now has 14 `{#await import}` blocks. ✅
> - **Fix 3** — `import * as THREE` is down to 2 files across all of `src/`
>   (from 18). `shots.ts` uses `import { Vector3 }`. The 2 remainders are
>   `ThreeVolumetricFire.js` (explicitly exempted here — ported lib) and
>   `stage/locomotion/locomotion-controller.ts` (lazy stage chunk, off the
>   critical path — matches this spec's "deprioritize" bucket). ✅
> - **Fix 4** — both barrels (`sequence-engine/index.ts`, `render/core/index.ts`)
>   carry the exact `// @deprecated — all consumers use deep imports` comment
>   this spec recommended. ✅
>
> Optional future cleanup (not blocking, ~0 KB off initial payload): convert
> `locomotion-controller.ts` to named THREE imports for consistency. Original
> spec retained below for history.

---

## Problem

Three.js (~600KB minified) loads on every page visit, even for users who never open the 3D viewer. The static import chain:

```
MainApplication.svelte
  └─ SequenceViewerDrawerHost.svelte          (line 28, static import)
       └─ SequenceViewerOrchestrator.svelte   (line 9, static import)
            └─ viewer-3d-state.svelte.ts      (line 191, static import of createViewer3DState)
                 └─ shots.ts                  (line 32, static import)
                      └─ import * as THREE    (line 10 — pulls entire Three.js)
```

Additionally, MainApplication.svelte statically imports ~15 components that render conditionally (behind `{#if}` guards). Most users never see FirstRunWizard, AuthDrawer, CreateTutorialWizard, VoiceControl, etc. These add 100-200KB of parsed JS to the initial load.

A secondary issue: 18 files use `import * as THREE from "three"` when they only need 2-5 named exports each. Tree-shaking cannot eliminate unused Three.js code from these namespace imports.

Finally, two barrel files (`src/lib/shared/sequence-engine/index.ts` and `src/lib/shared/render/core/index.ts`) use `export * from` re-exports. Investigation shows no consumer imports from these barrel entry points directly (all use deep subpath imports), so the barrel files are dead code that could cause bundler confusion.

---

## Fix 1: Dynamic-import SequenceViewerDrawerHost (~600KB saved)

The viewer drawer is hidden until a user taps a sequence. It renders inside a Drawer component gated by `overlay.isOpen`. Making it a dynamic import is a 5-line change.

### Before

```svelte
<!-- src/lib/shared/application/components/MainApplication.svelte, line 28 -->
<script lang="ts">
  import SequenceViewerDrawerHost from "../../sequence-viewer/components/SequenceViewerDrawerHost.svelte";
</script>

<!-- line 627 -->
<SequenceViewerDrawerHost />
```

### After

```svelte
<!-- Remove the static import (line 28). Replace the usage (line 627): -->

{#await import("../../sequence-viewer/components/SequenceViewerDrawerHost.svelte") then mod}
  <mod.default />
{/await}
```

The `{#await}` pattern is already used in MainApplication for QuickFeedbackPanel (line 569), MyFeedbackDetail (line 574), and AnnouncementChecker (line 585). This follows the existing convention.

**Risk:** The drawer must be present in DOM before `openSequenceOverlay()` is called (it bootstraps from `?v=` URL params on mount). The `{#await}` resolves before the first paint in practice because the dynamic import triggers immediately at component creation, and Vite pre-bundles the chunk. The `bootstrapFromUrl()` call inside the drawer already waits for `authState.loading` to settle (line 166-171), which takes longer than the dynamic import resolution. No race condition.

**Verification:** Build, then inspect `stats.html` (set `ANALYZE=true`). The `vendor` chunk should drop by ~600KB, and a new async chunk containing SequenceViewerDrawerHost + its Three.js deps should appear.

---

## Fix 2: Convert conditional UI to dynamic imports (100-200KB saved)

These components in MainApplication are behind `{#if}` guards and only render for specific user states. Convert them from static imports to `{#await}` dynamic imports.

### Candidates

| Component | Guard condition | Lines |
|---|---|---|
| `FirstRunWizard` | `isAuthenticated && !firstRunState.isDone()` | 501, 507 |
| `CreateTutorialWizard` | `isAuthenticated && appEntryState.isCreateTutorial()` | 521 |
| `TutorialPrompt` | `isAuthenticated && appEntryState.isTutorialPrompt()` | 530 |
| `AuthDrawer` | `!isAuthenticated` | 538 |
| `HeyTikaListener` | `voiceControlEnabled` (opt-in, off by default) | 617 |
| `VoiceControlIndicator` | `voiceControlEnabled` | 618 |
| `VoiceCommandHelpOverlay` | `voiceControlEnabled` | 619 |
| `AttributionPrompt` | deferred, shows after engagement threshold | 599 |
| `PropSelectionSheet` | `propDrawerState.isOpen` (P key shortcut) | 601 |
| `InboxDrawer` | user interaction required | 567 |
| `PwaMigrationBanner` | legacy PWA users only | 482 |

### Pattern

For components with `{#if}` guards, nest the dynamic import inside the guard:

```svelte
<!-- Before -->
<script lang="ts">
  import FirstRunWizard from "../../onboarding/components/first-run/FirstRunWizard.svelte";
</script>

{#if isAuthenticated && (!firstRunState.isDone() || firstRunState.shouldShow)}
  <FirstRunWizard onComplete={...} onSkip={...} />
{/if}
```

```svelte
<!-- After (remove static import, wrap in {#await} inside the guard) -->
{#if isAuthenticated && (!firstRunState.isDone() || firstRunState.shouldShow)}
  {#await import("../../onboarding/components/first-run/FirstRunWizard.svelte") then mod}
    <mod.default onComplete={...} onSkip={...} />
  {/await}
{/if}
```

For voice control (3 components gated by the same flag):

```svelte
<!-- Before -->
{#if voiceControlEnabled}
  <HeyTikaListener />
  <VoiceControlIndicator />
  <VoiceCommandHelpOverlay />
{/if}
```

```svelte
<!-- After -->
{#if voiceControlEnabled}
  {#await import("../../voice-control/components/HeyTikaListener.svelte") then mod}
    <mod.default />
  {/await}
  {#await import("../../voice-control/components/VoiceControlIndicator.svelte") then mod}
    <mod.default />
  {/await}
  {#await import("../../voice-control/components/VoiceCommandHelpOverlay.svelte") then mod}
    <mod.default />
  {/await}
{/if}
```

### Components to keep static

These render unconditionally or nearly unconditionally and should stay as static imports:

- `MainInterface` -- always renders
- `BackgroundHost` -- always renders (background is on by default)
- `ErrorModal`, `ErrorToast` -- must be available for error handling
- `AchievementNotificationToast`, `XPToast` -- lightweight, render position only
- `WhatsNewChecker` -- lightweight checker
- `InboxSubscriptionProvider` -- sets up badge count listeners
- `SendSequenceSheetHost` -- lightweight, always mounted
- `AuthSheet`, `LegalSheet` -- route-based, lightweight

---

## Fix 3: Replace `import * as THREE` with named imports (10+ files)

`import * as THREE from "three"` creates a namespace object that prevents tree-shaking. Each file should import only the classes it uses.

### File-by-file changes

**shots.ts** -- uses only `Vector3`:
```ts
// Before (line 10)
import * as THREE from "three";

// After
import { Vector3 } from "three";
```
Then replace all `THREE.Vector3` with `Vector3` and update the `PerformerGroupBounds` and `Shot` interfaces to use `Vector3` directly.

**Viewer3DCamera.svelte** -- uses `PerspectiveCamera`, `Vector3`:
```ts
// Before
import * as THREE from "three";

// After
import { PerspectiveCamera, Vector3 } from "three";
```

**Scene3D.svelte** -- uses `Object3D`, `Vector3`, `PerspectiveCamera`:
```ts
import { Object3D, Vector3, PerspectiveCamera } from "three";
```

**OrbitControls.svelte** -- uses `Vector3`, `WebGLRenderer`, `PerspectiveCamera`:
```ts
import { Vector3, WebGLRenderer, PerspectiveCamera } from "three";
```

**ManualRaycaster.svelte** -- uses `Raycaster`, `Vector2`, `Vector3`, `Plane`, `Object3D`, `Mesh`, `Intersection`:
```ts
import { Raycaster, Vector2, Vector3, Plane, Object3D, Mesh } from "three";
import type { Intersection } from "three";
```

**DraggablePerformer.svelte** -- uses only `DoubleSide`:
```ts
import { DoubleSide } from "three";
```

**DevToolsPopover.svelte** -- uses `Vector3`:
```ts
import { Vector3 } from "three";
```

**TabletExhibit.svelte** -- uses `Color`:
```ts
import { Color } from "three";
```

**DiscoveryChamber.svelte** -- uses `Color`:
```ts
import { Color } from "three";
```

**ThreeVolumetricFire.js** -- uses many Three.js classes (ShaderMaterial, etc.). This file is a ported library and uses THREE extensively. Leave as-is or audit separately.

**ScreenshotInjector.ts** -- uses `Mesh`, `Texture`, `TextureLoader`, `SRGBColorSpace`, `MeshBasicMaterial`, `FrontSide`:
```ts
import { Mesh, Texture, TextureLoader, SRGBColorSpace, MeshBasicMaterial, FrontSide } from "three";
```

**PromoSceneManager.ts** -- uses 20+ Three.js classes. This is a self-contained scene manager that uses most of Three.js. Converting to named imports is still correct but the tree-shaking savings will be minimal since it genuinely uses many classes. Convert for consistency but deprioritize.

**Museum components** (EmptySlotIndicator, ThirdPersonTest, FramedSequence, PerformerPlatform, Pavilion, MuseumPerformerStation3D, TelekineticFormation3D) -- all behind the museum feature gate. Convert for consistency. These don't affect the main chunk because they're lazy-loaded with the museum module.

### Priority order

1. **shots.ts** -- this is on the critical path (MainApplication chunk). Fixing this alone unblocks tree-shaking for the main chunk.
2. **Viewer3DCamera, Scene3D, OrbitControls, ManualRaycaster, DraggablePerformer, DevToolsPopover** -- shared 3D components, loaded when 3D viewer activates.
3. **Archive + Promo + Museum files** -- feature-gated, lower priority.

---

## Fix 4: Replace barrel `export *` with named exports

Two barrel files use `export * from` re-exports:

### `src/lib/shared/sequence-engine/index.ts`

```ts
// Before (line 10)
export * from "@tka/sequence-engine";

// After — named re-exports matching what @tka/sequence-engine actually exports:
export type {
  IOrientationCalculator,
  IOrientationPropagator,
} from "@tka/sequence-engine";
export {
  OrientationCalculator,
  OrientationPropagator,
} from "@tka/sequence-engine";
export type { ITransitionGraph } from "@tka/sequence-engine";
export {
  TransitionGraph,
  setLetterTransitionGraph,
  getLetterTransitionGraph,
} from "@tka/sequence-engine";
export type {
  ISequenceDataProvider,
  LetterVariationData,
} from "@tka/sequence-engine";
export {
  deriveReversals,
  type StepReversals,
} from "@tka/sequence-engine";
// Re-export all domain types explicitly
export * from "@tka/sequence-engine/core/types/sequence-engine-types.js";
```

**However:** Investigation shows no consumer imports from `$lib/shared/sequence-engine` (the barrel). All 8 consumers use deep subpath imports like `$lib/shared/sequence-engine/constraints/types` or `@tka/sequence-engine/loop`. This barrel file is effectively dead. The safest fix is to add a comment documenting that it's unused, or delete it after confirming no dynamic consumers exist.

### `src/lib/shared/render/core/index.ts`

```ts
// Before (line 11)
export * from "@tka/render-core";
```

Same situation: all 13 consumers use deep imports like `$lib/shared/render/core/types` or `$lib/shared/render/core/calculations/beta-offset`. The barrel is unused.

**Recommendation:** Add `// @deprecated — all consumers use deep imports; remove when confirmed safe` to both files. Do not delete yet -- a grep may miss dynamic imports or test files outside `src/`.

---

## Implementation Order

| Phase | Fix | Effort | Savings | Risk |
|---|---|---|---|---|
| 1 | Dynamic-import SequenceViewerDrawerHost | 5 min | ~600KB | Low |
| 2 | Named imports in shots.ts | 10 min | Enables tree-shaking | None |
| 3 | Conditional UI dynamic imports | 30 min | 100-200KB | Low |
| 4 | Named imports in remaining 3D files | 20 min | Marginal (already lazy) | None |
| 5 | Barrel file cleanup | 5 min | Prevents future regressions | None |

**Total estimated savings:** 700-800KB from the initial JavaScript payload.

---

## Verification Plan

1. Run `ANALYZE=true npm run build` before and after. Compare the `vendor` chunk size and the MainApplication entry chunk.
2. `npm run check` must pass (no type errors from import changes).
3. Open the app, verify the sequence viewer drawer still opens when tapping a sequence card.
4. Verify `?v=` URL bootstrap still works (the SequenceViewerDrawerHost bootstrap-from-URL flow).
5. Verify FirstRunWizard still appears for new users.
6. Verify voice control components still load when enabled in settings.

# Reverse Import Elimination: shared/ → features/

Date: 2026-05-03
Status: Draft
Scope: Resolve 528 layering violations where shared/ imports from features/

## Problem

The `shared/` layer is supposed to be the foundation that features build on. Features depend on shared, shared depends on nothing above it. Currently, 528 import lines in `shared/` reach up into `features/`, creating hidden circular dependencies.

The worst offenders:

| shared/ module | features/ dependency | Import count |
|---|---|---|
| animation-engine | compose | 122 |
| sequence-viewer | compose, create, browse | 88 |
| settings | feedback | 44 |
| browse | browse (circular self) | 32 |
| 3d | compose | 14 |
| foundation | create | 18 |
| coordinators | compose | 14 |
| onboarding | create | 14 |

### Why this matters

1. **The dependency graph is a lie.** `shared/animation-engine` cannot function without `features/compose`. If you tried to use the animation engine without compose present, it wouldn't compile.

2. **AI agents can't trust boundaries.** When an agent is working in `features/compose` and wants to know what it might break, it has to search all of `shared/` too, because shared reaches back into compose. The feature boundary provides no isolation.

3. **Refactoring risk is invisible.** Renaming a type in `features/create/shared/domain/models/StepData.ts` could break `shared/foundation`, `shared/sequence-viewer`, `shared/render`, `shared/comparison`, and 6 other shared modules. Nothing about the file's location suggests it has that blast radius.

## Root Cause Analysis

The reverse imports fall into five distinct categories, each with a different fix:

### Category 1: Core domain types that outgrew their feature (165 import lines)

`StepData` is used in 241 files across the entire codebase. `StartPositionData` is used in 91 files. Both live in `features/create/shared/domain/models/`. These aren't "create" concepts. They're foundational data types on the same level as `SequenceData` (which correctly lives in `shared/foundation`).

Similarly, `LOOPComponent`, `Period`, `PropState`, `CsvModels`, and `LOCATION_ANGLES` are domain primitives that multiple features and shared modules depend on.

These types started in `create` because that's where they were first needed, and nobody moved them when they became universal.

**Fix: Relocate to shared/foundation.**

Example:

```
BEFORE:
  features/create/shared/domain/models/StepData.ts       (241 consumers)
  features/create/shared/domain/models/StartPositionData.ts (91 consumers)
  features/compose/shared/domain/types/PropState.ts       (101 consumers)

AFTER:
  shared/foundation/domain/models/StepData.ts
  shared/foundation/domain/models/StartPositionData.ts
  shared/foundation/domain/models/PropState.ts
```

The move is mechanical: relocate the file, update all import paths. `StepData` only depends on `PictographData` which already lives in shared. Zero logic changes.

Impact: eliminates ~83 reverse import lines.

### Category 2: Animation infrastructure that belongs in shared (122 import lines)

`shared/animation-engine` imports 122 things from `features/compose`: the `AnimationPlaybackController`, `SequenceAnimationOrchestrator`, `AnimationPathCache`, `IAnimationRenderer`, `ISVGGenerator`, `ITrailCapturer`, `AnimationPanelState`, `PropState`, and several Svelte components (AnimationCanvas, TransportControls, AnimationControlsPanel).

The animation engine was likely built inside `compose` and then partially extracted to `shared/` without completing the extraction. The types and services it depends on stayed behind.

**Fix: Complete the extraction.** Move the animation types, interfaces, and core services from `compose` into `shared/animation-engine`. The interfaces (`IAnimationRenderer`, `ISVGGenerator`, `ITrailCapturer`) are genuinely polymorphic and belong at the shared level. The concrete implementations that are compose-specific can stay in compose and register themselves.

Detailed migration:

```
Move to shared/animation-engine/domain/types/:
  PropState, PropStates
  AdditionalLayerProps, AdditionalLayerRenderData
  VideoExportProgress, PreRenderProgress
  AnimationPanelState (the type, not the factory)
  PlaybackMode, PlaybackModeToggle

Move to shared/animation-engine/services/:
  AnimationPlaybackController
  SequenceAnimationOrchestrator
  AnimationPathCache
  SequenceFramePreRenderer

Already correctly placed (keep):
  IAnimationRenderer → already has shared consumers, keep in shared
  ISVGGenerator → same
  ITrailCapturer → same
```

The Svelte component imports (AnimationCanvas, TransportControls) are harder. These are UI components that arguably belong in a shared component library or should be injected via slots/snippets rather than direct imports. This is the one area that requires design work, not just file moves.

Impact: eliminates ~122 reverse import lines.

### Category 3: Browse infrastructure (74 import lines)

`shared/browse` imports from `features/browse`. This is the most obviously wrong one: a module named `browse` exists in both layers, and the shared one reaches into the feature one.

The imports are: `getBrowseLoader`, `PublicSequencesLoader`, `calculateDifficultyLevel`, `BrowseSortMethod`, filter chips (LOOPFilterChip, LengthFilterChip, etc.), and browse UI components (BrowseToolbar, BrowseFilterBar, BrowseGrid, BrowseSidebar, BrowsePanel).

**Fix: Merge the two browse modules.** Either move everything into `shared/browse` (if browse is truly a shared capability) or move everything into `features/browse` (if shared/browse shouldn't exist). Given that the browse engine is used by multiple features (gallery, sequence picker modals, profile pages), the shared location is correct, and the feature-level browse components should move down.

Impact: eliminates ~74 reverse import lines.

### Category 4: Feedback/versioning types (50 import lines)

`shared/settings`, `shared/inbox`, `shared/application`, and `shared/onboarding` import `ChangelogEntry`, `AppVersion`, `Contributor`, `UserNotification`, and the `version-service` from `features/feedback`.

These are app-wide concepts (version info, notifications, changelog) that happen to live in a feature called "feedback" but are consumed everywhere.

**Fix: Extract to shared.** Create `shared/versioning/` for version/changelog types and `shared/notifications/` for notification types. The `version-service` that fetches release notes is arguably shared infrastructure, not a feature.

Impact: eliminates ~50 reverse imports eliminated.

### Category 5: Shared utilities stranded in features (22 import lines)

`simplifyRepeatedWord`, `word-cyclic-equivalence-detector`, `LOCATION_ANGLES`, `isSeamlesslyLoopable`, `ResponsiveLayoutManager`, `EffortId`, `EFFORTS`. These are utility functions and constants used across multiple shared modules but living in features.

**Fix: Relocate to appropriate shared modules.** Word utilities go to `shared/foundation/utils/`. Math constants go to `shared/foundation/domain/constants/`. Layout management goes to `shared/navigation/` or `shared/layout/`. Effort types go to `shared/foundation/domain/` or a new `shared/effort/` if the concept is cross-cutting enough.

Impact: eliminates ~22 reverse import lines.

### Remaining: Component-level coupling (~177 import lines)

The remaining imports are Svelte components imported from features into shared modules. These are the hardest to fix because moving a component might drag its own dependencies. The main offenders:

- `shared/animation-engine` importing `AnimationCanvas`, `TransportControls`, `AnimationControlsPanel` from `compose`
- `shared/sequence-viewer` importing `TKAWordGlyph` from `choreo-card`
- `shared/navigation` importing `MainApplication` from `compose`
- `shared/onboarding` importing step components from `create`

Three strategies for component coupling:

1. **Move the component to shared** if it's genuinely reusable (e.g., `TKAWordGlyph` is used by many features and probably belongs in `shared/components/`)
2. **Use Svelte snippets/slots** to inject feature-specific UI into shared shells, inverting the dependency
3. **Accept the coupling** for components that are genuinely feature-specific but consumed by a shared coordinator (e.g., onboarding step components that reference specific features)

Strategy 3 is an option because some shared modules (like onboarding) are "shared" in the directory sense but actually do need to know about specific features. The question is whether the module belongs in shared at all.

## Phases

### Phase 1: Core Domain Types (est. 2 hours)

Move `StepData`, `StartPositionData`, `PropState`, `PropStates`, `LOOPComponent`, `Period`, `CsvModels`, and `LOCATION_ANGLES` to `shared/foundation/domain/`. Update all 400+ consumer import paths.

This is fully mechanical. The types have no logic, only depend on other shared types, and the move is a path change with zero behavior impact.

Validation: `tsc --noEmit`, `vitest run`.

Impact: ~83 reverse imports eliminated. The foundation layer becomes self-contained.

### Phase 2: Animation Infrastructure (est. 4 hours)

Move animation types and services from `compose` to `shared/animation-engine`. This is the biggest phase because the animation services have internal dependencies that need to be untangled.

Approach: start with the pure types (AnimationPanelState, PlaybackMode, etc.), then move services bottom-up (AnimationPathCache first, then PlaybackController, then Orchestrator).

Validation: `tsc --noEmit`, `vitest run`, manual check of animation playback in dev.

Impact: ~122 reverse imports eliminated.

### Phase 3: Browse Unification (est. 2 hours)

Merge `features/browse` shared components into `shared/browse`. Move `getBrowseLoader`, `PublicSequencesLoader`, filter chips, and toolbar/grid components.

Impact: ~74 reverse imports eliminated.

### Phase 4: Feedback/Versioning Extraction (est. 1 hour)

Create `shared/versioning/` and `shared/notifications/`. Move types and version-service.

Impact: ~50 reverse imports eliminated.

### Phase 5: Utility Relocation (est. 1 hour)

Move stranded utilities to appropriate shared modules.

Impact: ~22 reverse imports eliminated.

### Phase 6: Component Coupling Audit (est. 2 hours)

Review the remaining ~177 component imports. For each, decide: move to shared, use slots/snippets, or accept the coupling with a documented exception. Some shared modules may be reclassified as features if they don't actually serve multiple consumers.

### Phase 7: Lint Rule (est. 30 min)

Add an ESLint rule that prevents `shared/` from importing `features/`. This prevents regression. Exceptions can be allowed via eslint-disable comments with a reason, but the default is enforcement.

## Expected Outcomes

| Metric | Before | After |
|---|---|---|
| shared → features imports | 528 | ~50 (documented exceptions) |
| Core domain types in features | 8+ | 0 |
| shared/ modules that compile independently | ~10 | ~40 |
| ESLint layering rule | none | enforced |

## Risks

1. **Animation service extraction may reveal tight coupling.** The AnimationPlaybackController may depend on compose-specific state that doesn't generalize cleanly. If so, the controller itself might need to stay in compose, with only its interface in shared.

2. **Import path churn.** Moving StepData affects 241 files. A find-and-replace handles it, but the diff will be large and touch many features. Best done in isolation on a clean branch.

3. **Browse unification scope.** Merging the two browse modules might reveal that some browse components depend on feature-specific state that doesn't belong in shared. Case-by-case evaluation needed.

4. **Component injection patterns.** Using Svelte snippets/slots to invert component dependencies is the cleanest solution but requires refactoring the consuming shared components to accept injected content rather than importing it directly. This is design work, not just mechanical moves.

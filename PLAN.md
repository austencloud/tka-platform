# Plan: Eliminate DI Container Refresh Pain

## Problem Statement

Every time Claude edits a service file, the DI container rebuilds, causing a full page refresh (~5 seconds). During complex implementations with 20+ edits, this means minutes of the app being unusable.

**Root cause:** 462 files import from `$lib/shared/di`. Any service change propagates:
```
ServiceFile.ts → *-container.ts → di/index.ts → 462 files → full refresh
```

## Investigation Findings

### High-Churn Services (Oct 2024 - Present)

| Service | Edits | Container | Actually Needs DI? |
|---------|-------|-----------|-------------------|
| ArrowRotationCalculator | 33 | pictograph | No - pure math |
| ImageCompositionService | 29 | render | No - pure logic |
| MotionQueryHandler | 29 | pictograph | Maybe - loads CSV data |
| ArrowPositioningOrchestrator | 27 | pictograph | No - orchestration |
| ArrowSvgLoader | 25 | pictograph | Yes - HMR cache |
| ArrowLifecycleManager | 25 | pictograph | No - orchestration |

**Pattern:** 80%+ of high-churn services are pure calculation/orchestration with no real DI need.

### What Actually Needs DI (Singletons with State)

Only **4 services** genuinely require singleton management:

1. **ArrowSvgLoader** - HMR-aware SVG cache (1000+ SVGs)
2. **PropSvgLoader** - HMR-aware prop cache
3. **RotationOverrideManager** - localStorage persistence
4. **PictographMemoryCache** - In-memory LRU cache (2000 entries)

Everything else is stateless and could be direct imports.

### Public API Surface

**Pictograph container exports used externally:** 13 services out of 50+
**Render container exports used externally:** 2 services (sequenceRenderer, imageComposer)

The vast majority of services are internal implementation details.

---

## The Plan

### Phase 1: Extract Pure Calculators (Low Risk)

**Goal:** Remove 15+ stateless services from DI. These are the highest-churn files.

**Services to extract:**

```
src/lib/shared/pictograph/
├── arrow/positioning/calculation/
│   ├── ArrowRotationCalculator.ts      → direct export
│   ├── ArrowAdjustmentCalculator.ts    → direct export
│   ├── ArrowLocationCalculator.ts      → direct export
│   ├── DashLocationCalculator.ts       → direct export
│   ├── HandpathDirectionCalculator.ts  → direct export
│   └── DirectionalTupleProcessor.ts    → direct export
├── grid/
│   ├── GridModeDeriver.ts              → direct export
│   └── GridPositionDeriver.ts          → direct export
└── prop/
    ├── OrientationCalculator.ts        → direct export
    └── BetaDetector.ts                 → direct export
```

**Pattern change:**
```typescript
// BEFORE (triggers container rebuild)
import { container } from "$lib/shared/di";
const calc = container.items.orientationCalculator;

// AFTER (no container involvement)
import { orientationCalculator } from "$lib/shared/pictograph/prop/services";
```

**Implementation:**
1. Add direct singleton export at bottom of each service file
2. Update all 12 external consumers to use direct import
3. Remove from pictograph-container.ts
4. Keep internal pictograph usage as-is initially (gradual migration)

**Estimated effort:** 2-3 hours
**Risk:** Low - pure functions with no state

---

### Phase 2: Extract Render Utilities (Low Risk)

**Services to extract:**

```
src/lib/shared/render/services/implementations/
├── DimensionCalculator.ts       → direct export
├── LayoutCalculator.ts          → direct export
├── FilenameGenerator.ts         → direct export
├── Canvas2DDirectRenderer.ts    → direct export
├── LayerCompositor.ts           → direct export
└── StepNumberRenderer.ts        → direct export
```

**Estimated effort:** 1-2 hours
**Risk:** Low - stateless utilities

---

### Phase 3: Singleton Wrappers (Medium Risk)

**Goal:** Keep singletons but remove from container dependency chain.

**Pattern:**
```typescript
// arrow-svg-loader.ts
let instance: ArrowSvgLoader | null = null;

// Preserve HMR cache
if (import.meta.hot) {
  instance = import.meta.hot.data?.arrowSvgLoader ?? null;
  import.meta.hot.dispose((data) => {
    data.arrowSvgLoader = instance;
  });
}

export function getArrowSvgLoader(): ArrowSvgLoader {
  if (!instance) {
    instance = new ArrowSvgLoader(
      new ArrowPathResolver(),
      new ArrowSvgParser(),
      new ArrowSvgColorTransformer()
    );
  }
  return instance;
}

// Direct export for convenience
export const arrowSvgLoader = getArrowSvgLoader();
```

**Services requiring this pattern:**
1. ArrowSvgLoader
2. PropSvgLoader
3. RotationOverrideManager
4. PictographMemoryCache
5. PictographBlobCache

**Estimated effort:** 2-3 hours
**Risk:** Medium - must preserve HMR behavior exactly

---

### Phase 4: Collapse Internal Dependencies (Medium Risk)

**Goal:** The pictograph container has 7 layers of internal dependencies. Flatten them.

Instead of:
```typescript
// Container wires everything
.add({ arrowRotationCalculator: () => new ArrowRotationCalculator(
  deps.specialPlacer,
  deps.rotationAngleOverrideKeyGenerator,
  deps.handpathDirectionCalculator
)})
```

Do:
```typescript
// Service creates its own dependencies (or receives via constructor)
export class ArrowRotationCalculator {
  private specialPlacer = new SpecialPlacer(...);
  private keyGenerator = new RotationAngleOverrideKeyGenerator();
  private handpathCalc = new HandpathDirectionCalculator();
}
```

**Trade-off:** Slightly more memory (multiple instances) vs. no DI overhead.

For stateless services, multiple instances are fine. For stateful ones (caches), use the singleton pattern from Phase 3.

**Estimated effort:** 4-6 hours
**Risk:** Medium - need to trace all dependency chains

---

### Phase 5: Remove Empty Containers (Cleanup)

After phases 1-4, many containers will be nearly empty. Remove them:

1. Delete `pictograph-container.ts` (replaced by direct imports)
2. Update `di/index.ts` to not import deleted containers
3. Services still needing DI stay in reduced containers

**Estimated effort:** 1 hour
**Risk:** Low - just cleanup

---

## What We're NOT Changing

Keep these in DI (they have cross-cutting dependencies or genuine singleton needs):

- `authenticator` - Firebase auth state
- `userRepository` - User data access
- `persistenceService` - Dexie database
- `sequenceRenderer` - Orchestrates many services
- `animationEngine` - Complex state machine

---

## Expected Outcome

### Before
- Edit ArrowRotationCalculator.ts → container rebuilds → 462 files invalidate → 5s refresh
- Claude makes 20 edits → 100+ seconds of refreshes

### After
- Edit ArrowRotationCalculator.ts → only files importing it refresh → <1s HMR
- Claude makes 20 edits → most are instant HMR, occasional full refresh for true DI services

**Realistic improvement:** 60-80% fewer full refreshes during typical Claude editing sessions.

---

## Execution Order

| Phase | Effort | Risk | Payoff |
|-------|--------|------|--------|
| 1. Pure Calculators | 2-3h | Low | High - these are 50%+ of edits |
| 2. Render Utilities | 1-2h | Low | Medium |
| 3. Singleton Wrappers | 2-3h | Medium | High - enables Phase 4 |
| 4. Collapse Dependencies | 4-6h | Medium | High - eliminates container chain |
| 5. Cleanup | 1h | Low | Low - just cleanup |

**Total:** 10-15 hours of focused work

---

## Decision Point

**Option A: Full execution (Phases 1-5)**
- 10-15 hours of refactoring
- Major improvement to DI refresh pain
- Some risk of breakage requiring debugging

**Option B: Partial execution (Phases 1-2 only)**
- 3-5 hours of refactoring
- Moderate improvement (stateless services only)
- Very low risk

**Option C: Accept current state**
- 0 hours
- No improvement
- No risk

---

## Recommendation

**Start with Phase 1 only.** It's the highest-value, lowest-risk change. The 10 services extracted there account for a huge portion of edits. See if that's enough relief before committing to the full plan.

If Phase 1 helps noticeably, continue to Phase 2-3. Phase 4 is the most work and should only be done if 1-3 aren't sufficient.

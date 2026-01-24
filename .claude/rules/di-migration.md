# Dependency Injection Migration

## Status: IN PROGRESS

**Goal: Eliminate ALL DI containers from the codebase.**

The ITI dependency injection system is being removed entirely. This document tracks progress and provides instructions for continuing the migration.

---

## Why We're Removing DI

1. **HMR is painfully slow** - Container changes trigger 5+ second rebuilds
2. **Over-engineered for a solo project** - Never needed to swap implementations
3. **Indirection makes debugging harder** - `container.items.X` obscures the call chain
4. **Circular dependency complexity** - Container layering added hundreds of lines of ceremony

---

## The Target Architecture

Every service should:
1. Be a class in `services/implementations/ServiceName.ts`
2. Have an interface in `services/contracts/IServiceName.ts`
3. Export a singleton instance at the bottom of the implementation file
4. Be imported directly where needed

```typescript
// At bottom of ServiceName.ts
export const serviceName = new ServiceName(dependency1, dependency2);

// In consumer files
import { serviceName } from '$lib/path/to/ServiceName';
```

---

## Migration Progress

### Containers to Eliminate

| Container | Status | Notes |
|-----------|--------|-------|
| `pictograph-container.ts` | 🟡 IN PROGRESS | Core services done, ~20 more to migrate |
| `core-container.ts` | ⬜ PENDING | |
| `data-container.ts` | ⬜ PENDING | |
| `build-container.ts` | ⬜ PENDING | |
| `render-container.ts` | ⬜ PENDING | |
| `navigation-container.ts` | ⬜ PENDING | |
| `animator-container.ts` | ⬜ PENDING | |
| `explore-container.ts` | ⬜ PENDING | |
| `share-container.ts` | ⬜ PENDING | |
| `library-container.ts` | ⬜ PENDING | |
| (all others) | ⬜ PENDING | |

### Pictograph Container - Detailed Status

**✅ Migrated (have direct exports):**
- `csvLoader` (CsvLoader.ts)
- `csvParser` (CsvParser.ts)
- `csvPictographParser` (CSVPictographParser.ts)
- `gridPositionDeriver` (GridPositionDeriver.ts)
- `letterQueryHandler` (LetterQueryHandler.ts)
- `motionQueryHandler` (MotionQueryHandler.ts)
- `gridRenderer` (GridRenderer.ts)
- `arrowRenderer` (ArrowRenderer.ts)
- `svgPreloader` (SvgPreloader.ts)
- `startPositionDeriver` (StartPositionDeriver.ts)

**⬜ Still in container (need migration):**
- Arrow orchestration: `arrowPositioningOrchestrator`, `arrowLifecycleManager`, `arrowDataProcessor`, `arrowAdjustmentProcessor`, `arrowGridCoordinator`, `arrowCoordinateTransformer`, `arrowQuadrantCalculator`
- Arrow calculation: `arrowAdjustmentCalculator`, `arrowLocationCalculator`, `arrowRotationCalculator`, `arrowLocator`, `dashLocationCalculator`, `handpathDirectionCalculator`, `screenSpaceAdjustmentTransformer`
- Arrow key generation: `arrowPlacementKeyGenerator`, `attributeKeyGenerator`, `specialPlacementOriKeyGenerator`, `rotationAngleOverrideKeyGenerator`, `turnsTupleKeyGenerator`
- Arrow placement: `arrowPlacer`, `defaultPlacer`, `specialPlacer`, `specialPlacementDataProvider`, `letterClassifier`, `turnsTupleGenerator`, `specialPlacementLookup`, `rotationOverrideManager`
- Grid: `gridModeDeriver`
- Prop: `betaDetector`, `orientationCalculator`, `propPlacer`, `propSvgLoader`
- Coordination: `pictographCoordinator`, `pictographPreparer`
- Directional: `directionalTupleCalculator`, `directionalTupleProcessor`, `quadrantIndexCalculator`

---

## How to Migrate a Service

### Step 1: Add direct singleton export

At the bottom of the service implementation file:

```typescript
// ============================================================================
// DIRECT SINGLETON EXPORT
// ============================================================================
// Import dependencies that also have direct exports
import { dependency1 } from '../other/Dependency1';
import { dependency2 } from '../other/Dependency2';

export const myService = new MyService(dependency1, dependency2);
```

### Step 2: Update all consumers

Find all usages of `container.items.myService` and replace with direct import:

```bash
# Find consumers
grep -r "container.items.myService" src/
```

```typescript
// Before
import { container } from "$lib/shared/di";
const myService = container.items.myService;

// After
import { myService } from "$lib/path/to/MyService";
```

### Step 3: Update composition root

In `src/lib/shared/di/index.ts`, other containers may depend on this service. Update them to use direct imports too.

### Step 4: Remove from container

Once no consumers use `container.items.myService`, remove it from the container file.

### Step 5: Delete container when empty

When a container has no more services, delete the file and remove it from `di/index.ts`.

---

## Dependency Order Matters

When migrating, work bottom-up through the dependency tree:

1. **Leaf services first** - Services with no dependencies on other container services
2. **Then their dependents** - Services that only depend on already-migrated services
3. **Finally orchestrators** - High-level services that depend on many others

Example for pictograph:
1. First: `GridPositionDeriver` (no deps)
2. Then: `StartPositionDeriver` (depends on GridPositionDeriver)
3. Then: consumers of StartPositionDeriver

---

## Testing After Migration

After migrating services:

```bash
npm run check   # TypeScript errors
npm run build   # Build succeeds
```

Then test HMR by editing a migrated service file - refresh should be instant, not 5 seconds.

---

## Questions?

If unsure whether a service should be migrated or how to handle a complex dependency chain, ask the user rather than guessing.

# .steps Consumer Migration Tracker

> Tracks incremental migration of `.steps` references from direct array access
> to the compositional model (blueSoloProp + redSoloProp + stepPairings).

**Total references:** ~173 files
**Strategy:** Dual-storage during transition. `steps[]` continues to work. Migrate consumers at any pace.

---

## Wave Summary

| Wave | Files | Risk | Description |
|------|-------|------|-------------|
| 1 | ~149 | Low | Read-only (iterate, count, map, access by index) |
| 2 | ~35 | Medium | Create/modify sequences (spread, createSequenceData) |
| 3 | ~7 | High | Direct manipulation (push, pop, splice, reassign) |
| Skip | ~20 | N/A | Our new composition code, external packages, tests, scripts |

---

## Wave 1: Read-Only (149 files)

These only read `.steps` — iterate, count, map, filter, access by index.
Migration: the transitional getter means these work unchanged. Migrate last (or never — Chunk 8 removes `steps` and forces migration).

### Key modules:
- Browse/Gallery (16 files)
- Sequence Viewer (12 files)
- Animation Engine (11 files)
- Analysis/Logic (30+ files)
- Compose (29 files)
- Lab tabs (15 files)
- Train, Landing, 3D, etc.

### No action needed until Chunk 8.

---

## Wave 2: Write/Create (35 files)

These create or modify sequences with `steps` in the constructor/spread.
Migration: update to also populate compositional fields when creating sequences.

### Key files:
- `features/create/generate/state/generate-actions.svelte.ts`
- `features/create/shared/services/implementations/SequenceExtender.ts`
- `features/create/shared/services/implementations/DurationPatternManager.ts`
- `features/create/shared/services/implementations/RotationDirectionPatternManager.ts`
- `features/create/shared/services/implementations/TurnPatternManager.ts`
- Step operations: `DurationHandler.ts`, `OrientationHandler.ts`, `TurnsHandler.ts`
- `features/create/spell/services/implementations/WordSequenceGenerator.ts`
- `features/compose/services/implementations/TrailPathGenerator.ts`
- `features/landing/services/implementations/SequenceDataSerializer.ts`
- `features/choreo-card/services/implementations/SequenceToEntryConverter.ts`

### No action needed until Chunk 8.
The factory `createSequenceData()` already passes through compositional fields.

---

## Wave 3: Direct Manipulation (7 files)

These mutate `.steps` directly (push, pop, splice). Need refactoring.

1. `features/create/spell/services/implementations/RandomSequenceGenerator.ts`
2. `features/compose/services/implementations/SequenceAnimationOrchestrator.ts`
3. `features/create/shared/services/implementations/SequenceExporter.ts`
4. `shared/coordinators/sequence-handoff.svelte.ts`
5. `features/compose/timeline/services/implementations/grid-calculations.ts`
6. `features/gallery-generator/services/implementations/MotionSignatureGenerator.ts`
7. `features/gallery-generator/services/implementations/EndlessSpinnerOrchestrator.ts`

### No action needed until Chunk 8.

---

## Skip List

These are either our new composition code or external:
- `shared/foundation/services/implementations/` (our new code)
- `tests/unit/` (our new tests)
- `mcp-server/`, `mcp-server-pkg/`, `packages/` (external)
- `scripts/` (tooling)
- `routes/admin/` (admin pages)

---

## Migration Status

**Current phase: Chunk 3 complete (bridge in place)**

All `.steps` references continue to work via dual storage.
Consumer migration (Chunk 7) can happen incrementally at any pace.
Chunk 8 (remove `steps` field) requires ALL consumers migrated first.

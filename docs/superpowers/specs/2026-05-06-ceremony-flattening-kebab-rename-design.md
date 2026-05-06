# Enterprise Ceremony Flattening + Kebab-Case Rename

Date: 2026-05-06
Status: Draft
Scope: Complete Phases 4-6 of enterprise-ceremony-retirement.md + codebase-wide PascalCase→kebab-case rename for .ts files
Depends on: enterprise-ceremony-retirement.md (Phases 1-3 already ~97% complete)

## Problem

Phases 1-3 of the enterprise ceremony retirement successfully removed 97% of 1:1 interfaces. But the directory structure and file naming still reflect the old enterprise pattern:

- 121 `implementations/` directories remain (4.7% reduction from 127)
- 85 `contracts/` directories remain (74 are empty shells)
- 532 class files still live at `services/implementations/ClassName.ts`
- 1,389 `.ts` files use PascalCase instead of the project's kebab-case ESLint rule
- 372 factory getters still return interface types or wrap stateless classes
- 328+ stateless classes that should be plain function modules

Every new file added to the codebase has to choose between matching the old pattern (PascalCase, nested in implementations/) or the correct pattern (kebab-case, flat in services/). Both exist, creating inconsistency.

## Goals

1. Flatten all `implementations/` and empty `contracts/` directories
2. Rename all PascalCase `.ts` files to kebab-case
3. Convert stateless classes to plain function modules
4. Simplify getters for stateful classes (return concrete type)
5. Update all imports across the codebase
6. Eliminate ~1,389 ESLint filename-naming-convention warnings
7. Zero regressions — typecheck + build must pass after every module

## Non-Goals

- Rewriting service logic (purely structural)
- Touching Svelte components (already PascalCase per convention, excluded from ESLint rule)
- Eliminating the 11 genuinely polymorphic interfaces
- Changing the factory getter pattern for stateful services (just simplifying return types)

## Classification System

Each service unit is classified by AST analysis before any transformation:

| Classification | Criteria | Action |
|---|---|---|
| `stateless` | Zero instance fields, zero constructor params | Convert to function module, delete getter |
| `stateless-deps` | Only constructor fields are singleton service refs | Convert to function module with direct getter imports, delete getter |
| `stateless-cache` | Only fields are Map/Set/simple caches | Convert to function module with module-scoped cache, delete getter |
| `stateful` | Real instance state beyond above categories | Keep class, flatten dir, rename kebab, simplify getter |
| `polymorphic` | 2+ implementations of same interface | Keep interface + class + getter, flatten dir, rename kebab |

## Transformation Rules

### Per Service Unit

**Step 1 — Flatten directory**

Move `services/implementations/*.ts` up to `services/`. If `implementations/` has subdirectories (e.g., `detection/`, `comparison/`), move those subdirs up to `services/` as well. Delete empty `implementations/` directories.

For `contracts/` directories:
- If empty: delete
- If contains only `types.ts` (no interface files): move `types.ts` up to `services/types.ts`, delete `contracts/`
- If contains polymorphic interfaces: keep as-is

Before:
```
feature/
  services/
    contracts/
      types.ts
    implementations/
      FooService.ts
      detection/
        PatternDetector.ts
  getFooService.ts
```

After step 1:
```
feature/
  services/
    contracts/
      types.ts
    FooService.ts
    detection/
      PatternDetector.ts
  getFooService.ts
```

**Step 2 — Rename to kebab-case**

All PascalCase `.ts` files in the module: service classes, domain models, state files, getters, utilities.

- `FooService.ts` → `foo-service.ts`
- `getFooService.ts` → `get-foo-service.ts` (if surviving)
- `PatternDetector.ts` → `pattern-detector.ts`
- `AudioStateManager.svelte.ts` → `audio-state-manager.svelte.ts`
- `Deck.ts` → `deck.ts`

**Step 3 — Classify and convert**

For `stateless` / `stateless-deps` / `stateless-cache`:

Before:
```typescript
// FooService.ts
export class FooService {
  doThing(x: string): number { return this.helper(x); }
  private helper(x: string): number { return x.length; }
}

// getFooService.ts
let instance: FooService | null = null;
export function getFooService(): FooService {
  return instance ??= new FooService();
}
```

After:
```typescript
// foo-service.ts
export function doThing(x: string): number { return helper(x); }
function helper(x: string): number { return x.length; }
```

For `stateless-deps`:

Before:
```typescript
export class BarService {
  constructor(private readonly dep: OtherService) {}
  process(x: string) { return this.dep.transform(x); }
}
```

After:
```typescript
import { getOtherService } from '../get-other-service';
export function process(x: string) { return getOtherService().transform(x); }
```

For `stateless-cache`:

Before:
```typescript
export class CacheService {
  private cache = new Map<string, Result>();
  lookup(key: string) { return this.cache.get(key); }
}
```

After:
```typescript
const cache = new Map<string, Result>();
export function lookup(key: string) { return cache.get(key); }
```

For `stateful`:
- Keep class, remove any remaining `implements IFoo`
- Simplify getter to return concrete type
- Rename both files to kebab-case

For `polymorphic`:
- Keep interface + classes + getter
- Flatten dir, rename to kebab-case only

**Step 4 — Rewrite imports**

Every file that imports from an old path gets updated:
- Internal module imports: relative paths updated for new file locations
- Cross-module imports: `$lib/features/foo/services/implementations/Bar` → `$lib/features/foo/services/bar`
- Getter imports: deleted for stateless conversions, path-updated for stateful
- Consumer call sites for stateless: `getFoo().method(args)` → `import { method } from '...'`

**Step 5 — Typecheck gate**

`npm run check` must pass before the module is considered done. If errors surface, the agent fixes them before moving on.

### Non-Service Files

Domain models, state files, utility files, and other PascalCase `.ts` files that aren't service classes get steps 2 + 4 only (rename + import rewrite). No class conversion needed.

## Execution Architecture

### Phase A: Inventory (today, May 6)

Build `scripts/ceremony-inventory.mjs` that:

1. Walks `src/` and catalogs every `.ts` file
2. For service classes: parses AST to classify (stateless/stateful/polymorphic)
3. For all PascalCase files: computes the kebab-case target name
4. Maps every import consumer for each file
5. Generates planned actions per file
6. Flags edge cases: dynamic imports, re-exports, cross-package references

Output:
- `scripts/ceremony-manifest.json` — machine-readable manifest
- `scripts/ceremony-dry-run.md` — human-readable summary with per-module breakdown

### Phase B: Execution (May 9)

8-10 subagents in 4 waves. Each agent receives its module's manifest slice and follows the transformation rules above.

**Wave 1 — Small isolated modules (5 per batch, 2 batches):**
- Batch A: archive, campground, festivals, hall-of-shame, fuse
- Batch B: arena, assemble-lab, gallery-generator, moderation, poi

**Wave 2 — Medium modules (4 per batch, 3 batches):**
- Batch C: browse, community, connect, feedback
- Batch D: compose, learn, levels, library
- Batch E: choreo-card, hand-paths, lab, sticker-lab

**Wave 3 — Large/complex modules (variable):**
- Batch F: create (largest module, solo)
- Batch G: museum, village, landing, store, watch, write
- Batch H: tika, voice-sessions, train, video, retro, skel2tka

**Wave 4 — Shared infrastructure:**
- Batch I: `src/lib/shared/` — animation-engine, 3d, sequence-viewer, composition-root
- Batch J: Remaining non-feature PascalCase files

**Wave ordering rationale:** Features first, shared last. The ESLint boundary rule prevents shared/ from importing features/. So renaming feature internals doesn't break shared code. When shared files rename in Wave 4, feature imports of `$lib/shared/...` paths get updated — but feature internal structure is already clean.

Full `npm run check` + `npm run build` between each wave. `npm run check` after each module within a wave.

### Phase C: Verification (May 9, after execution)

1. Full `npm run build` — clean
2. `npm run check` — zero errors
3. ESLint re-run — filename-naming-convention warnings should drop from 1,389 to ~0
4. Grep for orphaned `implementations/` and `contracts/` directories — should be zero (except polymorphic interfaces that keep contracts/)
5. Grep for remaining PascalCase `.ts` imports — should be zero
6. Spot-check 5 converted stateless services: verify function exports work, no broken call sites

## Subagent Protocol

Each subagent receives this instruction set along with its module manifest:

### Input
- Module path (e.g., `src/lib/features/browse/`)
- Manifest slice: every file in the module with classification + planned actions + consumer list

### Execution Rules
1. Read each file before modifying it
2. Follow the 5-step transformation order: flatten → rename → convert → rewrite imports → typecheck
3. Process one service unit at a time, not all at once
4. For stateless classification: verify the manifest's classification by reading the actual class before converting. If it has state the manifest missed, keep it as stateful.
5. For consumer rewrites: grep to find all consumers, don't rely solely on the manifest (it may miss dynamic or computed imports)
6. After all service units in the module are done, run `npm run check`
7. If typecheck fails: fix the errors. If unfixable, report back with details.
8. Commit the module with message: `refactor(<module>): flatten dirs + kebab rename + convert stateless classes`

### Hard Stop Conditions
- Typecheck fails and fix isn't obvious after 2 attempts
- Service has runtime side effects in constructor beyond dep injection
- Consumer pattern doesn't match known rewrite rules (stored service refs, passed as arguments, reactive state holding service)
- File is imported by a package outside `src/` (e.g., `packages/render-composition/`)
- More than 3 unexpected edge cases in a single module

Agent reports these back for manual cleanup.

### Output
- Per-module commit
- Summary: files moved, renamed, converted, deleted, imports rewritten, edge cases encountered

## Risk Mitigation

| Risk | Mitigation |
|---|---|
| Misclassified stateful as stateless | Manifest pre-classifies via AST. Agent re-verifies before converting. TypeScript catches broken state access. |
| Missed import consumer | `npm run check` catches at compile time. Agent greps to find consumers beyond manifest. |
| Cross-module import breakage | Wave ordering isolates blast radius. Typecheck between waves. |
| Dynamic imports missed | Manifest flags `import()` expressions. Agent handles manually. |
| Svelte component imports break | Same rewrite rules — Svelte imports from `.ts` files. |
| Git history fragmentation | One commit per module. `git log --follow` traces renames. |
| Merge conflict with uncommitted work | Run after committing all current work. Clean git status before execution. |
| packages/ directory references | Hard stop condition — reported for manual handling. Cross-package imports need coordinated update. |

## Expected Outcomes

| Metric | Before | After |
|---|---|---|
| `implementations/` directories | 121 | 0 |
| `contracts/` directories (empty, no files) | 74 | 0 |
| `contracts/` directories (types.ts only, no interfaces) | ~10 | ~10 (kept, hold shared types) |
| `contracts/` directories (polymorphic interfaces) | ~11 | ~11 (kept) |
| PascalCase `.ts` files | 1,389 | 0 |
| ESLint filename warnings | 1,389 | 0 |
| Stateless class files | 328+ | 0 |
| Getter files (stateless, deleted) | ~170 | 0 |
| Getter files (stateful, simplified) | ~200 | ~200 (concrete return types) |
| Total `.ts` files eliminated | — | ~500-700 |
| Total lines of ceremony removed | — | ~15,000-25,000 |

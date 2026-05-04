# Naming Convention Enforcement

Date: 2026-05-03
Status: Draft
Scope: Standardize file naming across 4,678 source files and prevent drift with lint rules

## Problem

Three naming conventions coexist with no enforced standard:

| Convention | Count | Percentage | Used for |
|-----------|-------|-----------|----------|
| PascalCase (`AdminChallengeManager.ts`) | 2,831 | 60.8% | Components, old-style classes |
| kebab-case (`arena-repository.ts`) | 752 | 16.2% | Utilities, Phase 5 functional modules |
| camelCase (`getArenaOrchestrator.ts`) | 179 | 3.8% | get* factory files (being retired) |
| Special (`types.ts`, `+page.svelte`) | 915 | 19.2% | Framework conventions |

The ceremony retirement (Phase 5) converts PascalCase class files to kebab-case functional modules. But 708 PascalCase implementation files remain. New code has no guidance on which to use.

A senior dev would ask: *"What's your naming convention?"* Answer today: *"It depends on when the file was written and which AI conversation created it."*

### The actual confusion

When a developer needs to find a service, they don't know whether to look for:
- `ArenaRepository.ts` (PascalCase class)
- `arena-repository.ts` (kebab-case module)
- `getArenaRepository.ts` (camelCase factory)

All three exist for different services in the same codebase. After ceremony retirement completes, the PascalCase class files and camelCase factories go away — but only if there's a clear rule for what replaces them.

## Decision

**kebab-case for all non-component TypeScript files.** PascalCase only for `.svelte` components (Svelte convention).

| File type | Convention | Example |
|-----------|-----------|---------|
| Svelte components | PascalCase | `CreatorCard.svelte` |
| State files | kebab-case | `arena-state.svelte.ts` |
| Service/utility modules | kebab-case | `arena-repository.ts` |
| Type/model files | kebab-case | `arena-models.ts` |
| Constants | kebab-case | `arena-constants.ts` |
| Test files | kebab-case (match source) | `arena-repository.test.ts` |
| SvelteKit routes | Framework convention | `+page.svelte`, `+server.ts` |

This aligns with:
- Phase 5 direction (already converting to kebab-case)
- SvelteKit conventions (routes, hooks)
- The broader JS/TS ecosystem (node_modules are all kebab-case)
- Svelte community norms (PascalCase components, kebab everything else)

## Migration Strategy

This is NOT a big-bang rename. It's a "new code follows the rule, old code gets renamed when touched" approach — with lint enforcement to prevent new violations.

**Phase A** — Lint rule (immediate)

Add an ESLint rule (or custom script in CI) that flags:
- New `.ts` files (not `.svelte`) using PascalCase
- Exception: files that export a class (during transition period)

```jsonc
// .eslintrc or eslint.config.js
{
  "rules": {
    "check-file/filename-naming-convention": ["error", {
      "**/*.ts": "KEBAB_CASE",
      "**/*.svelte.ts": "KEBAB_CASE",
      "**/*.svelte": "PASCAL_CASE"
    }]
  }
}
```

Package: `eslint-plugin-check-file` (lightweight, no deps).

**Phase B** — Rename as-touched (ongoing)

When ceremony retirement dissolves a class into a functional module, the rename happens naturally:
- `services/implementations/ArenaOrchestrator.ts` → `services/arena-orchestrator.ts`

No separate rename PR needed — it's part of the dissolution.

**Phase C** — Batch rename residuals (after ceremony retirement completes)

Once all classes are dissolved, any remaining PascalCase `.ts` files get a batch rename:
```bash
# Script to identify remaining violations
find src/lib -name "*.ts" -not -name "*.svelte.ts" -not -path "*+*" | \
  grep -E '/[A-Z][a-zA-Z]+\.ts$'
```

Each rename is a `git mv` + import update. Tools like `ts-morph` can automate the import rewrites.

## Directory Naming

Directories are already mostly kebab-case. Enforce:

| Level | Convention | Example |
|-------|-----------|---------|
| Feature dirs | kebab-case | `features/voice-sessions/` |
| Sub-dirs | kebab-case | `services/`, `domain/`, `components/` |
| Component dirs (rare) | kebab-case | `components/session-panel/` |

No PascalCase directories.

## What about `types.ts` vs domain model files?

Current state: 114 `types.ts` files. Many are grab-bags of unrelated types dumped together (largest: 868 lines).

Convention going forward:
- Domain models: `{feature}-models.ts` (e.g., `arena-models.ts`)
- Service contracts/options: `{feature}-types.ts` or inline with the service
- Shared types used across features: in `shared/` with a descriptive name

The 83 `services/contracts/types.ts` files are ceremony artifacts. When the `contracts/` directories dissolve, their types either:
1. Move into the service file that uses them (if used by 1 file)
2. Move to a feature-level `types.ts` or `{feature}-models.ts` (if shared within feature)
3. Move to `shared/` (if shared across features)

## Success Metrics

| Metric | Before | After Phase A | After Phase C |
|--------|--------|---------------|---------------|
| PascalCase .ts files | 2,831 | 2,831 (no new ones) | ~0 (only legacy) |
| kebab-case .ts files | 752 | growing | ~3,500 |
| "Which convention?" confusion | constant | none for new code | none |
| Lint violations on PR | n/a | 0 allowed | 0 allowed |

## Baseline

Measured 2026-05-03 after enabling `check-file/filename-naming-convention` as `"warn"`:

- **1,497** violations across `src/**/*.ts` (excluding `src/routes/` — SvelteKit `+page.ts`/`+layout.ts`/`+server.ts` are framework convention)
- Many PascalCase files live in globally-ignored ESLint paths (tests, scripts, tools, archive)
- Rule set to `"warn"` — visible in editor and lint output, does not block CI
- Flip to `"error"` once ceremony retirement brings count below ~50

## Non-Goals

- Renaming Svelte components (they stay PascalCase)
- Renaming during this spec (ceremony retirement handles the bulk)
- Enforcing specific word order in filenames
- Changing directory structure (separate concern)

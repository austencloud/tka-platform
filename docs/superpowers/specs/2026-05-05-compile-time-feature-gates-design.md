# Compile-Time Feature Gates

**Date:** 2026-05-05
**Status:** Approved
**Goal:** Reduce production build time from ~3 min to ~1 min by excluding unshipped features at compile time.

## Problem

4,715 source files (1,933 Svelte components). Only 3 modules ship to users: create, browse, feedback (622 files). The remaining 1,452 feature files compile on every production build despite never reaching users.

Vite 7 + Rolldown is already the bundler. The bottleneck is Svelte 5 compiler transforms — each `.svelte` file passes through the compiler regardless of whether it appears in the final bundle. Excluding files at resolve time skips both compilation and bundling.

## Architecture

### Feature Registry

**File:** `src/config/feature-flags.ts`

Single source of truth. Three tiers:

| Tier | Behavior | Features |
|------|----------|----------|
| **core** | Always enabled, cannot be disabled | `create`, `browse`, `feedback` |
| **shipped** | Enabled by default, can be disabled per-build | (empty — features move here as they ship) |
| **dev** | Enabled in dev, disabled in prod builds | All other modules (~25) |

The registry exports a `getEnabledFeatures()` function that reads `process.env` overrides and returns the set of enabled feature IDs.

Environment variable interface:

```bash
npm run dev                      # All features enabled (dev mode)
npm run build                    # Core + shipped only (fast production)
BUILD_ALL=true npm run build     # All features (full production)
BUILD_MUSEUM=true npm run build  # Core + shipped + museum
```

### Vite Plugin: `vite-plugin-feature-gate`

**File:** `src/config/vite-plugin-feature-gate.ts`

A Vite plugin that operates at the `resolveId` hook level. For disabled features, it intercepts dynamic imports targeting feature module entry points and resolves them to a stub module.

**How it works:**

1. At plugin init, reads the feature registry to determine which features are disabled for this build.
2. Builds a map from feature module paths to feature IDs (derived from ModuleRenderer's import paths).
3. On each `resolveId` call, checks if the import target matches a disabled feature's module entry point.
4. If matched, returns a virtual module ID (`\0feature-stub`) that resolves to:
   ```ts
   export default null;
   ```
5. ModuleRenderer already handles `null` returns from `loadModule()` — shows the error/reload UI.

**What gets stubbed (per disabled feature):**

- The feature's root module component (e.g., `features/museum/MuseumModule.svelte`)
- This prevents Rolldown from traversing the entire feature subtree
- Shared/ imports are NOT affected — they compile normally since multiple shipped features use them

**Route exclusion:**

The plugin also stubs route-level `+page.svelte` files for disabled feature routes:

| Route pattern | Gated by |
|---------------|----------|
| `src/routes/test/**` | `dev` tier (disabled in prod) |
| `src/routes/admin/**` | `admin` feature flag |
| `src/routes/demo/**` | `dev` tier |
| `src/routes/(dev)/**` | `dev` tier |
| `src/routes/1989/**` | `retro` feature flag |
| `src/routes/1995/**` | `retro` feature flag |
| `src/routes/1998/**` | `retro` feature flag |
| `src/routes/2003/**` | `retro` feature flag |
| `src/routes/endless-spinner/**` | `dev` tier |
| `src/routes/hall-of-shame/**` | `hall-of-shame` feature flag |
| `src/routes/render-pictographs/**` | `dev` tier |
| `src/routes/grant-feature/**` | `dev` tier |
| `src/routes/embed/**` | `dev` tier |

For route stubs, the plugin returns a minimal SvelteKit page component:

```svelte
<p>Feature not available in this build.</p>
```

### ModuleRenderer Changes

**None.** The plugin operates below ModuleRenderer's awareness. Dynamic imports resolve to stubs transparently. ModuleRenderer's existing null-handling covers the case.

The museum idle-preload (lines 66-77) will harmlessly preload a null stub in production. No harm, but could add a `__FEATURE_MUSEUM__` guard if desired — not required.

### Feature-to-Path Mapping

Derived from `ModuleRenderer.svelte` lines 92-168. Each module entry's dynamic import path maps to a feature ID:

```ts
const FEATURE_MODULE_MAP: Record<string, string[]> = {
  create: ["features/create/"],           // core
  browse: ["features/browse/"],           // core
  feedback: ["features/feedback/"],       // core
  social: ["features/social/"],
  learn: ["features/learn/"],
  premium: ["features/premium/"],
  compose: ["features/compose/"],
  train: ["features/train/"],
  "choreo-card": ["features/choreo-card/"],
  write: ["features/write/"],
  admin: ["features/admin/"],
  arena: ["features/arena/"],
  watch: ["features/watch/"],
  retro: ["features/retro/"],
  museum: ["features/museum/"],
  archive: ["features/archive/"],
  moderation: ["features/moderation/"],
  festivals: ["features/festivals/"],
  levels: ["features/levels/"],
  "hand-paths": ["features/hand-paths/"],
  video: ["features/video/"],
  lab: ["features/lab/"],
  tika: ["features/tika/"],
  "prop-tracking-lab": ["features/train/prop-tracking-lab/"],
  "promo-generator": ["features/promo-generator/"],
  "gallery-generator": ["features/gallery-generator/"],
  "hall-of-shame": ["features/hall-of-shame/"],
  fuse: ["features/fuse/"],
  "assemble-lab": ["features/assemble-lab/"],
  "loop-labeler": ["features/loop-labeler/"],
  connect: ["features/connect/"],
  settings: ["features/settings/"],
};
```

The plugin only stubs the MODULE ENTRY POINT (the root `.svelte` file imported by ModuleRenderer), not every file in the feature directory. This is sufficient because Rolldown only traverses files reachable from entry points — if the entry is stubbed, the subtree is unreachable and gets excluded.

### Composition Root Handling

`src/lib/shared/composition-root/index.ts` registers feature implementations into shared service slots. Analysis shows ALL current registrations are either core (used by browse/create/feedback) or consumed by shared/ components:

| Registration | Imports from | Used by |
|---|---|---|
| `registerPublicIndexSyncerFactory` | `features/library/` | browse (core) |
| `registerTagMigrator` | `features/library/` | browse (core) |
| `registerFeedbackTesterWorkflow` | `features/feedback/` | feedback (core) |
| `registerVideoExportOrchestratorFactory` | `features/compose/` | shared/animation-engine |
| `registerLoopDetector` | `features/create/` | create (core) |
| `registerLoopDisplayResolver` | `features/loop-labeler/` | shared/ (ChoreoCard, ImageComposer, AnimatorCanvas) |
| `registerEndlessSpinnerOrchestratorFactory` | `features/landing/` | shared/ (landing page, animation-engine) |

**Decision: composition root stays unchanged.** These imports pull individual TS classes/functions, not full Svelte module trees. The build cost is negligible — it's the 1,933 Svelte component compilations that dominate build time, not a handful of service class imports.

### Navigation Filtering

`MODULE_DEFINITIONS` (used by sidebar/nav) should filter out disabled modules so users don't see nav items for features that aren't in the build.

**Approach:** Export the enabled feature set as a runtime constant via `define`. Navigation config filters `MODULE_DEFINITIONS` against it. Disabled modules don't appear in sidebar.

## What This Does NOT Do

- No runtime feature flags (no conditional rendering, no LaunchDarkly)
- No changes to shared/ layer (compiles fully — it's the substrate for all features)
- No monorepo, no workspace packages, no structural changes
- No changes to dev server behavior (all features always available in dev)
- No changes to HMR behavior

## Expected Impact

| Metric | Before | After (core-only build) |
|--------|--------|------------------------|
| Feature files compiled | 2,074 | ~622 |
| Svelte components compiled | ~1,933 | ~650 (est.) |
| Build time | ~3 min | ~1 min (est.) |
| Dev server | unchanged | unchanged |

Estimates based on compilation being roughly proportional to file count. Actual savings depend on how much of shared/ is only reachable via disabled features.

## Files Created/Modified

| File | Action |
|------|--------|
| `src/config/feature-flags.ts` | Create — feature registry |
| `src/config/vite-plugin-feature-gate.ts` | Create — Vite resolve plugin |
| `vite.config.ts` | Modify — add plugin + define constants |
| `src/lib/shared/composition-root/index.ts` | No change — all registrations are core |
| `src/lib/shared/navigation/config/module-definitions.ts` | Modify — filter disabled modules |

## Verification

1. `npm run build` with no env vars → builds only core features, completes in ~1 min
2. `BUILD_ALL=true npm run build` → builds everything, matches current ~3 min
3. `npm run dev` → all features available, no change from current behavior
4. Production deploy of core-only build → create, browse, feedback work; other module nav items hidden

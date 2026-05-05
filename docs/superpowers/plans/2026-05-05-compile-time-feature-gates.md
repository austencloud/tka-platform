# Compile-Time Feature Gates Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reduce production build time from ~3 min to ~1 min by excluding unshipped feature modules at Vite resolve time.

**Architecture:** A feature registry defines which modules are core/shipped/dev. A Vite plugin intercepts `resolveId` for disabled features and returns a stub module so the Svelte compiler never processes excluded component trees. ModuleRenderer and nav filter out disabled modules at runtime via `define` constants.

**Tech Stack:** Vite 7 plugin API (`resolveId`, `load`, virtual modules), `process.env` build flags, Rolldown dead-code elimination.

---

## File Structure

| File | Action | Responsibility |
|------|--------|----------------|
| `src/config/feature-flags.ts` | Create | Feature registry: tiers, env var parsing, `isFeatureEnabled()` |
| `src/config/vite-plugin-feature-gate.ts` | Create | Vite plugin: resolve-time stubbing of disabled feature modules |
| `vite.config.ts` | Modify | Wire plugin + `define` constants for runtime checks |
| `src/lib/shared/navigation/config/module-definitions.ts` | Modify | Filter `MODULE_DEFINITIONS` by enabled features |
| `src/lib/shared/modules/ModuleRenderer.svelte` | Modify | Guard museum preload behind feature flag |

---

### Task 1: Feature Registry

**Files:**
- Create: `src/config/feature-flags.ts`

- [ ] **Step 1: Create the feature registry**

```ts
// src/config/feature-flags.ts

export type FeatureTier = "core" | "shipped" | "dev";

export interface FeatureDefinition {
  id: string;
  tier: FeatureTier;
  modulePaths: string[];
  routePatterns?: string[];
}

const FEATURES: FeatureDefinition[] = [
  // Core — always enabled, cannot be disabled
  { id: "create", tier: "core", modulePaths: ["features/create/"] },
  { id: "browse", tier: "core", modulePaths: ["features/browse/"] },
  { id: "feedback", tier: "core", modulePaths: ["features/feedback/"] },

  // Shipped — enabled by default, can be disabled per-build
  // (move features here as they ship to users)

  // Dev — enabled in dev, disabled in prod builds
  { id: "social", tier: "dev", modulePaths: ["features/social/"], routePatterns: [] },
  { id: "learn", tier: "dev", modulePaths: ["features/learn/"] },
  { id: "premium", tier: "dev", modulePaths: ["features/premium/"] },
  {
    id: "compose",
    tier: "dev",
    modulePaths: ["features/compose/"],
  },
  { id: "train", tier: "dev", modulePaths: ["features/train/"] },
  { id: "choreo-card", tier: "dev", modulePaths: ["features/choreo-card/"] },
  { id: "write", tier: "dev", modulePaths: ["features/write/"] },
  {
    id: "admin",
    tier: "dev",
    modulePaths: ["features/admin/"],
    routePatterns: ["src/routes/admin/"],
  },
  { id: "arena", tier: "dev", modulePaths: ["features/arena/"] },
  { id: "watch", tier: "dev", modulePaths: ["features/watch/"] },
  {
    id: "retro",
    tier: "dev",
    modulePaths: ["features/retro/"],
    routePatterns: [
      "src/routes/1989/",
      "src/routes/1995/",
      "src/routes/1998/",
      "src/routes/2003/",
    ],
  },
  { id: "museum", tier: "dev", modulePaths: ["features/museum/"] },
  { id: "archive", tier: "dev", modulePaths: ["features/archive/"] },
  { id: "moderation", tier: "dev", modulePaths: ["features/moderation/"] },
  { id: "festivals", tier: "dev", modulePaths: ["features/festivals/"] },
  { id: "levels", tier: "dev", modulePaths: ["features/levels/"] },
  { id: "hand-paths", tier: "dev", modulePaths: ["features/hand-paths/"] },
  { id: "video", tier: "dev", modulePaths: ["features/video/"] },
  { id: "lab", tier: "dev", modulePaths: ["features/lab/"] },
  { id: "tika", tier: "dev", modulePaths: ["features/tika/"] },
  { id: "settings", tier: "dev", modulePaths: ["features/settings/"] },
  { id: "connect", tier: "dev", modulePaths: ["features/connect/"] },
  { id: "fuse", tier: "dev", modulePaths: ["features/fuse/"] },
  { id: "assemble-lab", tier: "dev", modulePaths: ["features/assemble-lab/"] },
  { id: "loop-labeler", tier: "dev", modulePaths: ["features/loop-labeler/"] },
  { id: "promo-generator", tier: "dev", modulePaths: ["features/promo-generator/"] },
  { id: "gallery-generator", tier: "dev", modulePaths: ["features/gallery-generator/"] },
  { id: "hall-of-shame", tier: "dev", modulePaths: ["features/hall-of-shame/"] },
  { id: "landing", tier: "dev", modulePaths: ["features/landing/"] },
];

const DEV_ROUTE_PATTERNS = [
  "src/routes/test/",
  "src/routes/(dev)/",
  "src/routes/demo/",
  "src/routes/endless-spinner/",
  "src/routes/render-pictographs/",
  "src/routes/grant-feature/",
  "src/routes/embed/",
  "src/routes/hall-of-shame/",
];

export function isFeatureEnabled(featureId: string): boolean {
  const feature = FEATURES.find((f) => f.id === featureId);
  if (!feature) return true;

  if (feature.tier === "core") return true;

  // BUILD_ALL=true enables everything
  if (process.env.BUILD_ALL === "true") return true;

  // Individual override: BUILD_MUSEUM=true
  const envKey = `BUILD_${featureId.toUpperCase().replace(/-/g, "_")}`;
  if (process.env[envKey] === "true") return true;
  if (process.env[envKey] === "false") return false;

  // In dev mode (not production build), enable everything
  if (process.env.NODE_ENV !== "production") return true;

  // In production: only core and shipped are enabled by default
  return feature.tier === "shipped";
}

export function getEnabledFeatures(): Set<string> {
  return new Set(FEATURES.filter((f) => isFeatureEnabled(f.id)).map((f) => f.id));
}

export function getDisabledFeatureModulePaths(): string[] {
  return FEATURES.filter((f) => !isFeatureEnabled(f.id)).flatMap(
    (f) => f.modulePaths
  );
}

export function getDisabledRoutePatterns(): string[] {
  const patterns: string[] = [];

  // Add feature-specific route patterns for disabled features
  for (const feature of FEATURES) {
    if (!isFeatureEnabled(feature.id) && feature.routePatterns) {
      patterns.push(...feature.routePatterns);
    }
  }

  // Add dev-only route patterns if any dev feature is disabled
  // (these routes are dev-tier by nature, not tied to a specific feature)
  const anyDevDisabled = FEATURES.some(
    (f) => f.tier === "dev" && !isFeatureEnabled(f.id)
  );
  if (anyDevDisabled) {
    patterns.push(...DEV_ROUTE_PATTERNS);
  }

  return patterns;
}

export function getEnabledFeaturesDefineMap(): Record<string, string> {
  const map: Record<string, string> = {};
  for (const feature of FEATURES) {
    const key = `__FEATURE_${feature.id.toUpperCase().replace(/-/g, "_")}__`;
    map[key] = JSON.stringify(isFeatureEnabled(feature.id));
  }
  return map;
}

export { FEATURES };
```

- [ ] **Step 2: Commit**

```bash
git add src/config/feature-flags.ts
git commit -m "feat(build): add compile-time feature registry with tier system"
```

---

### Task 2: Vite Plugin

**Files:**
- Create: `src/config/vite-plugin-feature-gate.ts`

- [ ] **Step 1: Create the Vite plugin**

```ts
// src/config/vite-plugin-feature-gate.ts

import type { Plugin } from "vite";
import {
  getDisabledFeatureModulePaths,
  getDisabledRoutePatterns,
} from "./feature-flags";

const STUB_MODULE_ID = "\0feature-gate-stub";
const STUB_SVELTE_MODULE_ID = "\0feature-gate-stub.svelte";

export function featureGatePlugin(): Plugin {
  const disabledPaths = getDisabledFeatureModulePaths();
  const disabledRoutes = getDisabledRoutePatterns();

  let isProduction = false;

  return {
    name: "feature-gate",
    enforce: "pre",

    configResolved(config) {
      isProduction = config.command === "build";
    },

    resolveId(source, importer) {
      // Only gate during production builds
      if (!isProduction) return null;

      // Nothing to gate
      if (disabledPaths.length === 0 && disabledRoutes.length === 0)
        return null;

      // Normalize the resolved path for comparison
      const normalizedSource = source.replace(/\\/g, "/");

      // Check if this import targets a disabled feature module
      for (const disabledPath of disabledPaths) {
        if (normalizedSource.includes(disabledPath)) {
          // Return appropriate stub based on file extension
          if (
            normalizedSource.endsWith(".svelte") ||
            (importer && normalizedSource.includes("features/"))
          ) {
            return STUB_SVELTE_MODULE_ID;
          }
          return STUB_MODULE_ID;
        }
      }

      // Check if this is a disabled route file
      if (importer) {
        const normalizedImporter = importer.replace(/\\/g, "/");
        for (const routePattern of disabledRoutes) {
          const normalizedPattern = routePattern.replace(/\\/g, "/");
          if (normalizedImporter.includes(normalizedPattern)) {
            if (normalizedSource.endsWith(".svelte")) {
              return STUB_SVELTE_MODULE_ID;
            }
          }
        }
      }

      return null;
    },

    load(id) {
      if (id === STUB_MODULE_ID) {
        return "export default null;";
      }
      if (id === STUB_SVELTE_MODULE_ID) {
        return "export default null;";
      }
      return null;
    },
  };
}
```

- [ ] **Step 2: Commit**

```bash
git add src/config/vite-plugin-feature-gate.ts
git commit -m "feat(build): add Vite plugin for compile-time feature gating"
```

---

### Task 3: Wire Plugin into Vite Config

**Files:**
- Modify: `vite.config.ts:590-600` (define block) and `vite.config.ts:598-819` (plugins array)

- [ ] **Step 1: Add imports at top of vite.config.ts**

Add after the existing imports (after line 12 `import { visualizer } from "rollup-plugin-visualizer";`):

```ts
import { featureGatePlugin } from "./src/config/vite-plugin-feature-gate";
import { getEnabledFeaturesDefineMap } from "./src/config/feature-flags";
```

- [ ] **Step 2: Add feature flag define constants**

In the `define` block (around line 591), add the feature flag constants by spreading `getEnabledFeaturesDefineMap()`:

```ts
define: {
    __DEFINES__: JSON.stringify({}),
    __APP_VERSION__: JSON.stringify(packageJson.version),
    "import.meta.env.VITE_APP_VERSION": JSON.stringify(packageJson.version),
    __PWA_ENABLED__: process.env.DISABLE_PWA !== "true",
    ...getEnabledFeaturesDefineMap(),
  },
```

- [ ] **Step 3: Add featureGatePlugin to plugins array**

Add `featureGatePlugin()` as the FIRST plugin in the array (before `sveltekit()`), so it intercepts resolves before SvelteKit processes them:

```ts
plugins: [
    featureGatePlugin(),
    // realtime-bpm-analyzer fix...
    {
      name: "fix-realtime-bpm-analyzer",
      // ...existing code
```

- [ ] **Step 4: Run build to verify plugin loads without errors**

Run: `npm run build`
Expected: Build completes. If `NODE_ENV=production`, disabled features should be stubbed. Console should show no new errors.

- [ ] **Step 5: Commit**

```bash
git add vite.config.ts
git commit -m "feat(build): wire feature gate plugin into Vite config"
```

---

### Task 4: Filter Navigation for Disabled Modules

**Files:**
- Modify: `src/lib/shared/navigation/config/module-definitions.ts`

- [ ] **Step 1: Add feature-aware module filter**

Add a `declare` block for the compile-time constants and a filtering function after the existing `MODULE_DEFINITIONS` array (after line 314):

```ts
// Compile-time feature flags injected by Vite define
declare const __FEATURE_SOCIAL__: boolean;
declare const __FEATURE_LEARN__: boolean;
declare const __FEATURE_PREMIUM__: boolean;
declare const __FEATURE_COMPOSE__: boolean;
declare const __FEATURE_TRAIN__: boolean;
declare const __FEATURE_CHOREO_CARD__: boolean;
declare const __FEATURE_WRITE__: boolean;
declare const __FEATURE_ADMIN__: boolean;
declare const __FEATURE_ARENA__: boolean;
declare const __FEATURE_WATCH__: boolean;
declare const __FEATURE_RETRO__: boolean;
declare const __FEATURE_MUSEUM__: boolean;
declare const __FEATURE_ARCHIVE__: boolean;
declare const __FEATURE_MODERATION__: boolean;
declare const __FEATURE_FESTIVALS__: boolean;
declare const __FEATURE_LEVELS__: boolean;
declare const __FEATURE_HAND_PATHS__: boolean;
declare const __FEATURE_VIDEO__: boolean;
declare const __FEATURE_LAB__: boolean;
declare const __FEATURE_TIKA__: boolean;
declare const __FEATURE_SETTINGS__: boolean;
declare const __FEATURE_FEEDBACK__: boolean;

const FEATURE_FLAG_MAP: Record<string, boolean> = {
  social: typeof __FEATURE_SOCIAL__ !== "undefined" ? __FEATURE_SOCIAL__ : true,
  learn: typeof __FEATURE_LEARN__ !== "undefined" ? __FEATURE_LEARN__ : true,
  premium: typeof __FEATURE_PREMIUM__ !== "undefined" ? __FEATURE_PREMIUM__ : true,
  compose: typeof __FEATURE_COMPOSE__ !== "undefined" ? __FEATURE_COMPOSE__ : true,
  train: typeof __FEATURE_TRAIN__ !== "undefined" ? __FEATURE_TRAIN__ : true,
  choreo_card: typeof __FEATURE_CHOREO_CARD__ !== "undefined" ? __FEATURE_CHOREO_CARD__ : true,
  write: typeof __FEATURE_WRITE__ !== "undefined" ? __FEATURE_WRITE__ : true,
  admin: typeof __FEATURE_ADMIN__ !== "undefined" ? __FEATURE_ADMIN__ : true,
  arena: typeof __FEATURE_ARENA__ !== "undefined" ? __FEATURE_ARENA__ : true,
  watch: typeof __FEATURE_WATCH__ !== "undefined" ? __FEATURE_WATCH__ : true,
  retro: typeof __FEATURE_RETRO__ !== "undefined" ? __FEATURE_RETRO__ : true,
  museum: typeof __FEATURE_MUSEUM__ !== "undefined" ? __FEATURE_MUSEUM__ : true,
  archive: typeof __FEATURE_ARCHIVE__ !== "undefined" ? __FEATURE_ARCHIVE__ : true,
  moderation: typeof __FEATURE_MODERATION__ !== "undefined" ? __FEATURE_MODERATION__ : true,
  festivals: typeof __FEATURE_FESTIVALS__ !== "undefined" ? __FEATURE_FESTIVALS__ : true,
  levels: typeof __FEATURE_LEVELS__ !== "undefined" ? __FEATURE_LEVELS__ : true,
  "hand-paths": typeof __FEATURE_HAND_PATHS__ !== "undefined" ? __FEATURE_HAND_PATHS__ : true,
  video: typeof __FEATURE_VIDEO__ !== "undefined" ? __FEATURE_VIDEO__ : true,
  lab: typeof __FEATURE_LAB__ !== "undefined" ? __FEATURE_LAB__ : true,
  tika: typeof __FEATURE_TIKA__ !== "undefined" ? __FEATURE_TIKA__ : true,
  settings: typeof __FEATURE_SETTINGS__ !== "undefined" ? __FEATURE_SETTINGS__ : true,
  feedback: typeof __FEATURE_FEEDBACK__ !== "undefined" ? __FEATURE_FEEDBACK__ : true,
};

function isModuleEnabled(moduleId: string): boolean {
  return FEATURE_FLAG_MAP[moduleId] ?? true;
}

export const ENABLED_MODULE_DEFINITIONS = MODULE_DEFINITIONS.filter((m) =>
  isModuleEnabled(m.id)
);
```

- [ ] **Step 2: Update consumers to use ENABLED_MODULE_DEFINITIONS**

Search for imports of `MODULE_DEFINITIONS` and determine which should use `ENABLED_MODULE_DEFINITIONS` instead — specifically the sidebar/nav rendering code. The definition array itself stays unchanged (used by migration logic, module loading).

Run: `grep -r "MODULE_DEFINITIONS" src/lib/ --include="*.ts" --include="*.svelte" -l` and update nav-rendering consumers.

- [ ] **Step 3: Commit**

```bash
git add src/lib/shared/navigation/config/module-definitions.ts
git commit -m "feat(build): filter nav modules by compile-time feature flags"
```

---

### Task 5: Guard Museum Preload

**Files:**
- Modify: `src/lib/shared/modules/ModuleRenderer.svelte:63-77`

- [ ] **Step 1: Add feature flag declare and guard the preload**

At the top of the `<script>` block, add the declare:

```ts
declare const __FEATURE_MUSEUM__: boolean;
```

Replace the preload block (lines 63-77) with:

```ts
    // Preload heavy modules during idle time (only if feature is enabled in this build)
    const shouldPreloadMuseum = typeof __FEATURE_MUSEUM__ !== "undefined" ? __FEATURE_MUSEUM__ : true;
    if (shouldPreloadMuseum) {
      preloadTimer = setTimeout(() => {
        const idle =
          (window as any).requestIdleCallback ??
          ((cb: () => void) => setTimeout(cb, 100));
        idle(() => {
          if (activeModule !== "museum" && !moduleCache.has("museum")) {
            loadModule("museum").catch(() => {
              // Preload failure is non-critical
            });
          }
        });
      }, 3000);
    }
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/shared/modules/ModuleRenderer.svelte
git commit -m "feat(build): guard museum idle preload behind feature flag"
```

---

### Task 6: Add Build Scripts

**Files:**
- Modify: `package.json` (scripts section)

- [ ] **Step 1: Add convenience build scripts**

Add these scripts to `package.json`:

```json
"build:fast": "npm run build",
"build:all": "BUILD_ALL=true npm run build"
```

The default `npm run build` already runs in production mode (`NODE_ENV=production`), which triggers the feature gate. `build:all` is the escape hatch for full builds.

- [ ] **Step 2: Commit**

```bash
git add package.json
git commit -m "feat(build): add build:fast and build:all convenience scripts"
```

---

### Task 7: Verification

- [ ] **Step 1: Run core-only production build**

```bash
npm run build
```

Expected: Build completes in significantly less time than ~3 min. Disabled features should not appear in build output chunks.

- [ ] **Step 2: Time the build**

```bash
time npm run build
```

Record the time. Compare to the baseline ~2m53s.

- [ ] **Step 3: Run full production build**

```bash
BUILD_ALL=true npm run build
```

Expected: Build completes with all features included. Time should be close to the current ~3 min baseline.

- [ ] **Step 4: Run dev server and verify all features load**

```bash
npm run dev -- --port 5174
```

Navigate to each module in the app. All features should be available in dev mode regardless of feature flags.

- [ ] **Step 5: Verify core-only build output works**

From the core-only build output, verify:
- Create module loads and works
- Browse module loads and works
- Feedback module loads and works
- Nav sidebar only shows enabled modules
- Navigating to a disabled module shows error/reload UI (not a crash)

- [ ] **Step 6: Commit verification results**

```bash
git add -A
git commit -m "feat(build): compile-time feature gates — core-only build verified"
```

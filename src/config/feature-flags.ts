/**
 * Feature Registry — Compile-Time Feature Gate
 *
 * Single source of truth for which features are enabled in any given build.
 * This file runs at Vite config time (Node.js, not browser) and reads
 * process.env to determine the enabled set. A Vite plugin consumes these
 * exports to stub out disabled feature modules at resolve time.
 *
 * Tiers:
 *   core    — always enabled (create, browse, feedback)
 *   shipped — enabled by default, can be disabled (none yet)
 *   dev     — enabled in dev mode, disabled in production builds
 *
 * Environment overrides:
 *   BUILD_ALL=true          → enable all features
 *   BUILD_<UPPER_ID>=true   → enable a specific feature
 *   BUILD_<UPPER_ID>=false  → disable a specific feature (overrides dev mode)
 *   NODE_ENV !== "production" → all features enabled (dev mode)
 *   Production default: only core + shipped
 */

export type FeatureTier = "core" | "shipped" | "dev";

export interface FeatureDefinition {
  id: string;
  tier: FeatureTier;
  /** Module path prefixes whose imports are stubbed when the feature is disabled */
  modulePaths: string[];
  /** Route directory patterns excluded from the build when the feature is disabled */
  routePatterns?: string[];
}

// ---------------------------------------------------------------------------
// Feature definitions
// ---------------------------------------------------------------------------

export const FEATURES: FeatureDefinition[] = [
  // ── Core (always on) ──────────────────────────────────────────────────────
  {
    id: "create",
    tier: "core",
    modulePaths: ["features/create/"],
  },
  {
    id: "browse",
    tier: "core",
    modulePaths: ["features/browse/"],
  },
  {
    id: "feedback",
    tier: "core",
    modulePaths: ["features/feedback/"],
  },

  // ── Shipped (user-facing modules, on by default in every build) ───────────
  // These reach real users on production (tkaflowarts.com). They MUST be in the
  // production bundle — if left in the `dev` tier the feature-gate plugin stubs
  // their entry component to `export default null`, which makes ModuleRenderer
  // render "Module \"<id>\" failed to load". (Regression fixed 2026-06-10: every
  // one of these was wrongly tier:"dev", so Cloudflare's NODE_ENV=production
  // build stubbed them all — settings, learn, compose, train, … were broken.)
  {
    id: "social",
    tier: "shipped",
    modulePaths: ["features/social/"],
  },
  {
    id: "learn",
    tier: "shipped",
    modulePaths: ["features/learn/"],
  },
  {
    id: "premium",
    tier: "shipped",
    modulePaths: ["features/premium/"],
  },
  {
    id: "compose",
    tier: "shipped",
    modulePaths: ["features/compose/"],
  },
  {
    id: "train",
    tier: "shipped",
    modulePaths: ["features/train/"],
  },
  {
    id: "choreo-card",
    tier: "shipped",
    modulePaths: ["features/choreo-card/"],
  },
  {
    id: "write",
    tier: "shipped",
    modulePaths: ["features/write/"],
  },
  {
    id: "arena",
    tier: "shipped",
    modulePaths: ["features/arena/"],
  },
  {
    id: "watch",
    tier: "shipped",
    modulePaths: ["features/watch/"],
  },
  {
    id: "museum",
    tier: "shipped",
    modulePaths: ["features/museum/"],
  },
  {
    id: "archive",
    tier: "shipped",
    modulePaths: ["features/archive/"],
  },
  {
    id: "festivals",
    tier: "shipped",
    modulePaths: ["features/festivals/"],
  },
  {
    id: "levels",
    tier: "shipped",
    modulePaths: ["features/levels/"],
  },
  {
    id: "hand-paths",
    tier: "shipped",
    modulePaths: ["features/hand-paths/"],
  },
  {
    id: "video",
    tier: "shipped",
    modulePaths: ["features/video/"],
  },
  {
    id: "stage",
    tier: "shipped",
    modulePaths: ["features/stage/"],
  },
  {
    id: "lab",
    tier: "shipped",
    modulePaths: ["features/lab/"],
  },
  {
    id: "tika",
    tier: "shipped",
    modulePaths: ["features/tika/"],
  },
  {
    id: "settings",
    tier: "shipped",
    modulePaths: ["features/settings/"],
  },
  {
    id: "connect",
    tier: "shipped",
    modulePaths: ["features/connect/"],
  },
  {
    id: "fuse",
    tier: "shipped",
    modulePaths: ["features/fuse/"],
  },
  {
    id: "assemble-lab",
    tier: "shipped",
    modulePaths: ["features/assemble-lab/"],
  },

  // ── Dev (internal tools / experiments / admin — off in prod unless opted in) ─
  {
    id: "admin",
    tier: "dev",
    modulePaths: ["features/admin/"],
    routePatterns: ["src/routes/admin/"],
  },
  {
    id: "moderation",
    tier: "dev",
    modulePaths: ["features/moderation/"],
  },
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
  {
    id: "loop-labeler",
    tier: "dev",
    modulePaths: ["features/loop-labeler/"],
  },
  {
    id: "promo-generator",
    tier: "dev",
    modulePaths: ["features/promo-generator/"],
  },
  {
    id: "gallery-generator",
    tier: "dev",
    modulePaths: ["features/gallery-generator/"],
  },
  {
    id: "hall-of-shame",
    tier: "dev",
    modulePaths: ["features/hall-of-shame/"],
  },
  {
    id: "landing",
    tier: "dev",
    modulePaths: ["features/landing/"],
  },
];

// ---------------------------------------------------------------------------
// Dev-only route patterns not tied to a specific feature
// ---------------------------------------------------------------------------

const DEV_ONLY_ROUTE_PATTERNS: string[] = [
  "src/routes/test/",
  "src/routes/(dev)/",
  "src/routes/demo/",
  "src/routes/endless-spinner/",
  "src/routes/render-pictographs/",
  "src/routes/grant-feature/",
  "src/routes/embed/",
  "src/routes/hall-of-shame/",
];

// ---------------------------------------------------------------------------
// Runtime helpers
// ---------------------------------------------------------------------------

const env = process.env;
const isProduction = env.NODE_ENV === "production";
const buildAll = env.BUILD_ALL === "true";
const devMode = !isProduction;

/**
 * Returns true when the feature with the given id should be included in this
 * build.
 *
 * Resolution order (first match wins):
 *   1. BUILD_ALL=true → enabled
 *   2. BUILD_<ID>=false → disabled (explicit opt-out, even in dev)
 *   3. BUILD_<ID>=true → enabled (explicit opt-in, even in production)
 *   4. tier === "core" → always enabled
 *   5. tier === "shipped" → enabled (by definition the default-on set)
 *   6. dev mode (NODE_ENV !== "production") → enabled
 *   7. tier === "dev" in production without an opt-in → disabled
 */
export function isFeatureEnabled(featureId: string): boolean {
  const envKey = `BUILD_${featureId.toUpperCase().replace(/-/g, "_")}`;

  if (buildAll) return true;

  // Explicit per-feature override takes priority over tier logic
  if (env[envKey] === "false") return false;
  if (env[envKey] === "true") return true;

  const feature = FEATURES.find((f) => f.id === featureId);
  if (!feature) return false;

  if (feature.tier === "core") return true;
  if (feature.tier === "shipped") return true;

  // dev tier: enabled when not in a production build
  return devMode;
}

/**
 * Returns the set of all enabled feature ids for the current build
 * configuration.
 */
export function getEnabledFeatures(): Set<string> {
  return new Set(FEATURES.filter((f) => isFeatureEnabled(f.id)).map((f) => f.id));
}

/**
 * Returns the list of module path prefixes that belong to disabled features.
 * The Vite plugin uses these to stub out imports at resolve time.
 */
export function getDisabledFeatureModulePaths(): string[] {
  return FEATURES.filter((f) => !isFeatureEnabled(f.id)).flatMap(
    (f) => f.modulePaths
  );
}

/**
 * Module path prefixes to stub in the SSR / server (Cloudflare Pages Functions)
 * build.
 *
 * The app shell (`/[...appPath]`, `/app`) is CSR-only (`ssr = false`), so NO
 * feature module is ever rendered on the server — yet Vite still bundles every
 * dynamic-import target into `_worker.js`, which has a hard 25 MiB limit on
 * Cloudflare Pages. Shipping all user-facing modules to the client (correct)
 * pushed the server bundle past that limit and failed the deploy.
 *
 * Since these modules never execute server-side, we stub every non-core feature
 * module in the SSR build while keeping them real in the client build. This
 * returns the server bundle to its known-good (core-only) size AND reclaims the
 * entire server-side compile of those modules — the only legitimate build-time
 * win available, since a module that ships to users must still compile for the
 * client. Core (create/browse/feedback) stays real in SSR to match the prior
 * proven-good server bundle.
 */
export function getSsrStubbedModulePaths(): string[] {
  return FEATURES.filter((f) => f.tier !== "core").flatMap((f) => f.modulePaths);
}

/**
 * Returns the list of route directory patterns for disabled features, plus
 * dev-only route patterns when building for production.
 *
 * The Vite plugin uses these to exclude routes from the SvelteKit build.
 */
export function getDisabledRoutePatterns(): string[] {
  const featureRoutes = FEATURES.filter(
    (f) => !isFeatureEnabled(f.id) && f.routePatterns
  ).flatMap((f) => f.routePatterns as string[]);

  const devRoutes = isProduction && !buildAll ? DEV_ONLY_ROUTE_PATTERNS : [];

  return [...featureRoutes, ...devRoutes];
}

/**
 * Returns a Vite `define`-compatible map for every dev-tier feature.
 * Enabled features map to `"true"`, disabled to `"false"`.
 *
 * Example output (production build, no overrides):
 *   { "__FEATURE_MUSEUM__": "false", "__FEATURE_RETRO__": "false", ... }
 *
 * Core and shipped features are always enabled and are not included —
 * there is no need to guard them behind a compile-time constant.
 */
export function getEnabledFeaturesDefineMap(): Record<string, string> {
  const map: Record<string, string> = {};
  for (const feature of FEATURES) {
    if (feature.tier === "dev") {
      const key = `__FEATURE_${feature.id.toUpperCase().replace(/-/g, "_")}__`;
      map[key] = isFeatureEnabled(feature.id) ? "true" : "false";
    }
  }
  return map;
}

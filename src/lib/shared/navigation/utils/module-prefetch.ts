/**
 * Module Prefetch Utility
 *
 * Intelligently prefetches likely next modules based on user navigation patterns.
 * Uses `<link rel="modulepreload">` for predictive loading.
 *
 * 🚀 PERFORMANCE: Reduces perceived load time by preloading modules
 * users are likely to navigate to next.
 *
 * ⚠️ NOTE: This utility is DISABLED in production builds because Vite
 * compiles .svelte files to hashed JS chunks. Source file paths like
 * "/src/lib/features/..." don't exist in production.
 *
 * For production prefetching, we would need to:
 * 1. Use Vite's manifest to map modules to compiled chunk paths, OR
 * 2. Rely on SvelteKit's built-in prefetching capabilities
 *
 * Currently, only dev mode uses this for faster module switching.
 */

// Check if we're in development mode (Vite serves source files directly)
const IS_DEV =
  typeof import.meta !== "undefined" && import.meta.env?.DEV === true;

/**
 * Navigation patterns: most likely next modules from each module
 * Based on user behavior analysis:
 * - Dashboard → Create (start building), Browse (browse)
 * - Browse → Create (fork/modify)
 * - Create → Compose (animate), Browse (share)
 * - Compose → Create (edit more)
 * - Learn → Create (try it), Train (practice)
 * - Train → Create (compose), Learn (review)
 */
const NAVIGATION_PATTERNS: Record<string, string[]> = {
  create: ["compose", "browse"],
  browse: ["create", "creators"],
  creators: ["browse"],
  compose: ["create"],
  learn: ["create", "train"],
  train: ["create", "learn"],
  settings: [], // Settings is an endpoint, no prefetch needed
  feedback: ["create"],
  admin: ["create", "feedback"],
};

/**
 * Module chunk paths - maps module IDs to their chunk entry points
 * These are dynamically imported in ModuleRenderer.svelte
 *
 * ⚠️ These paths only work in DEV mode where Vite serves source files.
 * In production, .svelte files are compiled to hashed chunks.
 */
const MODULE_PATHS: Record<string, string> = {
  // dashboard removed - Create is now the default landing module
  create: "/src/lib/features/create/shared/components/CreateModule.svelte",
  browse: "/src/lib/features/browse/shared/components/BrowseModule.svelte",
  creators: "/src/lib/features/creators/CreatorsModule.svelte",
  compose: "/src/lib/features/compose/ComposeModule.svelte",
  learn: "/src/lib/features/learn/LearnTab.svelte",
  train: "/src/lib/features/train/components/TrainModule.svelte",
  settings: "/src/lib/features/settings/SettingsModule.svelte",
  feedback: "/src/lib/features/feedback/components/FeedbackModule.svelte",
  admin: "/src/lib/features/admin/components/AdminDashboard.svelte",
  museum: "/src/lib/features/museum/MuseumModule.svelte",
};

// Track which modules have been prefetched to avoid duplicates
const prefetchedModules = new Set<string>();

/**
 * Prefetch a specific module by adding a modulepreload link
 *
 * ⚠️ Only works in DEV mode - production builds compile .svelte to hashed chunks
 */
function prefetchModule(moduleId: string): void {
  // Skip in production - source paths don't exist after compilation
  if (!IS_DEV) return;

  if (prefetchedModules.has(moduleId)) return;
  if (typeof document === "undefined") return;

  const modulePath = MODULE_PATHS[moduleId];
  if (!modulePath) return;

  const link = document.createElement("link");
  link.rel = "modulepreload";
  link.href = modulePath;
  link.as = "script";

  // Mark as prefetched before adding to DOM
  prefetchedModules.add(moduleId);
  document.head.appendChild(link);
}

/**
 * Prefetch likely next modules based on current module
 *
 * Call this when the user lands on a module to speculatively
 * load modules they're likely to navigate to next.
 *
 * Uses requestIdleCallback to avoid blocking main thread.
 *
 * @param currentModuleId - The module the user is currently on
 */
export function prefetchLikelyNextModules(currentModuleId: string): void {
  if (typeof window === "undefined") return;

  const likelyNextModules = NAVIGATION_PATTERNS[currentModuleId] ?? [];

  if (likelyNextModules.length === 0) return;

  // Use requestIdleCallback to prefetch during idle time
  const schedulePrefetch = window.requestIdleCallback ?? setTimeout;

  schedulePrefetch(
    () => {
      likelyNextModules.forEach((moduleId) => {
        prefetchModule(moduleId);
      });
    },
    { timeout: 2000 } // Fallback timeout if idle callback isn't called
  );
}

/**
 * Prefetch on hover/focus intent
 *
 * Call this when user hovers or focuses on a navigation link
 * to preload that specific module. This provides faster navigation
 * when the user has shown intent.
 *
 * @param targetModuleId - The module the user is hovering/focused on
 */
export function prefetchOnIntent(targetModuleId: string): void {
  prefetchModule(targetModuleId);
}

/**
 * Preload critical modules on app startup
 *
 * Prefetches the most commonly used modules after initial load.
 * Called once after the app has rendered.
 *
 * IMPORTANT: Only prefetch if user is on Dashboard. Prefetching on every
 * page (e.g., Settings) would defeat lazy loading - the Create module has
 * 150+ files that add 5+ seconds to load time.
 *
 * @param currentModuleId - Pass the current module to only prefetch from Dashboard
 */
export function preloadCriticalModules(currentModuleId?: string): void {
  if (typeof window === "undefined") return;

  // Boot-time speculative preload is a net LOSS in dev and a no-op in prod:
  //   - Dev: every ES module is its own HTTP request. `modulepreload` on a
  //     module entry makes the browser walk that entry's whole recursive
  //     static-import graph, so this pulled all of Create (150+ files, per the
  //     note above) AND Browse into the very first page load, competing with
  //     the modules the user actually asked for on a single-threaded dev
  //     server. Measured 2026-07-21: ~2661 requests / 1.3 min to first paint.
  //   - Prod: prefetchModule() bails on !IS_DEV because MODULE_PATHS holds
  //     "/src/..." source paths that don't survive compilation.
  // So this only ever ran where it hurts. `+layout.svelte`'s
  // startActiveModulePreload() already reached the same conclusion and guards
  // with `if (!import.meta.env.PROD) return` — this is the twin that was
  // missed. ModuleRenderer lazy-loads on demand either way; hover-intent
  // prefetch (prefetchOnIntent) still gives fast module switching in dev
  // without taxing boot.
  void currentModuleId;
}

/**
 * Check if a module has been prefetched
 */
export function isModulePrefetched(moduleId: string): boolean {
  return prefetchedModules.has(moduleId);
}

/**
 * Get statistics about prefetched modules
 */
export function getPrefetchStats(): { prefetched: string[]; count: number } {
  return {
    prefetched: Array.from(prefetchedModules),
    count: prefetchedModules.size,
  };
}

/**
 * Navigation State - Global Navigation State Management
 *
 * Manages global navigation state including current modes for tabs with sub-modes.
 * This provides a centralized way to track and update navigation state across the app.
 *
 * ARCHITECTURE:
 * - Tab/module definitions: config/tab-definitions.ts, config/module-definitions.ts
 * - Storage keys: config/storage-keys.ts
 * - Persistence service: services/implementations/NavigationPersister.ts (for DI contexts)
 * - Validation service: services/implementations/NavigationValidator.ts (for DI contexts)
 *
 * NOTE: This state is created at module load time (before DI container is ready),
 * so we use storage keys directly and lazy-resolve services where needed.
 */

import type { ModuleDefinition, ModuleId, Section } from "../domain/types";
import type { IPresenceTracker } from "../../presence/services/contracts/IPresenceTracker";
import { getActivityLogger } from "../../analytics/getActivityLogger";

// Lazy container reference to avoid circular dependency with DI
// The DI container imports navigation-container which imports DeepLinker
// which imports navigationState - creating a cycle if we import container here
let _containerRef: { items: Record<string, unknown> } | null = null;

// Helper function to safely resolve services from container
// Uses lazy resolution to break circular dependency with DI
function tryResolveService<T>(serviceName: string): T | null {
  try {
    // Lazy load container on first use
    if (!_containerRef) {
      // Dynamic import to break the cycle at module load time
      const { container } = require("../../di");
      _containerRef = container as { items: Record<string, unknown> };
    }
    const service = _containerRef.items[serviceName];
    return service ? (service as T) : null;
  } catch {
    return null;
  }
}

// Import configurations from separated files
import {
  CREATE_TABS,
  DEFAULT_CREATE_TAB,
  LEARN_TABS,
  BROWSE_TABS,
  LIBRARY_TABS,
  COMMUNITY_TABS,
  ADMIN_TABS,
  ACCOUNT_TABS,
  SETTINGS_TABS,
  WATCH_TABS,
} from "../config/tab-definitions";

import { MODULE_DEFINITIONS, normalizeModuleId } from "../config/module-definitions";

// Import storage keys from centralized config
import {
  CURRENT_MODULE_KEY,
  ACTIVE_TAB_KEY,
  MODULE_LAST_TABS_KEY,
  CURRENT_CREATE_MODE_KEY,
  CURRENT_LEARN_MODE_KEY,
  PREVIOUS_MODULE_SESSION_KEY,
  PREVIOUS_TAB_SESSION_KEY,
} from "../config/storage-keys";

// Import panel persistence state (extracted for single responsibility)
import { panelPersistenceState } from "./panel-persistence-state.svelte";

// Import HMR helper for MIME error detection (dev only)
// We need to verify tab switches after MIME errors corrupt Svelte reactivity
import {
  hasMimeErrorOccurred,
  verifyTabSwitch,
} from "../../hmr-helper";

// Re-export for backwards compatibility
export {
  CREATE_TABS,
  LEARN_TABS,
  BROWSE_TABS,
  LIBRARY_TABS,
  COMMUNITY_TABS,
  COMPOSE_TABS,
  ADMIN_TABS,
  ACCOUNT_TABS,
  SETTINGS_TABS,
  COLLECT_TABS,
  BUILD_TABS,
  COLLECTION_TABS,
  ABOUT_TABS,
  EDIT_TABS,
  ML_TRAINING_TABS,
  FEEDBACK_TABS,
  TRAIN_TABS,
  WATCH_TABS,
} from "../config/tab-definitions";

export { MODULE_DEFINITIONS } from "../config/module-definitions";

/**
 * Creates navigation state for managing modules and tabs
 */
export function createNavigationState() {
  // ─────────────────────────────────────────────────────────────────────────────
  // Reactive State
  // ─────────────────────────────────────────────────────────────────────────────

  // Current mode state (legacy, synced with activeTab)
  let currentCreateMode = $state<string>("construct");
  let currentLearnMode = $state<string>("concepts");

  // Module-based state - Create is the default landing module
  let currentModule = $state<ModuleId>("create");
  let activeTab = $state<string>(DEFAULT_CREATE_TAB); // Default to construct tab

  // Track previous module for settings toggle behavior
  let previousModule = $state<ModuleId | null>(loadPreviousModuleFromSession());

  // Track previous tab for feedback context (last tab before current navigation)
  let previousTab = $state<string>(loadPreviousTabFromSession());

  // ─────────────────────────────────────────────────────────────────────────────
  // Lazy Service Resolution (for when DI container is available)
  // ─────────────────────────────────────────────────────────────────────────────

  // ─────────────────────────────────────────────────────────────────────────────
  // Persistence Helpers (inline since state is created before DI is ready)
  // ─────────────────────────────────────────────────────────────────────────────

  // Helper to load previous module from sessionStorage
  function loadPreviousModuleFromSession(): ModuleId | null {
    if (typeof sessionStorage === "undefined") return null;
    const saved = sessionStorage.getItem(PREVIOUS_MODULE_SESSION_KEY);
    if (saved && MODULE_DEFINITIONS.some((m) => m.id === saved)) {
      return saved as ModuleId;
    }
    return null;
  }

  // Helper to persist previous module to sessionStorage
  function savePreviousModuleToSession(moduleId: ModuleId | null) {
    if (typeof sessionStorage === "undefined") return;
    if (moduleId) {
      sessionStorage.setItem(PREVIOUS_MODULE_SESSION_KEY, moduleId);
    } else {
      sessionStorage.removeItem(PREVIOUS_MODULE_SESSION_KEY);
    }
  }

  // Helper to load previous tab from sessionStorage
  function loadPreviousTabFromSession(): string {
    if (typeof sessionStorage === "undefined") return "";
    return sessionStorage.getItem(PREVIOUS_TAB_SESSION_KEY) || "";
  }

  // Helper to persist previous tab to sessionStorage
  function savePreviousTabToSession(tabId: string) {
    if (typeof sessionStorage === "undefined") return;
    if (tabId) {
      sessionStorage.setItem(PREVIOUS_TAB_SESSION_KEY, tabId);
    } else {
      sessionStorage.removeItem(PREVIOUS_TAB_SESSION_KEY);
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Per-Module Tab Persistence
  // ─────────────────────────────────────────────────────────────────────────────

  function saveModuleTab(moduleId: string, tabId: string) {
    if (typeof localStorage === "undefined") return;
    try {
      const raw = localStorage.getItem(MODULE_LAST_TABS_KEY);
      const map: Record<string, string> = raw ? JSON.parse(raw) : {};
      map[moduleId] = tabId;
      localStorage.setItem(MODULE_LAST_TABS_KEY, JSON.stringify(map));
    } catch {
      // Corrupt storage - reset it
      localStorage.setItem(MODULE_LAST_TABS_KEY, JSON.stringify({ [moduleId]: tabId }));
    }
  }

  function loadModuleTab(moduleId: string): string | null {
    if (typeof localStorage === "undefined") return null;
    try {
      const raw = localStorage.getItem(MODULE_LAST_TABS_KEY);
      if (!raw) return null;
      const map: Record<string, string> = JSON.parse(raw);
      return map[moduleId] || null;
    } catch {
      return null;
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Load Persisted State (runs at module initialization)
  // ─────────────────────────────────────────────────────────────────────────────

  // Modules with heavy 3D content that shouldn't auto-restore on full page reload.
  // During HMR (Vite dev hot reload), these modules restore normally because the
  // developer is actively working on them. On a hard reload (Ctrl+Shift+R) or fresh
  // navigation to "/", the app falls back to "create" instead of re-mounting
  // heavyweight 3D scenes the user didn't ask for.
  const HEAVYWEIGHT_MODULES: ReadonlySet<string> = new Set(["realm"]);

  // Detect whether this is an HMR remount (same page session) or a fresh page load.
  // sessionStorage survives Vite HMR remounts but is cleared by hard reload (Ctrl+Shift+R)
  // and new tab opens, so its presence reliably distinguishes the two cases.
  const HMR_SESSION_KEY = "tka-nav-session-active";
  let isHmrRemount = false;
  if (typeof sessionStorage !== "undefined") {
    isHmrRemount = sessionStorage.getItem(HMR_SESSION_KEY) === "1";
    sessionStorage.setItem(HMR_SESSION_KEY, "1");
  }

  if (typeof localStorage !== "undefined") {
    // Load create mode persistence
    const savedCreateMode = localStorage.getItem(CURRENT_CREATE_MODE_KEY);
    if (savedCreateMode && CREATE_TABS.some((t) => t.id === savedCreateMode)) {
      currentCreateMode = savedCreateMode;
    }

    const savedLearnMode = localStorage.getItem(CURRENT_LEARN_MODE_KEY);
    if (savedLearnMode && LEARN_TABS.some((t) => t.id === savedLearnMode)) {
      currentLearnMode = savedLearnMode;
    }

    // Load module persistence - normalize to handle migrations and typos
    const savedModule = localStorage.getItem(CURRENT_MODULE_KEY);
    if (savedModule) {
      const normalizedSavedModule = normalizeModuleId(savedModule);
      if (normalizedSavedModule) {
        // On a fresh page load (not HMR), don't restore heavyweight modules.
        // The user likely hard-reloaded to escape the heavy 3D scene, not to
        // re-enter it. Fall back to "create" as the default landing module.
        if (!isHmrRemount && HEAVYWEIGHT_MODULES.has(normalizedSavedModule)) {
          currentModule = "create";
          localStorage.setItem(CURRENT_MODULE_KEY, "create");
        } else {
          currentModule = normalizedSavedModule;
          // Fix localStorage if it had stale/migrated value
          if (normalizedSavedModule !== savedModule) {
            localStorage.setItem(CURRENT_MODULE_KEY, normalizedSavedModule);
          }
        }
      } else {
        // Invalid module in localStorage - clear it and use default
        console.warn(`Invalid module "${savedModule}" in localStorage, using default`);
        currentModule = "create";
        localStorage.setItem(CURRENT_MODULE_KEY, "create");
      }
    }

    // Load last open panel for each tab via panelPersistenceState
    // Validator ensures saved tab keys are still valid
    panelPersistenceState.loadFromStorage((tabKey: string) => {
      const [moduleId, tabId] = tabKey.split(":");
      if (!moduleId || !tabId) return false;
      const moduleDefinition = MODULE_DEFINITIONS.find(
        (m) => m.id === moduleId
      );
      return (
        moduleDefinition?.sections.some((tab) => tab.id === tabId) ?? false
      );
    });

    // ─────────────────────────────────────────────────────────────────────────────
    // URL Path Parsing - URL is the source of truth for navigation
    // Parses paths like /realm/gallery → module: "realm", tab: "gallery"
    // Also supports query param: /admin?section=loop-labeler → module: "admin", tab: "loop-labeler"
    // ─────────────────────────────────────────────────────────────────────────────
    if (typeof window !== "undefined") {
      const pathname = window.location.pathname;
      const searchParams = new URLSearchParams(window.location.search);

      // Remove leading slash and split by remaining slashes
      const pathParts = pathname.replace(/^\/+/, "").split("/").filter(Boolean);

      const firstPart = pathParts[0];
      if (pathParts.length >= 1 && firstPart) {
        const rawUrlModule = firstPart.toLowerCase();
        // Tab can come from path (/admin/loop-labeler) OR query param (?section=loop-labeler)
        const urlTab = pathParts[1]?.toLowerCase() || searchParams.get("section")?.toLowerCase();

        // Normalize module ID (handles migrations like "dashboard" → "create", typos → undefined)
        const normalizedModule = normalizeModuleId(rawUrlModule);

        // Get the module definition (or fall back to "create" for invalid modules)
        const urlModuleDefinition = normalizedModule
          ? MODULE_DEFINITIONS.find((m) => m.id === normalizedModule)
          : null;

        if (urlModuleDefinition && normalizedModule) {
          // On fresh page load, redirect heavyweight modules to "create" instead of
          // re-mounting heavy 3D scenes. During HMR the URL is left alone so the
          // developer stays on the module they're editing.
          if (!isHmrRemount && HEAVYWEIGHT_MODULES.has(normalizedModule)) {
            currentModule = "create";
            activeTab = DEFAULT_CREATE_TAB;
          } else {
            // Valid module - use it
            currentModule = normalizedModule;

            // Determine the tab to use
            if (urlModuleDefinition.sections.length > 0) {
              // Module has tabs - check if URL specifies a valid one FOR THIS MODULE
              const validTab = urlTab
                ? urlModuleDefinition.sections.find((s) => s.id === urlTab)
                : null;

              if (validTab && urlTab) {
                // URL has valid tab for this module - use it
                activeTab = urlTab;
              } else {
                // No tab in URL - check persisted per-module tab first, then default.
                // This preserves the user's last tab across HMR reloads and page refreshes.
                const savedTab = loadModuleTab(normalizedModule);
                if (savedTab && urlModuleDefinition.sections.some((s) => s.id === savedTab)) {
                  activeTab = savedTab;
                } else {
                  activeTab =
                    normalizedModule === "create"
                      ? DEFAULT_CREATE_TAB
                      : urlModuleDefinition.sections[0]?.id || "";
                }
              }
            } else {
              // Module has no tabs
              activeTab = "";
            }
          }
        } else {
          // Unrecognized path — could be a typo ("sdashboard") or a standalone
          // SvelteKit route ("/1995") that isn't part of the module system.
          // Set safe internal defaults but do NOT rewrite the URL — that would
          // break standalone routes whose pages render independently.
          currentModule = "create";
          activeTab = DEFAULT_CREATE_TAB;
        }
      }
    }

    // Sync mode-specific state with activeTab after all loading is complete
    // This ensures currentLearnMode/currentCreateMode match activeTab on refresh
    // Note: These comparisons use the current values directly (not in a closure)
    const moduleAtInit = currentModule;
    const tabAtInit = activeTab;
    if (
      moduleAtInit === "learn" &&
      LEARN_TABS.some((t) => t.id === tabAtInit)
    ) {
      currentLearnMode = tabAtInit;
    } else if (
      moduleAtInit === "create" &&
      CREATE_TABS.some((t) => t.id === tabAtInit)
    ) {
      currentCreateMode = tabAtInit;
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Action Functions
  // ─────────────────────────────────────────────────────────────────────────────

  function setCreateMode(mode: string) {
    if (CREATE_TABS.some((t) => t.id === mode)) {
      currentCreateMode = mode;
      if (typeof localStorage !== "undefined") {
        localStorage.setItem(CURRENT_CREATE_MODE_KEY, mode);
      }
    }
  }

  function setLearnMode(mode: string) {
    if (LEARN_TABS.some((t) => t.id === mode)) {
      currentLearnMode = mode;
      if (typeof localStorage !== "undefined") {
        localStorage.setItem(CURRENT_LEARN_MODE_KEY, mode);
      }
      // Sync with new state when in Learn module
      if (currentModule === "learn") {
        activeTab = mode;
      }
    }
  }

  // Module-based functions
  // targetTab: Optional tab to set directly (bypasses default tab logic)
  function setCurrentModule(moduleId: ModuleId, targetTab?: string) {
    if (MODULE_DEFINITIONS.some((m) => m.id === moduleId)) {
      const previousModuleLocal = currentModule;

      // Track previous module/tab for feedback context
      // Save current location when LEAVING it (unless leaving feedback/settings)
      // This ensures previous always reflects where user was before opening feedback
      if (currentModule !== moduleId) {
        // Only save if leaving a "real" location (not feedback/settings)
        if (
          currentModule &&
          currentModule !== "feedback" &&
          currentModule !== "settings"
        ) {
          previousModule = currentModule;
          previousTab = activeTab;
          savePreviousModuleToSession(currentModule);
          savePreviousTabToSession(activeTab);
        }
      }

      currentModule = moduleId;

      // Determine the tab - use targetTab if valid, then saved per-module tab, then default
      const moduleDefinition = MODULE_DEFINITIONS.find(
        (m) => m.id === moduleId
      );
      let nextTab = "";
      if (moduleDefinition && moduleDefinition.sections.length > 0) {
        if (
          targetTab &&
          moduleDefinition.sections.some((tab) => tab.id === targetTab)
        ) {
          // Explicit targetTab takes priority
          nextTab = targetTab;
        } else {
          // Check for a previously saved tab for this module
          const savedTab = loadModuleTab(moduleId);
          if (savedTab && moduleDefinition.sections.some((tab) => tab.id === savedTab)) {
            nextTab = savedTab;
          } else {
            // Fall back to module default
            nextTab =
              moduleId === "create"
                ? DEFAULT_CREATE_TAB
                : moduleDefinition.sections[0]?.id || "";
          }
        }
      }

      activeTab = nextTab;

      // Log module navigation for analytics (non-blocking)
      // Include the tab for more granular tracking (e.g., "create:generate")
      if (previousModuleLocal !== moduleId) {
        try {
          const activityLogger = getActivityLogger();
          const moduleWithTab = nextTab ? `${moduleId}:${nextTab}` : moduleId;
          void activityLogger.logModuleView(
            moduleWithTab,
            previousModuleLocal
          );
        } catch {
          // Silently fail - activity logging is non-critical
        }

        // Track module visit for attribution prompt eligibility (non-blocking)
        try {
          const promptTrigger = tryResolveService<{ recordModuleVisit: (id: string) => void }>("attributionPromptTrigger");
          if (promptTrigger?.recordModuleVisit) {
            promptTrigger.recordModuleVisit(moduleId);
          }
        } catch {
          // Silently fail - attribution tracking is non-critical
        }

        // Update presence with new location (non-blocking)
        void import("../../presence/getPresenceTracker").then(({ getPresenceTracker }) => {
          getPresenceTracker().updateLocation(moduleId, nextTab || null);
        }).catch(() => {});
      }

      // Persist both module and active tab
      if (typeof localStorage !== "undefined") {
        localStorage.setItem(CURRENT_MODULE_KEY, moduleId);
        if (nextTab) {
          localStorage.setItem(ACTIVE_TAB_KEY, nextTab);
          saveModuleTab(moduleId, nextTab);
        } else {
          // Clear persisted tab when module has no tabs (e.g., dashboard)
          localStorage.removeItem(ACTIVE_TAB_KEY);
        }
      }

      // Sync with mode-specific state
      const tab = getActiveTab();
      if (moduleId === "create") {
        setCreateMode(tab);
      } else if (moduleId === "learn") {
        setLearnMode(tab);
      }
    }
  }

  function setActiveTab(tabId: string) {
    // Debug logging - enable via: window.__DEBUG_NAV__ = true
    const debug = typeof window !== "undefined" && (window as any).__DEBUG_NAV__;

    const moduleDefinition = MODULE_DEFINITIONS.find(
      (m) => m.id === currentModule
    );
    const tabExists = moduleDefinition?.sections.some(
      (tab) => tab.id === tabId
    );

    if (debug) {
      console.log("[NavState] setActiveTab called:", {
        tabId,
        currentModule,
        moduleFound: !!moduleDefinition,
        tabExists,
        availableTabs: moduleDefinition?.sections.map((s) => s.id),
        currentActiveTab: activeTab,
      });
    }

    if (!moduleDefinition || !tabExists) {
      if (debug) {
        console.log("[NavState] ❌ GUARD FAILED - not setting tab");
      }
      return;
    }

    const previousTab = activeTab;

    if (debug) {
      console.log(`[NavState] 📝 BEFORE assignment: activeTab = "${activeTab}"`);
    }

    activeTab = tabId;

    if (debug) {
      console.log(`[NavState] 📝 AFTER assignment: activeTab = "${activeTab}"`);
      if (activeTab !== tabId) {
        console.error(`[NavState] 🔴 ASSIGNMENT FAILED! Expected "${tabId}" but got "${activeTab}"`);
      }
    }

    if (previousTab === tabId) {
      // No change needed, but we still updated
      return;
    }

    // Log tab switch for analytics (non-blocking)
    try {
      const activityLogger = getActivityLogger();
      const moduleWithTab = `${currentModule}:${tabId}`;
      const previousModuleWithTab = `${currentModule}:${previousTab}`;
      void activityLogger.logModuleView(
        moduleWithTab,
        previousModuleWithTab
      );
    } catch {
      // Silently fail - activity logging is non-critical
    }

    // Update presence with new tab (non-blocking)
    try {
      import("../../presence/getPresenceTracker").then(({ getPresenceTracker }) => {
        void getPresenceTracker().updateLocation(currentModule, tabId);
      }).catch(() => { /* presence is non-critical */ });
    } catch {
      // Silently fail - presence is non-critical
    }

    if (typeof localStorage !== "undefined") {
      localStorage.setItem(ACTIVE_TAB_KEY, tabId);
      saveModuleTab(currentModule, tabId);
    }

    // Sync with mode-specific state
    const module = getCurrentModule();
    if (module === "create") {
      setCreateMode(tabId);
    } else if (module === "learn") {
      setLearnMode(tabId);
    }

    // In dev mode, verify the tab switch worked after MIME errors
    // MIME errors corrupt Svelte's reactivity, causing state to change
    // but the UI to not update. This detects that case and forces a reload.
    if (import.meta.env.DEV && hasMimeErrorOccurred()) {
      // Non-blocking verification - will reload if UI didn't update
      void verifyTabSwitch(tabId, 200);
    }
  }

  function getCurrentModule(): ModuleId {
    return currentModule;
  }

  function getActiveTab(): string {
    return activeTab;
  }

  function getTabsForModule(moduleId: ModuleId): Section[] {
    const moduleDefinition = MODULE_DEFINITIONS.find((m) => m.id === moduleId);
    return moduleDefinition ? moduleDefinition.sections : [];
  }

  function getModuleDefinition(
    moduleId: ModuleId
  ): ModuleDefinition | undefined {
    return MODULE_DEFINITIONS.find((m) => m.id === moduleId);
  }

  function updateTabAccessibility(tabId: string, disabled: boolean) {
    // Find and update the tab in CREATE_TABS (mutate directly)
    const tab = CREATE_TABS.find((t) => t.id === tabId);
    if (tab) {
      tab.disabled = disabled;
    }
  }

  return {
    // Current state
    get currentCreateMode() {
      return currentCreateMode;
    },
    get currentLearnMode() {
      return currentLearnMode;
    },

    // Module-based readonly state
    get currentModule() {
      return currentModule;
    },
    get activeTab() {
      return activeTab;
    },
    get previousModule() {
      return previousModule;
    },
    get previousTab() {
      return previousTab;
    },

    // Tab configurations
    get createTabs() {
      return CREATE_TABS;
    },
    get learnTabs() {
      return LEARN_TABS;
    },
    get browseTabs() {
      return BROWSE_TABS;
    },
    get communityTabs() {
      return COMMUNITY_TABS;
    },
    get libraryTabs() {
      return LIBRARY_TABS;
    },
    get adminTabs() {
      return ADMIN_TABS;
    },
    get accountTabs() {
      return ACCOUNT_TABS;
    },
    get settingsTabs() {
      return SETTINGS_TABS;
    },
    get moduleDefinitions() {
      return MODULE_DEFINITIONS;
    },

    // Legacy getters (deprecated)
    /** @deprecated Use createTabs instead */
    get CreateModules() {
      return CREATE_TABS;
    },
    /** @deprecated Use createTabs instead */
    get buildModes() {
      return CREATE_TABS;
    },
    /** @deprecated Use createTabs instead */
    get createModes() {
      return CREATE_TABS;
    },
    /** @deprecated Use currentCreateMode instead */
    get currentBuildMode() {
      return currentCreateMode;
    },
    /** @deprecated Use learnTabs instead */
    get learnModes() {
      return LEARN_TABS;
    },
    /** @deprecated Use browseTabs instead */
    get browseModes() {
      return BROWSE_TABS;
    },
    /** @deprecated Use browseTabs instead */
    get BrowseModes() {
      return BROWSE_TABS;
    },
    /** @deprecated Use activeTab instead */
    get currentSection() {
      return activeTab;
    },

    // Actions
    setCreateMode,
    setLearnMode,

    // Module-based actions
    setCurrentModule,
    setActiveTab,
    getCurrentModule,
    getActiveTab,
    getTabsForModule,
    getModuleDefinition,
    updateTabAccessibility,

    // ─────────────────────────────────────────────────────────────────────────
    // Panel Persistence (delegated to panelPersistenceState)
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Get the last open panel for a specific tab
     * @param moduleId The module (defaults to current module)
     * @param tabId The tab within the module (defaults to active tab)
     * @returns The panel ID (e.g., "animation", "edit", "share") or null if no panel was open
     */
    getLastPanelForTab(moduleId?: ModuleId, tabId?: string): string | null {
      const module = moduleId ?? currentModule;
      const tab = tabId ?? activeTab;
      return panelPersistenceState.getLastPanel(`${module}:${tab}`);
    },

    /**
     * Set the last open panel for a specific tab
     * @param panelId The panel ID to save (e.g., "animation", "edit", "share") or null to clear
     * @param moduleId The module (defaults to current module)
     * @param tabId The tab within the module (defaults to active tab)
     */
    setLastPanelForTab(
      panelId: string | null,
      moduleId?: ModuleId,
      tabId?: string
    ) {
      const module = moduleId ?? currentModule;
      const tab = tabId ?? activeTab;
      panelPersistenceState.setLastPanel(`${module}:${tab}`, panelId);
    },

    /**
     * Clear the panel state for a tab (use when explicitly closing a panel)
     * @param moduleId The module (defaults to current module)
     * @param tabId The tab within the module (defaults to active tab)
     */
    clearPanelForTab(moduleId?: ModuleId, tabId?: string) {
      const module = moduleId ?? currentModule;
      const tab = tabId ?? activeTab;
      panelPersistenceState.clearPanel(`${module}:${tab}`);
    },

    // Legacy action aliases (deprecated)
    /** @deprecated Use setCreateMode instead */
    setBuildMode: setCreateMode,
    /** @deprecated Use setActiveTab instead */
    setCurrentSection: setActiveTab,
    /** @deprecated Use getActiveTab instead */
    getCurrentSection: getActiveTab,
    /** @deprecated Use getTabsForModule instead */
    getSectionsForModule: getTabsForModule,
  };
}

/**
 * Type for NavigationState - the return type of createNavigationState
 */
export type NavigationState = ReturnType<typeof createNavigationState>;

// Global navigation state instance
export const navigationState = createNavigationState();

// Expose to window for debugging (dev only)
if (typeof window !== "undefined") {
  (window as any).__navState = navigationState;
}

// ============================================================================
// HMR: Force full reload when this module changes
// ============================================================================
// Svelte 5's reactive proxies don't survive HMR well. Components that import
// navigationState hold references to the OLD reactive proxy after HMR replaces
// this module. State updates, but components don't re-render.
//
// The pragmatic fix: Don't HMR this file. A full reload is fast and reliable.
// This is the recommended approach for core state modules in modern apps.
if (import.meta.hot) {
  import.meta.hot.accept(() => {
    // Accepting the update but immediately invalidating forces a full reload
    import.meta.hot?.invalidate();
  });
}

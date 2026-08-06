/**
 * Navigation Storage Keys
 *
 * Centralized storage key constants for navigation persistence.
 * Keeping keys in one place prevents typos and makes refactoring easier.
 */

/** localStorage key for current module (e.g., "create", "learn") */
export const CURRENT_MODULE_KEY = "tka-current-module";

/** localStorage key for active tab within current module */
export const ACTIVE_TAB_KEY = "tka-active-tab";

/** localStorage key for per-module last active tab (JSON object, key: moduleId, value: tabId) */
export const MODULE_LAST_TABS_KEY = "tka-module-last-tabs";

/** localStorage key for last open panel per tab (JSON object, key format: "moduleId:tabId") */
export const TAB_LAST_PANELS_KEY = "tka-tab-last-panels";

/** Versioned, identity-scoped visit history used by Jump to suggestions */
export const NAVIGATION_VISITS_KEY = "tka-navigation-visits";

/** localStorage key for current create mode (legacy, synced with activeTab) */
export const CURRENT_CREATE_MODE_KEY = "tka-current-create-mode";

/** localStorage key for current learn mode (legacy, synced with activeTab) */
export const CURRENT_LEARN_MODE_KEY = "tka-current-learn-mode";

/** sessionStorage key for previous module (for settings toggle behavior, survives HMR) */
export const PREVIOUS_MODULE_SESSION_KEY = "tka-previous-module-session";

/** sessionStorage key for previous tab (for feedback context, survives HMR) */
export const PREVIOUS_TAB_SESSION_KEY = "tka-previous-tab-session";

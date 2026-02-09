/**
 * Device Matrix & Route Definitions for Multi-Device Screenshot Testing
 *
 * 9 device presets covering phones, tablets, and desktops.
 * Route definitions for both public pages (no auth) and SPA modules (auth required).
 */

// ─── Device Presets ───────────────────────────────────────────────────────────

export interface DevicePreset {
  slug: string;
  name: string;
  category: "phone" | "tablet" | "desktop";
  width: number;
  height: number;
  deviceScaleFactor: number;
  isMobile: boolean;
  hasTouch: boolean;
}

export const DEVICES: DevicePreset[] = [
  // Phones
  {
    slug: "iphone-se",
    name: "iPhone SE",
    category: "phone",
    width: 375,
    height: 667,
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
  },
  {
    slug: "iphone-16-pro",
    name: "iPhone 16 Pro",
    category: "phone",
    width: 393,
    height: 852,
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
  },
  {
    slug: "iphone-16-pro-max",
    name: "iPhone 16 Pro Max",
    category: "phone",
    width: 430,
    height: 932,
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
  },
  {
    slug: "galaxy-s24",
    name: "Galaxy S24",
    category: "phone",
    width: 360,
    height: 780,
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
  },
  {
    slug: "galaxy-s24-ultra",
    name: "Galaxy S24 Ultra",
    category: "phone",
    width: 412,
    height: 915,
    deviceScaleFactor: 3.5,
    isMobile: true,
    hasTouch: true,
  },
  // Tablets
  {
    slug: "ipad-mini",
    name: "iPad Mini",
    category: "tablet",
    width: 768,
    height: 1024,
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
  },
  {
    slug: "ipad-air",
    name: "iPad Air",
    category: "tablet",
    width: 820,
    height: 1180,
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
  },
  // Desktops
  {
    slug: "desktop-hd",
    name: "Desktop HD",
    category: "desktop",
    width: 1366,
    height: 768,
    deviceScaleFactor: 1,
    isMobile: false,
    hasTouch: false,
  },
  {
    slug: "desktop-fhd",
    name: "Desktop FHD",
    category: "desktop",
    width: 1920,
    height: 1080,
    deviceScaleFactor: 1,
    isMobile: false,
    hasTouch: false,
  },
];

// ─── Device Filter Helpers ────────────────────────────────────────────────────

export function phones(): DevicePreset[] {
  return DEVICES.filter((d) => d.category === "phone");
}

export function tablets(): DevicePreset[] {
  return DEVICES.filter((d) => d.category === "tablet");
}

export function desktops(): DevicePreset[] {
  return DEVICES.filter((d) => d.category === "desktop");
}

export function filterDevices(
  category?: "phone" | "tablet" | "desktop"
): DevicePreset[] {
  if (!category) return DEVICES;
  return DEVICES.filter((d) => d.category === category);
}

// ─── Route Definitions ────────────────────────────────────────────────────────

export interface RouteConfig {
  path: string;
  label: string;
  requiresAuth: boolean;
  isModule: boolean;
  moduleId?: string;
  tabId?: string;
  waitSelector?: string;
}

export const PUBLIC_ROUTES: RouteConfig[] = [
  {
    path: "/landing",
    label: "landing",
    requiresAuth: false,
    isModule: false,
    waitSelector: ".landing-page",
  },
  {
    path: "/about",
    label: "about",
    requiresAuth: false,
    isModule: false,
    waitSelector: ".about-page",
  },
  {
    path: "/privacy",
    label: "privacy",
    requiresAuth: false,
    isModule: false,
    waitSelector: ".privacy-page",
  },
  {
    path: "/terms",
    label: "terms",
    requiresAuth: false,
    isModule: false,
    waitSelector: ".terms-page",
  },
  {
    path: "/roots",
    label: "roots",
    requiresAuth: false,
    isModule: false,
    waitSelector: ".roots-page",
  },
];

export const APP_MODULES: RouteConfig[] = [
  // Create module
  {
    path: "/app",
    label: "create--constructor",
    requiresAuth: true,
    isModule: true,
    moduleId: "create",
    tabId: "constructor",
    waitSelector: ".option-picker, .option-grid",
  },
  {
    path: "/app",
    label: "create--generator",
    requiresAuth: true,
    isModule: true,
    moduleId: "create",
    tabId: "generator",
    waitSelector: ".generate-panel, .card-based-settings",
  },
  {
    path: "/app",
    label: "create--spell",
    requiresAuth: true,
    isModule: true,
    moduleId: "create",
    tabId: "spell",
    waitSelector: ".spell-panel",
  },
  // Browse module
  {
    path: "/app",
    label: "browse--gallery",
    requiresAuth: true,
    isModule: true,
    moduleId: "browse",
    tabId: "gallery",
    waitSelector: ".sequence-card, .browse-grid",
  },
  {
    path: "/app",
    label: "browse--creators",
    requiresAuth: true,
    isModule: true,
    moduleId: "browse",
    tabId: "creators",
    waitSelector: ".creators-panel",
  },
  // Compose module
  {
    path: "/app",
    label: "compose--arrange",
    requiresAuth: true,
    isModule: true,
    moduleId: "compose",
    tabId: "arrange",
    waitSelector: ".animator-canvas, .playback-tab",
  },
  // Learn module
  {
    path: "/app",
    label: "learn--concepts",
    requiresAuth: true,
    isModule: true,
    moduleId: "learn",
    tabId: "concepts",
    waitSelector: ".concept-card, .concepts-tab",
  },
  {
    path: "/app",
    label: "learn--codex",
    requiresAuth: true,
    isModule: true,
    moduleId: "learn",
    tabId: "codex",
    waitSelector: ".codex-component",
  },
  // Train module
  {
    path: "/app",
    label: "train--practice",
    requiresAuth: true,
    isModule: true,
    moduleId: "train",
    tabId: "practice",
    waitSelector: ".practice-panel, .train-module",
  },
  // Settings module
  {
    path: "/app",
    label: "settings--profile",
    requiresAuth: true,
    isModule: true,
    moduleId: "settings",
    tabId: "profile",
  },
  {
    path: "/app",
    label: "settings--background",
    requiresAuth: true,
    isModule: true,
    moduleId: "settings",
    tabId: "background",
    waitSelector: ".background-selector, .ios-background-card",
  },
  {
    path: "/app",
    label: "settings--visibility",
    requiresAuth: true,
    isModule: true,
    moduleId: "settings",
    tabId: "visibility",
    waitSelector: ".visibility-tab, .animation-panel",
  },
  // Feedback module
  {
    path: "/app",
    label: "feedback",
    requiresAuth: true,
    isModule: true,
    moduleId: "feedback",
  },
];

export const ALL_ROUTES: RouteConfig[] = [...PUBLIC_ROUTES, ...APP_MODULES];

// ─── Route Matching ───────────────────────────────────────────────────────────

/**
 * Filter routes by user-supplied patterns.
 * Matches against path, moduleId, label, or tabId.
 * Examples: "/landing", "browse", "create--generator", "settings"
 */
export function matchRoutes(
  routes: RouteConfig[],
  patterns: string[]
): RouteConfig[] {
  if (patterns.length === 0) return routes;

  return routes.filter((route) => {
    return patterns.some((pattern) => {
      const p = pattern.toLowerCase().replace(/^\//, "");
      return (
        route.path.toLowerCase().replace(/^\//, "") === p ||
        route.label.toLowerCase() === p ||
        route.label.toLowerCase().startsWith(p + "--") ||
        route.moduleId?.toLowerCase() === p ||
        route.tabId?.toLowerCase() === p
      );
    });
  });
}

// ─── Storage Keys (must match src/lib/shared/navigation/config/storage-keys.ts) ─

export const STORAGE_KEYS = {
  CURRENT_MODULE: "tka-current-module",
  ACTIVE_TAB: "tka-active-tab",
  MODULE_LAST_TABS: "tka-module-last-tabs",
  LAST_SEEN_VERSION: "tka-last-seen-version",
  LANDING_DISMISSED: "tka-landing-dismissed",
  MODERN_SETTINGS: "tka-modern-web-settings",
} as const;

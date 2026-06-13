/**
 * Theme Service - Dynamic Theme Detection and Application
 *
 * Copies theme-specific legacy CSS variables (defined in app.css, e.g.
 * `--panel-bg-cosmic`) into their `-current` counterparts when the active
 * background changes.
 */

const SETTINGS_KEY = "tka-modern-web-settings";
const DEFAULT_THEME = "cosmic";

interface StoredThemeSettings {
  backgroundType?: string;
}

function getCurrentTheme(): string {
  if (typeof window === "undefined" || typeof localStorage === "undefined") {
    return DEFAULT_THEME;
  }

  try {
    const stored = localStorage.getItem(SETTINGS_KEY);
    if (stored) {
      const settings = JSON.parse(stored) as StoredThemeSettings;
      if (typeof settings.backgroundType === "string" && settings.backgroundType) {
        return settings.backgroundType;
      }
    }
  } catch (error) {
    console.warn("Failed to load current theme:", error);
  }

  return DEFAULT_THEME;
}

function applyCurrentTheme(theme: string = getCurrentTheme()): void {
  if (typeof window === "undefined" || typeof document === "undefined") {
    return;
  }

  const root = document.documentElement;

  // Legacy variables with per-theme definitions in app.css.
  // (The former dropdown-* entries were removed 2026-06 — no `--dropdown-*`
  // variables are defined or consumed anywhere in src.)
  const themeVariables = [
    "header-bg", "header-border", "header-text",
    "panel-bg", "panel-border", "panel-hover", "card-bg", "card-border",
    "card-hover", "text-primary", "text-secondary", "input-bg", "input-border",
    "input-focus", "button-active",
  ];

  themeVariables.forEach((variable) => {
    const themeSpecificVar = `--${variable}-${theme}`;
    const currentVar = `--${variable}-current`;

    const themeValue =
      getComputedStyle(root).getPropertyValue(themeSpecificVar);

    if (themeValue) {
      root.style.setProperty(currentVar, themeValue);
    }
  });
}

export function initializeTheme(): void {
  applyCurrentTheme();

  if (typeof window !== "undefined") {
    window.addEventListener("storage", (event) => {
      if (event.key === SETTINGS_KEY) {
        applyCurrentTheme();
      }
    });
  }
}

export function updateTheme(newTheme: string): void {
  // Apply the theme the caller passed rather than re-reading localStorage —
  // some callers (settings-state migration path) invoke this BEFORE persisting,
  // so a localStorage read here would apply the stale previous theme.
  applyCurrentTheme(newTheme);
}

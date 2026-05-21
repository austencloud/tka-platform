/**
 * Theme Service - Dynamic Theme Detection and Application
 */

const SETTINGS_KEY = "tka-modern-web-settings";
const DEFAULT_THEME = "cosmic";

export function getCurrentTheme(): string {
  if (typeof window === "undefined" || typeof localStorage === "undefined") {
    return DEFAULT_THEME;
  }

  try {
    const stored = localStorage.getItem(SETTINGS_KEY);
    if (stored) {
      const settings = JSON.parse(stored);
      return settings.backgroundType || DEFAULT_THEME;
    }
  } catch (error) {
    console.warn("Failed to load current theme:", error);
  }

  return DEFAULT_THEME;
}

export function applyCurrentTheme(): void {
  if (typeof window === "undefined" || typeof document === "undefined") {
    return;
  }

  const currentTheme = getCurrentTheme();
  const root = document.documentElement;

  const themeVariables = [
    "dropdown-bg", "dropdown-text", "dropdown-description", "dropdown-hover",
    "dropdown-current", "header-bg", "header-border", "header-text",
    "panel-bg", "panel-border", "panel-hover", "card-bg", "card-border",
    "card-hover", "text-primary", "text-secondary", "input-bg", "input-border",
    "input-focus", "button-active",
  ];

  themeVariables.forEach((variable) => {
    const themeSpecificVar = `--${variable}-${currentTheme}`;
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

export function updateTheme(_newTheme: string): void {
  applyCurrentTheme();
}

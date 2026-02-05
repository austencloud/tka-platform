/**
 * Theme Service - Dynamic Theme Detection and Application
 *
 * Handles detection of the current background theme and applies appropriate
 * CSS variables for consistent theming across components like dropdowns,
 * option picker headers, and other UI elements.
 */

export class ThemeService {
  private static readonly SETTINGS_KEY = "tka-modern-web-settings";
  private static readonly DEFAULT_THEME = "nightSky";

  /**
   * Get the current background theme from localStorage
   */
  static getCurrentTheme(): string {
    if (typeof window === "undefined" || typeof localStorage === "undefined") {
      return this.DEFAULT_THEME;
    }

    try {
      const stored = localStorage.getItem(this.SETTINGS_KEY);
      if (stored) {
        const settings = JSON.parse(stored);
        return settings.backgroundType || this.DEFAULT_THEME;
      }
    } catch (error) {
      console.warn("Failed to load current theme:", error);
    }

    return this.DEFAULT_THEME;
  }

  /**
   * Apply the current theme to CSS variables
   * This updates the --dropdown-*-current variables to match the active background
   */
  static applyCurrentTheme(): void {
    if (typeof window === "undefined" || typeof document === "undefined") {
      return;
    }

    const currentTheme = this.getCurrentTheme();
    const root = document.documentElement;

    // Map of theme CSS variable suffixes
    const themeVariables = [
      "dropdown-bg",
      "dropdown-text",
      "dropdown-description",
      "dropdown-hover",
      "dropdown-current",
      "header-bg",
      "header-border",
      "header-text",
      "panel-bg",
      "panel-border",
      "panel-hover",
      "card-bg",
      "card-border",
      "card-hover",
      "text-primary",
      "text-secondary",
      "input-bg",
      "input-border",
      "input-focus",
      "button-active",
    ];

    // Update each variable to use the current theme
    themeVariables.forEach((variable) => {
      const themeSpecificVar = `--${variable}-${currentTheme}`;
      const currentVar = `--${variable}-current`;

      // Get the theme-specific value
      const themeValue =
        getComputedStyle(root).getPropertyValue(themeSpecificVar);

      if (themeValue) {
        root.style.setProperty(currentVar, themeValue);
      }
    });
  }

  /**
   * Initialize theme service - should be called on app startup
   */
  static initialize(): void {
    this.applyCurrentTheme();

    // Listen for storage changes to update theme dynamically
    if (typeof window !== "undefined") {
      window.addEventListener("storage", (event) => {
        if (event.key === this.SETTINGS_KEY) {
          this.applyCurrentTheme();
        }
      });
    }
  }

  /**
   * Force theme update - useful when background changes
   */
  static updateTheme(_newTheme: string): void {
    this.applyCurrentTheme();
  }
}

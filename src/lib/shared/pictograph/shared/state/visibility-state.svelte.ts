/**
 * Visibility State Manager - Modern Web Implementation
 *
 * Replicates the sophisticated visibility system from the legacy desktop app.
 * Manages complex dependencies between motion visibility and dependent glyphs.
 *
 * Persistence: Settings are saved to AppSettings and synced via SettingsState
 * to localStorage (immediate) and Firebase (authenticated users).
 */

import type { AppSettings } from "../../../settings/domain/AppSettings";
import type { ISettingsState } from "../../../settings/services/contracts/ISettingsState";
import { MotionColor } from "../domain/enums/pictograph-enums";
import { createComponentLogger } from "$lib/shared/utils/debug-logger";
import { browser } from "$app/environment";

const debug = createComponentLogger("VisibilityManager");

// Lazy import to avoid circular dependencies
let settingsServiceInstance: ISettingsState | null = null;

async function getSettingsService(): Promise<ISettingsState | null> {
  if (!browser) return null;
  if (!settingsServiceInstance) {
    const { settingsService } =
      await import("../../../settings/state/SettingsState.svelte");
    settingsServiceInstance = settingsService;
  }
  return settingsServiceInstance;
}

type VisibilityObserver = () => void;

type VisibilityCategory = "glyph" | "motion" | "non_radial" | "all" | "buttons";

interface VisibilitySettings {
  // Motion visibility (independent)
  redMotion: boolean;
  blueMotion: boolean;

  // Independent glyphs
  reversalIndicators: boolean;

  // Dependent glyphs (only available when both motions are visible)
  tkaGlyph: boolean; // TKA Glyph includes turn numbers
  vtgGlyph: boolean;
  elementalGlyph: boolean;
  positionsGlyph: boolean;

  // Grid visibility (master toggle)
  showGrid: boolean; // When false, entire grid is hidden
  // Grid sub-options (only relevant when showGrid is true)
  nonRadialPoints: boolean;
  handPointVisibility: "all" | "active"; // Show all hand points or only where props are
}

export class VisibilityStateManager {
  private settings: VisibilitySettings;
  private observers: Map<VisibilityCategory, Set<VisibilityObserver>> =
    new Map();

  // Dependent glyphs that require both motions to be visible
  private readonly DEPENDENT_GLYPHS = [
    "tkaGlyph",
    "vtgGlyph",
    "elementalGlyph",
    "positionsGlyph",
  ];

  // Promise that resolves when settings are fully loaded
  private settingsLoadedPromise: Promise<void> | null = null;
  private settingsLoadedResolve: (() => void) | null = null;

  constructor(initialSettings?: Partial<AppSettings>) {
    // Initialize with defaults matching desktop app
    this.settings = {
      // Motion defaults - both visible
      redMotion: true,
      blueMotion: true,

      // Independent glyph defaults
      reversalIndicators: true,

      // Dependent glyph defaults (TKA includes turn numbers)
      tkaGlyph: true,
      vtgGlyph: false,
      elementalGlyph: false,
      positionsGlyph: false,

      // Grid defaults
      showGrid: true, // Grid visible by default
      nonRadialPoints: false,
      handPointVisibility: "all", // Default to showing all hand points

      // Override with any provided settings
      ...this.convertAppSettingsToVisibility(initialSettings),
    };

    // Initialize observer categories
    this.observers.set("glyph", new Set());
    this.observers.set("motion", new Set());
    this.observers.set("non_radial", new Set());
    this.observers.set("all", new Set());
    this.observers.set("buttons", new Set());

    // Load persisted settings asynchronously (browser only)
    if (browser) {
      // Create a promise that resolves when settings are loaded
      this.settingsLoadedPromise = new Promise((resolve) => {
        this.settingsLoadedResolve = resolve;
      });
      this.loadPersistedSettings();
    }
  }

  /**
   * Ensure settings have been loaded from persistence
   * Call this before reading settings in async contexts (e.g., image export)
   */
  async ensureSettingsLoaded(): Promise<void> {
    debug.log(
      "ensureSettingsLoaded called, promise exists:",
      !!this.settingsLoadedPromise
    );
    if (this.settingsLoadedPromise) {
      await this.settingsLoadedPromise;
      debug.log(
        "ensureSettingsLoaded completed, current settings:",
        this.settings
      );
    }
  }

  /**
   * Load visibility settings from persisted storage
   */
  private async loadPersistedSettings(): Promise<void> {
    debug.log("loadPersistedSettings: Starting async load...");
    try {
      const service = await getSettingsService();
      debug.log(
        "loadPersistedSettings: Got settings service, visibility data:",
        service?.settings?.visibility
      );

      if (service?.settings?.visibility) {
        const v = service.settings.visibility;
        debug.log("Loading persisted visibility settings", v);

        // Apply persisted settings (only if they exist)
        if (v.tkaGlyph !== undefined) this.settings.tkaGlyph = v.tkaGlyph;
        if (v.vtgGlyph !== undefined) this.settings.vtgGlyph = v.vtgGlyph;
        if (v.elementalGlyph !== undefined)
          this.settings.elementalGlyph = v.elementalGlyph;
        if (v.positionsGlyph !== undefined)
          this.settings.positionsGlyph = v.positionsGlyph;
        if (v.reversalIndicators !== undefined)
          this.settings.reversalIndicators = v.reversalIndicators;
        if (v.showGrid !== undefined)
          this.settings.showGrid = v.showGrid;
        if (v.nonRadialPoints !== undefined)
          this.settings.nonRadialPoints = v.nonRadialPoints;
        if (v.handPointVisibility !== undefined)
          this.settings.handPointVisibility = v.handPointVisibility;

        debug.log(
          "loadPersistedSettings: Applied settings, result:",
          this.settings
        );
        // Notify observers that settings have been loaded
        this.notifyObservers(["all"]);
      } else {
        debug.log(
          "loadPersistedSettings: No visibility settings found in persistence, using defaults"
        );
      }
    } finally {
      // Always resolve the settings loaded promise, even if loading fails
      // This prevents blocking indefinitely on ensureSettingsLoaded()
      debug.log(
        "loadPersistedSettings: Resolving promise, final settings:",
        this.settings
      );
      if (this.settingsLoadedResolve) {
        this.settingsLoadedResolve();
        this.settingsLoadedResolve = null;
      }
    }
  }

  /**
   * Persist current visibility settings to storage
   */
  private async persistSettings(): Promise<void> {
    const service = await getSettingsService();
    if (!service) return;

    const visibilitySettings = {
      tkaGlyph: this.settings.tkaGlyph,
      vtgGlyph: this.settings.vtgGlyph,
      elementalGlyph: this.settings.elementalGlyph,
      positionsGlyph: this.settings.positionsGlyph,
      reversalIndicators: this.settings.reversalIndicators,
      showGrid: this.settings.showGrid,
      nonRadialPoints: this.settings.nonRadialPoints,
      handPointVisibility: this.settings.handPointVisibility,
    };

    debug.log("Persisting visibility settings", visibilitySettings);
    await service.updateSetting("visibility", visibilitySettings);
  }

  /**
   * Convert AppSettings visibility format to internal format
   */
  private convertAppSettingsToVisibility(
    _appSettings?: Partial<AppSettings>
  ): Partial<VisibilitySettings> {
    // Visibility settings are no longer in AppSettings, return defaults
    return {};
  }

  /**
   * Convert internal visibility format to AppSettings format
   * Note: Visibility settings are no longer part of AppSettings
   */
  public toAppSettings(): Record<string, boolean> {
    return {
      tkaGlyph: this.settings.tkaGlyph,
      reversalIndicators: this.settings.reversalIndicators,
      vtgGlyph: this.settings.vtgGlyph,
      elementalGlyph: this.settings.elementalGlyph,
      positionsGlyph: this.settings.positionsGlyph,
      nonRadialPoints: this.settings.nonRadialPoints,
    };
  }

  /**
   * Register an observer for visibility changes
   */
  registerObserver(
    callback: VisibilityObserver,
    categories: VisibilityCategory[] = ["all"]
  ): void {
    categories.forEach((category) => {
      if (!this.observers.has(category)) {
        this.observers.set(category, new Set());
      }
      const categoryObservers = this.observers.get(category);
      if (categoryObservers) {
        categoryObservers.add(callback);
      }
    });
  }

  /**
   * Unregister an observer
   */
  unregisterObserver(callback: VisibilityObserver): void {
    this.observers.forEach((observerSet) => {
      observerSet.delete(callback);
    });
  }

  /**
   * Notify observers of changes
   */
  private notifyObservers(categories: VisibilityCategory[]): void {
    const callbacksToNotify = new Set<VisibilityObserver>();

    // Collect callbacks from specific categories
    categories.forEach((category) => {
      const observers = this.observers.get(category);
      if (observers) {
        debug.log(
          `Notifying ${observers.size} observers for category: ${category}`
        );
        observers.forEach((callback) => callbacksToNotify.add(callback));
      }
    });

    // Always notify "all" observers
    const allObservers = this.observers.get("all");
    if (allObservers) {
      debug.log(`Notifying ${allObservers.size} "all" observers`);
      allObservers.forEach((callback) => callbacksToNotify.add(callback));
    }

    debug.log(`Total callbacks to execute: ${callbacksToNotify.size}`);

    // Execute callbacks
    callbacksToNotify.forEach((callback) => {
      try {
        callback();
      } catch (error) {
        console.error("Error in visibility observer:", error);
      }
    });
  }

  // ============================================================================
  // MOTION VISIBILITY
  // ============================================================================

  /**
   * Get motion visibility for a specific color
   */
  getMotionVisibility(color: MotionColor): boolean {
    return this.settings[
      `${color}Motion` as keyof VisibilitySettings
    ] as boolean;
  }

  /**
   * Set motion visibility with constraint enforcement
   */
  setMotionVisibility(color: MotionColor, visible: boolean): void {
    const otherColor =
      color === MotionColor.RED ? MotionColor.BLUE : MotionColor.RED;

    const colorMotionKey = `${color}Motion` as keyof VisibilitySettings;
    const otherColorMotionKey =
      `${otherColor}Motion` as keyof VisibilitySettings;

    // Enforce constraint: at least one motion must remain visible
    if (!visible && !this.settings[otherColorMotionKey]) {
      // If trying to turn off the last visible motion, turn on the other one
      this.settings[colorMotionKey] = false;
      this.settings[otherColorMotionKey] = true;
      this.notifyObservers(["motion", "glyph", "buttons"]);
      return;
    }

    // Normal case
    this.settings[colorMotionKey] = visible;
    this.notifyObservers(["motion", "glyph", "buttons"]);
  }

  /**
   * Check if all motions are visible
   */
  areAllMotionsVisible(): boolean {
    return this.settings.redMotion && this.settings.blueMotion;
  }

  /**
   * Check if any motion is visible
   */
  isAnyMotionVisible(): boolean {
    return this.settings.redMotion || this.settings.blueMotion;
  }

  /**
   * Save current motion visibility state (for temporary overrides)
   */
  saveMotionVisibilityState(): { blue: boolean; red: boolean } {
    return {
      blue: this.settings.blueMotion,
      red: this.settings.redMotion,
    };
  }

  /**
   * Restore saved motion visibility state (after temporary overrides)
   */
  restoreMotionVisibilityState(savedState: {
    blue: boolean;
    red: boolean;
  }): void {
    this.settings.blueMotion = savedState.blue;
    this.settings.redMotion = savedState.red;
    this.notifyObservers(["motion", "glyph", "buttons"]);
  }

  // ============================================================================
  // GLYPH VISIBILITY
  // ============================================================================

  /**
   * Get glyph visibility considering dependencies
   */
  getGlyphVisibility(glyphType: string): boolean {
    const baseVisibility =
      (this.settings[glyphType as keyof VisibilitySettings] as boolean) ??
      false;

    // For dependent glyphs, also check if both motions are visible
    if (this.DEPENDENT_GLYPHS.includes(glyphType)) {
      return baseVisibility && this.areAllMotionsVisible();
    }

    // For independent glyphs, return direct visibility
    return baseVisibility;
  }

  /**
   * Set glyph visibility
   */
  setGlyphVisibility(glyphType: string, visible: boolean): void {
    if (glyphType in this.settings) {
      (this.settings as unknown as Record<string, boolean>)[glyphType] =
        visible;
      debug.log("Notifying observers for glyph change");
      this.notifyObservers(["glyph"]);
      // Persist to storage (async, non-blocking)
      void this.persistSettings();
    }
  }

  /**
   * Get raw glyph visibility (user preference, ignoring dependencies)
   */
  getRawGlyphVisibility(glyphType: string): boolean {
    return (
      (this.settings[glyphType as keyof VisibilitySettings] as boolean) ?? false
    );
  }

  /**
   * Check if glyph is dependent on motion visibility
   */
  isGlyphDependent(glyphType: string): boolean {
    return this.DEPENDENT_GLYPHS.includes(glyphType);
  }

  // ============================================================================
  // GRID VISIBILITY (MASTER TOGGLE)
  // ============================================================================

  /**
   * Get grid visibility (master toggle)
   * When false, entire grid is hidden
   */
  getGridVisibility(): boolean {
    return this.settings.showGrid;
  }

  /**
   * Set grid visibility (master toggle)
   */
  setGridVisibility(visible: boolean): void {
    this.settings.showGrid = visible;
    this.notifyObservers(["all"]);
    // Persist to storage (async, non-blocking)
    void this.persistSettings();
  }

  // ============================================================================
  // NON-RADIAL POINTS
  // ============================================================================

  /**
   * Get non-radial points visibility
   */
  getNonRadialVisibility(): boolean {
    return this.settings.nonRadialPoints;
  }

  /**
   * Set non-radial points visibility
   */
  setNonRadialVisibility(visible: boolean): void {
    this.settings.nonRadialPoints = visible;
    this.notifyObservers(["non_radial"]);
    // Persist to storage (async, non-blocking)
    void this.persistSettings();
  }

  // ============================================================================
  // HAND POINT VISIBILITY
  // ============================================================================

  /**
   * Get hand point visibility mode
   * "all" = show all hand points, "active" = show only where props are
   */
  getHandPointVisibility(): "all" | "active" {
    return this.settings.handPointVisibility;
  }

  /**
   * Set hand point visibility mode
   */
  setHandPointVisibility(mode: "all" | "active"): void {
    this.settings.handPointVisibility = mode;
    this.notifyObservers(["all"]);
    // Persist to storage (async, non-blocking)
    void this.persistSettings();
  }

  // ============================================================================
  // DARK MODE (reads from shared animation visibility state)
  // ============================================================================

  /**
   * Get dark mode status from the shared animation visibility state
   * Dark Mode: dark background + inverted grid
   */
  getDarkMode(): boolean {
    // Lazy load the animation visibility manager to avoid circular dependency
    if (!this._animationVisibilityManager) {
      this._loadAnimationVisibilityManager();
    }
    return this._animationVisibilityManager?.isDarkMode() ?? false;
  }

  // Lazy-loaded reference to animation visibility manager
  private _animationVisibilityManager: { isDarkMode(): boolean } | null = null;

  /**
   * Load the animation visibility manager lazily
   */
  private _loadAnimationVisibilityManager(): void {
    try {
      // Use dynamic import pattern that ESLint accepts
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const module = require("../../../animation-engine/state/animation-visibility-state.svelte") as {
        getAnimationVisibilityManager: () => { isDarkMode(): boolean };
      };
      this._animationVisibilityManager = module.getAnimationVisibilityManager();
    } catch {
      // Module not loaded yet or error - dark mode will default to false
    }
  }

  // ============================================================================
  // UTILITY METHODS
  // ============================================================================

  /**
   * Get all visible glyph types
   */
  getVisibleGlyphs(): string[] {
    return [
      "tkaGlyph",
      "reversalIndicators",
      "vtgGlyph",
      "elementalGlyph",
      "positionsGlyph",
    ].filter((glyph) => this.getGlyphVisibility(glyph));
  }

  /**
   * Get all enabled dependent glyphs (considering motion constraints)
   */
  getAvailableDependentGlyphs(): string[] {
    if (!this.areAllMotionsVisible()) {
      return [];
    }
    return this.DEPENDENT_GLYPHS.filter((glyph) =>
      this.getRawGlyphVisibility(glyph)
    );
  }

  /**
   * Update from external AppSettings
   */
  updateFromAppSettings(appSettings: AppSettings): void {
    const visibilityUpdate = this.convertAppSettingsToVisibility(appSettings);
    Object.assign(this.settings, visibilityUpdate);
    this.notifyObservers(["all"]);
  }

  /**
   * Get complete visibility state for debugging
   */
  getState(): VisibilitySettings {
    return { ...this.settings };
  }
}

// Global instance for the application
let globalVisibilityStateManager: VisibilityStateManager | null = null;

/**
 * Get or create the global visibility state manager
 */
export function getVisibilityStateManager(
  initialSettings?: Partial<AppSettings>
): VisibilityStateManager {
  if (!globalVisibilityStateManager) {
    globalVisibilityStateManager = new VisibilityStateManager(initialSettings);
  }
  return globalVisibilityStateManager;
}

/**
 * Reset the global visibility state manager (useful for testing)
 */
export function resetVisibilityStateManager(): void {
  globalVisibilityStateManager = null;
}

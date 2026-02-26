/**
 * Animation Visibility State Manager
 *
 * Manages visibility settings specifically for animation playback.
 * Independent from pictograph visibility but can sync from it.
 */

type VisibilityObserver = () => void;

/**
 * Cached motion colors computed from CSS variables.
 * Updated once when dark mode changes instead of each component calling getComputedStyle().
 */
export interface MotionColorsCache {
  blue: string;
  red: string;
  grid: string;
}

// Trail toggle - simplified from off/subtle/vivid to just on/off
export type TrailVisibility = "off" | "on";
export type GridMode = "none" | "diamond" | "box";
export type PlaybackMode = "continuous" | "step";

interface AnimationVisibilitySettings {
  // Animation-specific elements (no pictograph equivalent)
  gridMode: GridMode; // Grid visualization mode (3-state)
  stepNumbers: boolean; // "Beat 1, 2, 3..." overlay at top-left
  beatPosition: boolean; // Musical beat position at bottom-center (1, 1.5, 2e, etc.)
  props: boolean; // Show props vs trails-only mode
  trailStyle: TrailVisibility; // Trail visualization style (3-state)
  playbackMode: PlaybackMode; // Continuous flow vs step-by-step
  speed: number; // Speed multiplier (1.0 = 60 BPM, range 0.1-3.0)
  wordHeader: boolean; // Word/sequence name header at top
  progressBar: boolean; // Segmented progress bar in word header

  // Global Effects (applies to pictograph, animation, and image export)
  // Dark Mode: dark background, inverted grid, white text/outlines
  darkMode: boolean;

  // Effects
  fireEffect: boolean; // WebGL fire shader at prop tips
  fireColorBlend: number; // 0 = natural fire, 1 = prop-colored (continuous slider)
  fireSmokeLevel: number; // 0 = clean burn, 1 = heavy smoke (continuous slider)
  fireUseCharcoal: boolean; // false = normal fire, true = charcoal (gravity-heavy fluid preset)
  fireIntensity: number; // User intensity slider value (0.0-1.0)

  // LED Effects
  ledEffect: boolean; // WebGL LED overlay
  ledBrightness: number; // 1-5 discrete level (maps to 0.2-1.0 float)
  ledPatternId: string; // Active LED pattern ID
  ledPrimaryColor: string; // Primary color (hex)

  // Shared with pictograph visibility (can sync)
  tkaGlyph: boolean; // TKA Glyph includes turn numbers
  reversalIndicators: boolean;
  blueMotion: boolean;
  redMotion: boolean;
}

const STORAGE_KEY = "animation-visibility-settings";

export class AnimationVisibilityStateManager {
  private settings: AnimationVisibilitySettings;
  private observers: Set<VisibilityObserver> = new Set();

  /**
   * Cached motion colors - computed once when dark mode changes.
   * Components read from this cache instead of each calling getComputedStyle().
   * Defaults match LIGHT mode CSS values (darkMode: false is the default).
   */
  private motionColors: MotionColorsCache = {
    blue: "#3D44B8", // Light mode blue (darker, for light backgrounds)
    red: "#DC2626", // Light mode red
    grid: "#000000", // Light mode grid (black on light background)
  };

  /**
   * Transient flag indicating a sequence transform is in progress.
   * When true, arrow/prop components should disable CSS transitions
   * to avoid janky animation when the final state is applied.
   */
  private transforming: boolean = false;

  constructor() {
    // Load from localStorage or use defaults
    this.settings = this.loadFromStorage() || this.getDefaultSettings();
    // Sync the .dark class on <html> to match persisted state
    this.syncDarkModeClass();
    // Compute initial motion colors from CSS variables
    this.updateMotionColorsCache();
  }

  /**
   * Get default settings
   */
  private getDefaultSettings(): AnimationVisibilitySettings {
    return {
      // Animation-specific defaults
      gridMode: "diamond", // Default to diamond grid
      stepNumbers: false, // Hide beat numbers by default (user requested removal)
      beatPosition: false, // Hide beat position by default (replaced by progress bar)
      props: true,
      trailStyle: "on", // Trails enabled by default (hardcoded vivid style)
      playbackMode: "continuous", // Default to continuous playback
      speed: 1.0, // Default to 60 BPM
      wordHeader: true, // Show word/sequence name by default
      progressBar: true, // Show progress bar by default

      // Global effects
      darkMode: false, // Dark Mode disabled by default

      // Effects
      fireEffect: false, // Fire shader disabled by default
      fireColorBlend: 0.5, // Halfway between natural and prop-colored
      fireSmokeLevel: 0.1, // Light smoke
      fireUseCharcoal: false, // Fluid fire by default
      fireIntensity: 0.7, // 0-1 range, 0.7 = normal fire

      // LED Effects
      ledEffect: false,
      ledBrightness: 5,
      ledPatternId: "solid",
      ledPrimaryColor: "#00ff88",

      // Shared elements - defaults optimized for animation viewing
      tkaGlyph: true, // TKA Glyph includes turn numbers
      reversalIndicators: false, // Less clutter during animation
      blueMotion: true,
      redMotion: true,
    };
  }

  /**
   * Load settings from localStorage with migration support
   */
  private loadFromStorage(): AnimationVisibilitySettings | null {
    if (typeof window === "undefined") return null;

    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);

        // Clean up old propGlow setting if present
        if (parsed.propGlow !== undefined) {
          delete parsed.propGlow;
        }

        // Force beatPosition to false (replaced by progress bar)
        parsed.beatPosition = false;

        // Migrate old flameColorMode (binary) → continuous fireColorBlend
        if ("flameColorMode" in parsed && !("fireColorBlend" in parsed)) {
          parsed.fireColorBlend = parsed.flameColorMode === "natural" ? 0 : 1.0;
          delete parsed.flameColorMode;
        }
        if ("coloredFlames" in parsed && !("fireColorBlend" in parsed)) {
          parsed.fireColorBlend = parsed.coloredFlames ? 1.0 : 0;
          delete parsed.coloredFlames;
        }

        // Migrate old fuelSourceId → fireUseCharcoal boolean
        if ("fuelSourceId" in parsed && !("fireUseCharcoal" in parsed)) {
          parsed.fireUseCharcoal = parsed.fuelSourceId === "charcoal";
          delete parsed.fuelSourceId;
        }

        // Migrate old firePreset (small/medium/large) → 0-1 intensity
        if ("firePreset" in parsed && !("fireIntensity" in parsed)) {
          const tierToIntensity: Record<string, number> = {
            small: 0.3, medium: 0.5, large: 0.8,
            candlewick: 0.3, "fire-spin": 0.5, torch: 0.8,
          };
          parsed.fireIntensity = tierToIntensity[parsed.firePreset as string] ?? 0.7;
          delete (parsed as Record<string, unknown>).firePreset;
        }

        // Migrate old 0.1-3.0 intensity range → 0-1 range
        if ("fireIntensity" in parsed && parsed.fireIntensity > 1.0) {
          parsed.fireIntensity = Math.min(1.0, parsed.fireIntensity / 3.0);
        }

        // Ensure new slider properties exist
        if (!("fireColorBlend" in parsed)) parsed.fireColorBlend = 0.5;
        if (!("fireSmokeLevel" in parsed)) parsed.fireSmokeLevel = 0.1;
        if (!("fireUseCharcoal" in parsed)) parsed.fireUseCharcoal = false;
        if (!("fireIntensity" in parsed)) parsed.fireIntensity = 0.7;

        // Clean up removed keys
        delete parsed.fuelSourceId;
        delete parsed.flameColorMode;

        // Ensure new properties exist with defaults if missing
        const defaults = this.getDefaultSettings();
        return {
          ...defaults,
          ...parsed,
        };
      }
    } catch (err) {
      console.warn(
        "Failed to load animation visibility from localStorage:",
        err
      );
    }
    return null;
  }

  /**
   * Save settings to localStorage
   */
  private saveToStorage(): void {
    if (typeof window === "undefined") return;

    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.settings));
    } catch (err) {
      console.warn("Failed to save animation visibility to localStorage:", err);
    }
  }

  /**
   * Register an observer for visibility changes
   */
  registerObserver(callback: VisibilityObserver): void {
    this.observers.add(callback);
  }

  /**
   * Unregister an observer
   */
  unregisterObserver(callback: VisibilityObserver): void {
    this.observers.delete(callback);
  }

  /**
   * Notify observers of changes
   */
  private notifyObservers(): void {
    this.observers.forEach((callback) => {
      try {
        callback();
      } catch (error) {
        console.error("Error in animation visibility observer:", error);
      }
    });
  }

  // ============================================================================
  // GETTERS
  // ============================================================================

  /**
   * Get specific boolean visibility setting
   * (For gridMode, trailStyle, playbackMode, speed use dedicated getters)
   * (For darkMode, use isDarkMode() instead)
   */
  getVisibility(
    key: Exclude<
      keyof AnimationVisibilitySettings,
      "gridMode" | "trailStyle" | "playbackMode" | "speed" | "darkMode" | "fireColorBlend" | "fireSmokeLevel" | "fireIntensity" | "ledBrightness" | "ledPatternId" | "ledPrimaryColor"
    >
  ): boolean {
    return this.settings[key] as boolean;
  }

  /**
   * Get all settings
   */
  getSettings(): AnimationVisibilitySettings {
    return { ...this.settings };
  }

  // ============================================================================
  // SETTERS
  // ============================================================================

  /**
   * Set specific boolean visibility setting
   * (For gridMode, trailStyle, playbackMode, speed use dedicated setters)
   */
  setVisibility(
    key: Exclude<
      keyof AnimationVisibilitySettings,
      "gridMode" | "trailStyle" | "playbackMode" | "speed" | "fireColorBlend" | "fireSmokeLevel" | "fireIntensity" | "ledBrightness" | "ledPatternId" | "ledPrimaryColor"
    >,
    visible: boolean
  ): void {
    (this.settings as unknown as Record<string, unknown>)[key] = visible;
    this.saveToStorage();
    this.notifyObservers();
  }

  /**
   * Update multiple settings at once
   */
  updateSettings(updates: Partial<AnimationVisibilitySettings>): void {
    Object.assign(this.settings, updates);
    this.saveToStorage();
    this.notifyObservers();
  }

  /**
   * Sync shared settings from pictograph visibility
   * (Only syncs keys that exist in both systems)
   */
  syncFromPictographVisibility(pictographSettings: {
    tkaGlyph: boolean;
    reversalIndicators: boolean;
    blueMotion: boolean;
    redMotion: boolean;
  }): void {
    this.settings.tkaGlyph = pictographSettings.tkaGlyph;
    this.settings.reversalIndicators = pictographSettings.reversalIndicators;
    this.settings.blueMotion = pictographSettings.blueMotion;
    this.settings.redMotion = pictographSettings.redMotion;

    this.saveToStorage();
    this.notifyObservers();
  }

  /**
   * Reset to defaults
   */
  resetToDefaults(): void {
    this.settings = this.getDefaultSettings();
    this.saveToStorage();
    this.notifyObservers();
  }

  // ============================================================================
  // SPECIFIC GETTERS/SETTERS FOR 3-STATE SETTINGS
  // ============================================================================

  /**
   * Get current trail visibility
   */
  getTrailStyle(): TrailVisibility {
    return this.settings.trailStyle;
  }

  /**
   * Set trail visibility
   */
  setTrailStyle(style: TrailVisibility): void {
    this.settings.trailStyle = style;
    this.saveToStorage();
    this.notifyObservers();
  }

  /**
   * Get current grid mode
   */
  getGridMode(): GridMode {
    return this.settings.gridMode;
  }

  /**
   * Set grid mode
   */
  setGridMode(mode: GridMode): void {
    this.settings.gridMode = mode;
    this.saveToStorage();
    this.notifyObservers();
  }

  /**
   * Check if trails are visible (any style except 'off')
   */
  isTrailsVisible(): boolean {
    return this.settings.trailStyle !== "off";
  }

  /**
   * Check if grid is visible (any mode except 'none')
   */
  isGridVisible(): boolean {
    return this.settings.gridMode !== "none";
  }

  /**
   * Get current playback mode
   */
  getPlaybackMode(): PlaybackMode {
    return this.settings.playbackMode;
  }

  /**
   * Set playback mode
   */
  setPlaybackMode(mode: PlaybackMode): void {
    this.settings.playbackMode = mode;
    this.saveToStorage();
    this.notifyObservers();
  }

  /**
   * Get current speed (multiplier where 1.0 = 60 BPM)
   */
  getSpeed(): number {
    return this.settings.speed;
  }

  /**
   * Get current BPM (speed * 60)
   */
  getBpm(): number {
    return Math.round(this.settings.speed * 60);
  }

  /**
   * Set speed (multiplier where 1.0 = 60 BPM)
   */
  setSpeed(speed: number): void {
    this.settings.speed = Math.max(0.1, Math.min(3.0, speed));
    this.saveToStorage();
    this.notifyObservers();
  }

  /**
   * Set speed from BPM value
   */
  setBpm(bpm: number): void {
    this.setSpeed(bpm / 60);
  }

  // ============================================================================
  // DARK MODE (formerly "Dark Mode")
  // ============================================================================

  /**
   * Check if dark mode is enabled
   * When enabled: dark background, inverted grid colors, white text/outlines
   */
  isDarkMode(): boolean {
    return this.settings.darkMode;
  }

  /**
   * Set dark mode
   * @param enabled - true for dark mode, false for light mode
   */
  setDarkMode(enabled: boolean): void {
    this.settings.darkMode = enabled;
    this.saveToStorage();
    this.syncDarkModeClass();
    // Update motion colors cache - this also notifies observers after colors are computed
    this.updateMotionColorsCache();
  }

  /**
   * Sync the .dark class on <html> element with current darkMode state.
   * This enables CSS-first dark mode - all components use CSS variables
   * instead of receiving darkMode as a prop.
   */
  private syncDarkModeClass(): void {
    if (typeof document === "undefined") return;

    const htmlElement = document.documentElement;
    if (this.settings.darkMode) {
      htmlElement.classList.add("dark");
    } else {
      htmlElement.classList.remove("dark");
    }
  }

  /**
   * Update the motion colors cache from CSS variables.
   * Called once when dark mode changes instead of each component calling getComputedStyle().
   * Runs synchronously since .dark class is already applied when this is called.
   */
  private updateMotionColorsCache(): void {
    if (typeof document === "undefined") return;

    // Get computed style synchronously - CSS is already applied after syncDarkModeClass()
    const style = getComputedStyle(document.documentElement);

    this.motionColors = {
      blue: style.getPropertyValue("--dm-motion-blue").trim() || "#3D44B8",
      red: style.getPropertyValue("--dm-motion-red").trim() || "#DC2626",
      grid: style.getPropertyValue("--dm-grid-color").trim() || "#000000",
    };

    // Notify observers synchronously for consistent animation timing
    this.notifyObservers();
  }

  /**
   * Get cached motion colors.
   * Components should use this instead of calling getComputedStyle() directly.
   */
  getMotionColors(): MotionColorsCache {
    return this.motionColors;
  }

  /**
   * Toggle dark mode
   */
  toggleDarkMode(): void {
    this.setDarkMode(!this.settings.darkMode);
  }

  // ============================================================================
  // FIRE EFFECT
  // ============================================================================

  /**
   * Check if fire effect is enabled
   */
  isFireEffectEnabled(): boolean {
    return this.settings.fireEffect;
  }

  /**
   * Set fire effect
   */
  setFireEffect(enabled: boolean): void {
    this.settings.fireEffect = enabled;
    this.saveToStorage();
    this.notifyObservers();
  }

  /**
   * Toggle fire effect
   */
  toggleFireEffect(): void {
    this.setFireEffect(!this.settings.fireEffect);
  }

  // ============================================================================
  // FIRE SLIDERS: Color Blend, Smoke Level, Use Charcoal, Intensity
  // ============================================================================

  getFireColorBlend(): number {
    return this.settings.fireColorBlend;
  }

  setFireColorBlend(value: number): void {
    this.settings.fireColorBlend = Math.max(0, Math.min(1, value));
    this.saveToStorage();
    this.notifyObservers();
  }

  getFireSmokeLevel(): number {
    return this.settings.fireSmokeLevel;
  }

  setFireSmokeLevel(value: number): void {
    this.settings.fireSmokeLevel = Math.max(0, Math.min(1, value));
    this.saveToStorage();
    this.notifyObservers();
  }

  getFireUseCharcoal(): boolean {
    return this.settings.fireUseCharcoal;
  }

  setFireUseCharcoal(value: boolean): void {
    this.settings.fireUseCharcoal = value;
    this.saveToStorage();
    this.notifyObservers();
  }

  getFireIntensity(): number {
    return this.settings.fireIntensity;
  }

  setFireIntensity(intensity: number): void {
    this.settings.fireIntensity = Math.max(0, Math.min(1, intensity));
    this.saveToStorage();
    this.notifyObservers();
  }

  // ============================================================================
  // LED EFFECT
  // ============================================================================

  /**
   * Check if LED effect is enabled
   */
  isLedEffectEnabled(): boolean {
    return this.settings.ledEffect;
  }

  /**
   * Set LED effect
   */
  setLedEffect(enabled: boolean): void {
    this.settings.ledEffect = enabled;
    this.saveToStorage();
    this.notifyObservers();
  }

  /**
   * Toggle LED effect
   */
  toggleLedEffect(): void {
    this.setLedEffect(!this.settings.ledEffect);
  }

  /**
   * Get current LED pattern ID
   */
  getLedPatternId(): string {
    return this.settings.ledPatternId;
  }

  /**
   * Set LED pattern ID
   */
  setLedPatternId(patternId: string): void {
    this.settings.ledPatternId = patternId;
    this.saveToStorage();
    this.notifyObservers();
  }

  /**
   * Get current LED primary color
   */
  getLedPrimaryColor(): string {
    return this.settings.ledPrimaryColor;
  }

  /**
   * Set LED primary color
   */
  setLedPrimaryColor(color: string): void {
    this.settings.ledPrimaryColor = color;
    this.saveToStorage();
    this.notifyObservers();
  }

  /**
   * Get LED brightness level (1-5)
   */
  getLedBrightness(): number {
    return this.settings.ledBrightness;
  }

  /**
   * Set LED brightness level (1-5, clamped)
   */
  setLedBrightness(level: number): void {
    this.settings.ledBrightness = Math.max(1, Math.min(5, Math.round(level)));
    this.saveToStorage();
    this.notifyObservers();
  }

  /**
   * Toggle a boolean visibility setting
   */
  toggleVisibility(
    key: Exclude<
      keyof AnimationVisibilitySettings,
      "gridMode" | "trailStyle" | "playbackMode" | "speed" | "darkMode" | "fireColorBlend" | "fireSmokeLevel" | "fireIntensity" | "ledBrightness" | "ledPatternId" | "ledPrimaryColor"
    >
  ): void {
    this.setVisibility(key, !(this.settings[key] as boolean));
  }

  // ============================================================================
  // TRANSFORM STATE (transient, not persisted)
  // ============================================================================

  /**
   * Check if a sequence transform is currently in progress.
   * Arrow/prop components use this to disable CSS transitions.
   */
  isTransforming(): boolean {
    return this.transforming;
  }

  /**
   * Set the transforming flag.
   * Call with `true` before starting a transform, `false` after completion.
   * @param transforming - true when transform is in progress
   */
  setTransforming(transforming: boolean): void {
    this.transforming = transforming;
    // Notify observers so arrow/prop components can update their transition state
    this.notifyObservers();
  }
}

// Global singleton instance
let globalAnimationVisibilityManager: AnimationVisibilityStateManager | null =
  null;

/**
 * Get or create the global animation visibility state manager
 */
export function getAnimationVisibilityManager(): AnimationVisibilityStateManager {
  if (!globalAnimationVisibilityManager) {
    globalAnimationVisibilityManager = new AnimationVisibilityStateManager();
  }
  return globalAnimationVisibilityManager;
}

/**
 * Reset the global animation visibility manager (useful for testing)
 */
export function resetAnimationVisibilityManager(): void {
  globalAnimationVisibilityManager = null;
}

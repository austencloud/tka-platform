/**
 * Animation Visibility State Manager
 *
 * Manages visibility settings specifically for animation playback.
 * Independent from pictograph visibility but can sync from it.
 */

import type { CharcoalSparkParams } from "../domain/types/CharcoalSparkTypes";
import { DEFAULT_CHARCOAL_PARAMS } from "../domain/types/CharcoalSparkTypes";
import type { FireColorCurve } from "../domain/types/FireTypes";
import type { EffortId } from "$lib/features/effort-lab/domain/effort-types";
import type { EffectType, TipEffectMap, TipEffortMap } from "../domain/types/TipEffectTypes";
import { findPreset, validatePreset, type LedColorPreset } from "../domain/types/LedColorPresets";
import type { EffectLayerMode } from "../services/effect-layer";

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

/**
 * Trail toggle type — still used by settings UI components to represent
 * the on/off state that drives the trail section of tipEffectMap.
 * The manager itself no longer stores this as a field; use isTrailsActive() instead.
 */
export type TrailVisibility = "off" | "on";
export type GridMode = "none" | "8point" | "auto";
export type PlaybackMode = "continuous" | "step";

interface AnimationVisibilitySettings {
  // Animation-specific elements (no pictograph equivalent)
  gridMode: GridMode; // Grid visualization mode (3-state)
  stepNumbers: boolean; // "Beat 1, 2, 3..." overlay at top-left
  beatPosition: boolean; // Musical beat position at bottom-center (1, 1.5, 2e, etc.)
  props: boolean; // Show props vs trails-only mode
  playbackMode: PlaybackMode; // Continuous flow vs step-by-step
  speed: number; // Speed multiplier (1.0 = 60 BPM, range 0.1-3.0)
  wordHeader: boolean; // Word/sequence name header at top
  progressBar: boolean; // Segmented progress bar in word header

  // Global Effects (applies to pictograph, animation, and image export)
  // Dark Mode: dark background, inverted grid, white text/outlines
  darkMode: boolean;

  // Fire Effect tuning
  fireColorBlend: number; // 0 = natural fire, 1 = prop-colored (continuous slider)
  fireIntensity: number; // User intensity slider value (0.0-1.0)
  fireTurbulence: number; // Curl noise turbulence strength (0.0-1.0), how much idle fire flickers
  fireColorCurve: FireColorCurve | null; // Custom 4-stop color gradient (null = use default)
  firePropColors: [import("../domain/types/FireTypes").PropFlameColor, import("../domain/types/FireTypes").PropFlameColor] | null; // Per-hand flame colors (null = default blue/red)

  // Charcoal Effect tuning
  charcoalParams: import("../domain/types/CharcoalSparkTypes").CharcoalSparkParams; // Charcoal spark tuning params

  // LED Effect tuning
  ledBrightness: number; // 1-5 discrete level (maps to 0.2-1.0 float)
  ledPatternId: string; // Active LED pattern ID
  ledPrimaryColor: string; // Primary color (hex)
  ledSecondaryColor: string; // Secondary color (hex)
  ledActivePresetId: string | null; // Currently active color preset
  ledUserPresets: LedColorPreset[]; // User-created color presets
  ledPatternSpeed: number; // Pattern animation speed multiplier (0.1-5.0, default 1.0)
  ledColorMode: "unified" | "per-hand" | "prop-matched"; // How LED colors map to props

  // Shared with pictograph visibility (can sync)
  tkaGlyph: boolean; // TKA Glyph includes turn numbers
  reversalIndicators: boolean;
  effortPreset: EffortId;
  /** Path shape for shift interpolation: "arc" (default) or "linear" */
  pathShape: "arc" | "linear";

  // Per-tip effect/effort assignments (global level)
  // tipEffectMap is the sole authority for which effect is active.
  tipEffectMap: TipEffectMap;
  tipEffortMap: TipEffortMap;

  /** Per-effect override of the z-stack position. Missing entry = "behind" (default).
   * When "front", the effect's canvas renders above the main props canvas. */
  effectLayerOverrides: Record<string, EffectLayerMode>;
}

const STORAGE_KEY = "animation-visibility-settings";

export class AnimationVisibilityStateManager {
  private settings: AnimationVisibilitySettings;
  private observers: Set<VisibilityObserver> = new Set();
  /** Tracks dark mode state before an effect forced it on, so we can restore on disable. null = no effect override active. */
  private darkModeBeforeEffect: boolean | null = null;

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

  /** When true, this instance is scoped to a single canvas and does not
   * persist settings to localStorage or modify the global .dark CSS class. */
  private readonly ephemeral: boolean;

  /**
   * @param options.ephemeral When true, creates an isolated instance that uses
   *   default settings and skips localStorage persistence and DOM dark-class sync.
   *   Use for per-canvas instances that shouldn't affect global app state.
   */
  constructor(options?: { ephemeral?: boolean }) {
    this.ephemeral = options?.ephemeral ?? false;

    if (this.ephemeral) {
      // Ephemeral instances start with defaults — no localStorage, no DOM sync
      this.settings = this.getDefaultSettings();
    } else {
      // Global singleton loads from localStorage and syncs the .dark class
      this.settings = this.loadFromStorage() || this.getDefaultSettings();
      this.syncDarkModeClass();
    }
    // Compute initial motion colors from CSS variables
    this.updateMotionColorsCache();
  }

  /**
   * Get default settings
   */
  private getDefaultSettings(): AnimationVisibilitySettings {
    return {
      // Animation-specific defaults
      gridMode: "8point", // Default to 8-point grid (all cardinal + intercardinal points)
      stepNumbers: true, // Show step numbers by default
      beatPosition: false, // Hide beat position by default (replaced by progress bar)
      props: true,
      playbackMode: "continuous", // Default to continuous playback
      speed: 1.0, // Default to 60 BPM
      wordHeader: true, // Show word/sequence name by default
      progressBar: true, // Show progress bar by default

      // Global effects
      darkMode: true, // Dark Mode enabled by default (better first impression)

      // Fire Effect tuning
      fireColorBlend: 0.5, // Halfway between natural and prop-colored
      fireIntensity: 0.7, // 0-1 range, 0.7 = normal fire
      fireTurbulence: 0.5, // 0-1 range, how much idle fire flickers
      fireColorCurve: null, // null = use default BASE_COLOR_CURVE
      firePropColors: null, // null = default blue/red

      // Charcoal Effect tuning
      charcoalParams: { ...DEFAULT_CHARCOAL_PARAMS }, // Default charcoal spark params

      // LED Effect tuning
      ledBrightness: 5,
      ledPatternId: "solid",
      ledPrimaryColor: "#00ff88",
      ledSecondaryColor: "#ffffff",
      ledActivePresetId: null,
      ledUserPresets: [],
      ledPatternSpeed: 1.0,
      ledColorMode: "unified",

      // Shared elements - defaults optimized for animation viewing
      tkaGlyph: true, // TKA Glyph includes turn numbers
      reversalIndicators: false, // Less clutter during animation
      effortPreset: "linear",
      pathShape: "arc",

      // tipEffectMap is the sole authority for which effect is active.
      // Default: trails on so new users see motion paths.
      tipEffectMap: { "*": { effect: "trails" } },
      tipEffortMap: {},

      // All effects default to "behind" props — user opts individual effects into "front".
      effectLayerOverrides: {},
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

        // Force stepNumbers to true (re-enabled for export and preview)
        parsed.stepNumbers = true;

        // Migrate old flameColorMode (binary) → continuous fireColorBlend
        if ("flameColorMode" in parsed && !("fireColorBlend" in parsed)) {
          parsed.fireColorBlend = parsed.flameColorMode === "natural" ? 0 : 1.0;
          delete parsed.flameColorMode;
        }
        if ("coloredFlames" in parsed && !("fireColorBlend" in parsed)) {
          parsed.fireColorBlend = parsed.coloredFlames ? 1.0 : 0;
          delete parsed.coloredFlames;
        }

        // Migrate old fuelSourceId → charcoalEffect
        if ("fuelSourceId" in parsed && !("charcoalEffect" in parsed)) {
          parsed.charcoalEffect = parsed.fuelSourceId === "charcoal";
          if (parsed.charcoalEffect) parsed.fireEffect = false;
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
        // Remove legacy fireSmokeLevel if present (smoke feature removed)
        if ("fireSmokeLevel" in parsed) delete parsed.fireSmokeLevel;

        // Migrate old fireUseCharcoal → charcoalEffect (separate effect)
        if ("fireUseCharcoal" in parsed && !("charcoalEffect" in parsed)) {
          if (parsed.fireUseCharcoal && parsed.fireEffect) {
            parsed.charcoalEffect = true;
            parsed.fireEffect = false; // They were sharing fireEffect; give it to charcoal
          } else {
            parsed.charcoalEffect = false;
          }
          delete parsed.fireUseCharcoal;
        }
        if (!("charcoalEffect" in parsed)) parsed.charcoalEffect = false;
        // Migrate old charcoalPresetId → charcoalParams
        if ("charcoalPresetId" in parsed) {
          delete parsed.charcoalPresetId;
        }
        if (!("charcoalParams" in parsed)) {
          parsed.charcoalParams = { ...DEFAULT_CHARCOAL_PARAMS };
        } else if ("tangentialBias" in (parsed.charcoalParams as Record<string, unknown>)) {
          // Migrate from old tangentialBias/initialSpeed model → velocity-inheritance model
          parsed.charcoalParams = { ...DEFAULT_CHARCOAL_PARAMS };
        }
        if (!("fireIntensity" in parsed)) parsed.fireIntensity = 0.7;
        if (!("fireTurbulence" in parsed)) parsed.fireTurbulence = 0.5;

        // Clean up removed keys
        delete parsed.fuelSourceId;
        delete parsed.flameColorMode;
        delete parsed.fireUseCharcoal;

        // Ensure new properties exist with defaults if missing
        const defaults = this.getDefaultSettings();

        // Deep-merge charcoalParams so newly added keys get their defaults
        if (parsed.charcoalParams) {
          parsed.charcoalParams = { ...DEFAULT_CHARCOAL_PARAMS, ...parsed.charcoalParams };
        }

        if (!("pathShape" in parsed)) parsed.pathShape = "arc";

        // Migrate old gridMode values ("diamond" | "box") → new system ("8point" | "auto")
        if (parsed.gridMode === "diamond" || parsed.gridMode === "box") {
          parsed.gridMode = "8point";
        }

        // Migrate legacy booleans → tipEffectMap (one-time, on load)
        if (!parsed.tipEffectMap || Object.keys(parsed.tipEffectMap).length === 0) {
          if (parsed.fireEffect) parsed.tipEffectMap = { "*": { effect: "fire" } };
          else if (parsed.charcoalEffect) parsed.tipEffectMap = { "*": { effect: "charcoal" } };
          else if (parsed.ledEffect) parsed.tipEffectMap = { "*": { effect: "led" } };
          else if (parsed.trailStyle === "on") parsed.tipEffectMap = { "*": { effect: "trails" } };
          else parsed.tipEffectMap = {};
        }

        // Clean up legacy fields (they'll be omitted on next save)
        delete parsed.fireEffect;
        delete parsed.charcoalEffect;
        delete parsed.ledEffect;
        delete parsed.trailStyle;
        if (!parsed.tipEffortMap) {
          parsed.tipEffortMap = {};
          if (parsed.effortPreset && parsed.effortPreset !== "linear") {
            parsed.tipEffortMap = { "*": { effort: parsed.effortPreset } };
          }
        }

        // Validate user presets from storage (reject malformed entries)
        if (Array.isArray(parsed.ledUserPresets)) {
          parsed.ledUserPresets = parsed.ledUserPresets.filter(validatePreset);
        }

        if (!parsed.effectLayerOverrides || typeof parsed.effectLayerOverrides !== "object") {
          parsed.effectLayerOverrides = {};
        }

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
   * Save settings to localStorage (skipped for ephemeral instances)
   */
  private saveToStorage(): void {
    if (this.ephemeral) return;
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
   * (For gridMode, playbackMode, speed use dedicated getters)
   * (For darkMode, use isDarkMode() instead)
   * (For effects, use getActiveEffect() / hasEffect() instead)
   */
  getVisibility(
    key: Exclude<
      keyof AnimationVisibilitySettings,
      "gridMode" | "playbackMode" | "speed" | "darkMode" | "fireColorBlend" | "fireIntensity" | "fireTurbulence" | "charcoalParams" | "ledBrightness" | "ledPatternId" | "ledPrimaryColor" | "ledSecondaryColor" | "ledActivePresetId" | "ledUserPresets" | "ledPatternSpeed" | "ledColorMode" | "effortPreset" | "pathShape" | "tipEffectMap" | "tipEffortMap" | "fireColorCurve" | "effectLayerOverrides"
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
   * (For gridMode, playbackMode, speed use dedicated setters)
   * (For effects, use setActiveEffect() instead)
   */
  setVisibility(
    key: Exclude<
      keyof AnimationVisibilitySettings,
      "gridMode" | "playbackMode" | "speed" | "fireColorBlend" | "fireIntensity" | "fireTurbulence" | "charcoalParams" | "ledBrightness" | "ledPatternId" | "ledPrimaryColor" | "ledSecondaryColor" | "ledActivePresetId" | "ledUserPresets" | "ledPatternSpeed" | "ledColorMode" | "effortPreset" | "pathShape" | "tipEffectMap" | "tipEffortMap" | "fireColorCurve" | "effectLayerOverrides"
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
   * Skipped for ephemeral instances to avoid global DOM side effects.
   */
  private syncDarkModeClass(): void {
    if (this.ephemeral) return;
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
  // FIRE SLIDERS: Color Blend, Intensity, Turbulence
  // ============================================================================

  getFireColorBlend(): number {
    return this.settings.fireColorBlend;
  }

  setFireColorBlend(value: number): void {
    this.settings.fireColorBlend = Math.max(0, Math.min(1, value));
    this.saveToStorage();
    this.notifyObservers();
  }

  // ============================================================================
  // CHARCOAL EFFECT TUNING
  // ============================================================================

  getCharcoalParams(): CharcoalSparkParams {
    return { ...this.settings.charcoalParams };
  }

  setCharcoalParams(params: CharcoalSparkParams): void {
    this.settings.charcoalParams = { ...params };
    this.saveToStorage();
    this.notifyObservers();
  }

  updateCharcoalParam<K extends keyof CharcoalSparkParams>(key: K, value: CharcoalSparkParams[K]): void {
    this.settings.charcoalParams[key] = value;
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

  getFireTurbulence(): number {
    return this.settings.fireTurbulence;
  }

  setFireTurbulence(value: number): void {
    this.settings.fireTurbulence = Math.max(0, Math.min(1, value));
    this.saveToStorage();
    this.notifyObservers();
  }

  getFireColorCurve(): FireColorCurve | null {
    return this.settings.fireColorCurve;
  }

  setFireColorCurve(curve: FireColorCurve | null): void {
    this.settings.fireColorCurve = curve;
    this.saveToStorage();
    this.notifyObservers();
  }

  getFirePropColors(): [import("../domain/types/FireTypes").PropFlameColor, import("../domain/types/FireTypes").PropFlameColor] | null {
    return this.settings.firePropColors;
  }

  setFirePropColors(colors: [import("../domain/types/FireTypes").PropFlameColor, import("../domain/types/FireTypes").PropFlameColor] | null): void {
    this.settings.firePropColors = colors;
    this.saveToStorage();
    this.notifyObservers();
  }

  /** Reset fire controls to defaults. */
  resetFireDefaults(): void {
    this.settings.fireIntensity = 0.7;
    this.settings.fireColorBlend = 0.5;
    this.settings.fireTurbulence = 0.5;
    this.settings.fireColorCurve = null;
    this.saveToStorage();
    this.notifyObservers();
  }

  /** Reset charcoal controls to defaults. */
  resetCharcoalDefaults(): void {
    this.settings.charcoalParams = { ...DEFAULT_CHARCOAL_PARAMS };
    this.saveToStorage();
    this.notifyObservers();
  }

  // ============================================================================
  // LED EFFECT TUNING
  // ============================================================================

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
   * Get current LED secondary color
   */
  getLedSecondaryColor(): string {
    return this.settings.ledSecondaryColor;
  }

  /**
   * Set LED secondary color
   */
  setLedSecondaryColor(color: string): void {
    if (this.settings.ledSecondaryColor === color) return;
    this.settings.ledSecondaryColor = color;
    this.saveToStorage();
    this.notifyObservers();
  }

  /**
   * Get the currently active color preset ID (null if no preset is active)
   */
  getActivePresetId(): string | null {
    return this.settings.ledActivePresetId;
  }

  /**
   * Activate a color preset by ID, applying its colors to the LED settings.
   * No-op if the preset ID is not found in built-in or user presets.
   */
  setActivePreset(presetId: string): void {
    const preset = findPreset(presetId, this.settings.ledUserPresets);
    if (!preset) return;
    this.settings.ledActivePresetId = presetId;
    this.settings.ledPrimaryColor = preset.primaryColor;
    if (preset.secondaryColor) {
      this.settings.ledSecondaryColor = preset.secondaryColor;
    }
    this.saveToStorage();
    this.notifyObservers();
  }

  /**
   * Get all user-created color presets
   */
  getUserPresets(): LedColorPreset[] {
    return this.settings.ledUserPresets;
  }

  /**
   * Create and persist a new user color preset
   */
  addUserPreset(name: string, primaryColor: string): void {
    const id = `user-${Date.now()}`;
    this.settings.ledUserPresets = [
      ...this.settings.ledUserPresets,
      { id, name, primaryColor, builtIn: false },
    ];
    this.saveToStorage();
    this.notifyObservers();
  }

  /**
   * Remove a user-created preset by ID. Clears active preset if it was the removed one.
   */
  removeUserPreset(presetId: string): void {
    this.settings.ledUserPresets = this.settings.ledUserPresets.filter((p) => p.id !== presetId);
    if (this.settings.ledActivePresetId === presetId) {
      this.settings.ledActivePresetId = null;
    }
    this.saveToStorage();
    this.notifyObservers();
  }

  /**
   * Get the LED pattern animation speed multiplier (0.1-5.0, default 1.0)
   */
  getLedPatternSpeed(): number {
    return this.settings.ledPatternSpeed;
  }

  /**
   * Set the LED pattern animation speed multiplier, clamped to 0.1-5.0
   */
  setLedPatternSpeed(speed: number): void {
    this.settings.ledPatternSpeed = Math.max(0.1, Math.min(5.0, speed));
    this.saveToStorage();
    this.notifyObservers();
  }

  getLedColorMode(): "unified" | "per-hand" | "prop-matched" {
    return this.settings.ledColorMode;
  }

  setLedColorMode(mode: "unified" | "per-hand" | "prop-matched"): void {
    this.settings.ledColorMode = mode;
    this.saveToStorage();
    this.notifyObservers();
  }

  // ============================================================================
  // EFFORT PRESET
  // ============================================================================

  /**
   * Get current effort easing preset
   */
  getEffortPreset(): EffortId {
    return this.settings.effortPreset;
  }

  /**
   * Set effort easing preset
   */
  setEffortPreset(preset: EffortId): void {
    this.settings.effortPreset = preset;
    this.saveToStorage();
    this.notifyObservers();
  }

  // ============================================================================
  // PER-TIP EFFECT / EFFORT MAPS
  // ============================================================================

  getTipEffectMap(): TipEffectMap {
    return this.settings.tipEffectMap;
  }

  setTipEffectMap(map: TipEffectMap): void {
    this.settings.tipEffectMap = map;
    this.syncDarkModeFromMap();
    this.saveToStorage();
    this.notifyObservers();
  }

  getTipEffortMap(): TipEffortMap {
    return this.settings.tipEffortMap;
  }

  setTipEffortMap(map: TipEffortMap): void {
    this.settings.tipEffortMap = map;
    this.saveToStorage();
    this.notifyObservers();
  }

  /**
   * Set a single active effect across all tips. Passing "none" clears the map.
   * This is the tipEffectMap-based replacement for setFireEffect/setCharcoalEffect/setLedEffect.
   */
  setActiveEffect(effect: EffectType): void {
    if (effect === "none") {
      this.settings.tipEffectMap = {};
    } else {
      this.settings.tipEffectMap = { "*": { effect } };
    }
    this.syncDarkModeFromMap();
    this.saveToStorage();
    this.notifyObservers();
  }

  /**
   * Return the globally-active effect, or "none" if the map is empty or has no wildcard.
   */
  getActiveEffect(): EffectType {
    const cellWide = this.settings.tipEffectMap["*"];
    return cellWide?.effect ?? "none";
  }

  /**
   * Return true if any tip assignment uses the given effect.
   */
  hasEffect(effect: EffectType): boolean {
    return Object.values(this.settings.tipEffectMap)
      .some(a => a.effect === effect);
  }

  /**
   * Return true if trails are the active effect in the map.
   */
  isTrailsActive(): boolean {
    return this.hasEffect("trails");
  }

  /**
   * Return true if any dark-mode-requiring effect (fire, charcoal, LED) is in the map.
   */
  isAnyDarkModeEffectActive(): boolean {
    const darkEffects: EffectType[] = ["fire", "charcoal", "led"];
    return Object.values(this.settings.tipEffectMap)
      .some(a => darkEffects.includes(a.effect as EffectType));
  }

  /**
   * Sync dark mode based on the current tipEffectMap contents.
   * Forces dark mode on when a dark-requiring effect is active, and restores
   * the previous dark mode state when the last such effect is removed.
   */
  private syncDarkModeFromMap(): void {
    const needsDarkMode = this.isAnyDarkModeEffectActive();
    if (needsDarkMode) {
      if (this.darkModeBeforeEffect === null) {
        this.darkModeBeforeEffect = this.settings.darkMode;
      }
      if (!this.settings.darkMode) {
        this.settings.darkMode = true;
        this.syncDarkModeClass();
        this.updateMotionColorsCache();
      }
    } else {
      if (this.darkModeBeforeEffect !== null) {
        const restore = this.darkModeBeforeEffect;
        this.darkModeBeforeEffect = null;
        if (this.settings.darkMode !== restore) {
          this.settings.darkMode = restore;
          this.syncDarkModeClass();
          this.updateMotionColorsCache();
        }
      }
    }
  }

  // ============================================================================
  // PATH SHAPE
  // ============================================================================

  getPathShape(): "arc" | "linear" {
    return this.settings.pathShape;
  }

  setPathShape(shape: "arc" | "linear"): void {
    this.settings.pathShape = shape;
    this.saveToStorage();
    this.notifyObservers();
  }

  togglePathShape(): void {
    this.setPathShape(this.settings.pathShape === "arc" ? "linear" : "arc");
  }

  // ============================================================================
  // PER-EFFECT LAYER OVERRIDES (behind/front props)
  // ============================================================================

  getEffectLayer(effectId: string): EffectLayerMode {
    return this.settings.effectLayerOverrides[effectId] ?? "behind";
  }

  setEffectLayer(effectId: string, mode: EffectLayerMode): void {
    if (mode === "behind") {
      // Keep the map small — absence encodes the default.
      const { [effectId]: _omit, ...rest } = this.settings.effectLayerOverrides;
      this.settings.effectLayerOverrides = rest;
    } else {
      this.settings.effectLayerOverrides = {
        ...this.settings.effectLayerOverrides,
        [effectId]: mode,
      };
    }
    this.saveToStorage();
    this.notifyObservers();
  }

  toggleEffectLayer(effectId: string): void {
    this.setEffectLayer(effectId, this.getEffectLayer(effectId) === "behind" ? "front" : "behind");
  }

  getEffectLayerOverrides(): Readonly<Record<string, EffectLayerMode>> {
    return this.settings.effectLayerOverrides;
  }

  /**
   * Toggle a boolean visibility setting
   */
  toggleVisibility(
    key: Exclude<
      keyof AnimationVisibilitySettings,
      "gridMode" | "playbackMode" | "speed" | "darkMode" | "fireColorBlend" | "fireIntensity" | "fireTurbulence" | "charcoalParams" | "ledBrightness" | "ledPatternId" | "ledPrimaryColor" | "ledSecondaryColor" | "ledActivePresetId" | "ledUserPresets" | "ledPatternSpeed" | "ledColorMode" | "effortPreset" | "pathShape" | "tipEffectMap" | "tipEffortMap" | "fireColorCurve" | "effectLayerOverrides"
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

/**
 * Animation Visibility State Manager
 *
 * Manages visibility settings specifically for animation playback.
 * Independent from pictograph visibility but can sync from it.
 */

import type { CharcoalSparkParams } from "../domain/types/CharcoalSparkTypes";
import { DEFAULT_CHARCOAL_PARAMS, semanticToCharcoalParams, charcoalParamsToSemantic } from "../domain/types/CharcoalSparkTypes";
import type { FireColorCurve } from "../domain/types/FireTypes";
import type { EffortId } from "$lib/shared/effort/domain/effort-types";
import type { EffectType, TipEffectMap, TipEffortMap } from "../domain/types/TipEffectTypes";
import { findPreset, type LedColorPreset } from "../domain/types/LedColorPresets";
import type { EffectLayerMode } from "../services/effect-layer";
import type { PropFlameColor } from '../domain/types/FireTypes';
import type { EffectsConfigState } from "$lib/shared/effects/state/effects-config-state.svelte";

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
 * Trail toggle type - still used by settings UI components to represent
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

  // Shared with pictograph visibility (can sync)
  tkaGlyph: boolean; // TKA Glyph includes turn numbers
  reversalIndicators: boolean;
  effortPreset: EffortId;
  /** Path shape for shift interpolation: "arc" (default), "linear", or "concave" */
  pathShape: "arc" | "linear" | "concave";
  /** When true, pro→arc and anti→concave regardless of pathShape */
  motionAwarePaths: boolean;
  /** Show path shape lines on canvas during animation */
  pathLines: boolean;

  // Per-tip effort assignments (global level)
  tipEffortMap: TipEffortMap;
}

const STORAGE_KEY = "animation-visibility-settings";

export class AnimationVisibilityStateManager {
  private settings: AnimationVisibilitySettings;
  private observers: Set<VisibilityObserver> = new Set();
  /** Tracks dark mode state before an effect forced it on, so we can restore on disable. null = no effect override active. */
  private darkModeBeforeEffect: boolean | null = null;
  /** Delegated effects config state. Set by host via setEffectsConfigState(). */
  private effectsState: EffectsConfigState | null = null;

  /**
   * Wire the shared EffectsConfigState so effect getters/setters delegate to it
   * instead of storing locally. Call before any effect methods are invoked.
   */
  setEffectsConfigState(state: EffectsConfigState | null): void {
    this.effectsState = state;
  }

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
      // Ephemeral instances start with defaults - no localStorage, no DOM sync
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

      // Shared elements - defaults optimized for animation viewing
      tkaGlyph: true, // TKA Glyph includes turn numbers
      reversalIndicators: false, // Less clutter during animation
      effortPreset: "linear",
      pathShape: "arc",
      motionAwarePaths: false,
      pathLines: false,

      tipEffortMap: {},
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

        if (!("pathShape" in parsed)) parsed.pathShape = "arc";
        if (!("motionAwarePaths" in parsed)) parsed.motionAwarePaths = false;
        if (!("pathLines" in parsed)) parsed.pathLines = false;

        // Migrate old gridMode values ("diamond" | "box") → new system ("8point" | "auto")
        if (parsed.gridMode === "diamond" || parsed.gridMode === "box") {
          parsed.gridMode = "8point";
        }

        if (!parsed.tipEffortMap) {
          parsed.tipEffortMap = {};
          if (parsed.effortPreset && parsed.effortPreset !== "linear") {
            parsed.tipEffortMap = { "*": { effort: parsed.effortPreset } };
          }
        }

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
      "gridMode" | "playbackMode" | "speed" | "darkMode" | "effortPreset" | "pathShape" | "tipEffortMap"
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
      "gridMode" | "playbackMode" | "speed" | "effortPreset" | "pathShape" | "tipEffortMap"
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
  // Delegates to EffectsConfigState.fire
  // ============================================================================

  getFireColorBlend(): number {
    return this.effectsState?.fire.colorBlend ?? 0.5;
  }

  setFireColorBlend(value: number): void {
    this.effectsState?.updateFire({ colorBlend: Math.max(0, Math.min(1, value)) });
    this.notifyObservers();
  }

  getFireIntensity(): number {
    return this.effectsState?.fire.intensity ?? 0.7;
  }

  setFireIntensity(intensity: number): void {
    this.effectsState?.updateFire({ intensity: Math.max(0, Math.min(1, intensity)) });
    this.notifyObservers();
  }

  getFireTurbulence(): number {
    return this.effectsState?.fire.turbulence ?? 0.5;
  }

  setFireTurbulence(value: number): void {
    this.effectsState?.updateFire({ turbulence: Math.max(0, Math.min(1, value)) });
    this.notifyObservers();
  }

  getFireColorCurve(): FireColorCurve | null {
    return this.effectsState?.fire.colorCurve ?? null;
  }

  setFireColorCurve(curve: FireColorCurve | null): void {
    this.effectsState?.updateFire({ colorCurve: curve });
    this.notifyObservers();
  }

  getFirePropColors(): [PropFlameColor, PropFlameColor] | null {
    return this.effectsState?.fire.propColors ?? null;
  }

  setFirePropColors(colors: [PropFlameColor, PropFlameColor] | null): void {
    this.effectsState?.updateFire({ propColors: colors });
    this.notifyObservers();
  }

  /** Reset fire controls to defaults. */
  resetFireDefaults(): void {
    this.effectsState?.updateFire({ intensity: 0.7, colorBlend: 0.5, turbulence: 0.5, colorCurve: null });
    this.notifyObservers();
  }

  // ============================================================================
  // CHARCOAL EFFECT TUNING
  // Delegates to EffectsConfigState.charcoal (semantic: intensity/spread/glow)
  // ============================================================================

  getCharcoalParams(): CharcoalSparkParams {
    if (this.effectsState) {
      return semanticToCharcoalParams(this.effectsState.charcoal);
    }
    return { ...DEFAULT_CHARCOAL_PARAMS };
  }

  setCharcoalParams(params: CharcoalSparkParams): void {
    if (this.effectsState) {
      this.effectsState.updateCharcoal(charcoalParamsToSemantic(params));
      this.notifyObservers();
    }
  }

  updateCharcoalParam<K extends keyof CharcoalSparkParams>(key: K, value: CharcoalSparkParams[K]): void {
    if (this.effectsState) {
      const current = semanticToCharcoalParams(this.effectsState.charcoal);
      const updated = { ...current, [key]: value };
      this.effectsState.updateCharcoal(charcoalParamsToSemantic(updated));
      this.notifyObservers();
    }
  }

  /** Reset charcoal controls to defaults. */
  resetCharcoalDefaults(): void {
    this.effectsState?.updateCharcoal({ intensity: 0.5, spread: 0.5, glow: 0.6 });
    this.notifyObservers();
  }

  // ============================================================================
  // LED EFFECT TUNING
  // Delegates to EffectsConfigState.led
  // ============================================================================

  /**
   * Get current LED pattern ID
   */
  getLedPatternId(): string {
    return this.effectsState?.led.patternId ?? "solid";
  }

  /**
   * Set LED pattern ID
   */
  setLedPatternId(patternId: string): void {
    this.effectsState?.updateLed({ patternId });
    this.notifyObservers();
  }

  /**
   * Get current LED primary color
   */
  getLedPrimaryColor(): string {
    return this.effectsState?.led.primaryColor ?? "#00ff88";
  }

  /**
   * Set LED primary color
   */
  setLedPrimaryColor(color: string): void {
    this.effectsState?.updateLed({ primaryColor: color });
    this.notifyObservers();
  }

  /**
   * Get LED brightness level (1-5)
   */
  getLedBrightness(): number {
    return this.effectsState?.led.brightness ?? 5;
  }

  /**
   * Set LED brightness level (1-5, clamped)
   */
  setLedBrightness(level: number): void {
    this.effectsState?.updateLed({ brightness: Math.max(1, Math.min(5, Math.round(level))) });
    this.notifyObservers();
  }

  /**
   * Get current LED secondary color
   */
  getLedSecondaryColor(): string {
    return this.effectsState?.led.secondaryColor ?? "#ffffff";
  }

  /**
   * Set LED secondary color
   */
  setLedSecondaryColor(color: string): void {
    if (this.effectsState?.led.secondaryColor === color) return;
    this.effectsState?.updateLed({ secondaryColor: color });
    this.notifyObservers();
  }

  /**
   * Get the currently active color preset ID (null if no preset is active)
   */
  getActivePresetId(): string | null {
    return this.effectsState?.activePresets.led ?? null;
  }

  /**
   * Activate a color preset by ID, applying its colors to the LED settings.
   * No-op if effectsState is not wired yet.
   * Note: Full preset application (color lookup) is handled by EffectsConfigState.applyPreset.
   * This thin delegate applies the preset if it can be found in the built-in or user list.
   */
  setActivePreset(presetId: string): void {
    if (!this.effectsState) return;
    // Find the preset in the LED user presets or built-ins via findPreset
    const userPresets = this.getUserPresets();
    const preset = findPreset(presetId, userPresets);
    if (!preset) return;
    this.effectsState.updateLed({ primaryColor: preset.primaryColor });
    if (preset.secondaryColor) {
      this.effectsState.updateLed({ secondaryColor: preset.secondaryColor });
    }
    this.notifyObservers();
  }

  /**
   * Get all user-created color presets.
   * Note: LED user presets are no longer stored in the VM. Returns empty array
   * since preset management is now owned by EffectsConfigState / preset panels.
   */
  getUserPresets(): LedColorPreset[] {
    return [];
  }

  /**
   * Create and persist a new user color preset.
   * No-op: preset management is now owned by EffectsConfigState.
   */
  addUserPreset(_name: string, _primaryColor: string): void {
    // No-op: LED user preset management moved to EffectsConfigState
  }

  /**
   * Remove a user-created preset by ID.
   * No-op: preset management is now owned by EffectsConfigState.
   */
  removeUserPreset(_presetId: string): void {
    // No-op: LED user preset management moved to EffectsConfigState
  }

  /**
   * Get the LED pattern animation speed multiplier (0.1-5.0, default 1.0)
   */
  getLedPatternSpeed(): number {
    return this.effectsState?.led.patternSpeed ?? 1.0;
  }

  /**
   * Set the LED pattern animation speed multiplier, clamped to 0.1-5.0
   */
  setLedPatternSpeed(speed: number): void {
    this.effectsState?.updateLed({ patternSpeed: Math.max(0.1, Math.min(5.0, speed)) });
    this.notifyObservers();
  }

  getLedColorMode(): "unified" | "per-hand" | "prop-matched" {
    return this.effectsState?.led.colorMode ?? "unified";
  }

  setLedColorMode(mode: "unified" | "per-hand" | "prop-matched"): void {
    this.effectsState?.updateLed({ colorMode: mode });
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
  // tipEffectMap delegates to EffectsConfigState; tipEffortMap stays in settings.
  // ============================================================================

  getTipEffectMap(): TipEffectMap {
    return this.effectsState?.tipEffectMap ?? {};
  }

  setTipEffectMap(map: TipEffectMap): void {
    if (this.effectsState) {
      this.effectsState.setTipEffectMap(map);
    }
    this.syncDarkModeFromMap();
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
   * Delegates to EffectsConfigState.setActiveEffect.
   */
  setActiveEffect(effect: EffectType): void {
    if (this.effectsState) {
      this.effectsState.setActiveEffect(effect as string);
    }
    this.syncDarkModeFromMap();
    this.notifyObservers();
  }

  /**
   * Return the globally-active effect, or "none" if the map is empty or has no wildcard.
   */
  getActiveEffect(): EffectType {
    return (this.effectsState?.activeEffect ?? "none") as EffectType;
  }

  /**
   * Return true if any tip assignment uses the given effect.
   */
  hasEffect(effect: EffectType): boolean {
    const map = this.effectsState?.tipEffectMap ?? {};
    return Object.values(map).some(a => a.effect === effect);
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
    const map = this.effectsState?.tipEffectMap ?? {};
    return Object.values(map).some(a => darkEffects.includes(a.effect as EffectType));
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

  getPathShape(): "arc" | "linear" | "concave" {
    return this.settings.pathShape;
  }

  setPathShape(shape: "arc" | "linear" | "concave"): void {
    this.settings.pathShape = shape;
    this.saveToStorage();
    this.notifyObservers();
  }

  togglePathShape(): void {
    const cycle: Array<"arc" | "linear" | "concave"> = ["arc", "linear", "concave"];
    const idx = cycle.indexOf(this.settings.pathShape);
    this.setPathShape(cycle[(idx + 1) % cycle.length]!);
  }

  getMotionAwarePaths(): boolean {
    return this.settings.motionAwarePaths;
  }

  setMotionAwarePaths(enabled: boolean): void {
    this.settings.motionAwarePaths = enabled;
    this.saveToStorage();
    this.notifyObservers();
  }

  toggleMotionAwarePaths(): void {
    this.setMotionAwarePaths(!this.settings.motionAwarePaths);
  }

  // ============================================================================
  // PER-EFFECT LAYER OVERRIDES (behind/front props)
  // Delegates to EffectsConfigState.
  // ============================================================================

  getEffectLayer(effectId: string): EffectLayerMode {
    if (this.effectsState) {
      return this.effectsState.getEffectLayer(effectId);
    }
    return "behind";
  }

  setEffectLayer(effectId: string, mode: EffectLayerMode): void {
    if (this.effectsState) {
      this.effectsState.setEffectLayer(effectId, mode);
    }
    this.notifyObservers();
  }

  toggleEffectLayer(effectId: string): void {
    this.setEffectLayer(effectId, this.getEffectLayer(effectId) === "behind" ? "front" : "behind");
  }

  getEffectLayerOverrides(): Readonly<Record<string, EffectLayerMode>> {
    return this.effectsState?.effectLayerOverrides ?? {};
  }

  /**
   * Toggle a boolean visibility setting
   */
  toggleVisibility(
    key: Exclude<
      keyof AnimationVisibilitySettings,
      "gridMode" | "playbackMode" | "speed" | "darkMode" | "effortPreset" | "pathShape" | "tipEffortMap"
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

// ============================================================================
// HMR STATE PRESERVATION
// ============================================================================
// Without this, every HMR update recreates the visibility manager fresh,
// resetting LED brightness, effect toggles, and other visibility state.

const hmrVisibilityData = import.meta.hot?.data as
  | { visibilityManager?: AnimationVisibilityStateManager | null }
  | undefined;

// Global singleton instance
let globalAnimationVisibilityManager: AnimationVisibilityStateManager | null =
  hmrVisibilityData?.visibilityManager ?? null;

if (import.meta.hot) {
  import.meta.hot.dispose((data) => {
    data.visibilityManager = globalAnimationVisibilityManager;
  });
}

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

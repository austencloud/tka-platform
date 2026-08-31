/**
 * Owns animation display settings. Effect configuration lives in
 * `EffectsConfigState`; the active-effect delegates only support contexts
 * without that provider.
 */

import type { EffortId } from "$lib/shared/effort/domain/effort-types";
import type { EffectType, TipEffortMap } from "../domain/types/tip-effect-types";
import type { EffectsConfigState } from "$lib/shared/effects/state/effects-config-state.svelte";

type VisibilityObserver = () => void;

/** Cached after theme changes to avoid repeated computed-style reads. */
export interface MotionColorsCache {
  blue: string;
  red: string;
  grid: string;
}

export type TrailVisibility = "off" | "on";
export type GridMode = "none" | "8point" | "auto";
export type PlaybackMode = "continuous" | "step";
export interface AnimationPathPolicy {
  pathShape: "arc" | "linear" | "concave";
  motionAwarePaths: boolean;
}

export interface AnimationVisibilitySettings {
  gridMode: GridMode;
  stepNumbers: boolean;
  props: boolean;
  playbackMode: PlaybackMode;
  speed: number;
  wordHeader: boolean;
  progressBar: boolean;
  mandala: boolean;

  darkMode: boolean;

  tkaGlyph: boolean;
  elementalGlyph: boolean;
  reversalIndicators: boolean;
  effortPreset: EffortId;
  pathShape: "arc" | "linear" | "concave";
  motionAwarePaths: boolean;
  bluePathLines: boolean;
  redPathLines: boolean;

  tipEffortMap: TipEffortMap;
}

const STORAGE_KEY = "animation-visibility-settings";

export class AnimationVisibilityStateManager {
  private settings: AnimationVisibilitySettings;
  private observers: Set<VisibilityObserver> = new Set();
  /** Fallback active-effect owner when no effects context is available. */
  effectsConfigState: EffectsConfigState | null = null;

  /** Defaults match the light-theme CSS values. */
  private motionColors: MotionColorsCache = {
    blue: "#3D44B8",
    red: "#DC2626",
    grid: "#000000",
  };

  /** Suppresses CSS transitions while a transform applies its final state. */
  private transforming: boolean = false;

  /** Scoped instances neither persist nor alter the global theme class. */
  private readonly ephemeral: boolean;

  /**
   * Pauses disk writes without the `ephemeral` side effects. A viewer URL link
   * session borrows this global instance (see `setPersistenceSuspended`), and
   * `ephemeral` would also disable `syncDarkModeClass()` - which is exactly the
   * setting a shared link most needs to render.
   */
  private persistenceSuspended: boolean = false;

  /**
   * Scoped canvases keep local display flags but share the policy used by the
   * prop orchestrator. Routing through one owner prevents the canvas preview
   * and live prop placement from silently diverging.
   */
  private motionPolicySource: AnimationVisibilityStateManager | null = null;

  constructor(options?: { ephemeral?: boolean }) {
    this.ephemeral = options?.ephemeral ?? false;

    if (this.ephemeral) {
      this.settings = this.getDefaultSettings();
    } else {
      this.settings = this.loadFromStorage() || this.getDefaultSettings();
      this.syncDarkModeClass();
    }
    this.updateMotionColorsCache();
  }

  private getDefaultSettings(): AnimationVisibilitySettings {
    return {
      gridMode: "8point",
      stepNumbers: true,
      props: true,
      playbackMode: "continuous",
      speed: 1.0,
      wordHeader: true,
      progressBar: true,
      mandala: true,

      darkMode: true,

      tkaGlyph: true,
      elementalGlyph: false,
      reversalIndicators: false,
      effortPreset: "linear",
      pathShape: "arc",
      motionAwarePaths: false,
      bluePathLines: false,
      redPathLines: false,

      tipEffortMap: {},
    };
  }

  private loadFromStorage(): AnimationVisibilitySettings | null {
    if (typeof window === "undefined") return null;

    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);

        if (parsed.propGlow !== undefined) {
          delete parsed.propGlow;
        }

        // Re-enable a setting that older persisted state may have disabled.
        parsed.stepNumbers = true;

        if (!("pathShape" in parsed)) parsed.pathShape = "arc";
        if (!("motionAwarePaths" in parsed)) parsed.motionAwarePaths = false;
        // Migrate the former shared path-line flag.
        if (!("bluePathLines" in parsed)) parsed.bluePathLines = parsed.pathLines ?? false;
        if (!("redPathLines" in parsed)) parsed.redPathLines = parsed.pathLines ?? false;
        delete parsed.pathLines;

        // Both retired grid variants map to the current combined grid.
        if (parsed.gridMode === "diamond" || parsed.gridMode === "box") {
          parsed.gridMode = "8point";
        }

        if (!parsed.tipEffortMap) {
          parsed.tipEffortMap = {};
          if (parsed.effortPreset && parsed.effortPreset !== "linear") {
            parsed.tipEffortMap = { "*": { effort: parsed.effortPreset } };
          }
        }

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

  private saveToStorage(): void {
    if (this.ephemeral) return;
    if (this.persistenceSuspended) return;
    if (typeof window === "undefined") return;

    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.settings));
    } catch (err) {
      console.warn("Failed to save animation visibility to localStorage:", err);
    }
  }

  registerObserver(callback: VisibilityObserver): void {
    this.observers.add(callback);
  }

  unregisterObserver(callback: VisibilityObserver): void {
    this.observers.delete(callback);
  }

  notifyObservers(): void {
    this.observers.forEach((callback) => {
      try {
        callback();
      } catch (error) {
        console.error("Error in animation visibility observer:", error);
      }
    });
  }


  getVisibility(
    key: Exclude<
      keyof AnimationVisibilitySettings,
      "gridMode" | "playbackMode" | "speed" | "darkMode" | "effortPreset" | "pathShape" | "tipEffortMap"
    >
  ): boolean {
    return this.settings[key] as boolean;
  }

  /** Includes the shared policy actually used by prop placement. */
  getSettings(): AnimationVisibilitySettings {
    const source = this.motionPolicySource;
    if (!source) return { ...this.settings };
    return {
      ...this.settings,
      ...source.getPathPolicy(),
      effortPreset: source.getEffortPreset(),
    };
  }


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

  updateSettings(updates: Partial<AnimationVisibilitySettings>): void {
    Object.assign(this.settings, updates);
    this.saveToStorage();
    this.notifyObservers();
  }

  resetToDefaults(): void {
    this.settings = this.getDefaultSettings();
    this.saveToStorage();
    this.notifyObservers();
  }

  /**
   * View-only link sessions (viewer URL state). The viewer reads this global
   * singleton at ~7 call sites with no injection seam, so a shared link borrows
   * the real instance: snapshot -> suspend -> replaceAll -> (on close)
   * replaceAll(snapshot) -> resume. The recipient's disk is never written.
   */
  setPersistenceSuspended(suspended: boolean): void {
    this.persistenceSuspended = suspended;
  }

  /** Deep copy of this instance's OWN settings, ignoring any policy overlay. */
  snapshot(): AnimationVisibilitySettings {
    return structuredClone(this.settings);
  }

  /**
   * Applies a full settings object through the normal setter path so the theme
   * class and motion-colour cache follow it. `setDarkMode` is called explicitly
   * because `updateSettings` assigns the field without running that sync.
   */
  replaceAll(next: AnimationVisibilitySettings): void {
    this.updateSettings(structuredClone(next));
    this.setDarkMode(next.darkMode);
  }


  getGridMode(): GridMode {
    return this.settings.gridMode;
  }

  setGridMode(mode: GridMode): void {
    this.settings.gridMode = mode;
    this.saveToStorage();
    this.notifyObservers();
  }

  isGridVisible(): boolean {
    return this.settings.gridMode !== "none";
  }

  getPlaybackMode(): PlaybackMode {
    return this.settings.playbackMode;
  }

  setPlaybackMode(mode: PlaybackMode): void {
    this.settings.playbackMode = mode;
    this.saveToStorage();
    this.notifyObservers();
  }

  getSpeed(): number {
    return this.settings.speed;
  }

  getBpm(): number {
    return Math.round(this.settings.speed * 60);
  }

  setSpeed(speed: number): void {
    this.settings.speed = Math.max(0.1, Math.min(3.0, speed));
    this.saveToStorage();
    this.notifyObservers();
  }

  setBpm(bpm: number): void {
    this.setSpeed(bpm / 60);
  }

  isDarkMode(): boolean {
    return this.settings.darkMode;
  }

  setDarkMode(enabled: boolean): void {
    this.settings.darkMode = enabled;
    this.saveToStorage();
    this.syncDarkModeClass();
    this.updateMotionColorsCache();
  }

  /**
   * Keeps theme ownership in CSS instead of threading a mode prop through the
   * component tree. Scoped instances cannot mutate this global DOM state.
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

  private updateMotionColorsCache(): void {
    if (typeof document === "undefined") return;

    const style = getComputedStyle(document.documentElement);

    this.motionColors = {
      blue: style.getPropertyValue("--dm-motion-blue").trim() || "#3D44B8",
      red: style.getPropertyValue("--dm-motion-red").trim() || "#DC2626",
      grid: style.getPropertyValue("--dm-grid-color").trim() || "#000000",
    };

    this.notifyObservers();
  }

  getMotionColors(): MotionColorsCache {
    return this.motionColors;
  }

  toggleDarkMode(): void {
    this.setDarkMode(!this.settings.darkMode);
  }


  getEffortPreset(): EffortId {
    const source = this.motionPolicySource;
    if (source) return source.getEffortPreset();
    return this.settings.effortPreset;
  }

  setEffortPreset(preset: EffortId): void {
    const source = this.motionPolicySource;
    if (source) {
      source.setEffortPreset(preset);
      this.notifyObservers();
      return;
    }
    this.settings.effortPreset = preset;
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

  setActiveEffect(effect: EffectType): void {
    this.effectsConfigState?.setActiveEffect(effect);
    this.notifyObservers();
  }

  getActiveEffect(): EffectType {
    return (this.effectsConfigState?.activeEffect ?? "none") as EffectType;
  }


  /** Routes policy reads and writes through one owner; `null` restores local ownership. */
  setMotionPolicySource(source: AnimationVisibilityStateManager | null): void {
    this.motionPolicySource = source === this ? null : source;
    this.notifyObservers();
  }

  getPathShape(): "arc" | "linear" | "concave" {
    const source = this.motionPolicySource;
    if (source) return source.getPathShape();
    return this.settings.pathShape;
  }

  getPathPolicy(): AnimationPathPolicy {
    const source = this.motionPolicySource;
    if (source) return source.getPathPolicy();
    return {
      pathShape: this.settings.pathShape,
      motionAwarePaths: this.settings.motionAwarePaths,
    };
  }

  /** Applies both policy fields atomically so previews cannot briefly disagree. */
  setPathPolicy(policy: AnimationPathPolicy): void {
    const source = this.motionPolicySource;
    if (source) {
      source.setPathPolicy(policy);
      this.notifyObservers();
      return;
    }
    if (
      this.settings.pathShape === policy.pathShape &&
      this.settings.motionAwarePaths === policy.motionAwarePaths
    ) {
      return;
    }
    this.updateSettings(policy);
  }

  setPathShape(shape: "arc" | "linear" | "concave"): void {
    const source = this.motionPolicySource;
    if (source) {
      source.setPathShape(shape);
      this.notifyObservers();
      return;
    }
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
    const source = this.motionPolicySource;
    if (source) return source.getMotionAwarePaths();
    return this.settings.motionAwarePaths;
  }

  setMotionAwarePaths(enabled: boolean): void {
    const source = this.motionPolicySource;
    if (source) {
      source.setMotionAwarePaths(enabled);
      this.notifyObservers();
      return;
    }
    this.settings.motionAwarePaths = enabled;
    this.saveToStorage();
    this.notifyObservers();
  }

  toggleMotionAwarePaths(): void {
    this.setMotionAwarePaths(!this.settings.motionAwarePaths);
  }

  toggleVisibility(
    key: Exclude<
      keyof AnimationVisibilitySettings,
      "gridMode" | "playbackMode" | "speed" | "darkMode" | "effortPreset" | "pathShape" | "tipEffortMap"
    >
  ): void {
    this.setVisibility(key, !(this.settings[key] as boolean));
  }

  isTransforming(): boolean {
    return this.transforming;
  }

  setTransforming(transforming: boolean): void {
    this.transforming = transforming;
    this.notifyObservers();
  }
}

// Without this, every HMR update recreates the visibility manager fresh,
// resetting LED brightness, effect toggles, and other visibility state.

const hmrVisibilityData = import.meta.hot?.data as
  | { visibilityManager?: AnimationVisibilityStateManager | null }
  | undefined;

let globalAnimationVisibilityManager: AnimationVisibilityStateManager | null =
  hmrVisibilityData?.visibilityManager ?? null;

if (import.meta.hot) {
  import.meta.hot.dispose((data) => {
    data.visibilityManager = globalAnimationVisibilityManager;
  });
}

export function getAnimationVisibilityManager(): AnimationVisibilityStateManager {
  if (!globalAnimationVisibilityManager) {
    globalAnimationVisibilityManager = new AnimationVisibilityStateManager();
  }
  return globalAnimationVisibilityManager;
}

export function resetAnimationVisibilityManager(): void {
  globalAnimationVisibilityManager = null;
}

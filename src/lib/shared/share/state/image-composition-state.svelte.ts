/**
 * Image Composition State Manager
 *
 * Manages persistent settings for what elements appear in exported/shared images.
 * Persists to Firebase for authenticated users, falls back to localStorage for guests.
 */

import { browser } from "$app/environment";
import { getAnimationVisibilityManager } from "$lib/shared/animation-engine/state/animation-visibility-state.svelte";
import { settingsService } from "$lib/shared/settings/state/settings-state.svelte";
import { getAuthSync } from "$lib/shared/auth/firebase";
import type { InfoCellChoice } from "$lib/shared/sequence-viewer/services/info-cell-display";

const STORAGE_KEY = "tka-image-composition-settings";

export interface ImageCompositionSettings {
  addWord: boolean;
  addStepNumbers: boolean;
  addDifficultyLevel: boolean;
  includeStartPosition: boolean;
  darkMode: boolean;
  customName?: string; // Optional custom name for header

  // LOOP glyph visibility (pie chart badge in header)
  showLoopGlyph: boolean; // Top-right: LOOP constraint indicator

  // Granular footer controls (replaces single addUserInfo toggle)
  showCreatorName: boolean; // Bottom-left: creator name
  showNotes: boolean; // Bottom-center: notes text
  showBirthday: boolean; // Bottom-right: birthday date
  customNotesText: string; // Custom text for notes (default: "Created using Flow Arts Composer")

  // QR code in empty cell under start position
  showQRCode: boolean;

  // Mandala fills empty col-0 cells with per-hand path visualizations
  showMandala: boolean;

  // Start position layout: "row" = top row, "column" = left column
  startPositionLayout: "row" | "column";

  // Per-step-count overrides for start position layout.
  // Keys are step counts as strings (for JSON serialization).
  // When a step count has an override, it takes precedence over the global startPositionLayout.
  startPositionLayoutOverrides: Record<string, "row" | "column">;

  // Per-step-count column count overrides.
  // Keys are step counts as strings. Values are beat column counts (null = auto).
  // Controls how many beat columns ChoreoCards use for that sequence length.
  columnCountOverrides: Record<string, number>;

  // Per-step-count info-cell choice (QR vs Mandala vs None) for cards with a
  // single empty info cell. Keys are step counts as strings. When absent the
  // choice derives from showQRCode / showMandala (QR-preferential).
  infoCellChoiceOverrides: Record<string, InfoCellChoice>;

  // Backwards compatibility - computed from granular controls (always defined in getSettings())
  addUserInfo: boolean; // True if any footer element is shown
}

const DEFAULT_SETTINGS: ImageCompositionSettings = {
  addWord: true,
  addStepNumbers: true,
  addDifficultyLevel: false,
  includeStartPosition: true,
  darkMode: false, // Default to light mode (will be synced from global on init)

  // LOOP glyph - shown by default when sequence has LOOP constraints
  showLoopGlyph: true,

  // Footer defaults. Creator name + birthday show by default; the center notes
  // lane is OFF by default — the "Created using Flow Arts Composer" branding watermark
  // doesn't earn its slot on every card. Notes are opt-in; customNotesText is the
  // text used once a user turns the lane on.
  showCreatorName: true,
  showNotes: false,
  showBirthday: true,
  customNotesText: "Created using Flow Arts Composer",

  // QR code - shown by default in the empty cell under start position
  showQRCode: true,

  // Mandala - shown by default (fills empty cells with path visualizations)
  showMandala: true,

  // Start position layout - default to row (start as top row, beats fill remaining rows)
  startPositionLayout: "row" as const,

  // No per-step-count overrides by default
  startPositionLayoutOverrides: {},

  // No per-step-count column count overrides by default (auto layout)
  columnCountOverrides: {},

  // No per-step-count info-cell choice overrides by default (derive from globals)
  infoCellChoiceOverrides: {},

  // Computed: true when any footer element is shown
  addUserInfo: true,
};

type Observer = () => void;

class ImageCompositionStateManager {
  private settings = $state<ImageCompositionSettings>({ ...DEFAULT_SETTINGS });
  private observers = new Set<Observer>();

  constructor() {
    if (browser) {
      this.loadSettings();
      // Stay in sync with global dark mode changes
      this.syncWithAnimationVisibility();
    }
  }

  /**
   * Register as observer of AnimationVisibilityManager to stay in sync with global dark mode.
   * This ensures the image export preview matches the animation preview.
   */
  private syncWithAnimationVisibility(): void {
    const animVisibilityManager = getAnimationVisibilityManager();
    // Sync initial state
    this.settings.darkMode = animVisibilityManager.isDarkMode();
    // Register for updates
    animVisibilityManager.registerObserver(() => {
      const newDarkMode = animVisibilityManager.isDarkMode();
      if (this.settings.darkMode !== newDarkMode) {
        this.settings.darkMode = newDarkMode;
        this.saveToStorage();
        this.notifyObservers();
      }
    });
  }

  /**
   * Load settings from Firebase (if authenticated) or localStorage (if guest)
   */
  private loadSettings(): void {
    // First try to load from Firebase if authenticated
    const firebaseSettings = settingsService.currentSettings.imageExport;

    if (firebaseSettings && getAuthSync().currentUser) {
      // Use Firebase settings for authenticated users
      this.settings = { ...DEFAULT_SETTINGS, ...firebaseSettings };
      // Fix truncated default that was persisted due to previous save bug
      if (this.settings.customNotesText === "Created using TKA Scrib") {
        this.settings.customNotesText = DEFAULT_SETTINGS.customNotesText;
        this.saveToStorage();
      }
    } else {
      // Fall back to localStorage for guests or if no Firebase settings exist
      this.loadFromStorage();
    }

    // Migrate: old persisted "column" default → new "row" default.
    // Only migrate if there are no per-step-count overrides (user hasn't customized yet).
    if (
      this.settings.startPositionLayout === "column" &&
      (!this.settings.startPositionLayoutOverrides ||
        Object.keys(this.settings.startPositionLayoutOverrides).length === 0)
    ) {
      this.settings.startPositionLayout = "row";
      this.saveToStorage();
    }

    // Ensure overrides objects exist for older persisted data
    if (!this.settings.startPositionLayoutOverrides) {
      this.settings.startPositionLayoutOverrides = {};
    }
    if (!this.settings.columnCountOverrides) {
      this.settings.columnCountOverrides = {};
    }
    if (!this.settings.infoCellChoiceOverrides) {
      this.settings.infoCellChoiceOverrides = {};
    }
    // Clean up any stale overrides for sequences too short to have column options
    let cleaned = false;
    for (const key of Object.keys(this.settings.columnCountOverrides)) {
      if (Number(key) < 4) {
        delete this.settings.columnCountOverrides[key];
        cleaned = true;
      }
    }
    if (cleaned) this.saveToStorage();

    // One-time: retire the "Created using Flow Arts Composer" branding note as a
    // default. Flips ONLY users who never customized the note (text is still the
    // branding default) and have the lane on — a real typed note is never
    // touched. Guarded by a localStorage marker so it runs once and won't fight
    // a user who later re-enables notes with the default text.
    if (browser) {
      const NOTES_MIGRATION_KEY = `${STORAGE_KEY}:notesDefaultMigrated`;
      if (!localStorage.getItem(NOTES_MIGRATION_KEY)) {
        if (
          this.settings.showNotes &&
          this.settings.customNotesText === "Created using Flow Arts Composer"
        ) {
          this.settings.showNotes = false;
          this.saveToStorage();
        }
        try {
          localStorage.setItem(NOTES_MIGRATION_KEY, "1");
        } catch {
          // localStorage unavailable — migration retries next load, harmless.
        }
      }
    }
    // Note: darkMode is synced from AnimationVisibilityManager in syncWithAnimationVisibility()
  }

  private loadFromStorage(): void {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        this.settings = { ...DEFAULT_SETTINGS, ...parsed };
      }
    } catch {
      console.warn("Failed to load image composition settings from storage");
    }
  }

  /**
   * Save settings to both localStorage and Firebase (if authenticated)
   */
  private saveToStorage(): void {
    if (!browser) return;

    // Always save to localStorage for immediate persistence and guest users
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.settings));
    } catch {
      console.warn("Failed to save image composition settings to localStorage");
    }

    // Also save to Firebase if authenticated
    if (getAuthSync().currentUser) {
      this.saveToFirebase();
    }
  }

  /**
   * Save settings to Firebase for authenticated users
   */
  private saveToFirebase(): void {
    // Spread to create a plain object - settingsService.updateSetting uses === reference
    // equality to skip no-ops, and passing the same $state proxy would always match.
    void settingsService.updateSetting("imageExport", { ...this.settings });
  }

  private notifyObservers(): void {
    this.observers.forEach((observer) => observer());
  }

  // Getters
  get addWord(): boolean {
    return this.settings.addWord;
  }

  get addStepNumbers(): boolean {
    return this.settings.addStepNumbers;
  }

  get addDifficultyLevel(): boolean {
    return this.settings.addDifficultyLevel;
  }

  get includeStartPosition(): boolean {
    return this.settings.includeStartPosition;
  }

  /**
   * Computed property for backwards compatibility.
   * Returns true if ANY footer element is enabled.
   */
  get addUserInfo(): boolean {
    return this.settings.showCreatorName || this.settings.showNotes || this.settings.showBirthday;
  }

  get darkMode(): boolean {
    return this.settings.darkMode;
  }

  get customName(): string | undefined {
    return this.settings.customName;
  }

  get showLoopGlyph(): boolean {
    return this.settings.showLoopGlyph;
  }

  // Granular footer getters
  get showCreatorName(): boolean {
    return this.settings.showCreatorName;
  }

  get showNotes(): boolean {
    return this.settings.showNotes;
  }

  get showBirthday(): boolean {
    return this.settings.showBirthday;
  }

  get customNotesText(): string {
    return this.settings.customNotesText;
  }

  get showQRCode(): boolean {
    return this.settings.showQRCode;
  }

  get showMandala(): boolean {
    return this.settings.showMandala;
  }

  get startPositionLayout(): "row" | "column" {
    return this.settings.startPositionLayout;
  }

  /**
   * Resolve start position layout for a specific step count.
   * Checks per-step-count overrides first, then falls back to the global setting.
   */
  getStartPositionLayoutForStepCount(stepCount: number): "row" | "column" {
    const override = this.settings.startPositionLayoutOverrides[String(stepCount)];
    return override ?? this.settings.startPositionLayout;
  }

  /**
   * Check if a specific step count has a per-step-count override.
   */
  hasStartPositionLayoutOverride(stepCount: number): boolean {
    return String(stepCount) in this.settings.startPositionLayoutOverrides;
  }

  // Get all settings (for passing to share service)
  getSettings(): ImageCompositionSettings {
    return {
      ...this.settings,
      // Include computed addUserInfo for backwards compatibility
      addUserInfo: this.settings.showCreatorName || this.settings.showNotes || this.settings.showBirthday,
    };
  }

  // Setters
  setAddWord(value: boolean): void {
    this.settings.addWord = value;
    this.saveToStorage();
    this.notifyObservers();
  }

  setAddBeatNumbers(value: boolean): void {
    this.settings.addStepNumbers = value;
    this.saveToStorage();
    this.notifyObservers();
  }

  setAddDifficultyLevel(value: boolean): void {
    this.settings.addDifficultyLevel = value;
    this.saveToStorage();
    this.notifyObservers();
  }

  setIncludeStartPosition(value: boolean): void {
    this.settings.includeStartPosition = value;
    this.saveToStorage();
    this.notifyObservers();
  }

  /**
   * Convenience method to set all footer elements at once.
   * For backwards compatibility with code that uses addUserInfo.
   */
  setAddUserInfo(value: boolean): void {
    this.settings.showCreatorName = value;
    this.settings.showNotes = value;
    this.settings.showBirthday = value;
    this.saveToStorage();
    this.notifyObservers();
  }

  // Granular footer setters
  setShowCreatorName(value: boolean): void {
    this.settings.showCreatorName = value;
    this.saveToStorage();
    this.notifyObservers();
  }

  setShowNotes(value: boolean): void {
    this.settings.showNotes = value;
    this.saveToStorage();
    this.notifyObservers();
  }

  setShowBirthday(value: boolean): void {
    this.settings.showBirthday = value;
    this.saveToStorage();
    this.notifyObservers();
  }

  setShowQRCode(value: boolean): void {
    this.settings.showQRCode = value;
    this.saveToStorage();
    this.notifyObservers();
  }

  setShowMandala(value: boolean): void {
    this.settings.showMandala = value;
    this.saveToStorage();
    this.notifyObservers();
  }

  setStartPositionLayout(value: "row" | "column"): void {
    this.settings.startPositionLayout = value;
    this.saveToStorage();
    this.notifyObservers();
  }

  /**
   * Set start position layout for a specific step count.
   * If the value matches the global default, removes the override instead.
   */
  setStartPositionLayoutForStepCount(stepCount: number, value: "row" | "column"): void {
    if (value === this.settings.startPositionLayout) {
      // Matches global default - remove override to keep storage clean
      delete this.settings.startPositionLayoutOverrides[String(stepCount)];
    } else {
      this.settings.startPositionLayoutOverrides[String(stepCount)] = value;
    }
    this.saveToStorage();
    this.notifyObservers();
  }

  /**
   * Remove the per-step-count override so it falls back to global default.
   */
  clearStartPositionLayoutOverride(stepCount: number): void {
    delete this.settings.startPositionLayoutOverrides[String(stepCount)];
    this.saveToStorage();
    this.notifyObservers();
  }

  /**
   * Resolve the info-cell choice for a step count. Returns the per-length
   * override if set, else the derived default from the global toggles
   * (QR-preferential): both on -> "qr"; QR off -> "mandala"; both off -> "none".
   */
  getInfoCellChoiceForStepCount(stepCount: number): InfoCellChoice {
    const override = this.settings.infoCellChoiceOverrides[String(stepCount)];
    if (override) return override;
    return this.settings.showQRCode ? "qr" : this.settings.showMandala ? "mandala" : "none";
  }

  /**
   * Set the info-cell choice for a step count. If the value matches the derived
   * default, removes the override to keep storage clean (mirrors start-layout).
   */
  setInfoCellChoiceForStepCount(stepCount: number, value: InfoCellChoice): void {
    const derivedDefault: InfoCellChoice =
      this.settings.showQRCode ? "qr" : this.settings.showMandala ? "mandala" : "none";
    if (value === derivedDefault) {
      delete this.settings.infoCellChoiceOverrides[String(stepCount)];
    } else {
      this.settings.infoCellChoiceOverrides[String(stepCount)] = value;
    }
    this.saveToStorage();
    this.notifyObservers();
  }

  hasInfoCellChoiceOverride(stepCount: number): boolean {
    return String(stepCount) in this.settings.infoCellChoiceOverrides;
  }

  clearInfoCellChoiceOverride(stepCount: number): void {
    delete this.settings.infoCellChoiceOverrides[String(stepCount)];
    this.saveToStorage();
    this.notifyObservers();
  }

  /**
   * Get the column count override for a specific step count.
   * Returns null if no override is set (auto layout).
   */
  getColumnCountForStepCount(stepCount: number): number | null {
    const override = this.settings.columnCountOverrides[String(stepCount)];
    return override ?? null;
  }

  /**
   * Set the column count for a specific step count.
   * Pass null to remove the override (revert to auto).
   */
  setColumnCountForStepCount(stepCount: number, value: number | null): void {
    if (value === null) {
      delete this.settings.columnCountOverrides[String(stepCount)];
    } else {
      this.settings.columnCountOverrides[String(stepCount)] = value;
    }
    this.saveToStorage();
    this.notifyObservers();
  }

  setCustomNotesText(value: string): void {
    this.settings.customNotesText = value;
    this.saveToStorage();
    this.notifyObservers();
  }

  setDarkMode(value: boolean): void {
    this.settings.darkMode = value;
    this.saveToStorage();
    this.notifyObservers();
  }

  setCustomName(value: string | undefined): void {
    this.settings.customName = value;
    this.saveToStorage();
    this.notifyObservers();
  }

  setShowLoopGlyph(value: boolean): void {
    this.settings.showLoopGlyph = value;
    this.saveToStorage();
    this.notifyObservers();
  }

  // Toggle helpers (only for boolean fields)
  toggle(key: Exclude<keyof ImageCompositionSettings, 'customName'>): void {
    const currentValue = this.settings[key];
    if (typeof currentValue === 'boolean') {
      (this.settings[key] as boolean) = !currentValue;
      this.saveToStorage();
      this.notifyObservers();
    }
  }

  // Observer pattern for reactivity
  registerObserver(observer: Observer): void {
    this.observers.add(observer);
  }

  unregisterObserver(observer: Observer): void {
    this.observers.delete(observer);
  }
}

// Singleton instance — preserved across HMR so its loaded settings (showQRCode,
// showMandala, start-position layout) stay stable. Those feed the thumbnail cache
// key; if the manager reconstructed on each dev save it would briefly serve
// DEFAULT settings, churning the hash and forcing every gallery thumbnail to
// re-render. Mirrors auth-state's import.meta.hot.data pattern.
let instance: ImageCompositionStateManager | null =
  (import.meta.hot?.data?.instance as ImageCompositionStateManager | undefined) ?? null;

if (import.meta.hot) {
  import.meta.hot.dispose((data) => {
    data.instance = instance;
  });
}

export function getImageCompositionManager(): ImageCompositionStateManager {
  if (!instance) {
    instance = new ImageCompositionStateManager();
  }
  return instance;
}

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
import type { AppSettings } from "$lib/shared/settings/domain/app-settings";
import {
  COLUMN_COUNT_PREFERENCE_VERSION,
  getColumnCountPreferenceOwner,
  sanitizeColumnCountPreference,
  type ColumnCountPreferenceSource,
} from "$lib/shared/share/domain/column-count-preference";

const STORAGE_KEY = "tka-image-composition-settings";
const COLUMN_PREFERENCES_KEY = `${STORAGE_KEY}:column-preferences-v1`;

export interface ImageCompositionSettings {
  addWord: boolean;
  addStepNumbers: boolean;
  addDifficultyLevel: boolean;
  includeStartPosition: boolean;
  darkMode: boolean;
  customName?: string; // Optional custom name for header

  // LOOP glyph visibility (pie chart badge in header)
  showLoopGlyph: boolean; // Top-right: LOOP constraint indicator

  // Centered footer note. Personal names and dates are not card content.
  showNotes: boolean; // Bottom-center: notes text
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
  // Keys are step counts as strings. Null records an explicit Auto choice;
  // missing keys also use Auto until the user chooses a layout.
  // Controls how many beat columns ChoreoCards use for that sequence length.
  columnCountOverrides: Record<string, number | null>;
  // Numeric choices are trusted only when these fields match the active identity.
  columnCountPreferenceVersion?: number;
  columnCountPreferenceOwner?: string;

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

  // Footer notes are opt-in; customNotesText is used once enabled.
  showNotes: false,
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

  // Computed compatibility alias for showNotes
  addUserInfo: false,
};

type PersistedImageCompositionSettings = Partial<ImageCompositionSettings> & {
  showCreatorName?: unknown;
  showBirthday?: unknown;
};

function createSettings(
  seed: PersistedImageCompositionSettings | null = null
): ImageCompositionSettings {
  const {
    showCreatorName: _legacyCreatorName,
    showBirthday: _legacyBirthday,
    ...supportedSeed
  } = seed ?? {};
  const showNotes = supportedSeed.showNotes ?? DEFAULT_SETTINGS.showNotes;

  return {
    ...DEFAULT_SETTINGS,
    ...supportedSeed,
    showNotes,
    addUserInfo: showNotes,
    startPositionLayoutOverrides: {
      ...(supportedSeed.startPositionLayoutOverrides ?? {}),
    },
    columnCountOverrides: {
      ...(supportedSeed.columnCountOverrides ?? {}),
    },
    infoCellChoiceOverrides: {
      ...(supportedSeed.infoCellChoiceOverrides ?? {}),
    },
  };
}

type Observer = () => void;

class ImageCompositionStateManager {
  private settings = $state<ImageCompositionSettings>(createSettings());
  private observers = new Set<Observer>();
  // A user edit can outrank a late snapshot only for the identity that made it.
  private changedThisSession = false;
  private columnChangedThisSession = false;
  private activeColumnPreferenceOwner: string | null = null;
  private initialColumnPreference: ColumnCountPreferenceSource | null = null;
  private pendingRemoteSettings: {
    settings: AppSettings | null;
    userId: string;
  } | null = null;

  constructor() {
    if (browser) {
      this.loadSettings();
      // Stay in sync with global dark mode changes
      this.syncWithAnimationVisibility();
      this.adoptRemoteSettingsOnArrival();
      this.observeAuthIdentity();
    }
  }

  /**
   * Re-seat these settings when the authoritative Firestore result lands.
   * The source UID travels with the snapshot so a late callback from account A
   * can never mutate account B.
   */
  private adoptRemoteSettingsOnArrival(): void {
    settingsService.onRemoteSettingsApplied?.((remote, userId) => {
      const remoteOwner = getColumnCountPreferenceOwner({ uid: userId });
      if (this.activeColumnPreferenceOwner === null) {
        this.pendingRemoteSettings = { settings: remote, userId };
        return;
      }
      if (this.activeColumnPreferenceOwner !== remoteOwner) return;

      this.applyRemoteSettings(remote, remoteOwner);
    });
  }

  /**
   * Firebase can report `currentUser === null` while restoring auth. The auth
   * observer is the boundary at which a browser-global cache can safely be
   * associated with a guest or a specific account.
   */
  private observeAuthIdentity(): void {
    getAuthSync().onAuthStateChanged((user) => {
      const owner = getColumnCountPreferenceOwner(user);
      const previousOwner = this.activeColumnPreferenceOwner;
      const identityChanged = owner !== this.activeColumnPreferenceOwner;
      const carryLiveGuestChoiceIntoAnonymousIdentity =
        identityChanged &&
        previousOwner === "guest" &&
        user?.isAnonymous === true &&
        this.columnChangedThisSession;

      this.activeColumnPreferenceOwner = owner;
      if (carryLiveGuestChoiceIntoAnonymousIdentity) {
        this.settings.columnCountPreferenceVersion =
          COLUMN_COUNT_PREFERENCE_VERSION;
        this.settings.columnCountPreferenceOwner = owner;
        this.writeScopedColumnPreference(owner);
        this.writeLocalCopy();
        this.pendingRemoteSettings = null;
        void settingsService.updateSetting(
          "imageExport",
          createSettings(this.settings)
        );
        this.notifyObservers();
        return;
      }

      if (identityChanged) {
        this.changedThisSession = false;
        this.columnChangedThisSession = false;
      }

      const pending = this.pendingRemoteSettings;
      this.pendingRemoteSettings = null;
      if (
        pending &&
        getColumnCountPreferenceOwner({ uid: pending.userId }) === owner
      ) {
        this.applyRemoteSettings(pending.settings, owner);
        return;
      }

      const localPreference =
        this.readScopedColumnPreference(owner) ?? this.initialColumnPreference;
      this.applyColumnPreference(localPreference, owner);
    });
  }

  private applyRemoteSettings(remote: AppSettings | null, owner: string): void {
    const incoming = remote?.imageExport ?? null;
    if (this.changedThisSession && this.activeColumnPreferenceOwner === owner) {
      const remotePreference = sanitizeColumnCountPreference(incoming, owner);
      const currentPreference = sanitizeColumnCountPreference(
        this.settings,
        owner
      );
      const remoteHasCurrentColumns =
        !remotePreference.changed &&
        this.columnOverridesEqual(
          remotePreference.columnCountOverrides,
          currentPreference.columnCountOverrides
        );
      const source = this.columnChangedThisSession ? this.settings : incoming;
      const sanitized = this.applyColumnPreference(source, owner, false);
      this.writeLocalCopy();
      this.notifyObservers();
      if (
        (this.columnChangedThisSession && !remoteHasCurrentColumns) ||
        (!this.columnChangedThisSession && sanitized.changed)
      ) {
        void settingsService.updateSetting(
          "imageExport",
          createSettings(this.settings)
        );
      }
      return;
    }

    const darkMode = this.settings.darkMode;
    this.settings = createSettings(incoming);
    // Owned by AnimationVisibilityManager, not by account settings.
    this.settings.darkMode = darkMode;
    this.normalizeOverrides();

    const sanitized = this.applyColumnPreference(incoming, owner, false);
    this.writeLocalCopy();
    this.notifyObservers();

    if (sanitized.changed) {
      // This is a migration write, not a user edit. It turns every legacy or
      // cross-account numeric value into explicit Auto at the cloud boundary.
      void settingsService.updateSetting(
        "imageExport",
        createSettings(this.settings)
      );
    }
  }

  private columnOverridesEqual(
    left: Record<string, number | null>,
    right: Record<string, number | null>
  ): boolean {
    const leftKeys = Object.keys(left);
    const rightKeys = Object.keys(right);
    return (
      leftKeys.length === rightKeys.length &&
      leftKeys.every((key) => left[key] === right[key])
    );
  }

  private applyColumnPreference(
    source: ColumnCountPreferenceSource | null,
    owner: string,
    notify = true
  ) {
    const sanitized = sanitizeColumnCountPreference(source, owner);
    this.settings.columnCountOverrides = {
      ...sanitized.columnCountOverrides,
    };
    this.settings.columnCountPreferenceVersion =
      sanitized.columnCountPreferenceVersion;
    this.settings.columnCountPreferenceOwner =
      sanitized.columnCountPreferenceOwner;
    this.writeScopedColumnPreference(owner);
    this.writeLocalCopy();
    if (notify) this.notifyObservers();
    return sanitized;
  }

  private scopedColumnPreferenceKey(owner: string): string {
    return `${COLUMN_PREFERENCES_KEY}:${encodeURIComponent(owner)}`;
  }

  private readScopedColumnPreference(
    owner: string
  ): ColumnCountPreferenceSource | null {
    try {
      const stored = localStorage.getItem(
        this.scopedColumnPreferenceKey(owner)
      );
      return stored
        ? (JSON.parse(stored) as ColumnCountPreferenceSource)
        : null;
    } catch {
      console.warn("Failed to load scoped column preferences from storage");
      return null;
    }
  }

  private writeScopedColumnPreference(owner: string): void {
    try {
      localStorage.setItem(
        this.scopedColumnPreferenceKey(owner),
        JSON.stringify({
          columnCountOverrides: this.settings.columnCountOverrides,
          columnCountPreferenceVersion: COLUMN_COUNT_PREFERENCE_VERSION,
          columnCountPreferenceOwner: owner,
        })
      );
    } catch {
      console.warn("Failed to save scoped column preferences to storage");
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
   * Load the local copy of these settings.
   *
   * NOT a Firestore read. `settingsService.currentSettings.imageExport` at
   * construction time is the account-settings localStorage MIRROR, which is only
   * written when a user is signed in — so it goes stale the moment a change is
   * made before auth restores, and it was outranking the dedicated store below.
   * The dedicated store is written on every change, signed in or not, so it is
   * the local source of truth; the mirror only seeds a browser that has none.
   * The authoritative server copy arrives later via adoptRemoteSettingsOnArrival().
   */
  private loadSettings(): void {
    const localCopy = this.readLocalCopy();
    const accountMirror = settingsService.currentSettings.imageExport;
    const seed = localCopy ?? (getAuthSync().currentUser ? accountMirror : null);

    this.initialColumnPreference = seed
      ? {
          columnCountOverrides: { ...(seed.columnCountOverrides ?? {}) },
          columnCountPreferenceVersion: seed.columnCountPreferenceVersion,
          columnCountPreferenceOwner: seed.columnCountPreferenceOwner,
        }
      : null;
    this.settings = createSettings(seed);

    // Auth may still be restoring. No browser-global number is allowed onto the
    // card until the auth observer associates a versioned choice with its owner.
    this.settings.columnCountOverrides = {};
    this.settings.columnCountPreferenceVersion = undefined;
    this.settings.columnCountPreferenceOwner = undefined;
    let migrated = Boolean(
      seed?.columnCountOverrides &&
      Object.keys(seed.columnCountOverrides).length > 0
    );

    // Fix truncated default that was persisted due to previous save bug
    if (this.settings.customNotesText === "Created using TKA Scrib") {
      this.settings.customNotesText = DEFAULT_SETTINGS.customNotesText;
      migrated = true;
    }

    // Migrate: old persisted "column" default → new "row" default.
    // Only migrate if there are no per-step-count overrides (user hasn't customized yet).
    if (
      this.settings.startPositionLayout === "column" &&
      (!this.settings.startPositionLayoutOverrides ||
        Object.keys(this.settings.startPositionLayoutOverrides).length === 0)
    ) {
      this.settings.startPositionLayout = "row";
      migrated = true;
    }

    if (this.normalizeOverrides()) migrated = true;

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
          migrated = true;
        }
        try {
          localStorage.setItem(NOTES_MIGRATION_KEY, "1");
        } catch {
          // localStorage unavailable — migration retries next load, harmless.
        }
      }
    }
    // Note: darkMode is synced from AnimationVisibilityManager in syncWithAnimationVisibility()

    // Boot migrations are local-only. Calling settingsService here would mark a
    // guest snapshot "newer" and let it overwrite the account restored next.
    if (migrated) this.writeLocalCopy();
    this.changedThisSession = false;
    this.columnChangedThisSession = false;
  }

  private readLocalCopy(): Partial<ImageCompositionSettings> | null {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored ? (JSON.parse(stored) as Partial<ImageCompositionSettings>) : null;
    } catch {
      console.warn("Failed to load image composition settings from storage");
      return null;
    }
  }

  /**
   * Backfill override maps missing from older persisted data and drop column
   * overrides for lengths with no column options. Returns true when it changed
   * something, so the caller can persist.
   */
  private normalizeOverrides(): boolean {
    let changed = false;
    if (!this.settings.startPositionLayoutOverrides) {
      this.settings.startPositionLayoutOverrides = {};
      changed = true;
    }
    if (!this.settings.columnCountOverrides) {
      this.settings.columnCountOverrides = {};
      changed = true;
    }
    if (!this.settings.infoCellChoiceOverrides) {
      this.settings.infoCellChoiceOverrides = {};
      changed = true;
    }
    for (const key of Object.keys(this.settings.columnCountOverrides)) {
      if (Number(key) < 4) {
        delete this.settings.columnCountOverrides[key];
        changed = true;
      }
    }
    return changed;
  }

  private writeLocalCopy(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.settings));
    } catch {
      console.warn("Failed to save image composition settings to localStorage");
    }
  }

  /**
   * Persist locally for everyone and to account settings only after Firebase has
   * confirmed the active identity. Guest writes must not create a shared
   * `_localTimestamp` that can later be uploaded into a different account.
   */
  private saveToStorage(): void {
    if (!browser) return;

    this.changedThisSession = true;
    const owner = this.activeColumnPreferenceOwner;
    if (owner) {
      const sanitized = sanitizeColumnCountPreference(this.settings, owner);
      this.settings.columnCountOverrides = {
        ...sanitized.columnCountOverrides,
      };
      this.settings.columnCountPreferenceVersion =
        sanitized.columnCountPreferenceVersion;
      this.settings.columnCountPreferenceOwner =
        sanitized.columnCountPreferenceOwner;
      this.writeScopedColumnPreference(owner);
    }
    this.writeLocalCopy();

    const user = getAuthSync().currentUser;
    if (!user || owner !== getColumnCountPreferenceOwner(user)) {
      return;
    }

    // A deep plain copy avoids leaking $state proxies or shared override maps.
    void settingsService.updateSetting(
      "imageExport",
      createSettings(this.settings)
    );
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
    return this.settings.showNotes;
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

  get showNotes(): boolean {
    return this.settings.showNotes;
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
      ...createSettings(this.settings),
      // Include computed addUserInfo for backwards compatibility
      addUserInfo: this.settings.showNotes,
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
   * Convenience method to set the supported footer elements at once.
   * For backwards compatibility with code that uses addUserInfo.
   */
  setAddUserInfo(value: boolean): void {
    this.settings.showNotes = value;
    this.saveToStorage();
    this.notifyObservers();
  }

  setShowNotes(value: boolean): void {
    this.settings.showNotes = value;
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
   * Null stays in the persisted map so a merged account-settings write replaces
   * an older numeric choice instead of leaving that nested value behind.
   */
  setColumnCountForStepCount(stepCount: number, value: number | null): void {
    const owner =
      this.activeColumnPreferenceOwner ??
      getColumnCountPreferenceOwner(getAuthSync().currentUser);
    this.activeColumnPreferenceOwner = owner;
    this.settings.columnCountPreferenceVersion =
      COLUMN_COUNT_PREFERENCE_VERSION;
    this.settings.columnCountPreferenceOwner = owner;
    this.settings.columnCountOverrides[String(stepCount)] = value;
    this.columnChangedThisSession = true;
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

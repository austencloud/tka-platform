/**
 * Background Builder State
 *
 * Manages tab persistence and lab settings for the background builder module.
 * Lab settings are persisted via the app settings service for localStorage + Firebase sync.
 */

import { settingsService } from "$lib/shared/settings/state/SettingsState.svelte";
import { BackgroundType } from "@austencloud/backgrounds";
import {
  DEFAULT_NIGHT_SKY_SETTINGS,
  DEFAULT_FIREFLY_FOREST_SETTINGS,
  DEFAULT_CHERRY_BLOSSOM_SETTINGS,
  DEFAULT_RAINBOW_SETTINGS,
  DEFAULT_EMBER_GLOW_SETTINGS,
  DEFAULT_CELESTIAL_LAB_SETTINGS,
  DEFAULT_PURE_BLACK_LAB_SETTINGS,
  type NightSkyLabSettings,
  type FireflyForestLabSettings,
  type CherryBlossomLabSettings,
  type RainbowLabSettings,
  type EmberGlowLabSettings,
  type CelestialLabSettings,
  type PureBlackLabSettings,
  type BackgroundLabSettings,
} from "$lib/shared/background-builder/domain/lab-settings-types";

const STORAGE_KEY = "tka-background-builder-active-tab";

export type BackgroundBuilderTab =
  | "deep-ocean"
  | "night-sky"
  | "firefly-forest"
  | "cherry-blossom"
  | "pride"
  | "ember-glow"
  | "snowfall"
  | "autumn-drift"
  | "gradient";

const VALID_TABS: BackgroundBuilderTab[] = [
  "deep-ocean",
  "night-sky",
  "firefly-forest",
  "cherry-blossom",
  "pride",
  "ember-glow",
  "snowfall",
  "autumn-drift",
  "gradient",
];
const DEFAULT_TAB: BackgroundBuilderTab = "deep-ocean";

// Map builder tabs to background types for setting the active background
const TAB_TO_BACKGROUND_TYPE: Record<BackgroundBuilderTab, BackgroundType | null> = {
  "deep-ocean": BackgroundType.DEEP_OCEAN,
  "night-sky": BackgroundType.NIGHT_SKY,
  "firefly-forest": BackgroundType.FIREFLY_FOREST,
  "cherry-blossom": BackgroundType.CHERRY_BLOSSOM,
  "pride": BackgroundType.PRIDE,
  "ember-glow": BackgroundType.EMBER_GLOW,
  "snowfall": BackgroundType.SNOWFALL,
  "autumn-drift": BackgroundType.AUTUMN_DRIFT,
  "gradient": BackgroundType.LINEAR_GRADIENT,
};

function isValidTab(value: string): value is BackgroundBuilderTab {
  return VALID_TABS.includes(value as BackgroundBuilderTab);
}

function loadFromStorage(): BackgroundBuilderTab {
  if (typeof window === "undefined") return DEFAULT_TAB;
  const stored = localStorage.getItem(STORAGE_KEY);
  return stored && isValidTab(stored) ? stored : DEFAULT_TAB;
}

function saveToStorage(tab: BackgroundBuilderTab): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, tab);
}

// Reactive state
let currentTab = $state<BackgroundBuilderTab>(loadFromStorage());

export const backgroundBuilderState = {
  get currentTab() {
    return currentTab;
  },

  setCurrentTab(tab: BackgroundBuilderTab) {
    currentTab = tab;
    saveToStorage(tab);

    // Also update the user's active background setting
    const backgroundType = TAB_TO_BACKGROUND_TYPE[tab];
    if (backgroundType) {
      const isSimple = backgroundType === BackgroundType.LINEAR_GRADIENT ||
                       backgroundType === BackgroundType.SOLID_COLOR;
      void settingsService.updateSetting("backgroundCategory", isSimple ? "simple" : "animated");
      void settingsService.updateSetting("backgroundType", backgroundType);
    }
  },

  reset() {
    currentTab = DEFAULT_TAB;
    saveToStorage(DEFAULT_TAB);
  },
};

// ============================================================================
// Lab Settings Persistence
// ============================================================================

/**
 * Get current lab settings from app settings, with defaults applied
 */
function getLabSettings(): BackgroundLabSettings {
  return settingsService.settings.backgroundLabSettings ?? {};
}

/**
 * Save lab settings to app settings (triggers localStorage + Firebase sync)
 */
function saveLabSettings(settings: BackgroundLabSettings): void {
  void settingsService.updateSetting("backgroundLabSettings", settings);
}

// ============================================================================
// Night Sky Lab Settings
// ============================================================================

export function getNightSkySettings(): NightSkyLabSettings {
  const labSettings = getLabSettings();
  return labSettings.nightSky ?? { ...DEFAULT_NIGHT_SKY_SETTINGS };
}

export function updateNightSkySettings(settings: Partial<NightSkyLabSettings>): void {
  const current = getNightSkySettings();
  const updated = { ...current, ...settings };
  const labSettings = getLabSettings();
  saveLabSettings({ ...labSettings, nightSky: updated });
}

// ============================================================================
// Firefly Forest Lab Settings
// ============================================================================

export function getFireflyForestSettings(): FireflyForestLabSettings {
  const labSettings = getLabSettings();
  return labSettings.fireflyForest ?? { ...DEFAULT_FIREFLY_FOREST_SETTINGS };
}

export function updateFireflyForestSettings(settings: Partial<FireflyForestLabSettings>): void {
  const current = getFireflyForestSettings();
  const updated = { ...current, ...settings };
  const labSettings = getLabSettings();
  saveLabSettings({ ...labSettings, fireflyForest: updated });
}

// ============================================================================
// Cherry Blossom Lab Settings
// ============================================================================

export function getCherryBlossomSettings(): CherryBlossomLabSettings {
  const labSettings = getLabSettings();
  return labSettings.cherryBlossom ?? { ...DEFAULT_CHERRY_BLOSSOM_SETTINGS };
}

export function updateCherryBlossomSettings(settings: Partial<CherryBlossomLabSettings>): void {
  const current = getCherryBlossomSettings();
  const updated = { ...current, ...settings };
  const labSettings = getLabSettings();
  saveLabSettings({ ...labSettings, cherryBlossom: updated });
}

// ============================================================================
// Pride Lab Settings
// ============================================================================

export function getPrideSettings(): RainbowLabSettings {
  const labSettings = getLabSettings();
  return labSettings.rainbow ?? { ...DEFAULT_RAINBOW_SETTINGS };
}

export function updatePrideSettings(settings: Partial<RainbowLabSettings>): void {
  const current = getPrideSettings();
  const updated = { ...current, ...settings };
  const labSettings = getLabSettings();
  saveLabSettings({ ...labSettings, rainbow: updated });
}

// Legacy aliases for backwards compatibility
export const getRainbowSettings = getPrideSettings;
export const updateRainbowSettings = updatePrideSettings;

// ============================================================================
// Ember Glow Lab Settings
// ============================================================================

export function getEmberGlowSettings(): EmberGlowLabSettings {
  const labSettings = getLabSettings();
  return labSettings.emberGlow ?? { ...DEFAULT_EMBER_GLOW_SETTINGS };
}

export function updateEmberGlowSettings(settings: Partial<EmberGlowLabSettings>): void {
  const current = getEmberGlowSettings();
  const updated = { ...current, ...settings };
  const labSettings = getLabSettings();
  saveLabSettings({ ...labSettings, emberGlow: updated });
}

// ============================================================================
// Celestial Lab Settings
// ============================================================================

export function getCelestialLabSettings(): CelestialLabSettings {
  const labSettings = getLabSettings();
  return labSettings.celestial ?? { ...DEFAULT_CELESTIAL_LAB_SETTINGS };
}

export function updateCelestialLabSettings(settings: Partial<CelestialLabSettings>): void {
  const current = getCelestialLabSettings();
  const updated = { ...current, ...settings };
  const labSettings = getLabSettings();
  saveLabSettings({ ...labSettings, celestial: updated });
}

// ============================================================================
// Pure Black Lab Settings
// ============================================================================

export function getPureBlackLabSettings(): PureBlackLabSettings {
  const labSettings = getLabSettings();
  return labSettings.pureBlack ?? { ...DEFAULT_PURE_BLACK_LAB_SETTINGS };
}

export function updatePureBlackLabSettings(settings: Partial<PureBlackLabSettings>): void {
  const current = getPureBlackLabSettings();
  const updated = { ...current, ...settings };
  const labSettings = getLabSettings();
  saveLabSettings({ ...labSettings, pureBlack: updated });
}

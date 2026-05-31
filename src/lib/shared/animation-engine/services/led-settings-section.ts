import { findPreset, type LedColorPreset } from "../domain/types/led-color-presets";

export interface LedSettings {
  ledBrightness: number;
  ledPatternId: string;
  ledPrimaryColor: string;
  ledSecondaryColor: string;
  ledActivePresetId: string | null;
  ledUserPresets: LedColorPreset[];
  ledPatternSpeed: number;
  ledColorMode: "unified" | "per-hand" | "prop-matched";
}

export interface LedSettingsAccessor {
  getLedPatternId(): string;
  setLedPatternId(patternId: string): void;
  getLedPrimaryColor(): string;
  setLedPrimaryColor(color: string): void;
  getLedBrightness(): number;
  setLedBrightness(level: number): void;
  getLedSecondaryColor(): string;
  setLedSecondaryColor(color: string): void;
  getActivePresetId(): string | null;
  setActivePreset(presetId: string): void;
  getUserPresets(): LedColorPreset[];
  addUserPreset(name: string, primaryColor: string): void;
  removeUserPreset(presetId: string): void;
  getLedPatternSpeed(): number;
  setLedPatternSpeed(speed: number): void;
  getLedColorMode(): "unified" | "per-hand" | "prop-matched";
  setLedColorMode(mode: "unified" | "per-hand" | "prop-matched"): void;
}

export function createLedSettingsSection(
  getSettings: () => LedSettings,
  mutate: (updater: (s: LedSettings) => void) => void,
): LedSettingsAccessor {
  return {
    getLedPatternId() {
      return getSettings().ledPatternId;
    },

    setLedPatternId(patternId: string) {
      mutate((s) => { s.ledPatternId = patternId; });
    },

    getLedPrimaryColor() {
      return getSettings().ledPrimaryColor;
    },

    setLedPrimaryColor(color: string) {
      mutate((s) => { s.ledPrimaryColor = color; });
    },

    getLedBrightness() {
      return getSettings().ledBrightness;
    },

    setLedBrightness(level: number) {
      mutate((s) => { s.ledBrightness = Math.max(1, Math.min(5, Math.round(level))); });
    },

    getLedSecondaryColor() {
      return getSettings().ledSecondaryColor;
    },

    setLedSecondaryColor(color: string) {
      const current = getSettings().ledSecondaryColor;
      if (current === color) return;
      mutate((s) => { s.ledSecondaryColor = color; });
    },

    getActivePresetId() {
      return getSettings().ledActivePresetId;
    },

    setActivePreset(presetId: string) {
      const settings = getSettings();
      const preset = findPreset(presetId, settings.ledUserPresets);
      if (!preset) return;
      mutate((s) => {
        s.ledActivePresetId = presetId;
        s.ledPrimaryColor = preset.primaryColor;
        if (preset.secondaryColor) {
          s.ledSecondaryColor = preset.secondaryColor;
        }
      });
    },

    getUserPresets() {
      return getSettings().ledUserPresets;
    },

    addUserPreset(name: string, primaryColor: string) {
      const id = `user-${Date.now()}`;
      mutate((s) => {
        s.ledUserPresets = [
          ...s.ledUserPresets,
          { id, name, primaryColor, builtIn: false },
        ];
      });
    },

    removeUserPreset(presetId: string) {
      mutate((s) => {
        s.ledUserPresets = s.ledUserPresets.filter((p) => p.id !== presetId);
        if (s.ledActivePresetId === presetId) {
          s.ledActivePresetId = null;
        }
      });
    },

    getLedPatternSpeed() {
      return getSettings().ledPatternSpeed;
    },

    setLedPatternSpeed(speed: number) {
      mutate((s) => { s.ledPatternSpeed = Math.max(0.1, Math.min(5.0, speed)); });
    },

    getLedColorMode() {
      return getSettings().ledColorMode;
    },

    setLedColorMode(mode: "unified" | "per-hand" | "prop-matched") {
      mutate((s) => { s.ledColorMode = mode; });
    },
  };
}

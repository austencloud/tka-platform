import type { CustomBinding, ShortcutSettings } from "./types/keyboard-types";
import { isValidKeyCombo } from "../utils/key-combo-utils";

export const SHORTCUT_SETTINGS_VERSION = 1;

const FORBIDDEN_BINDING_IDS = new Set([
  "__proto__",
  "constructor",
  "prototype",
]);

export function createDefaultShortcutSettings(): ShortcutSettings {
  return {
    schemaVersion: SHORTCUT_SETTINGS_VERSION,
    enableSingleKeyShortcuts: true,
    enableVimStyleNavigation: false,
    showShortcutHints: true,
    playSoundOnActivation: false,
    customBindings: {},
  };
}

export function decodeShortcutSettings(raw: string | null): ShortcutSettings {
  const defaults = createDefaultShortcutSettings();
  if (!raw) return defaults;

  try {
    const parsed: unknown = JSON.parse(raw);
    if (!isRecord(parsed)) return defaults;

    return {
      schemaVersion: SHORTCUT_SETTINGS_VERSION,
      enableSingleKeyShortcuts: readBoolean(
        parsed.enableSingleKeyShortcuts,
        defaults.enableSingleKeyShortcuts
      ),
      enableVimStyleNavigation: readBoolean(
        parsed.enableVimStyleNavigation,
        defaults.enableVimStyleNavigation
      ),
      showShortcutHints: readBoolean(
        parsed.showShortcutHints,
        defaults.showShortcutHints
      ),
      playSoundOnActivation: readBoolean(
        parsed.playSoundOnActivation,
        defaults.playSoundOnActivation
      ),
      customBindings: decodeCustomBindings(parsed.customBindings),
    };
  } catch {
    return defaults;
  }
}

export function encodeShortcutSettings(settings: ShortcutSettings): string {
  return JSON.stringify({
    ...settings,
    schemaVersion: SHORTCUT_SETTINGS_VERSION,
  });
}

function decodeCustomBindings(value: unknown): Record<string, CustomBinding> {
  if (!isRecord(value)) return {};

  const bindings: Record<string, CustomBinding> = {};
  for (const [shortcutId, candidate] of Object.entries(value)) {
    if (FORBIDDEN_BINDING_IDS.has(shortcutId) || !isRecord(candidate)) {
      continue;
    }

    const { keyCombo, disabled } = candidate;
    if (typeof keyCombo !== "string" || !isValidKeyCombo(keyCombo)) {
      continue;
    }

    bindings[shortcutId] = {
      keyCombo,
      ...(typeof disabled === "boolean" ? { disabled } : {}),
    };
  }

  return bindings;
}

function readBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

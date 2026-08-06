import { describe, expect, it } from "vitest";
import {
  SHORTCUT_SETTINGS_VERSION,
  createDefaultShortcutSettings,
  decodeShortcutSettings,
  encodeShortcutSettings,
} from "./shortcut-settings-codec";

describe("shortcut settings codec", () => {
  it("migrates unversioned settings without losing valid bindings", () => {
    const decoded = decodeShortcutSettings(
      JSON.stringify({
        enableSingleKeyShortcuts: false,
        customBindings: {
          "create.save": { keyCombo: "ctrl+shift+s", disabled: true },
        },
      })
    );

    expect(decoded.schemaVersion).toBe(SHORTCUT_SETTINGS_VERSION);
    expect(decoded.enableSingleKeyShortcuts).toBe(false);
    expect(decoded.enableVimStyleNavigation).toBe(false);
    expect(decoded.customBindings["create.save"]).toEqual({
      keyCombo: "ctrl+shift+s",
      disabled: true,
    });
  });

  it("falls back field by field and discards malformed bindings", () => {
    const decoded = decodeShortcutSettings(
      JSON.stringify({
        enableSingleKeyShortcuts: "yes",
        showShortcutHints: false,
        customBindings: {
          valid: { keyCombo: "alt+k" },
          missingCombo: { disabled: true },
          emptyCombo: { keyCombo: "" },
          primitive: "ctrl+x",
        },
      })
    );

    expect(decoded.enableSingleKeyShortcuts).toBe(true);
    expect(decoded.showShortcutHints).toBe(false);
    expect(decoded.customBindings).toEqual({
      valid: { keyCombo: "alt+k" },
    });
  });

  it("returns fresh defaults for malformed JSON", () => {
    const first = decodeShortcutSettings("not-json");
    const second = decodeShortcutSettings(null);

    first.customBindings.changed = { keyCombo: "x" };
    expect(second).toEqual(createDefaultShortcutSettings());
  });

  it("always writes the current schema version", () => {
    const encoded = encodeShortcutSettings({
      ...createDefaultShortcutSettings(),
      schemaVersion: 0,
    });

    expect(JSON.parse(encoded).schemaVersion).toBe(SHORTCUT_SETTINGS_VERSION);
  });
});

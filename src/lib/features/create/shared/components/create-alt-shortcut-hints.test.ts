import { describe, expect, it } from "vitest";
import type {
  KeyModifier,
  ShortcutRegistrationOptions,
} from "$lib/shared/keyboard/domain/types/keyboard-types";
import type { ShortcutWithBinding } from "$lib/shared/keyboard/services/types";
import { buildCreateAltShortcutHints } from "./create-alt-shortcut-hints";

function shortcut(
  id: string,
  key: string,
  modifiers: KeyModifier[] = ["alt"],
  disabled = false
): ShortcutWithBinding {
  const registration: ShortcutRegistrationOptions = {
    id,
    label: id,
    key,
    modifiers: ["alt"],
    context: "create",
    scope: "sequence-management",
    priority: "medium",
    action: () => {},
  };

  return {
    shortcut: registration,
    defaultBinding: { key, modifiers: ["alt"] },
    effectiveBinding: { key, modifiers },
    customBinding: null,
    isCustomized: key !== registration.key || modifiers.length !== 1,
    isDisabled: disabled,
  };
}

describe("Create Alt shortcut hints", () => {
  it("uses effective bindings and omits disabled or non-Alt commands", () => {
    const model = buildCreateAltShortcutHints([
      shortcut("create.transform-mirror", "q"),
      shortcut("create.transform-flip", "v", ["ctrl"]),
      shortcut("create.transform-invert", "i", ["alt"], true),
    ]);

    expect(model.transforms).toEqual([
      {
        id: "create.transform-mirror",
        label: "Mirror",
        binding: { key: "q", modifiers: [] },
      },
    ]);
  });

  it("keeps additional modifiers after removing the shared Alt modifier", () => {
    const model = buildCreateAltShortcutHints([
      shortcut("create.transform-rewind", "w", ["alt", "shift"]),
    ]);

    expect(model.transforms[0]?.binding).toEqual({
      key: "w",
      modifiers: ["shift"],
    });
  });

  it("summarizes the default prop row without hardcoding unavailable presets", () => {
    const allPresets = Array.from({ length: 10 }, (_, index) =>
      shortcut(
        `create.select-preset-${index}`,
        index === 9 ? "0" : String(index + 1)
      )
    );
    const complete = buildCreateAltShortcutHints(allPresets);
    const missing = buildCreateAltShortcutHints(
      allPresets.map((item, index) =>
        index === 4 ? { ...item, isDisabled: true } : item
      )
    );

    expect(complete.propSummary).toEqual({ key: "1–0", modifiers: [] });
    expect(missing.propSummary).toEqual({
      key: "1·2·3·4·6·7·8·9·0",
      modifiers: [],
    });
  });
});

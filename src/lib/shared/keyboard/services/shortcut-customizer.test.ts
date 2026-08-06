// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { Shortcut } from "../domain/models/shortcut";
import { keyboardShortcutState } from "../state/keyboard-shortcut-state.svelte";
import { ShortcutCustomizer } from "./shortcut-customizer";
import { ShortcutRegistry } from "./shortcut-registry";

function shortcut(
  id: string,
  label: string,
  key: string,
  alternateKey?: string
): Shortcut {
  return new Shortcut({
    id,
    label,
    key,
    modifiers: [],
    alternateBindings: alternateKey
      ? [{ key: alternateKey, modifiers: [] }]
      : [],
    context: "create",
    scope: "action",
    priority: "medium",
    preventDefault: true,
    stopPropagation: false,
    action: () => {},
    enabled: true,
    isSingleKey: true,
    forceExecute: false,
    preserveDrawers: false,
  });
}

describe("ShortcutCustomizer", () => {
  let registry: ShortcutRegistry;
  let customizer: ShortcutCustomizer;

  beforeEach(() => {
    localStorage.clear();
    keyboardShortcutState.resetAllCustomBindings();
    registry = new ShortcutRegistry();
    registry.add(shortcut("first", "First command", "a"));
    registry.add(shortcut("second", "Second command", "b"));
    registry.add(shortcut("third", "Third command", "b"));
    customizer = new ShortcutCustomizer(registry);
  });

  afterEach(() => keyboardShortcutState.resetAllCustomBindings());

  it("returns every conflicting command for a proposed binding", () => {
    const conflicts = customizer.detectConflicts("first", "b");

    expect(conflicts).toHaveLength(2);
    expect(conflicts.every(({ severity }) => severity === "error")).toBe(true);
    expect(
      conflicts.map(({ existingShortcutId }) => existingShortcutId)
    ).toEqual(["second", "third"]);
  });

  it("replaces conflicts atomically by disabling every conflicting command", () => {
    customizer.replaceBinding("first", "b");

    expect(customizer.getCustomBinding("first")).toEqual({ keyCombo: "b" });
    expect(customizer.isDisabled("second")).toBe(true);
    expect(customizer.isDisabled("third")).toBe(true);
  });

  it("swaps two bindings in one state update", () => {
    registry.remove("third");
    const conflict = customizer.swapBindings("first", "second");

    expect(conflict).toBeNull();
    expect(customizer.getCustomBinding("first")).toEqual({ keyCombo: "b" });
    expect(customizer.getCustomBinding("second")).toEqual({ keyCombo: "a" });
    expect(customizer.getCustomizedCount()).toBe(2);
  });

  it("does not store a binding that matches the default", () => {
    expect(customizer.setCustomBinding("first", "a")).toBeNull();
    expect(customizer.getCustomBinding("first")).toBeNull();
    expect(customizer.getCustomizedCount()).toBe(0);
  });

  it("detects conflicts with an alternate default binding", () => {
    registry.add(shortcut("redo", "Redo", "z", "y"));
    registry.add(shortcut("fourth", "Fourth command", "y"));

    expect(customizer.detectConflict("first", "y")).toMatchObject({
      existingShortcutId: "redo",
      keyCombo: "y",
      severity: "error",
    });
    expect(customizer.detectAllConflicts()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          keyCombo: "y",
        }),
      ])
    );
  });
});

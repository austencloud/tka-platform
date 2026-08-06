import { describe, expect, it, vi } from "vitest";
import { Shortcut } from "../domain/models/shortcut";
import { ShortcutRegistry } from "./shortcut-registry";

function shortcut(): Shortcut {
  return new Shortcut({
    id: "test",
    label: "Test",
    key: "t",
    modifiers: [],
    context: "global",
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

describe("ShortcutRegistry subscriptions", () => {
  it("notifies for observable registry changes and supports unsubscribe", () => {
    const registry = new ShortcutRegistry();
    const listener = vi.fn();
    const unsubscribe = registry.subscribe(listener);

    registry.add(shortcut());
    registry.remove("missing");
    registry.clear();
    unsubscribe();
    registry.add(shortcut());

    expect(listener).toHaveBeenCalledTimes(2);
  });
});

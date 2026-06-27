// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { KeyboardShortcutManager } from "./keyboard-shortcut-manager";
import type { ShortcutRegistry } from "./shortcut-registry";

/**
 * Minimal registry stub. handleKeydown's suppressor check runs before any
 * registry call, so a suppressed event must never reach findMatches — that is
 * the contract guarding the Assemble-numpad / global-shortcut collision (most
 * dangerously NumpadDecimal -> Delete -> "delete selected beat").
 */
function makeManager() {
  const findMatches = vi.fn(() => []);
  const registry = {
    findMatches,
    clear: vi.fn(),
  } as unknown as ShortcutRegistry;
  const manager = new KeyboardShortcutManager(registry);
  manager.initialize();
  return { manager, findMatches };
}

describe("KeyboardShortcutManager.addInputSuppressor", () => {
  let dispose: (() => void) | null = null;
  afterEach(() => {
    dispose?.();
    dispose = null;
  });

  it("skips shortcut matching for suppressed events", () => {
    const { manager, findMatches } = makeManager();
    dispose = () => manager.dispose();
    manager.addInputSuppressor((e) => e.code.startsWith("Numpad"));

    window.dispatchEvent(new KeyboardEvent("keydown", { code: "NumpadDecimal", key: "Delete" }));
    expect(findMatches).not.toHaveBeenCalled();
  });

  it("still matches non-suppressed events", () => {
    const { manager, findMatches } = makeManager();
    dispose = () => manager.dispose();
    manager.addInputSuppressor((e) => e.code.startsWith("Numpad"));

    window.dispatchEvent(new KeyboardEvent("keydown", { code: "KeyA", key: "a" }));
    expect(findMatches).toHaveBeenCalled();
  });

  it("resumes matching after the suppressor is released", () => {
    const { manager, findMatches } = makeManager();
    dispose = () => manager.dispose();
    const release = manager.addInputSuppressor((e) => e.code.startsWith("Numpad"));

    window.dispatchEvent(new KeyboardEvent("keydown", { code: "Numpad2", key: "ArrowDown" }));
    expect(findMatches).not.toHaveBeenCalled();

    release();
    window.dispatchEvent(new KeyboardEvent("keydown", { code: "Numpad2", key: "ArrowDown" }));
    expect(findMatches).toHaveBeenCalledOnce();
  });
});

// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { KeyboardShortcutManager } from "./keyboard-shortcut-manager";
import { ShortcutRegistry } from "./shortcut-registry";

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

    window.dispatchEvent(
      new KeyboardEvent("keydown", { code: "NumpadDecimal", key: "Delete" })
    );
    expect(findMatches).not.toHaveBeenCalled();
  });

  it("still matches non-suppressed events", () => {
    const { manager, findMatches } = makeManager();
    dispose = () => manager.dispose();
    manager.addInputSuppressor((e) => e.code.startsWith("Numpad"));

    window.dispatchEvent(
      new KeyboardEvent("keydown", { code: "KeyA", key: "a" })
    );
    expect(findMatches).toHaveBeenCalled();
  });

  it("resumes matching after the suppressor is released", () => {
    const { manager, findMatches } = makeManager();
    dispose = () => manager.dispose();
    const release = manager.addInputSuppressor((e) =>
      e.code.startsWith("Numpad")
    );

    window.dispatchEvent(
      new KeyboardEvent("keydown", { code: "Numpad2", key: "ArrowDown" })
    );
    expect(findMatches).not.toHaveBeenCalled();

    release();
    window.dispatchEvent(
      new KeyboardEvent("keydown", { code: "Numpad2", key: "ArrowDown" })
    );
    expect(findMatches).toHaveBeenCalledOnce();
  });

  it("ignores Safari keydown-shaped events that do not expose a key", () => {
    const { manager, findMatches } = makeManager();
    dispose = () => manager.dispose();

    expect(() => {
      window.dispatchEvent(new Event("keydown"));
    }).not.toThrow();
    expect(findMatches).not.toHaveBeenCalled();
  });

  it("matches the question-mark shortcut without firing while typing", () => {
    const action = vi.fn();
    const manager = new KeyboardShortcutManager(new ShortcutRegistry());
    dispose = () => manager.dispose();
    manager.register({
      id: "help",
      label: "Help",
      key: "/",
      modifiers: ["shift"],
      action,
    });
    manager.initialize();

    window.dispatchEvent(
      new KeyboardEvent("keydown", { key: "?", shiftKey: true })
    );
    expect(action).toHaveBeenCalledOnce();

    const input = document.createElement("input");
    document.body.append(input);
    input.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "?",
        shiftKey: true,
        bubbles: true,
      })
    );
    expect(action).toHaveBeenCalledOnce();
    input.remove();
  });

  it("matches Ctrl shortcuts on Windows and Command shortcuts on macOS", () => {
    const action = vi.fn();
    const manager = new KeyboardShortcutManager(new ShortcutRegistry());
    dispose = () => manager.dispose();
    manager.register({
      id: "palette",
      label: "Command palette",
      key: "k",
      modifiers: ["ctrl"],
      action,
    });
    manager.initialize();

    window.dispatchEvent(
      new KeyboardEvent("keydown", { key: "k", ctrlKey: true })
    );
    window.dispatchEvent(
      new KeyboardEvent("keydown", { key: "k", metaKey: true })
    );

    expect(action).toHaveBeenCalledTimes(2);
  });
});

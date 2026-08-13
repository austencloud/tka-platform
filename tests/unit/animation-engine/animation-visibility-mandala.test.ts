// @vitest-environment jsdom

import { beforeEach, describe, expect, it } from "vitest";
import { AnimationVisibilityStateManager } from "../../../src/lib/shared/animation-engine/state/animation-visibility-state.svelte";

const STORAGE_KEY = "animation-visibility-settings";

describe("mandala visibility", () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.classList.remove("dark");
  });

  it("defaults on and toggles through the shared visibility contract", () => {
    const vm = new AnimationVisibilityStateManager({ ephemeral: true });

    expect(vm.getVisibility("mandala")).toBe(true);
    vm.toggleVisibility("mandala");
    expect(vm.getVisibility("mandala")).toBe(false);
  });

  it("migrates older persisted settings with mandala on", () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ gridMode: "8point", props: true })
    );

    const vm = new AnimationVisibilityStateManager();

    expect(vm.getVisibility("mandala")).toBe(true);
    vm.setVisibility("mandala", false);
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}").mandala).toBe(
      false
    );
  });

  it("preserves an explicit persisted off choice", () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ gridMode: "8point", props: true, mandala: false })
    );

    const vm = new AnimationVisibilityStateManager();

    expect(vm.getVisibility("mandala")).toBe(false);
  });
});

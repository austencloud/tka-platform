// @vitest-environment jsdom

import { beforeEach, describe, expect, it } from "vitest";
import { AnimationVisibilityStateManager } from "../../../src/lib/shared/animation-engine/state/animation-visibility-state.svelte";

const STORAGE_KEY = "animation-visibility-settings";

describe("mandala visibility", () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.classList.remove("dark");
  });

  it("defaults off and toggles through the shared visibility contract", () => {
    const vm = new AnimationVisibilityStateManager({ ephemeral: true });

    expect(vm.getVisibility("mandala")).toBe(false);
    vm.toggleVisibility("mandala");
    expect(vm.getVisibility("mandala")).toBe(true);
  });

  it("migrates older persisted settings with mandala off", () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ gridMode: "8point", props: true }),
    );

    const vm = new AnimationVisibilityStateManager();

    expect(vm.getVisibility("mandala")).toBe(false);
    vm.setVisibility("mandala", true);
    expect(
      JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}").mandala,
    ).toBe(true);
  });
});

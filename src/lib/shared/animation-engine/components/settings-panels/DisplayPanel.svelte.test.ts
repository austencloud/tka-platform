import { page } from "vitest/browser";
import { render } from "vitest-browser-svelte";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AnimationVisibilityStateManager } from "../../state/animation-visibility-state.svelte";
import { createAnimationSettingsState } from "../../state/animation-settings-state.svelte";
import DisplayPanel from "./DisplayPanel.svelte";

const scopeRef = vi.hoisted(() => ({
  current: null as {
    visibility: AnimationVisibilityStateManager;
    settings: ReturnType<typeof createAnimationSettingsState>;
  } | null,
}));

vi.mock("../../state/animation-scope-context", () => ({
  getAnimationScopeContext: () => scopeRef.current,
}));

beforeEach(() => {
  scopeRef.current = {
    visibility: new AnimationVisibilityStateManager({ ephemeral: true }),
    settings: createAnimationSettingsState({ ephemeral: true }),
  };
});

describe("DisplayPanel prop visibility", () => {
  it("shows props with one click when trail-only mode was persisted", async () => {
    const scope = scopeRef.current;
    expect(scope).not.toBeNull();
    if (!scope) return;

    scope.settings.setHideProps(true);
    render(DisplayPanel);

    const propsButton = page.getByRole("button", {
      name: "Props",
      exact: true,
    });
    await expect.element(propsButton).toHaveAttribute("aria-pressed", "false");

    await propsButton.click();

    expect(scope.visibility.getVisibility("props")).toBe(true);
    expect(scope.settings.trail.hideProps).toBe(false);
    await expect.element(propsButton).toHaveAttribute("aria-pressed", "true");
  });
});

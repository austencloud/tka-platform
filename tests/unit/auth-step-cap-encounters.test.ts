import { beforeEach, describe, expect, it, vi } from "vitest";
import { getAuthPromptContent } from "$lib/shared/auth/domain/auth-nudge-trigger";
import { authDrawerState } from "$lib/shared/auth/state/auth-drawer-state.svelte";

vi.mock("$lib/shared/analytics/auth-events", () => ({
  trackAuthSurfaceOpened: vi.fn(),
}));

beforeEach(() => authDrawerState.reset());

describe("step cap encounters", () => {
  it("counts reopening the gate but ignores duplicate calls and other gates", () => {
    authDrawerState.show("signup", "step-cap-guest");
    authDrawerState.show("signup", "step-cap-guest");
    expect(authDrawerState.stepCapAttempts).toBe(1);
    authDrawerState.hide();
    authDrawerState.show("signup", "save");
    expect(authDrawerState.stepCapAttempts).toBe(1);
    authDrawerState.show("signup", "step-cap-guest");
    expect(authDrawerState.stepCapAttempts).toBe(2);
    authDrawerState.hide();
    authDrawerState.show("signup", "step-cap-guest");
    expect(authDrawerState.stepCapAttempts).toBe(3);
  });

  it("clears encounter history when authentication resets", () => {
    authDrawerState.show("signup", "step-cap-guest");
    authDrawerState.reset();
    expect(authDrawerState.stepCapAttempts).toBe(0);
    expect(authDrawerState.open).toBe(false);
    authDrawerState.show("signup", "step-cap-guest");
    expect(authDrawerState.stepCapAttempts).toBe(1);
  });

  it("keeps the account benefit and context stable through many fresh greetings", () => {
    const first = getAuthPromptContent("step-cap-guest", "signup");
    const titles = new Set<string>();
    let previous = first.title;
    for (let attempt = 2; attempt <= 100; attempt++) {
      const next = getAuthPromptContent("step-cap-guest", "signup", attempt);
      expect(next.title).not.toBe(previous);
      expect(next.body).toBe(first.body);
      expect(next.key).toBe(first.key);
      expect(next.title).toBeTruthy();
      titles.add(next.title);
      previous = next.title;
    }
    expect(titles.size).toBeGreaterThanOrEqual(6);
  });

  it("does not change unrelated prompts or fail on invalid encounter counts", () => {
    expect(getAuthPromptContent("save", "signup", 10)).toEqual(
      getAuthPromptContent("save", "signup")
    );
    for (const count of [0, -1, NaN, Infinity]) {
      expect(getAuthPromptContent("step-cap-guest", "signup", count)).toEqual(
        getAuthPromptContent("step-cap-guest", "signup")
      );
    }
  });
});

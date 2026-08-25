import { describe, it, expect, vi, beforeEach } from "vitest";

// onboarding-events routes through captureWhenReady, not captureEvent: these
// prompts are rare and load-bearing, so they wait for the PostHog ready hook
// instead of dropping silently when a capture lands before init (e2298a5d1d).
vi.mock("../posthog", () => ({
  captureWhenReady: vi.fn(),
}));

import { captureWhenReady } from "../posthog";
import {
  logOnboardingGuestFirstSavePromptShown,
  logOnboardingGuestFirstSavePromptAccepted,
  logOnboardingGuestFirstSavePromptDeclined,
  logOnboardingGuestFirstSavePromptLogin,
} from "../onboarding-events";

describe("onboarding-events: guest first-save prompt (SP3 Part B)", () => {
  beforeEach(() => {
    vi.mocked(captureWhenReady).mockClear();
  });

  it("logOnboardingGuestFirstSavePromptShown captures onboarding_guest_first_save_prompt_shown", () => {
    logOnboardingGuestFirstSavePromptShown({ source: "app_entry" });
    expect(captureWhenReady).toHaveBeenCalledTimes(1);
    expect(captureWhenReady).toHaveBeenCalledWith(
      "onboarding_guest_first_save_prompt_shown",
      { source: "app_entry" }
    );
  });

  it("logOnboardingGuestFirstSavePromptAccepted captures onboarding_guest_first_save_prompt_accepted", () => {
    logOnboardingGuestFirstSavePromptAccepted();
    expect(captureWhenReady).toHaveBeenCalledTimes(1);
    expect(captureWhenReady).toHaveBeenCalledWith(
      "onboarding_guest_first_save_prompt_accepted",
      {}
    );
  });

  it("logOnboardingGuestFirstSavePromptDeclined captures onboarding_guest_first_save_prompt_declined", () => {
    logOnboardingGuestFirstSavePromptDeclined();
    expect(captureWhenReady).toHaveBeenCalledTimes(1);
    expect(captureWhenReady).toHaveBeenCalledWith(
      "onboarding_guest_first_save_prompt_declined",
      {}
    );
  });

  it("logOnboardingGuestFirstSavePromptLogin captures onboarding_guest_first_save_prompt_login", () => {
    logOnboardingGuestFirstSavePromptLogin();
    expect(captureWhenReady).toHaveBeenCalledTimes(1);
    expect(captureWhenReady).toHaveBeenCalledWith(
      "onboarding_guest_first_save_prompt_login",
      {}
    );
  });
});

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../posthog", () => ({
  captureEvent: vi.fn(),
}));

import { captureEvent } from "../posthog";
import {
  logOnboardingGuestFirstSavePromptShown,
  logOnboardingGuestFirstSavePromptAccepted,
  logOnboardingGuestFirstSavePromptDeclined,
  logOnboardingGuestFirstSavePromptLogin,
} from "../onboarding-events";

describe("onboarding-events: guest first-save prompt (SP3 Part B)", () => {
  beforeEach(() => {
    vi.mocked(captureEvent).mockClear();
  });

  it("logOnboardingGuestFirstSavePromptShown captures onboarding_guest_first_save_prompt_shown", () => {
    logOnboardingGuestFirstSavePromptShown({ source: "app_entry" });
    expect(captureEvent).toHaveBeenCalledTimes(1);
    expect(captureEvent).toHaveBeenCalledWith(
      "onboarding_guest_first_save_prompt_shown",
      { source: "app_entry" }
    );
  });

  it("logOnboardingGuestFirstSavePromptAccepted captures onboarding_guest_first_save_prompt_accepted", () => {
    logOnboardingGuestFirstSavePromptAccepted();
    expect(captureEvent).toHaveBeenCalledTimes(1);
    expect(captureEvent).toHaveBeenCalledWith(
      "onboarding_guest_first_save_prompt_accepted",
      {}
    );
  });

  it("logOnboardingGuestFirstSavePromptDeclined captures onboarding_guest_first_save_prompt_declined", () => {
    logOnboardingGuestFirstSavePromptDeclined();
    expect(captureEvent).toHaveBeenCalledTimes(1);
    expect(captureEvent).toHaveBeenCalledWith(
      "onboarding_guest_first_save_prompt_declined",
      {}
    );
  });

  it("logOnboardingGuestFirstSavePromptLogin captures onboarding_guest_first_save_prompt_login", () => {
    logOnboardingGuestFirstSavePromptLogin();
    expect(captureEvent).toHaveBeenCalledTimes(1);
    expect(captureEvent).toHaveBeenCalledWith(
      "onboarding_guest_first_save_prompt_login",
      {}
    );
  });
});

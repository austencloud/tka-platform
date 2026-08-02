import { render } from "vitest-browser-svelte";
import { page } from "vitest/browser";
import { beforeEach, describe, expect, it, vi } from "vitest";
import EmailLinkAuth from "./EmailLinkAuth.svelte";

type MagicLinkResponse = {
  data: {
    success: boolean;
    requestId: string;
    subject: string;
    senderEmail: string;
  };
};

const mocks = vi.hoisted(() => ({
  sendMagicLink: vi.fn(),
  recordAuthSubmission: vi.fn(),
  captureEvent: vi.fn(),
  toastError: vi.fn(),
}));

vi.mock("firebase/functions", () => ({
  httpsCallable: () => mocks.sendMagicLink,
}));

vi.mock("../firebase", () => ({
  getFunctionsInstance: vi.fn().mockResolvedValue({}),
}));

vi.mock("$lib/shared/i18n/i18n.svelte", () => ({
  t: (key: string) =>
    ({
      form_email: "Email",
      form_placeholder_email: "you@example.com",
      auth_sending: "Sending...",
      auth_send_magic_link: "Send Magic Link",
    })[key] ?? key,
}));

vi.mock("$lib/shared/toast/state/toast-state.svelte", () => ({
  toast: { error: mocks.toastError },
}));

vi.mock("$lib/shared/auth/services/auth-analytics-bridge", () => ({
  recordAuthSubmission: mocks.recordAuthSubmission,
}));

vi.mock("$lib/shared/auth/get-in-app-browser-detector", () => ({
  getInAppBrowserDetector: () => ({
    isInAppBrowserOrForced: () => false,
    getPlatform: () => "other",
  }),
}));

vi.mock("$lib/shared/auth/state/auth-state.svelte", () => ({
  authState: { isAnonymous: false },
}));

vi.mock("$lib/shared/persistence/database/tka-database", () => ({
  db: { sequences: { count: vi.fn().mockResolvedValue(0) } },
}));

vi.mock("$lib/shared/analytics/services/posthog", () => ({
  captureEvent: mocks.captureEvent,
}));

describe("EmailLinkAuth delivery feedback", () => {
  beforeEach(() => {
    mocks.sendMagicLink.mockReset();
    mocks.recordAuthSubmission.mockReset();
    mocks.captureEvent.mockReset();
    mocks.toastError.mockReset();
    localStorage.clear();
  });

  it("acknowledges the send immediately, then confirms provider acceptance", async () => {
    let finishSend: ((result: MagicLinkResponse) => void) | undefined;
    mocks.sendMagicLink.mockImplementation(
      () =>
        new Promise<MagicLinkResponse>((resolve) => {
          finishSend = resolve;
        })
    );

    render(EmailLinkAuth);

    const email = page.getByRole("textbox", { name: "Email" });
    await email.fill("spinner@example.com");
    await page.getByRole("button", { name: "Send Magic Link" }).click();

    const pendingStatus = page.getByRole("status");
    await expect
      .element(pendingStatus)
      .toHaveTextContent("Sending your link now");
    await expect
      .element(pendingStatus)
      .toHaveTextContent("spinner@example.com");
    await expect.element(email).toBeDisabled();

    finishSend?.({
      data: {
        success: true,
        requestId: "request-1",
        subject: "Your sign-in link",
        senderEmail: "noreply@example.com",
      },
    });

    await expect
      .element(page.getByRole("status"))
      .toHaveTextContent("Check your email");
    await expect
      .element(page.getByRole("button", { name: "Send again" }))
      .toBeEnabled();
    expect(localStorage.getItem("emailForSignIn")).toBe("spinner@example.com");
    expect(mocks.recordAuthSubmission).toHaveBeenCalledWith("magic_link");
  });
});

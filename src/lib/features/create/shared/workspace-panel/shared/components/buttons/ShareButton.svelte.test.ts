import { page } from "vitest/browser";
import { render } from "vitest-browser-svelte";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createStepData } from "$lib/shared/foundation/domain/factories/create-step-data";
import { createSequenceData } from "$lib/shared/foundation/domain/models/sequence-data";
import ShareButton from "./ShareButton.svelte";

const shareButtonMocks = vi.hoisted(() => ({
  showToast: vi.fn(),
  openSendSequenceSheet: vi.fn(),
  authDrawerShow: vi.fn(),
  fullAccount: true,
  getCardImageBlob: vi.fn(),
  buildSequenceSharePayload: vi.fn(
    (sequence: { id: string; word?: string }) => ({
      sequence,
      sequenceId: sequence.id,
      sequenceWord: sequence.word ?? "",
    })
  ),
  createShortCode: vi.fn().mockResolvedValue({
    url: "https://tka.run/COPY",
  }),
}));

vi.mock("$lib/shared/mobile/share-action.svelte", () => ({
  shareTarget: {
    get isMobile() {
      return false;
    },
  },
}));

vi.mock("$lib/shared/application/get-haptic-feedback", () => ({
  getHapticFeedback: () => null,
}));

vi.mock("$lib/shared/share/get-sharer", () => ({
  getSharer: () => ({
    getCardImageBlob: shareButtonMocks.getCardImageBlob,
    generateFilename: vi.fn(() => "sequence.png"),
  }),
}));

vi.mock("$lib/shared/share/state/image-composition-state.svelte", () => ({
  getImageCompositionManager: () => ({
    darkMode: true,
    registerObserver: vi.fn(),
    unregisterObserver: vi.fn(),
  }),
}));

vi.mock("$lib/shared/pictograph/shared/state/visibility-state.svelte", () => ({
  getVisibilityStateManager: () => ({
    registerObserver: vi.fn(),
    unregisterObserver: vi.fn(),
  }),
}));

vi.mock("$lib/shared/auth/state/auth-state.svelte", () => ({
  authState: {
    get isFullAccount() {
      return shareButtonMocks.fullAccount;
    },
    user: { displayName: "Austen" },
  },
}));

vi.mock("$lib/shared/auth/state/auth-drawer-state.svelte", () => ({
  authDrawerState: {
    show: shareButtonMocks.authDrawerShow,
  },
}));

vi.mock("$lib/shared/qr/get-short-code-manager", () => ({
  getShortCodeManager: () => ({
    createShortCode: shareButtonMocks.createShortCode,
  }),
}));

vi.mock("$lib/shared/toast/state/toast-state.svelte", () => ({
  showToast: shareButtonMocks.showToast,
}));

vi.mock("$lib/shared/analytics/services/posthog-activity-logger", () => ({
  logShareAction: vi.fn(),
}));

vi.mock("$lib/shared/analytics/services/posthog", () => ({
  captureEvent: vi.fn(),
}));

vi.mock("$lib/shared/inbox/state/send-sequence-state.svelte", () => ({
  buildSequenceSharePayload: shareButtonMocks.buildSequenceSharePayload,
  openSendSequenceSheet: shareButtonMocks.openSendSequenceSheet,
}));

const sequence = createSequenceData({
  id: "copy-link",
  name: "Copy Link",
  word: "COPY",
  steps: [createStepData({ letter: "A" })],
});

let originalClipboardDescriptor: PropertyDescriptor | undefined;

beforeEach(() => {
  shareButtonMocks.showToast.mockClear();
  shareButtonMocks.createShortCode.mockClear();
  shareButtonMocks.openSendSequenceSheet.mockClear();
  shareButtonMocks.authDrawerShow.mockClear();
  shareButtonMocks.getCardImageBlob.mockReset();
  shareButtonMocks.getCardImageBlob.mockResolvedValue(
    new Blob(["card"], {
      type: "image/png",
    })
  );
  shareButtonMocks.buildSequenceSharePayload.mockClear();
  shareButtonMocks.fullAccount = true;
  originalClipboardDescriptor = Object.getOwnPropertyDescriptor(
    navigator,
    "clipboard"
  );
});

afterEach(() => {
  if (originalClipboardDescriptor) {
    Object.defineProperty(navigator, "clipboard", originalClipboardDescriptor);
  } else {
    Reflect.deleteProperty(navigator, "clipboard");
  }
});

describe("ShareButton", () => {
  it("opens the existing Send Sequence flow with the rendered Choreo Card", async () => {
    render(ShareButton, { sequence });

    await page.getByRole("button", { name: "Share sequence" }).click();
    await page.getByRole("menuitem", { name: "Send Sequence" }).click();

    await vi.waitFor(() => {
      expect(shareButtonMocks.openSendSequenceSheet).toHaveBeenCalledOnce();
    });

    const payload = shareButtonMocks.openSendSequenceSheet.mock.calls[0]?.[0];
    expect(payload).toMatchObject({
      sequence,
      sequenceId: "copy-link",
      sequenceWord: "COPY",
      sequencePreviewBlob: expect.any(Blob),
    });
    expect(await payload.sequencePreviewBlob.text()).toBe("card");
    expect(payload.sequence).not.toHaveProperty("sequencePreviewBlob");
    expect(shareButtonMocks.getCardImageBlob).toHaveBeenCalledOnce();
  });

  it("does not open a stack-only Send sheet when card rendering fails", async () => {
    shareButtonMocks.getCardImageBlob.mockRejectedValue(
      new Error("render failed")
    );
    render(ShareButton, { sequence });

    await page.getByRole("button", { name: "Share sequence" }).click();
    await page.getByRole("menuitem", { name: "Send Sequence" }).click();

    await vi.waitFor(() => {
      expect(shareButtonMocks.showToast).toHaveBeenCalledWith({
        message: "Couldn't prepare this card. Try again.",
        type: "error",
        duration: 6000,
      });
    });
    expect(shareButtonMocks.openSendSequenceSheet).not.toHaveBeenCalled();
  });

  it("gives a clear retryable error when Clipboard API access is unavailable", async () => {
    render(ShareButton, { sequence });

    await page.getByRole("button", { name: "Share sequence" }).click();
    const copyLink = page.getByRole("menuitem", { name: "Copy Link" });
    await expect.element(copyLink).toBeEnabled();

    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: undefined,
    });

    await copyLink.click();

    expect(shareButtonMocks.showToast).toHaveBeenCalledWith({
      message: "Couldn't copy the link. Try again.",
      type: "error",
      duration: 6000,
    });
  });

  it("sends guests to account creation without preparing share data", async () => {
    shareButtonMocks.fullAccount = false;
    render(ShareButton, { sequence });

    await page.getByRole("button", { name: "Share sequence" }).click();

    expect(shareButtonMocks.authDrawerShow).toHaveBeenCalledWith(
      "signup",
      "share-sequence"
    );
    expect(shareButtonMocks.getCardImageBlob).not.toHaveBeenCalled();
    expect(shareButtonMocks.createShortCode).not.toHaveBeenCalled();
    expect(shareButtonMocks.openSendSequenceSheet).not.toHaveBeenCalled();
    await expect
      .element(page.getByText("Send Sequence", { exact: true }))
      .not.toBeInTheDocument();
  });
});

import { beforeEach, describe, expect, it, vi } from "vitest";
import { NativeInitializer } from "$lib/shared/platform/services/native-initializer";

const mocks = vi.hoisted(() => ({
  awaitAuthSettled: vi.fn<() => Promise<void>>(),
  goto: vi.fn<(target: string) => Promise<void>>(),
  hideSplash: vi.fn<() => Promise<void>>(),
  showSplash: vi.fn<() => Promise<void>>(),
  waitForViewerReady: vi.fn<() => Promise<"ready" | "failed" | "timeout">>(),
  markViewerFailed: vi.fn(),
  isViewerReady: vi.fn(() => false),
}));

vi.mock("$lib/shared/auth/state/auth-state.svelte", () => ({
  awaitAuthSettled: mocks.awaitAuthSettled,
}));

vi.mock("$app/navigation", () => ({
  goto: mocks.goto,
}));

vi.mock("@capacitor/splash-screen", () => ({
  SplashScreen: {
    hide: mocks.hideSplash,
    show: mocks.showSplash,
  },
}));

vi.mock("$lib/shared/platform/services/native-scan-viewer-readiness", () => ({
  isNativeScanViewerReady: mocks.isViewerReady,
  markNativeScanViewerFailed: mocks.markViewerFailed,
  waitForNativeScanViewerReady: mocks.waitForViewerReady,
}));

type DeepLinkHandler = {
  handleDeepLink(url: string, coverWithSplash?: boolean): Promise<boolean>;
};

describe("NativeInitializer deep-link readiness", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.goto.mockResolvedValue();
    mocks.hideSplash.mockResolvedValue();
    mocks.showSplash.mockResolvedValue();
    mocks.waitForViewerReady.mockResolvedValue("ready");
    mocks.isViewerReady.mockReturnValue(false);
  });

  it("waits for app startup before navigating a QR launch URL", async () => {
    let releaseStartup!: () => void;
    mocks.awaitAuthSettled.mockReturnValue(
      new Promise<void>((resolve) => {
        releaseStartup = resolve;
      })
    );

    const initializer = new NativeInitializer() as unknown as DeepLinkHandler;
    const opening = initializer.handleDeepLink(
      "https://tkaflowarts.com/q/W61Y?bp=club&rp=club"
    );

    await vi.waitFor(() => {
      expect(mocks.awaitAuthSettled).toHaveBeenCalledOnce();
    });
    expect(mocks.goto).not.toHaveBeenCalled();

    releaseStartup();

    await expect(opening).resolves.toBe(true);
    expect(mocks.goto).toHaveBeenCalledWith(
      "/browse/gallery?bp=club&rp=club&v=W61Y"
    );
    expect(mocks.waitForViewerReady).toHaveBeenCalledWith("W61Y");
  });

  it("covers a warm scan until the replacement viewer reports its first card", async () => {
    mocks.awaitAuthSettled.mockResolvedValue();
    let releaseViewer!: (outcome: "ready") => void;
    mocks.waitForViewerReady.mockReturnValue(
      new Promise((resolve) => {
        releaseViewer = resolve;
      })
    );

    const initializer = new NativeInitializer() as unknown as DeepLinkHandler;
    const opening = initializer.handleDeepLink(
      "https://tka.run/W61Y?bp=club&rp=club",
      true
    );

    await vi.waitFor(() => {
      expect(mocks.showSplash).toHaveBeenCalledWith({
        autoHide: false,
        fadeInDuration: 0,
      });
      expect(mocks.goto).toHaveBeenCalled();
    });
    expect(mocks.hideSplash).not.toHaveBeenCalled();

    releaseViewer("ready");

    await expect(opening).resolves.toBe(true);
    expect(mocks.hideSplash).toHaveBeenCalledWith({ fadeOutDuration: 300 });
  });

  it("ignores non-deep-link URLs without waiting for startup", async () => {
    mocks.awaitAuthSettled.mockResolvedValue();
    const initializer = new NativeInitializer() as unknown as DeepLinkHandler;

    await expect(
      initializer.handleDeepLink("https://tkaflowarts.com/")
    ).resolves.toBe(false);

    expect(mocks.awaitAuthSettled).not.toHaveBeenCalled();
    expect(mocks.goto).not.toHaveBeenCalled();
  });
});

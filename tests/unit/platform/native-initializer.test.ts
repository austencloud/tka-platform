import { beforeEach, describe, expect, it, vi } from "vitest";
import { NativeInitializer } from "$lib/shared/platform/services/native-initializer";

const mocks = vi.hoisted(() => ({
  awaitAuthSettled: vi.fn<() => Promise<void>>(),
  goto: vi.fn<(target: string) => Promise<void>>(),
  hideSplash: vi.fn<() => Promise<void>>(),
  showSplash: vi.fn<() => Promise<void>>(),
  waitForLoadingSurface: vi.fn<() => Promise<"ready" | "failed" | "timeout">>(),
  beginViewerTransition: vi.fn(),
  markTransitionStage: vi.fn(),
  markViewerFailed: vi.fn(),
  isViewerReady: vi.fn(() => false),
  addAppListener: vi.fn(),
  getLaunchUrl: vi.fn(),
  registerShareTarget: vi.fn<() => Promise<void>>(),
  appUrlOpenCallback: null as
    | null
    | ((event: { url: string }) => Promise<void>),
}));

vi.mock("$lib/shared/platform/services/platform-detector", () => ({
  isNative: () => true,
  isAndroid: () => false,
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

vi.mock("@capacitor/app", () => ({
  App: {
    addListener: mocks.addAppListener,
    getLaunchUrl: mocks.getLaunchUrl,
    exitApp: vi.fn(),
  },
}));

vi.mock("@capacitor/status-bar", () => ({
  StatusBar: {
    setStyle: vi.fn().mockResolvedValue(undefined),
    setOverlaysWebView: vi.fn().mockResolvedValue(undefined),
  },
  Style: { Dark: "DARK" },
}));

vi.mock("@capacitor/keyboard", () => ({
  Keyboard: {
    setResizeMode: vi.fn().mockResolvedValue(undefined),
    setScroll: vi.fn().mockResolvedValue(undefined),
  },
  KeyboardResize: { None: "none" },
}));

vi.mock("$lib/shared/share-intake/get-share-intake", () => ({
  ensureShareTargetRegistered: mocks.registerShareTarget,
}));

vi.mock("$lib/shared/platform/services/native-scan-viewer-readiness", () => ({
  beginNativeScanViewerTransition: mocks.beginViewerTransition,
  isNativeScanViewerReady: mocks.isViewerReady,
  markNativeScanTransitionStage: mocks.markTransitionStage,
  markNativeScanViewerFailed: mocks.markViewerFailed,
  waitForNativeScanLoadingSurfaceReady: mocks.waitForLoadingSurface,
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
    mocks.waitForLoadingSurface.mockResolvedValue("ready");
    mocks.isViewerReady.mockReturnValue(false);
    mocks.getLaunchUrl.mockResolvedValue(null);
    mocks.registerShareTarget.mockResolvedValue();
    mocks.appUrlOpenCallback = null;
    mocks.addAppListener.mockImplementation(
      async (
        eventName: string,
        callback: (event: { url: string }) => Promise<void>
      ) => {
        if (eventName === "appUrlOpen") mocks.appUrlOpenCallback = callback;
        return { remove: vi.fn() };
      }
    );
  });

  it("captures a QR intent before slower native startup work settles", async () => {
    let releaseShareTarget!: () => void;
    mocks.registerShareTarget.mockReturnValue(
      new Promise<void>((resolve) => {
        releaseShareTarget = resolve;
      })
    );
    mocks.awaitAuthSettled.mockResolvedValue();

    const initializer = new NativeInitializer();
    const initialization = initializer.initialize();

    await vi.waitFor(() => {
      expect(mocks.appUrlOpenCallback).toBeTypeOf("function");
      expect(mocks.registerShareTarget).toHaveBeenCalledOnce();
    });

    await mocks.appUrlOpenCallback?.({
      url: "https://tka.run/EARLY42?bp=club&rp=club",
    });

    expect(mocks.goto).toHaveBeenCalledWith(
      "/browse/gallery?bp=club&rp=club&v=EARLY42"
    );
    expect(mocks.showSplash).toHaveBeenCalled();

    releaseShareTarget();
    await initialization;

    expect(mocks.goto).not.toHaveBeenCalledWith("/create", {
      replaceState: true,
    });
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
    expect(mocks.waitForLoadingSurface).toHaveBeenCalledWith("W61Y");
    expect(mocks.beginViewerTransition).toHaveBeenCalledWith("W61Y");
    expect(mocks.markTransitionStage).toHaveBeenCalledWith(
      "W61Y",
      "deep-link-received",
      { launch: "cold", coverRequested: false }
    );
  });

  it("covers a warm scan until the app loading surface has painted", async () => {
    mocks.awaitAuthSettled.mockResolvedValue();
    let releaseViewer!: (outcome: "ready") => void;
    mocks.waitForLoadingSurface.mockReturnValue(
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
    expect(mocks.hideSplash).toHaveBeenCalledWith({ fadeOutDuration: 0 });
    expect(mocks.markTransitionStage).toHaveBeenCalledWith(
      "W61Y",
      "native-cover-hidden"
    );
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

import { beforeEach, describe, expect, it, vi } from "vitest";
import { NativeInitializer } from "$lib/shared/platform/services/native-initializer";

const mocks = vi.hoisted(() => ({
  awaitAuthSettled: vi.fn<() => Promise<void>>(),
  goto: vi.fn<(target: string) => Promise<void>>(),
}));

vi.mock("$lib/shared/auth/state/auth-state.svelte", () => ({
  awaitAuthSettled: mocks.awaitAuthSettled,
}));

vi.mock("$app/navigation", () => ({
  goto: mocks.goto,
}));

type DeepLinkHandler = {
  handleDeepLink(url: string): Promise<boolean>;
};

describe("NativeInitializer deep-link readiness", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.goto.mockResolvedValue();
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

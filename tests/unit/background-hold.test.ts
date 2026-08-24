import { beforeEach, describe, expect, it, vi } from "vitest";

const backgroundController = vi.hoisted(() => ({
  freeze: vi.fn(),
  unfreeze: vi.fn(),
}));

vi.mock("$app/environment", () => ({
  browser: true,
  dev: true,
  building: false,
  version: "test",
}));

vi.mock("@austencloud/backgrounds", () => ({
  getBackgroundController: () => backgroundController,
}));

describe("background holds", () => {
  beforeEach(() => {
    vi.useRealTimers();
    vi.resetModules();
    vi.clearAllMocks();
  });

  it("freezes once until every keyed hold releases", async () => {
    const { holdBackground, releaseBackground } =
      await import("$lib/shared/background/shared/state/background-hold.svelte");

    holdBackground("playback");
    holdBackground("playback");
    holdBackground("panel-transition");

    expect(backgroundController.freeze).toHaveBeenCalledTimes(1);

    releaseBackground("playback");
    expect(backgroundController.unfreeze).not.toHaveBeenCalled();

    releaseBackground("panel-transition");
    releaseBackground("panel-transition");
    expect(backgroundController.unfreeze).toHaveBeenCalledTimes(1);
  });

  it("extends a timed hold without briefly resuming the background", async () => {
    vi.useFakeTimers();
    const { holdBackgroundFor } =
      await import("$lib/shared/background/shared/state/background-hold.svelte");

    holdBackgroundFor("panel-transition", 100);
    await vi.advanceTimersByTimeAsync(50);
    holdBackgroundFor("panel-transition", 100);
    await vi.advanceTimersByTimeAsync(50);

    expect(backgroundController.freeze).toHaveBeenCalledTimes(1);
    expect(backgroundController.unfreeze).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(50);
    expect(backgroundController.unfreeze).toHaveBeenCalledTimes(1);
  });
});

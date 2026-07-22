import { describe, expect, it, vi } from "vitest";

const postHogMock = vi.hoisted(() => ({
  init: vi.fn(),
  reloadFeatureFlags: vi.fn(),
}));

vi.mock("$app/environment", () => ({ browser: true }));
vi.mock("$env/dynamic/public", () => ({
  env: { PUBLIC_POSTHOG_KEY: "test-key" },
}));
vi.mock("$lib/shared/foundation/services/device-id", () => ({
  getDeviceId: () => "device-1",
}));
vi.mock("posthog-js", () => ({ default: postHogMock }));

import { initPostHog } from "$lib/shared/analytics/services/posthog";

describe("PostHog initialization", () => {
  it("shares one in-flight initialization across concurrent callers", async () => {
    postHogMock.init.mockImplementation((_key, config) => {
      config.loaded(postHogMock);
    });

    const first = initPostHog();
    const second = initPostHog();
    const third = initPostHog();

    expect(second).toBe(first);
    expect(third).toBe(first);

    await Promise.all([first, second, third]);

    expect(postHogMock.init).toHaveBeenCalledOnce();
    expect(postHogMock.reloadFeatureFlags).toHaveBeenCalledOnce();
  });
});

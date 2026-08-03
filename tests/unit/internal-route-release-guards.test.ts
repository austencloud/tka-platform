import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("$app/environment", () => ({ dev: false }));

// Vitest loads vite.config.ts, so the `define` map inlines __FEATURE_COVEN__ as
// `true` under NODE_ENV=test. Mocking the reader is what makes the disabled
// branch reachable at all — see src/config/build-flags.ts.
const isCovenBuildEnabled = vi.fn<() => boolean>();
vi.mock("../../src/config/build-flags", () => ({
  isCovenBuildEnabled: () => isCovenBuildEnabled(),
}));

afterEach(() => {
  isCovenBuildEnabled.mockReset();
});

function expectBrowseRedirect(run: () => unknown): void {
  let thrown: unknown;
  try {
    run();
  } catch (error) {
    thrown = error;
  }

  expect(thrown).toMatchObject({
    status: 307,
    location: "/browse/gallery",
  });
}

describe("internal route production guards", () => {
  it("redirects direct Coven navigation when its build flag is off", async () => {
    isCovenBuildEnabled.mockReturnValue(false);
    const { load } = await import("../../src/routes/coven/+page");

    expectBrowseRedirect(() => load({} as never));
  });

  it("serves Coven when its build flag is on", async () => {
    isCovenBuildEnabled.mockReturnValue(true);
    const { load } = await import("../../src/routes/coven/+page");

    expect(load({} as never)).toEqual({});
  });

  it("redirects direct test-route navigation outside the dev server", async () => {
    const { load } = await import("../../src/routes/test/+layout");

    expectBrowseRedirect(() => load({} as never));
  });
});

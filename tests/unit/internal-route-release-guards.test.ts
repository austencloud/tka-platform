import { describe, expect, it, vi } from "vitest";

vi.mock("$app/environment", () => ({ dev: false }));

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
  it("redirects direct Coven navigation when its build flag is absent", async () => {
    const { load } = await import("../../src/routes/coven/+page");

    expectBrowseRedirect(() => load({} as never));
  });

  it("redirects direct test-route navigation outside the dev server", async () => {
    const { load } = await import("../../src/routes/test/+layout");

    expectBrowseRedirect(() => load({} as never));
  });
});

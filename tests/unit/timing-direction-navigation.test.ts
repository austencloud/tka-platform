import { describe, expect, it } from "vitest";
import { navigationMorphs } from "$lib/shared/transitions/navigation-morphs";
import { TIMING_DIRECTION_ARTICLES } from "../../src/routes/(public)/timing-and-direction/_data/timing-direction-articles";

const location = (pathname: string) => ({
  url: { pathname },
  route: { id: null },
});
const hub = "/timing-and-direction";

describe("timing and direction canvas navigation", () => {
  it("carries every shipped mode into its article and back", () => {
    for (const article of TIMING_DIRECTION_ARTICLES) {
      const detail = `${hub}/${article.slug}`;
      expect(navigationMorphs(location(hub), location(detail))).toBe(true);
      expect(navigationMorphs(location(detail), location(hub))).toBe(true);
    }
  });

  it("only morphs between routes with a canvas participant", () => {
    const detail = `${hub}/${TIMING_DIRECTION_ARTICLES[0]!.slug}`;
    for (const unrelated of [
      "/learn/concepts/timing-and-direction",
      `${hub}/unknown`,
      "/timing-and-direction-old",
    ]) {
      expect(navigationMorphs(location(detail), location(unrelated))).toBe(
        false
      );
    }
    expect(navigationMorphs(location(detail), location(detail))).toBe(false);
    expect(
      navigationMorphs(
        location(detail),
        location(`${hub}/${TIMING_DIRECTION_ARTICLES[1]!.slug}`)
      )
    ).toBe(true);
  });
});

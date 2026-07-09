import { describe, it, expect } from "vitest";
import {
  slugForIndex,
  indexForSlug,
  hrefForIndex,
  slugFromPath,
  FRONT_MATTER_SLUGS,
} from "../../../src/routes/(public)/guide/level-1/_data/guide-page-links";
import { GUIDE_BODY_PAGES } from "../../../src/routes/(public)/guide/level-1/_data/guide-manifest";
import {
  FRONT_MATTER_COUNT,
  READER_PAGE_COUNT,
} from "../../../src/routes/(public)/guide/level-1/_data/guide-reader-nav";

describe("guide page deep links", () => {
  it("round-trips every reader page (front matter + all manifest pages)", () => {
    for (let i = 0; i < READER_PAGE_COUNT; i++) {
      const slug = slugForIndex(i);
      expect(slug, `index ${i} has a slug`).toBeTruthy();
      expect(indexForSlug(slug!), `slug ${slug} round-trips`).toBe(i);
    }
  });

  it("front-matter slugs sit at reader indexes 0-4", () => {
    expect(FRONT_MATTER_SLUGS).toHaveLength(FRONT_MATTER_COUNT);
    expect(indexForSlug("cover")).toBe(0);
    expect(indexForSlug("contents")).toBe(4);
  });

  it("body slugs are the manifest ids", () => {
    const first = GUIDE_BODY_PAGES[0]!;
    expect(indexForSlug(first.id)).toBe(FRONT_MATTER_COUNT);
    expect(slugForIndex(FRONT_MATTER_COUNT)).toBe(first.id);
  });

  it("unknown slugs and out-of-range indexes return null", () => {
    expect(indexForSlug("not-a-page")).toBeNull();
    expect(slugForIndex(-1)).toBeNull();
    expect(slugForIndex(READER_PAGE_COUNT)).toBeNull();
    expect(hrefForIndex(READER_PAGE_COUNT)).toBeNull();
  });

  it("hrefs are /learn/guide/<slug>", () => {
    expect(hrefForIndex(0)).toBe("/learn/guide/cover");
    expect(hrefForIndex(FRONT_MATTER_COUNT)).toBe(`/learn/guide/${GUIDE_BODY_PAGES[0]!.id}`);
  });

  it("slugFromPath reads only /learn/guide/<slug> paths", () => {
    expect(slugFromPath("/learn/guide/staff-positions")).toBe("staff-positions");
    expect(slugFromPath("/learn/guide/staff-positions/")).toBe("staff-positions");
    expect(slugFromPath("/learn/guide")).toBeNull();
    expect(slugFromPath("/guide/level-1/print")).toBeNull();
    expect(slugFromPath("/test/guide-reader/staff-positions")).toBeNull();
  });
});

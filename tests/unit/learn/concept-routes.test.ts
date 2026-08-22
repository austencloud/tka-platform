import { describe, expect, it } from "vitest";
import {
  buildConceptPath,
  conceptIdFromPathname,
  CONCEPT_LIST_PATH,
  isConceptPath,
} from "../../../src/lib/features/learn/domain/concept-routes";

describe("concept routes", () => {
  it("builds stable list and lesson URLs", () => {
    expect(buildConceptPath()).toBe(CONCEPT_LIST_PATH);
    expect(buildConceptPath("hand-motions-intro")).toBe(
      "/learn/concepts/hand-motions-intro"
    );
    expect(buildConceptPath("concept/with spaces")).toBe(
      "/learn/concepts/concept%2Fwith%20spaces"
    );
  });

  it("restores the concept id from a lesson URL", () => {
    expect(conceptIdFromPathname("/learn/concepts/grid")).toBe("grid");
    expect(conceptIdFromPathname("/learn/concepts/grid/")).toBe("grid");
    expect(
      conceptIdFromPathname("/learn/concepts/concept%2Fwith%20spaces")
    ).toBe("concept/with spaces");
  });

  it("rejects unrelated, incomplete, and malformed routes", () => {
    expect(conceptIdFromPathname(CONCEPT_LIST_PATH)).toBeNull();
    expect(conceptIdFromPathname("/learn/concepts/a/b")).toBeNull();
    expect(conceptIdFromPathname("/learn/concepts/%E0%A4%A")).toBeNull();
    expect(isConceptPath(CONCEPT_LIST_PATH)).toBe(true);
    expect(isConceptPath(`${CONCEPT_LIST_PATH}/`)).toBe(true);
    expect(isConceptPath("/learn/guide")).toBe(false);
  });
});

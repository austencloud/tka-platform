import { describe, expect, it } from "vitest";
import { parseCandidateId, parseStressPoseId } from "./avatar-bakeoff-data";

describe("avatar bake-off query parsing", () => {
  it("accepts known candidates and falls back from stale links", () => {
    expect(parseCandidateId("avatar-sdk")).toBe("avatar-sdk");
    expect(parseCandidateId("human-generator-trial")).toBe(
      "human-generator-trial"
    );
    expect(parseCandidateId("human-generator-parity")).toBe(
      "human-generator-parity"
    );
    expect(parseCandidateId("personal-metaperson")).toBe("personal-metaperson");
    expect(parseCandidateId("missing-vendor")).toBe("current-optimized");
  });

  it("accepts known stress poses and defaults to the hardest comparison", () => {
    expect(parseStressPoseId("overhead")).toBe("overhead");
    expect(parseStressPoseId(null)).toBe("cross-body");
  });
});

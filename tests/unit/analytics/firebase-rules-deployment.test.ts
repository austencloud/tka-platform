import { describe, expect, it } from "vitest";
import {
  extractReviewedRuleBlock,
  sourceSha256,
} from "../../../scripts/lib/firebase-rules-deployment";

describe("Firebase rules deployment fingerprints", () => {
  it("hashes equivalent line endings identically", () => {
    expect(sourceSha256("allow read;\r\n")).toBe(sourceSha256("allow read;\n"));
  });

  it("extracts only the marked rule block", () => {
    const source = `before\nSTART\nallow get: if true;\nEND\nafter`;
    expect(extractReviewedRuleBlock(source, "START", "END")).toContain(
      "allow get: if true;"
    );
  });

  it("fails closed when either marker is missing", () => {
    expect(() =>
      extractReviewedRuleBlock("START only", "START", "END")
    ).toThrow("Could not find the reviewed rule block");
  });
});

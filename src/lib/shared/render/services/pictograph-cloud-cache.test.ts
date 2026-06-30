// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from "vitest";
import {
  knows, registerExists, getUrl, _resetForTest,
} from "./pictograph-cloud-cache";

describe("pictograph-cloud-cache", () => {
  beforeEach(() => {
    localStorage.clear();
    _resetForTest();
  });

  it("does not know a hash until registered (avoids 404 probing)", () => {
    expect(knows("abc123")).toBe(false);
  });

  it("knows a hash after registerExists and returns a public URL", async () => {
    registerExists("abc123");
    expect(knows("abc123")).toBe(true);
    const url = await getUrl("abc123");
    expect(url).toContain("pictograph-cells%2Fabc123.webp");
  });

  it("returns null url for an unknown hash", async () => {
    expect(await getUrl("nope")).toBeNull();
  });
});

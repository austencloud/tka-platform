import { describe, expect, it } from "vitest";
import { resolveThrelteContextValue } from "@austencloud/camera-3d";

describe("Threlte context value compatibility", () => {
  it("accepts the current direct-object context shape", () => {
    const camera = { kind: "camera" };
    expect(resolveThrelteContextValue(camera)).toBe(camera);
  });

  it("accepts the legacy current-holder context shape", () => {
    const camera = { kind: "camera" };
    expect(resolveThrelteContextValue({ current: camera })).toBe(camera);
  });

  it("fails closed while a current-holder is empty", () => {
    expect(resolveThrelteContextValue({ current: null })).toBeNull();
  });
});

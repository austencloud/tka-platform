import { describe, expect, it } from "vitest";
import { resolveProductionEnvironment } from "$lib/shared/environment/environment-features";

describe("production environment detection", () => {
  it("recognizes a production build without an optional deployment label", () => {
    expect(resolveProductionEnvironment(true, true, undefined)).toBe(true);
  });

  it("keeps server rendering and development browsers out of production mode", () => {
    expect(resolveProductionEnvironment(false, true, "production")).toBe(false);
    expect(resolveProductionEnvironment(true, false, "development")).toBe(
      false
    );
  });

  it("still accepts the explicit deployment label", () => {
    expect(resolveProductionEnvironment(true, false, "production")).toBe(true);
  });
});

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("SkyGradient moon projection", () => {
  it("masks the antipodal tangent-plane projection", () => {
    const source = readFileSync(
      resolve("src/lib/shared/3d/environments/primitives/SkyGradient.svelte"),
      "utf8"
    );

    expect(source).toContain(
      "dot(skyDirection, moonDirection)"
    );
    expect(source).toMatch(
      /diskAlpha\s*=\s*moonSample\.a[\s\S]*?moonFrontHemisphere;/
    );
    expect(source).toMatch(
      /halo\s*\*=\s*\(1\.0 - diskEdge\) \* moonFrontHemisphere;/
    );
  });
});

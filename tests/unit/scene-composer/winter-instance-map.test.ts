import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import instanceMap from "../../../scripts/winter-composer-instance-map.json";

function sha256(path: string): string {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

describe("Winter composer instance map", () => {
  it("matches the current authored and optimized assets", () => {
    expect(instanceMap.rawGlbSha256).toBe(
      sha256("static/models/winter/winter-environment_raw.glb")
    );
    expect(instanceMap.optimizedGlbSha256).toBe(
      sha256("static/models/winter/winter-environment.glb")
    );
  });

  it("maps every optimized tree to a stable authored ID", () => {
    const treeDescriptors = Object.values(
      instanceMap.instancesByMatrixKey
    ).filter((descriptor) => descriptor.objectKey === "conifer");

    expect(instanceMap.mappedTreeCount).toBe(472);
    expect(treeDescriptors).toHaveLength(472);
    expect(
      new Set(treeDescriptors.map((descriptor) => descriptor.id)).size
    ).toBe(472);
    expect(
      treeDescriptors.every((descriptor) =>
        descriptor.id.startsWith("winter:conifer:")
      )
    ).toBe(true);
  });
});

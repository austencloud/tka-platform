import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const avatarSource = readFileSync(
  resolve(
    "node_modules/@austencloud/scene-3d/src/lib/components/Avatar3D.svelte"
  ),
  "utf8"
);

describe("GLTF avatar reveal", () => {
  it("reserves the procedural body for explicit mode or load failure", () => {
    expect(avatarSource).toContain(
      "let useProceduralFallback = $state(!useGLTF)"
    );
    expect(avatarSource).toContain("{#if !useGLTF || useProceduralFallback}");
    expect(avatarSource).not.toContain("{#if isLoading}");
  });
});

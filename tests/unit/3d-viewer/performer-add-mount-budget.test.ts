import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const swapSource = readFileSync(
  resolve("src/lib/shared/3d/components/AvatarSwapTransition.svelte"),
  "utf8"
);
const stageSource = readFileSync(
  resolve(
    "src/lib/shared/3d/environments/scenes/ocean/runtime/RuinsPlatform.svelte"
  ),
  "utf8"
);
const staffSource = readFileSync(
  resolve(
    "node_modules/@austencloud/scene-3d/src/lib/components/Staff3D.svelte"
  ),
  "utf8"
);

describe("performer add render budget", () => {
  it("does not mount the avatar-swap particle buffer for an idle performer", () => {
    const particleGate = swapSource.indexOf(
      '{#if phase !== "idle" || particlesActive}'
    );
    const particleMesh = swapSource.indexOf("<T.InstancedMesh", particleGate);

    expect(particleGate).toBeGreaterThan(-1);
    expect(particleMesh).toBeGreaterThan(particleGate);
  });

  it("creates ocean stage materials once and updates their uniforms", () => {
    expect(stageSource).toContain("onMount(() => {");
    expect(stageSource).toContain(
      "applyDaisConfig(bodyMaterial, materialConfig)"
    );
    expect(stageSource.match(/createBodyMaterial\(/g)).toHaveLength(2);
    expect(stageSource.match(/createTopMaterial\(/g)).toHaveLength(1);
  });

  it("reuses procedural staff geometries and materials across performers", () => {
    expect(staffSource).toContain("const geometrySets = new Map");
    expect(staffSource).toContain("const materialSets = new Map");
    expect(staffSource).toContain("geometry={geometry.shaft}");
    expect(staffSource).toContain("material={materials.main}");
    expect(staffSource.match(/dispose=\{false\}/g)).toHaveLength(7);
    expect(staffSource).not.toContain("<T.CylinderGeometry");
  });
});

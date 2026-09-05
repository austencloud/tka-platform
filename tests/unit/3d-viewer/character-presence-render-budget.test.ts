import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const swapSource = readFileSync(
  resolve("src/lib/shared/3d/components/CharacterSwapTransition.svelte"),
  "utf8"
);
const stageSource = readFileSync(
  resolve(
    "src/lib/shared/3d/environments/worlds/ocean/ocean-ruins-platform.ts"
  ),
  "utf8"
);
const staffSource = readFileSync(
  resolve(
    "node_modules/@austencloud/scene-3d/src/lib/components/Staff3D.svelte"
  ),
  "utf8"
);
const staffObjectSource = readFileSync(
  resolve(
    "node_modules/@austencloud/scene-3d/src/lib/rendering/create-staff-object.ts"
  ),
  "utf8"
);

describe("performer add render budget", () => {
  it("takes the complete rig to a point instead of popping opaque props away", () => {
    expect(swapSource).toContain("Math.pow(visiblePresence, 0.25)");
    expect(swapSource).toContain("scale={presenceScale}");
    expect(swapSource).not.toContain("0.88 + presenceProgress");
  });

  it("does not mount the character-swap particle buffer for an idle performer", () => {
    const particleGate = swapSource.indexOf(
      '{#if phase !== "idle" || particlesActive}'
    );
    const particleMesh = swapSource.indexOf("<T.InstancedMesh", particleGate);

    expect(particleGate).toBeGreaterThan(-1);
    expect(particleMesh).toBeGreaterThan(particleGate);
  });

  it("creates ocean stage materials once and updates their uniforms", () => {
    expect(stageSource).toContain(
      "applyDaisConfig(bodyMaterial, shaderConfig)"
    );
    expect(stageSource.match(/createBodyMaterial\(/g)).toHaveLength(2);
    expect(stageSource.match(/createTopMaterial\(/g)).toHaveLength(1);
  });

  it("reuses procedural staff geometries and materials across performers", () => {
    // Staff3D.svelte handed its seven meshes to create-staff-object.ts so the
    // worker renderers mount the same object. The module-level caches moved
    // with them, and they are what keeps a second performer from allocating a
    // second set of staff geometries and materials.
    expect(staffObjectSource).toContain("const geometrySets = new Map");
    expect(staffObjectSource).toContain("const materialSets = new Map");
    expect(
      staffObjectSource.match(
        /mesh\((?:geometry\.\w+|trailGeometry), materials\.\w+, layer\)/g
      )
    ).toHaveLength(7);
    expect(staffObjectSource).toContain(
      "mesh(geometry.shaft, materials.main, layer)"
    );

    // An instance teardown detaches its own graph. Disposing a cached geometry
    // or material here would blank every other performer's staff, which is
    // what the component's per-mesh `dispose={false}` used to prevent.
    const disposeBody = staffObjectSource.slice(
      staffObjectSource.indexOf("dispose() {")
    );
    expect(disposeBody).toContain("root.removeFromParent()");
    expect(disposeBody).not.toMatch(/\.dispose\(\)/);

    expect(staffSource).toContain("createStaffObject({");
    expect(staffSource).toContain("<T is={staff.root} dispose={false} />");
    expect(staffSource).not.toContain("<T.CylinderGeometry");
  });
});

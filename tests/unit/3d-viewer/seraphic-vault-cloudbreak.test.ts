import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { PerspectiveCamera, Vector3 } from "three";
import { describe, expect, it } from "vitest";
import { runtimeToBlender } from "../../../scripts/lib/seraphic-vault-cloudbreak-gate2-coordinates.mjs";

interface LayoutPoint {
  position: [number, number, number];
  width: number;
}

interface CloudbreakLayout {
  revision: string;
  approach: {
    isLiteralTraversalRoute: boolean;
  };
  attentionRoute: {
    stop: number;
    title: string;
  }[];
  lagoon: {
    outlineXZ: [number, number][];
  };
  distantMesas: (LayoutPoint & { id: string })[];
  sun: LayoutPoint & {
    visualDiameter: number;
  };
  cameraPresets: Record<
    string,
    {
      position: [number, number, number];
      target: [number, number, number];
      fovDegrees: number;
      aspect: number;
    }
  >;
}

const layout = JSON.parse(
  readFileSync(resolve("scripts/seraphic-vault-cloudbreak-layout.json"), "utf8")
) as CloudbreakLayout;

function projectedWidth(
  camera: PerspectiveCamera,
  position: [number, number, number],
  width: number
): number {
  const left = new Vector3(
    position[0] - width / 2,
    position[1],
    position[2]
  ).project(camera);
  const right = new Vector3(
    position[0] + width / 2,
    position[1],
    position[2]
  ).project(camera);
  return Math.abs(right.x - left.x);
}

describe("Olive Cloudbreak spatial contract", () => {
  it("keeps the runtime-to-Blender handedness that places the lagoon on screen right", () => {
    expect(runtimeToBlender([12, 0.14, -3])).toEqual([-12, -3, 0.14]);
    expect(layout.lagoon.outlineXZ.every(([x]) => x > 0)).toBe(true);
    expect(
      layout.lagoon.outlineXZ
        .map(([x, z]) => runtimeToBlender([x, 0.14, z]))
        .every(([x]) => x < 0)
    ).toBe(true);
  });

  it("keeps the approved high olive mesa lateral correction", () => {
    expect(layout.revision).toBe("olive-cloudbreak-r2");
    expect(
      layout.distantMesas.find(({ id }) => id === "high-olive")?.position
    ).toEqual([14, 12.5, -69]);
  });

  it("treats the fixed scene as an attention sequence instead of a traversal route", () => {
    expect(layout.approach.isLiteralTraversalRoute).toBe(false);
    expect(layout.attentionRoute.map(({ title }) => title)).toEqual([
      "GROUNDING",
      "OPEN STAGE",
      "ONE LAGOON",
      "DEEP SKY",
      "WHOLE COMPOSITION",
    ]);
  });

  it("keeps the far sun clear of every mesa in each registered camera", () => {
    for (const preset of Object.values(layout.cameraPresets)) {
      const camera = new PerspectiveCamera(
        preset.fovDegrees,
        preset.aspect,
        0.1,
        300
      );
      camera.position.fromArray(preset.position);
      camera.lookAt(new Vector3(...preset.target));
      camera.updateMatrixWorld();
      camera.updateProjectionMatrix();

      const sunProjection = new Vector3(...layout.sun.position).project(camera);
      const sunHalfWidth =
        projectedWidth(camera, layout.sun.position, layout.sun.visualDiameter) /
        2;
      for (const mesa of layout.distantMesas) {
        const mesaProjection = new Vector3(...mesa.position).project(camera);
        const mesaHalfWidth =
          projectedWidth(camera, mesa.position, mesa.width) / 2;
        const clearance =
          Math.abs(mesaProjection.x - sunProjection.x) -
          sunHalfWidth -
          mesaHalfWidth;
        expect(
          clearance,
          `${mesa.id} must not cross the solar silhouette`
        ).toBeGreaterThan(0);
      }
    }
  });
});

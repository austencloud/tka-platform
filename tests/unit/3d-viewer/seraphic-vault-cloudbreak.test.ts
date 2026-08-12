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
  sun: {
    position: [number, number, number];
    visualDiameter?: number;
    angularDiameterDegrees?: number;
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

  it("keeps the angular sun clear of every mesa in each hero camera", () => {
    const sunDirection = new Vector3(...layout.sun.position).normalize();
    const heroPresets = [
      layout.cameraPresets.desktop,
      layout.cameraPresets.portrait,
      layout.cameraPresets.landscapePhone,
    ];

    for (const preset of heroPresets) {
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

      const sunDistance = layout.sun.angularDiameterDegrees ? 150 : undefined;
      const sunPosition = sunDistance
        ? camera.position.clone().addScaledVector(sunDirection, sunDistance)
        : new Vector3(...layout.sun.position);
      const sunProjection = sunPosition.clone().project(camera);
      const sunDiameter = sunDistance
        ? 2 *
          sunDistance *
          Math.tan((layout.sun.angularDiameterDegrees! * Math.PI) / 360)
        : layout.sun.visualDiameter!;
      const sunHalfWidth =
        projectedWidth(
          camera,
          sunPosition.toArray() as [number, number, number],
          sunDiameter
        ) / 2;
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

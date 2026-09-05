import { describe, expect, it } from "vitest";
import {
  BoxGeometry,
  BufferGeometry,
  Color,
  Float32BufferAttribute,
  Group,
  InstancedMesh,
  Int16BufferAttribute,
  Matrix4,
  Mesh,
  MeshStandardMaterial,
  Texture,
  Vector3,
} from "three";
import {
  buildFlowFestCarBody,
  computeFlowFestCarNormalization,
  createFlowFestParkedCarInstances,
  disposeFlowFestCarBody,
  flowFestParkedCarPlacementMatrix,
  settleFlowFestParkedCarOnGround,
  type FlowFestParkedCarModel,
} from "../../src/routes/test/flow-fest-sim/flow-fest-parked-cars";

const model: FlowFestParkedCarModel = {
  id: "test-sedan",
  label: "test sedan",
  url: "/models/test.glb",
  lengthMeters: 4.8,
  widthMeters: 2,
  heightMeters: 1.5,
  sourceYawRadians: 0,
  // Deliberately off-centre, as every catalogue body's axle line is.
  wheels: { frontAlongMeters: 1.6, rearAlongMeters: -1.2, halfTrackMeters: 0.84 },
  paint: {
    materialNames: ["Paint"],
    variants: ["#ff0000", "#0000ff"],
    mode: "recolor",
  },
};

function buildSource(): Group {
  const source = new Group();
  const paint = new MeshStandardMaterial({ name: "Paint", color: "#888888" });
  paint.map = new Texture();
  const glass = new MeshStandardMaterial({ name: "Glass" });
  const body = new Mesh(new BoxGeometry(4.8, 1.2, 2), paint);
  body.name = "Body";
  body.position.y = 0.6;
  const windows = new Mesh(new BoxGeometry(2, 0.3, 1.8), glass);
  windows.name = "Windows";
  windows.position.y = 1.35;
  source.add(body, windows);
  return source;
}

/** A body whose underbody pan hangs 0.2 below the tyres, as the wagon's does. */
function buildSourceWithUnderbody(): Group {
  const source = buildSource();
  const wheels = new Mesh(
    new BoxGeometry(4, 0.6, 2),
    new MeshStandardMaterial({ name: "Tire" })
  );
  wheels.name = "WheelStock_FL";
  wheels.position.y = 0.3;
  const pan = new Mesh(
    new BoxGeometry(4, 0.2, 1.6),
    new MeshStandardMaterial({ name: "Bottom" })
  );
  pan.name = "Bottom";
  pan.position.y = -0.1;
  source.add(wheels, pan);
  return source;
}

/** Where the four contact patches end up once the placement matrix applies. */
function settledWheelWorldPoints(
  placement: { x: number; z: number; rotation: number },
  settled: { y: number; pitch: number; roll: number }
): Vector3[] {
  const matrix = flowFestParkedCarPlacementMatrix({
    x: placement.x,
    y: settled.y,
    z: placement.z,
    rotation: placement.rotation,
    pitch: settled.pitch,
    roll: settled.roll,
  });
  const { frontAlongMeters, rearAlongMeters, halfTrackMeters } = model.wheels;
  return [
    [frontAlongMeters, -halfTrackMeters],
    [frontAlongMeters, halfTrackMeters],
    [rearAlongMeters, -halfTrackMeters],
    [rearAlongMeters, halfTrackMeters],
  ].map(([along, across]) =>
    new Vector3(along, 0, across).applyMatrix4(matrix)
  );
}

describe("Flow Fest parked cars", () => {
  it("puts every wheel on the ground on a slope instead of hovering", () => {
    for (const ground of [
      (x: number, _z: number) => 0.1 * x,
      (_x: number, z: number) => 0.1 * z,
      (x: number, z: number) => 0.08 * x - 0.05 * z + 3,
    ]) {
      for (const rotation of [0, Math.PI / 2, 2.3]) {
        const placement = { x: 4, z: -7, rotation };
        const settled = settleFlowFestParkedCarOnGround(model, placement, (x, z) =>
          ground(x, z)
        );
        for (const wheel of settledWheelWorldPoints(placement, settled)) {
          // Each tyre rests 3 cm into the field, never above it.
          expect(wheel.y - ground(wheel.x, wheel.z)).toBeCloseTo(-0.03, 3);
        }
      }
    }
  });

  it("pitches nose-up on a rising slope and rolls away from the high side", () => {
    const uphill = settleFlowFestParkedCarOnGround(
      model,
      { x: 0, z: 0, rotation: 0 },
      (x) => 0.1 * x
    );
    expect(uphill.pitch).toBeCloseTo(Math.atan(0.1), 5);
    expect(uphill.roll).toBeCloseTo(0, 5);

    const rolled = settleFlowFestParkedCarOnGround(
      model,
      { x: 0, z: 0, rotation: 0 },
      (_x, z) => 0.1 * z
    );
    expect(rolled.pitch).toBeCloseTo(0, 5);
    expect(rolled.roll).toBeCloseTo(-Math.atan(0.1), 5);
  });

  it("grounds a body on its tyres, not on the pan hanging below them", () => {
    const placements = [
      {
        x: 0,
        y: 0,
        z: 0,
        rotation: 0,
        pitch: 0,
        roll: 0,
        modelId: model.id,
        paintIndex: 0,
      },
    ];
    const root = createFlowFestParkedCarInstances(
      buildSourceWithUnderbody(),
      model,
      placements
    );
    const wheels = (root.children as InstancedMesh[]).find((mesh) =>
      mesh.name.endsWith("_WheelStock_FL")
    )!;
    const matrix = new Matrix4();
    wheels.getMatrixAt(0, matrix);
    const wheelBottom = new Vector3(0, -0.3, 0).applyMatrix4(matrix);
    // The tyres sit on y = 0; the pan is allowed to sink below it.
    expect(wheelBottom.y).toBeCloseTo(0, 5);
  });

  it("paints only the named panels, per instance, and keeps the rest untouched", () => {
    const placements = [
      {
        x: 0,
        y: 0,
        z: 0,
        rotation: 0,
        pitch: 0,
        roll: 0,
        modelId: model.id,
        paintIndex: 0,
      },
      {
        x: 10,
        y: 0,
        z: 0,
        rotation: Math.PI / 2,
        pitch: 0,
        roll: 0,
        modelId: model.id,
        paintIndex: 1,
      },
    ];
    const root = createFlowFestParkedCarInstances(
      buildSource(),
      model,
      placements
    );
    const instanced = root.children as InstancedMesh[];
    expect(instanced).toHaveLength(2);
    const body = instanced.find((mesh) => mesh.name.endsWith("_Body"))!;
    const windows = instanced.find((mesh) => mesh.name.endsWith("_Windows"))!;
    expect(body.userData.flowFestPainted).toBe(true);
    expect(windows.userData.flowFestPainted).toBe(false);
    expect(body.instanceColor).not.toBeNull();
    expect(windows.instanceColor).toBeNull();
    const bodyMaterial = body.material as MeshStandardMaterial;
    expect(bodyMaterial.map).toBeNull();
    expect(bodyMaterial.color.getHexString()).toBe("ffffff");
    const first = new Color();
    const second = new Color();
    body.getColorAt(0, first);
    body.getColorAt(1, second);
    expect(first.getHexString()).toBe("ff0000");
    expect(second.getHexString()).toBe("0000ff");
    const matrix = new Matrix4();
    body.getMatrixAt(1, matrix);
    const position = new Vector3().setFromMatrixPosition(matrix);
    expect(position.x).toBeCloseTo(10, 5);
    expect(position.y).toBeCloseTo(0.6, 5);
  });
});

/**
 * The catalogue bodies carry all four wheels in one mesh with quantized
 * positions, so the fixture does the same: four tyre boxes at the catalogue
 * contact points, merged, stored as Int16 millimetres under a 0.001 scale.
 */
function buildSourceWithMergedTyres(): Group {
  const source = buildSource();
  const positions: number[] = [];
  const normals: number[] = [];
  const uvs: number[] = [];
  const { frontAlongMeters, rearAlongMeters, halfTrackMeters } = model.wheels;
  for (const [along, across] of [
    [frontAlongMeters, -halfTrackMeters],
    [frontAlongMeters, halfTrackMeters],
    [rearAlongMeters, -halfTrackMeters],
    [rearAlongMeters, halfTrackMeters],
  ]) {
    const box = new BoxGeometry(600, 600, 250)
      .translate(along * 1000, 300, across * 1000)
      .toNonIndexed();
    positions.push(...Array.from(box.getAttribute("position").array));
    normals.push(...Array.from(box.getAttribute("normal").array));
    uvs.push(...Array.from(box.getAttribute("uv").array));
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Int16BufferAttribute(positions, 3));
  geometry.setAttribute("normal", new Float32BufferAttribute(normals, 3));
  geometry.setAttribute("uv", new Float32BufferAttribute(uvs, 2));
  const wheels = new Mesh(
    geometry,
    new MeshStandardMaterial({ name: "RB1c_Tire" })
  );
  wheels.name = "Ace11_WheelStock_FL_RB1c_Tire_1k_0";
  wheels.scale.setScalar(0.001);
  source.add(wheels);
  return source;
}

describe("Flow Fest driven car body", () => {
  it("cuts the merged wheel mesh into four steering, spinning corners at the axle contacts", () => {
    const source = buildSourceWithMergedTyres();
    const body = buildFlowFestCarBody(source, model, 1);
    expect(body.wheels.map((wheel) => wheel.corner)).toEqual([
      "FL",
      "FR",
      "RL",
      "RR",
    ]);
    const { frontAlongMeters, rearAlongMeters, halfTrackMeters } = model.wheels;
    const expected = {
      FL: [frontAlongMeters, -halfTrackMeters],
      FR: [frontAlongMeters, halfTrackMeters],
      RL: [rearAlongMeters, -halfTrackMeters],
      RR: [rearAlongMeters, halfTrackMeters],
    } as const;
    let triangles = 0;
    for (const wheel of body.wheels) {
      const [along, across] = expected[wheel.corner];
      expect(wheel.center.x).toBeCloseTo(along, 4);
      expect(wheel.center.y).toBeCloseTo(0.3, 4);
      expect(wheel.center.z).toBeCloseTo(across, 4);
      expect(wheel.radiusMeters).toBeCloseTo(0.3, 4);
      expect(wheel.steers).toBe(wheel.corner.startsWith("F"));
      expect(wheel.parts).toHaveLength(1);
      const geometry = wheel.parts[0]!.geometry;
      geometry.computeBoundingBox();
      // Re-centred on its own axle so the spin group rotates it in place.
      const centre = geometry.boundingBox!.getCenter(new Vector3());
      expect(centre.length()).toBeLessThan(1e-4);
      const position = geometry.getAttribute("position");
      const normal = geometry.getAttribute("normal");
      expect(normal.count).toBe(position.count);
      for (let index = 0; index < normal.count; index += 1) {
        expect(
          new Vector3().fromBufferAttribute(normal, index).length()
        ).toBeCloseTo(1, 6);
      }
      expect(geometry.getAttribute("uv").count).toBe(position.count);
      triangles += position.count / 3;
      expect(wheel.parts[0]!.material.name).toBe("RB1c_Tire");
    }
    // Four boxes of twelve triangles, none lost and none duplicated.
    expect(triangles).toBe(48);
  });

  it("paints its own panel clone and leaves the shared source untouched", () => {
    const source = buildSourceWithMergedTyres();
    const sourceChildren = source.children.length;
    const sourceBody = source.children.find((child) => child.name === "Body") as Mesh;
    const sourceMaterial = sourceBody.material as MeshStandardMaterial;
    const body = buildFlowFestCarBody(source, model, 1);
    expect(source.children).toHaveLength(sourceChildren);
    expect(sourceBody.material).toBe(sourceMaterial);
    expect(sourceMaterial.map).not.toBeNull();
    expect(sourceMaterial.color.getHexString()).toBe("888888");

    const panels = body.root.children as Mesh[];
    expect(panels.map((panel) => panel.name)).toEqual([
      "FFS_DrivenCar_test-sedan_Body",
      "FFS_DrivenCar_test-sedan_Windows",
    ]);
    const panel = panels[0]!;
    expect(panel.matrixAutoUpdate).toBe(false);
    // The chase camera rides inside this body; its panels must not be hit.
    expect(panel.userData.cameraCollider).toBeUndefined();
    expect(panel.userData.flowFestPainted).toBe(true);
    expect(panel.geometry).toBe(sourceBody.geometry);
    const painted = panel.material as MeshStandardMaterial;
    expect(painted).not.toBe(sourceMaterial);
    expect(painted.map).toBeNull();
    expect(painted.color.getHexString()).toBe("0000ff");
    expect(body.ownedMaterials).toEqual([painted]);
    // The body panel keeps the lot's placement: bottom of the box on y = 0.
    const bottom = new Vector3(0, -0.6, 0).applyMatrix4(panel.matrix);
    expect(bottom.y).toBeCloseTo(0, 5);
    const windows = panels[1]!;
    expect(windows.userData.flowFestPainted).toBe(false);
    expect((windows.material as MeshStandardMaterial).name).toBe("Glass");

    const disposed: string[] = [];
    body.ownedGeometries.forEach((geometry) =>
      geometry.addEventListener("dispose", () => disposed.push("geometry"))
    );
    painted.addEventListener("dispose", () => disposed.push("material"));
    disposeFlowFestCarBody(body);
    expect(disposed).toEqual(["geometry", "geometry", "geometry", "geometry", "material"]);
  });

  it("gives a body with no named wheels no wheels at all", () => {
    const body = buildFlowFestCarBody(buildSource(), model, 0);
    expect(body.wheels).toEqual([]);
    expect(body.root.children).toHaveLength(2);
    expect(body.ownedGeometries).toEqual([]);
    const normalization = computeFlowFestCarNormalization(buildSource(), model);
    expect(normalization.scale).toBeCloseTo(1, 6);
  });
});

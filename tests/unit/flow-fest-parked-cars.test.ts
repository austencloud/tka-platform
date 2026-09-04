import { describe, expect, it } from "vitest";
import {
  BoxGeometry,
  Color,
  Group,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshStandardMaterial,
  Texture,
  Vector3,
} from "three";
import {
  createFlowFestParkedCarInstances,
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
